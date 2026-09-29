const BaseRepository = require('./base.repository');
const { NotFoundError } = require('../utils/errors');

/**
 * Repository for crop_care_plans table operations
 */
class CarePlanRepository extends BaseRepository {
  constructor() {
    super('crop_care_plans');
  }

  /**
   * Generate unique plan code
   * @param {string} prefix - Plan prefix (e.g., 'TOM' for Tomato)
   * @returns {Promise<string>}
   */
  async generatePlanCode(prefix = 'CP') {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const codePrefix = `${prefix.toUpperCase().slice(0, 3)}-${year}`;

    const query = `
      SELECT plan_code FROM ${this.tableName}
      WHERE plan_code LIKE $1
      ORDER BY plan_code DESC
      LIMIT 1
    `;

    const result = await this.db.oneOrNone(query, [`${codePrefix}%`]);

    if (result) {
      const lastNumber = parseInt(result.plan_code.split('-').pop(), 10);
      return `${codePrefix}-${(lastNumber + 1).toString().padStart(3, '0')}`;
    }

    return `${codePrefix}-001`;
  }

  /**
   * Find all template plans
   * @returns {Promise<Array>}
   */
  async findAllTemplates() {
    const query = `
      SELECT cp.*,
             cv.name as variety_name,
             ct.name as crop_type_name,
             ct.category as crop_type_category,
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM crop_care_plan_tasks WHERE plan_id = cp.id AND deleted_at IS NULL) as task_count
      FROM ${this.tableName} cp
      LEFT JOIN crop_varieties cv ON cp.crop_variety_id = cv.id
      LEFT JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN users u ON cp.created_by = u.id
      WHERE cp.is_template = true
        AND cp.deleted_at IS NULL
      ORDER BY cp.name
    `;
    return await this.db.any(query);
  }

  /**
   * Find plans by variety
   * @param {number} varietyId - Crop variety ID
   * @returns {Promise<Array>}
   */
  async findByVarietyId(varietyId) {
    const query = `
      SELECT cp.*,
             cv.name as variety_name,
             (SELECT COUNT(*) FROM crop_care_plan_tasks WHERE plan_id = cp.id AND deleted_at IS NULL) as task_count
      FROM ${this.tableName} cp
      LEFT JOIN crop_varieties cv ON cp.crop_variety_id = cv.id
      WHERE cp.crop_variety_id = $1
        AND cp.deleted_at IS NULL
        AND cp.status = 'active'
      ORDER BY cp.name
    `;
    return await this.db.any(query, [varietyId]);
  }

  /**
   * Find plan with all tasks
   * @param {number} id - Plan ID
   * @returns {Promise<Object|null>}
   */
  async findWithTasks(id) {
    const planQuery = `
      SELECT cp.*,
             cv.name as variety_name,
             cv.growth_days as variety_growth_days,
             ct.id as crop_type_id,
             ct.name as crop_type_name,
             ct.category as crop_type_category,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM ${this.tableName} cp
      LEFT JOIN crop_varieties cv ON cp.crop_variety_id = cv.id
      LEFT JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN users u ON cp.created_by = u.id
      WHERE cp.id = $1 AND cp.deleted_at IS NULL
    `;

    const tasksQuery = `
      SELECT cpt.*,
             tc.name as category_name
      FROM crop_care_plan_tasks cpt
      LEFT JOIN task_categories tc ON cpt.task_category_id = tc.id
      WHERE cpt.plan_id = $1 AND cpt.deleted_at IS NULL
      ORDER BY cpt.days_from_planting, cpt.task_sequence
    `;

    const [plan, tasks] = await Promise.all([this.db.oneOrNone(planQuery, [id]), this.db.any(tasksQuery, [id])]);

    if (plan) {
      plan.tasks = tasks;
    }

    return plan;
  }

  /**
   * Clone a plan as a new template
   * @param {number} planId - Source plan ID
   * @param {string} newName - Name for the cloned plan
   * @param {number} userId - User creating the clone
   * @returns {Promise<Object>}
   */
  async clonePlan(planId, newName, userId) {
    // Get original plan
    const original = await this.findWithTasks(planId);
    if (!original) {
      throw new NotFoundError('Plan not found');
    }

    // Generate new plan code
    const planCode = await this.generatePlanCode('CP');

    // Create new plan
    const newPlan = await this.create({
      plan_code: planCode,
      crop_variety_id: original.crop_variety_id,
      name: newName,
      description: original.description,
      is_template: true,
      total_duration_days: original.total_duration_days,
      status: 'draft',
      created_by: userId,
    });

    // Clone tasks
    for (const task of original.tasks) {
      await this.db.none(
        `
        INSERT INTO crop_care_plan_tasks (
          plan_id, task_sequence, task_name, description, task_category_id,
          days_from_planting, tolerance_days_before, tolerance_days_after,
          is_recurring, recurrence_interval_days, recurrence_end_days, recurrence_start_days,
          priority, estimated_hours, input_type, input_product_name,
          input_quantity, input_unit, input_application_method, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
      `,
        [
          newPlan.id,
          task.task_sequence,
          task.task_name,
          task.description,
          task.task_category_id,
          task.days_from_planting,
          task.tolerance_days_before,
          task.tolerance_days_after,
          task.is_recurring,
          task.recurrence_interval_days,
          task.recurrence_end_days,
          task.recurrence_start_days,
          task.priority,
          task.estimated_hours,
          task.input_type,
          task.input_product_name,
          task.input_quantity,
          task.input_unit,
          task.input_application_method,
          task.notes,
        ]
      );
    }

    return await this.findWithTasks(newPlan.id);
  }

  /**
   * Get plans with usage statistics
   * @returns {Promise<Array>}
   */
  async findAllWithStats() {
    const query = `
      SELECT cp.*,
             cv.name as variety_name,
             ct.name as crop_type_name,
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM crop_care_plan_tasks WHERE plan_id = cp.id AND deleted_at IS NULL) as task_count,
             (SELECT COUNT(*) FROM batch_care_schedules WHERE plan_id = cp.id AND deleted_at IS NULL) as usage_count
      FROM ${this.tableName} cp
      LEFT JOIN crop_varieties cv ON cp.crop_variety_id = cv.id
      LEFT JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN users u ON cp.created_by = u.id
      WHERE cp.deleted_at IS NULL
      ORDER BY cp.is_template DESC, cp.name
    `;
    return await this.db.any(query);
  }
}

module.exports = new CarePlanRepository();
