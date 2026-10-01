const { body, param, query } = require('express-validator');
const { enterpriseIdField } = require('./enterprise.validator');

// A product name or unit may be left out only when an inventory item supplies it
const requiredWithoutItem = (value, { req }) => Boolean(value) || Boolean(req.body.inventory_item_id);

// Taking feed or a medicine from stock: the item, and optionally one of its batches
const stockFields = (prefix = '') => [
  body(`${prefix}inventory_item_id`)
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('Invalid inventory item ID')
    .toInt(),
  body(`${prefix}inventory_batch_id`)
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('Invalid inventory batch ID')
    .toInt(),
];

// One dose given under a treatment; prefix 'doses.*.' when inside a treatment
const doseFields = (prefix = '') => [
  ...stockFields(prefix),
  body(`${prefix}product_name`)
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Product name must be at most 255 characters'),
  body(`${prefix}quantity`)
    .notEmpty()
    .withMessage('Dose quantity is required')
    .isFloat({ gt: 0 })
    .withMessage('Dose quantity must be greater than 0'),
  body(`${prefix}unit`)
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 20 })
    .withMessage('Unit must be at most 20 characters'),
  body(`${prefix}administered_date`).optional({ values: 'null' }).isDate().withMessage('Invalid administered date'),
  ...['milk', 'meat', 'egg'].map((product) =>
    body(`${prefix}${product}_withdrawal_days`)
      .optional({ values: 'null' })
      .isInt({ min: 0, max: 3650 })
      .withMessage(`${product[0].toUpperCase()}${product.slice(1)} withdrawal days must be 0 to 3650`)
      .toInt()
  ),
  body(`${prefix}notes`).optional({ values: 'null' }).trim(),
];

// The owner's reason for recording produce or a sale inside a withdrawal period
const overrideReason = body('override_reason')
  .optional({ values: 'null' })
  .trim()
  .isLength({ max: 1000 })
  .withMessage('Override reason must be at most 1000 characters');

/**
 * Validators for animal management endpoints
 */
const animalValidators = {
  // ==================== ANIMAL TYPE VALIDATORS ====================

  createAnimalType: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('category')
      .trim()
      .notEmpty()
      .withMessage('Category is required')
      .isLength({ max: 50 })
      .withMessage('Category must be at most 50 characters'),
    body('reproduction_type')
      .optional()
      .isIn(['mammal', 'bird', 'other'])
      .withMessage('Reproduction type must be mammal, bird, or other'),
    body('exclude_from_reproduction').optional().isBoolean().withMessage('Exclude from reproduction must be a boolean'),
    body('tracking_mode')
      .optional()
      .isIn(['individual', 'flock', 'both'])
      .withMessage('Tracking mode must be individual, flock, or both'),
    body('production_types').optional(),
    body('default_lifespan_days').optional().isInt({ min: 1 }).withMessage('Lifespan must be a positive integer'),
    enterpriseIdField(),
  ],

  updateAnimalType: [
    param('id').isInt().withMessage('Invalid animal type ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('category')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Category cannot be empty')
      .isLength({ max: 50 })
      .withMessage('Category must be at most 50 characters'),
    body('reproduction_type')
      .optional()
      .isIn(['mammal', 'bird', 'other'])
      .withMessage('Reproduction type must be mammal, bird, or other'),
    body('exclude_from_reproduction').optional().isBoolean().withMessage('Exclude from reproduction must be a boolean'),
    body('tracking_mode')
      .optional()
      .isIn(['individual', 'flock', 'both'])
      .withMessage('Tracking mode must be individual, flock, or both'),
    body('default_lifespan_days').optional().isInt({ min: 1 }).withMessage('Lifespan must be a positive integer'),
    enterpriseIdField(),
  ],

  // ==================== BREED VALIDATORS ====================

  createBreed: [
    body('animal_type_id')
      .notEmpty()
      .withMessage('Animal type ID is required')
      .isInt()
      .withMessage('Animal type ID must be an integer'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('description').optional().trim(),
  ],

  updateBreed: [
    param('id').isInt().withMessage('Invalid breed ID'),
    body('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('description').optional().trim(),
  ],

  // ==================== HOUSING VALIDATORS ====================

  createHousing: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    body('housing_type')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Housing type must be at most 50 characters'),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
    body('notes').optional().trim(),
  ],

  updateHousing: [
    param('id').isInt().withMessage('Invalid housing ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    body('housing_type')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Housing type must be at most 50 characters'),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
  ],

  // ==================== INDIVIDUAL ANIMAL VALIDATORS ====================

  createAnimal: [
    body('animal_breed_id')
      .notEmpty()
      .withMessage('Animal breed ID is required')
      .isInt()
      .withMessage('Animal breed ID must be an integer'),
    body('tag_number').optional().trim().isLength({ max: 50 }).withMessage('Tag number must be at most 50 characters'),
    body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    body('housing_id').optional().isInt().withMessage('Housing ID must be an integer'),
    body('gender').optional().isIn(['male', 'female']).withMessage('Gender must be male or female'),
    body('date_of_birth').optional().isISO8601().withMessage('Invalid date format'),
    body('date_acquired')
      .notEmpty()
      .withMessage('Acquisition date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('acquisition_type')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Acquisition type must be at most 50 characters'),
    body('purchase_price').optional().isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),
    body('parent_male_id').optional().isInt().withMessage('Parent male ID must be an integer'),
    body('parent_female_id').optional().isInt().withMessage('Parent female ID must be an integer'),
    body('is_breeding_stock').optional().isBoolean().withMessage('is_breeding_stock must be a boolean'),
    body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
    body('weight_unit')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Weight unit must be at most 20 characters'),
    body('notes').optional().trim(),
    enterpriseIdField(),
  ],

  updateAnimal: [
    param('id').isInt().withMessage('Invalid animal ID'),
    body('animal_breed_id').optional().isInt().withMessage('Animal breed ID must be an integer'),
    body('tag_number').optional().trim().isLength({ max: 50 }).withMessage('Tag number must be at most 50 characters'),
    body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    body('housing_id').optional().isInt().withMessage('Housing ID must be an integer'),
    body('gender').optional().isIn(['male', 'female']).withMessage('Gender must be male or female'),
    body('date_of_birth').optional().isISO8601().withMessage('Invalid date format'),
    body('is_breeding_stock').optional().isBoolean().withMessage('is_breeding_stock must be a boolean'),
    body('weight').optional().isFloat({ min: 0 }).withMessage('Weight must be a positive number'),
    body('weight_unit')
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage('Weight unit must be at most 20 characters'),
    enterpriseIdField(),
  ],

  updateAnimalStatus: [
    param('id').isInt().withMessage('Invalid animal ID'),
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['active', 'sold', 'deceased', 'culled'])
      .withMessage('Invalid status'),
    body('status_date').optional().isISO8601().withMessage('Invalid date format'),
  ],

  recordAnimalSale: [
    param('id').isInt().withMessage('Invalid animal ID'),
    body('sale_date').optional().isISO8601().withMessage('Invalid date format'),
  ],

  animalFilters: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'sold', 'deceased', 'culled']).withMessage('Invalid status'),
    query('breed_id').optional().isInt().withMessage('Breed ID must be an integer'),
    query('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    query('housing_id').optional().isInt().withMessage('Housing ID must be an integer'),
    query('gender').optional().isIn(['male', 'female']).withMessage('Gender must be male or female'),
    query('is_breeding_stock').optional().isBoolean().withMessage('is_breeding_stock must be a boolean'),
    query('search').optional().trim(),
  ],

  // ==================== ANIMAL GROUP VALIDATORS ====================

  createGroup: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('animal_breed_id')
      .notEmpty()
      .withMessage('Animal breed ID is required')
      .isInt()
      .withMessage('Animal breed ID must be an integer'),
    body('group_code').optional().trim().isLength({ max: 50 }).withMessage('Group code must be at most 50 characters'),
    body('housing_id').optional().isInt().withMessage('Housing ID must be an integer'),
    body('group_type').optional().trim().isLength({ max: 50 }).withMessage('Group type must be at most 50 characters'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('date_established')
      .notEmpty()
      .withMessage('Date established is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('acquisition_type')
      .optional()
      .isIn(['purchased', 'hatched', 'born', 'transferred', 'other'])
      .withMessage('Invalid acquisition type'),
    body('acquisition_date').optional().isISO8601().withMessage('Invalid date format'),
    body('acquisition_cost').optional().isFloat({ min: 0 }).withMessage('Acquisition cost must be a positive number'),
    body('cost_per_unit').optional().isFloat({ min: 0 }).withMessage('Cost per unit must be a positive number'),
    body('age_at_acquisition_days').optional().isInt({ min: 0 }).withMessage('Age must be a non-negative integer'),
    body('notes').optional().trim(),
    enterpriseIdField(),
  ],

  updateGroup: [
    param('id').isInt().withMessage('Invalid group ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('group_code').optional().trim().isLength({ max: 50 }).withMessage('Group code must be at most 50 characters'),
    body('housing_id').optional().isInt().withMessage('Housing ID must be an integer'),
    body('group_type').optional().trim().isLength({ max: 50 }).withMessage('Group type must be at most 50 characters'),
    enterpriseIdField(),
  ],

  recordGroupAddition: [
    param('id').isInt().withMessage('Invalid group ID'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('type').optional().isIn(['addition', 'hatched', 'born', 'transfer_in']).withMessage('Invalid addition type'),
    body('adjustment_date').optional().isISO8601().withMessage('Invalid date format'),
    body('reason').optional().trim(),
    body('unit_value').optional().isFloat({ min: 0 }).withMessage('Unit value must be a positive number'),
    body('total_value').optional().isFloat({ min: 0 }).withMessage('Total value must be a positive number'),
    body('notes').optional().trim(),
  ],

  recordGroupRemoval: [
    param('id').isInt().withMessage('Invalid group ID'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('type').optional().isIn(['removal', 'sale', 'transfer_out']).withMessage('Invalid removal type'),
    body('adjustment_date').optional().isISO8601().withMessage('Invalid date format'),
    body('reason').optional().trim(),
    body('unit_value').optional().isFloat({ min: 0 }).withMessage('Unit value must be a positive number'),
    body('total_value').optional().isFloat({ min: 0 }).withMessage('Total value must be a positive number'),
    body('notes').optional().trim(),
  ],

  groupFilters: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['active', 'closed']).withMessage('Invalid status'),
    query('breed_id').optional().isInt().withMessage('Breed ID must be an integer'),
    query('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    query('housing_id').optional().isInt().withMessage('Housing ID must be an integer'),
    query('group_type').optional().trim(),
    query('search').optional().trim(),
  ],

  // ==================== DEATH VALIDATORS ====================

  recordAnimalDeath: [
    param('animalId').isInt().withMessage('Invalid animal ID'),
    body('death_date').notEmpty().withMessage('Death date is required').isISO8601().withMessage('Invalid date format'),
    body('cause_of_death').optional().trim().isLength({ max: 255 }).withMessage('Cause must be at most 255 characters'),
    body('cause_category')
      .optional()
      .isIn(['disease', 'predator', 'accident', 'natural', 'culled', 'slaughtered', 'unknown', 'other'])
      .withMessage('Invalid cause category'),
    body('symptoms').optional().trim(),
    body('veterinary_findings').optional().trim(),
    body('was_expected').optional().isBoolean().withMessage('was_expected must be a boolean'),
    body('was_preventable').optional().isBoolean().withMessage('was_preventable must be a boolean'),
    body('estimated_loss').optional().isFloat({ min: 0 }).withMessage('Estimated loss must be a positive number'),
    body('disposal_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Disposal method must be at most 100 characters'),
    body('disposal_date').optional().isISO8601().withMessage('Invalid date format'),
    body('notes').optional().trim(),
  ],

  recordGroupDeaths: [
    param('groupId').isInt().withMessage('Invalid group ID'),
    body('death_date').notEmpty().withMessage('Death date is required').isISO8601().withMessage('Invalid date format'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('cause_of_death').optional().trim().isLength({ max: 255 }).withMessage('Cause must be at most 255 characters'),
    body('cause_category')
      .optional()
      .isIn(['disease', 'predator', 'accident', 'natural', 'culled', 'slaughtered', 'unknown', 'other'])
      .withMessage('Invalid cause category'),
    body('symptoms').optional().trim(),
    body('veterinary_findings').optional().trim(),
    body('was_expected').optional().isBoolean().withMessage('was_expected must be a boolean'),
    body('was_preventable').optional().isBoolean().withMessage('was_preventable must be a boolean'),
    body('estimated_loss').optional().isFloat({ min: 0 }).withMessage('Estimated loss must be a positive number'),
    body('disposal_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Disposal method must be at most 100 characters'),
    body('notes').optional().trim(),
  ],

  updateDeath: [
    param('id').isInt().withMessage('Invalid death record ID'),
    body('cause_of_death').optional().trim().isLength({ max: 255 }).withMessage('Cause must be at most 255 characters'),
    body('cause_category')
      .optional()
      .isIn(['disease', 'predator', 'accident', 'natural', 'culled', 'slaughtered', 'unknown', 'other'])
      .withMessage('Invalid cause category'),
    body('symptoms').optional().trim(),
    body('veterinary_findings').optional().trim(),
    body('estimated_loss').optional().isFloat({ min: 0 }).withMessage('Estimated loss must be a positive number'),
    body('disposal_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Disposal method must be at most 100 characters'),
    body('disposal_date').optional().isISO8601().withMessage('Invalid date format'),
    body('insurance_claim_filed').optional().isBoolean().withMessage('insurance_claim_filed must be a boolean'),
    body('insurance_claim_amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Insurance amount must be a positive number'),
  ],

  deathFilters: [
    query('animal_id').optional().isInt().withMessage('Animal ID must be an integer'),
    query('animal_group_id').optional().isInt().withMessage('Group ID must be an integer'),
    query('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    query('cause_category')
      .optional()
      .isIn(['disease', 'predator', 'accident', 'natural', 'culled', 'slaughtered', 'unknown', 'other'])
      .withMessage('Invalid cause category'),
    query('start_date').optional().isISO8601().withMessage('Invalid date format'),
    query('end_date').optional().isISO8601().withMessage('Invalid date format'),
  ],

  // ==================== CARE PLAN VALIDATORS ====================

  createCarePlan: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
    body('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    body('animal_breed_id').optional().isInt().withMessage('Animal breed ID must be an integer'),
    body('plan_type')
      .notEmpty()
      .withMessage('Plan type is required')
      .isIn(['vaccination', 'feeding', 'health_checkup', 'breeding', 'growth_monitoring', 'general', 'custom'])
      .withMessage('Invalid plan type'),
    body('description').optional().trim(),
    body('is_template').optional().isBoolean().withMessage('is_template must be a boolean'),
    body('total_duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('applies_to')
      .optional()
      .isIn(['individual', 'flock', 'both'])
      .withMessage('applies_to must be individual, flock, or both'),
    body('status').optional().isIn(['draft', 'active', 'archived']).withMessage('Invalid status'),
  ],

  updateCarePlan: [
    param('id').isInt().withMessage('Invalid plan ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
    body('animal_type_id').optional().isInt().withMessage('Animal type ID must be an integer'),
    body('animal_breed_id').optional().isInt().withMessage('Animal breed ID must be an integer'),
    body('plan_type')
      .optional()
      .isIn(['vaccination', 'feeding', 'health_checkup', 'breeding', 'growth_monitoring', 'general', 'custom'])
      .withMessage('Invalid plan type'),
    body('total_duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('applies_to')
      .optional()
      .isIn(['individual', 'flock', 'both'])
      .withMessage('applies_to must be individual, flock, or both'),
    body('status').optional().isIn(['draft', 'active', 'archived']).withMessage('Invalid status'),
  ],

  cloneCarePlan: [
    param('id').isInt().withMessage('Invalid plan ID'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required for cloned plan')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
  ],

  addCarePlanTask: [
    param('planId').isInt().withMessage('Invalid plan ID'),
    body('task_name')
      .trim()
      .notEmpty()
      .withMessage('Task name is required')
      .isLength({ max: 255 })
      .withMessage('Task name must be at most 255 characters'),
    body('days_from_start')
      .notEmpty()
      .withMessage('Days from start is required')
      .isInt({ min: 0 })
      .withMessage('Days must be a non-negative integer'),
    body('task_type')
      .optional()
      .isIn([
        'vaccination',
        'deworming',
        'health_check',
        'weighing',
        'feeding_change',
        'medication',
        'supplement',
        'observation',
        'breeding_check',
        'pregnancy_check',
        'other',
      ])
      .withMessage('Invalid task type'),
    body('description').optional().trim(),
    body('tolerance_days_before').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('tolerance_days_after').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('age_based').optional().isBoolean().withMessage('age_based must be a boolean'),
    body('target_age_days').optional().isInt({ min: 0 }).withMessage('Target age must be a non-negative integer'),
    body('is_recurring').optional().isBoolean().withMessage('is_recurring must be a boolean'),
    body('recurrence_interval_days')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Recurrence interval must be a positive integer'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('estimated_hours').optional().isFloat({ min: 0 }).withMessage('Estimated hours must be a positive number'),
    body('input_type')
      .optional()
      .isIn(['vaccine', 'medication', 'dewormer', 'supplement', 'feed', 'vitamin', 'mineral', 'other'])
      .withMessage('Invalid input type'),
    body('input_product_name')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Product name must be at most 255 characters'),
    body('input_quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('input_unit').optional().trim().isLength({ max: 20 }).withMessage('Unit must be at most 20 characters'),
    body('input_dosage_per_animal')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Dosage must be at most 100 characters'),
    body('input_application_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Application method must be at most 100 characters'),
    body('requires_vet').optional().isBoolean().withMessage('requires_vet must be a boolean'),
    body('vet_instructions').optional().trim(),
    body('notes').optional().trim(),
  ],

  updateCarePlanTask: [
    param('taskId').isInt().withMessage('Invalid task ID'),
    body('task_name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Task name cannot be empty')
      .isLength({ max: 255 })
      .withMessage('Task name must be at most 255 characters'),
    body('days_from_start').optional().isInt({ min: 0 }).withMessage('Days must be a non-negative integer'),
    body('task_type')
      .optional()
      .isIn([
        'vaccination',
        'deworming',
        'health_check',
        'weighing',
        'feeding_change',
        'medication',
        'supplement',
        'observation',
        'breeding_check',
        'pregnancy_check',
        'other',
      ])
      .withMessage('Invalid task type'),
    body('tolerance_days_before').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('tolerance_days_after').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('is_recurring').optional().isBoolean().withMessage('is_recurring must be a boolean'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('requires_vet').optional().isBoolean().withMessage('requires_vet must be a boolean'),
  ],

  applyCarePlanToAnimal: [
    param('animalId').isInt().withMessage('Invalid animal ID'),
    body('plan_id')
      .notEmpty()
      .withMessage('Care plan ID is required')
      .isInt()
      .withMessage('Care plan ID must be an integer'),
    body('start_date').optional().isISO8601().withMessage('Invalid date format'),
  ],

  applyCarePlanToGroup: [
    param('groupId').isInt().withMessage('Invalid group ID'),
    body('plan_id')
      .notEmpty()
      .withMessage('Care plan ID is required')
      .isInt()
      .withMessage('Care plan ID must be an integer'),
    body('start_date').optional().isISO8601().withMessage('Invalid date format'),
  ],

  completeScheduledTask: [
    param('taskId').isInt().withMessage('Invalid task ID'),
    body('notes').optional().trim(),
    body('quantity_treated').optional().isInt({ min: 1 }).withMessage('Quantity treated must be a positive integer'),
  ],

  partiallyCompleteScheduledTask: [
    param('taskId').isInt().withMessage('Invalid task ID'),
    body('quantity_treated')
      .notEmpty()
      .withMessage('Quantity treated is required')
      .isInt({ min: 1 })
      .withMessage('Quantity treated must be a positive integer'),
    body('notes').optional().trim(),
  ],

  skipScheduledTask: [
    param('taskId').isInt().withMessage('Invalid task ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required for skipping a task'),
  ],

  // ==================== COMMON VALIDATORS ====================

  idParam: [param('id').isInt().withMessage('Invalid ID')],

  animalIdParam: [param('animalId').isInt().withMessage('Invalid animal ID')],

  groupIdParam: [param('groupId').isInt().withMessage('Invalid group ID')],

  planIdParam: [param('planId').isInt().withMessage('Invalid plan ID')],

  taskIdParam: [param('taskId').isInt().withMessage('Invalid task ID')],

  scheduleIdParam: [param('scheduleId').isInt().withMessage('Invalid schedule ID')],

  // ==================== HEALTH RECORD VALIDATORS ====================

  createHealthRecord: [
    body('animal_id').optional().isInt({ min: 1 }).withMessage('Animal ID must be a positive integer'),
    body('animal_group_id').optional().isInt({ min: 1 }).withMessage('Animal group ID must be a positive integer'),
    body('record_date')
      .notEmpty()
      .withMessage('Record date is required')
      .isDate()
      .withMessage('Invalid record date format'),
    body('record_type')
      .notEmpty()
      .withMessage('Record type is required')
      .isIn(['vaccination', 'treatment', 'checkup', 'deworming'])
      .withMessage('Record type must be vaccination, treatment, checkup, or deworming'),
    body('diagnosis').optional().trim(),
    body('treatment').optional().trim(),
    body('medication')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Medication must be at most 255 characters'),
    body('veterinarian')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Veterinarian must be at most 255 characters'),
    body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
    body('next_followup_date').optional().isDate().withMessage('Invalid followup date format'),
    body('notes').optional().trim(),
  ],

  updateHealthRecord: [
    param('id').isInt().withMessage('Invalid health record ID'),
    body('record_date').optional().isDate().withMessage('Invalid record date format'),
    body('record_type')
      .optional()
      .isIn(['vaccination', 'treatment', 'checkup', 'deworming'])
      .withMessage('Record type must be vaccination, treatment, checkup, or deworming'),
    body('diagnosis').optional().trim(),
    body('treatment').optional().trim(),
    body('medication')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Medication must be at most 255 characters'),
    body('veterinarian')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Veterinarian must be at most 255 characters'),
    body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
    body('next_followup_date').optional().isDate().withMessage('Invalid followup date format'),
    body('notes').optional().trim(),
  ],

  // ==================== PRODUCTION RECORD VALIDATORS ====================

  createProductionRecord: [
    body('production_type_id')
      .notEmpty()
      .withMessage('Production type is required')
      .isInt({ min: 1 })
      .withMessage('Invalid production type ID'),
    body('animal_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Invalid animal ID'),
    body('animal_group_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Invalid animal group ID'),
    body('production_date')
      .notEmpty()
      .withMessage('Production date is required')
      .isDate()
      .withMessage('Invalid production date format'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isFloat({ min: 0 })
      .withMessage('Quantity must be a positive number'),
    body('unit_price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Unit price must be positive'),
    overrideReason,
  ],

  updateProductionRecord: [
    param('id').isInt().withMessage('Invalid production record ID'),
    body('production_type_id').optional().isInt({ min: 1 }).withMessage('Invalid production type ID'),
    body('production_date').optional().isDate().withMessage('Invalid production date format'),
    body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit_price').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('Unit price must be positive'),
    overrideReason,
  ],

  // ==================== DISEASE & TREATMENT VALIDATORS ====================

  createDiseaseTreatment: [
    body('animal_id').optional().isInt({ min: 1 }).withMessage('Animal ID must be a positive integer'),
    body('animal_group_id').optional().isInt({ min: 1 }).withMessage('Animal group ID must be a positive integer'),
    body('diagnosis_date')
      .notEmpty()
      .withMessage('Diagnosis date is required')
      .isDate()
      .withMessage('Invalid diagnosis date format'),
    body('disease_name')
      .trim()
      .notEmpty()
      .withMessage('Disease name is required')
      .isLength({ max: 255 })
      .withMessage('Disease name must be at most 255 characters'),
    body('symptoms').optional().trim(),
    body('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Severity must be low, medium, high, or critical'),
    body('diagnosis').optional().trim(),
    body('treatment_plan').optional().trim(),
    body('medications').optional().trim(),
    body('treatment_start_date').optional().isDate().withMessage('Invalid treatment start date format'),
    body('treatment_end_date').optional().isDate().withMessage('Invalid treatment end date format'),
    body('veterinarian')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Veterinarian must be at most 255 characters'),
    body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
    body('status')
      .optional()
      .isIn(['ongoing', 'completed', 'chronic'])
      .withMessage('Status must be ongoing, completed, or chronic'),
    body('outcome').optional().trim(),
    body('notes').optional().trim(),
    body('doses').optional().isArray({ max: 50 }).withMessage('Doses must be a list'),
    ...doseFields('doses.*.'),
  ],

  addTreatmentDose: [param('id').isInt().withMessage('Invalid disease/treatment record ID'), ...doseFields()],

  deleteTreatmentDose: [
    param('id').isInt().withMessage('Invalid disease/treatment record ID'),
    param('doseId').isInt().withMessage('Invalid dose ID'),
  ],

  updateDiseaseTreatment: [
    param('id').isInt().withMessage('Invalid disease/treatment record ID'),
    body('diagnosis_date').optional().isDate().withMessage('Invalid diagnosis date format'),
    body('disease_name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Disease name cannot be empty')
      .isLength({ max: 255 })
      .withMessage('Disease name must be at most 255 characters'),
    body('symptoms').optional().trim(),
    body('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Severity must be low, medium, high, or critical'),
    body('diagnosis').optional().trim(),
    body('treatment_plan').optional().trim(),
    body('medications').optional().trim(),
    body('treatment_start_date').optional().isDate().withMessage('Invalid treatment start date format'),
    body('treatment_end_date').optional().isDate().withMessage('Invalid treatment end date format'),
    body('veterinarian')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Veterinarian must be at most 255 characters'),
    body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
    body('status')
      .optional()
      .isIn(['ongoing', 'completed', 'chronic'])
      .withMessage('Status must be ongoing, completed, or chronic'),
    body('outcome').optional().trim(),
    body('notes').optional().trim(),
  ],

  // ==================== FEED RECORD VALIDATORS ====================

  createFeedRecord: [
    body('animal_id').optional().isInt({ min: 1 }).withMessage('Animal ID must be a positive integer'),
    body('animal_group_id').optional().isInt({ min: 1 }).withMessage('Animal group ID must be a positive integer'),
    body('feed_date').notEmpty().withMessage('Feed date is required').isDate().withMessage('Invalid feed date format'),
    body('feed_type').optional().trim().isLength({ max: 100 }).withMessage('Feed type must be at most 100 characters'),
    body('feed_name').optional().trim().isLength({ max: 255 }).withMessage('Feed name must be at most 255 characters'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isFloat({ min: 0 })
      .withMessage('Quantity must be a positive number'),
    body('unit')
      .trim()
      .custom(requiredWithoutItem)
      .withMessage('Unit is required unless an inventory item is chosen')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    ...stockFields(),
    body('feeding_time')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
      .withMessage('Invalid feeding time format (HH:MM or HH:MM:SS)'),
    body('cost_per_unit').optional().isFloat({ min: 0 }).withMessage('Cost per unit must be a positive number'),
    body('total_cost').optional().isFloat({ min: 0 }).withMessage('Total cost must be a positive number'),
    body('notes').optional().trim(),
  ],

  updateFeedRecord: [
    param('id').isInt().withMessage('Invalid feed record ID'),
    body('feed_date').optional().isDate().withMessage('Invalid feed date format'),
    body('feed_type').optional().trim().isLength({ max: 100 }).withMessage('Feed type must be at most 100 characters'),
    body('feed_name').optional().trim().isLength({ max: 255 }).withMessage('Feed name must be at most 255 characters'),
    body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Unit cannot be empty')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    body('feeding_time')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
      .withMessage('Invalid feeding time format (HH:MM or HH:MM:SS)'),
    body('cost_per_unit').optional().isFloat({ min: 0 }).withMessage('Cost per unit must be a positive number'),
    body('total_cost').optional().isFloat({ min: 0 }).withMessage('Total cost must be a positive number'),
    body('notes').optional().trim(),
    body('inventory_batch_id')
      .optional({ values: 'null' })
      .isInt({ min: 1 })
      .withMessage('Invalid inventory batch ID')
      .toInt(),
  ],

  // ==================== BREEDING RECORD VALIDATORS ====================

  createBreedingRecord: [
    body('male_animal_id')
      .notEmpty()
      .withMessage('Male animal ID is required')
      .isInt({ min: 1 })
      .withMessage('Male animal ID must be a positive integer'),
    body('female_animal_id')
      .notEmpty()
      .withMessage('Female animal ID is required')
      .isInt({ min: 1 })
      .withMessage('Female animal ID must be a positive integer'),
    body('breeding_date')
      .notEmpty()
      .withMessage('Breeding date is required')
      .isISO8601()
      .withMessage('Invalid breeding date format'),
    body('expected_delivery_date').optional().isISO8601().withMessage('Invalid expected delivery date format'),
    body('actual_delivery_date').optional().isISO8601().withMessage('Invalid actual delivery date format'),
    body('offspring_count').optional().isInt({ min: 0 }).withMessage('Offspring count must be a non-negative integer'),
    body('target_group_id').optional().isInt({ min: 1 }).withMessage('Target group ID must be a positive integer'),
    body('notes').optional().trim(),
  ],

  updateBreedingRecord: [
    param('id').isInt().withMessage('Invalid breeding record ID'),
    body('breeding_date').optional().isISO8601().withMessage('Invalid breeding date format'),
    body('expected_delivery_date').optional().isISO8601().withMessage('Invalid expected delivery date format'),
    body('actual_delivery_date').optional().isISO8601().withMessage('Invalid actual delivery date format'),
    body('offspring_count').optional().isInt({ min: 0 }).withMessage('Offspring count must be a non-negative integer'),
    body('target_group_id').optional().isInt({ min: 1 }).withMessage('Target group ID must be a positive integer'),
    body('notes').optional().trim(),
  ],

  // ==================== LIVESTOCK SALES VALIDATORS ====================

  createAnimalSale: [
    body('sale_date').notEmpty().withMessage('Sale date is required').isDate().withMessage('Invalid sale date format'),
    body('reference_type')
      .notEmpty()
      .withMessage('Reference type is required')
      .isIn(['animal', 'animal_group'])
      .withMessage('Reference type must be animal or animal_group'),
    body('reference_id')
      .notEmpty()
      .withMessage('Reference ID is required')
      .isInt({ min: 1 })
      .withMessage('Reference ID must be a positive integer'),
    body('enterprise_id').optional().isInt({ min: 1 }).withMessage('Enterprise ID must be a positive integer'),
    body('customer_name')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Customer name must be at most 255 characters'),
    body('product_type')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Product type must be at most 50 characters'),
    body('product_description').optional().trim(),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isFloat({ min: 0 })
      .withMessage('Quantity must be a positive number'),
    body('unit')
      .trim()
      .notEmpty()
      .withMessage('Unit is required')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    body('unit_price')
      .notEmpty()
      .withMessage('Unit price is required')
      .isFloat({ min: 0 })
      .withMessage('Unit price must be a positive number'),
    body('total_amount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
    body('payment_method')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Payment method must be at most 50 characters'),
    body('payment_status')
      .optional()
      .isIn(['paid', 'pending', 'partial'])
      .withMessage('Payment status must be paid, pending, or partial'),
    body('notes').optional().trim(),
    overrideReason,
  ],

  updateAnimalSale: [
    param('id').isInt().withMessage('Invalid sale ID'),
    body('sale_date').optional().isDate().withMessage('Invalid sale date format'),
    body('customer_name')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Customer name must be at most 255 characters'),
    body('product_type')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Product type must be at most 50 characters'),
    body('product_description').optional().trim(),
    body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Unit cannot be empty')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    body('unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
    body('total_amount').optional().isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
    body('payment_method')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Payment method must be at most 50 characters'),
    body('payment_status')
      .optional()
      .isIn(['paid', 'pending', 'partial'])
      .withMessage('Payment status must be paid, pending, or partial'),
    body('notes').optional().trim(),
    overrideReason,
  ],

  // Incubation record validators
  createIncubationRecord: [
    body('batch_code')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Batch code must be 1-50 characters'),
    body('animal_group_id').optional().isInt({ min: 1 }).withMessage('Animal group ID must be a positive integer'),
    body('animal_breed_id')
      .notEmpty()
      .withMessage('Animal breed ID is required')
      .isInt({ min: 1 })
      .withMessage('Animal breed ID must be a positive integer'),
    body('eggs_count')
      .notEmpty()
      .withMessage('Eggs count is required')
      .isInt({ min: 1 })
      .withMessage('Eggs count must be at least 1'),
    body('incubation_start_date')
      .notEmpty()
      .withMessage('Incubation start date is required')
      .isISO8601()
      .withMessage('Incubation start date must be a valid date'),
    body('expected_hatch_date')
      .notEmpty()
      .withMessage('Expected hatch date is required')
      .isISO8601()
      .withMessage('Expected hatch date must be a valid date'),
    body('target_group_id').optional().isInt({ min: 1 }).withMessage('Target group ID must be a positive integer'),
    body('incubator_id').optional().trim(),
    body('temperature').optional().isFloat({ min: 0, max: 100 }).withMessage('Temperature must be between 0 and 100'),
    body('humidity').optional().isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0 and 100'),
    body('notes').optional().trim(),
    body('egg_source').optional().isIn(['internal', 'external']).withMessage('Egg source must be internal or external'),
    body('supplier_name')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Supplier name must be at most 200 characters'),
    body('supplier_contact')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Supplier contact must be at most 100 characters'),
    body('purchase_cost').optional().isFloat({ min: 0 }).withMessage('Purchase cost must be a positive number'),
  ],

  updateIncubationRecord: [
    body('actual_hatch_date').optional().isISO8601().withMessage('Actual hatch date must be a valid date'),
    body('hatched_count').optional().isInt({ min: 0 }).withMessage('Hatched count must be a non-negative integer'),
    body('unhatched_count').optional().isInt({ min: 0 }).withMessage('Unhatched count must be a non-negative integer'),
    body('target_group_id').optional().isInt({ min: 1 }).withMessage('Target group ID must be a positive integer'),
    body('status')
      .optional()
      .isIn(['incubating', 'hatched', 'failed', 'partial'])
      .withMessage('Status must be incubating, hatched, failed, or partial'),
    body('temperature').optional().isFloat({ min: 0, max: 100 }).withMessage('Temperature must be between 0 and 100'),
    body('humidity').optional().isFloat({ min: 0, max: 100 }).withMessage('Humidity must be between 0 and 100'),
    body('notes').optional().trim(),
  ],
};

module.exports = animalValidators;
