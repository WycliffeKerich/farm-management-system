const BaseRepository = require('./base.repository');

/**
 * Repository for crop_varieties table operations
 */
class CropVarietyRepository extends BaseRepository {
  constructor() {
    super('crop_varieties');
  }

  /**
   * Find all varieties with their crop type info
   * @returns {Promise<Array>}
   */
  async findAllWithCropType() {
    const query = `
      SELECT cv.*,
             ct.name as crop_type_name,
             ct.category as crop_type_category
      FROM crop_varieties cv
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      WHERE cv.deleted_at IS NULL
      ORDER BY ct.name ASC, cv.name ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Find varieties by crop type ID
   * @param {number} cropTypeId - Crop type ID
   * @returns {Promise<Array>}
   */
  async findByCropTypeId(cropTypeId) {
    const query = `
      SELECT cv.*,
             ct.name as crop_type_name
      FROM crop_varieties cv
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      WHERE cv.crop_type_id = $1 AND cv.deleted_at IS NULL
      ORDER BY cv.name ASC
    `;
    return await this.db.any(query, [cropTypeId]);
  }

  /**
   * Find variety by name and crop type
   * @param {string} name - Variety name
   * @param {number} cropTypeId - Crop type ID
   * @returns {Promise<Object|null>}
   */
  async findByNameAndCropType(name, cropTypeId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1) AND crop_type_id = $2 AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [name, cropTypeId]);
  }

  /**
   * Find variety with full details
   * @param {number} id - Variety ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT cv.*,
             ct.name as crop_type_name,
             ct.category as crop_type_category,
             ct.typical_growth_days as crop_type_growth_days,
             ct.enterprise_id as crop_type_enterprise_id
      FROM crop_varieties cv
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      WHERE cv.id = $1 AND cv.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }
}

module.exports = new CropVarietyRepository();
