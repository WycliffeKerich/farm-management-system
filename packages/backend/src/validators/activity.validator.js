const { body, param, query } = require('express-validator');
const { KINDS } = require('../services/activity-sync.service');

const BULK_MAX = 100;

const optionalId = (field) =>
  query(field).optional().isInt({ min: 1 }).withMessage(`${field} must be a positive integer`);

/**
 * Validators for activity endpoints
 */
const activityValidators = {
  list: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .matches(/^[a-z_]+$/)
      .withMessage('sort must be a column name'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
    optionalId('enterprise_id'),
    optionalId('crop_batch_id'),
    optionalId('animal_id'),
    optionalId('animal_group_id'),
    optionalId('performed_by'),
    optionalId('task_id'),
    query('status')
      .optional()
      .isIn(['planned', 'done', 'cancelled'])
      .withMessage('status must be planned, done or cancelled'),
    // One type, or several as activity_type=a&activity_type=b
    query('activity_type')
      .optional()
      .custom((value) => [].concat(value).every((type) => /^[a-z_]+$/.test(type)))
      .withMessage('activity_type must be a type name'),
    query('date_from').optional().isISO8601().withMessage('date_from must be a date'),
    query('date_to').optional().isISO8601().withMessage('date_to must be a date'),
    query('search').optional().trim().isLength({ max: 100 }),
  ],

  idParam: [param('id').isInt().withMessage('Invalid activity ID')],

  bulk: [
    body('entries')
      .isArray({ min: 1, max: BULK_MAX })
      .withMessage(`entries must be a list of 1 to ${BULK_MAX} records`),
    body('entries.*.client_request_id').isUUID().withMessage('client_request_id must be a UUID'),
    body('entries.*.kind')
      .isIn(KINDS)
      .withMessage(`kind must be one of: ${KINDS.join(', ')}`),
    body('entries.*.batch_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('batch_id must be an ID'),
    body('entries.*.data').isObject().withMessage('data must be an object'),
    body('entries')
      .custom((entries) => new Set(entries.map((e) => e && e.client_request_id)).size === entries.length)
      .withMessage('Each entry needs its own client_request_id'),
  ],
};

module.exports = activityValidators;
