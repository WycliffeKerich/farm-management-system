const BaseRepository = require('./base.repository');

// Fields that are safe to return to clients
const PUBLIC_FIELDS = [
  'id',
  'email',
  'first_name',
  'last_name',
  'role',
  'phone',
  'is_active',
  'last_login',
  'created_at',
  'updated_at',
];

/**
 * User repository for database operations
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('users', {
      // Strict whitelist: services decide which of these a caller may set
      columns: [
        'email',
        'password_hash',
        'first_name',
        'last_name',
        'role',
        'phone',
        'is_active',
        'last_login',
        'failed_login_count',
        'locked_until',
      ],
      sortable: ['email', 'first_name', 'last_name', 'role', 'last_login', 'created_at'],
    });
  }

  /**
   * Strip secrets and internal fields from a user row
   * @param {Object|null} user - User row
   * @returns {Object|null} Public user
   */
  static toPublic(user) {
    if (!user) return null;
    return Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, user[field]]));
  }

  /**
   * Find user by email (case-insensitive)
   * @param {string} email - User email
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} User or null
   */
  async findByEmail(email, t) {
    return this.conn(t).oneOrNone('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL', [email]);
  }

  /**
   * List users with optional filters
   * @param {Object} filters - { role, is_active, search }
   * @returns {Promise<Array>} Users
   */
  async list(filters = {}) {
    const conditions = ['deleted_at IS NULL'];
    const values = [];

    if (filters.role) {
      values.push(filters.role);
      conditions.push(`role = $${values.length}`);
    }
    if (filters.is_active !== undefined) {
      values.push(filters.is_active);
      conditions.push(`is_active = $${values.length}`);
    }
    if (filters.search) {
      values.push(`%${filters.search}%`);
      conditions.push(
        `(email ILIKE $${values.length} OR first_name ILIKE $${values.length} OR last_name ILIKE $${values.length})`
      );
    }

    return this.db.any(
      `SELECT * FROM users WHERE ${conditions.join(' AND ')} ORDER BY is_active DESC, first_name, last_name`,
      values
    );
  }

  /**
   * Find active users by role
   * @param {string} role - User role
   * @returns {Promise<Array>} Array of users
   */
  async findByRole(role) {
    return this.db.any(
      `SELECT * FROM users
        WHERE role = $1 AND is_active = true AND deleted_at IS NULL
        ORDER BY first_name, last_name`,
      [role]
    );
  }

  /**
   * Lock the active owners' rows and count them (use inside a transaction)
   * @param {Object} t - Transaction
   * @returns {Promise<number>} Number of active owners
   */
  async lockActiveOwners(t) {
    const rows = await t.any(
      "SELECT id FROM users WHERE role = 'owner' AND is_active = true AND deleted_at IS NULL FOR UPDATE"
    );
    return rows.length;
  }

  /**
   * Record a failed login; lock the account once the limit is reached
   * @param {number} id - User ID
   * @param {number} maxAttempts - Failures before locking
   * @param {number} lockMinutes - Lock duration
   * @returns {Promise<Object>} { failed_login_count, locked_until }
   */
  async recordFailedLogin(id, maxAttempts, lockMinutes) {
    return this.db.one(
      `UPDATE users
          SET failed_login_count = CASE WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END,
              locked_until = CASE WHEN failed_login_count + 1 >= $2
                                  THEN CURRENT_TIMESTAMP + make_interval(mins => $3::int)
                                  ELSE locked_until END
        WHERE id = $1
        RETURNING failed_login_count, locked_until`,
      [id, maxAttempts, lockMinutes]
    );
  }

  /**
   * Record a successful login
   * @param {number} id - User ID
   * @returns {Promise<void>}
   */
  async recordSuccessfulLogin(id) {
    await this.db.none(
      `UPDATE users
          SET last_login = CURRENT_TIMESTAMP, failed_login_count = 0, locked_until = NULL
        WHERE id = $1`,
      [id]
    );
  }

  /**
   * Get user statistics
   * @returns {Promise<Array>} User counts by role
   */
  async getStatistics() {
    return this.db.any(
      `SELECT role,
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE is_active)::int AS active_count
         FROM users
        WHERE deleted_at IS NULL
        GROUP BY role`
    );
  }
}

module.exports = UserRepository;
