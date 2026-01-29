const BaseRepository = require('./base.repository');

/**
 * Repository for animal_care_plan_tasks table operations
 */
class AnimalCarePlanTaskRepository extends BaseRepository {
  constructor() {
    super('animal_care_plan_tasks');
  }

  /**
   * Find tasks by plan ID
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async findByPlanId(planId) {
    const query = `
      SELECT acpt.*,
             tc.name as category_name
      FROM ${this.tableName} acpt
      LEFT JOIN task_categories tc ON acpt.task_category_id = tc.id
      WHERE acpt.plan_id = $1 AND acpt.deleted_at IS NULL
      ORDER BY acpt.days_from_start, acpt.task_sequence
    `;
    return await this.db.any(query, [planId]);
  }

  /**
   * Get next sequence number for a plan
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
   * Reorder tasks after deletion
   * @param {number} planId - Plan ID
   * @returns {Promise<void>}
   */
  async reorderTasks(planId) {
    const query = `
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY days_from_start, task_sequence) as new_seq
        FROM ${this.tableName}
        WHERE plan_id = $1 AND deleted_at IS NULL
      )
      UPDATE ${this.tableName} t
      SET task_sequence = n.new_seq, updated_at = CURRENT_TIMESTAMP
      FROM numbered n
      WHERE t.id = n.id
    `;
    await this.db.none(query, [planId]);
  }

  /**
   * Find recurring tasks
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async findRecurringByPlanId(planId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE plan_id = $1 AND is_recurring = true AND deleted_at IS NULL
      ORDER BY days_from_start
    `;
    return await this.db.any(query, [planId]);
  }

  /**
   * Find tasks by type
   * @param {number} planId - Plan ID
   * @param {string} taskType - Task type
   * @returns {Promise<Array>}
   */
  async findByType(planId, taskType) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE plan_id = $1 AND task_type = $2 AND deleted_at IS NULL
      ORDER BY days_from_start, task_sequence
    `;
    return await this.db.any(query, [planId, taskType]);
  }

  /**
   * Find tasks requiring veterinarian
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async findVetRequired(planId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE plan_id = $1 AND requires_vet = true AND deleted_at IS NULL
      ORDER BY days_from_start, task_sequence
    `;
    return await this.db.any(query, [planId]);
  }
}

module.exports = new AnimalCarePlanTaskRepository();
