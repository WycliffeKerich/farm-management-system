const express = require('express');
const activityController = require('../controllers/activity.controller');
const activityValidators = require('../validators/activity.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Everyone signed in reads the timeline and syncs the records they could post one by one
router.use(authenticate);

/**
 * @route GET /api/v1/activities
 * @desc The farm timeline, paged. Filters: enterprise_id, crop_batch_id, animal_id,
 *   animal_group_id, performed_by, task_id, status, activity_type (repeatable),
 *   date_from, date_to, search. Sort: date (default), activity_type, title, status, created_at
 */
router.get('/', activityValidators.list, validate, activityController.list.bind(activityController));

/**
 * @route POST /api/v1/activities/bulk
 * @desc Replay an offline outbox: { entries: [{ client_request_id, kind, batch_id?, data }] }.
 *   Idempotent on client_request_id; each entry succeeds or fails on its own.
 */
router.post('/bulk', activityValidators.bulk, validate, activityController.bulk.bind(activityController));

/**
 * @route GET /api/v1/activities/:id
 */
router.get('/:id', activityValidators.idParam, validate, activityController.get.bind(activityController));

module.exports = router;
