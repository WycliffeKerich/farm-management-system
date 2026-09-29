const BaseRepository = require('./base.repository');

/**
 * Repository for inventory batches
 */
class InventoryBatchRepository extends BaseRepository {
  constructor() {
    super('inventory_batches');
  }

  /**
   * Find batch by batch number
   * @param {string} batchNumber - Batch number
   * @returns {Promise<Object|null>} Batch or null
   */
  async findByBatchNumber(batchNumber) {
    const query = `
      SELECT
        ib.*,
        ii.name as item_name,
        ii.item_code,
        ic.name as category_name,
        uom.symbol as unit_symbol
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
      LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
      WHERE ib.batch_number = $1 AND ib.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [batchNumber]);
  }

  /**
   * Find batches by item ID
   * @param {number} itemId - Inventory item ID
   * @param {Object} options - Options (includeExpired, includeDepleted)
   * @returns {Promise<Array>} Batches for item
   */
  async findByItemId(itemId, options = {}) {
    const { includeExpired = false, includeDepleted = false } = options;

    let query = `
      SELECT
        ib.*,
        ii.name as item_name,
        ii.item_code,
        uom.symbol as unit_symbol
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
      WHERE ib.inventory_item_id = $1 AND ib.deleted_at IS NULL
    `;

    if (!includeExpired) {
      query += ` AND ib.status != 'expired'`;
    }

    if (!includeDepleted) {
      query += ` AND ib.status != 'depleted'`;
    }

    query += ` ORDER BY ib.expiry_date ASC NULLS LAST, ib.received_date ASC`;

    return await this.db.any(query, [itemId]);
  }

  /**
   * Find active batches for an item (FIFO order)
   * @param {number} itemId - Inventory item ID
   * @returns {Promise<Array>} Active batches sorted by expiry date (FEFO) then received date (FIFO)
   */
  async findActiveBatchesFIFO(itemId) {
    const query = `
      SELECT
        ib.*,
        ii.name as item_name,
        ii.item_code,
        uom.symbol as unit_symbol
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
      WHERE ib.inventory_item_id = $1
        AND ib.status = 'active'
        AND ib.quantity > 0
        AND ib.deleted_at IS NULL
      ORDER BY ib.expiry_date ASC NULLS LAST, ib.received_date ASC, ib.id ASC
    `;
    return await this.db.any(query, [itemId]);
  }

  /**
   * Find expiring batches
   * @param {number} days - Days until expiry
   * @returns {Promise<Array>} Expiring batches
   */
  async findExpiring(days = 30) {
    const query = `
      SELECT
        ib.*,
        ii.name as item_name,
        ii.item_code,
        ic.name as category_name,
        uom.symbol as unit_symbol,
        ib.expiry_date - CURRENT_DATE as days_until_expiry
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
      LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
      WHERE ib.expiry_date IS NOT NULL
        AND ib.expiry_date <= CURRENT_DATE + $1
        AND ib.expiry_date >= CURRENT_DATE
        AND ib.status = 'active'
        AND ib.quantity > 0
        AND ib.deleted_at IS NULL
        AND ii.deleted_at IS NULL
      ORDER BY ib.expiry_date ASC
    `;
    return await this.db.any(query, [days]);
  }

  /**
   * Find expired batches
   * @returns {Promise<Array>} Expired batches
   */
  async findExpired() {
    const query = `
      SELECT
        ib.*,
        ii.name as item_name,
        ii.item_code,
        ic.name as category_name,
        uom.symbol as unit_symbol
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
      LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
      WHERE ib.expiry_date IS NOT NULL
        AND ib.expiry_date < CURRENT_DATE
        AND ib.status = 'active'
        AND ib.quantity > 0
        AND ib.deleted_at IS NULL
        AND ii.deleted_at IS NULL
      ORDER BY ib.expiry_date ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Deduct quantity from batches using FEFO (First Expiry First Out)
   * @param {number} itemId - Inventory item ID
   * @param {number} quantity - Quantity to deduct
   * @returns {Promise<Array>} Array of batch deductions made
   */
  async deductQuantityFEFO(itemId, quantity) {
    const batches = await this.findActiveBatchesFIFO(itemId);
    const deductions = [];
    let remainingQuantity = quantity;

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      const deductAmount = Math.min(batch.quantity, remainingQuantity);

      // Update batch quantity
      const newQuantity = batch.quantity - deductAmount;
      await this.update(batch.id, { quantity: newQuantity });

      deductions.push({
        batch_id: batch.id,
        batch_number: batch.batch_number,
        quantity_deducted: deductAmount,
        remaining_in_batch: newQuantity,
      });

      remainingQuantity -= deductAmount;
    }

    if (remainingQuantity > 0) {
      throw new Error(
        `Insufficient stock. Requested: ${quantity}, Available: ${quantity - remainingQuantity}`
      );
    }

    return deductions;
  }

  /**
   * Add quantity to a specific batch
   * @param {number} batchId - Batch ID
   * @param {number} quantity - Quantity to add
   * @returns {Promise<Object>} Updated batch
   */
  async addQuantity(batchId, quantity) {
    const query = `
      UPDATE ${this.tableName}
      SET quantity = quantity + $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [batchId, quantity]);
  }

  /**
   * Get batch summary for an item
   * @param {number} itemId - Inventory item ID
   * @returns {Promise<Object>} Batch summary
   */
  async getBatchSummary(itemId) {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_batch_count,
        COUNT(*) FILTER (WHERE status = 'depleted') as depleted_batch_count,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_batch_count,
        SUM(CASE WHEN status = 'active' THEN quantity ELSE 0 END) as total_active_quantity,
        MIN(expiry_date) FILTER (WHERE status = 'active' AND quantity > 0) as earliest_expiry,
        MAX(expiry_date) FILTER (WHERE status = 'active' AND quantity > 0) as latest_expiry,
        SUM(CASE WHEN status = 'active' THEN total_cost ELSE 0 END) as total_value
      FROM ${this.tableName}
      WHERE inventory_item_id = $1 AND deleted_at IS NULL
    `;
    return await this.db.one(query, [itemId]);
  }

  /**
   * Mark expired batches
   * Updates status to 'expired' for batches past their expiry date
   * @returns {Promise<number>} Number of batches marked as expired
   */
  async markExpiredBatches() {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE expiry_date < CURRENT_DATE
        AND status = 'active'
        AND deleted_at IS NULL
      RETURNING id
    `;
    const result = await this.db.any(query);
    return result.length;
  }

  /**
   * Get batches with pagination and filters
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Paginated batches
   */
  async findWithFilters(params = {}) {
    const {
      page = 1,
      limit = 20,
      item_id,
      status,
      expiring_within_days,
      search,
    } = params;

    const offset = (page - 1) * limit;
    const values = [];
    let paramIndex = 1;

    let query = `
      SELECT
        ib.*,
        ii.name as item_name,
        ii.item_code,
        ic.name as category_name,
        uom.symbol as unit_symbol,
        u.full_name as created_by_name
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
      LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
      LEFT JOIN users u ON ib.created_by = u.id
      WHERE ib.deleted_at IS NULL AND ii.deleted_at IS NULL
    `;

    let countQuery = `
      SELECT COUNT(*) as count
      FROM ${this.tableName} ib
      JOIN inventory_items ii ON ib.inventory_item_id = ii.id
      WHERE ib.deleted_at IS NULL AND ii.deleted_at IS NULL
    `;

    if (item_id) {
      query += ` AND ib.inventory_item_id = $${paramIndex}`;
      countQuery += ` AND ib.inventory_item_id = $${paramIndex}`;
      values.push(item_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND ib.status = $${paramIndex}`;
      countQuery += ` AND ib.status = $${paramIndex}`;
      values.push(status);
      paramIndex++;
    }

    if (expiring_within_days) {
      query += ` AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= CURRENT_DATE + $${paramIndex} AND ib.expiry_date >= CURRENT_DATE`;
      countQuery += ` AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= CURRENT_DATE + $${paramIndex} AND ib.expiry_date >= CURRENT_DATE`;
      values.push(expiring_within_days);
      paramIndex++;
    }

    if (search) {
      query += ` AND (ib.batch_number ILIKE $${paramIndex} OR ii.name ILIKE $${paramIndex} OR ii.item_code ILIKE $${paramIndex})`;
      countQuery += ` AND (ib.batch_number ILIKE $${paramIndex} OR ii.name ILIKE $${paramIndex} OR ii.item_code ILIKE $${paramIndex})`;
      values.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY ib.expiry_date ASC NULLS LAST, ib.received_date DESC`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const countValues = [...values];
    values.push(limit, offset);

    const [data, countResult] = await Promise.all([
      this.db.any(query, values),
      this.db.one(countQuery, countValues),
    ]);

    const total = parseInt(countResult.count, 10);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = new InventoryBatchRepository();
