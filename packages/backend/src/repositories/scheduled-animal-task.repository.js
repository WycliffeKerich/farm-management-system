const BaseRepository = require('./base.repository');
const { toSqlInt } = require('../utils/sql');

/**
 * Repository for scheduled_animal_tasks table operations
 */
class ScheduledAnimalTaskRepository extends BaseRepository {
  constructor() {
    super('scheduled_animal_tasks');
  }

  /**
   * Find tasks by schedule ID
   * @param {number} scheduleId - Schedule ID
   * @returns {Promise<Array>}
   */
  async findByScheduleId(scheduleId) {
    const query = `
      SELECT sat.*,
             u.first_name || ' ' || u.last_name as completed_by_name
      FROM ${this.tableName} sat
      LEFT JOIN users u ON sat.completed_by = u.id
      WHERE sat.schedule_id = $1 AND sat.deleted_at IS NULL
      ORDER BY sat.planned_date, sat.id
    `;
    return await this.db.any(query, [scheduleId]);
  }

  /**
   * Find tasks by animal ID
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT sat.*,
             acs.start_date as schedule_start_date,
             acp.name as plan_name
      FROM ${this.tableName} sat
      JOIN animal_care_schedules acs ON sat.schedule_id = acs.id
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      WHERE sat.animal_id = $1 AND sat.deleted_at IS NULL
      ORDER BY sat.planned_date
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find tasks by group ID
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT sat.*,
             acs.start_date as schedule_start_date,
             acp.name as plan_name
      FROM ${this.tableName} sat
      JOIN animal_care_schedules acs ON sat.schedule_id = acs.id
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      WHERE sat.animal_group_id = $1 AND sat.deleted_at IS NULL
      ORDER BY sat.planned_date
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Find upcoming tasks
   * @param {number} daysAhead - Days to look ahead
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findUpcoming(daysAhead = 7, filters = {}) {
    let query = `
      SELECT sat.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name,
             acp.name as plan_name,
             acp.plan_type
      FROM ${this.tableName} sat
      JOIN animal_care_schedules acs ON sat.schedule_id = acs.id
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      LEFT JOIN animals a ON sat.animal_id = a.id
      LEFT JOIN animal_groups ag ON sat.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE sat.deleted_at IS NULL
        AND sat.status IN ('pending', 'upcoming', 'due')
        AND sat.planned_date <= CURRENT_DATE + make_interval(days => ${toSqlInt(daysAhead, { name: 'daysAhead' })})
        AND acs.status = 'active'
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.task_type) {
      query += ` AND sat.task_type = $${paramIndex++}`;
      values.push(filters.task_type);
    }

    if (filters.priority) {
      query += ` AND sat.priority = $${paramIndex++}`;
      values.push(filters.priority);
    }

    query += ' ORDER BY sat.planned_date, sat.priority DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find overdue tasks
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findOverdue(filters = {}) {
    let query = `
      SELECT sat.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name,
             acp.name as plan_name,
             acp.plan_type
      FROM ${this.tableName} sat
      JOIN animal_care_schedules acs ON sat.schedule_id = acs.id
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      LEFT JOIN animals a ON sat.animal_id = a.id
      LEFT JOIN animal_groups ag ON sat.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE sat.deleted_at IS NULL
        AND sat.status = 'overdue'
        AND acs.status = 'active'
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY sat.due_date_end, sat.priority DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find tasks by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findByDateRange(startDate, endDate, filters = {}) {
    let query = `
      SELECT sat.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name,
             acp.name as plan_name,
             acp.plan_type
      FROM ${this.tableName} sat
      JOIN animal_care_schedules acs ON sat.schedule_id = acs.id
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      LEFT JOIN animals a ON sat.animal_id = a.id
      LEFT JOIN animal_groups ag ON sat.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE sat.deleted_at IS NULL
        AND sat.planned_date >= $1
        AND sat.planned_date <= $2
    `;

    const values = [startDate, endDate];
    let paramIndex = 3;

    if (filters.status) {
      query += ` AND sat.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY sat.planned_date, sat.priority DESC';

    return await this.db.any(query, values);
  }

  /**
   * Mark task as completed
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} notes - Completion notes
   * @param {number} quantityTreated - For groups, how many were treated
   * @returns {Promise<Object>}
   */
  async markCompleted(taskId, userId, notes = null, quantityTreated = null) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'completed',
          actual_date = CURRENT_DATE,
          completed_by = $2,
          completion_notes = $3,
          quantity_treated = COALESCE($4, quantity_total),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [taskId, userId, notes, quantityTreated]);
  }

  /**
   * Mark task as partially completed (for groups)
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {number} quantityTreated - Number treated
   * @param {string} notes - Notes
   * @returns {Promise<Object>}
   */
  async markPartiallyCompleted(taskId, userId, quantityTreated, notes = null) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'partially_completed',
          actual_date = CURRENT_DATE,
          completed_by = $2,
          quantity_treated = $3,
          completion_notes = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [taskId, userId, quantityTreated, notes]);
  }

  /**
   * Mark task as skipped
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>}
   */
  async markSkipped(taskId, userId, reason) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'skipped',
          completed_by = $2,
          completion_notes = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [taskId, userId, reason]);
  }

  /**
   * Link task to health record
   * @param {number} taskId - Task ID
   * @param {number} healthRecordId - Health record ID
   * @returns {Promise<Object>}
   */
  async linkToHealthRecord(taskId, healthRecordId) {
    const query = `
      UPDATE ${this.tableName}
      SET health_record_id = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [taskId, healthRecordId]);
  }

  /**
   * Update task statuses based on current date
   * @returns {Promise<Object>}
   */
  async updateStatuses() {
    await this.db.func('update_scheduled_animal_task_statuses');
    return { updated: true };
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
        sat.planned_date,
        sat.status,
        sat.task_name,
        sat.task_type,
        sat.priority,
        a.tag_number as animal_tag,
        ag.name as group_name,
        at.name as animal_type_name
      FROM ${this.tableName} sat
      JOIN animal_care_schedules acs ON sat.schedule_id = acs.id
      LEFT JOIN animals a ON sat.animal_id = a.id
      LEFT JOIN animal_groups ag ON sat.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE sat.deleted_at IS NULL
        AND sat.planned_date >= $1
        AND sat.planned_date <= $2
    `;

    const values = [startDate, endDate];
    let paramIndex = 3;

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY sat.planned_date, sat.priority DESC';

    return await this.db.any(query, values);
  }
}

module.exports = new ScheduledAnimalTaskRepository();
