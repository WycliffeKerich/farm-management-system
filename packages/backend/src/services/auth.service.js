const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const UserRepository = require('../repositories/user.repository');
const UserSessionRepository = require('../repositories/user-session.repository');
const PasswordResetTokenRepository = require('../repositories/password-reset-token.repository');
const { AppError, AuthenticationError, ConflictError } = require('../utils/errors');
const { generateToken, hashToken } = require('../utils/tokens');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10);
// Two tabs refreshing with the same token at the same moment is not theft
const REFRESH_REUSE_GRACE_SECONDS = parseInt(process.env.REFRESH_REUSE_GRACE_SECONDS || '10', 10);
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 30;

// Compared against when the email is unknown, so response time does not reveal which emails exist
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const toPublic = UserRepository.toPublic;

/**
 * Authentication service
 *
 * Access tokens: short-lived JWTs held in memory by the client.
 * Refresh tokens: opaque random strings in an httpOnly cookie, stored hashed in
 * user_sessions and rotated on every use. Presenting an already-rotated token
 * revokes the whole family (every token descended from that login).
 */
class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
    this.sessionRepository = new UserSessionRepository();
    this.resetTokenRepository = new PasswordResetTokenRepository();
  }

  /**
   * Hash a password
   * @param {string} password
   * @returns {Promise<string>}
   */
  hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * Whether the system still needs its first owner account
   * @returns {Promise<boolean>}
   */
  async needsBootstrap() {
    const { exists } = await db.one('SELECT EXISTS(SELECT 1 FROM users) AS exists');
    return !exists;
  }

  /**
   * Create the first owner account. Only works while the users table is empty.
   * @param {Object} data - { email, password, first_name, last_name, phone }
   * @returns {Promise<Object>} Created owner
   */
  async bootstrap(data) {
    const passwordHash = await this.hashPassword(data.password);

    const user = await db.tx(async (t) => {
      // Serialise concurrent bootstrap attempts
      await t.one("SELECT pg_advisory_xact_lock(hashtext('farm_bootstrap_owner'))");
      const { exists } = await t.one('SELECT EXISTS(SELECT 1 FROM users) AS exists');
      if (exists) {
        throw new ConflictError('Initial setup has already been completed', 'ALREADY_BOOTSTRAPPED');
      }
      return this.userRepository.create(
        {
          email: data.email,
          password_hash: passwordHash,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          role: 'owner',
          is_active: true,
        },
        t
      );
    });

    logger.info(`Initial owner account created: ${user.email}`);
    return toPublic(user);
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} [meta] - { userAgent, ip }
   * @returns {Promise<Object>} { user, accessToken, refreshToken }
   */
  async login(email, password, meta = {}) {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AuthenticationError(
        'Account temporarily locked after too many failed attempts. Try again later.',
        'ACCOUNT_LOCKED'
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const state = await this.userRepository.recordFailedLogin(user.id, MAX_FAILED_LOGINS, LOCK_MINUTES);
      if (state.locked_until) {
        logger.warn(`Account locked after ${MAX_FAILED_LOGINS} failed logins: ${user.email}`);
      }
      throw new AuthenticationError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    // Checked after the password so a deactivated account cannot be probed
    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated', 'ACCOUNT_DISABLED');
    }

    await this.userRepository.recordSuccessfulLogin(user.id);
    const { token: refreshToken } = await this.issueSession(user.id, crypto.randomUUID(), meta);

    logger.info(`User logged in: ${user.email}`);

    return {
      user: toPublic(user),
      accessToken: this.generateAccessToken(user),
      refreshToken,
    };
  }

  /**
   * Rotate a refresh token
   * @param {string} refreshToken - Opaque refresh token from the cookie
   * @param {Object} [meta] - { userAgent, ip }
   * @returns {Promise<Object>} { user, accessToken, refreshToken }
   */
  async refresh(refreshToken, meta = {}) {
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token not provided', 'INVALID_REFRESH_TOKEN');
    }
    const tokenHash = hashToken(refreshToken);

    // The transaction returns an outcome instead of throwing, so that a family
    // revocation is committed before we reject the request
    const outcome = await db.tx(async (t) => {
      const session = await this.sessionRepository.findByHashForUpdate(tokenHash, t);
      if (!session) return { error: 'INVALID' };

      if (session.revoked_at) {
        return { error: 'REVOKED' };
      }

      if (session.replaced_by) {
        const usedAt = session.last_used_at ? new Date(session.last_used_at).getTime() : 0;
        const withinGrace = Date.now() - usedAt < REFRESH_REUSE_GRACE_SECONDS * 1000;
        if (!withinGrace) {
          await this.sessionRepository.revokeFamily(session.family_id, t);
          return { error: 'REUSED', session };
        }
      }

      if (new Date(session.expires_at) <= new Date()) return { error: 'EXPIRED' };

      const user = await this.userRepository.findById(session.user_id, t);
      if (!user || !user.is_active) {
        await this.sessionRepository.revokeFamily(session.family_id, t);
        return { error: 'USER_INACTIVE' };
      }

      const next = await this.issueSession(user.id, session.family_id, meta, t);
      await this.sessionRepository.markReplaced(session.id, next.session.id, t);
      return { user, refreshToken: next.token };
    });

    if (outcome.error === 'REUSED') {
      logger.warn(
        `Refresh token reuse detected for user ${outcome.session.user_id}; revoked family ${outcome.session.family_id}`
      );
      throw new AuthenticationError('Session is no longer valid. Please log in again.', 'REFRESH_TOKEN_REUSED');
    }
    if (outcome.error) {
      throw new AuthenticationError('Invalid or expired session. Please log in again.', 'INVALID_REFRESH_TOKEN');
    }

    return {
      user: toPublic(outcome.user),
      accessToken: this.generateAccessToken(outcome.user),
      refreshToken: outcome.refreshToken,
    };
  }

  /**
   * Revoke the session (device) that owns this refresh token
   * @param {string} refreshToken
   * @returns {Promise<void>}
   */
  async logout(refreshToken) {
    if (!refreshToken) return;
    const session = await this.sessionRepository.findByHash(hashToken(refreshToken));
    if (session) {
      await this.sessionRepository.revokeFamily(session.family_id);
    }
  }

  /**
   * Revoke every session of a user
   * @param {number} userId
   * @returns {Promise<number>} Sessions revoked
   */
  async logoutAll(userId) {
    return this.sessionRepository.revokeAllForUser(userId);
  }

  /**
   * Get current user profile
   * @param {number} userId - User ID
   * @returns {Promise<Object>} User profile
   */
  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    return toPublic(user);
  }

  /**
   * Update own profile. Only name and phone can be changed here;
   * email, role and status are managed by an owner.
   * @param {number} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  async updateProfile(userId, updateData) {
    const allowed = {};
    for (const field of ['first_name', 'last_name', 'phone']) {
      if (updateData[field] !== undefined) allowed[field] = updateData[field];
    }

    const user = await this.userRepository.update(userId, allowed);
    logger.info(`User profile updated: ${user.email}`);
    return toPublic(user);
  }

  /**
   * Change own password and sign out every other device
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} [currentRefreshToken] - Keeps this device signed in
   * @returns {Promise<void>}
   */
  async changePassword(userId, currentPassword, newPassword, currentRefreshToken) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Current password is incorrect', 'INVALID_CREDENTIALS');
    }

    const passwordHash = await this.hashPassword(newPassword);
    const currentSession = currentRefreshToken
      ? await this.sessionRepository.findByHash(hashToken(currentRefreshToken))
      : null;
    const exceptFamilyId = currentSession && currentSession.user_id === userId ? currentSession.family_id : undefined;

    await db.tx(async (t) => {
      await this.userRepository.update(userId, { password_hash: passwordHash }, t);
      await this.sessionRepository.revokeAllForUser(userId, { exceptFamilyId }, t);
    });

    logger.info(`Password changed for user: ${user.email}`);
  }

  /**
   * Start a password reset. Always succeeds from the caller's point of view.
   * Until notifications arrive (Phase 9) the link is written to the log outside production.
   * @param {string} email
   * @returns {Promise<string|undefined>} The raw token (for tests; never sent to the client)
   */
  async forgotPassword(email) {
    const user = await this.userRepository.findByEmail(email);
    if (!user || !user.is_active) {
      logger.info(`Password reset requested for unknown or inactive email: ${email}`);
      return undefined;
    }

    const token = generateToken();
    await this.resetTokenRepository.createForUser(user.id, hashToken(token), RESET_TOKEN_TTL_MINUTES);

    if (process.env.NODE_ENV !== 'production') {
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      logger.info(`Password reset link for ${user.email}: ${appUrl}/auth/reset-password?token=${token}`);
    }
    return token;
  }

  /**
   * Complete a password reset. Revokes all sessions and clears any lockout.
   * @param {string} token - Raw reset token
   * @param {string} newPassword
   * @returns {Promise<void>}
   */
  async resetPassword(token, newPassword) {
    const passwordHash = await this.hashPassword(newPassword);

    await db.tx(async (t) => {
      const record = await this.resetTokenRepository.findValidForUpdate(hashToken(token), t);
      if (!record) {
        throw new AppError('This reset link is invalid or has expired', 400, 'INVALID_RESET_TOKEN');
      }
      await this.resetTokenRepository.markUsed(record.id, t);
      await this.userRepository.update(
        record.user_id,
        { password_hash: passwordHash, failed_login_count: 0, locked_until: null },
        t
      );
      await this.sessionRepository.revokeAllForUser(record.user_id, {}, t);
      logger.info(`Password reset completed for user ${record.user_id}`);
    });
  }

  /**
   * Create a refresh-token session
   * @param {number} userId
   * @param {string} familyId
   * @param {Object} meta - { userAgent, ip }
   * @param {Object} [t] - Transaction
   * @returns {Promise<{token: string, session: Object}>}
   */
  async issueSession(userId, familyId, meta = {}, t) {
    const token = generateToken();
    const session = await this.sessionRepository.create(
      {
        user_id: userId,
        token_hash: hashToken(token),
        family_id: familyId,
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        user_agent: meta.userAgent ? String(meta.userAgent).slice(0, 255) : null,
        ip_address: meta.ip ? String(meta.ip).slice(0, 64) : null,
      },
      t
    );
    return { token, session };
  }

  /**
   * Generate access token
   * @param {Object} user - User object
   * @returns {string} JWT access token
   */
  generateAccessToken(user) {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '15m',
    });
  }
}

AuthService.REFRESH_TOKEN_TTL_DAYS = REFRESH_TOKEN_TTL_DAYS;

module.exports = AuthService;
