const animalService = require('../services/animal.service');

/**
 * Controller for animal management endpoints
 */
class AnimalController {
  // ==================== ANIMAL TYPES ====================

  async getAnimalTypes(req, res, next) {
    try {
      const { tracking_mode } = req.query;
      let animalTypes;

      if (tracking_mode) {
        animalTypes = await animalService.getAnimalTypesByTrackingMode(tracking_mode);
      } else {
        animalTypes = await animalService.getAllAnimalTypes();
      }

      res.json({ success: true, data: animalTypes });
    } catch (error) {
      next(error);
    }
  }

  async getAnimalTypeById(req, res, next) {
    try {
      const animalType = await animalService.getAnimalTypeById(req.params.id);
      res.json({ success: true, data: animalType });
    } catch (error) {
      next(error);
    }
  }

  async createAnimalType(req, res, next) {
    try {
      const animalType = await animalService.createAnimalType(req.body);
      res.status(201).json({ success: true, data: animalType });
    } catch (error) {
      next(error);
    }
  }

  async updateAnimalType(req, res, next) {
    try {
      const animalType = await animalService.updateAnimalType(req.params.id, req.body);
      res.json({ success: true, data: animalType });
    } catch (error) {
      next(error);
    }
  }

  async deleteAnimalType(req, res, next) {
    try {
      await animalService.deleteAnimalType(req.params.id);
      res.json({ success: true, message: 'Animal type deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getAnimalTypeCategories(req, res, next) {
    try {
      const categories = await animalService.getAnimalTypeCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANIMAL BREEDS ====================

  async getBreeds(req, res, next) {
    try {
      const { animal_type_id, reproduction_type } = req.query;
      let breeds;

      if (animal_type_id) {
        breeds = await animalService.getBreedsByAnimalType(animal_type_id);
      } else {
        breeds = await animalService.getAllBreeds({ reproduction_type });
      }

      res.json({ success: true, data: breeds });
    } catch (error) {
      next(error);
    }
  }

  async getBreedById(req, res, next) {
    try {
      const breed = await animalService.getBreedById(req.params.id);
      res.json({ success: true, data: breed });
    } catch (error) {
      next(error);
    }
  }

  async createBreed(req, res, next) {
    try {
      const breed = await animalService.createBreed(req.body);
      res.status(201).json({ success: true, data: breed });
    } catch (error) {
      next(error);
    }
  }

  async updateBreed(req, res, next) {
    try {
      const breed = await animalService.updateBreed(req.params.id, req.body);
      res.json({ success: true, data: breed });
    } catch (error) {
      next(error);
    }
  }

  async deleteBreed(req, res, next) {
    try {
      await animalService.deleteBreed(req.params.id);
      res.json({ success: true, message: 'Breed deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANIMAL HOUSING ====================

  async getHousing(req, res, next) {
    try {
      const { active_only } = req.query;
      let housing;

      if (active_only === 'true') {
        housing = await animalService.getActiveHousing();
      } else {
        housing = await animalService.getAllHousing();
      }

      res.json({ success: true, data: housing });
    } catch (error) {
      next(error);
    }
  }

  async getHousingById(req, res, next) {
    try {
      const housing = await animalService.getHousingById(req.params.id);
      res.json({ success: true, data: housing });
    } catch (error) {
      next(error);
    }
  }

  async createHousing(req, res, next) {
    try {
      const housing = await animalService.createHousing(req.body);
      res.status(201).json({ success: true, data: housing });
    } catch (error) {
      next(error);
    }
  }

  async updateHousing(req, res, next) {
    try {
      const housing = await animalService.updateHousing(req.params.id, req.body);
      res.json({ success: true, data: housing });
    } catch (error) {
      next(error);
    }
  }

  async deleteHousing(req, res, next) {
    try {
      await animalService.deleteHousing(req.params.id);
      res.json({ success: true, message: 'Housing deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getHousingTypes(req, res, next) {
    try {
      const types = await animalService.getHousingTypes();
      res.json({ success: true, data: types });
    } catch (error) {
      next(error);
    }
  }

  // ==================== INDIVIDUAL ANIMALS ====================

  async getAnimals(req, res, next) {
    try {
      const { page, limit, ...filters } = req.query;

      if (page || limit) {
        const result = await animalService.getPaginatedAnimals(parseInt(page) || 1, parseInt(limit) || 20, filters);
        res.json({ success: true, ...result });
      } else {
        const animals = await animalService.getAllAnimals(filters);
        res.json({ success: true, data: animals });
      }
    } catch (error) {
      next(error);
    }
  }

  async getAnimalById(req, res, next) {
    try {
      const animal = await animalService.getAnimalById(req.params.id);
      res.json({ success: true, data: animal });
    } catch (error) {
      next(error);
    }
  }

  async createAnimal(req, res, next) {
    try {
      const animal = await animalService.createAnimal(req.body, req.user.id);
      res.status(201).json({ success: true, data: animal });
    } catch (error) {
      next(error);
    }
  }

  async updateAnimal(req, res, next) {
    try {
      const animal = await animalService.updateAnimal(req.params.id, req.body);
      res.json({ success: true, data: animal });
    } catch (error) {
      next(error);
    }
  }

  async updateAnimalStatus(req, res, next) {
    try {
      const { status, status_date } = req.body;
      const animal = await animalService.updateAnimalStatus(req.params.id, status, status_date);
      res.json({ success: true, data: animal });
    } catch (error) {
      next(error);
    }
  }

  async recordAnimalSale(req, res, next) {
    try {
      const { sale_date } = req.body;
      const animal = await animalService.recordAnimalSale(req.params.id, sale_date);
      res.json({ success: true, data: animal });
    } catch (error) {
      next(error);
    }
  }

  async deleteAnimal(req, res, next) {
    try {
      await animalService.deleteAnimal(req.params.id);
      res.json({ success: true, message: 'Animal deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getAnimalStatistics(req, res, next) {
    try {
      const statistics = await animalService.getAnimalStatistics();
      res.json({ success: true, data: statistics });
    } catch (error) {
      next(error);
    }
  }

  async getBreedingStock(req, res, next) {
    try {
      const { gender, breed_id } = req.query;
      const stock = await animalService.getBreedingStock(gender, breed_id);
      res.json({ success: true, data: stock });
    } catch (error) {
      next(error);
    }
  }

  async getOffspring(req, res, next) {
    try {
      const offspring = await animalService.getOffspring(req.params.id);
      res.json({ success: true, data: offspring });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANIMAL GROUPS (FLOCKS) ====================

  async getGroups(req, res, next) {
    try {
      const { page, limit, ...filters } = req.query;

      if (page || limit) {
        const result = await animalService.getPaginatedGroups(parseInt(page) || 1, parseInt(limit) || 20, filters);
        res.json({ success: true, ...result });
      } else {
        const groups = await animalService.getAllGroups(filters);
        res.json({ success: true, data: groups });
      }
    } catch (error) {
      next(error);
    }
  }

  async getGroupById(req, res, next) {
    try {
      const group = await animalService.getGroupById(req.params.id);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async createGroup(req, res, next) {
    try {
      const group = await animalService.createGroup(req.body, req.user.id);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req, res, next) {
    try {
      const group = await animalService.updateGroup(req.params.id, req.body);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async recordGroupAddition(req, res, next) {
    try {
      const result = await animalService.recordGroupAddition(req.params.id, req.body, req.user.id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async recordGroupRemoval(req, res, next) {
    try {
      const result = await animalService.recordGroupRemoval(req.params.id, req.body, req.user.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getGroupAdjustmentHistory(req, res, next) {
    try {
      const history = await animalService.getGroupAdjustmentHistory(req.params.id);
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }

  async closeGroup(req, res, next) {
    try {
      const group = await animalService.closeGroup(req.params.id);
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req, res, next) {
    try {
      await animalService.deleteGroup(req.params.id);
      res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getGroupStatistics(req, res, next) {
    try {
      const statistics = await animalService.getGroupStatistics();
      res.json({ success: true, data: statistics });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ANIMAL DEATHS ====================

  async recordAnimalDeath(req, res, next) {
    try {
      const death = await animalService.recordAnimalDeath(req.params.animalId, req.body, req.user.id);
      res.status(201).json({ success: true, data: death });
    } catch (error) {
      next(error);
    }
  }

  async recordGroupDeaths(req, res, next) {
    try {
      const death = await animalService.recordGroupDeaths(req.params.groupId, req.body, req.user.id);
      res.status(201).json({ success: true, data: death });
    } catch (error) {
      next(error);
    }
  }

  async getDeaths(req, res, next) {
    try {
      const deaths = await animalService.getAllDeaths(req.query);
      res.json({ success: true, data: deaths });
    } catch (error) {
      next(error);
    }
  }

  async getDeathById(req, res, next) {
    try {
      const death = await animalService.getDeathById(req.params.id);
      res.json({ success: true, data: death });
    } catch (error) {
      next(error);
    }
  }

  async getDeathStatistics(req, res, next) {
    try {
      const statistics = await animalService.getDeathStatistics(req.query);
      res.json({ success: true, data: statistics });
    } catch (error) {
      next(error);
    }
  }

  async getDeathsByCause(req, res, next) {
    try {
      const deaths = await animalService.getDeathsByCause(req.query);
      res.json({ success: true, data: deaths });
    } catch (error) {
      next(error);
    }
  }

  async getGroupMortalityRate(req, res, next) {
    try {
      const rate = await animalService.getGroupMortalityRate(req.params.groupId);
      res.json({ success: true, data: rate });
    } catch (error) {
      next(error);
    }
  }

  async getRecentDeathAlerts(req, res, next) {
    try {
      const { days, limit } = req.query;
      const deaths = await animalService.getRecentDeathAlerts(parseInt(days) || 7, parseInt(limit) || 10);
      res.json({ success: true, data: deaths });
    } catch (error) {
      next(error);
    }
  }

  async updateDeath(req, res, next) {
    try {
      const death = await animalService.updateDeath(req.params.id, req.body);
      res.json({ success: true, data: death });
    } catch (error) {
      next(error);
    }
  }

  async deleteDeath(req, res, next) {
    try {
      await animalService.deleteDeath(req.params.id);
      res.json({ success: true, message: 'Death record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE PLANS ====================

  async getCarePlans(req, res, next) {
    try {
      const { templates_only, animal_type_id, breed_id, plan_type } = req.query;

      let plans;
      if (templates_only === 'true') {
        plans = await animalService.getCarePlanTemplates();
      } else if (animal_type_id) {
        plans = await animalService.getCarePlansByAnimalType(animal_type_id);
      } else if (breed_id) {
        plans = await animalService.getCarePlansByBreed(breed_id);
      } else if (plan_type) {
        plans = await animalService.getCarePlansByType(plan_type);
      } else {
        plans = await animalService.getAllCarePlans();
      }

      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  async getCarePlanById(req, res, next) {
    try {
      const plan = await animalService.getCarePlanById(req.params.id);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async createCarePlan(req, res, next) {
    try {
      const plan = await animalService.createCarePlan(req.body, req.user.id);
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async updateCarePlan(req, res, next) {
    try {
      const plan = await animalService.updateCarePlan(req.params.id, req.body);
      res.json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async cloneCarePlan(req, res, next) {
    try {
      const { name } = req.body;
      const plan = await animalService.cloneCarePlan(req.params.id, name, req.user.id);
      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async deleteCarePlan(req, res, next) {
    try {
      await animalService.deleteCarePlan(req.params.id);
      res.json({ success: true, message: 'Care plan deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE PLAN TASKS ====================

  async getCarePlanTasks(req, res, next) {
    try {
      const tasks = await animalService.getCarePlanTasks(req.params.planId);
      res.json({ success: true, data: tasks });
    } catch (error) {
      next(error);
    }
  }

  async addCarePlanTask(req, res, next) {
    try {
      const task = await animalService.addCarePlanTask(req.params.planId, req.body);
      res.status(201).json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async updateCarePlanTask(req, res, next) {
    try {
      const task = await animalService.updateCarePlanTask(req.params.taskId, req.body);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async deleteCarePlanTask(req, res, next) {
    try {
      await animalService.deleteCarePlanTask(req.params.taskId);
      res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== CARE SCHEDULES ====================

  async applyCarePlanToAnimal(req, res, next) {
    try {
      const { plan_id, start_date } = req.body;
      const schedule = await animalService.applyCarePlanToAnimal(req.params.animalId, plan_id, start_date, req.user.id);
      res.status(201).json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async applyCarePlanToGroup(req, res, next) {
    try {
      const { plan_id, start_date } = req.body;
      const schedule = await animalService.applyCarePlanToGroup(req.params.groupId, plan_id, start_date, req.user.id);
      res.status(201).json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getAnimalCareSchedule(req, res, next) {
    try {
      const schedule = await animalService.getAnimalCareSchedule(req.params.animalId);
      res.json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getGroupCareSchedule(req, res, next) {
    try {
      const schedule = await animalService.getGroupCareSchedule(req.params.groupId);
      res.json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getAllCareSchedules(req, res, next) {
    try {
      const schedules = await animalService.getAllCareSchedules(req.query);
      res.json({ success: true, data: schedules });
    } catch (error) {
      next(error);
    }
  }

  async cancelCareSchedule(req, res, next) {
    try {
      await animalService.cancelCareSchedule(req.params.scheduleId);
      res.json({ success: true, message: 'Care schedule cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== SCHEDULED TASKS ====================

  async getScheduledTasks(req, res, next) {
    try {
      const { start_date, end_date, days_ahead, overdue_only, ...filters } = req.query;

      let tasks;
      if (overdue_only === 'true') {
        tasks = await animalService.getOverdueScheduledTasks(filters);
      } else if (start_date && end_date) {
        tasks = await animalService.getScheduledTasksByDateRange(start_date, end_date, filters);
      } else {
        tasks = await animalService.getUpcomingScheduledTasks(parseInt(days_ahead) || 7, filters);
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
      const calendarData = await animalService.getScheduledTasksCalendar(
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
      const { notes, quantity_treated } = req.body;
      const task = await animalService.completeScheduledTask(req.params.taskId, req.user.id, notes, quantity_treated);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async partiallyCompleteScheduledTask(req, res, next) {
    try {
      const { quantity_treated, notes } = req.body;
      const task = await animalService.partiallyCompleteScheduledTask(
        req.params.taskId,
        req.user.id,
        quantity_treated,
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
      const task = await animalService.skipScheduledTask(req.params.taskId, req.user.id, reason);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async updateScheduledTaskStatuses(req, res, next) {
    try {
      const result = await animalService.updateScheduledTaskStatuses();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getCareAlertsSummary(req, res, next) {
    try {
      const { days_ahead } = req.query;
      const summary = await animalService.getCareAlertsSummary(parseInt(days_ahead) || 7);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  // ==================== HEALTH RECORDS ====================

  async getAllHealthRecords(req, res, next) {
    try {
      const filters = req.query;
      const records = await animalService.getAllHealthRecords(filters);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getHealthRecordById(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.getHealthRecordById(parseInt(id));
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getHealthRecordsByAnimal(req, res, next) {
    try {
      const { animalId } = req.params;
      const records = await animalService.getHealthRecordsByAnimal(parseInt(animalId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getHealthRecordsByGroup(req, res, next) {
    try {
      const { groupId } = req.params;
      const records = await animalService.getHealthRecordsByGroup(parseInt(groupId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async createHealthRecord(req, res, next) {
    try {
      const data = { ...req.body, recorded_by: req.user.id };
      const record = await animalService.createHealthRecord(data);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async updateHealthRecord(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.updateHealthRecord(parseInt(id), req.body);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteHealthRecord(req, res, next) {
    try {
      const { id } = req.params;
      await animalService.deleteHealthRecord(parseInt(id));
      res.json({ success: true, message: 'Health record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getHealthStatistics(req, res, next) {
    try {
      const filters = req.query;
      const stats = await animalService.getHealthStatistics(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getUpcomingFollowups(req, res, next) {
    try {
      const { days, limit } = req.query;
      const followups = await animalService.getUpcomingFollowups(parseInt(days) || 30, parseInt(limit) || 10);
      res.json({ success: true, data: followups });
    } catch (error) {
      next(error);
    }
  }

  async getOverdueFollowups(req, res, next) {
    try {
      const { limit } = req.query;
      const followups = await animalService.getOverdueFollowups(parseInt(limit) || 10);
      res.json({ success: true, data: followups });
    } catch (error) {
      next(error);
    }
  }

  // ==================== DISEASE & TREATMENT ====================

  async getAllDiseaseTreatments(req, res, next) {
    try {
      const filters = req.query;
      const records = await animalService.getAllDiseaseTreatments(filters);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getDiseaseTreatmentById(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.getDiseaseTreatmentById(parseInt(id));
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getDiseaseTreatmentsByAnimal(req, res, next) {
    try {
      const { animalId } = req.params;
      const records = await animalService.getDiseaseTreatmentsByAnimal(parseInt(animalId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getDiseaseTreatmentsByGroup(req, res, next) {
    try {
      const { groupId } = req.params;
      const records = await animalService.getDiseaseTreatmentsByGroup(parseInt(groupId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async createDiseaseTreatment(req, res, next) {
    try {
      const data = { ...req.body, recorded_by: req.user.id };
      const record = await animalService.createDiseaseTreatment(data);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async updateDiseaseTreatment(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.updateDiseaseTreatment(parseInt(id), req.body);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteDiseaseTreatment(req, res, next) {
    try {
      const { id } = req.params;
      await animalService.deleteDiseaseTreatment(parseInt(id));
      res.json({ success: true, message: 'Disease/treatment record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getDiseaseStatistics(req, res, next) {
    try {
      const filters = req.query;
      const stats = await animalService.getDiseaseStatistics(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getDiseaseOccurrenceSummary(req, res, next) {
    try {
      const filters = req.query;
      const summary = await animalService.getDiseaseOccurrenceSummary(filters);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async getOngoingTreatments(req, res, next) {
    try {
      const { limit } = req.query;
      const treatments = await animalService.getOngoingTreatments(parseInt(limit) || 20);
      res.json({ success: true, data: treatments });
    } catch (error) {
      next(error);
    }
  }

  async getChronicConditions(req, res, next) {
    try {
      const { limit } = req.query;
      const conditions = await animalService.getChronicConditions(parseInt(limit) || 20);
      res.json({ success: true, data: conditions });
    } catch (error) {
      next(error);
    }
  }

  async getCriticalCases(req, res, next) {
    try {
      const { limit } = req.query;
      const cases = await animalService.getCriticalCases(parseInt(limit) || 10);
      res.json({ success: true, data: cases });
    } catch (error) {
      next(error);
    }
  }

  // ==================== FEED RECORDS ====================

  async getAllFeedRecords(req, res, next) {
    try {
      const filters = req.query;
      const records = await animalService.getAllFeedRecords(filters);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getFeedRecordById(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.getFeedRecordById(parseInt(id));
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getFeedRecordsByAnimal(req, res, next) {
    try {
      const { animalId } = req.params;
      const records = await animalService.getFeedRecordsByAnimal(parseInt(animalId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getFeedRecordsByGroup(req, res, next) {
    try {
      const { groupId } = req.params;
      const records = await animalService.getFeedRecordsByGroup(parseInt(groupId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async createFeedRecord(req, res, next) {
    try {
      const data = { ...req.body, recorded_by: req.user.id };
      const record = await animalService.createFeedRecord(data);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async updateFeedRecord(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.updateFeedRecord(parseInt(id), req.body);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteFeedRecord(req, res, next) {
    try {
      const { id } = req.params;
      await animalService.deleteFeedRecord(parseInt(id));
      res.json({ success: true, message: 'Feed record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getFeedStatistics(req, res, next) {
    try {
      const filters = req.query;
      const stats = await animalService.getFeedStatistics(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getConsumptionByFeedType(req, res, next) {
    try {
      const filters = req.query;
      const summary = await animalService.getConsumptionByFeedType(filters);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async getDailyFeedConsumption(req, res, next) {
    try {
      const filters = req.query;
      const consumption = await animalService.getDailyFeedConsumption(filters);
      res.json({ success: true, data: consumption });
    } catch (error) {
      next(error);
    }
  }

  async getFeedCostByAnimalType(req, res, next) {
    try {
      const filters = req.query;
      const costs = await animalService.getFeedCostByAnimalType(filters);
      res.json({ success: true, data: costs });
    } catch (error) {
      next(error);
    }
  }

  async getAverageDailyFeedCost(req, res, next) {
    try {
      const { animal_id, group_id, days } = req.query;
      const avgCost = await animalService.getAverageDailyFeedCost(
        animal_id ? parseInt(animal_id) : null,
        group_id ? parseInt(group_id) : null,
        parseInt(days) || 30
      );
      res.json({ success: true, data: avgCost });
    } catch (error) {
      next(error);
    }
  }

  // ==================== BREEDING RECORDS ====================

  async getAllBreedingRecords(req, res, next) {
    try {
      const filters = req.query;
      const records = await animalService.getAllBreedingRecords(filters);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getBreedingRecordById(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.getBreedingRecordById(parseInt(id));
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getBreedingRecordsByAnimal(req, res, next) {
    try {
      const { animalId } = req.params;
      const records = await animalService.getBreedingRecordsByAnimal(parseInt(animalId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async createBreedingRecord(req, res, next) {
    try {
      const data = { ...req.body, recorded_by: req.user.id };
      const record = await animalService.createBreedingRecord(data);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async updateBreedingRecord(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.updateBreedingRecord(parseInt(id), req.body);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteBreedingRecord(req, res, next) {
    try {
      const { id } = req.params;
      await animalService.deleteBreedingRecord(parseInt(id));
      res.json({ success: true, message: 'Breeding record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getBreedingStatistics(req, res, next) {
    try {
      const filters = req.query;
      const stats = await animalService.getBreedingStatistics(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getExpectedDeliveries(req, res, next) {
    try {
      const { days, limit } = req.query;
      const deliveries = await animalService.getExpectedDeliveries(parseInt(days) || 30, parseInt(limit) || 20);
      res.json({ success: true, data: deliveries });
    } catch (error) {
      next(error);
    }
  }

  async getOverdueDeliveries(req, res, next) {
    try {
      const { limit } = req.query;
      const deliveries = await animalService.getOverdueDeliveries(parseInt(limit) || 20);
      res.json({ success: true, data: deliveries });
    } catch (error) {
      next(error);
    }
  }

  async getBreedingPerformance(req, res, next) {
    try {
      const { animalId } = req.params;
      const { role } = req.query;
      const performance = await animalService.getBreedingPerformance(parseInt(animalId), role || 'both');
      res.json({ success: true, data: performance });
    } catch (error) {
      next(error);
    }
  }

  async getBreedingSuccessRateByType(req, res, next) {
    try {
      const filters = req.query;
      const rates = await animalService.getBreedingSuccessRateByType(filters);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  }

  // ==================== LIVESTOCK SALES ====================

  async getAllAnimalSales(req, res, next) {
    try {
      const filters = req.query;
      const sales = await animalService.getAllAnimalSales(filters);
      res.json({ success: true, data: sales });
    } catch (error) {
      next(error);
    }
  }

  async getAnimalSaleById(req, res, next) {
    try {
      const { id } = req.params;
      const sale = await animalService.getAnimalSaleById(parseInt(id));
      res.json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }

  async createAnimalSale(req, res, next) {
    try {
      const data = { ...req.body, recorded_by: req.user.id };
      const sale = await animalService.createAnimalSale(data);
      res.status(201).json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }

  async updateAnimalSale(req, res, next) {
    try {
      const { id } = req.params;
      const sale = await animalService.updateAnimalSale(parseInt(id), req.body);
      res.json({ success: true, data: sale });
    } catch (error) {
      next(error);
    }
  }

  async deleteAnimalSale(req, res, next) {
    try {
      const { id } = req.params;
      await animalService.deleteAnimalSale(parseInt(id));
      res.json({ success: true, message: 'Sale record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getAnimalSalesStatistics(req, res, next) {
    try {
      const filters = req.query;
      const stats = await animalService.getAnimalSalesStatistics(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getSalesByAnimalType(req, res, next) {
    try {
      const filters = req.query;
      const sales = await animalService.getSalesByAnimalType(filters);
      res.json({ success: true, data: sales });
    } catch (error) {
      next(error);
    }
  }

  async getMonthlySales(req, res, next) {
    try {
      const filters = req.query;
      const sales = await animalService.getMonthlySales(filters);
      res.json({ success: true, data: sales });
    } catch (error) {
      next(error);
    }
  }

  async getTopCustomers(req, res, next) {
    try {
      const filters = req.query;
      const customers = await animalService.getTopCustomers(filters);
      res.json({ success: true, data: customers });
    } catch (error) {
      next(error);
    }
  }

  async getRecentAnimalSales(req, res, next) {
    try {
      const { days, limit } = req.query;
      const sales = await animalService.getRecentAnimalSales(parseInt(days) || 30, parseInt(limit) || 10);
      res.json({ success: true, data: sales });
    } catch (error) {
      next(error);
    }
  }

  async getPendingPayments(req, res, next) {
    try {
      const { limit } = req.query;
      const sales = await animalService.getPendingPayments(parseInt(limit) || 20);
      res.json({ success: true, data: sales });
    } catch (error) {
      next(error);
    }
  }

  // ==================== INCUBATION RECORDS ====================

  async getAllIncubationRecords(req, res, next) {
    try {
      const filters = req.query;
      const records = await animalService.getAllIncubationRecords(filters);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getIncubationRecordById(req, res, next) {
    try {
      const { id } = req.params;
      const record = await animalService.getIncubationRecordById(parseInt(id));
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async getIncubationRecordsByGroup(req, res, next) {
    try {
      const { groupId } = req.params;
      const records = await animalService.getIncubationRecordsByGroup(parseInt(groupId));
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async createIncubationRecord(req, res, next) {
    try {
      const data = { ...req.body, recorded_by: req.user.id };
      const record = await animalService.createIncubationRecord(data);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async updateIncubationRecord(req, res, next) {
    try {
      const { id } = req.params;
      const data = { ...req.body, recorded_by: req.user.id };
      const record = await animalService.updateIncubationRecord(parseInt(id), data);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteIncubationRecord(req, res, next) {
    try {
      const { id } = req.params;
      await animalService.deleteIncubationRecord(parseInt(id));
      res.json({ success: true, message: 'Incubation record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getActiveIncubations(req, res, next) {
    try {
      const records = await animalService.getActiveIncubations();
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getDueToHatch(req, res, next) {
    try {
      const { days } = req.query;
      const records = await animalService.getDueToHatch(parseInt(days) || 7);
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getOverdueHatching(req, res, next) {
    try {
      const records = await animalService.getOverdueHatching();
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async getIncubationStatistics(req, res, next) {
    try {
      const filters = req.query;
      const stats = await animalService.getIncubationStatistics(filters);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getHatchRateByBreed(req, res, next) {
    try {
      const filters = req.query;
      const rates = await animalService.getHatchRateByBreed(filters);
      res.json({ success: true, data: rates });
    } catch (error) {
      next(error);
    }
  }

  async getMonthlyIncubationSummary(req, res, next) {
    try {
      const { months } = req.query;
      const summary = await animalService.getMonthlyIncubationSummary(parseInt(months) || 6);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnimalController();
