const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const supplierValidators = require('../validators/supplier.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Everyone signed in can look suppliers up; owners and managers maintain them
router.use(authenticate);

/**
 * @route GET /api/v1/suppliers
 * @desc List suppliers (search, include_inactive), with item and batch counts
 */
router.get('/', supplierValidators.list, validate, supplierController.list.bind(supplierController));

/**
 * @route GET /api/v1/suppliers/:id
 */
router.get('/:id', supplierValidators.idParam, validate, supplierController.get.bind(supplierController));

/**
 * @route POST /api/v1/suppliers
 */
router.post(
  '/',
  authorize(['owner', 'manager']),
  supplierValidators.create,
  validate,
  supplierController.create.bind(supplierController)
);

/**
 * @route PUT /api/v1/suppliers/:id
 */
router.put(
  '/:id',
  authorize(['owner', 'manager']),
  supplierValidators.update,
  validate,
  supplierController.update.bind(supplierController)
);

/**
 * @route DELETE /api/v1/suppliers/:id
 * @desc Soft delete; refused while items or batches refer to it
 */
router.delete(
  '/:id',
  authorize(['owner', 'manager']),
  supplierValidators.idParam,
  validate,
  supplierController.delete.bind(supplierController)
);

module.exports = router;
