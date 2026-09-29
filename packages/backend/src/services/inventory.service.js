const inventoryCategoryRepository = require('../repositories/inventory-category.repository');
const inventoryItemRepository = require('../repositories/inventory-item.repository');
const inventoryTransactionRepository = require('../repositories/inventory-transaction.repository');
const inventoryBatchRepository = require('../repositories/inventory-batch.repository');
const unitOfMeasureRepository = require('../repositories/unit-of-measure.repository');
const { db } = require('../config/database');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');
const { INVENTORY_TRANSACTION_TYPES, INVENTORY_OUTGOING_TYPES } = require('../config/constants');

/*
 * Stock quantities are NUMERIC(10,2). Arithmetic is done in whole hundredths so
 * JS floats never drift (0.1 + 0.2) before a comparison or a write.
 */
const toHundredths = (value) => Math.round(Number(value) * 100);
const fromHundredths = (value) => value / 100;

/**
 * Parse a quantity to a 2-decimal number
 * @param {*} value
 * @returns {number}
 */
function toQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new ValidationError('Quantity must be a number');
  }
  return fromHundredths(toHundredths(number));
}

function insufficientStock(available, requested, unit) {
  return new ConflictError(
    `Insufficient stock: ${available}${unit ? ` ${unit}` : ''} available, ${requested} requested`,
    'INSUFFICIENT_STOCK',
    { available, requested }
  );
}

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
      throw new NotFoundError('Category not found');
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
      throw new ConflictError('Category with this name already exists', 'DUPLICATE');
    }
    return await inventoryCategoryRepository.create({
      ...data,
      type: data.type || data.name.toLowerCase().replace(/\s+/g, '_'),
    });
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
      throw new NotFoundError('Category not found');
    }

    if (data.name && data.name !== category.name) {
      const existing = await inventoryCategoryRepository.findByName(data.name);
      if (existing) {
        throw new ConflictError('Category with this name already exists', 'DUPLICATE');
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
      throw new NotFoundError('Category not found');
    }

    // Check if category has items
    const items = await inventoryItemRepository.findAll({ category_id: id });
    if (items.length > 0) {
      throw new ConflictError('Cannot delete a category that still has items', 'IN_USE');
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
      throw new NotFoundError('Item not found');
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
      throw new NotFoundError('Item not found');
    }
    return item;
  }

  /**
   * Create a new inventory item
   * @param {Object} data - Item data
   * @returns {Promise<Object>} Created item
   */
  async createItem(data, userId) {
    const category = await inventoryCategoryRepository.findById(data.category_id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const existing = await inventoryItemRepository.findByNameInCategory(data.name, data.category_id);
    if (existing) {
      throw new ConflictError('Item with this name already exists in this category', 'DUPLICATE');
    }

    const openingStock = data.current_stock ? toQuantity(data.current_stock) : 0;
    if (openingStock < 0) {
      throw new ValidationError('Opening stock cannot be negative');
    }

    return db.tx(async (t) => {
      const prefix = InventoryService.CATEGORY_PREFIXES[category.name] || 'INV';
      const item = await inventoryItemRepository.create(
        {
          ...data,
          item_code: await inventoryItemRepository.getNextItemCode(prefix, t),
          minimum_stock: data.minimum_stock || 0,
        },
        t
      );

      // Opening stock goes through the ledger like any other stock change
      if (openingStock > 0) {
        await this.recordTransaction(
          {
            item_id: item.id,
            transaction_type: INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
            quantity: openingStock,
            notes: 'Opening stock',
          },
          userId,
          t
        );
        return inventoryItemRepository.findById(item.id, t);
      }
      return item;
    });
  }

  /**
   * Update an inventory item
   * @param {number} id - Item ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated item
   */
  async updateItem(id, data) {
    id = Number(id);
    const item = await inventoryItemRepository.findById(id);
    if (!item) {
      throw new NotFoundError('Item not found');
    }

    // If changing category, verify it exists
    if (data.category_id && data.category_id !== item.category_id) {
      const category = await inventoryCategoryRepository.findById(data.category_id);
      if (!category) {
        throw new NotFoundError('Category not found');
      }
    }

    // If changing name, check for duplicates
    if (data.name && data.name !== item.name) {
      const categoryId = data.category_id || item.category_id;
      const existing = await inventoryItemRepository.findByNameInCategory(data.name, categoryId);
      if (existing && existing.id !== id) {
        throw new ConflictError('Item with this name already exists in this category', 'DUPLICATE');
      }
    }

    // Stock only changes through the ledger, and codes are permanent
    const { current_stock: _stock, item_code: _code, ...changes } = data;

    return await inventoryItemRepository.update(id, changes);
  }

  /**
   * Delete an inventory item
   * @param {number} id - Item ID
   */
  async deleteItem(id) {
    const item = await inventoryItemRepository.findById(id);
    if (!item) {
      throw new NotFoundError('Item not found');
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
   * Record a stock movement: one ledger row plus the matching stock change,
   * atomically. The item row is locked first, so concurrent movements on the
   * same item run one after another and each sees the stock the previous left.
   *
   * `quantity` is a positive amount; the type decides the direction. An
   * adjustment is signed (+ adds, - removes).
   *
   * @param {Object} data - item_id, transaction_type, quantity, unit_cost?, total_cost?,
   *   reference_type?, reference_id?, notes?, transaction_date?, inventory_batch_id?
   * @param {number} userId - User recording the movement
   * @param {Object} [t] - Outer transaction to join
   * @returns {Promise<Object>} Created ledger row with item info
   * @throws {ConflictError} INSUFFICIENT_STOCK when stock would go negative (nothing is written)
   */
  async recordTransaction(data, userId, t) {
    const type = data.transaction_type;
    if (!Object.values(INVENTORY_TRANSACTION_TYPES).includes(type)) {
      throw new ValidationError('Invalid transaction type');
    }

    const quantity = toQuantity(data.quantity);
    const isAdjustment = type === INVENTORY_TRANSACTION_TYPES.ADJUSTMENT;
    if (isAdjustment ? quantity === 0 : quantity <= 0) {
      throw new ValidationError(isAdjustment ? 'Adjustment quantity cannot be zero' : 'Quantity must be greater than zero');
    }
    const change = INVENTORY_OUTGOING_TYPES.includes(type) ? -quantity : quantity;

    return (t || db).tx(async (tx) => {
      const item = await inventoryItemRepository.findByIdForUpdate(data.item_id, tx);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const stockBefore = item.current_stock;
      const stockAfter = fromHundredths(toHundredths(stockBefore) + toHundredths(change));
      if (stockAfter < 0) {
        throw insufficientStock(stockBefore, Math.abs(change), item.unit);
      }

      const unitCost = data.unit_cost ?? item.cost_per_unit ?? null;
      const totalCost = data.total_cost ?? (unitCost === null ? null : fromHundredths(Math.round(unitCost * Math.abs(quantity) * 100)));

      const transaction = await inventoryTransactionRepository.createWithItemInfo(
        {
          item_id: item.id,
          inventory_batch_id: data.inventory_batch_id,
          transaction_type: type,
          quantity,
          unit_cost: unitCost,
          total_cost: totalCost,
          reference_type: data.reference_type || null,
          reference_id: data.reference_id || null,
          notes: data.notes || null,
          transaction_date: data.transaction_date,
          created_by: userId,
          stock_before: stockBefore,
          stock_after: stockAfter,
        },
        tx
      );
      await inventoryItemRepository.setStock(item.id, stockAfter, tx);

      return transaction;
    });
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
      throw new NotFoundError('Item not found');
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
      throw new NotFoundError('Item not found');
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
      throw new NotFoundError('Unit of measure not found');
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
      throw new ConflictError('Unit with this symbol already exists', 'DUPLICATE');
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
      throw new NotFoundError('Unit of measure not found');
    }

    if (data.symbol && data.symbol !== unit.symbol) {
      const existing = await unitOfMeasureRepository.findBySymbol(data.symbol);
      if (existing) {
        throw new ConflictError('Unit with this symbol already exists', 'DUPLICATE');
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
      throw new NotFoundError('Unit of measure not found');
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
      throw new ValidationError('Cannot convert between these units (different categories)');
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
      throw new NotFoundError('Item not found');
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
      throw new NotFoundError('Batch not found');
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
      throw new NotFoundError('Batch not found');
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
    const quantity = toQuantity(data.quantity);
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be greater than zero');
    }

    return db.tx(async (t) => {
      const item = await inventoryItemRepository.findByIdForUpdate(data.inventory_item_id, t);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const batch = await inventoryBatchRepository.createWithQuantity({ ...data, quantity, created_by: userId }, t);

      // The purchase row adds the batch's quantity to the item's stock
      await this.recordTransaction(
        {
          item_id: item.id,
          inventory_batch_id: batch.id,
          transaction_type: INVENTORY_TRANSACTION_TYPES.PURCHASE,
          quantity,
          unit_cost: data.unit_cost,
          notes: `Batch ${batch.batch_number} received`,
          transaction_date: data.received_date,
        },
        userId,
        t
      );

      return batch;
    });
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
      throw new NotFoundError('Batch not found');
    }

    // Quantities only change through the ledger
    const { quantity: _quantity, initial_quantity: _initial, inventory_item_id: _item, ...changes } = data;

    return await inventoryBatchRepository.update(id, changes);
  }

  /**
   * Delete a batch
   * @param {number} id - Batch ID
   */
  async deleteBatch(id) {
    const batch = await inventoryBatchRepository.findById(id);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    if (batch.quantity > 0) {
      throw new ConflictError('Cannot delete a batch that still has stock', 'HAS_STOCK');
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
      throw new NotFoundError('Item not found');
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
   * Use stock from batches, first expiry first out. Locks the item and its
   * usable batches, checks the batches can cover the whole quantity BEFORE
   * changing anything, then writes one usage ledger row per batch drawn from.
   *
   * @param {number} itemId - Item ID
   * @param {number} quantity - Quantity to use (> 0)
   * @param {Object} options - reference_type, reference_id, notes, transaction_date
   * @param {number} userId - User ID
   * @param {Object} [t] - Outer transaction to join
   * @returns {Promise<Object>} { transactions, batch_deductions, current_stock }
   * @throws {ConflictError} INSUFFICIENT_STOCK when the batches cannot cover it (nothing is written)
   */
  async useStockFromBatches(itemId, quantity, options = {}, userId, t) {
    const requested = toQuantity(quantity);
    if (requested <= 0) {
      throw new ValidationError('Quantity must be greater than zero');
    }

    return (t || db).tx(async (tx) => {
      const item = await inventoryItemRepository.findByIdForUpdate(itemId, tx);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const batches = await inventoryBatchRepository.lockAvailableForItem(item.id, tx);
      const available = batches.reduce((sum, batch) => sum + toHundredths(batch.quantity), 0);
      let remaining = toHundredths(requested);
      if (available < remaining) {
        throw insufficientStock(fromHundredths(available), requested, item.unit);
      }
      if (toHundredths(item.current_stock) < remaining) {
        // Batches claim more than the item holds: the data needs reconciling
        throw insufficientStock(item.current_stock, requested, item.unit);
      }

      let stock = toHundredths(item.current_stock);
      const transactions = [];
      const deductions = [];

      for (const batch of batches) {
        if (remaining === 0) break;

        const take = Math.min(toHundredths(batch.quantity), remaining);
        const left = toHundredths(batch.quantity) - take;
        await inventoryBatchRepository.setQuantity(batch.id, fromHundredths(left), tx);

        const unitCost = batch.unit_cost ?? item.cost_per_unit ?? null;
        transactions.push(
          await inventoryTransactionRepository.createWithItemInfo(
            {
              item_id: item.id,
              inventory_batch_id: batch.id,
              transaction_type: INVENTORY_TRANSACTION_TYPES.USAGE,
              quantity: fromHundredths(take),
              unit_cost: unitCost,
              total_cost: unitCost === null ? null : fromHundredths(Math.round(unitCost * take)),
              reference_type: options.reference_type || null,
              reference_id: options.reference_id || null,
              notes: options.notes || `Used from batch ${batch.batch_number}`,
              transaction_date: options.transaction_date,
              created_by: userId,
              stock_before: fromHundredths(stock),
              stock_after: fromHundredths(stock - take),
            },
            tx
          )
        );
        deductions.push({
          batch_id: batch.id,
          batch_number: batch.batch_number,
          quantity_deducted: fromHundredths(take),
          remaining_in_batch: fromHundredths(left),
        });

        stock -= take;
        remaining -= take;
      }

      await inventoryItemRepository.setStock(item.id, fromHundredths(stock), tx);

      return { transactions, batch_deductions: deductions, current_stock: fromHundredths(stock) };
    });
  }

  // ==================== INTEGRITY ====================

  /**
   * Check stock against its history
   * @returns {Promise<Object>} { ledger, batches }: items whose current_stock differs from
   *   the sum of their ledger, and items whose batches hold more than current_stock.
   *   Both empty when consistent.
   */
  async findStockDrift() {
    const [ledger, batches] = await Promise.all([
      inventoryTransactionRepository.findStockDrift(),
      inventoryBatchRepository.findItemsWithExcessBatchStock(),
    ]);
    return { ledger, batches };
  }
}

module.exports = new InventoryService();
