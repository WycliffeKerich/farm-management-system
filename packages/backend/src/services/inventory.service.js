const inventoryCategoryRepository = require('../repositories/inventory-category.repository');
const inventoryItemRepository = require('../repositories/inventory-item.repository');
const inventoryTransactionRepository = require('../repositories/inventory-transaction.repository');
const inventoryBatchRepository = require('../repositories/inventory-batch.repository');
const unitOfMeasureRepository = require('../repositories/unit-of-measure.repository');
const { INVENTORY_TRANSACTION_TYPES } = require('../config/constants');

/**
 * Service for inventory management
 */
class InventoryService {
  // ==================== CATEGORY PREFIXES ====================
  static CATEGORY_PREFIXES = {
    Seeds: 'SED',
    Feed: 'FED',
    Fertilizer: 'FER',
    Pesticide: 'PES',
    Medicine: 'MED',
    Equipment: 'EQP',
    Supplies: 'SUP',
  };

  // ==================== INVENTORY CATEGORIES ====================

  /**
   * Get all inventory categories
   * @returns {Promise<Array>} Categories
   */
  async getAllCategories() {
    return await inventoryCategoryRepository.findAllWithItemCounts();
  }

  /**
   * Get category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object>} Category
   */
  async getCategoryById(id) {
    const category = await inventoryCategoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }
    return category;
  }

  /**
   * Create a new category
   * @param {Object} data - Category data
   * @returns {Promise<Object>} Created category
   */
  async createCategory(data) {
    const existing = await inventoryCategoryRepository.findByName(data.name);
    if (existing) {
      throw new Error('Category with this name already exists');
    }
    return await inventoryCategoryRepository.create(data);
  }

  /**
   * Update a category
   * @param {number} id - Category ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated category
   */
  async updateCategory(id, data) {
    const category = await inventoryCategoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    if (data.name && data.name !== category.name) {
      const existing = await inventoryCategoryRepository.findByName(data.name);
      if (existing) {
        throw new Error('Category with this name already exists');
      }
    }

    return await inventoryCategoryRepository.update(id, data);
  }

  /**
   * Delete a category
   * @param {number} id - Category ID
   */
  async deleteCategory(id) {
    const category = await inventoryCategoryRepository.findById(id);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check if category has items
    const items = await inventoryItemRepository.findAll({ category_id: id });
    if (items.length > 0) {
      throw new Error('Cannot delete category with existing items');
    }

    await inventoryCategoryRepository.softDelete(id);
  }

  // ==================== INVENTORY ITEMS ====================

  /**
   * Get all inventory items
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Items
   */
  async getAllItems(filters = {}) {
    return await inventoryItemRepository.findAllWithCategory(filters);
  }

  /**
   * Get item by ID
   * @param {number} id - Item ID
   * @returns {Promise<Object>} Item
   */
  async getItemById(id) {
    const item = await inventoryItemRepository.findByIdWithCategory(id);
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  }

  /**
   * Get item by item code
   * @param {string} itemCode - Item code
   * @returns {Promise<Object>} Item
   */
  async getItemByCode(itemCode) {
    const item = await inventoryItemRepository.findByItemCode(itemCode);
    if (!item) {
      throw new Error('Item not found');
    }
    return item;
  }

  /**
   * Create a new inventory item
   * @param {Object} data - Item data
   * @returns {Promise<Object>} Created item
   */
  async createItem(data) {
    // Verify category exists
    const category = await inventoryCategoryRepository.findById(data.category_id);
    if (!category) {
      throw new Error('Category not found');
    }

    // Check for duplicate name in category
    const existing = await inventoryItemRepository.findByNameInCategory(
      data.name,
      data.category_id
    );
    if (existing) {
      throw new Error('Item with this name already exists in this category');
    }

    // Generate item code
    const prefix = InventoryService.CATEGORY_PREFIXES[category.name] || 'INV';
    const itemCode = await inventoryItemRepository.getNextItemCode(prefix);

    const itemData = {
      ...data,
      item_code: itemCode,
      current_stock: data.current_stock || 0,
      minimum_stock: data.minimum_stock || 0,
    };

    return await inventoryItemRepository.create(itemData);
  }

  /**
   * Update an inventory item
   * @param {number} id - Item ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated item
   */
  async updateItem(id, data) {
    const item = await inventoryItemRepository.findById(id);
    if (!item) {
      throw new Error('Item not found');
    }

    // If changing category, verify it exists
    if (data.category_id && data.category_id !== item.category_id) {
      const category = await inventoryCategoryRepository.findById(data.category_id);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    // If changing name, check for duplicates
    if (data.name && data.name !== item.name) {
      const categoryId = data.category_id || item.category_id;
      const existing = await inventoryItemRepository.findByNameInCategory(data.name, categoryId);
      if (existing && existing.id !== id) {
        throw new Error('Item with this name already exists in this category');
      }
    }

    // Don't allow direct stock updates through this method
    delete data.current_stock;
    delete data.item_code;

    return await inventoryItemRepository.update(id, data);
  }

  /**
   * Delete an inventory item
   * @param {number} id - Item ID
   */
  async deleteItem(id) {
    const item = await inventoryItemRepository.findById(id);
    if (!item) {
      throw new Error('Item not found');
    }

    await inventoryItemRepository.softDelete(id);
  }

  /**
   * Paginate inventory items with filters
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Paginated results
   */
  async paginateItems(page, limit, filters) {
    return await inventoryItemRepository.paginateWithFilters(page, limit, filters);
  }

  // ==================== STOCK MANAGEMENT ====================

  /**
   * Get items with low stock
   * @returns {Promise<Array>} Low stock items
   */
  async getLowStockItems() {
    return await inventoryItemRepository.findLowStock();
  }

  /**
   * Get items expiring within specified days
   * @param {number} days - Number of days (default 30)
   * @returns {Promise<Array>} Expiring items
   */
  async getExpiringItems(days = 30) {
    return await inventoryItemRepository.findExpiring(days);
  }

  // ==================== INVENTORY TRANSACTIONS ====================

  /**
   * Record an inventory transaction
   * @param {Object} data - Transaction data
   * @param {number} userId - User ID who created the transaction
   * @returns {Promise<Object>} Created transaction
   */
  async recordTransaction(data, userId) {
    // Verify item exists
    const item = await inventoryItemRepository.findById(data.item_id);
    if (!item) {
      throw new Error('Item not found');
    }

    // Calculate total cost if not provided
    const unitCost = data.unit_cost || item.cost_per_unit || 0;
    const totalCost = data.total_cost || (unitCost * Math.abs(data.quantity));

    // Determine stock change based on transaction type
    let stockChange = 0;
    switch (data.transaction_type) {
      case INVENTORY_TRANSACTION_TYPES.PURCHASE:
      case INVENTORY_TRANSACTION_TYPES.RETURN:
        stockChange = Math.abs(data.quantity);
        break;
      case INVENTORY_TRANSACTION_TYPES.USAGE:
      case INVENTORY_TRANSACTION_TYPES.EXPIRED:
      case INVENTORY_TRANSACTION_TYPES.TRANSFER:
        stockChange = -Math.abs(data.quantity);
        // Verify sufficient stock
        if (item.current_stock + stockChange < 0) {
          throw new Error('Insufficient stock for this transaction');
        }
        break;
      case INVENTORY_TRANSACTION_TYPES.ADJUSTMENT:
        // Adjustment can be positive or negative
        stockChange = data.quantity;
        if (item.current_stock + stockChange < 0) {
          throw new Error('Adjustment would result in negative stock');
        }
        break;
      default:
        throw new Error('Invalid transaction type');
    }

    const transactionData = {
      item_id: data.item_id,
      transaction_type: data.transaction_type,
      quantity: data.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      reference_type: data.reference_type || null,
      reference_id: data.reference_id || null,
      notes: data.notes || null,
      transaction_date: data.transaction_date || new Date(),
      created_by: userId,
    };

    // Create transaction
    const transaction = await inventoryTransactionRepository.createWithItemInfo(transactionData);

    // Update stock level
    await inventoryItemRepository.updateStock(data.item_id, stockChange);

    return transaction;
  }

  /**
   * Get transactions for an item
   * @param {number} itemId - Item ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Transactions
   */
  async getItemTransactions(itemId, filters = {}) {
    // Verify item exists
    const item = await inventoryItemRepository.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    return await inventoryTransactionRepository.findByItemId(itemId, filters);
  }

  /**
   * Get transactions by reference
   * @param {string} referenceType - Reference type
   * @param {number} referenceId - Reference ID
   * @returns {Promise<Array>} Transactions
   */
  async getTransactionsByReference(referenceType, referenceId) {
    return await inventoryTransactionRepository.findByReference(referenceType, referenceId);
  }

  /**
   * Paginate transactions
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Paginated results
   */
  async paginateTransactions(page, limit, filters) {
    return await inventoryTransactionRepository.paginateWithFilters(page, limit, filters);
  }

  // ==================== REPORTS ====================

  /**
   * Get usage report for an item
   * @param {number} itemId - Item ID
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Object>} Usage report
   */
  async getUsageReport(itemId, dateFrom, dateTo) {
    // Verify item exists
    const item = await inventoryItemRepository.findByIdWithCategory(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    const report = await inventoryTransactionRepository.getUsageReport(itemId, dateFrom, dateTo);

    return {
      item,
      date_range: {
        from: dateFrom,
        to: dateTo,
      },
      ...report,
    };
  }

  /**
   * Get inventory summary
   * @returns {Promise<Object>} Summary statistics
   */
  async getInventorySummary() {
    const categories = await inventoryCategoryRepository.findAllWithItemCounts();
    const lowStockItems = await inventoryItemRepository.findLowStock();
    const expiringItems = await inventoryItemRepository.findExpiring(30);
    const expiringBatches = await inventoryBatchRepository.findExpiring(30);

    const totalItems = categories.reduce((sum, cat) => sum + parseInt(cat.item_count, 10), 0);
    const totalValue = categories.reduce(
      (sum, cat) => sum + parseFloat(cat.total_value || 0),
      0
    );

    return {
      total_items: totalItems,
      total_value: totalValue,
      low_stock_count: lowStockItems.length,
      expiring_count: expiringItems.length,
      expiring_batches_count: expiringBatches.length,
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        item_count: parseInt(cat.item_count, 10),
        total_value: parseFloat(cat.total_value || 0),
      })),
    };
  }

  // ==================== UNITS OF MEASURE ====================

  /**
   * Get all units of measure
   * @returns {Promise<Array>} Units grouped by category
   */
  async getAllUnitsOfMeasure() {
    return await unitOfMeasureRepository.findAllGroupedByCategory();
  }

  /**
   * Get units by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Units in category
   */
  async getUnitsByCategory(category) {
    return await unitOfMeasureRepository.findByCategory(category);
  }

  /**
   * Get unit of measure by ID
   * @param {number} id - Unit ID
   * @returns {Promise<Object>} Unit
   */
  async getUnitById(id) {
    const unit = await unitOfMeasureRepository.findById(id);
    if (!unit) {
      throw new Error('Unit of measure not found');
    }
    return unit;
  }

  /**
   * Create a new unit of measure
   * @param {Object} data - Unit data
   * @returns {Promise<Object>} Created unit
   */
  async createUnit(data) {
    // Check for duplicate symbol
    const existing = await unitOfMeasureRepository.findBySymbol(data.symbol);
    if (existing) {
      throw new Error('Unit with this symbol already exists');
    }
    return await unitOfMeasureRepository.create(data);
  }

  /**
   * Update a unit of measure
   * @param {number} id - Unit ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated unit
   */
  async updateUnit(id, data) {
    const unit = await unitOfMeasureRepository.findById(id);
    if (!unit) {
      throw new Error('Unit of measure not found');
    }

    if (data.symbol && data.symbol !== unit.symbol) {
      const existing = await unitOfMeasureRepository.findBySymbol(data.symbol);
      if (existing) {
        throw new Error('Unit with this symbol already exists');
      }
    }

    return await unitOfMeasureRepository.update(id, data);
  }

  /**
   * Delete a unit of measure
   * @param {number} id - Unit ID
   */
  async deleteUnit(id) {
    const unit = await unitOfMeasureRepository.findById(id);
    if (!unit) {
      throw new Error('Unit of measure not found');
    }
    await unitOfMeasureRepository.softDelete(id);
  }

  /**
   * Get UOM categories
   * @returns {Promise<Array>} Categories
   */
  async getUnitCategories() {
    return await unitOfMeasureRepository.getCategories();
  }

  /**
   * Convert quantity between units
   * @param {number} quantity - Quantity to convert
   * @param {number} fromUnitId - Source unit ID
   * @param {number} toUnitId - Target unit ID
   * @returns {Promise<number>} Converted quantity
   */
  async convertUnits(quantity, fromUnitId, toUnitId) {
    const result = await unitOfMeasureRepository.convertQuantity(quantity, fromUnitId, toUnitId);
    if (result === null) {
      throw new Error('Cannot convert between these units (different categories)');
    }
    return result;
  }

  // ==================== INVENTORY BATCHES ====================

  /**
   * Get all batches for an item
   * @param {number} itemId - Item ID
   * @param {Object} options - Options
   * @returns {Promise<Array>} Batches
   */
  async getItemBatches(itemId, options = {}) {
    const item = await inventoryItemRepository.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    return await inventoryBatchRepository.findByItemId(itemId, options);
  }

  /**
   * Get batch by ID
   * @param {number} id - Batch ID
   * @returns {Promise<Object>} Batch
   */
  async getBatchById(id) {
    const batch = await inventoryBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Batch not found');
    }
    return batch;
  }

  /**
   * Get batch by batch number
   * @param {string} batchNumber - Batch number
   * @returns {Promise<Object>} Batch
   */
  async getBatchByNumber(batchNumber) {
    const batch = await inventoryBatchRepository.findByBatchNumber(batchNumber);
    if (!batch) {
      throw new Error('Batch not found');
    }
    return batch;
  }

  /**
   * Create a new batch (typically when receiving inventory)
   * @param {Object} data - Batch data
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Created batch
   */
  async createBatch(data, userId) {
    const item = await inventoryItemRepository.findById(data.inventory_item_id);
    if (!item) {
      throw new Error('Item not found');
    }

    const batchData = {
      ...data,
      created_by: userId,
    };

    const batch = await inventoryBatchRepository.create(batchData);

    // Update item's current stock
    await inventoryItemRepository.updateStock(data.inventory_item_id, data.quantity);

    // Record transaction
    await this.recordTransaction(
      {
        item_id: data.inventory_item_id,
        transaction_type: INVENTORY_TRANSACTION_TYPES.PURCHASE,
        quantity: data.quantity,
        unit_cost: data.unit_cost,
        notes: `Batch ${batch.batch_number} received`,
        transaction_date: data.received_date || new Date(),
      },
      userId
    );

    return batch;
  }

  /**
   * Update a batch
   * @param {number} id - Batch ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated batch
   */
  async updateBatch(id, data) {
    const batch = await inventoryBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // Don't allow direct quantity updates - use transactions
    delete data.quantity;
    delete data.initial_quantity;

    return await inventoryBatchRepository.update(id, data);
  }

  /**
   * Delete a batch
   * @param {number} id - Batch ID
   */
  async deleteBatch(id) {
    const batch = await inventoryBatchRepository.findById(id);
    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.quantity > 0) {
      throw new Error('Cannot delete batch with remaining quantity');
    }

    await inventoryBatchRepository.softDelete(id);
  }

  /**
   * Get expiring batches
   * @param {number} days - Days until expiry
   * @returns {Promise<Array>} Expiring batches
   */
  async getExpiringBatches(days = 30) {
    return await inventoryBatchRepository.findExpiring(days);
  }

  /**
   * Get expired batches
   * @returns {Promise<Array>} Expired batches
   */
  async getExpiredBatches() {
    return await inventoryBatchRepository.findExpired();
  }

  /**
   * Mark expired batches
   * @returns {Promise<number>} Number of batches marked
   */
  async markExpiredBatches() {
    return await inventoryBatchRepository.markExpiredBatches();
  }

  /**
   * Get batch summary for an item
   * @param {number} itemId - Item ID
   * @returns {Promise<Object>} Batch summary
   */
  async getBatchSummary(itemId) {
    const item = await inventoryItemRepository.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }
    return await inventoryBatchRepository.getBatchSummary(itemId);
  }

  /**
   * Paginate batches with filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated batches
   */
  async paginateBatches(params) {
    return await inventoryBatchRepository.findWithFilters(params);
  }

  /**
   * Use stock from batches (FEFO - First Expiry First Out)
   * @param {number} itemId - Item ID
   * @param {number} quantity - Quantity to use
   * @param {Object} options - Options (reference_type, reference_id, notes)
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Transaction and deduction details
   */
  async useStockFromBatches(itemId, quantity, options = {}, userId) {
    const item = await inventoryItemRepository.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    if (item.current_stock < quantity) {
      throw new Error(`Insufficient stock. Available: ${item.current_stock}, Requested: ${quantity}`);
    }

    // Deduct from batches using FEFO
    const deductions = await inventoryBatchRepository.deductQuantityFEFO(itemId, quantity);

    // Update item's current stock
    await inventoryItemRepository.updateStock(itemId, -quantity);

    // Record transaction
    const transaction = await inventoryTransactionRepository.createWithItemInfo({
      item_id: itemId,
      transaction_type: INVENTORY_TRANSACTION_TYPES.USAGE,
      quantity: -quantity,
      reference_type: options.reference_type,
      reference_id: options.reference_id,
      notes: options.notes || `Used from ${deductions.length} batch(es)`,
      transaction_date: new Date(),
      created_by: userId,
    });

    return {
      transaction,
      batch_deductions: deductions,
    };
  }
}

module.exports = new InventoryService();
