const BaseRepository = require('./base.repository');

/**
 * Repository for crop_types table operations
 */
class CropTypeRepository extends BaseRepository {
  constructor() {
    super('crop_types');
  }

  /**
   * Find all crop types with their varieties count
   * @returns {Promise<Array>}
   */
  async findAllWithVarieties() {
    const query = `
      SELECT ct.*,
             COUNT(cv.id) as varieties_count
      FROM crop_types ct
      LEFT JOIN crop_varieties cv ON ct.id = cv.crop_type_id
      GROUP BY ct.id
      ORDER BY ct.name ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Find crop type by name
   * @param {string} name - Crop type name
   * @returns {Promise<Object|null>}
   */
  async findByName(name) {
    const query = `SELECT * FROM ${this.tableName} WHERE LOWER(name) = LOWER($1)`;
    return await this.db.oneOrNone(query, [name]);
  }

  /**
   * Find crop types by category
   * @param {string} category - Category name
   * @returns {Promise<Array>}
   */
  async findByCategory(category) {
    const query = `SELECT * FROM ${this.tableName} WHERE category = $1 ORDER BY name ASC`;
    return await this.db.any(query, [category]);
  }

  /**
   * Get all unique categories
   * @returns {Promise<Array>}
   */
  async getCategories() {
    const query = `SELECT DISTINCT category FROM ${this.tableName} ORDER BY category ASC`;
    return await this.db.any(query);
  }
}

module.exports = new CropTypeRepository();
