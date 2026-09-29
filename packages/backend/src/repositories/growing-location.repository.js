const BaseRepository = require('./base.repository');

/**
 * Repository for growing_locations table operations
 */
class GrowingLocationRepository extends BaseRepository {
  constructor() {
    super('growing_locations');
  }

  /**
   * Find all active locations
   * @returns {Promise<Array>}
   */
  async findAllActive() {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE is_active = true AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Find locations with current batch counts
   * @returns {Promise<Array>}
   */
  async findAllWithBatchCounts() {
    const query = `
      SELECT gl.*,
             COUNT(cb.id) FILTER (WHERE cb.status IN ('planted', 'growing', 'harvesting')) as active_batches_count
      FROM growing_locations gl
      LEFT JOIN crop_batches cb ON gl.id = cb.location_id AND cb.deleted_at IS NULL
      WHERE gl.deleted_at IS NULL
      GROUP BY gl.id
      ORDER BY gl.name ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Find location by name
   * @param {string} name - Location name
   * @returns {Promise<Object|null>}
   */
  async findByName(name) {
    const query = `SELECT * FROM ${this.tableName} WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL`;
    return await this.db.oneOrNone(query, [name]);
  }

  /**
   * Find locations by type
   * @param {string} type - Location type (e.g., 'greenhouse', 'mushroom_house')
   * @returns {Promise<Array>}
   */
  async findByType(type) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE type = $1 AND is_active = true AND deleted_at IS NULL
      ORDER BY name ASC
    `;
    return await this.db.any(query, [type]);
  }

  /**
   * Get all unique location types
   * @returns {Promise<Array>}
   */
  async getTypes() {
    const query = `SELECT DISTINCT type FROM ${this.tableName} WHERE deleted_at IS NULL ORDER BY type ASC`;
    return await this.db.any(query);
  }

  /**
   * Toggle location active status
   * @param {number} id - Location ID
   * @param {boolean} isActive - New active status
   * @returns {Promise<Object>}
   */
  async setActiveStatus(id, isActive) {
    const query = `
      UPDATE ${this.tableName}
      SET is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    return await this.db.one(query, [id, isActive]);
  }
}

module.exports = new GrowingLocationRepository();
