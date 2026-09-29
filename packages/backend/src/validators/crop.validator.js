const { body, param, query } = require('express-validator');

// An input application names its product and unit, or takes them from an inventory item
const requiredWithoutItem = (value, { req }) => Boolean(value) || Boolean(req.body.inventory_item_id);

// Taking an input application from stock, and its pre-harvest interval
const stockFields = [
  body('inventory_item_id')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('Invalid inventory item ID')
    .toInt(),
  body('inventory_batch_id')
    .optional({ values: 'null' })
    .isInt({ min: 1 })
    .withMessage('Invalid inventory batch ID')
    .toInt(),
  body('pre_harvest_interval_days')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 3650 })
    .withMessage('Pre-harvest interval must be between 0 and 3650 days')
    .toInt(),
];

/**
 * Validators for crop management endpoints
 */
const cropValidators = {
  // Crop Type validators
  createCropType: [
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
    body('typical_growth_days').optional().isInt({ min: 1 }).withMessage('Growth days must be a positive integer'),
    body('description').optional().trim(),
  ],

  updateCropType: [
    param('id').isInt().withMessage('Invalid crop type ID'),
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
    body('typical_growth_days').optional().isInt({ min: 1 }).withMessage('Growth days must be a positive integer'),
  ],

  // Variety validators
  createVariety: [
    body('crop_type_id')
      .notEmpty()
      .withMessage('Crop type ID is required')
      .isInt()
      .withMessage('Crop type ID must be an integer'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('growth_days').optional().isInt({ min: 1 }).withMessage('Growth days must be a positive integer'),
    body('notes').optional().trim(),
  ],

  updateVariety: [
    param('id').isInt().withMessage('Invalid variety ID'),
    body('crop_type_id').optional().isInt().withMessage('Crop type ID must be an integer'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('growth_days').optional().isInt({ min: 1 }).withMessage('Growth days must be a positive integer'),
  ],

  // Location validators
  createLocation: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('type')
      .trim()
      .notEmpty()
      .withMessage('Type is required')
      .isLength({ max: 50 })
      .withMessage('Type must be at most 50 characters'),
    body('size_sqm').optional().isFloat({ min: 0 }).withMessage('Size must be a positive number'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
    body('notes').optional().trim(),
  ],

  updateLocation: [
    param('id').isInt().withMessage('Invalid location ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    body('type')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Type cannot be empty')
      .isLength({ max: 50 })
      .withMessage('Type must be at most 50 characters'),
    body('size_sqm').optional().isFloat({ min: 0 }).withMessage('Size must be a positive number'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
  ],

  // Batch validators
  createBatch: [
    body('crop_variety_id')
      .notEmpty()
      .withMessage('Crop variety ID is required')
      .isInt()
      .withMessage('Crop variety ID must be an integer'),
    body('location_id').optional().isInt().withMessage('Location ID must be an integer'),
    body('planting_date')
      .notEmpty()
      .withMessage('Planting date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('quantity_planted')
      .notEmpty()
      .withMessage('Quantity planted is required')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('unit')
      .trim()
      .notEmpty()
      .withMessage('Unit is required')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    body('status').optional().isIn(['planted', 'growing', 'harvesting', 'completed']).withMessage('Invalid status'),
    body('notes').optional().trim(),
  ],

  updateBatch: [
    param('id').isInt().withMessage('Invalid batch ID'),
    body('crop_variety_id').optional().isInt().withMessage('Crop variety ID must be an integer'),
    body('location_id').optional().isInt().withMessage('Location ID must be an integer'),
    body('planting_date').optional().isISO8601().withMessage('Invalid date format'),
    body('expected_harvest_date').optional().isISO8601().withMessage('Invalid date format'),
    body('quantity_planted').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('status').optional().isIn(['planted', 'growing', 'harvesting', 'completed']).withMessage('Invalid status'),
  ],

  updateBatchStatus: [
    param('id').isInt().withMessage('Invalid batch ID'),
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['planted', 'growing', 'harvesting', 'completed'])
      .withMessage('Invalid status'),
  ],

  // Observation validators
  addObservation: [
    param('batchId').isInt().withMessage('Invalid batch ID'),
    body('observation_date')
      .notEmpty()
      .withMessage('Observation date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('growth_stage')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Growth stage must be at most 100 characters'),
    body('health_status')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Health status must be at most 50 characters'),
    body('notes').optional().trim(),
  ],

  // Harvest validators
  recordHarvest: [
    param('batchId').isInt().withMessage('Invalid batch ID'),
    body('harvest_date')
      .notEmpty()
      .withMessage('Harvest date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isFloat({ min: 0.01 })
      .withMessage('Quantity must be a positive number'),
    body('unit')
      .trim()
      .notEmpty()
      .withMessage('Unit is required')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    body('grade').optional().trim().isLength({ max: 50 }).withMessage('Grade must be at most 50 characters'),
    body('notes').optional().trim(),
    body('override_reason')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Override reason must be at most 1000 characters'),
  ],

  // Input application validators
  recordInputApplication: [
    param('batchId').isInt().withMessage('Invalid batch ID'),
    body('application_date')
      .notEmpty()
      .withMessage('Application date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('input_type')
      .notEmpty()
      .withMessage('Input type is required')
      .isIn(['fertilizer', 'pesticide', 'herbicide', 'fungicide'])
      .withMessage('Invalid input type'),
    body('product_name')
      .trim()
      .custom(requiredWithoutItem)
      .withMessage('Product name is required unless an inventory item is chosen')
      .isLength({ max: 255 })
      .withMessage('Product name must be at most 255 characters'),
    body('quantity')
      .notEmpty()
      .withMessage('Quantity is required')
      .isFloat({ min: 0.01 })
      .withMessage('Quantity must be a positive number'),
    body('unit')
      .trim()
      .custom(requiredWithoutItem)
      .withMessage('Unit is required unless an inventory item is chosen')
      .isLength({ max: 20 })
      .withMessage('Unit must be at most 20 characters'),
    ...stockFields,
    body('application_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Application method must be at most 100 characters'),
    body('target_pest_disease')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Target must be at most 255 characters'),
    body('notes').optional().trim(),
  ],

  // Pest/Disease validators
  reportPestDisease: [
    param('batchId').isInt().withMessage('Invalid batch ID'),
    body('incident_date')
      .notEmpty()
      .withMessage('Incident date is required')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('type')
      .notEmpty()
      .withMessage('Type is required')
      .isIn(['pest', 'disease'])
      .withMessage('Type must be pest or disease'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
    body('affected_area')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Affected area must be at most 100 characters'),
    body('symptoms').optional().trim(),
    body('control_measures').optional().trim(),
    body('status').optional().isIn(['active', 'controlled', 'resolved']).withMessage('Invalid status'),
    body('notes').optional().trim(),
  ],

  updatePestDiseaseStatus: [
    param('id').isInt().withMessage('Invalid record ID'),
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(['active', 'controlled', 'resolved'])
      .withMessage('Invalid status'),
    body('control_measures').optional().trim(),
  ],

  // Common validators
  idParam: [param('id').isInt().withMessage('Invalid ID')],

  batchIdParam: [param('batchId').isInt().withMessage('Invalid batch ID')],

  // Query validators for filters
  batchFilters: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .custom((value) => {
        // Allow single status or comma-separated statuses
        const validStatuses = ['planted', 'growing', 'harvesting', 'completed'];
        const statuses = value.split(',').map((s) => s.trim());
        const allValid = statuses.every((status) => validStatuses.includes(status));
        if (!allValid) {
          throw new Error('Invalid status value(s)');
        }
        return true;
      }),
    query('location_id').optional().isInt().withMessage('Location ID must be an integer'),
    query('crop_type_id').optional().isInt().withMessage('Crop type ID must be an integer'),
    query('variety_id').optional().isInt().withMessage('Variety ID must be an integer'),
    query('planting_date_from').optional().isISO8601().withMessage('Invalid date format'),
    query('planting_date_to').optional().isISO8601().withMessage('Invalid date format'),
    query('search').optional().trim(),
  ],

  harvestFilters: [
    query('crop_type_id').optional().isInt().withMessage('Crop type ID must be an integer'),
    query('location_id').optional().isInt().withMessage('Location ID must be an integer'),
    query('harvest_date_from').optional().isISO8601().withMessage('Invalid date format'),
    query('harvest_date_to').optional().isISO8601().withMessage('Invalid date format'),
    query('grade').optional().trim(),
    query('start_date').optional().isISO8601().withMessage('Invalid date format'),
    query('end_date').optional().isISO8601().withMessage('Invalid date format'),
  ],

  pestDiseaseFilters: [
    query('batch_id').optional().isInt().withMessage('Batch ID must be an integer'),
    query('type').optional().isIn(['pest', 'disease']).withMessage('Type must be pest or disease'),
    query('status').optional().isIn(['active', 'controlled', 'resolved']).withMessage('Invalid status'),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
    query('crop_type_id').optional().isInt().withMessage('Crop type ID must be an integer'),
    query('location_id').optional().isInt().withMessage('Location ID must be an integer'),
    query('incident_date_from').optional().isISO8601().withMessage('Invalid date format'),
    query('incident_date_to').optional().isISO8601().withMessage('Invalid date format'),
  ],

  // ==================== CARE PLAN VALIDATORS ====================

  createCarePlan: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
    body('crop_variety_id').optional().isInt().withMessage('Crop variety ID must be an integer'),
    body('description').optional().trim(),
    body('is_template').optional().isBoolean().withMessage('is_template must be a boolean'),
    body('total_duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
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
    body('crop_variety_id').optional().isInt().withMessage('Crop variety ID must be an integer'),
    body('description').optional().trim(),
    body('is_template').optional().isBoolean().withMessage('is_template must be a boolean'),
    body('total_duration_days').optional().isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
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

  planIdParam: [param('planId').isInt().withMessage('Invalid plan ID')],

  taskIdParam: [param('taskId').isInt().withMessage('Invalid task ID')],

  addCarePlanTask: [
    param('planId').isInt().withMessage('Invalid plan ID'),
    body('task_name')
      .trim()
      .notEmpty()
      .withMessage('Task name is required')
      .isLength({ max: 255 })
      .withMessage('Task name must be at most 255 characters'),
    body('days_from_planting')
      .notEmpty()
      .withMessage('Days from planting is required')
      .isInt({ min: 0 })
      .withMessage('Days must be a non-negative integer'),
    body('description').optional().trim(),
    body('task_category_id').optional().isInt().withMessage('Task category ID must be an integer'),
    body('tolerance_days_before').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('tolerance_days_after').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('is_recurring').optional().isBoolean().withMessage('is_recurring must be a boolean'),
    body('recurrence_interval_days')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Recurrence interval must be a positive integer'),
    body('recurrence_end_days').optional().isInt({ min: 1 }).withMessage('Recurrence end must be a positive integer'),
    body('recurrence_start_days')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Recurrence start must be a non-negative integer'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('estimated_hours').optional().isFloat({ min: 0 }).withMessage('Estimated hours must be a positive number'),
    body('input_type')
      .optional()
      .isIn(['fertilizer', 'pesticide', 'herbicide', 'fungicide', 'water', 'other'])
      .withMessage('Invalid input type'),
    body('input_product_name')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Product name must be at most 255 characters'),
    body('input_quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('input_unit').optional().trim().isLength({ max: 20 }).withMessage('Unit must be at most 20 characters'),
    body('input_application_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Application method must be at most 100 characters'),
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
    body('days_from_planting').optional().isInt({ min: 0 }).withMessage('Days must be a non-negative integer'),
    body('description').optional().trim(),
    body('tolerance_days_before').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('tolerance_days_after').optional().isInt({ min: 0 }).withMessage('Tolerance must be a non-negative integer'),
    body('is_recurring').optional().isBoolean().withMessage('is_recurring must be a boolean'),
    body('recurrence_interval_days')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Recurrence interval must be a positive integer'),
    body('recurrence_end_days').optional().isInt({ min: 1 }).withMessage('Recurrence end must be a positive integer'),
    body('recurrence_start_days')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Recurrence start must be a non-negative integer'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('estimated_hours').optional().isFloat({ min: 0 }).withMessage('Estimated hours must be a positive number'),
    body('input_type')
      .optional()
      .isIn(['fertilizer', 'pesticide', 'herbicide', 'fungicide', 'water', 'other'])
      .withMessage('Invalid input type'),
  ],

  applyCarePlan: [
    param('batchId').isInt().withMessage('Invalid batch ID'),
    body('plan_id')
      .notEmpty()
      .withMessage('Care plan ID is required')
      .isInt()
      .withMessage('Care plan ID must be an integer'),
  ],

  completeScheduledTask: [param('taskId').isInt().withMessage('Invalid task ID'), body('notes').optional().trim()],

  skipScheduledTask: [
    param('taskId').isInt().withMessage('Invalid task ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required for skipping a task'),
  ],

  completeScheduledTaskWithInput: [
    param('taskId').isInt().withMessage('Invalid task ID'),
    body('application_date').optional().isISO8601().withMessage('Invalid date format'),
    body('input_type')
      .optional()
      .isIn(['fertilizer', 'pesticide', 'herbicide', 'fungicide', 'water', 'other'])
      .withMessage('Invalid input type'),
    body('product_name')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Product name must be at most 255 characters'),
    body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit').optional().trim().isLength({ max: 20 }).withMessage('Unit must be at most 20 characters'),
    body('application_method')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Application method must be at most 100 characters'),
    body('target_pest_disease')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Target must be at most 255 characters'),
    body('notes').optional().trim(),
    ...stockFields,
  ],
};

module.exports = cropValidators;
