const BaseRepository = require('./base.repository');

const WITH_NAMES = `
  SELECT it.*, ii.name as item_name, ii.item_code, ii.unit, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
  FROM inventory_transactions it
  JOIN inventory_items ii ON it.item_id = ii.id
  LEFT JOIN users u ON it.created_by = u.id
`;

/**
 * Repository for the inventory ledger
 *
 * `quantity` is always a magnitude, except for adjustments which carry a sign;
 * the SQL function inventory_signed_quantity(type, quantity) gives a row's
 * effect on stock. Rows are append-only history.
 */
class InventoryTransactionRepository extends BaseRepository {
  constructor() {
    super('inventory_transactions', {
      columns: [
        'item_id',
        'inventory_batch_id',
        'transaction_type',
        'quantity',
        'unit_cost',
        'total_cost',
        'transaction_date',
        'reference_type',
        'reference_id',
        'notes',
        'created_by',
        'stock_before',
        'stock_after',
      ],
      sortable: ['transaction_date', 'created_at', 'quantity', 'total_cost'],
    });
  }

  /**
   * Find all transactions for an item
   * @param {number} itemId - Item ID
   * @param {Object} filters - Optional filters (date_from, date_to, transaction_type)
   * @returns {Promise<Array>} Transactions
   */
  async findByItemId(itemId, filters = {}) {
    let query = `${WITH_NAMES} WHERE it.item_id = $1 AND it.deleted_at IS NULL`;
    const values = [itemId];
    let paramIndex = 2;

    if (filters.transaction_type) {
      query += ` AND it.transaction_type = $${paramIndex++}`;
      values.push(filters.transaction_type);
    }

    if (filters.date_from) {
      query += ` AND it.transaction_date >= $${paramIndex++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ` AND it.transaction_date <= $${paramIndex++}`;
      values.push(filters.date_to);
    }

    query += ' ORDER BY it.transaction_date DESC, it.id DESC';

    return this.db.any(query, values);
  }

  /**
   * Find transactions by reference
   * @param {string} referenceType - Reference type
   * @param {number} referenceId - Reference ID
   * @returns {Promise<Array>} Transactions
   */
  async findByReference(referenceType, referenceId) {
    const query = `${WITH_NAMES}
      WHERE it.reference_type = $1 AND it.reference_id = $2 AND it.deleted_at IS NULL
      ORDER BY it.transaction_date DESC, it.id DESC`;
    return this.db.any(query, [referenceType, referenceId]);
  }

  /**
   * What a record has taken from stock and not yet had back: per item and
   * batch, removals less returns made against the same reference
   * @param {string} referenceType - Reference type
   * @param {number} referenceId - Reference ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>} { item_id, inventory_batch_id, quantity, unit_cost } with quantity > 0
   */
  async outstandingByReference(referenceType, referenceId, t) {
    return this.conn(t).any(
      `SELECT item_id, inventory_batch_id,
              SUM(CASE WHEN transaction_type = 'return' THEN -quantity ELSE quantity END) AS quantity,
              MAX(unit_cost) FILTER (WHERE transaction_type <> 'return') AS unit_cost
         FROM inventory_transactions
        WHERE reference_type = $1 AND reference_id = $2 AND deleted_at IS NULL
          AND transaction_type IN ('usage', 'waste', 'transfer', 'return')
        GROUP BY item_id, inventory_batch_id
       HAVING SUM(CASE WHEN transaction_type = 'return' THEN -quantity ELSE quantity END) > 0
        ORDER BY item_id, inventory_batch_id NULLS LAST`,
      [referenceType, referenceId]
    );
  }

  /**
   * Create a ledger row and return it with item and user names
   * @param {Object} data - Transaction data
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} Created transaction with item info
   */
  async createWithItemInfo(data, t) {
    const row = await this.create(data, t);
    return this.conn(t).one(`${WITH_NAMES} WHERE it.id = $1`, [row.id]);
  }

  /**
   * Items whose current_stock differs from the sum of their ledger
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>} { item_id, item_code, name, current_stock, ledger_stock, drift }
   */
  async findStockDrift(t) {
    return this.conn(t).any(`
      SELECT ii.id AS item_id, ii.item_code, ii.name, ii.current_stock,
             COALESCE(l.ledger_stock, 0) AS ledger_stock,
             ii.current_stock - COALESCE(l.ledger_stock, 0) AS drift
        FROM inventory_items ii
        LEFT JOIN (
          SELECT item_id, SUM(inventory_signed_quantity(transaction_type, quantity)) AS ledger_stock
            FROM inventory_transactions
           WHERE deleted_at IS NULL
           GROUP BY item_id
        ) l ON l.item_id = ii.id
       WHERE ii.current_stock <> COALESCE(l.ledger_stock, 0)
       ORDER BY ii.id`);
  }

  /**
   * Get usage report for an item within a date range
   * @param {number} itemId - Item ID
   * @param {string} dateFrom - Start date
   * @param {string} dateTo - End date
   * @returns {Promise<Object>} Usage report
   */
  async getUsageReport(itemId, dateFrom, dateTo) {
    const query = `
      SELECT
        it.transaction_type,
        COUNT(*) as transaction_count,
        SUM(it.quantity) as total_quantity,
        SUM(inventory_signed_quantity(it.transaction_type, it.quantity)) as net_change,
        SUM(it.total_cost) as total_cost
      FROM ${this.tableName} it
      WHERE it.item_id = $1
        AND it.deleted_at IS NULL
        AND it.transaction_date >= $2
        AND it.transaction_date <= $3
      GROUP BY it.transaction_type
      ORDER BY it.transaction_type
    `;
    const summary = await this.db.any(query, [itemId, dateFrom, dateTo]);

    const detailQuery = `
      SELECT it.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM ${this.tableName} it
      LEFT JOIN users u ON it.created_by = u.id
      WHERE it.item_id = $1
        AND it.deleted_at IS NULL
        AND it.transaction_date >= $2
        AND it.transaction_date <= $3
      ORDER BY it.transaction_date DESC
    `;
    const transactions = await this.db.any(detailQuery, [itemId, dateFrom, dateTo]);

    return {
      summary,
      transactions,
    };
  }

  /**
   * Paginate transactions with filters
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>} Paginated results
   */
  async paginateWithFilters(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT it.*, ii.name as item_name, ii.item_code, ii.unit, ic.name as category_name, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM ${this.tableName} it
      JOIN inventory_items ii ON it.item_id = ii.id
      JOIN inventory_categories ic ON ii.category_id = ic.id
      LEFT JOIN users u ON it.created_by = u.id
      WHERE it.deleted_at IS NULL
    `;
    let countQuery = `
      SELECT COUNT(*) as count
      FROM ${this.tableName} it
      JOIN inventory_items ii ON it.item_id = ii.id
      WHERE it.deleted_at IS NULL
    `;
    const values = [];
    const countValues = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (filters.item_id) {
      query += ` AND it.item_id = $${paramIndex++}`;
      countQuery += ` AND it.item_id = $${countParamIndex++}`;
      values.push(filters.item_id);
      countValues.push(filters.item_id);
    }

    if (filters.transaction_type) {
      query += ` AND it.transaction_type = $${paramIndex++}`;
      countQuery += ` AND it.transaction_type = $${countParamIndex++}`;
      values.push(filters.transaction_type);
      countValues.push(filters.transaction_type);
    }

    if (filters.date_from) {
      query += ` AND it.transaction_date >= $${paramIndex++}`;
      countQuery += ` AND it.transaction_date >= $${countParamIndex++}`;
      values.push(filters.date_from);
      countValues.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ` AND it.transaction_date <= $${paramIndex++}`;
      countQuery += ` AND it.transaction_date <= $${countParamIndex++}`;
      values.push(filters.date_to);
      countValues.push(filters.date_to);
    }

    if (filters.reference_type) {
      query += ` AND it.reference_type = $${paramIndex++}`;
      countQuery += ` AND it.reference_type = $${countParamIndex++}`;
      values.push(filters.reference_type);
      countValues.push(filters.reference_type);
    }

    query += ` ORDER BY it.transaction_date DESC, it.id DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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

module.exports = new InventoryTransactionRepository();
