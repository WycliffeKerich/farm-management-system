const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

/**
 * @route GET /api/v1/settings
 * @desc Farm settings (farm_name, currency, timezone, farm_location), defaults filled in.
 *   Everyone signed in reads them; the app formats money and dates with them.
 */
router.get('/', settingsController.get.bind(settingsController));

/**
 * @route PUT /api/v1/settings
 * @desc Change some settings (owner only). Unknown keys and bad values are refused as a whole.
 */
router.put('/', authorize(['owner']), settingsController.update.bind(settingsController));

module.exports = router;
