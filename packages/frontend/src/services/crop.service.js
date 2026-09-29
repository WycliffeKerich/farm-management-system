import api from './api';

/**
 * Crop management API service
 */
const cropService = {
    // ==================== CROP TYPES ====================

    getCropTypes() {
        return api.get('/crops/crop-types');
    },

    getCropTypeById(id) {
        return api.get(`/crops/crop-types/${id}`);
    },

    getCropTypeCategories() {
        return api.get('/crops/crop-types/categories');
    },

    createCropType(data) {
        return api.post('/crops/crop-types', data);
    },

    updateCropType(id, data) {
        return api.put(`/crops/crop-types/${id}`, data);
    },

    deleteCropType(id) {
        return api.delete(`/crops/crop-types/${id}`);
    },

    // ==================== CROP VARIETIES ====================

    getVarieties(cropTypeId = null) {
        const params = cropTypeId ? { crop_type_id: cropTypeId } : {};
        return api.get('/crops/varieties', { params });
    },

    getVarietyById(id) {
        return api.get(`/crops/varieties/${id}`);
    },

    createVariety(data) {
        return api.post('/crops/varieties', data);
    },

    updateVariety(id, data) {
        return api.put(`/crops/varieties/${id}`, data);
    },

    deleteVariety(id) {
        return api.delete(`/crops/varieties/${id}`);
    },

    // ==================== GROWING LOCATIONS ====================

    getLocations(activeOnly = false) {
        const params = activeOnly ? { active_only: 'true' } : {};
        return api.get('/crops/locations', { params });
    },

    getLocationById(id) {
        return api.get(`/crops/locations/${id}`);
    },

    getLocationTypes() {
        return api.get('/crops/locations/types');
    },

    createLocation(data) {
        return api.post('/crops/locations', data);
    },

    updateLocation(id, data) {
        return api.put(`/crops/locations/${id}`, data);
    },

    deleteLocation(id) {
        return api.delete(`/crops/locations/${id}`);
    },

    // ==================== CROP BATCHES ====================

    getBatches(params = {}) {
        return api.get('/crops/batches', { params });
    },

    getBatchById(id) {
        return api.get(`/crops/batches/${id}`);
    },

    getBatchStatistics() {
        return api.get('/crops/batches/statistics');
    },

    createBatch(data) {
        return api.post('/crops/batches', data);
    },

    updateBatch(id, data) {
        return api.put(`/crops/batches/${id}`, data);
    },

    updateBatchStatus(id, status) {
        return api.patch(`/crops/batches/${id}/status`, { status });
    },

    deleteBatch(id) {
        return api.delete(`/crops/batches/${id}`);
    },

    // ==================== GROWTH OBSERVATIONS ====================

    getBatchObservations(batchId) {
        return api.get(`/crops/batches/${batchId}/observations`);
    },

    addObservation(batchId, data) {
        return api.post(`/crops/batches/${batchId}/observations`, data);
    },

    deleteObservation(id) {
        return api.delete(`/crops/observations/${id}`);
    },

    // ==================== HARVESTS ====================

    getHarvests(params = {}) {
        return api.get('/crops/harvests', { params });
    },

    getHarvestSummary(startDate, endDate) {
        return api.get('/crops/harvests/summary', {
            params: { start_date: startDate, end_date: endDate }
        });
    },

    getBatchHarvests(batchId) {
        return api.get(`/crops/batches/${batchId}/harvests`);
    },

    recordHarvest(batchId, data) {
        return api.post(`/crops/batches/${batchId}/harvests`, data);
    },

    deleteHarvest(id) {
        return api.delete(`/crops/harvests/${id}`);
    },

    // ==================== INPUT APPLICATIONS ====================

    getInputApplications(params = {}) {
        return api.get('/crops/input-applications', { params });
    },

    getBatchInputApplications(batchId) {
        return api.get(`/crops/batches/${batchId}/input-applications`);
    },

    recordInputApplication(batchId, data) {
        return api.post(`/crops/batches/${batchId}/input-applications`, data);
    },

    deleteInputApplication(id) {
        return api.delete(`/crops/input-applications/${id}`);
    },

    // ==================== PEST & DISEASE ====================

    getPestsDiseases(params = {}) {
        return api.get('/crops/pests-diseases', { params });
    },

    getPestDiseaseStatistics() {
        return api.get('/crops/pests-diseases/statistics');
    },

    getActiveAlerts(limit = 10) {
        return api.get('/crops/pests-diseases/alerts', { params: { limit } });
    },

    getBatchPestsDiseases(batchId) {
        return api.get(`/crops/batches/${batchId}/pests-diseases`);
    },

    reportPestDisease(batchId, data) {
        return api.post(`/crops/batches/${batchId}/pests-diseases`, data);
    },

    updatePestDiseaseStatus(id, status, controlMeasures) {
        return api.patch(`/crops/pests-diseases/${id}`, {
            status,
            control_measures: controlMeasures
        });
    },

    deletePestDisease(id) {
        return api.delete(`/crops/pests-diseases/${id}`);
    },

    // ==================== CARE PLANS ====================

    getCarePlans(params = {}) {
        return api.get('/crops/care-plans', { params });
    },

    getCarePlanTemplates() {
        return api.get('/crops/care-plans', { params: { templates_only: 'true' } });
    },

    getCarePlansByVariety(varietyId) {
        return api.get('/crops/care-plans', { params: { variety_id: varietyId } });
    },

    getCarePlanById(id) {
        return api.get(`/crops/care-plans/${id}`);
    },

    createCarePlan(data) {
        return api.post('/crops/care-plans', data);
    },

    updateCarePlan(id, data) {
        return api.put(`/crops/care-plans/${id}`, data);
    },

    cloneCarePlan(id, name) {
        return api.post(`/crops/care-plans/${id}/clone`, { name });
    },

    deleteCarePlan(id) {
        return api.delete(`/crops/care-plans/${id}`);
    },

    // ==================== CARE PLAN TASKS ====================

    getCarePlanTasks(planId) {
        return api.get(`/crops/care-plans/${planId}/tasks`);
    },

    addCarePlanTask(planId, data) {
        return api.post(`/crops/care-plans/${planId}/tasks`, data);
    },

    updateCarePlanTask(taskId, data) {
        return api.put(`/crops/care-plan-tasks/${taskId}`, data);
    },

    deleteCarePlanTask(taskId) {
        return api.delete(`/crops/care-plan-tasks/${taskId}`);
    },

    // ==================== BATCH CARE SCHEDULES ====================

    getBatchCareSchedule(batchId) {
        return api.get(`/crops/batches/${batchId}/care-schedule`);
    },

    applyCarePlanToBatch(batchId, planId) {
        return api.post(`/crops/batches/${batchId}/care-schedule`, { plan_id: planId });
    },

    cancelBatchCareSchedule(batchId) {
        return api.delete(`/crops/batches/${batchId}/care-schedule`);
    },

    getAllBatchSchedules(params = {}) {
        return api.get('/crops/care-schedules', { params });
    },

    getCareAlertsSummary(daysAhead = 7) {
        return api.get('/crops/care-schedules/alerts', { params: { days_ahead: daysAhead } });
    },

    // ==================== SCHEDULED TASKS ====================

    getScheduledTasks(params = {}) {
        return api.get('/crops/scheduled-tasks', { params });
    },

    getUpcomingScheduledTasks(daysAhead = 7, filters = {}) {
        return api.get('/crops/scheduled-tasks', { params: { days_ahead: daysAhead, ...filters } });
    },

    getOverdueScheduledTasks(filters = {}) {
        return api.get('/crops/scheduled-tasks', { params: { overdue_only: 'true', ...filters } });
    },

    getScheduledTasksByDateRange(startDate, endDate, filters = {}) {
        return api.get('/crops/scheduled-tasks', {
            params: { start_date: startDate, end_date: endDate, ...filters }
        });
    },

    getScheduledTasksCalendar(year, month, filters = {}) {
        return api.get('/crops/scheduled-tasks/calendar', {
            params: { year, month, ...filters }
        });
    },

    completeScheduledTask(taskId, notes = null) {
        return api.patch(`/crops/scheduled-tasks/${taskId}/complete`, { notes });
    },

    skipScheduledTask(taskId, reason) {
        return api.patch(`/crops/scheduled-tasks/${taskId}/skip`, { reason });
    },

    completeScheduledTaskWithInput(taskId, inputData) {
        return api.post(`/crops/scheduled-tasks/${taskId}/complete-with-input`, inputData);
    },

    updateScheduledTaskStatuses() {
        return api.post('/crops/scheduled-tasks/update-statuses');
    }
};

export default cropService;
