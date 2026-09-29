const BaseRepository = require('./base.repository');

/**
 * Repository for inventory transactions
 * Note: Uses existing schema column names for compatibility
 */
class InventoryTransactionRepository extends BaseRepository {
  constructor() {
    super('inventory_transactions');
  }

  /**
   * Find all transactions for an item
   * @param {number} itemId - Item ID
   * @param {Object} filters - Optional filters (date_from, date_to, transaction_type)
   * @returns {Promise<Array>} Transactions
   */
  async findByItemId(itemId, filters = {}) {
    let query = `
      SELECT it.*, ii.name as item_name, ii.item_code, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM ${this.tableName} it
      JOIN inventory_items ii ON it.item_id = ii.id
      LEFT JOIN users u ON it.created_by = u.id
      WHERE it.item_id = $1 AND it.deleted_at IS NULL
    `;
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

    return await this.db.any(query, values);
  }

  /**
   * Find transactions by reference
   * @param {string} referenceType - Reference type
   * @param {number} referenceId - Reference ID
   * @returns {Promise<Array>} Transactions
   */
  async findByReference(referenceType, referenceId) {
    const query = `
      SELECT it.*, ii.name as item_name, ii.item_code, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM ${this.tableName} it
      JOIN inventory_items ii ON it.item_id = ii.id
      LEFT JOIN users u ON it.created_by = u.id
      WHERE it.reference_type = $1 AND it.reference_id = $2 AND it.deleted_at IS NULL
      ORDER BY it.transaction_date DESC
    `;
    return await this.db.any(query, [referenceType, referenceId]);
  }

  /**
   * Create transaction with item info returned
   * @param {Object} data - Transaction data
   * @returns {Promise<Object>} Created transaction with item info
   */
  async createWithItemInfo(data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    const insertQuery = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    const transaction = await this.db.one(insertQuery, values);

    const query = `
      SELECT it.*, ii.name as item_name, ii.item_code, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
      FROM ${this.tableName} it
      JOIN inventory_items ii ON it.item_id = ii.id
      LEFT JOIN users u ON it.created_by = u.id
      WHERE it.id = $1
    `;
    return await this.db.one(query, [transaction.id]);
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
      SELECT it.*, ii.name as item_name, ii.item_code, ic.name as category_name, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
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
