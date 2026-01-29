const BaseRepository = require('./base.repository');

/**
 * Repository for crop_care_plan_tasks table operations
 */
class CarePlanTaskRepository extends BaseRepository {
  constructor() {
    super('crop_care_plan_tasks');
  }

  /**
   * Find all tasks for a plan
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async findByPlanId(planId) {
    const query = `
      SELECT cpt.*,
             tc.name as category_name
      FROM ${this.tableName} cpt
      LEFT JOIN task_categories tc ON cpt.task_category_id = tc.id
      WHERE cpt.plan_id = $1 AND cpt.deleted_at IS NULL
      ORDER BY cpt.days_from_planting, cpt.task_sequence
    `;
    return await this.db.any(query, [planId]);
  }

  /**
   * Get next task sequence number for a plan
   * @param {number} planId - Plan ID
   * @returns {Promise<number>}
   */
  async getNextSequence(planId) {
    const query = `
      SELECT COALESCE(MAX(task_sequence), 0) + 1 as next_sequence
      FROM ${this.tableName}
      WHERE plan_id = $1 AND deleted_at IS NULL
    `;
    const result = await this.db.one(query, [planId]);
    return result.next_sequence;
  }

  /**
   * Find recurring tasks for a plan
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async findRecurringByPlanId(planId) {
    const query = `
      SELECT cpt.*,
             tc.name as category_name
      FROM ${this.tableName} cpt
      LEFT JOIN task_categories tc ON cpt.task_category_id = tc.id
      WHERE cpt.plan_id = $1
        AND cpt.is_recurring = true
        AND cpt.deleted_at IS NULL
      ORDER BY cpt.days_from_planting
    `;
    return await this.db.any(query, [planId]);
  }

  /**
   * Find tasks by day range
   * @param {number} planId - Plan ID
   * @param {number} startDay - Start day from planting
   * @param {number} endDay - End day from planting
   * @returns {Promise<Array>}
   */
  async findByDayRange(planId, startDay, endDay) {
    const query = `
      SELECT cpt.*,
             tc.name as category_name
      FROM ${this.tableName} cpt
      LEFT JOIN task_categories tc ON cpt.task_category_id = tc.id
      WHERE cpt.plan_id = $1
        AND cpt.days_from_planting >= $2
        AND cpt.days_from_planting <= $3
        AND cpt.deleted_at IS NULL
      ORDER BY cpt.days_from_planting, cpt.task_sequence
    `;
    return await this.db.any(query, [planId, startDay, endDay]);
  }

  /**
   * Find input-related tasks (fertilizer, pesticide, etc.)
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async findInputTasksByPlanId(planId) {
    const query = `
      SELECT cpt.*,
             tc.name as category_name
      FROM ${this.tableName} cpt
      LEFT JOIN task_categories tc ON cpt.task_category_id = tc.id
      WHERE cpt.plan_id = $1
        AND cpt.input_type IS NOT NULL
        AND cpt.deleted_at IS NULL
      ORDER BY cpt.days_from_planting
    `;
    return await this.db.any(query, [planId]);
  }

  /**
   * Reorder tasks after deletion or insertion
   * @param {number} planId - Plan ID
   * @returns {Promise<void>}
   */
  async reorderTasks(planId) {
    const query = `
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY days_from_planting, task_sequence) as new_sequence
        FROM ${this.tableName}
        WHERE plan_id = $1 AND deleted_at IS NULL
      )
      UPDATE ${this.tableName} t
      SET task_sequence = o.new_sequence, updated_at = CURRENT_TIMESTAMP
      FROM ordered o
      WHERE t.id = o.id
    `;
    await this.db.none(query, [planId]);
  }
}

module.exports = new CarePlanTaskRepository();
