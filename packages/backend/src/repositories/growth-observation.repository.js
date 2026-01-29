const BaseRepository = require('./base.repository');

/**
 * Repository for growth_observations table operations
 */
class GrowthObservationRepository extends BaseRepository {
  constructor() {
    super('growth_observations');
  }

  /**
   * Find observations by batch ID
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async findByBatchId(batchId) {
    const query = `
      SELECT go.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM growth_observations go
      LEFT JOIN users u ON go.recorded_by = u.id
      WHERE go.batch_id = $1
      ORDER BY go.observation_date DESC
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Get latest observation for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Object|null>}
   */
  async getLatestByBatchId(batchId) {
    const query = `
      SELECT go.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM growth_observations go
      LEFT JOIN users u ON go.recorded_by = u.id
      WHERE go.batch_id = $1
      ORDER BY go.observation_date DESC
      LIMIT 1
    `;
    return await this.db.oneOrNone(query, [batchId]);
  }

  /**
   * Get observations within date range
   * @param {number} batchId - Batch ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>}
   */
  async findByDateRange(batchId, startDate, endDate) {
    const query = `
      SELECT go.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM growth_observations go
      LEFT JOIN users u ON go.recorded_by = u.id
      WHERE go.batch_id = $1
        AND go.observation_date BETWEEN $2 AND $3
      ORDER BY go.observation_date ASC
    `;
    return await this.db.any(query, [batchId, startDate, endDate]);
  }

  /**
   * Get unique growth stages
   * @returns {Promise<Array>}
   */
  async getGrowthStages() {
    const query = `
      SELECT DISTINCT growth_stage
      FROM ${this.tableName}
      WHERE growth_stage IS NOT NULL
      ORDER BY growth_stage ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Get unique health statuses
   * @returns {Promise<Array>}
   */
  async getHealthStatuses() {
    const query = `
      SELECT DISTINCT health_status
      FROM ${this.tableName}
      WHERE health_status IS NOT NULL
      ORDER BY health_status ASC
    `;
    return await this.db.any(query);
  }
}

module.exports = new GrowthObservationRepository();
