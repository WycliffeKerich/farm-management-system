const express = require('express');
const router = express.Router();
const cropController = require('../controllers/crop.controller');
const cropValidators = require('../validators/crop.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==================== CROP TYPES ====================

router.get(
  '/crop-types',
  cropController.getCropTypes.bind(cropController)
);

router.get(
  '/crop-types/categories',
  cropController.getCropTypeCategories.bind(cropController)
);

router.get(
  '/crop-types/:id',
  cropValidators.idParam,
  validate,
  cropController.getCropTypeById.bind(cropController)
);

router.post(
  '/crop-types',
  authorize(['owner', 'manager']),
  cropValidators.createCropType,
  validate,
  cropController.createCropType.bind(cropController)
);

router.put(
  '/crop-types/:id',
  authorize(['owner', 'manager']),
  cropValidators.updateCropType,
  validate,
  cropController.updateCropType.bind(cropController)
);

router.delete(
  '/crop-types/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteCropType.bind(cropController)
);

// ==================== CROP VARIETIES ====================

router.get(
  '/varieties',
  cropController.getVarieties.bind(cropController)
);

router.get(
  '/varieties/:id',
  cropValidators.idParam,
  validate,
  cropController.getVarietyById.bind(cropController)
);

router.post(
  '/varieties',
  authorize(['owner', 'manager']),
  cropValidators.createVariety,
  validate,
  cropController.createVariety.bind(cropController)
);

router.put(
  '/varieties/:id',
  authorize(['owner', 'manager']),
  cropValidators.updateVariety,
  validate,
  cropController.updateVariety.bind(cropController)
);

router.delete(
  '/varieties/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteVariety.bind(cropController)
);

// ==================== GROWING LOCATIONS ====================

router.get(
  '/locations',
  cropController.getLocations.bind(cropController)
);

router.get(
  '/locations/types',
  cropController.getLocationTypes.bind(cropController)
);

router.get(
  '/locations/:id',
  cropValidators.idParam,
  validate,
  cropController.getLocationById.bind(cropController)
);

router.post(
  '/locations',
  authorize(['owner', 'manager']),
  cropValidators.createLocation,
  validate,
  cropController.createLocation.bind(cropController)
);

router.put(
  '/locations/:id',
  authorize(['owner', 'manager']),
  cropValidators.updateLocation,
  validate,
  cropController.updateLocation.bind(cropController)
);

router.delete(
  '/locations/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteLocation.bind(cropController)
);

// ==================== CROP BATCHES ====================

router.get(
  '/batches',
  cropValidators.batchFilters,
  validate,
  cropController.getBatches.bind(cropController)
);

router.get(
  '/batches/statistics',
  cropController.getBatchStatistics.bind(cropController)
);

router.get(
  '/batches/:id',
  cropValidators.idParam,
  validate,
  cropController.getBatchById.bind(cropController)
);

router.post(
  '/batches',
  cropValidators.createBatch,
  validate,
  cropController.createBatch.bind(cropController)
);

router.put(
  '/batches/:id',
  cropValidators.updateBatch,
  validate,
  cropController.updateBatch.bind(cropController)
);

router.patch(
  '/batches/:id/status',
  cropValidators.updateBatchStatus,
  validate,
  cropController.updateBatchStatus.bind(cropController)
);

router.delete(
  '/batches/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteBatch.bind(cropController)
);

// ==================== GROWTH OBSERVATIONS ====================

router.get(
  '/batches/:batchId/observations',
  cropValidators.batchIdParam,
  validate,
  cropController.getBatchObservations.bind(cropController)
);

router.post(
  '/batches/:batchId/observations',
  cropValidators.addObservation,
  validate,
  cropController.addObservation.bind(cropController)
);

router.delete(
  '/observations/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteObservation.bind(cropController)
);

// ==================== HARVESTS ====================

router.get(
  '/harvests',
  cropValidators.harvestFilters,
  validate,
  cropController.getAllHarvests.bind(cropController)
);

router.get(
  '/harvests/summary',
  cropValidators.harvestFilters,
  validate,
  cropController.getHarvestSummary.bind(cropController)
);

router.get(
  '/batches/:batchId/harvests',
  cropValidators.batchIdParam,
  validate,
  cropController.getBatchHarvests.bind(cropController)
);

router.post(
  '/batches/:batchId/harvests',
  cropValidators.recordHarvest,
  validate,
  cropController.recordHarvest.bind(cropController)
);

router.delete(
  '/harvests/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteHarvest.bind(cropController)
);

// ==================== INPUT APPLICATIONS ====================

router.get(
  '/input-applications',
  cropController.getAllInputApplications.bind(cropController)
);

router.get(
  '/batches/:batchId/input-applications',
  cropValidators.batchIdParam,
  validate,
  cropController.getBatchInputApplications.bind(cropController)
);

router.post(
  '/batches/:batchId/input-applications',
  cropValidators.recordInputApplication,
  validate,
  cropController.recordInputApplication.bind(cropController)
);

router.delete(
  '/input-applications/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteInputApplication.bind(cropController)
);

// ==================== PEST & DISEASE ====================

router.get(
  '/pests-diseases',
  cropValidators.pestDiseaseFilters,
  validate,
  cropController.getAllPestsDiseases.bind(cropController)
);

router.get(
  '/pests-diseases/statistics',
  cropController.getPestDiseaseStatistics.bind(cropController)
);

router.get(
  '/pests-diseases/alerts',
  cropController.getActiveAlerts.bind(cropController)
);

router.get(
  '/batches/:batchId/pests-diseases',
  cropValidators.batchIdParam,
  validate,
  cropController.getBatchPestsDiseases.bind(cropController)
);

router.post(
  '/batches/:batchId/pests-diseases',
  cropValidators.reportPestDisease,
  validate,
  cropController.reportPestDisease.bind(cropController)
);

router.patch(
  '/pests-diseases/:id',
  cropValidators.updatePestDiseaseStatus,
  validate,
  cropController.updatePestDiseaseStatus.bind(cropController)
);

router.delete(
  '/pests-diseases/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deletePestDisease.bind(cropController)
);

// ==================== CARE PLANS ====================

router.get(
  '/care-plans',
  cropController.getCarePlans.bind(cropController)
);

router.get(
  '/care-plans/:id',
  cropValidators.idParam,
  validate,
  cropController.getCarePlanById.bind(cropController)
);

router.post(
  '/care-plans',
  authorize(['owner', 'manager']),
  cropValidators.createCarePlan,
  validate,
  cropController.createCarePlan.bind(cropController)
);

router.put(
  '/care-plans/:id',
  authorize(['owner', 'manager']),
  cropValidators.updateCarePlan,
  validate,
  cropController.updateCarePlan.bind(cropController)
);

router.post(
  '/care-plans/:id/clone',
  authorize(['owner', 'manager']),
  cropValidators.cloneCarePlan,
  validate,
  cropController.cloneCarePlan.bind(cropController)
);

router.delete(
  '/care-plans/:id',
  authorize(['owner', 'manager']),
  cropValidators.idParam,
  validate,
  cropController.deleteCarePlan.bind(cropController)
);

// ==================== CARE PLAN TASKS ====================

router.get(
  '/care-plans/:planId/tasks',
  cropValidators.planIdParam,
  validate,
  cropController.getCarePlanTasks.bind(cropController)
);

router.post(
  '/care-plans/:planId/tasks',
  authorize(['owner', 'manager']),
  cropValidators.addCarePlanTask,
  validate,
  cropController.addCarePlanTask.bind(cropController)
);

router.put(
  '/care-plan-tasks/:taskId',
  authorize(['owner', 'manager']),
  cropValidators.updateCarePlanTask,
  validate,
  cropController.updateCarePlanTask.bind(cropController)
);

router.delete(
  '/care-plan-tasks/:taskId',
  authorize(['owner', 'manager']),
  cropValidators.taskIdParam,
  validate,
  cropController.deleteCarePlanTask.bind(cropController)
);

// ==================== BATCH CARE SCHEDULES ====================

router.get(
  '/care-schedules',
  cropController.getAllBatchSchedules.bind(cropController)
);

router.get(
  '/care-schedules/alerts',
  cropController.getCareAlertsSummary.bind(cropController)
);

router.get(
  '/batches/:batchId/care-schedule',
  cropValidators.batchIdParam,
  validate,
  cropController.getBatchCareSchedule.bind(cropController)
);

router.post(
  '/batches/:batchId/care-schedule',
  cropValidators.applyCarePlan,
  validate,
  cropController.applyCarePlanToBatch.bind(cropController)
);

router.delete(
  '/batches/:batchId/care-schedule',
  authorize(['owner', 'manager']),
  cropValidators.batchIdParam,
  validate,
  cropController.cancelBatchCareSchedule.bind(cropController)
);

// ==================== SCHEDULED TASKS ====================

router.get(
  '/scheduled-tasks',
  cropController.getScheduledTasks.bind(cropController)
);

router.get(
  '/scheduled-tasks/calendar',
  cropController.getScheduledTasksCalendar.bind(cropController)
);

router.post(
  '/scheduled-tasks/update-statuses',
  authorize(['owner', 'manager']),
  cropController.updateScheduledTaskStatuses.bind(cropController)
);

router.patch(
  '/scheduled-tasks/:taskId/complete',
  cropValidators.completeScheduledTask,
  validate,
  cropController.completeScheduledTask.bind(cropController)
);

router.patch(
  '/scheduled-tasks/:taskId/skip',
  cropValidators.skipScheduledTask,
  validate,
  cropController.skipScheduledTask.bind(cropController)
);

router.post(
  '/scheduled-tasks/:taskId/complete-with-input',
  cropValidators.completeScheduledTaskWithInput,
  validate,
  cropController.completeScheduledTaskWithInput.bind(cropController)
);

module.exports = router;
