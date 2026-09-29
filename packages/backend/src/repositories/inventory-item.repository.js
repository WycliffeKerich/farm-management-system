const BaseRepository = require('./base.repository');

/**
 * Repository for inventory items
 *
 * current_stock is not writable through create/update: it only changes
 * through setStock, alongside a ledger row (see InventoryService).
 */
class InventoryItemRepository extends BaseRepository {
  constructor() {
    super('inventory_items', {
      columns: [
        'category_id',
        'item_code',
        'name',
        'description',
        'unit',
        'unit_of_measure_id',
        'minimum_stock',
        'cost_per_unit',
        'supplier',
        'location',
        'expiry_date',
        'notes',
        'is_active',
        'active_ingredient',
        'pre_harvest_interval_days',
        'milk_withdrawal_days',
        'meat_withdrawal_days',
        'egg_withdrawal_days',
        'reorder_quantity',
        'default_supplier_id',
      ],
      sortable: ['name', 'item_code', 'current_stock', 'minimum_stock', 'expiry_date', 'created_at', 'updated_at'],
    });
  }

  /**
   * Find item by item code
   * @param {string} itemCode - Item code
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Item or null
   */
  async findByItemCode(itemCode, t) {
    const query = `
      SELECT ii.*, ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.item_code = $1 AND ii.deleted_at IS NULL
    `;
    return this.conn(t).oneOrNone(query, [itemCode]);
  }

  /**
   * Find item by name within a category
   * @param {string} name - Item name
   * @param {number} categoryId - Category ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Item or null
   */
  async findByNameInCategory(name, categoryId, t) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1) AND category_id = $2 AND deleted_at IS NULL
    `;
    return this.conn(t).oneOrNone(query, [name, categoryId]);
  }

  /**
   * Find all items with category info
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Items with category info
   */
  async findAllWithCategory(filters = {}) {
    let query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.deleted_at IS NULL
    `;
    const values = [];
    let paramIndex = 1;

    if (filters.category_id) {
      query += ` AND ii.category_id = $${paramIndex++}`;
      values.push(filters.category_id);
    }

    if (filters.search) {
      query += ` AND (LOWER(ii.name) LIKE LOWER($${paramIndex}) OR LOWER(ii.item_code) LIKE LOWER($${paramIndex}))`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ' ORDER BY ii.name ASC';

    return this.db.any(query, values);
  }

  /**
   * Find item by ID with category info
   * @param {number} id - Item ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Item or null
   */
  async findByIdWithCategory(id, t) {
    const query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.id = $1 AND ii.deleted_at IS NULL
    `;
    return this.conn(t).oneOrNone(query, [id]);
  }

  /**
   * Lock an item row for a stock change. Concurrent writers to the same item
   * wait here until this transaction ends, so they always see the latest stock.
   * @param {number} id - Item ID
   * @param {Object} t - Transaction (required: the lock only lasts for its duration)
   * @returns {Promise<Object|null>} Item or null
   */
  async findByIdForUpdate(id, t) {
    return t.oneOrNone(`SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
  }

  /**
   * Get items with low stock (current_stock <= minimum_stock)
   * @returns {Promise<Array>} Low stock items
   */
  async findLowStock() {
    const query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.deleted_at IS NULL
        AND ii.minimum_stock IS NOT NULL
        AND ii.minimum_stock > 0
        AND ii.current_stock <= ii.minimum_stock
      ORDER BY (ii.current_stock / NULLIF(ii.minimum_stock, 0)) ASC, ii.name ASC
    `;
    return this.db.any(query);
  }

  /**
   * Get items expiring within specified days
   * @param {number} days - Number of days to check
   * @returns {Promise<Array>} Expiring items
   */
  async findExpiring(days = 30) {
    const query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.deleted_at IS NULL
        AND ii.expiry_date IS NOT NULL
        AND ii.expiry_date <= CURRENT_DATE + $1::int
        AND ii.expiry_date >= CURRENT_DATE
        AND ii.current_stock > 0
      ORDER BY ii.expiry_date ASC
    `;
    return this.db.any(query, [days]);
  }

  /**
   * Set the stock level. Only call with a row locked by findByIdForUpdate,
   * in the same transaction that writes the matching ledger row.
   * @param {number} id - Item ID
   * @param {number} stock - New stock level
   * @param {Object} t - Transaction
   * @returns {Promise<Object>} Updated item
   */
  async setStock(id, stock, t) {
    return t.one(
      `UPDATE ${this.tableName}
          SET current_stock = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING *`,
      [id, stock]
    );
  }

  /**
   * Get the next item code for a category prefix. Deleted items keep their
   * codes, so they are counted too.
   * @param {string} categoryPrefix - Category prefix (e.g., 'SED', 'FED')
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<string>} Next item code
   */
  async getNextItemCode(categoryPrefix, t) {
    const { next } = await this.conn(t).one(
      `SELECT COALESCE(MAX(substring(item_code FROM '-(\\d+)$')::int), 0) + 1 AS next
         FROM ${this.tableName}
        WHERE item_code LIKE $1`,
      [`${categoryPrefix}-%`]
    );
    return `${categoryPrefix}-${String(next).padStart(4, '0')}`;
  }

  /**
   * Paginate items with category info and filters
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters (category_id, search, low_stock, expiring)
   * @returns {Promise<Object>} Paginated results
   */
  async paginateWithFilters(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.deleted_at IS NULL
    `;
    let countQuery = `
      SELECT COUNT(*) as count
      FROM ${this.tableName} ii
      WHERE ii.deleted_at IS NULL
    `;
    const values = [];
    const countValues = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (filters.category_id) {
      query += ` AND ii.category_id = $${paramIndex++}`;
      countQuery += ` AND ii.category_id = $${countParamIndex++}`;
      values.push(filters.category_id);
      countValues.push(filters.category_id);
    }

    if (filters.search) {
      query += ` AND (LOWER(ii.name) LIKE LOWER($${paramIndex}) OR LOWER(ii.item_code) LIKE LOWER($${paramIndex}))`;
      countQuery += ` AND (LOWER(ii.name) LIKE LOWER($${countParamIndex}) OR LOWER(ii.item_code) LIKE LOWER($${countParamIndex}))`;
      values.push(`%${filters.search}%`);
      countValues.push(`%${filters.search}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (filters.low_stock) {
      query += ' AND ii.minimum_stock IS NOT NULL AND ii.minimum_stock > 0 AND ii.current_stock <= ii.minimum_stock';
      countQuery += ' AND ii.minimum_stock IS NOT NULL AND ii.minimum_stock > 0 AND ii.current_stock <= ii.minimum_stock';
    }

    if (filters.expiring_days) {
      query += ` AND ii.expiry_date IS NOT NULL AND ii.expiry_date <= CURRENT_DATE + $${paramIndex++}::int AND ii.expiry_date >= CURRENT_DATE`;
      countQuery += ` AND ii.expiry_date IS NOT NULL AND ii.expiry_date <= CURRENT_DATE + $${countParamIndex++}::int AND ii.expiry_date >= CURRENT_DATE`;
      values.push(filters.expiring_days);
      countValues.push(filters.expiring_days);
    }

    query += ` ORDER BY ii.name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    values.push(limit, offset);

    const [data, countResult] = await Promise.all([this.db.any(query, values), this.db.one(countQuery, countValues)]);

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

module.exports = new InventoryItemRepository();
