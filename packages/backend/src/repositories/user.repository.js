const BaseRepository = require('./base.repository');

/**
 * User repository for database operations
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User or null
   */
  async findByEmail(email) {
    return await this.findOne({ email });
  }

  /**
   * Find active users by role
   * @param {string} role - User role
   * @returns {Promise<Array>} Array of users
   */
  async findByRole(role) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE role = $1 AND is_active = true AND deleted_at IS NULL
      ORDER BY first_name, last_name
    `;
    return await this.db.any(query, [role]);
  }

  /**
   * Update user last login timestamp
   * @param {number} id - User ID
   * @returns {Promise<void>}
   */
  async updateLastLogin(id) {
    const query = `
      UPDATE ${this.tableName}
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await this.db.none(query, [id]);
  }

  /**
   * Deactivate user account
   * @param {number} id - User ID
   * @returns {Promise<void>}
   */
  async deactivate(id) {
    const query = `
      UPDATE ${this.tableName}
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await this.db.none(query, [id]);
  }

  /**
   * Activate user account
   * @param {number} id - User ID
   * @returns {Promise<void>}
   */
  async activate(id) {
    const query = `
      UPDATE ${this.tableName}
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await this.db.none(query, [id]);
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User statistics by role
   */
  async getStatistics() {
    const query = `
      SELECT
        role,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
      GROUP BY role
    `;
    return await this.db.any(query);
  }
}

module.exports = UserRepository;
