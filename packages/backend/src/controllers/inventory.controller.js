const inventoryService = require('../services/inventory.service');

/**
 * Controller for inventory management endpoints
 */
class InventoryController {
  // ==================== CATEGORIES ====================

  /**
   * Get all inventory categories
   */
  async getCategories(req, res, next) {
    try {
      const categories = await inventoryService.getAllCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(req, res, next) {
    try {
      const category = await inventoryService.getCategoryById(req.params.id);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new category
   */
  async createCategory(req, res, next) {
    try {
      const category = await inventoryService.createCategory(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a category
   */
  async updateCategory(req, res, next) {
    try {
      const category = await inventoryService.updateCategory(req.params.id, req.body);
      res.json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a category
   */
  async deleteCategory(req, res, next) {
    try {
      await inventoryService.deleteCategory(req.params.id);
      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== ITEMS ====================

  /**
   * Get all inventory items
   */
  async getItems(req, res, next) {
    try {
      const { page, limit, category_id, search, low_stock, expiring_days } = req.query;

      if (page || limit) {
        const result = await inventoryService.paginateItems(
          parseInt(page, 10) || 1,
          parseInt(limit, 10) || 20,
          { category_id, search, low_stock: low_stock === 'true', expiring_days }
        );
        res.json({ success: true, ...result });
      } else {
        const items = await inventoryService.getAllItems({ category_id, search });
        res.json({ success: true, data: items });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get item by ID
   */
  async getItemById(req, res, next) {
    try {
      const item = await inventoryService.getItemById(req.params.id);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get item by code
   */
  async getItemByCode(req, res, next) {
    try {
      const item = await inventoryService.getItemByCode(req.params.code);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new item
   */
  async createItem(req, res, next) {
    try {
      const item = await inventoryService.createItem(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an item
   */
  async updateItem(req, res, next) {
    try {
      const item = await inventoryService.updateItem(req.params.id, req.body);
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete an item
   */
  async deleteItem(req, res, next) {
    try {
      await inventoryService.deleteItem(req.params.id);
      res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ==================== STOCK MANAGEMENT ====================

  /**
   * Get low stock items
   */
  async getLowStockItems(req, res, next) {
    try {
      const items = await inventoryService.getLowStockItems();
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get expiring items
   */
  async getExpiringItems(req, res, next) {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      const items = await inventoryService.getExpiringItems(days);
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Create a transaction
   */
  async createTransaction(req, res, next) {
    try {
      const transaction = await inventoryService.recordTransaction(req.body, req.user.id);
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transactions for an item
   */
  async getItemTransactions(req, res, next) {
    try {
      const { transaction_type, date_from, date_to } = req.query;
      const transactions = await inventoryService.getItemTransactions(req.params.id, {
        transaction_type,
        date_from,
        date_to,
      });
      res.json({ success: true, data: transactions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all transactions (paginated)
   */
  async getTransactions(req, res, next) {
    try {
      const { page, limit, item_id, transaction_type, date_from, date_to, reference_type } =
        req.query;
      const result = await inventoryService.paginateTransactions(
        parseInt(page, 10) || 1,
        parseInt(limit, 10) || 20,
        { item_id, transaction_type, date_from, date_to, reference_type }
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ==================== REPORTS ====================

  /**
   * Get usage report for an item
   */
  async getUsageReport(req, res, next) {
    try {
      const { date_from, date_to } = req.query;
      if (!date_from || !date_to) {
        return res.status(400).json({
          success: false,
          message: 'date_from and date_to query parameters are required',
        });
      }
      const report = await inventoryService.getUsageReport(req.params.id, date_from, date_to);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get inventory summary
   */
  async getSummary(req, res, next) {
    try {
      const summary = await inventoryService.getInventorySummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }

  // ==================== UNITS OF MEASURE ====================

  /**
   * Get all units of measure
   */
  async getUnitsOfMeasure(req, res, next) {
    try {
      const { category } = req.query;
      let units;
      if (category) {
        units = await inventoryService.getUnitsByCategory(category);
      } else {
        units = await inventoryService.getAllUnitsOfMeasure();
      }
      res.json({ success: true, data: units });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unit categories
   */
  async getUnitCategories(req, res, next) {
    try {
      const categories = await inventoryService.getUnitCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unit by ID
   */
  async getUnitById(req, res, next) {
    try {
      const unit = await inventoryService.getUnitById(req.params.id);
      res.json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a unit of measure
   */
  async createUnit(req, res, next) {
    try {
      const unit = await inventoryService.createUnit(req.body);
      res.status(201).json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a unit of measure
   */
  async updateUnit(req, res, next) {
    try {
      const unit = await inventoryService.updateUnit(req.params.id, req.body);
      res.json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a unit of measure
   */
  async deleteUnit(req, res, next) {
    try {
      await inventoryService.deleteUnit(req.params.id);
      res.json({ success: true, message: 'Unit deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Convert units
   */
  async convertUnits(req, res, next) {
    try {
      const { quantity, from_unit_id, to_unit_id } = req.body;
      const result = await inventoryService.convertUnits(quantity, from_unit_id, to_unit_id);
      res.json({ success: true, data: { converted_quantity: result } });
    } catch (error) {
      next(error);
    }
  }

  // ==================== BATCHES ====================

  /**
   * Get all batches (paginated)
   */
  async getBatches(req, res, next) {
    try {
      const { page, limit, item_id, status, expiring_within_days, search } = req.query;
      const result = await inventoryService.paginateBatches({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        item_id,
        status,
        expiring_within_days: expiring_within_days ? parseInt(expiring_within_days, 10) : undefined,
        search,
      });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get batch by ID
   */
  async getBatchById(req, res, next) {
    try {
      const batch = await inventoryService.getBatchById(req.params.id);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get batches for an item
   */
  async getItemBatches(req, res, next) {
    try {
      const { include_expired, include_depleted } = req.query;
      const batches = await inventoryService.getItemBatches(req.params.id, {
        includeExpired: include_expired === 'true',
        includeDepleted: include_depleted === 'true',
      });
      res.json({ success: true, data: batches });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get expiring batches
   */
  async getExpiringBatches(req, res, next) {
    try {
      const days = parseInt(req.query.days, 10) || 30;
      const batches = await inventoryService.getExpiringBatches(days);
      res.json({ success: true, data: batches });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get expired batches
   */
  async getExpiredBatches(req, res, next) {
    try {
      const batches = await inventoryService.getExpiredBatches();
      res.json({ success: true, data: batches });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a batch
   */
  async createBatch(req, res, next) {
    try {
      const batch = await inventoryService.createBatch(req.body, req.user.id);
      res.status(201).json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a batch
   */
  async updateBatch(req, res, next) {
    try {
      const batch = await inventoryService.updateBatch(req.params.id, req.body);
      res.json({ success: true, data: batch });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a batch
   */
  async deleteBatch(req, res, next) {
    try {
      await inventoryService.deleteBatch(req.params.id);
      res.json({ success: true, message: 'Batch deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark expired batches
   */
  async markExpiredBatches(req, res, next) {
    try {
      const count = await inventoryService.markExpiredBatches();
      res.json({ success: true, data: { marked_count: count } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();
