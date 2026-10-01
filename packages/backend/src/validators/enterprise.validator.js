const { body, param, query } = require('express-validator');
const { ENTERPRISE_TYPES } = require('../config/constants');

/**
 * The enterprise_id of a type or subject; null takes it out of any enterprise
 * @returns {Object} express-validator chain
 */
const enterpriseIdField = () =>
  body('enterprise_id')
    .optional()
    .custom((value) => value === null || /^[1-9]\d{0,9}$/.test(String(value)))
    .withMessage('Enterprise ID must be a positive integer or null')
    .customSanitizer((value) => (value === null ? null : Number(value)));

const enterpriseTypeField = (chain) =>
  chain.isIn(ENTERPRISE_TYPES).withMessage(`enterprise_type must be one of: ${ENTERPRISE_TYPES.join(', ')}`);

const detailFields = [
  body('unit_of_output')
    .optional({ values: 'null' })
    .trim()
    .notEmpty()
    .withMessage('unit_of_output cannot be empty')
    .isLength({ max: 20 })
    .withMessage('unit_of_output must be at most 20 characters'),
  body('description')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 5000 })
    .withMessage('description must be at most 5000 characters'),
  body('is_active').optional().isBoolean().withMessage('is_active must be true or false').toBoolean(),
];

/**
 * Validators for enterprise endpoints
 */
const enterpriseValidators = {
  list: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isIn(['name', 'enterprise_type', 'created_at'])
      .withMessage('sort must be name, enterprise_type or created_at'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
    enterpriseTypeField(query('enterprise_type').optional()),
    query('is_active').optional().isBoolean().withMessage('is_active must be true or false').toBoolean(),
  ],

  idParam: [param('id').isInt().withMessage('Invalid enterprise ID')],

  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    enterpriseTypeField(body('enterprise_type').exists().withMessage('enterprise_type is required').bail()),
    ...detailFields,
  ],

  update: [
    param('id').isInt().withMessage('Invalid enterprise ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Name must be at most 100 characters'),
    enterpriseTypeField(body('enterprise_type').optional()),
    ...detailFields,
  ],
};

module.exports = enterpriseValidators;
module.exports.enterpriseIdField = enterpriseIdField;
