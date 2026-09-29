const BaseRepository = require('./base.repository');
const { pgp } = require('../config/database');

/**
 * Repository for inventory batches
 *
 * `quantity` is what remains in the batch. It is not writable through
 * update(): it changes through setQuantity, alongside a ledger row.
 */
class InventoryBatchRepository extends BaseRepository {
  constructor() {
    super('inventory_batches', {
      columns: [
        'inventory_item_id',
        'batch_number',
        'initial_quantity',
        'unit_cost',
        'total_cost',
        'manufacture_date',
        'expiry_date',
        'received_date',
        'supplier',
        'supplier_batch_number',
        'storage_location',
        'status',
        'notes',
        'created_by',
      ],
      sortable: ['batch_number', 'expiry_date', 'received_date', 'quantity', 'created_at'],
    });
  }

  /**
   * Insert a batch with its received quantity
   * @param {Object} data - Batch data; `quantity` becomes quantity and initial_quantity
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} Created batch
   */
  async createWithQuantity(data, t) {
    const values = await this.pickWritable({ ...data, initial_quantity: data.quantity });
    values.quantity = data.quantity;
    return this.conn(t).one(pgp.helpers.insert(values, null, this.tableName) + ' RETURNING *');
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
    return this.db.oneOrNone(query, [batchNumber]);
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

    return this.db.any(query, [itemId]);
  }

  /**
   * Lock the batches FEFO may draw from, in the order it draws: earliest
   * expiry first (no expiry last), then oldest received. Expired batches are
   * never used even if the nightly status job has not marked them yet.
   * @param {number} itemId - Inventory item ID
   * @param {Object} t - Transaction (required: the locks only last for its duration)
   * @returns {Promise<Array>} Locked batches
   */
  async lockAvailableForItem(itemId, t) {
    return t.any(
      `SELECT * FROM ${this.tableName}
        WHERE inventory_item_id = $1
          AND status = 'active'
          AND quantity > 0
          AND deleted_at IS NULL
          AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
        ORDER BY expiry_date ASC NULLS LAST, received_date ASC, id ASC
        FOR UPDATE`,
      [itemId]
    );
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
        AND ib.expiry_date <= CURRENT_DATE + $1::int
        AND ib.expiry_date >= CURRENT_DATE
        AND ib.status = 'active'
        AND ib.quantity > 0
        AND ib.deleted_at IS NULL
        AND ii.deleted_at IS NULL
      ORDER BY ib.expiry_date ASC
    `;
    return this.db.any(query, [days]);
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
    return this.db.any(query);
  }

  /**
   * Set what remains in a batch (the status trigger marks it depleted at 0)
   * @param {number} batchId - Batch ID
   * @param {number} quantity - New remaining quantity
   * @param {Object} t - Transaction
   * @returns {Promise<Object>} Updated batch
   */
  async setQuantity(batchId, quantity, t) {
    return t.one(
      `UPDATE ${this.tableName} SET quantity = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [batchId, quantity]
    );
  }

  /**
   * Items whose live batches hold more than the item's stock. Batches are a
   * breakdown of current_stock, so this should never happen.
   * @returns {Promise<Array>} { item_id, item_code, name, current_stock, batch_stock }
   */
  async findItemsWithExcessBatchStock() {
    return this.db.any(`
      SELECT ii.id AS item_id, ii.item_code, ii.name, ii.current_stock, b.batch_stock
        FROM inventory_items ii
        JOIN (
          SELECT inventory_item_id, SUM(quantity) AS batch_stock
            FROM inventory_batches
           WHERE deleted_at IS NULL AND status IN ('active', 'quarantine')
           GROUP BY inventory_item_id
        ) b ON b.inventory_item_id = ii.id
       WHERE b.batch_stock > ii.current_stock
       ORDER BY ii.id`);
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
    return this.db.one(query, [itemId]);
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
        CONCAT(u.first_name, ' ', u.last_name) as created_by_name
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
      query += ` AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= CURRENT_DATE + $${paramIndex}::int AND ib.expiry_date >= CURRENT_DATE`;
      countQuery += ` AND ib.expiry_date IS NOT NULL AND ib.expiry_date <= CURRENT_DATE + $${paramIndex}::int AND ib.expiry_date >= CURRENT_DATE`;
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
