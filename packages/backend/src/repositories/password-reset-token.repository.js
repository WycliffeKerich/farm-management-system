const { db } = require('../config/database');

/**
 * Single-use password reset tokens (stored hashed)
 */
class PasswordResetTokenRepository {
  constructor() {
    this.db = db;
  }

  conn(t) {
    return t || this.db;
  }

  /**
   * Create a token, invalidating any earlier unused tokens for the user
   * @param {number} userId
   * @param {string} tokenHash
   * @param {number} ttlMinutes
   */
  async createForUser(userId, tokenHash, ttlMinutes) {
    return this.db.tx(async (t) => {
      await t.none(
        'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );
      return t.one(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + make_interval(mins => $3::int))
         RETURNING *`,
        [userId, tokenHash, ttlMinutes]
      );
    });
  }

  /**
   * Find an unused, unexpired token and lock it
   * @param {string} tokenHash
   * @param {Object} t - Transaction
   */
  async findValidForUpdate(tokenHash, t) {
    return t.oneOrNone(
      `SELECT * FROM password_reset_tokens
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
        FOR UPDATE`,
      [tokenHash]
    );
  }

  async markUsed(id, t) {
    await this.conn(t).none('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }
}

module.exports = PasswordResetTokenRepository;
