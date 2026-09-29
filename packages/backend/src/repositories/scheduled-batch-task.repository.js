const BaseRepository = require('./base.repository');

/**
 * Repository for scheduled_batch_tasks table operations
 */
class ScheduledBatchTaskRepository extends BaseRepository {
  constructor() {
    super('scheduled_batch_tasks');
  }

  /**
   * Find all scheduled tasks for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async findByBatchId(batchId) {
    const query = `
      SELECT sbt.*,
             u.first_name || ' ' || u.last_name as completed_by_name
      FROM ${this.tableName} sbt
      LEFT JOIN users u ON sbt.completed_by = u.id
      WHERE sbt.batch_id = $1 AND sbt.deleted_at IS NULL
      ORDER BY sbt.planned_date, sbt.id
    `;
    return await this.db.any(query, [batchId]);
  }

  /**
   * Find tasks by schedule with status filter
   * @param {number} scheduleId - Schedule ID
   * @param {string} status - Optional status filter
   * @returns {Promise<Array>}
   */
  async findByScheduleId(scheduleId, status = null) {
    let query = `
      SELECT sbt.*,
             u.first_name || ' ' || u.last_name as completed_by_name
      FROM ${this.tableName} sbt
      LEFT JOIN users u ON sbt.completed_by = u.id
      WHERE sbt.schedule_id = $1 AND sbt.deleted_at IS NULL
    `;

    const values = [scheduleId];

    if (status) {
      query += ` AND sbt.status = $2`;
      values.push(status);
    }

    query += ` ORDER BY sbt.planned_date, sbt.id`;

    return await this.db.any(query, values);
  }

  /**
   * Find tasks by planned date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>}
   */
  async findByDateRange(startDate, endDate, filters = {}) {
    let query = `
      SELECT sbt.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name,
             u.first_name || ' ' || u.last_name as completed_by_name
      FROM ${this.tableName} sbt
      JOIN crop_batches cb ON sbt.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON sbt.completed_by = u.id
      WHERE sbt.planned_date >= $1
        AND sbt.planned_date <= $2
        AND sbt.deleted_at IS NULL
        AND cb.deleted_at IS NULL
    `;

    const values = [startDate, endDate];
    let paramIndex = 3;

    if (filters.status) {
      query += ` AND sbt.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.location_id) {
      query += ` AND cb.location_id = $${paramIndex++}`;
      values.push(filters.location_id);
    }

    if (filters.batch_id) {
      query += ` AND sbt.batch_id = $${paramIndex++}`;
      values.push(filters.batch_id);
    }

    if (filters.input_type) {
      query += ` AND sbt.input_type = $${paramIndex++}`;
      values.push(filters.input_type);
    }

    query += ` ORDER BY sbt.planned_date, sbt.id`;

    return await this.db.any(query, values);
  }

  /**
   * Find overdue tasks
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findOverdue(filters = {}) {
    let query = `
      SELECT sbt.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name
      FROM ${this.tableName} sbt
      JOIN crop_batches cb ON sbt.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      WHERE sbt.status = 'overdue'
        AND sbt.deleted_at IS NULL
        AND cb.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.location_id) {
      query += ` AND cb.location_id = $${paramIndex++}`;
      values.push(filters.location_id);
    }

    if (filters.batch_id) {
      query += ` AND sbt.batch_id = $${paramIndex++}`;
      values.push(filters.batch_id);
    }

    query += ` ORDER BY sbt.due_date_end ASC, sbt.planned_date`;

    return await this.db.any(query, values);
  }

  /**
   * Find upcoming tasks (within next N days)
   * @param {number} daysAhead - Number of days to look ahead
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findUpcoming(daysAhead = 7, filters = {}) {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + daysAhead);

    let query = `
      SELECT sbt.*,
             cb.batch_code,
             cv.name as variety_name,
             ct.name as crop_type_name,
             gl.name as location_name
      FROM ${this.tableName} sbt
      JOIN crop_batches cb ON sbt.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      WHERE sbt.planned_date >= $1
        AND sbt.planned_date <= $2
        AND sbt.status IN ('pending', 'upcoming', 'due')
        AND sbt.deleted_at IS NULL
        AND cb.deleted_at IS NULL
    `;

    const values = [today, endDate];
    let paramIndex = 3;

    if (filters.location_id) {
      query += ` AND cb.location_id = $${paramIndex++}`;
      values.push(filters.location_id);
    }

    if (filters.batch_id) {
      query += ` AND sbt.batch_id = $${paramIndex++}`;
      values.push(filters.batch_id);
    }

    query += ` ORDER BY sbt.planned_date, sbt.id`;

    return await this.db.any(query, values);
  }

  /**
   * Mark task as completed
   * @param {number} id - Task ID
   * @param {number} userId - User completing the task
   * @param {string} notes - Completion notes
   * @returns {Promise<Object>}
   */
  async markCompleted(id, userId, notes = null) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'completed',
          actual_date = CURRENT_DATE,
          completed_by = $2,
          completion_notes = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id, userId, notes]);
  }

  /**
   * Mark task as skipped
   * @param {number} id - Task ID
   * @param {number} userId - User skipping the task
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>}
   */
  async markSkipped(id, userId, reason) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'skipped',
          completed_by = $2,
          completion_notes = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id, userId, reason]);
  }

  /**
   * Link task to farm task system
   * @param {number} id - Scheduled task ID
   * @param {number} taskId - Farm task ID
   * @returns {Promise<Object>}
   */
  async linkToTask(id, taskId) {
    const query = `
      UPDATE ${this.tableName}
      SET task_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id, taskId]);
  }

  /**
   * Link task to input application
   * @param {number} id - Scheduled task ID
   * @param {number} inputApplicationId - Input application ID
   * @returns {Promise<Object>}
   */
  async linkToInputApplication(id, inputApplicationId) {
    const query = `
      UPDATE ${this.tableName}
      SET input_application_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id, inputApplicationId]);
  }

  /**
   * Update task statuses based on current date
   * @returns {Promise<Object>} Count of updated tasks
   */
  async updateStatuses() {
    // Call the database function
    await this.db.func('update_scheduled_task_statuses');

    // Return counts of each status
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'upcoming') as upcoming,
        COUNT(*) FILTER (WHERE status = 'due') as due,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'skipped') as skipped
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    return await this.db.one(query);
  }

  /**
   * Delete all scheduled tasks for a schedule
   * @param {number} scheduleId - Schedule ID
   * @returns {Promise<void>}
   */
  async deleteByScheduleId(scheduleId) {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE schedule_id = $1 AND deleted_at IS NULL
    `;
    await this.db.none(query, [scheduleId]);
  }

  /**
   * Get calendar data for scheduled tasks
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getCalendarData(year, month, filters = {}) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let query = `
      SELECT
        sbt.planned_date,
        COUNT(*) as task_count,
        COUNT(*) FILTER (WHERE sbt.status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE sbt.status = 'overdue') as overdue_count,
        COUNT(*) FILTER (WHERE sbt.input_type IS NOT NULL) as input_task_count,
        json_agg(json_build_object(
          'id', sbt.id,
          'task_name', sbt.task_name,
          'status', sbt.status,
          'input_type', sbt.input_type,
          'batch_code', cb.batch_code,
          'variety_name', cv.name
        ) ORDER BY sbt.id) as tasks
      FROM ${this.tableName} sbt
      JOIN crop_batches cb ON sbt.batch_id = cb.id
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      WHERE sbt.planned_date >= $1
        AND sbt.planned_date <= $2
        AND sbt.deleted_at IS NULL
        AND cb.deleted_at IS NULL
    `;

    const values = [startDate, endDate];
    let paramIndex = 3;

    if (filters.location_id) {
      query += ` AND cb.location_id = $${paramIndex++}`;
      values.push(filters.location_id);
    }

    if (filters.batch_id) {
      query += ` AND sbt.batch_id = $${paramIndex++}`;
      values.push(filters.batch_id);
    }

    query += ` GROUP BY sbt.planned_date ORDER BY sbt.planned_date`;

    return await this.db.any(query, values);
  }
}

module.exports = new ScheduledBatchTaskRepository();
