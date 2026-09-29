const { body, param, query } = require('express-validator');
const { INVENTORY_TRANSACTION_TYPES } = require('../config/constants');

const TRANSACTION_TYPES = Object.values(INVENTORY_TRANSACTION_TYPES);

/**
 * Validators for inventory management endpoints
 */
const inventoryValidators = {
  // ==================== CATEGORY VALIDATORS ====================

  createCategory: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    body('description')
      .optional({ values: 'null' })
      .trim(),
  ],

  updateCategory: [
    param('id').isInt().withMessage('Invalid category ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Name cannot be empty')
      .isLength({ max: 100 }).withMessage('Name must be at most 100 characters'),
    body('description')
      .optional({ values: 'null' })
      .trim(),
  ],

  // ==================== ITEM VALIDATORS ====================

  createItem: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 200 }).withMessage('Name must be at most 200 characters'),
    body('category_id')
      .notEmpty().withMessage('Category ID is required')
      .isInt().withMessage('Category ID must be an integer'),
    body('unit')
      .trim()
      .notEmpty().withMessage('Unit is required')
      .isLength({ max: 50 }).withMessage('Unit must be at most 50 characters'),
    body('current_stock')
      .optional()
      .isFloat({ min: 0 }).withMessage('Current stock must be a non-negative number'),
    body('minimum_stock')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Minimum stock must be a non-negative number'),
    body('cost_per_unit')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Cost per unit must be a non-negative number'),
    body('supplier')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 200 }).withMessage('Supplier must be at most 200 characters'),
    body('location')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 200 }).withMessage('Location must be at most 200 characters'),
    body('expiry_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid date format'),
    body('notes')
      .optional({ values: 'null' })
      .trim(),
  ],

  updateItem: [
    param('id').isInt().withMessage('Invalid item ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Name cannot be empty')
      .isLength({ max: 200 }).withMessage('Name must be at most 200 characters'),
    body('category_id')
      .optional()
      .isInt().withMessage('Category ID must be an integer'),
    body('unit')
      .optional()
      .trim()
      .notEmpty().withMessage('Unit cannot be empty')
      .isLength({ max: 50 }).withMessage('Unit must be at most 50 characters'),
    body('minimum_stock')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Minimum stock must be a non-negative number'),
    body('cost_per_unit')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Cost per unit must be a non-negative number'),
    body('supplier')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 200 }).withMessage('Supplier must be at most 200 characters'),
    body('location')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 200 }).withMessage('Location must be at most 200 characters'),
    body('expiry_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid date format'),
    body('notes')
      .optional({ values: 'null' })
      .trim(),
  ],

  // ==================== TRANSACTION VALIDATORS ====================

  createTransaction: [
    body('item_id')
      .notEmpty().withMessage('Item ID is required')
      .isInt().withMessage('Item ID must be an integer'),
    body('transaction_type')
      .notEmpty().withMessage('Transaction type is required')
      .isIn(TRANSACTION_TYPES)
      .withMessage('Invalid transaction type'),
    body('quantity')
      .notEmpty().withMessage('Quantity is required')
      .isFloat().withMessage('Quantity must be a number')
      .custom((value, { req }) => req.body.transaction_type === 'adjustment' || Number(value) > 0)
      .withMessage('Quantity must be greater than zero'),
    body('unit_cost')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Unit cost must be a non-negative number'),
    body('total_cost')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Total cost must be a non-negative number'),
    body('reference_type')
      .optional({ values: 'null' })
      .isIn(['crop_batch', 'animal', 'animal_group', 'task', 'manual'])
      .withMessage('Invalid reference type'),
    body('reference_id')
      .optional({ values: 'null' })
      .isInt().withMessage('Reference ID must be an integer'),
    body('transaction_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid date format'),
    body('notes')
      .optional({ values: 'null' })
      .trim(),
  ],

  useStock: [
    param('id').isInt().withMessage('Invalid item ID'),
    body('quantity')
      .notEmpty().withMessage('Quantity is required')
      .isFloat({ gt: 0 }).withMessage('Quantity must be greater than zero'),
    body('reference_type')
      .optional({ values: 'null' })
      .isIn(['crop_batch', 'animal', 'animal_group', 'task', 'manual'])
      .withMessage('Invalid reference type'),
    body('reference_id')
      .optional({ values: 'null' })
      .isInt().withMessage('Reference ID must be an integer'),
    body('transaction_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid date format'),
    body('notes')
      .optional({ values: 'null' })
      .trim(),
  ],

  // ==================== COMMON VALIDATORS ====================

  idParam: [
    param('id').isInt().withMessage('Invalid ID'),
  ],

  codeParam: [
    param('code')
      .trim()
      .notEmpty().withMessage('Item code is required'),
  ],

  // ==================== QUERY VALIDATORS ====================

  itemFilters: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('category_id')
      .optional()
      .isInt().withMessage('Category ID must be an integer'),
    query('search')
      .optional()
      .trim(),
    query('low_stock')
      .optional()
      .isBoolean().withMessage('low_stock must be a boolean'),
    query('expiring_days')
      .optional()
      .isInt({ min: 1 }).withMessage('expiring_days must be a positive integer'),
  ],

  transactionFilters: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('item_id')
      .optional()
      .isInt().withMessage('Item ID must be an integer'),
    query('transaction_type')
      .optional()
      .isIn(TRANSACTION_TYPES)
      .withMessage('Invalid transaction type'),
    query('date_from')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
    query('date_to')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
    query('reference_type')
      .optional()
      .isIn(['crop_batch', 'animal', 'animal_group', 'task', 'manual'])
      .withMessage('Invalid reference type'),
  ],

  itemTransactionFilters: [
    param('id').isInt().withMessage('Invalid item ID'),
    query('transaction_type')
      .optional()
      .isIn(TRANSACTION_TYPES)
      .withMessage('Invalid transaction type'),
    query('date_from')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
    query('date_to')
      .optional()
      .isISO8601().withMessage('Invalid date format'),
  ],

  usageReportFilters: [
    param('id').isInt().withMessage('Invalid item ID'),
    query('date_from')
      .notEmpty().withMessage('date_from is required')
      .isISO8601().withMessage('Invalid date format'),
    query('date_to')
      .notEmpty().withMessage('date_to is required')
      .isISO8601().withMessage('Invalid date format'),
  ],

  expiringFilters: [
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  ],

  // ==================== UNIT OF MEASURE VALIDATORS ====================

  createUnit: [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ max: 50 }).withMessage('Name must be at most 50 characters'),
    body('symbol')
      .trim()
      .notEmpty().withMessage('Symbol is required')
      .isLength({ max: 20 }).withMessage('Symbol must be at most 20 characters'),
    body('category')
      .notEmpty().withMessage('Category is required')
      .isIn(['weight', 'volume', 'length', 'area', 'count', 'time', 'other'])
      .withMessage('Invalid category'),
    body('base_unit_id')
      .optional({ values: 'null' })
      .isInt().withMessage('Base unit ID must be an integer'),
    body('conversion_factor')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Conversion factor must be a positive number'),
    body('description')
      .optional({ values: 'null' })
      .trim(),
  ],

  updateUnit: [
    param('id').isInt().withMessage('Invalid unit ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Name cannot be empty')
      .isLength({ max: 50 }).withMessage('Name must be at most 50 characters'),
    body('symbol')
      .optional({ values: 'null' })
      .trim()
      .notEmpty().withMessage('Symbol cannot be empty')
      .isLength({ max: 20 }).withMessage('Symbol must be at most 20 characters'),
    body('category')
      .optional()
      .isIn(['weight', 'volume', 'length', 'area', 'count', 'time', 'other'])
      .withMessage('Invalid category'),
    body('base_unit_id')
      .optional({ values: 'null' })
      .isInt().withMessage('Base unit ID must be an integer'),
    body('conversion_factor')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Conversion factor must be a positive number'),
    body('description')
      .optional({ values: 'null' })
      .trim(),
    body('is_active')
      .optional()
      .isBoolean().withMessage('is_active must be a boolean'),
  ],

  convertUnits: [
    body('quantity')
      .notEmpty().withMessage('Quantity is required')
      .isFloat().withMessage('Quantity must be a number'),
    body('from_unit_id')
      .notEmpty().withMessage('from_unit_id is required')
      .isInt().withMessage('from_unit_id must be an integer'),
    body('to_unit_id')
      .notEmpty().withMessage('to_unit_id is required')
      .isInt().withMessage('to_unit_id must be an integer'),
  ],

  // ==================== BATCH VALIDATORS ====================

  createBatch: [
    body('inventory_item_id')
      .notEmpty().withMessage('Item ID is required')
      .isInt().withMessage('Item ID must be an integer'),
    body('quantity')
      .notEmpty().withMessage('Quantity is required')
      .isFloat({ gt: 0 }).withMessage('Quantity must be greater than zero'),
    body('batch_number')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 100 }).withMessage('Batch number must be at most 100 characters'),
    body('unit_cost')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Unit cost must be a non-negative number'),
    body('manufacture_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid manufacture date format'),
    body('expiry_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid expiry date format'),
    body('received_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid received date format'),
    body('supplier')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 255 }).withMessage('Supplier must be at most 255 characters'),
    body('supplier_batch_number')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 100 }).withMessage('Supplier batch number must be at most 100 characters'),
    body('storage_location')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 200 }).withMessage('Storage location must be at most 200 characters'),
    body('notes')
      .optional({ values: 'null' })
      .trim(),
  ],

  updateBatch: [
    param('id').isInt().withMessage('Invalid batch ID'),
    body('batch_number')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 100 }).withMessage('Batch number must be at most 100 characters'),
    body('unit_cost')
      .optional({ values: 'null' })
      .isFloat({ min: 0 }).withMessage('Unit cost must be a non-negative number'),
    body('manufacture_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid manufacture date format'),
    body('expiry_date')
      .optional({ values: 'null' })
      .isISO8601().withMessage('Invalid expiry date format'),
    body('supplier')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 255 }).withMessage('Supplier must be at most 255 characters'),
    body('supplier_batch_number')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 100 }).withMessage('Supplier batch number must be at most 100 characters'),
    body('storage_location')
      .optional({ values: 'null' })
      .trim()
      .isLength({ max: 200 }).withMessage('Storage location must be at most 200 characters'),
    body('status')
      .optional()
      .isIn(['active', 'depleted', 'expired', 'quarantine', 'disposed'])
      .withMessage('Invalid status'),
    body('notes')
      .optional({ values: 'null' })
      .trim(),
  ],

  batchFilters: [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('item_id')
      .optional()
      .isInt().withMessage('Item ID must be an integer'),
    query('status')
      .optional()
      .isIn(['active', 'depleted', 'expired', 'quarantine', 'disposed'])
      .withMessage('Invalid status'),
    query('expiring_within_days')
      .optional()
      .isInt({ min: 1, max: 365 }).withMessage('expiring_within_days must be between 1 and 365'),
    query('search')
      .optional()
      .trim(),
  ],
};

module.exports = inventoryValidators;
