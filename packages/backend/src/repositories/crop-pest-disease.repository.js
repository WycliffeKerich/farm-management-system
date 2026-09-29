const BaseRepository = require('./base.repository');

/**
 * Repository for crop_pests_diseases table operations
 */
class CropPestDiseaseRepository extends BaseRepository {
  constructor() {
    super('crop_pests_diseases');
  }

  /**
   * Find records by batch ID
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async findByBatchId(batchId) {
    const query = `
      SELECT cpd.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_pests_diseases cpd
      LEFT JOIN users u ON cpd.recorded_by = u.id
      WHERE cpd.batch_id = $1 AND cpd.deleted_at IS NULL
      ORDER BY cpd.incident_date DESC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Find active (unresolved) records by batch ID
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async findActiveByBatchId(batchId) {
    const query = `
      SELECT cpd.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_pests_diseases cpd
      LEFT JOIN users u ON cpd.recorded_by = u.id
      WHERE cpd.batch_id = $1 AND cpd.status != 'resolved' AND cpd.deleted_at IS NULL
      ORDER BY cpd.severity DESC, cpd.incident_date DESC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Find records by type (pest or disease)
   * @param {number} batchId - Batch ID
   * @param {string} type - Type (pest or disease)
   * @returns {Promise<Array>}
   */
  async findByType(batchId, type) {
    const query = `
      SELECT cpd.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_pests_diseases cpd
      LEFT JOIN users u ON cpd.recorded_by = u.id
      WHERE cpd.batch_id = $1 AND cpd.type = $2 AND cpd.deleted_at IS NULL
      ORDER BY cpd.incident_date DESC
    `;
    return await this.db.any(query, [batchId, type]);
  }

  /**
   * Find all records with batch details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT cpd.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM crop_pests_diseases cpd
      JOIN crop_batches cb ON cpd.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON cpd.recorded_by = u.id
    `;

    const conditions = ['cpd.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (filters.batch_id) {
      conditions.push(`cpd.batch_id = $${paramIndex++}`);
      values.push(filters.batch_id);
    }

    if (filters.type) {
      conditions.push(`cpd.type = $${paramIndex++}`);
      values.push(filters.type);
    }

    if (filters.status) {
      conditions.push(`cpd.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.severity) {
      conditions.push(`cpd.severity = $${paramIndex++}`);
      values.push(filters.severity);
    }

    if (filters.crop_type_id) {
      conditions.push(`ct.id = $${paramIndex++}`);
      values.push(filters.crop_type_id);
    }

    if (filters.location_id) {
      conditions.push(`gl.id = $${paramIndex++}`);
      values.push(filters.location_id);
    }

    if (filters.incident_date_from) {
      conditions.push(`cpd.incident_date >= $${paramIndex++}`);
      values.push(filters.incident_date_from);
    }

    if (filters.incident_date_to) {
      conditions.push(`cpd.incident_date <= $${paramIndex++}`);
      values.push(filters.incident_date_to);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY cpd.incident_date DESC';

    return await this.db.any(query, values);
  }

  /**
   * Update status of a pest/disease record
   * @param {number} id - Record ID
   * @param {string} status - New status
   * @param {string} controlMeasures - Control measures taken
   * @returns {Promise<Object>}
   */
  async updateStatus(id, status, controlMeasures) {
    const updateData = {
      status,
      control_measures: controlMeasures,
    };

    if (status === 'resolved') {
      updateData.resolution_date = new Date();
    }

    return await this.update(id, updateData);
  }

  /**
   * Get summary statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'controlled') as controlled_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) FILTER (WHERE type = 'pest') as pest_count,
        COUNT(*) FILTER (WHERE type = 'disease') as disease_count,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE severity = 'high') as high_severity_count,
        COUNT(*) as total_count
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    return await this.db.one(query);
  }

  /**
   * Get common pests/diseases
   * @param {string} type - Optional type filter (pest or disease)
   * @returns {Promise<Array>}
   */
  async getCommonIssues(type = null) {
    let query = `
      SELECT name,
             type,
             COUNT(*) as occurrence_count,
             MAX(incident_date) as last_occurrence
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;

    const values = [];
    if (type) {
      query += ' AND type = $1';
      values.push(type);
    }

    query += `
      GROUP BY name, type
      ORDER BY occurrence_count DESC
      LIMIT 20
    `;

    return await this.db.any(query, values);
  }

  /**
   * Get active issues for dashboard alert
   * @param {number} limit - Number of records
   * @returns {Promise<Array>}
   */
  async getActiveAlerts(limit = 10) {
    const query = `
      SELECT cpd.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name
      FROM crop_pests_diseases cpd
      JOIN crop_batches cb ON cpd.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      WHERE cpd.status IN ('active', 'controlled')
        AND cpd.deleted_at IS NULL
        AND cb.deleted_at IS NULL
      ORDER BY
        CASE cpd.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        cpd.incident_date DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }
}

module.exports = new CropPestDiseaseRepository();
