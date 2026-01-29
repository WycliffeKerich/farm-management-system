const cropTypeRepository = require('../repositories/crop-type.repository');
const cropVarietyRepository = require('../repositories/crop-variety.repository');
const growingLocationRepository = require('../repositories/growing-location.repository');
const cropBatchRepository = require('../repositories/crop-batch.repository');
const growthObservationRepository = require('../repositories/growth-observation.repository');
const harvestRepository = require('../repositories/harvest.repository');
const cropInputApplicationRepository = require('../repositories/crop-input-application.repository');
const cropPestDiseaseRepository = require('../repositories/crop-pest-disease.repository');
const carePlanRepository = require('../repositories/care-plan.repository');
const carePlanTaskRepository = require('../repositories/care-plan-task.repository');
const batchCareScheduleRepository = require('../repositories/batch-care-schedule.repository');
const scheduledBatchTaskRepository = require('../repositories/scheduled-batch-task.repository');

/**
 * Service for crop management operations
 */
class CropService {
  // ==================== CROP TYPES ====================

  /**
   * Get all crop types
   * @returns {Promise<Array>}
   */
  async getAllCropTypes() {
    return await cropTypeRepository.findAllWithVarieties();
  }

  /**
   * Get crop type by ID
   * @param {number} id - Crop type ID
   * @returns {Promise<Object>}
   */
  async getCropTypeById(id) {
    const cropType = await cropTypeRepository.findById(id);
    if (!cropType) {
      throw new Error('Crop type not found');
    }
    return cropType;
  }

  /**
   * Create a new crop type
   * @param {Object} data - Crop type data
   * @returns {Promise<Object>}
   */
  async createCropType(data) {
    const existing = await cropTypeRepository.findByName(data.name);
    if (existing) {
      throw new Error('Crop type with this name already exists');
    }
    return await cropTypeRepository.create(data);
  }

  /**
   * Update a crop type
   * @param {number} id - Crop type ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateCropType(id, data) {
    const cropType = await cropTypeRepository.findById(id);
    if (!cropType) {
      throw new Error('Crop type not found');
    }

    if (data.name && data.name !== cropType.name) {
      const existing = await cropTypeRepository.findByName(data.name);
      if (existing) {
        throw new Error('Crop type with this name already exists');
      }
    }

    return await cropTypeRepository.update(id, data);
  }

  /**
   * Delete a crop type
   * @param {number} id - Crop type ID
   * @returns {Promise<void>}
   */
  async deleteCropType(id) {
    const cropType = await cropTypeRepository.findById(id);
    if (!cropType) {
      throw new Error('Crop type not found');
    }
    await cropTypeRepository.delete(id);
  }

  /**
   * Get crop type categories
   * @returns {Promise<Array>}
   */
  async getCropTypeCategories() {
    return await cropTypeRepository.getCategories();
  }

  // ==================== CROP VARIETIES ====================

  /**
   * Get all crop varieties
   * @returns {Promise<Array>}
   */
  async getAllVarieties() {
    return await cropVarietyRepository.findAllWithCropType();
  }

  /**
   * Get varieties by crop type
   * @param {number} cropTypeId - Crop type ID
   * @returns {Promise<Array>}
   */
  async getVarietiesByCropType(cropTypeId) {
    return await cropVarietyRepository.findByCropTypeId(cropTypeId);
  }

  /**
   * Get variety by ID
   * @param {number} id - Variety ID
   * @returns {Promise<Object>}
   */
  async getVarietyById(id) {
    const variety = await cropVarietyRepository.findByIdWithDetails(id);
    if (!variety) {
      throw new Error('Crop variety not found');
    }
    return variety;
  }

  /**
   * Create a new variety
   * @param {Object} data - Variety data
   * @returns {Promise<Object>}
   */
  async createVariety(data) {
    const cropType = await cropTypeRepository.findById(data.crop_type_id);
    if (!cropType) {
      throw new Error('Crop type not found');
    }

    const existing = await cropVarietyRepository.findByNameAndCropType(data.name, data.crop_type_id);
    if (existing) {
      throw new Error('Variety with this name already exists for this crop type');
    }

    return await cropVarietyRepository.create(data);
  }

  /**
   * Update a variety
   * @param {number} id - Variety ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateVariety(id, data) {
    const variety = await cropVarietyRepository.findById(id);
    if (!variety) {
      throw new Error('Crop variety not found');
    }

    if (data.name && (data.name !== variety.name || data.crop_type_id !== variety.crop_type_id)) {
      const existing = await cropVarietyRepository.findByNameAndCropType(
        data.name,
        data.crop_type_id || variety.crop_type_id
      );
      if (existing && existing.id !== id) {
        throw new Error('Variety with this name already exists for this crop type');
      }
    }

    return await cropVarietyRepository.update(id, data);
  }

  /**
   * Delete a variety
   * @param {number} id - Variety ID
   * @returns {Promise<void>}
   */
  async deleteVariety(id) {
    const variety = await cropVarietyRepository.findById(id);
    if (!variety) {
      throw new Error('Crop variety not found');
    }
    await cropVarietyRepository.delete(id);
  }

  // ==================== GROWING LOCATIONS ====================

  /**
   * Get all growing locations
   * @returns {Promise<Array>}
   */
  async getAllLocations() {
    return await growingLocationRepository.findAllWithBatchCounts();
  }

  /**
   * Get active locations
   * @returns {Promise<Array>}
   */
  async getActiveLocations() {
    return await growingLocationRepository.findAllActive();
  }

  /**
   * Get location by ID
   * @param {number} id - Location ID
   * @returns {Promise<Object>}
   */
  async getLocationById(id) {
    const location = await growingLocationRepository.findById(id);
    if (!location) {
      throw new Error('Growing location not found');
    }
    return location;
  }

  /**
   * Create a new location
   * @param {Object} data - Location data
   * @returns {Promise<Object>}
   */
  async createLocation(data) {
    const existing = await growingLocationRepository.findByName(data.name);
    if (existing) {
      throw new Error('Location with this name already exists');
    }
    return await growingLocationRepository.create(data);
  }

  /**
   * Update a location
   * @param {number} id - Location ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateLocation(id, data) {
    const location = await growingLocationRepository.findById(id);
    if (!location) {
      throw new Error('Growing location not found');
    }

    if (data.name && data.name !== location.name) {
      const existing = await growingLocationRepository.findByName(data.name);
      if (existing) {
        throw new Error('Location with this name already exists');
      }
    }

    return await growingLocationRepository.update(id, data);
  }

  /**
   * Delete a location
   * @param {number} id - Location ID
   * @returns {Promise<void>}
   */
  async deleteLocation(id) {
    const location = await growingLocationRepository.findById(id);
    if (!location) {
      throw new Error('Growing location not found');
    }

    // Check if there are active batches
    const activeBatches = await cropBatchRepository.findActiveByLocation(id);
    if (activeBatches.length > 0) {
      throw new Error('Cannot delete location with active crop batches');
    }

    await growingLocationRepository.delete(id);
  }

  /**
   * Get location types
   * @returns {Promise<Array>}
   */
  async getLocationTypes() {
    return await growingLocationRepository.getTypes();
  }

  // ==================== CROP BATCHES ====================

  /**
   * Get all batches with optional filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllBatches(filters = {}) {
    return await cropBatchRepository.findAllWithDetails(filters);
  }

  /**
   * Get paginated batches
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>}
   */
  async getPaginatedBatches(page, limit, filters) {
    return await cropBatchRepository.paginateWithDetails(page, limit, filters);
  }

  /**
   * Get batch by ID with full details
   * @param {number} id - Batch ID
   * @returns {Promise<Object>}
   */
  async getBatchById(id) {
    const batch = await cropBatchRepository.findByIdWithDetails(id);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    // Get related data
    const [observations, harvests, inputApplications, pestsDiseases] = await Promise.all([
      growthObservationRepository.findByBatchId(id),
      harvestRepository.findByBatchId(id),
      cropInputApplicationRepository.findByBatchId(id),
      cropPestDiseaseRepository.findByBatchId(id),
    ]);

    return {
      ...batch,
      observations,
      harvests,
      input_applications: inputApplications,
      pests_diseases: pestsDiseases,
    };
  }

  /**
   * Create a new batch
   * @param {Object} data - Batch data
   * @param {number} userId - User ID creating the batch
   * @returns {Promise<Object>}
   */
  async createBatch(data, userId) {
    const variety = await cropVarietyRepository.findByIdWithDetails(data.crop_variety_id);
    if (!variety) {
      throw new Error('Crop variety not found');
    }

    if (data.location_id) {
      const location = await growingLocationRepository.findById(data.location_id);
      if (!location) {
        throw new Error('Growing location not found');
      }
    }

    // Generate batch code
    const batchCode = await cropBatchRepository.generateBatchCode(variety.crop_type_name);

    // Calculate expected harvest date
    const growthDays = variety.variety_growth_days || variety.crop_type_growth_days;
    let expectedHarvestDate = null;
    if (growthDays && data.planting_date) {
      const plantingDate = new Date(data.planting_date);
      expectedHarvestDate = new Date(plantingDate.setDate(plantingDate.getDate() + growthDays));
    }

    const batchData = {
      ...data,
      batch_code: batchCode,
      expected_harvest_date: expectedHarvestDate,
      status: data.status || 'planted',
      created_by: userId,
    };

    return await cropBatchRepository.create(batchData);
  }

  /**
   * Update a batch
   * @param {number} id - Batch ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateBatch(id, data) {
    const batch = await cropBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    if (data.crop_variety_id && data.crop_variety_id !== batch.crop_variety_id) {
      const variety = await cropVarietyRepository.findById(data.crop_variety_id);
      if (!variety) {
        throw new Error('Crop variety not found');
      }
    }

    if (data.location_id && data.location_id !== batch.location_id) {
      const location = await growingLocationRepository.findById(data.location_id);
      if (!location) {
        throw new Error('Growing location not found');
      }
    }

    return await cropBatchRepository.update(id, data);
  }

  /**
   * Update batch status
   * @param {number} id - Batch ID
   * @param {string} status - New status
   * @returns {Promise<Object>}
   */
  async updateBatchStatus(id, status) {
    const batch = await cropBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Crop batch not found');
    }
    return await cropBatchRepository.updateStatus(id, status);
  }

  /**
   * Delete a batch
   * @param {number} id - Batch ID
   * @returns {Promise<void>}
   */
  async deleteBatch(id) {
    const batch = await cropBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Crop batch not found');
    }
    await cropBatchRepository.delete(id);
  }

  /**
   * Get batch statistics
   * @returns {Promise<Object>}
   */
  async getBatchStatistics() {
    return await cropBatchRepository.getStatistics();
  }

  // ==================== GROWTH OBSERVATIONS ====================

  /**
   * Add growth observation to a batch
   * @param {number} batchId - Batch ID
   * @param {Object} data - Observation data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async addObservation(batchId, data, userId) {
    const batch = await cropBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    const observationData = {
      ...data,
      batch_id: batchId,
      recorded_by: userId,
    };

    return await growthObservationRepository.create(observationData);
  }

  /**
   * Get observations for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getBatchObservations(batchId) {
    return await growthObservationRepository.findByBatchId(batchId);
  }

  /**
   * Delete an observation
   * @param {number} id - Observation ID
   * @returns {Promise<void>}
   */
  async deleteObservation(id) {
    const observation = await growthObservationRepository.findById(id);
    if (!observation) {
      throw new Error('Observation not found');
    }
    await growthObservationRepository.delete(id);
  }

  // ==================== HARVESTS ====================

  /**
   * Record a harvest
   * @param {number} batchId - Batch ID
   * @param {Object} data - Harvest data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async recordHarvest(batchId, data, userId) {
    const batch = await cropBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    const harvestData = {
      ...data,
      batch_id: batchId,
      recorded_by: userId,
    };

    const harvest = await harvestRepository.create(harvestData);

    // Update batch status to 'harvesting' if it's still 'growing'
    if (batch.status === 'growing' || batch.status === 'planted') {
      await cropBatchRepository.updateStatus(batchId, 'harvesting');
    }

    return harvest;
  }

  /**
   * Get harvests for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getBatchHarvests(batchId) {
    return await harvestRepository.findByBatchId(batchId);
  }

  /**
   * Get all harvests with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllHarvests(filters = {}) {
    return await harvestRepository.findAllWithDetails(filters);
  }

  /**
   * Get harvest summary by crop type
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>}
   */
  async getHarvestSummary(startDate, endDate) {
    return await harvestRepository.getSummaryByCropType(startDate, endDate);
  }

  /**
   * Delete a harvest record
   * @param {number} id - Harvest ID
   * @returns {Promise<void>}
   */
  async deleteHarvest(id) {
    const harvest = await harvestRepository.findById(id);
    if (!harvest) {
      throw new Error('Harvest record not found');
    }
    await harvestRepository.delete(id);
  }

  // ==================== INPUT APPLICATIONS ====================

  /**
   * Record an input application
   * @param {number} batchId - Batch ID
   * @param {Object} data - Application data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async recordInputApplication(batchId, data, userId) {
    const batch = await cropBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    const applicationData = {
      ...data,
      batch_id: batchId,
      recorded_by: userId,
    };

    return await cropInputApplicationRepository.create(applicationData);
  }

  /**
   * Get input applications for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getBatchInputApplications(batchId) {
    return await cropInputApplicationRepository.findByBatchId(batchId);
  }

  /**
   * Get all input applications with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllInputApplications(filters = {}) {
    return await cropInputApplicationRepository.findAllWithDetails(filters);
  }

  /**
   * Delete an input application
   * @param {number} id - Application ID
   * @returns {Promise<void>}
   */
  async deleteInputApplication(id) {
    const application = await cropInputApplicationRepository.findById(id);
    if (!application) {
      throw new Error('Input application not found');
    }
    await cropInputApplicationRepository.delete(id);
  }

  // ==================== PEST & DISEASE ====================

  /**
   * Report a pest or disease incident
   * @param {number} batchId - Batch ID
   * @param {Object} data - Incident data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async reportPestDisease(batchId, data, userId) {
    const batch = await cropBatchRepository.findById(batchId);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    const incidentData = {
      ...data,
      batch_id: batchId,
      recorded_by: userId,
      status: data.status || 'active',
    };

    return await cropPestDiseaseRepository.create(incidentData);
  }

  /**
   * Get pest/disease records for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getBatchPestsDiseases(batchId) {
    return await cropPestDiseaseRepository.findByBatchId(batchId);
  }

  /**
   * Get all pest/disease records with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllPestsDiseases(filters = {}) {
    return await cropPestDiseaseRepository.findAllWithDetails(filters);
  }

  /**
   * Update pest/disease status
   * @param {number} id - Record ID
   * @param {string} status - New status
   * @param {string} controlMeasures - Control measures
   * @returns {Promise<Object>}
   */
  async updatePestDiseaseStatus(id, status, controlMeasures) {
    const record = await cropPestDiseaseRepository.findById(id);
    if (!record) {
      throw new Error('Pest/disease record not found');
    }
    return await cropPestDiseaseRepository.updateStatus(id, status, controlMeasures);
  }

  /**
   * Get pest/disease statistics
   * @returns {Promise<Object>}
   */
  async getPestDiseaseStatistics() {
    return await cropPestDiseaseRepository.getStatistics();
  }

  /**
   * Get active pest/disease alerts
   * @param {number} limit - Number of records
   * @returns {Promise<Array>}
   */
  async getActiveAlerts(limit = 10) {
    return await cropPestDiseaseRepository.getActiveAlerts(limit);
  }

  /**
   * Delete a pest/disease record
   * @param {number} id - Record ID
   * @returns {Promise<void>}
   */
  async deletePestDisease(id) {
    const record = await cropPestDiseaseRepository.findById(id);
    if (!record) {
      throw new Error('Pest/disease record not found');
    }
    await cropPestDiseaseRepository.delete(id);
  }

  // ==================== CARE PLANS ====================

  /**
   * Get all care plans
   * @returns {Promise<Array>}
   */
  async getAllCarePlans() {
    return await carePlanRepository.findAllWithStats();
  }

  /**
   * Get care plan templates
   * @returns {Promise<Array>}
   */
  async getCarePlanTemplates() {
    return await carePlanRepository.findAllTemplates();
  }

  /**
   * Get care plans by variety
   * @param {number} varietyId - Variety ID
   * @returns {Promise<Array>}
   */
  async getCarePlansByVariety(varietyId) {
    return await carePlanRepository.findByVarietyId(varietyId);
  }

  /**
   * Get care plan by ID with tasks
   * @param {number} id - Plan ID
   * @returns {Promise<Object>}
   */
  async getCarePlanById(id) {
    const plan = await carePlanRepository.findWithTasks(id);
    if (!plan) {
      throw new Error('Care plan not found');
    }
    return plan;
  }

  /**
   * Create a new care plan
   * @param {Object} data - Plan data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async createCarePlan(data, userId) {
    if (data.crop_variety_id) {
      const variety = await cropVarietyRepository.findById(data.crop_variety_id);
      if (!variety) {
        throw new Error('Crop variety not found');
      }
    }

    const planCode = await carePlanRepository.generatePlanCode(data.name?.slice(0, 3) || 'CP');

    const planData = {
      ...data,
      plan_code: planCode,
      created_by: userId,
    };

    return await carePlanRepository.create(planData);
  }

  /**
   * Update a care plan
   * @param {number} id - Plan ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateCarePlan(id, data) {
    const plan = await carePlanRepository.findById(id);
    if (!plan) {
      throw new Error('Care plan not found');
    }

    if (data.crop_variety_id && data.crop_variety_id !== plan.crop_variety_id) {
      const variety = await cropVarietyRepository.findById(data.crop_variety_id);
      if (!variety) {
        throw new Error('Crop variety not found');
      }
    }

    return await carePlanRepository.update(id, data);
  }

  /**
   * Clone a care plan
   * @param {number} planId - Source plan ID
   * @param {string} newName - Name for cloned plan
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async cloneCarePlan(planId, newName, userId) {
    return await carePlanRepository.clonePlan(planId, newName, userId);
  }

  /**
   * Delete a care plan
   * @param {number} id - Plan ID
   * @returns {Promise<void>}
   */
  async deleteCarePlan(id) {
    const plan = await carePlanRepository.findById(id);
    if (!plan) {
      throw new Error('Care plan not found');
    }
    await carePlanRepository.softDelete(id);
  }

  // ==================== CARE PLAN TASKS ====================

  /**
   * Get tasks for a care plan
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async getCarePlanTasks(planId) {
    return await carePlanTaskRepository.findByPlanId(planId);
  }

  /**
   * Add a task to a care plan
   * @param {number} planId - Plan ID
   * @param {Object} data - Task data
   * @returns {Promise<Object>}
   */
  async addCarePlanTask(planId, data) {
    const plan = await carePlanRepository.findById(planId);
    if (!plan) {
      throw new Error('Care plan not found');
    }

    const sequence = await carePlanTaskRepository.getNextSequence(planId);

    const taskData = {
      ...data,
      plan_id: planId,
      task_sequence: data.task_sequence || sequence,
    };

    return await carePlanTaskRepository.create(taskData);
  }

  /**
   * Update a care plan task
   * @param {number} taskId - Task ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateCarePlanTask(taskId, data) {
    const task = await carePlanTaskRepository.findById(taskId);
    if (!task) {
      throw new Error('Care plan task not found');
    }
    return await carePlanTaskRepository.update(taskId, data);
  }

  /**
   * Delete a care plan task
   * @param {number} taskId - Task ID
   * @returns {Promise<void>}
   */
  async deleteCarePlanTask(taskId) {
    const task = await carePlanTaskRepository.findById(taskId);
    if (!task) {
      throw new Error('Care plan task not found');
    }
    await carePlanTaskRepository.softDelete(taskId);
    await carePlanTaskRepository.reorderTasks(task.plan_id);
  }

  // ==================== BATCH CARE SCHEDULES ====================

  /**
   * Apply a care plan to a batch
   * @param {number} batchId - Batch ID
   * @param {number} planId - Care plan ID
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async applyCarePlanToBatch(batchId, planId, userId) {
    const batch = await cropBatchRepository.findByIdWithDetails(batchId);
    if (!batch) {
      throw new Error('Crop batch not found');
    }

    const plan = await carePlanRepository.findWithTasks(planId);
    if (!plan) {
      throw new Error('Care plan not found');
    }

    if (!batch.planting_date) {
      throw new Error('Batch must have a planting date to apply a care plan');
    }

    // Deactivate any existing schedule
    await batchCareScheduleRepository.deactivateForBatch(batchId);

    // Create new schedule
    const schedule = await batchCareScheduleRepository.create({
      batch_id: batchId,
      plan_id: planId,
      applied_by: userId,
      status: 'active',
    });

    // Generate scheduled tasks
    const plantingDate = new Date(batch.planting_date);
    const harvestDate = batch.expected_harvest_date ? new Date(batch.expected_harvest_date) : null;
    const totalDays = plan.total_duration_days || (harvestDate ? Math.ceil((harvestDate - plantingDate) / (1000 * 60 * 60 * 24)) : 90);

    for (const planTask of plan.tasks) {
      await this._generateScheduledTasks(schedule.id, batchId, planTask, plantingDate, totalDays);
    }

    // Update statuses based on current date
    await scheduledBatchTaskRepository.updateStatuses();

    return await this.getBatchCareSchedule(batchId);
  }

  /**
   * Generate scheduled tasks from a plan task (handles recurring tasks)
   * @private
   */
  async _generateScheduledTasks(scheduleId, batchId, planTask, plantingDate, totalDays) {
    const createTask = async (dayOffset, recurringSeq = null) => {
      const plannedDate = new Date(plantingDate);
      plannedDate.setDate(plannedDate.getDate() + dayOffset);

      const dueStart = new Date(plannedDate);
      dueStart.setDate(dueStart.getDate() - (planTask.tolerance_days_before || 0));

      const dueEnd = new Date(plannedDate);
      dueEnd.setDate(dueEnd.getDate() + (planTask.tolerance_days_after || 2));

      await scheduledBatchTaskRepository.create({
        batch_id: batchId,
        schedule_id: scheduleId,
        plan_task_id: planTask.id,
        planned_date: plannedDate,
        due_date_start: dueStart,
        due_date_end: dueEnd,
        task_name: planTask.task_name,
        description: planTask.description,
        priority: planTask.priority,
        estimated_hours: planTask.estimated_hours,
        input_type: planTask.input_type,
        input_product_name: planTask.input_product_name,
        input_quantity: planTask.input_quantity,
        input_unit: planTask.input_unit,
        input_application_method: planTask.input_application_method,
        is_recurring_instance: recurringSeq !== null,
        recurring_sequence: recurringSeq,
        status: 'pending',
      });
    };

    // Create the initial task
    await createTask(planTask.days_from_planting, planTask.is_recurring ? 1 : null);

    // Handle recurring tasks
    if (planTask.is_recurring && planTask.recurrence_interval_days) {
      const startDay = planTask.recurrence_start_days !== null
        ? planTask.recurrence_start_days
        : planTask.days_from_planting;
      const endDay = planTask.recurrence_end_days !== null
        ? planTask.recurrence_end_days
        : totalDays;

      let currentDay = startDay + planTask.recurrence_interval_days;
      let sequence = 2;

      while (currentDay <= endDay) {
        await createTask(currentDay, sequence);
        currentDay += planTask.recurrence_interval_days;
        sequence++;
      }
    }
  }

  /**
   * Get care schedule for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Object>}
   */
  async getBatchCareSchedule(batchId) {
    const schedule = await batchCareScheduleRepository.findActiveByBatchId(batchId);
    if (!schedule) {
      return null;
    }

    const [tasks, progress] = await Promise.all([
      scheduledBatchTaskRepository.findByScheduleId(schedule.id),
      batchCareScheduleRepository.getProgress(schedule.id),
    ]);

    return {
      ...schedule,
      tasks,
      progress,
    };
  }

  /**
   * Get all batch schedules with progress
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllBatchSchedules(filters = {}) {
    return await batchCareScheduleRepository.findAllWithProgress(filters);
  }

  /**
   * Cancel a batch care schedule
   * @param {number} batchId - Batch ID
   * @returns {Promise<void>}
   */
  async cancelBatchCareSchedule(batchId) {
    const schedule = await batchCareScheduleRepository.findActiveByBatchId(batchId);
    if (!schedule) {
      throw new Error('No active care schedule found for this batch');
    }

    await batchCareScheduleRepository.update(schedule.id, { status: 'cancelled' });
  }

  // ==================== SCHEDULED TASKS ====================

  /**
   * Get scheduled tasks for a batch
   * @param {number} batchId - Batch ID
   * @returns {Promise<Array>}
   */
  async getScheduledTasksForBatch(batchId) {
    return await scheduledBatchTaskRepository.findByBatchId(batchId);
  }

  /**
   * Get upcoming scheduled tasks
   * @param {number} daysAhead - Days to look ahead
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getUpcomingScheduledTasks(daysAhead = 7, filters = {}) {
    return await scheduledBatchTaskRepository.findUpcoming(daysAhead, filters);
  }

  /**
   * Get overdue scheduled tasks
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getOverdueScheduledTasks(filters = {}) {
    return await scheduledBatchTaskRepository.findOverdue(filters);
  }

  /**
   * Get scheduled tasks by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getScheduledTasksByDateRange(startDate, endDate, filters = {}) {
    return await scheduledBatchTaskRepository.findByDateRange(startDate, endDate, filters);
  }

  /**
   * Mark a scheduled task as completed
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} notes - Completion notes
   * @returns {Promise<Object>}
   */
  async completeScheduledTask(taskId, userId, notes = null) {
    const task = await scheduledBatchTaskRepository.findById(taskId);
    if (!task) {
      throw new Error('Scheduled task not found');
    }

    if (task.status === 'completed') {
      throw new Error('Task is already completed');
    }

    return await scheduledBatchTaskRepository.markCompleted(taskId, userId, notes);
  }

  /**
   * Skip a scheduled task
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>}
   */
  async skipScheduledTask(taskId, userId, reason) {
    const task = await scheduledBatchTaskRepository.findById(taskId);
    if (!task) {
      throw new Error('Scheduled task not found');
    }

    if (task.status === 'completed' || task.status === 'skipped') {
      throw new Error('Task is already completed or skipped');
    }

    return await scheduledBatchTaskRepository.markSkipped(taskId, userId, reason);
  }

  /**
   * Complete scheduled task and record input application
   * @param {number} taskId - Scheduled task ID
   * @param {Object} inputData - Input application data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async completeScheduledTaskWithInput(taskId, inputData, userId) {
    const task = await scheduledBatchTaskRepository.findById(taskId);
    if (!task) {
      throw new Error('Scheduled task not found');
    }

    // Record the input application
    const application = await this.recordInputApplication(task.batch_id, {
      application_date: inputData.application_date || new Date(),
      input_type: inputData.input_type || task.input_type,
      product_name: inputData.product_name || task.input_product_name,
      quantity: inputData.quantity || task.input_quantity,
      unit: inputData.unit || task.input_unit,
      application_method: inputData.application_method || task.input_application_method,
      target_pest_disease: inputData.target_pest_disease,
      notes: inputData.notes,
    }, userId);

    // Link and complete the scheduled task
    await scheduledBatchTaskRepository.linkToInputApplication(taskId, application.id);
    return await scheduledBatchTaskRepository.markCompleted(taskId, userId, inputData.notes);
  }

  /**
   * Update scheduled task statuses
   * @returns {Promise<Object>}
   */
  async updateScheduledTaskStatuses() {
    return await scheduledBatchTaskRepository.updateStatuses();
  }

  /**
   * Get calendar data for scheduled tasks
   * @param {number} year - Year
   * @param {number} month - Month
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getScheduledTasksCalendar(year, month, filters = {}) {
    return await scheduledBatchTaskRepository.getCalendarData(year, month, filters);
  }

  /**
   * Get care alerts summary
   * @param {number} daysAhead - Days to look ahead for upcoming
   * @returns {Promise<Object>}
   */
  async getCareAlertsSummary(daysAhead = 7) {
    const [upcoming, overdue] = await Promise.all([
      scheduledBatchTaskRepository.findUpcoming(daysAhead),
      scheduledBatchTaskRepository.findOverdue(),
    ]);

    return {
      upcoming_count: upcoming.length,
      overdue_count: overdue.length,
      upcoming_tasks: upcoming.slice(0, 10),
      overdue_tasks: overdue.slice(0, 10),
    };
  }
}

module.exports = new CropService();
