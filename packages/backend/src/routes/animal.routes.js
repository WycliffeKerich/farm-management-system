const express = require('express');
const router = express.Router();
const animalController = require('../controllers/animal.controller');
const animalValidators = require('../validators/animal.validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(authenticate);

// ==================== ANIMAL TYPES ====================

router.get('/types', animalController.getAnimalTypes.bind(animalController));

router.get('/types/categories', animalController.getAnimalTypeCategories.bind(animalController));

router.get('/types/:id', animalValidators.idParam, validate, animalController.getAnimalTypeById.bind(animalController));

router.post(
  '/types',
  authorize(['owner', 'manager']),
  animalValidators.createAnimalType,
  validate,
  animalController.createAnimalType.bind(animalController)
);

router.put(
  '/types/:id',
  authorize(['owner', 'manager']),
  animalValidators.updateAnimalType,
  validate,
  animalController.updateAnimalType.bind(animalController)
);

router.delete(
  '/types/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteAnimalType.bind(animalController)
);

// ==================== ANIMAL BREEDS ====================

router.get('/breeds', animalController.getBreeds.bind(animalController));

router.get('/breeds/:id', animalValidators.idParam, validate, animalController.getBreedById.bind(animalController));

router.post(
  '/breeds',
  authorize(['owner', 'manager']),
  animalValidators.createBreed,
  validate,
  animalController.createBreed.bind(animalController)
);

router.put(
  '/breeds/:id',
  authorize(['owner', 'manager']),
  animalValidators.updateBreed,
  validate,
  animalController.updateBreed.bind(animalController)
);

router.delete(
  '/breeds/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteBreed.bind(animalController)
);

// ==================== ANIMAL HOUSING ====================

router.get('/housing', animalController.getHousing.bind(animalController));

router.get('/housing/types', animalController.getHousingTypes.bind(animalController));

router.get('/housing/:id', animalValidators.idParam, validate, animalController.getHousingById.bind(animalController));

router.post(
  '/housing',
  authorize(['owner', 'manager']),
  animalValidators.createHousing,
  validate,
  animalController.createHousing.bind(animalController)
);

router.put(
  '/housing/:id',
  authorize(['owner', 'manager']),
  animalValidators.updateHousing,
  validate,
  animalController.updateHousing.bind(animalController)
);

router.delete(
  '/housing/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteHousing.bind(animalController)
);

// ==================== INDIVIDUAL ANIMALS ====================

router.get(
  '/individuals',
  animalValidators.animalFilters,
  validate,
  animalController.getAnimals.bind(animalController)
);

router.get('/individuals/statistics', animalController.getAnimalStatistics.bind(animalController));

router.get('/individuals/breeding-stock', animalController.getBreedingStock.bind(animalController));

router.get(
  '/individuals/:id',
  animalValidators.idParam,
  validate,
  animalController.getAnimalById.bind(animalController)
);

router.get(
  '/individuals/:id/offspring',
  animalValidators.idParam,
  validate,
  animalController.getOffspring.bind(animalController)
);

router.get(
  '/individuals/:animalId/care-schedule',
  animalValidators.animalIdParam,
  validate,
  animalController.getAnimalCareSchedule.bind(animalController)
);

router.post(
  '/individuals',
  animalValidators.createAnimal,
  validate,
  animalController.createAnimal.bind(animalController)
);

router.put(
  '/individuals/:id',
  animalValidators.updateAnimal,
  validate,
  animalController.updateAnimal.bind(animalController)
);

router.patch(
  '/individuals/:id/status',
  animalValidators.updateAnimalStatus,
  validate,
  animalController.updateAnimalStatus.bind(animalController)
);

router.post(
  '/individuals/:id/sale',
  animalValidators.recordAnimalSale,
  validate,
  animalController.recordAnimalSale.bind(animalController)
);

router.post(
  '/individuals/:animalId/death',
  animalValidators.recordAnimalDeath,
  validate,
  animalController.recordAnimalDeath.bind(animalController)
);

router.post(
  '/individuals/:animalId/care-schedule',
  animalValidators.applyCarePlanToAnimal,
  validate,
  animalController.applyCarePlanToAnimal.bind(animalController)
);

router.delete(
  '/individuals/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteAnimal.bind(animalController)
);

// ==================== ANIMAL GROUPS (FLOCKS) ====================

router.get('/groups', animalValidators.groupFilters, validate, animalController.getGroups.bind(animalController));

router.get('/groups/statistics', animalController.getGroupStatistics.bind(animalController));

router.get('/groups/:id', animalValidators.idParam, validate, animalController.getGroupById.bind(animalController));

router.get(
  '/groups/:id/adjustments',
  animalValidators.idParam,
  validate,
  animalController.getGroupAdjustmentHistory.bind(animalController)
);

router.get(
  '/groups/:groupId/mortality-rate',
  animalValidators.groupIdParam,
  validate,
  animalController.getGroupMortalityRate.bind(animalController)
);

router.get(
  '/groups/:groupId/care-schedule',
  animalValidators.groupIdParam,
  validate,
  animalController.getGroupCareSchedule.bind(animalController)
);

router.post('/groups', animalValidators.createGroup, validate, animalController.createGroup.bind(animalController));

router.put('/groups/:id', animalValidators.updateGroup, validate, animalController.updateGroup.bind(animalController));

router.post(
  '/groups/:id/addition',
  animalValidators.recordGroupAddition,
  validate,
  animalController.recordGroupAddition.bind(animalController)
);

router.post(
  '/groups/:id/removal',
  animalValidators.recordGroupRemoval,
  validate,
  animalController.recordGroupRemoval.bind(animalController)
);

router.post(
  '/groups/:groupId/death',
  animalValidators.recordGroupDeaths,
  validate,
  animalController.recordGroupDeaths.bind(animalController)
);

router.post(
  '/groups/:groupId/care-schedule',
  animalValidators.applyCarePlanToGroup,
  validate,
  animalController.applyCarePlanToGroup.bind(animalController)
);

router.patch(
  '/groups/:id/close',
  animalValidators.idParam,
  validate,
  animalController.closeGroup.bind(animalController)
);

router.delete(
  '/groups/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteGroup.bind(animalController)
);

// ==================== DEATHS ====================

router.get('/deaths', animalValidators.deathFilters, validate, animalController.getDeaths.bind(animalController));

router.get('/deaths/statistics', animalController.getDeathStatistics.bind(animalController));

router.get('/deaths/by-cause', animalController.getDeathsByCause.bind(animalController));

router.get('/deaths/alerts', animalController.getRecentDeathAlerts.bind(animalController));

router.get('/deaths/:id', animalValidators.idParam, validate, animalController.getDeathById.bind(animalController));

router.put('/deaths/:id', animalValidators.updateDeath, validate, animalController.updateDeath.bind(animalController));

router.delete(
  '/deaths/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteDeath.bind(animalController)
);

// ==================== CARE PLANS ====================

router.get('/care-plans', animalController.getCarePlans.bind(animalController));

router.get(
  '/care-plans/:id',
  animalValidators.idParam,
  validate,
  animalController.getCarePlanById.bind(animalController)
);

router.post(
  '/care-plans',
  authorize(['owner', 'manager']),
  animalValidators.createCarePlan,
  validate,
  animalController.createCarePlan.bind(animalController)
);

router.put(
  '/care-plans/:id',
  authorize(['owner', 'manager']),
  animalValidators.updateCarePlan,
  validate,
  animalController.updateCarePlan.bind(animalController)
);

router.post(
  '/care-plans/:id/clone',
  authorize(['owner', 'manager']),
  animalValidators.cloneCarePlan,
  validate,
  animalController.cloneCarePlan.bind(animalController)
);

router.delete(
  '/care-plans/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteCarePlan.bind(animalController)
);

// ==================== CARE PLAN TASKS ====================

router.get(
  '/care-plans/:planId/tasks',
  animalValidators.planIdParam,
  validate,
  animalController.getCarePlanTasks.bind(animalController)
);

router.post(
  '/care-plans/:planId/tasks',
  authorize(['owner', 'manager']),
  animalValidators.addCarePlanTask,
  validate,
  animalController.addCarePlanTask.bind(animalController)
);

router.put(
  '/care-plan-tasks/:taskId',
  authorize(['owner', 'manager']),
  animalValidators.updateCarePlanTask,
  validate,
  animalController.updateCarePlanTask.bind(animalController)
);

router.delete(
  '/care-plan-tasks/:taskId',
  authorize(['owner', 'manager']),
  animalValidators.taskIdParam,
  validate,
  animalController.deleteCarePlanTask.bind(animalController)
);

// ==================== CARE SCHEDULES ====================

router.get('/care-schedules', animalController.getAllCareSchedules.bind(animalController));

router.get('/care-schedules/alerts', animalController.getCareAlertsSummary.bind(animalController));

router.delete(
  '/care-schedules/:scheduleId',
  authorize(['owner', 'manager']),
  animalValidators.scheduleIdParam,
  validate,
  animalController.cancelCareSchedule.bind(animalController)
);

// ==================== SCHEDULED TASKS ====================

router.get('/scheduled-tasks', animalController.getScheduledTasks.bind(animalController));

router.get('/scheduled-tasks/calendar', animalController.getScheduledTasksCalendar.bind(animalController));

router.post(
  '/scheduled-tasks/update-statuses',
  authorize(['owner', 'manager']),
  animalController.updateScheduledTaskStatuses.bind(animalController)
);

router.patch(
  '/scheduled-tasks/:taskId/complete',
  animalValidators.completeScheduledTask,
  validate,
  animalController.completeScheduledTask.bind(animalController)
);

router.patch(
  '/scheduled-tasks/:taskId/partial-complete',
  animalValidators.partiallyCompleteScheduledTask,
  validate,
  animalController.partiallyCompleteScheduledTask.bind(animalController)
);

router.patch(
  '/scheduled-tasks/:taskId/skip',
  animalValidators.skipScheduledTask,
  validate,
  animalController.skipScheduledTask.bind(animalController)
);

// ==================== PRODUCTION ====================

const animalProductionController = require('../controllers/animal-production.controller');

// Production types
router.get('/production/types', animalProductionController.getAllProductionTypes.bind(animalProductionController));

router.get(
  '/production/types/:id',
  animalValidators.idParam,
  validate,
  animalProductionController.getProductionTypeById.bind(animalProductionController)
);

router.post(
  '/production/types',
  authorize(['owner', 'manager']),
  animalProductionController.createProductionType.bind(animalProductionController)
);

router.put(
  '/production/types/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalProductionController.updateProductionType.bind(animalProductionController)
);

router.delete(
  '/production/types/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalProductionController.deleteProductionType.bind(animalProductionController)
);

// Production records
router.get('/production/records', animalProductionController.getAllProductionRecords.bind(animalProductionController));

router.get(
  '/production/records/:id',
  animalValidators.idParam,
  validate,
  animalProductionController.getProductionRecordById.bind(animalProductionController)
);

router.post('/production/records', animalProductionController.createProductionRecord.bind(animalProductionController));

router.put(
  '/production/records/:id',
  animalValidators.idParam,
  validate,
  animalProductionController.updateProductionRecord.bind(animalProductionController)
);

router.delete(
  '/production/records/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalProductionController.deleteProductionRecord.bind(animalProductionController)
);

// Production statistics
router.get(
  '/production/statistics',
  animalProductionController.getProductionStatistics.bind(animalProductionController)
);

router.get(
  '/production/daily-summary',
  animalProductionController.getDailyProductionSummary.bind(animalProductionController)
);

router.get('/production/by-source', animalProductionController.getProductionBySource.bind(animalProductionController));

// ==================== HEALTH RECORDS ====================

router.get('/health-records', animalController.getAllHealthRecords.bind(animalController));

router.get('/health-records/statistics', animalController.getHealthStatistics.bind(animalController));

router.get('/health-records/upcoming-followups', animalController.getUpcomingFollowups.bind(animalController));

router.get('/health-records/overdue-followups', animalController.getOverdueFollowups.bind(animalController));

router.get(
  '/health-records/:id',
  animalValidators.idParam,
  validate,
  animalController.getHealthRecordById.bind(animalController)
);

router.post(
  '/health-records',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.createHealthRecord,
  validate,
  animalController.createHealthRecord.bind(animalController)
);

router.put(
  '/health-records/:id',
  authorize(['owner', 'manager']),
  animalValidators.updateHealthRecord,
  validate,
  animalController.updateHealthRecord.bind(animalController)
);

router.delete(
  '/health-records/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteHealthRecord.bind(animalController)
);

router.get(
  '/individuals/:animalId/health-records',
  animalValidators.idParam,
  validate,
  animalController.getHealthRecordsByAnimal.bind(animalController)
);

router.get(
  '/groups/:groupId/health-records',
  animalValidators.idParam,
  validate,
  animalController.getHealthRecordsByGroup.bind(animalController)
);

// ==================== DISEASE & TREATMENT ====================

router.get('/diseases-treatments', animalController.getAllDiseaseTreatments.bind(animalController));

router.get('/diseases-treatments/statistics', animalController.getDiseaseStatistics.bind(animalController));

router.get(
  '/diseases-treatments/occurrence-summary',
  animalController.getDiseaseOccurrenceSummary.bind(animalController)
);

router.get('/diseases-treatments/ongoing', animalController.getOngoingTreatments.bind(animalController));

router.get('/diseases-treatments/chronic', animalController.getChronicConditions.bind(animalController));

router.get('/diseases-treatments/critical', animalController.getCriticalCases.bind(animalController));

router.get(
  '/diseases-treatments/:id',
  animalValidators.idParam,
  validate,
  animalController.getDiseaseTreatmentById.bind(animalController)
);

router.post(
  '/diseases-treatments',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.createDiseaseTreatment,
  validate,
  animalController.createDiseaseTreatment.bind(animalController)
);

router.put(
  '/diseases-treatments/:id',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.updateDiseaseTreatment,
  validate,
  animalController.updateDiseaseTreatment.bind(animalController)
);

router.delete(
  '/diseases-treatments/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteDiseaseTreatment.bind(animalController)
);

router.get(
  '/individuals/:animalId/diseases-treatments',
  animalValidators.idParam,
  validate,
  animalController.getDiseaseTreatmentsByAnimal.bind(animalController)
);

router.get(
  '/groups/:groupId/diseases-treatments',
  animalValidators.idParam,
  validate,
  animalController.getDiseaseTreatmentsByGroup.bind(animalController)
);

// ==================== FEED RECORDS ====================

router.get('/feed-records', animalController.getAllFeedRecords.bind(animalController));

router.get('/feed-records/statistics', animalController.getFeedStatistics.bind(animalController));

router.get('/feed-records/by-feed-type', animalController.getConsumptionByFeedType.bind(animalController));

router.get('/feed-records/daily-consumption', animalController.getDailyFeedConsumption.bind(animalController));

router.get('/feed-records/cost-by-type', animalController.getFeedCostByAnimalType.bind(animalController));

router.get('/feed-records/average-daily-cost', animalController.getAverageDailyFeedCost.bind(animalController));

router.get(
  '/feed-records/:id',
  animalValidators.idParam,
  validate,
  animalController.getFeedRecordById.bind(animalController)
);

router.post(
  '/feed-records',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.createFeedRecord,
  validate,
  animalController.createFeedRecord.bind(animalController)
);

router.put(
  '/feed-records/:id',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.updateFeedRecord,
  validate,
  animalController.updateFeedRecord.bind(animalController)
);

router.delete(
  '/feed-records/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteFeedRecord.bind(animalController)
);

router.get(
  '/individuals/:animalId/feed-records',
  animalValidators.idParam,
  validate,
  animalController.getFeedRecordsByAnimal.bind(animalController)
);

router.get(
  '/groups/:groupId/feed-records',
  animalValidators.idParam,
  validate,
  animalController.getFeedRecordsByGroup.bind(animalController)
);

// ==================== BREEDING RECORDS ====================

router.get('/breeding-records', animalController.getAllBreedingRecords.bind(animalController));

router.get('/breeding-records/statistics', animalController.getBreedingStatistics.bind(animalController));

router.get('/breeding-records/expected-deliveries', animalController.getExpectedDeliveries.bind(animalController));

router.get('/breeding-records/overdue-deliveries', animalController.getOverdueDeliveries.bind(animalController));

router.get(
  '/breeding-records/success-rate-by-type',
  animalController.getBreedingSuccessRateByType.bind(animalController)
);

router.get(
  '/breeding-records/:id',
  animalValidators.idParam,
  validate,
  animalController.getBreedingRecordById.bind(animalController)
);

router.post(
  '/breeding-records',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.createBreedingRecord,
  validate,
  animalController.createBreedingRecord.bind(animalController)
);

router.put(
  '/breeding-records/:id',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.updateBreedingRecord,
  validate,
  animalController.updateBreedingRecord.bind(animalController)
);

router.delete(
  '/breeding-records/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteBreedingRecord.bind(animalController)
);

router.get(
  '/individuals/:animalId/breeding-records',
  animalValidators.idParam,
  validate,
  animalController.getBreedingRecordsByAnimal.bind(animalController)
);

router.get(
  '/individuals/:animalId/breeding-performance',
  animalValidators.idParam,
  validate,
  animalController.getBreedingPerformance.bind(animalController)
);

// ==================== LIVESTOCK SALES ====================

router.get('/sales', animalController.getAllAnimalSales.bind(animalController));

router.get('/sales/statistics', animalController.getAnimalSalesStatistics.bind(animalController));

router.get('/sales/by-animal-type', animalController.getSalesByAnimalType.bind(animalController));

router.get('/sales/monthly', animalController.getMonthlySales.bind(animalController));

router.get('/sales/top-customers', animalController.getTopCustomers.bind(animalController));

router.get('/sales/recent', animalController.getRecentAnimalSales.bind(animalController));

router.get('/sales/pending-payments', animalController.getPendingPayments.bind(animalController));

router.get('/sales/:id', animalValidators.idParam, validate, animalController.getAnimalSaleById.bind(animalController));

router.post(
  '/sales',
  authorize(['owner', 'manager']),
  animalValidators.createAnimalSale,
  validate,
  animalController.createAnimalSale.bind(animalController)
);

router.put(
  '/sales/:id',
  authorize(['owner', 'manager']),
  animalValidators.updateAnimalSale,
  validate,
  animalController.updateAnimalSale.bind(animalController)
);

router.delete(
  '/sales/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteAnimalSale.bind(animalController)
);

// ==================== INCUBATION RECORDS ====================

router.get('/incubation-records', animalController.getAllIncubationRecords.bind(animalController));

router.get('/incubation-records/statistics', animalController.getIncubationStatistics.bind(animalController));

router.get('/incubation-records/active', animalController.getActiveIncubations.bind(animalController));

router.get('/incubation-records/due-to-hatch', animalController.getDueToHatch.bind(animalController));

router.get('/incubation-records/overdue', animalController.getOverdueHatching.bind(animalController));

router.get('/incubation-records/hatch-rate-by-breed', animalController.getHatchRateByBreed.bind(animalController));

router.get('/incubation-records/monthly-summary', animalController.getMonthlyIncubationSummary.bind(animalController));

router.get(
  '/incubation-records/:id',
  animalValidators.idParam,
  validate,
  animalController.getIncubationRecordById.bind(animalController)
);

router.post(
  '/incubation-records',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.createIncubationRecord,
  validate,
  animalController.createIncubationRecord.bind(animalController)
);

router.put(
  '/incubation-records/:id',
  authorize(['owner', 'manager', 'worker']),
  animalValidators.updateIncubationRecord,
  validate,
  animalController.updateIncubationRecord.bind(animalController)
);

router.delete(
  '/incubation-records/:id',
  authorize(['owner', 'manager']),
  animalValidators.idParam,
  validate,
  animalController.deleteIncubationRecord.bind(animalController)
);

router.get(
  '/groups/:groupId/incubation-records',
  animalValidators.idParam,
  validate,
  animalController.getIncubationRecordsByGroup.bind(animalController)
);

module.exports = router;
