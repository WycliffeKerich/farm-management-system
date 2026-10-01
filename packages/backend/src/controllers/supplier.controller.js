const supplierService = require('../services/supplier.service');

/**
 * Controller for supplier endpoints
 */
class SupplierController {
  async list(req, res, next) {
    try {
      const { search, include_inactive } = req.query;
      const suppliers = await supplierService.getAll({ search, include_inactive });
      res.json({ success: true, data: suppliers });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      res.json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const supplier = await supplierService.create(req.body);
      res.status(201).json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      res.json({ success: true, data: supplier });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await supplierService.delete(req.params.id);
      res.json({ success: true, message: 'Supplier deleted' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SupplierController();
