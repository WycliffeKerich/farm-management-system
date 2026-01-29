const cropService = require('../services/crop.service');

/**
 * Controller for crop management endpoints
 */
class CropController {
  // ==================== CROP TYPES ====================

  async getCropTypes(req, res, next) {
    try {
      const cropTypes = await cropService.getAllCropTypes();
      res.json({ success: true, data: cropTypes });
    } catch (error) {
      next(error);
    }
  }

  async getCropTypeById(req, res, next) {
    try {
      const cropType = await cropService.getCropTypeById(req.params.id);
      res.json({ success: true, data: cropType });
    } catch (error) {
      next(error);
    }
  }

  async createCropType(req, res, next) {
    try {
      const cropType = await cropService.createCropType(req.body);
      res.status(201).json({ success: true, data: cropType });
    } catch (error) {
      next(error);
    }
  }

  async updateCropType(req, res, next) {
    try {
      const cropType = await cropService.updateCropType(req.params.id, req.body);
      res.json({ success: true, data: cropType });
    } catch (error) {
      next(error);
    }
  }

  async deleteCropType(req, res, next) {
    try {
      await cropService.deleteCropType(req.params.id);
      res.json({ success: true, message: 'Crop type deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getCropTypeCategories(req, res, next) {
    try {
      const categories = await cropService.getCropTypeCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CROP VARIETIES ====================

  async getVarieties(req, res, next) {
    try {
      const { crop_type_id } = req.query;
      let varieties;

      if (crop_type_id) {
        varieties = await cropService.getVarietiesByCropType(crop_type_id);
      } else {
        varieties = await cropService.getAllVarieties();
      }

      res.json({ success: true, data: varieties });
    } catch (error) {
      next(error);
    }
  }

  async getVarietyById(req, res, next) {
    try {
      const variety = await cropService.getVarietyById(req.params.id);
      res.json({ success: true, data: variety });
    } catch (error) {
      next(error);
    }
  }

  async createVariety(req, res, next) {
    try {
      const variety = await cropService.createVariety(req.body);
      res.status(201).json({ success: true, data: variety });
    } catch (error) {
      next(error);
    }
  }

  async updateVariety(req, res, next) {
    try {
      const variety = await cropService.updateVariety(req.params.id, req.body);
      res.json({ success: true, data: variety });
    } catch (error) {
      next(error);
    }
  }

  async deleteVariety(req, res, next) {
    try {
      await cropService.deleteVariety(req.params.id);
      res.json({ success: true, message: 'Variety deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== GROWING LOCATIONS ====================

  async getLocations(req, res, next) {
    try {
      const { active_only } = req.query;
      let locations;

      if (active_only === 'true') {
        locations = await cropService.getActiveLocations();
      } else {
        locations = await cropService.getAllLocations();
      }

      res.json({ success: true, data: locations });
    } catch (error) {
      next(error);
    }
  }

  async getLocationById(req, res, next) {
    try {
      const location = await cropService.getLocationById(req.params.id);
      res.json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }

  async createLocation(req, res, next) {
    try {
      const location = await cropService.createLocation(req.body);
      res.status(201).json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }

  async updateLocation(req, res, next) {
    try {
      const location = await cropService.updateLocation(req.params.id, req.body);
      res.json({ success: true, data: location });
    } catch (error) {
      next(error);
    }
  }

  async deleteLocation(req, res, next) {
    try {
      await cropService.deleteLocation(req.params.id);
      res.json({ success: true, message: 'Location deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getLocationTypes(req, res, next) {
    try {
      const types = await cropService.getLocationTypes();
      res.json({ success: true, data: types });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CROP BATCHES ====================

  async getBatches(req, res, next) {
    try {
      const { page, limit, ...filters } = req.query;

      if (page || limit) {
        const result = await cropService.getPaginatedBatches(
          parseInt(page) || 1,
          parseInt(limit) || 20,
          filters
        );
        res.json({ success: true, ...result });
      } else {
        const batches = await cropService.getAllBatches(filters);
        res.json({ success: true, data: batches });
      }
    } catch (error) {
      next(error);
    }
  }

  async getBatchById(req, res, next) {
    try {
      const batch = await cropService.getBatchById(req.params.id);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  async createBatch(req, res, next) {
    try {
      const batch = await cropService.createBatch(req.body, req.user.id);
      res.status(201).json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  async updateBatch(req, res, next) {
    try {
      const batch = await cropService.updateBatch(req.params.id, req.body);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  async updateBatchStatus(req, res, next) {
    try {
      const { status } = req.body;
      const batch = await cropService.updateBatchStatus(req.params.id, status);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  async deleteBatch(req, res, next) {
    try {
      await cropService.deleteBatch(req.params.id);
      res.json({ success: true, message: 'Batch deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getBatchStatistics(req, res, next) {
    try {
      const statistics = await cropService.getBatchStatistics();
      res.json({ success: true, data: statistics });
    } catch (error) {
      next(error);
    }
  }

  // ==================== GROWTH OBSERVATIONS ====================

  async addObservation(req, res, next) {
    try {
      const observation = await cropService.addObservation(
        req.params.batchId,
        req.body,
        req.user.id
      );
      res.status(201).json({ success: true, data: observation });
    } catch (error) {
      next(error);
    }
  }

  async getBatchObservations(req, res, next) {
    try {
      const observations = await cropService.getBatchObservations(req.params.batchId);
      res.json({ success: true, data: observations });
    } catch (error) {
      next(error);
    }
  }

  async deleteObservation(req, res, next) {
    try {
      await cropService.deleteObservation(req.params.id);
      res.json({ success: true, message: 'Observation deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== HARVESTS ====================

  async recordHarvest(req, res, next) {
    try {
      const harvest = await cropService.recordHarvest(
        req.params.batchId,
        req.body,
        req.user.id
      );
      res.status(201).json({ success: true, data: harvest });
    } catch (error) {
      next(error);
    }
  }

  async getBatchHarvests(req, res, next) {
    try {
      const harvests = await cropService.getBatchHarvests(req.params.batchId);
      res.json({ success: true, data: harvests });
    } catch (error) {
      next(error);
    }
  }

  async getAllHarvests(req, res, next) {
    try {
      const harvests = await cropService.getAllHarvests(req.query);
      res.json({ success: true, data: harvests });
    } catch (error) {
      next(error);
    }
  }

  async getHarvestSummary(req, res, next) {
    try {
      const { start_date, end_date } = req.query;
      const summary = await cropService.getHarvestSummary(start_date, end_date);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async deleteHarvest(req, res, next) {
    try {
      await cropService.deleteHarvest(req.params.id);
      res.json({ success: true, message: 'Harvest deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== INPUT APPLICATIONS ====================

  async recordInputApplication(req, res, next) {
    try {
      const application = await cropService.recordInputApplication(
        req.params.batchId,
        req.body,
        req.user.id
      );
      res.status(201).json({ success: true, data: application });
    } catch (error) {
      next(error);
    }
  }

  async getBatchInputApplications(req, res, next) {
    try {
      const applications = await cropService.getBatchInputApplications(req.params.batchId);
      res.json({ success: true, data: applications });
    } catch (error) {
      next(error);
    }
  }

  async getAllInputApplications(req, res, next) {
    try {
      const applications = await cropService.getAllInputApplications(req.query);
      res.json({ success: true, data: applications });
    } catch (error) {
      next(error);
    }
  }

  async deleteInputApplication(req, res, next) {
    try {
      await cropService.deleteInputApplication(req.params.id);
      res.json({ success: true, message: 'Input application deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== PEST & DISEASE ====================

  async reportPestDisease(req, res, next) {
    try {
      const record = await cropService.reportPestDisease(
        req.params.batchId,
        req.body,
        req.user.id
      );
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getBatchPestsDiseases(req, res, next) {
    try {
      const records = await cropService.getBatchPestsDiseases(req.params.batchId);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getAllPestsDiseases(req, res, next) {
    try {
      const records = await cropService.getAllPestsDiseases(req.query);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async updatePestDiseaseStatus(req, res, next) {
    try {
      const { status, control_measures } = req.body;
      const record = await cropService.updatePestDiseaseStatus(
        req.params.id,
        status,
        control_measures
      );
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getPestDiseaseStatistics(req, res, next) {
    try {
      const statistics = await cropService.getPestDiseaseStatistics();
      res.json({ success: true, data: statistics });
    } catch (error) {
      next(error);
    }
  }

  async getActiveAlerts(req, res, next) {
    try {
      const { limit } = req.query;
      const alerts = await cropService.getActiveAlerts(parseInt(limit) || 10);
      res.json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  }

  async deletePestDisease(req, res, next) {
    try {
      await cropService.deletePestDisease(req.params.id);
      res.json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE PLANS ====================

  async getCarePlans(req, res, next) {
    try {
      const { templates_only, variety_id } = req.query;

      let plans;
      if (templates_only === 'true') {
        plans = await cropService.getCarePlanTemplates();
      } else if (variety_id) {
        plans = await cropService.getCarePlansByVariety(variety_id);
      } else {
        plans = await cropService.getAllCarePlans();
      }

      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  async getCarePlanById(req, res, next) {
    try {
      const plan = await cropService.getCarePlanById(req.params.id);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async createCarePlan(req, res, next) {
    try {
      const plan = await cropService.createCarePlan(req.body, req.user.id);
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async updateCarePlan(req, res, next) {
    try {
      const plan = await cropService.updateCarePlan(req.params.id, req.body);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async cloneCarePlan(req, res, next) {
    try {
      const { name } = req.body;
      const plan = await cropService.cloneCarePlan(req.params.id, name, req.user.id);
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async deleteCarePlan(req, res, next) {
    try {
      await cropService.deleteCarePlan(req.params.id);
      res.json({ success: true, message: 'Care plan deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE PLAN TASKS ====================

  async getCarePlanTasks(req, res, next) {
    try {
      const tasks = await cropService.getCarePlanTasks(req.params.planId);
      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  async addCarePlanTask(req, res, next) {
    try {
      const task = await cropService.addCarePlanTask(req.params.planId, req.body);
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async updateCarePlanTask(req, res, next) {
    try {
      const task = await cropService.updateCarePlanTask(req.params.taskId, req.body);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async deleteCarePlanTask(req, res, next) {
    try {
      await cropService.deleteCarePlanTask(req.params.taskId);
      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== BATCH CARE SCHEDULES ====================

  async applyCarePlanToBatch(req, res, next) {
    try {
      const { plan_id } = req.body;
      const schedule = await cropService.applyCarePlanToBatch(
        req.params.batchId,
        plan_id,
        req.user.id
      );
      res.status(201).json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getBatchCareSchedule(req, res, next) {
    try {
      const schedule = await cropService.getBatchCareSchedule(req.params.batchId);
      res.json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getAllBatchSchedules(req, res, next) {
    try {
      const schedules = await cropService.getAllBatchSchedules(req.query);
      res.json({ success: true, data: schedules });
    } catch (error) {
      next(error);
    }
  }

  async cancelBatchCareSchedule(req, res, next) {
    try {
      await cropService.cancelBatchCareSchedule(req.params.batchId);
      res.json({ success: true, message: 'Care schedule cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SCHEDULED TASKS ====================

  async getScheduledTasks(req, res, next) {
    try {
      const { batch_id, start_date, end_date, days_ahead, overdue_only, ...filters } = req.query;

      let tasks;
      if (overdue_only === 'true') {
        tasks = await cropService.getOverdueScheduledTasks(filters);
      } else if (batch_id) {
        tasks = await cropService.getScheduledTasksForBatch(batch_id);
      } else if (start_date && end_date) {
        tasks = await cropService.getScheduledTasksByDateRange(start_date, end_date, filters);
      } else {
        tasks = await cropService.getUpcomingScheduledTasks(parseInt(days_ahead) || 7, filters);
      }

      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  async getScheduledTasksCalendar(req, res, next) {
    try {
      const { year, month, ...filters } = req.query;
      const now = new Date();
      const calendarData = await cropService.getScheduledTasksCalendar(
        parseInt(year) || now.getFullYear(),
        parseInt(month) || now.getMonth() + 1,
        filters
      );
      res.json({ success: true, data: calendarData });
    } catch (error) {
      next(error);
    }
  }

  async completeScheduledTask(req, res, next) {
    try {
      const { notes } = req.body;
      const task = await cropService.completeScheduledTask(
        req.params.taskId,
        req.user.id,
        notes
      );
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async skipScheduledTask(req, res, next) {
    try {
      const { reason } = req.body;
      const task = await cropService.skipScheduledTask(
        req.params.taskId,
        req.user.id,
        reason
      );
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async completeScheduledTaskWithInput(req, res, next) {
    try {
      const task = await cropService.completeScheduledTaskWithInput(
        req.params.taskId,
        req.body,
        req.user.id
      );
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async updateScheduledTaskStatuses(req, res, next) {
    try {
      const result = await cropService.updateScheduledTaskStatuses();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCareAlertsSummary(req, res, next) {
    try {
      const { days_ahead } = req.query;
      const summary = await cropService.getCareAlertsSummary(parseInt(days_ahead) || 7);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CropController();
