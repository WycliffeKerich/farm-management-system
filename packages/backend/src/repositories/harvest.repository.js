const BaseRepository = require('./base.repository');

/**
 * Repository for harvests table operations
 */
class HarvestRepository extends BaseRepository {
  constructor() {
    super('harvests');
  }

  /**
   * Find harvests by batch ID
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async findByBatchId(batchId) {
    const query = `
      SELECT h.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM harvests h
      LEFT JOIN users u ON h.recorded_by = u.id
      WHERE h.batch_id = $1
      ORDER BY h.harvest_date DESC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Get total harvest quantity for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Object>}
   */
  async getTotalByBatchId(batchId) {
    const query = `
      SELECT COALESCE(SUM(quantity), 0) as total_quantity,
             unit,
             COUNT(*) as harvest_count
      FROM ${this.tableName}
      WHERE batch_id = $1
      GROUP BY unit
    `;
    return await this.db.oneOrNone(query, [batchId]);
  }

  /**
   * Find harvests with batch details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT h.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM harvests h
      JOIN crop_batches cb ON h.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON h.recorded_by = u.id
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.crop_type_id) {
      conditions.push(`ct.id = $${paramIndex++}`);
      values.push(filters.crop_type_id);
    }

    if (filters.location_id) {
      conditions.push(`gl.id = $${paramIndex++}`);
      values.push(filters.location_id);
    }

    if (filters.harvest_date_from) {
      conditions.push(`h.harvest_date >= $${paramIndex++}`);
      values.push(filters.harvest_date_from);
    }

    if (filters.harvest_date_to) {
      conditions.push(`h.harvest_date <= $${paramIndex++}`);
      values.push(filters.harvest_date_to);
    }

    if (filters.grade) {
      conditions.push(`h.grade = $${paramIndex++}`);
      values.push(filters.grade);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY h.harvest_date DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get harvest summary by crop type
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>}
   */
  async getSummaryByCropType(startDate, endDate) {
    const query = `
      SELECT ct.name as crop_type,
             h.unit,
             SUM(h.quantity) as total_quantity,
             COUNT(*) as harvest_count,
             AVG(h.quantity) as avg_quantity
      FROM harvests h
      JOIN crop_batches cb ON h.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      WHERE h.harvest_date BETWEEN $1 AND $2
      GROUP BY ct.name, h.unit
      ORDER BY total_quantity DESC
    `;
    return await this.db.any(query, [startDate, endDate]);
  }

  /**
   * Get harvest summary by grade
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getSummaryByGrade(batchId) {
    const query = `
      SELECT grade,
             SUM(quantity) as total_quantity,
             COUNT(*) as harvest_count
      FROM ${this.tableName}
      WHERE batch_id = $1
      GROUP BY grade
      ORDER BY grade ASC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Get unique grades
   * @returns {Promise<Array>}
   */
  async getGrades() {
    const query = `
      SELECT DISTINCT grade
      FROM ${this.tableName}
      WHERE grade IS NOT NULL
      ORDER BY grade ASC
    `;
    return await this.db.any(query);
  }
}

module.exports = new HarvestRepository();
