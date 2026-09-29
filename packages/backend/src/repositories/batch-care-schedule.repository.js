const BaseRepository = require('./base.repository');

/**
 * Repository for batch_care_schedules table operations
 */
class BatchCareScheduleRepository extends BaseRepository {
  constructor() {
    super('batch_care_schedules');
  }

  /**
   * Find active schedule for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Object|null>}
   */
  async findActiveByBatchId(batchId) {
    const query = `
      SELECT bcs.*,
             cp.name as plan_name,
             cp.plan_code,
             cp.total_duration_days,
             u.first_name || ' ' || u.last_name as applied_by_name
      FROM ${this.tableName} bcs
      JOIN crop_care_plans cp ON bcs.plan_id = cp.id
      LEFT JOIN users u ON bcs.applied_by = u.id
      WHERE bcs.batch_id = $1
        AND bcs.status = 'active'
        AND bcs.deleted_at IS NULL
      LIMIT 1
    `;
    return await this.db.oneOrNone(query, [batchId]);
  }

  /**
   * Find schedule with full details
   * @param {number} id - Schedule ID
   * @returns {Promise<Object|null>}
   */
  async findWithDetails(id) {
    const query = `
      SELECT bcs.*,
             cp.name as plan_name,
             cp.plan_code,
             cp.description as plan_description,
             cp.total_duration_days,
             cb.batch_code,
             cb.planting_date,
             cb.expected_harvest_date,
             cb.status as batch_status,
             cv.name as variety_name,
             ct.name as crop_type_name,
             u.first_name || ' ' || u.last_name as applied_by_name
      FROM ${this.tableName} bcs
      JOIN crop_care_plans cp ON bcs.plan_id = cp.id
      JOIN crop_batches cb ON bcs.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN users u ON bcs.applied_by = u.id
      WHERE bcs.id = $1 AND bcs.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Get schedule progress statistics
   * @param {number} scheduleId - Schedule ID
   * @returns {Promise<Object>}
   */
  async getProgress(scheduleId) {
    const query = `
      SELECT
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped_tasks,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_tasks,
        COUNT(*) FILTER (WHERE status = 'due') as due_tasks,
        COUNT(*) FILTER (WHERE status = 'upcoming') as upcoming_tasks,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1
        ) as completion_percentage
      FROM scheduled_batch_tasks
      WHERE schedule_id = $1 AND deleted_at IS NULL
    `;
    return await this.db.one(query, [scheduleId]);
  }

  /**
   * Find all schedules with progress
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithProgress(filters = {}) {
    let query = `
      SELECT bcs.*,
             cp.name as plan_name,
             cp.plan_code,
             cb.batch_code,
             cb.planting_date,
             cb.status as batch_status,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name,
             (SELECT COUNT(*) FROM scheduled_batch_tasks WHERE schedule_id = bcs.id AND deleted_at IS NULL) as total_tasks,
             (SELECT COUNT(*) FROM scheduled_batch_tasks WHERE schedule_id = bcs.id AND status = 'completed' AND deleted_at IS NULL) as completed_tasks,
             (SELECT COUNT(*) FROM scheduled_batch_tasks WHERE schedule_id = bcs.id AND status = 'overdue' AND deleted_at IS NULL) as overdue_tasks
      FROM ${this.tableName} bcs
      JOIN crop_care_plans cp ON bcs.plan_id = cp.id
      JOIN crop_batches cb ON bcs.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      WHERE bcs.deleted_at IS NULL
        AND cb.deleted_at IS NULL
    `;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`bcs.status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.batch_status) {
      conditions.push(`cb.status = $${paramIndex++}`);
      values.push(filters.batch_status);
    }

    if (filters.location_id) {
      conditions.push(`cb.location_id = $${paramIndex++}`);
      values.push(filters.location_id);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY bcs.created_at DESC`;

    return await this.db.any(query, values);
  }

  /**
   * Deactivate existing schedule for batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<void>}
   */
  async deactivateForBatch(batchId) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE batch_id = $1 AND status = 'active' AND deleted_at IS NULL
    `;
    await this.db.none(query, [batchId]);
  }
}

module.exports = new BatchCareScheduleRepository();
