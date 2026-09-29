const { db } = require('../config/database');

/**
 * Refresh-token sessions. Rows are never updated in place except to mark them
 * replaced (rotation), used, or revoked.
 */
class UserSessionRepository {
  constructor() {
    this.db = db;
  }

  conn(t) {
    return t || this.db;
  }

  /**
   * Expiry is computed from the DB clock so it never depends on the app server's time zone.
   * @param {Object} session - { user_id, token_hash, family_id, ttl_days, user_agent, ip_address }
   * @param {Object} [t] - Task/transaction
   */
  async create(session, t) {
    return this.conn(t).one(
      `INSERT INTO user_sessions (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
       VALUES ($<user_id>, $<token_hash>, $<family_id>, CURRENT_TIMESTAMP + make_interval(days => $<ttl_days>::int),
               $<user_agent>, $<ip_address>)
       RETURNING *`,
      session
    );
  }

  /**
   * Find a session by token hash and lock it for the rest of the transaction.
   * Time checks are evaluated by the DB (TIMESTAMP columns hold DB-local time):
   * is_expired, and seconds_since_use for the reuse grace window.
   * @param {string} tokenHash
   * @param {Object} t - Transaction
   */
  async findByHashForUpdate(tokenHash, t) {
    return t.oneOrNone(
      `SELECT *,
              expires_at <= CURRENT_TIMESTAMP AS is_expired,
              EXTRACT(EPOCH FROM CURRENT_TIMESTAMP - last_used_at)::float AS seconds_since_use
         FROM user_sessions
        WHERE token_hash = $1
        FOR UPDATE`,
      [tokenHash]
    );
  }

  async findByHash(tokenHash, t) {
    return this.conn(t).oneOrNone('SELECT * FROM user_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async markReplaced(id, replacedById, t) {
    await this.conn(t).none(
      `UPDATE user_sessions
          SET replaced_by = COALESCE(replaced_by, $2), last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [id, replacedById]
    );
  }

  async revokeFamily(familyId, t) {
    const result = await this.conn(t).result(
      'UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE family_id = $1 AND revoked_at IS NULL',
      [familyId]
    );
    return result.rowCount;
  }

  /**
   * Revoke every session of a user, optionally keeping one family (the current device)
   * @param {number} userId
   * @param {Object} [options]
   * @param {string} [options.exceptFamilyId]
   * @param {Object} [t] - Task/transaction
   */
  async revokeAllForUser(userId, { exceptFamilyId } = {}, t) {
    const result = await this.conn(t).result(
      `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND revoked_at IS NULL
          AND ($2::uuid IS NULL OR family_id <> $2::uuid)`,
      [userId, exceptFamilyId || null]
    );
    return result.rowCount;
  }

  /**
   * Active (unrevoked, unexpired, not yet rotated) sessions for a user
   * @param {number} userId
   */
  async findActiveForUser(userId) {
    return this.db.any(
      `SELECT id, family_id, created_at, last_used_at, expires_at, user_agent, ip_address
         FROM user_sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND replaced_by IS NULL AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC`,
      [userId]
    );
  }

  /**
   * Remove sessions that can no longer be used (housekeeping)
   * @param {number} [olderThanDays=30]
   */
  async purgeExpired(olderThanDays = 30) {
    const result = await this.db.result(
      `DELETE FROM user_sessions
        WHERE COALESCE(revoked_at, expires_at) < CURRENT_TIMESTAMP - make_interval(days => $1::int)`,
      [olderThanDays]
    );
    return result.rowCount;
  }
}

module.exports = UserSessionRepository;
