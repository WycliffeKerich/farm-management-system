const express = require('express');
const enterpriseController = require('../controllers/enterprise.controller');
const enterpriseValidators = require('../validators/enterprise.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Everyone signed in can look enterprises up; owners and managers maintain them
router.use(authenticate);

/**
 * @route GET /api/v1/enterprises
 * @desc List enterprises (paged; enterprise_type, is_active; sort name, enterprise_type, created_at)
 */
router.get('/', enterpriseValidators.list, validate, enterpriseController.list.bind(enterpriseController));

/**
 * @route GET /api/v1/enterprises/:id
 * @desc One enterprise, with counts of its batches, animals, groups and activities
 */
router.get('/:id', enterpriseValidators.idParam, validate, enterpriseController.get.bind(enterpriseController));

/**
 * @route POST /api/v1/enterprises
 */
router.post(
  '/',
  authorize(['owner', 'manager']),
  enterpriseValidators.create,
  validate,
  enterpriseController.create.bind(enterpriseController)
);

/**
 * @route PUT /api/v1/enterprises/:id
 */
router.put(
  '/:id',
  authorize(['owner', 'manager']),
  enterpriseValidators.update,
  validate,
  enterpriseController.update.bind(enterpriseController)
);

/**
 * @route DELETE /api/v1/enterprises/:id
 * @desc Soft delete; refused while anything refers to it
 */
router.delete(
  '/:id',
  authorize(['owner', 'manager']),
  enterpriseValidators.idParam,
  validate,
  enterpriseController.delete.bind(enterpriseController)
);

module.exports = router;
