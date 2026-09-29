import api from './api';

/**
 * Animal Management API Service
 */
const animalService = {
    // ==================== ANIMAL TYPES ====================

    getAnimalTypes(params = {}) {
        return api.get('/animals/types', { params });
    },

    getAnimalTypeById(id) {
        return api.get(`/animals/types/${id}`);
    },

    getAnimalTypeCategories() {
        return api.get('/animals/types/categories');
    },

    createAnimalType(data) {
        return api.post('/animals/types', data);
    },

    updateAnimalType(id, data) {
        return api.put(`/animals/types/${id}`, data);
    },

    deleteAnimalType(id) {
        return api.delete(`/animals/types/${id}`);
    },

    // ==================== ANIMAL BREEDS ====================

    getBreeds(params = {}) {
        return api.get('/animals/breeds', { params });
    },

    getBreedById(id) {
        return api.get(`/animals/breeds/${id}`);
    },

    createBreed(data) {
        return api.post('/animals/breeds', data);
    },

    updateBreed(id, data) {
        return api.put(`/animals/breeds/${id}`, data);
    },

    deleteBreed(id) {
        return api.delete(`/animals/breeds/${id}`);
    },

    // ==================== ANIMAL HOUSING ====================

    getHousing(params = {}) {
        return api.get('/animals/housing', { params });
    },

    getHousingById(id) {
        return api.get(`/animals/housing/${id}`);
    },

    getHousingTypes() {
        return api.get('/animals/housing/types');
    },

    createHousing(data) {
        return api.post('/animals/housing', data);
    },

    updateHousing(id, data) {
        return api.put(`/animals/housing/${id}`, data);
    },

    deleteHousing(id) {
        return api.delete(`/animals/housing/${id}`);
    },

    // ==================== INDIVIDUAL ANIMALS ====================

    getAnimals(params = {}) {
        return api.get('/animals/individuals', { params });
    },

    getAnimalById(id) {
        return api.get(`/animals/individuals/${id}`);
    },

    getAnimalStatistics() {
        return api.get('/animals/individuals/statistics');
    },

    getBreedingStock(params = {}) {
        return api.get('/animals/individuals/breeding-stock', { params });
    },

    getOffspring(animalId) {
        return api.get(`/animals/individuals/${animalId}/offspring`);
    },

    getAnimalCareSchedule(animalId) {
        return api.get(`/animals/individuals/${animalId}/care-schedule`);
    },

    createAnimal(data) {
        return api.post('/animals/individuals', data);
    },

    updateAnimal(id, data) {
        return api.put(`/animals/individuals/${id}`, data);
    },

    updateAnimalStatus(id, data) {
        return api.patch(`/animals/individuals/${id}/status`, data);
    },

    recordAnimalSale(id, data = {}) {
        return api.post(`/animals/individuals/${id}/sale`, data);
    },

    recordAnimalDeath(animalId, data) {
        return api.post(`/animals/individuals/${animalId}/death`, data);
    },

    applyCarePlanToAnimal(animalId, data) {
        return api.post(`/animals/individuals/${animalId}/care-schedule`, data);
    },

    deleteAnimal(id) {
        return api.delete(`/animals/individuals/${id}`);
    },

    // ==================== ANIMAL GROUPS (FLOCKS) ====================

    getGroups(params = {}) {
        return api.get('/animals/groups', { params });
    },

    getGroupById(id) {
        return api.get(`/animals/groups/${id}`);
    },

    getGroupStatistics() {
        return api.get('/animals/groups/statistics');
    },

    getGroupAdjustmentHistory(groupId) {
        return api.get(`/animals/groups/${groupId}/adjustments`);
    },

    getGroupMortalityRate(groupId) {
        return api.get(`/animals/groups/${groupId}/mortality-rate`);
    },

    getGroupCareSchedule(groupId) {
        return api.get(`/animals/groups/${groupId}/care-schedule`);
    },

    createGroup(data) {
        return api.post('/animals/groups', data);
    },

    updateGroup(id, data) {
        return api.put(`/animals/groups/${id}`, data);
    },

    recordGroupAddition(groupId, data) {
        return api.post(`/animals/groups/${groupId}/addition`, data);
    },

    recordGroupRemoval(groupId, data) {
        return api.post(`/animals/groups/${groupId}/removal`, data);
    },

    recordGroupDeaths(groupId, data) {
        return api.post(`/animals/groups/${groupId}/death`, data);
    },

    applyCarePlanToGroup(groupId, data) {
        return api.post(`/animals/groups/${groupId}/care-schedule`, data);
    },

    closeGroup(id) {
        return api.patch(`/animals/groups/${id}/close`);
    },

    deleteGroup(id) {
        return api.delete(`/animals/groups/${id}`);
    },

    // ==================== DEATHS ====================

    getDeaths(params = {}) {
        return api.get('/animals/deaths', { params });
    },

    getDeathById(id) {
        return api.get(`/animals/deaths/${id}`);
    },

    getDeathStatistics(params = {}) {
        return api.get('/animals/deaths/statistics', { params });
    },

    getDeathsByCause(params = {}) {
        return api.get('/animals/deaths/by-cause', { params });
    },

    getRecentDeathAlerts(params = {}) {
        return api.get('/animals/deaths/alerts', { params });
    },

    updateDeath(id, data) {
        return api.put(`/animals/deaths/${id}`, data);
    },

    deleteDeath(id) {
        return api.delete(`/animals/deaths/${id}`);
    },

    // ==================== CARE PLANS ====================

    getCarePlans(params = {}) {
        return api.get('/animals/care-plans', { params });
    },

    getCarePlanById(id) {
        return api.get(`/animals/care-plans/${id}`);
    },

    createCarePlan(data) {
        return api.post('/animals/care-plans', data);
    },

    updateCarePlan(id, data) {
        return api.put(`/animals/care-plans/${id}`, data);
    },

    cloneCarePlan(id, data) {
        return api.post(`/animals/care-plans/${id}/clone`, data);
    },

    deleteCarePlan(id) {
        return api.delete(`/animals/care-plans/${id}`);
    },

    // ==================== CARE PLAN TASKS ====================

    getCarePlanTasks(planId) {
        return api.get(`/animals/care-plans/${planId}/tasks`);
    },

    addCarePlanTask(planId, data) {
        return api.post(`/animals/care-plans/${planId}/tasks`, data);
    },

    updateCarePlanTask(taskId, data) {
        return api.put(`/animals/care-plan-tasks/${taskId}`, data);
    },

    deleteCarePlanTask(taskId) {
        return api.delete(`/animals/care-plan-tasks/${taskId}`);
    },

    // ==================== CARE SCHEDULES ====================

    getCareSchedules(params = {}) {
        return api.get('/animals/care-schedules', { params });
    },

    getCareAlertsSummary(params = {}) {
        return api.get('/animals/care-schedules/alerts', { params });
    },

    cancelCareSchedule(scheduleId) {
        return api.delete(`/animals/care-schedules/${scheduleId}`);
    },

    // ==================== SCHEDULED TASKS ====================

    getScheduledTasks(params = {}) {
        return api.get('/animals/scheduled-tasks', { params });
    },

    getScheduledTasksCalendar(params = {}) {
        return api.get('/animals/scheduled-tasks/calendar', { params });
    },

    updateScheduledTaskStatuses() {
        return api.post('/animals/scheduled-tasks/update-statuses');
    },

    completeScheduledTask(taskId, data = {}) {
        return api.patch(`/animals/scheduled-tasks/${taskId}/complete`, data);
    },

    partiallyCompleteScheduledTask(taskId, data) {
        return api.patch(`/animals/scheduled-tasks/${taskId}/partial-complete`, data);
    },

    skipScheduledTask(taskId, data) {
        return api.patch(`/animals/scheduled-tasks/${taskId}/skip`, data);
    },

    // ==================== PRODUCTION ====================

    getProductionTypes(params = {}) {
        return api.get('/animals/production/types', { params });
    },

    getProductionTypeById(id) {
        return api.get(`/animals/production/types/${id}`);
    },

    createProductionType(data) {
        return api.post('/animals/production/types', data);
    },

    updateProductionType(id, data) {
        return api.put(`/animals/production/types/${id}`, data);
    },

    deleteProductionType(id) {
        return api.delete(`/animals/production/types/${id}`);
    },

    getProductionRecords(params = {}) {
        return api.get('/animals/production/records', { params });
    },

    getProductionRecordById(id) {
        return api.get(`/animals/production/records/${id}`);
    },

    createProductionRecord(data) {
        return api.post('/animals/production/records', data);
    },

    updateProductionRecord(id, data) {
        return api.put(`/animals/production/records/${id}`, data);
    },

    deleteProductionRecord(id) {
        return api.delete(`/animals/production/records/${id}`);
    },

    getProductionStatistics(params = {}) {
        return api.get('/animals/production/statistics', { params });
    },

    getDailyProductionSummary(params = {}) {
        return api.get('/animals/production/daily-summary', { params });
    },

    getProductionBySource(params = {}) {
        return api.get('/animals/production/by-source', { params });
    },

    // ==================== HEALTH RECORDS ====================

    getHealthRecords(params = {}) {
        return api.get('/animals/health-records', { params });
    },

    getHealthRecordById(id) {
        return api.get(`/animals/health-records/${id}`);
    },

    getHealthRecordsByAnimal(animalId) {
        return api.get(`/animals/individuals/${animalId}/health-records`);
    },

    getHealthRecordsByGroup(groupId) {
        return api.get(`/animals/groups/${groupId}/health-records`);
    },

    createHealthRecord(data) {
        return api.post('/animals/health-records', data);
    },

    updateHealthRecord(id, data) {
        return api.put(`/animals/health-records/${id}`, data);
    },

    deleteHealthRecord(id) {
        return api.delete(`/animals/health-records/${id}`);
    },

    getHealthStatistics(params = {}) {
        return api.get('/animals/health-records/statistics', { params });
    },

    getUpcomingFollowups(params = {}) {
        return api.get('/animals/health-records/upcoming-followups', { params });
    },

    getOverdueFollowups(params = {}) {
        return api.get('/animals/health-records/overdue-followups', { params });
    },

    // ==================== DISEASE & TREATMENT ====================

    getDiseaseTreatments(params = {}) {
        return api.get('/animals/diseases-treatments', { params });
    },

    getDiseaseTreatmentById(id) {
        return api.get(`/animals/diseases-treatments/${id}`);
    },

    getDiseaseTreatmentsByAnimal(animalId) {
        return api.get(`/animals/individuals/${animalId}/diseases-treatments`);
    },

    getDiseaseTreatmentsByGroup(groupId) {
        return api.get(`/animals/groups/${groupId}/diseases-treatments`);
    },

    createDiseaseTreatment(data) {
        return api.post('/animals/diseases-treatments', data);
    },

    updateDiseaseTreatment(id, data) {
        return api.put(`/animals/diseases-treatments/${id}`, data);
    },

    deleteDiseaseTreatment(id) {
        return api.delete(`/animals/diseases-treatments/${id}`);
    },

    getDiseaseStatistics(params = {}) {
        return api.get('/animals/diseases-treatments/statistics', { params });
    },

    getDiseaseOccurrenceSummary(params = {}) {
        return api.get('/animals/diseases-treatments/occurrence-summary', { params });
    },

    getOngoingTreatments(params = {}) {
        return api.get('/animals/diseases-treatments/ongoing', { params });
    },

    getChronicConditions(params = {}) {
        return api.get('/animals/diseases-treatments/chronic', { params });
    },

    getCriticalCases(params = {}) {
        return api.get('/animals/diseases-treatments/critical', { params });
    },

    // ==================== FEED RECORDS ====================

    getFeedRecords(params = {}) {
        return api.get('/animals/feed-records', { params });
    },

    getFeedRecordById(id) {
        return api.get(`/animals/feed-records/${id}`);
    },

    getFeedRecordsByAnimal(animalId) {
        return api.get(`/animals/individuals/${animalId}/feed-records`);
    },

    getFeedRecordsByGroup(groupId) {
        return api.get(`/animals/groups/${groupId}/feed-records`);
    },

    createFeedRecord(data) {
        return api.post('/animals/feed-records', data);
    },

    updateFeedRecord(id, data) {
        return api.put(`/animals/feed-records/${id}`, data);
    },

    deleteFeedRecord(id) {
        return api.delete(`/animals/feed-records/${id}`);
    },

    getFeedStatistics(params = {}) {
        return api.get('/animals/feed-records/statistics', { params });
    },

    getConsumptionByFeedType(params = {}) {
        return api.get('/animals/feed-records/by-feed-type', { params });
    },

    getDailyFeedConsumption(params = {}) {
        return api.get('/animals/feed-records/daily-consumption', { params });
    },

    getFeedCostByAnimalType(params = {}) {
        return api.get('/animals/feed-records/cost-by-type', { params });
    },

    getAverageDailyFeedCost(params = {}) {
        return api.get('/animals/feed-records/average-daily-cost', { params });
    },

    // ==================== BREEDING RECORDS ====================

    getBreedingRecords(params = {}) {
        return api.get('/animals/breeding-records', { params });
    },

    getBreedingRecordById(id) {
        return api.get(`/animals/breeding-records/${id}`);
    },

    getBreedingRecordsByAnimal(animalId) {
        return api.get(`/animals/individuals/${animalId}/breeding-records`);
    },

    createBreedingRecord(data) {
        return api.post('/animals/breeding-records', data);
    },

    updateBreedingRecord(id, data) {
        return api.put(`/animals/breeding-records/${id}`, data);
    },

    deleteBreedingRecord(id) {
        return api.delete(`/animals/breeding-records/${id}`);
    },

    getBreedingStatistics(params = {}) {
        return api.get('/animals/breeding-records/statistics', { params });
    },

    getExpectedDeliveries(params = {}) {
        return api.get('/animals/breeding-records/expected-deliveries', { params });
    },

    getOverdueDeliveries(params = {}) {
        return api.get('/animals/breeding-records/overdue-deliveries', { params });
    },

    getBreedingPerformance(animalId, params = {}) {
        return api.get(`/animals/individuals/${animalId}/breeding-performance`, { params });
    },

    getBreedingSuccessRateByType(params = {}) {
        return api.get('/animals/breeding-records/success-rate-by-type', { params });
    },

    // ==================== LIVESTOCK SALES ====================

    getAnimalSales(params = {}) {
        return api.get('/animals/sales', { params });
    },

    getAnimalSaleById(id) {
        return api.get(`/animals/sales/${id}`);
    },

    createAnimalSale(data) {
        return api.post('/animals/sales', data);
    },

    updateAnimalSale(id, data) {
        return api.put(`/animals/sales/${id}`, data);
    },

    deleteAnimalSale(id) {
        return api.delete(`/animals/sales/${id}`);
    },

    getAnimalSalesStatistics(params = {}) {
        return api.get('/animals/sales/statistics', { params });
    },

    getSalesByAnimalType(params = {}) {
        return api.get('/animals/sales/by-animal-type', { params });
    },

    getMonthlySales(params = {}) {
        return api.get('/animals/sales/monthly', { params });
    },

    getTopCustomers(params = {}) {
        return api.get('/animals/sales/top-customers', { params });
    },

    getRecentAnimalSales(params = {}) {
        return api.get('/animals/sales/recent', { params });
    },

    getPendingPayments(params = {}) {
        return api.get('/animals/sales/pending-payments', { params });
    },

    // Incubation records
    getIncubationRecords(params = {}) {
        return api.get('/animals/incubation-records', { params });
    },

    getIncubationRecordById(id) {
        return api.get(`/animals/incubation-records/${id}`);
    },

    getIncubationRecordsByGroup(groupId, params = {}) {
        return api.get(`/animals/groups/${groupId}/incubation-records`, { params });
    },

    createIncubationRecord(data) {
        return api.post('/animals/incubation-records', data);
    },

    updateIncubationRecord(id, data) {
        return api.put(`/animals/incubation-records/${id}`, data);
    },

    deleteIncubationRecord(id) {
        return api.delete(`/animals/incubation-records/${id}`);
    },

    getIncubationStatistics(params = {}) {
        return api.get('/animals/incubation-records/statistics', { params });
    },

    getActiveIncubations() {
        return api.get('/animals/incubation-records/active');
    },

    getDueToHatch(params = {}) {
        return api.get('/animals/incubation-records/due-to-hatch', { params });
    },

    getOverdueHatching() {
        return api.get('/animals/incubation-records/overdue');
    },

    getHatchRateByBreed(params = {}) {
        return api.get('/animals/incubation-records/hatch-rate-by-breed', { params });
    },

    getMonthlyIncubationSummary(params = {}) {
        return api.get('/animals/incubation-records/monthly-summary', { params });
    }
};

export default animalService;
