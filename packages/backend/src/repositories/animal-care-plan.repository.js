const BaseRepository = require('./base.repository');
const { NotFoundError } = require('../utils/errors');

/**
 * Repository for animal_care_plans table operations
 */
class AnimalCarePlanRepository extends BaseRepository {
  constructor() {
    super('animal_care_plans');
  }

  /**
   * Generate unique plan code
   * @param {string} prefix - Plan prefix
   * @returns {Promise<string>}
   */
  async generatePlanCode(prefix = 'ACP') {
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
      SELECT acp.*,
             at.name as animal_type_name,
             at.category as animal_type_category,
             ab.name as breed_name,
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM animal_care_plan_tasks WHERE plan_id = acp.id AND deleted_at IS NULL) as task_count
      FROM ${this.tableName} acp
      LEFT JOIN animal_types at ON acp.animal_type_id = at.id
      LEFT JOIN animal_breeds ab ON acp.animal_breed_id = ab.id
      LEFT JOIN users u ON acp.created_by = u.id
      WHERE acp.is_template = true
        AND acp.deleted_at IS NULL
      ORDER BY acp.name
    `;
    return await this.db.any(query);
  }

  /**
   * Find plans by animal type
   * @param {number} animalTypeId - Animal type ID
   * @returns {Promise<Array>}
   */
  async findByAnimalTypeId(animalTypeId) {
    const query = `
      SELECT acp.*,
             at.name as animal_type_name,
             ab.name as breed_name,
             (SELECT COUNT(*) FROM animal_care_plan_tasks WHERE plan_id = acp.id AND deleted_at IS NULL) as task_count
      FROM ${this.tableName} acp
      LEFT JOIN animal_types at ON acp.animal_type_id = at.id
      LEFT JOIN animal_breeds ab ON acp.animal_breed_id = ab.id
      WHERE acp.animal_type_id = $1
        AND acp.deleted_at IS NULL
        AND acp.status = 'active'
      ORDER BY acp.name
    `;
    return await this.db.any(query, [animalTypeId]);
  }

  /**
   * Find plans by breed
   * @param {number} breedId - Breed ID
   * @returns {Promise<Array>}
   */
  async findByBreedId(breedId) {
    const query = `
      SELECT acp.*,
             at.name as animal_type_name,
             ab.name as breed_name,
             (SELECT COUNT(*) FROM animal_care_plan_tasks WHERE plan_id = acp.id AND deleted_at IS NULL) as task_count
      FROM ${this.tableName} acp
      LEFT JOIN animal_types at ON acp.animal_type_id = at.id
      LEFT JOIN animal_breeds ab ON acp.animal_breed_id = ab.id
      WHERE acp.animal_breed_id = $1
        AND acp.deleted_at IS NULL
        AND acp.status = 'active'
      ORDER BY acp.name
    `;
    return await this.db.any(query, [breedId]);
  }

  /**
   * Find plans by type (vaccination, feeding, etc.)
   * @param {string} planType - Plan type
   * @returns {Promise<Array>}
   */
  async findByPlanType(planType) {
    const query = `
      SELECT acp.*,
             at.name as animal_type_name,
             ab.name as breed_name,
             (SELECT COUNT(*) FROM animal_care_plan_tasks WHERE plan_id = acp.id AND deleted_at IS NULL) as task_count
      FROM ${this.tableName} acp
      LEFT JOIN animal_types at ON acp.animal_type_id = at.id
      LEFT JOIN animal_breeds ab ON acp.animal_breed_id = ab.id
      WHERE acp.plan_type = $1
        AND acp.deleted_at IS NULL
        AND acp.status = 'active'
      ORDER BY acp.name
    `;
    return await this.db.any(query, [planType]);
  }

  /**
   * Find plan with all tasks
   * @param {number} id - Plan ID
   * @returns {Promise<Object|null>}
   */
  async findWithTasks(id) {
    const planQuery = `
      SELECT acp.*,
             at.name as animal_type_name,
             at.category as animal_type_category,
             at.tracking_mode,
             ab.name as breed_name,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM ${this.tableName} acp
      LEFT JOIN animal_types at ON acp.animal_type_id = at.id
      LEFT JOIN animal_breeds ab ON acp.animal_breed_id = ab.id
      LEFT JOIN users u ON acp.created_by = u.id
      WHERE acp.id = $1 AND acp.deleted_at IS NULL
    `;

    const tasksQuery = `
      SELECT acpt.*,
             tc.name as category_name
      FROM animal_care_plan_tasks acpt
      LEFT JOIN task_categories tc ON acpt.task_category_id = tc.id
      WHERE acpt.plan_id = $1 AND acpt.deleted_at IS NULL
      ORDER BY acpt.days_from_start, acpt.task_sequence
    `;

    const [plan, tasks] = await Promise.all([
      this.db.oneOrNone(planQuery, [id]),
      this.db.any(tasksQuery, [id])
    ]);

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
    const original = await this.findWithTasks(planId);
    if (!original) {
      throw new NotFoundError('Plan not found');
    }

    const planCode = await this.generatePlanCode('ACP');

    const newPlan = await this.create({
      plan_code: planCode,
      animal_type_id: original.animal_type_id,
      animal_breed_id: original.animal_breed_id,
      name: newName,
      description: original.description,
      plan_type: original.plan_type,
      is_template: true,
      total_duration_days: original.total_duration_days,
      applies_to: original.applies_to,
      status: 'draft',
      created_by: userId
    });

    // Clone tasks
    for (const task of original.tasks) {
      await this.db.none(`
        INSERT INTO animal_care_plan_tasks (
          plan_id, task_sequence, task_name, description, task_category_id, task_type,
          days_from_start, tolerance_days_before, tolerance_days_after,
          age_based, target_age_days,
          is_recurring, recurrence_interval_days, recurrence_end_days, recurrence_start_days,
          priority, estimated_hours, input_type, input_product_name,
          input_quantity, input_unit, input_dosage_per_animal, input_application_method,
          requires_vet, vet_instructions, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
        )
      `, [
        newPlan.id, task.task_sequence, task.task_name, task.description, task.task_category_id, task.task_type,
        task.days_from_start, task.tolerance_days_before, task.tolerance_days_after,
        task.age_based, task.target_age_days,
        task.is_recurring, task.recurrence_interval_days, task.recurrence_end_days, task.recurrence_start_days,
        task.priority, task.estimated_hours, task.input_type, task.input_product_name,
        task.input_quantity, task.input_unit, task.input_dosage_per_animal, task.input_application_method,
        task.requires_vet, task.vet_instructions, task.notes
      ]);
    }

    return await this.findWithTasks(newPlan.id);
  }

  /**
   * Get plans with usage statistics
   * @returns {Promise<Array>}
   */
  async findAllWithStats() {
    const query = `
      SELECT acp.*,
             at.name as animal_type_name,
             ab.name as breed_name,
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM animal_care_plan_tasks WHERE plan_id = acp.id AND deleted_at IS NULL) as task_count,
             (SELECT COUNT(*) FROM animal_care_schedules WHERE plan_id = acp.id AND deleted_at IS NULL) as usage_count
      FROM ${this.tableName} acp
      LEFT JOIN animal_types at ON acp.animal_type_id = at.id
      LEFT JOIN animal_breeds ab ON acp.animal_breed_id = ab.id
      LEFT JOIN users u ON acp.created_by = u.id
      WHERE acp.deleted_at IS NULL
      ORDER BY acp.is_template DESC, acp.name
    `;
    return await this.db.any(query);
  }
}

module.exports = new AnimalCarePlanRepository();
