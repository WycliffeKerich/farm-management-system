const express = require('express');
const auditLogController = require('../controllers/audit-log.controller');
const auditLogValidators = require('../validators/audit-log.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Only the owner reads the audit log
router.use(authenticate, authorize(['owner']));

/**
 * @route GET /api/v1/audit-log
 * @desc Changes to business records, newest first (paged; table, record_id,
 *   changed_by, action, date_from, date_to; order asc|desc by changed_at)
 */
router.get('/', auditLogValidators.list, validate, auditLogController.list.bind(auditLogController));

module.exports = router;
