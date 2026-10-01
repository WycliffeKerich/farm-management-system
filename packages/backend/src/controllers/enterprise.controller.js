const enterpriseService = require('../services/enterprise.service');

/**
 * Controller for enterprise endpoints
 */
class EnterpriseController {
  async list(req, res, next) {
    try {
      const { page, limit, sort, order, enterprise_type, is_active } = req.query;
      const result = await enterpriseService.getAll(
        parseInt(page, 10) || 1,
        parseInt(limit, 10) || 20,
        { enterprise_type, is_active },
        { field: sort, order }
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const enterprise = await enterpriseService.getById(req.params.id);
      res.json({ success: true, data: enterprise });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const enterprise = await enterpriseService.create(req.body);
      res.status(201).json({ success: true, data: enterprise });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const enterprise = await enterpriseService.update(req.params.id, req.body);
      res.json({ success: true, data: enterprise });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await enterpriseService.delete(req.params.id);
      res.json({ success: true, message: 'Enterprise deleted' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EnterpriseController();
