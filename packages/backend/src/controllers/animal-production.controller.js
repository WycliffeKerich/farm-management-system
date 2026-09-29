const animalProductionService = require('../services/animal-production.service');

class AnimalProductionController {
  // ==================== PRODUCTION TYPES ====================

  async getAllProductionTypes(req, res, next) {
    try {
      const types = await animalProductionService.getAllProductionTypes(req.query);
      res.json({ success: true, data: types });
    } catch (error) {
      next(error);
    }
  }

  async getProductionTypeById(req, res, next) {
    try {
      const type = await animalProductionService.getProductionTypeById(req.params.id);
      res.json({ success: true, data: type });
    } catch (error) {
      next(error);
    }
  }

  async createProductionType(req, res, next) {
    try {
      const type = await animalProductionService.createProductionType(req.body);
      res.status(201).json({ success: true, data: type });
    } catch (error) {
      next(error);
    }
  }

  async updateProductionType(req, res, next) {
    try {
      const type = await animalProductionService.updateProductionType(req.params.id, req.body);
      res.json({ success: true, data: type });
    } catch (error) {
      next(error);
    }
  }

  async deleteProductionType(req, res, next) {
    try {
      const result = await animalProductionService.deleteProductionType(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== PRODUCTION RECORDS ====================

  async getAllProductionRecords(req, res, next) {
    try {
      const result = await animalProductionService.getAllProductionRecords(req.query);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getProductionRecordById(req, res, next) {
    try {
      const record = await animalProductionService.getProductionRecordById(req.params.id);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async createProductionRecord(req, res, next) {
    try {
      const userId = req.user?.id;
      const record = await animalProductionService.createProductionRecord(req.body, userId);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async updateProductionRecord(req, res, next) {
    try {
      const record = await animalProductionService.updateProductionRecord(req.params.id, req.body);
      res.json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteProductionRecord(req, res, next) {
    try {
      const result = await animalProductionService.deleteProductionRecord(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== STATISTICS ====================

  async getProductionStatistics(req, res, next) {
    try {
      const stats = await animalProductionService.getProductionStatistics(req.query);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getDailyProductionSummary(req, res, next) {
    try {
      const summary = await animalProductionService.getDailyProductionSummary(req.query);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  async getProductionBySource(req, res, next) {
    try {
      const data = await animalProductionService.getProductionBySource(req.query);
      res.json({ success: true, data: data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnimalProductionController();
