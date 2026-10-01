const express = require('express');
const { query } = require('express-validator');
const withdrawalController = require('../controllers/withdrawal.controller');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @route GET /api/v1/withdrawals/active
 * @desc Crop batches that cannot be harvested, and animals or groups whose
 *   milk, meat or eggs cannot be used, on a date (default today)
 */
router.get(
  '/active',
  [query('date').optional().isDate().withMessage('Invalid date format')],
  validate,
  withdrawalController.active.bind(withdrawalController)
);

module.exports = router;
