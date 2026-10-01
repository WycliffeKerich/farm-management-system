const { query } = require('express-validator');

const AUDIT_ACTIONS = ['insert', 'update', 'delete', 'soft_delete'];

/**
 * Validators for the audit log viewer
 */
const auditLogValidators = {
  list: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
    query('table')
      .optional()
      .matches(/^[a-z_]{1,63}$/)
      .withMessage('table must be a table name'),
    query('record_id').optional().isInt({ min: 1 }).withMessage('record_id must be a positive integer').toInt(),
    query('changed_by').optional().isInt({ min: 1 }).withMessage('changed_by must be a user ID').toInt(),
    query('action')
      .optional()
      .customSanitizer((value) => [].concat(value))
      .custom((values) => values.every((value) => AUDIT_ACTIONS.includes(value)))
      .withMessage(`action must be one of: ${AUDIT_ACTIONS.join(', ')}`),
    query('date_from').optional().isISO8601({ strict: true }).withMessage('date_from must be a date (YYYY-MM-DD)'),
    query('date_to').optional().isISO8601({ strict: true }).withMessage('date_to must be a date (YYYY-MM-DD)'),
  ],
};

module.exports = auditLogValidators;
