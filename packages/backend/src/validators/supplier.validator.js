const { body, param, query } = require('express-validator');

const optionalText = (field, max) =>
  body(field)
    .optional({ values: 'null' })
    .trim()
    .isLength({ max })
    .withMessage(`${field} must be at most ${max} characters`);

const detailFields = [
  optionalText('contact_person', 255),
  optionalText('phone', 50),
  body('email')
    .optional({ values: 'falsy' })
    .trim()
    .isEmail()
    .withMessage('Invalid email address')
    .isLength({ max: 255 }),
  optionalText('kra_pin', 20),
  optionalText('address', 1000),
  optionalText('notes', 5000),
  body('is_active').optional().isBoolean().withMessage('is_active must be true or false').toBoolean(),
];

/**
 * Validators for supplier endpoints
 */
const supplierValidators = {
  list: [
    query('search').optional().trim().isLength({ max: 100 }),
    query('include_inactive').optional().isBoolean().toBoolean(),
  ],

  idParam: [param('id').isInt().withMessage('Invalid supplier ID')],

  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
    ...detailFields,
  ],

  update: [
    param('id').isInt().withMessage('Invalid supplier ID'),
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Name cannot be empty')
      .isLength({ max: 255 })
      .withMessage('Name must be at most 255 characters'),
    ...detailFields,
  ],
};

module.exports = supplierValidators;
