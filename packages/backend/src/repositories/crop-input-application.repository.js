const BaseRepository = require('./base.repository');

/**
 * Repository for crop_input_applications table operations
 */
class CropInputApplicationRepository extends BaseRepository {
  constructor() {
    super('crop_input_applications');
  }

  /**
   * Find applications by batch ID
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async findByBatchId(batchId) {
    const query = `
      SELECT cia.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_input_applications cia
      LEFT JOIN users u ON cia.recorded_by = u.id
      WHERE cia.batch_id = $1 AND cia.deleted_at IS NULL
      ORDER BY cia.application_date DESC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Find applications by type
   * @param {number} batchId - Batch ID
   * @param {string} inputType - Input type (fertilizer, pesticide, herbicide, fungicide)
   * @returns {Promise<Array>}
   */
  async findByType(batchId, inputType) {
    const query = `
      SELECT cia.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_input_applications cia
      LEFT JOIN users u ON cia.recorded_by = u.id
      WHERE cia.batch_id = $1 AND cia.input_type = $2 AND cia.deleted_at IS NULL
      ORDER BY cia.application_date DESC
    `;
    return await this.db.any(query, [batchId, inputType]);
  }

  /**
   * Find applications with batch details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT cia.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_input_applications cia
      JOIN crop_batches cb ON cia.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON cia.recorded_by = u.id
    `;

    const conditions = ['cia.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (filters.batch_id) {
      conditions.push(`cia.batch_id = $${paramIndex++}`);
      values.push(filters.batch_id);
    }

    if (filters.input_type) {
      conditions.push(`cia.input_type = $${paramIndex++}`);
      values.push(filters.input_type);
    }

    if (filters.crop_type_id) {
      conditions.push(`ct.id = $${paramIndex++}`);
      values.push(filters.crop_type_id);
    }

    if (filters.location_id) {
      conditions.push(`gl.id = $${paramIndex++}`);
      values.push(filters.location_id);
    }

    if (filters.application_date_from) {
      conditions.push(`cia.application_date >= $${paramIndex++}`);
      values.push(filters.application_date_from);
    }

    if (filters.application_date_to) {
      conditions.push(`cia.application_date <= $${paramIndex++}`);
      values.push(filters.application_date_to);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY cia.application_date DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get summary by input type for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getSummaryByType(batchId) {
    const query = `
      SELECT input_type,
             COUNT(*) as application_count,
             COUNT(DISTINCT product_name) as unique_products
      FROM ${this.tableName}
      WHERE batch_id = $1 AND deleted_at IS NULL
      GROUP BY input_type
      ORDER BY application_count DESC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Get unique product names by input type
   * @param {string} inputType - Input type
   * @returns {Promise<Array>}
   */
  async getProductNames(inputType) {
    let query = `
      SELECT DISTINCT product_name
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;

    const values = [];
    if (inputType) {
      query += ' AND input_type = $1';
      values.push(inputType);
    }

    query += ' ORDER BY product_name ASC';

    return await this.db.any(query, values);
  }

  /**
   * Get application methods
   * @returns {Promise<Array>}
   */
  async getApplicationMethods() {
    const query = `
      SELECT DISTINCT application_method
      FROM ${this.tableName}
      WHERE application_method IS NOT NULL AND deleted_at IS NULL
      ORDER BY application_method ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Get recent applications for dashboard
   * @param {number} limit - Number of records
   * @returns {Promise<Array>}
   */
  async getRecentApplications(limit = 10) {
    const query = `
      SELECT cia.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name
      FROM crop_input_applications cia
      JOIN crop_batches cb ON cia.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      WHERE cia.deleted_at IS NULL
      ORDER BY cia.application_date DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }
}

module.exports = new CropInputApplicationRepository();
