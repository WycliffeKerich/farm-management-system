const { body, param, query } = require('express-validator');
const { ATTACHMENT_ENTITY_TYPES } = require('../config/constants');

const entityTypeField = (chain) =>
  chain.isIn(ATTACHMENT_ENTITY_TYPES).withMessage(`entity_type must be one of: ${ATTACHMENT_ENTITY_TYPES.join(', ')}`);

const captionField = body('caption')
  .optional({ values: 'null' })
  .trim()
  .isLength({ max: 1000 })
  .withMessage('caption must be at most 1000 characters');

/**
 * Validators for attachment endpoints
 */
const attachmentValidators = {
  list: [
    entityTypeField(query('entity_type').exists().withMessage('entity_type is required').bail()),
    query('entity_id').isInt({ min: 1 }).withMessage('entity_id must be a positive integer').toInt(),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ],

  idParam: [param('id').isInt({ min: 1 }).withMessage('Invalid attachment ID').toInt()],

  // Multipart fields, parsed by the upload middleware
  upload: [
    entityTypeField(body('entity_type').exists().withMessage('entity_type is required').bail()),
    body('entity_id').isInt({ min: 1 }).withMessage('entity_id must be a positive integer').toInt(),
    captionField,
  ],

  update: [param('id').isInt({ min: 1 }).withMessage('Invalid attachment ID').toInt(), captionField],
};

module.exports = attachmentValidators;
