const BaseRepository = require('./base.repository');

/**
 * Repository for animal_care_schedules table operations
 */
class AnimalCareScheduleRepository extends BaseRepository {
  constructor() {
    super('animal_care_schedules');
  }

  /**
   * Find active schedule for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Object|null>}
   */
  async findActiveByAnimalId(animalId) {
    const query = `
      SELECT acs.*,
             acp.name as plan_name,
             acp.plan_code,
             acp.plan_type,
             u.first_name || ' ' || u.last_name as applied_by_name
      FROM ${this.tableName} acs
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      LEFT JOIN users u ON acs.applied_by = u.id
      WHERE acs.animal_id = $1
        AND acs.status = 'active'
        AND acs.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [animalId]);
  }

  /**
   * Find active schedule for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Object|null>}
   */
  async findActiveByGroupId(groupId) {
    const query = `
      SELECT acs.*,
             acp.name as plan_name,
             acp.plan_code,
             acp.plan_type,
             u.first_name || ' ' || u.last_name as applied_by_name
      FROM ${this.tableName} acs
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      LEFT JOIN users u ON acs.applied_by = u.id
      WHERE acs.animal_group_id = $1
        AND acs.status = 'active'
        AND acs.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [groupId]);
  }

  /**
   * Find all schedules for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT acs.*,
             acp.name as plan_name,
             acp.plan_code,
             acp.plan_type
      FROM ${this.tableName} acs
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      WHERE acs.animal_id = $1 AND acs.deleted_at IS NULL
      ORDER BY acs.applied_date DESC
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find all schedules for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT acs.*,
             acp.name as plan_name,
             acp.plan_code,
             acp.plan_type
      FROM ${this.tableName} acs
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      WHERE acs.animal_group_id = $1 AND acs.deleted_at IS NULL
      ORDER BY acs.applied_date DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Deactivate schedules for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<void>}
   */
  async deactivateForAnimal(animalId) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE animal_id = $1 AND status = 'active' AND deleted_at IS NULL
    `;
    await this.db.none(query, [animalId]);
  }

  /**
   * Deactivate schedules for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<void>}
   */
  async deactivateForGroup(groupId) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE animal_group_id = $1 AND status = 'active' AND deleted_at IS NULL
    `;
    await this.db.none(query, [groupId]);
  }

  /**
   * Get schedule progress
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
        COUNT(*) FILTER (WHERE status IN ('pending', 'upcoming', 'due')) as pending_tasks,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'skipped'))::DECIMAL / COUNT(*)) * 100, 2)
          ELSE 0
        END as completion_percentage
      FROM scheduled_animal_tasks
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
      SELECT acs.*,
             acp.name as plan_name,
             acp.plan_code,
             acp.plan_type,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name,
             progress.total_tasks,
             progress.completed_tasks,
             progress.overdue_tasks,
             progress.completion_percentage
      FROM ${this.tableName} acs
      JOIN animal_care_plans acp ON acs.plan_id = acp.id
      LEFT JOIN animals a ON acs.animal_id = a.id
      LEFT JOIN animal_groups ag ON acs.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) as total_tasks,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
          COUNT(*) FILTER (WHERE status = 'overdue') as overdue_tasks,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE status IN ('completed', 'skipped'))::DECIMAL / COUNT(*)) * 100, 2)
            ELSE 0
          END as completion_percentage
        FROM scheduled_animal_tasks sat
        WHERE sat.schedule_id = acs.id AND sat.deleted_at IS NULL
      ) progress ON true
      WHERE acs.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND acs.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.plan_type) {
      query += ` AND acp.plan_type = $${paramIndex++}`;
      values.push(filters.plan_type);
    }

    query += ' ORDER BY acs.applied_date DESC';

    return await this.db.any(query, values);
  }
}

module.exports = new AnimalCareScheduleRepository();
