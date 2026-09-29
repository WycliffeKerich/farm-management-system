const { db } = require('../config/database');
const UserRepository = require('../repositories/user.repository');
const UserSessionRepository = require('../repositories/user-session.repository');
const AuthService = require('./auth.service');
const { ConflictError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

const toPublic = UserRepository.toPublic;

/**
 * User management (owner only). There is no public registration: the first
 * owner is created by bootstrap, everyone else by an owner.
 */
class UserService {
  constructor() {
    this.userRepository = new UserRepository();
    this.sessionRepository = new UserSessionRepository();
    this.authService = new AuthService();
  }

  /**
   * List users
   * @param {Object} filters - { role, is_active, search }
   * @returns {Promise<Array>}
   */
  async list(filters = {}) {
    const users = await this.userRepository.list(filters);
    return users.map(toPublic);
  }

  /**
   * Get a user with their active sessions
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async get(id) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');
    const sessions = await this.sessionRepository.findActiveForUser(id);
    return { ...toPublic(user), locked_until: user.locked_until, sessions };
  }

  /**
   * Create a user with an initial password chosen by the owner
   * @param {Object} data - { email, password, first_name, last_name, role, phone }
   * @param {number} actorId - Acting owner
   * @returns {Promise<Object>}
   */
  async create(data, actorId) {
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      throw new ConflictError('A user with this email already exists', 'DUPLICATE');
    }

    const user = await this.userRepository.create({
      email: data.email,
      password_hash: await this.authService.hashPassword(data.password),
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      phone: data.phone,
      is_active: true,
    });

    logger.info(`User ${user.email} (${user.role}) created by user ${actorId}`);
    return toPublic(user);
  }

  /**
   * Update a user's details, role or status.
   * The last active owner can never be demoted or deactivated.
   * @param {number} id
   * @param {Object} data - { first_name, last_name, phone, email, role, is_active }
   * @param {number} actorId - Acting owner
   * @returns {Promise<Object>}
   */
  async update(id, data, actorId) {
    const changes = {};
    for (const field of ['first_name', 'last_name', 'phone', 'email', 'role', 'is_active']) {
      if (data[field] !== undefined) changes[field] = data[field];
    }

    const user = await db.tx(async (t) => {
      const target = await this.userRepository.findById(id, t);
      if (!target) throw new NotFoundError('User not found');

      if (changes.email && changes.email.toLowerCase() !== target.email.toLowerCase()) {
        const taken = await this.userRepository.findByEmail(changes.email, t);
        if (taken) throw new ConflictError('A user with this email already exists', 'DUPLICATE');
      }

      const losesOwner =
        target.role === 'owner' &&
        target.is_active &&
        ((changes.role && changes.role !== 'owner') || changes.is_active === false);
      if (losesOwner) {
        const activeOwners = await this.userRepository.lockActiveOwners(t);
        if (activeOwners <= 1) {
          throw new ConflictError('The farm must keep at least one active owner', 'LAST_OWNER');
        }
      }

      const updated = await this.userRepository.update(id, changes, t);

      // Access is cut immediately when a user is deactivated
      if (changes.is_active === false) {
        await this.sessionRepository.revokeAllForUser(id, {}, t);
      }
      return updated;
    });

    logger.info(`User ${id} updated by user ${actorId}: ${Object.keys(changes).join(', ')}`);
    return toPublic(user);
  }

  /**
   * Set a new password for a user and sign them out everywhere
   * @param {number} id
   * @param {string} password
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async setPassword(id, password, actorId) {
    const target = await this.userRepository.findById(id);
    if (!target) throw new NotFoundError('User not found');

    const passwordHash = await this.authService.hashPassword(password);
    await db.tx(async (t) => {
      await this.userRepository.update(
        id,
        { password_hash: passwordHash, failed_login_count: 0, locked_until: null },
        t
      );
      await this.sessionRepository.revokeAllForUser(id, {}, t);
    });
    logger.info(`Password for user ${id} reset by user ${actorId}`);
  }

  /**
   * Sign a user out of every device
   * @param {number} id
   * @returns {Promise<number>} Sessions revoked
   */
  async revokeSessions(id) {
    const target = await this.userRepository.findById(id);
    if (!target) throw new NotFoundError('User not found');
    return this.sessionRepository.revokeAllForUser(id);
  }
}

module.exports = UserService;
