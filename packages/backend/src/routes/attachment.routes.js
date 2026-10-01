const express = require('express');
const attachmentController = require('../controllers/attachment.controller');
const attachmentValidators = require('../validators/attachment.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { singleUpload } = require('../middleware/upload.middleware');

const router = express.Router();

// Anyone signed in attaches files to the records they keep; finance records
// are for owners and managers (checked in the service)
router.use(authenticate);

/**
 * @route GET /api/v1/attachments?entity_type&entity_id
 * @desc A record's attachments, newest first (paged)
 */
router.get('/', attachmentValidators.list, validate, attachmentController.list.bind(attachmentController));

/**
 * @route POST /api/v1/attachments
 * @desc Upload one file (multipart: file, entity_type, entity_id, caption).
 *   JPEG, PNG, WebP or PDF, checked by content; UPLOAD_MAX_MB (default 10).
 */
router.post(
  '/',
  singleUpload('file'),
  attachmentValidators.upload,
  validate,
  attachmentController.upload.bind(attachmentController)
);

/**
 * @route GET /api/v1/attachments/:id
 * @desc The file (inline; ?download=true to save it)
 */
router.get('/:id', attachmentValidators.idParam, validate, attachmentController.download.bind(attachmentController));

/**
 * @route PUT /api/v1/attachments/:id
 * @desc Change the caption (uploader, owner or manager)
 */
router.put('/:id', attachmentValidators.update, validate, attachmentController.update.bind(attachmentController));

/**
 * @route DELETE /api/v1/attachments/:id
 * @desc Remove an attachment (uploader, owner or manager)
 */
router.delete('/:id', attachmentValidators.idParam, validate, attachmentController.delete.bind(attachmentController));

module.exports = router;
