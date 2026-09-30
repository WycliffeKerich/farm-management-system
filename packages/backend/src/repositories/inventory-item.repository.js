const BaseRepository = require('./base.repository');
const { ValidationError } = require('../utils/errors');

/**
 * Stock levels an item list can be filtered to. `low` is the reorder rule (at or
 * below a set minimum, so it includes items that have run out), `out` is no
 * stock, and `ok` is stock above any minimum.
 */
const LOW_STOCK = 'COALESCE(ii.minimum_stock, 0) > 0 AND ii.current_stock <= ii.minimum_stock';
const STOCK_STATUS = {
  low: LOW_STOCK,
  out: 'ii.current_stock <= 0',
  ok: `ii.current_stock > 0 AND NOT (${LOW_STOCK})`,
};

/** Columns the paged item list sorts by, as SQL on aliases ii and ic */
const ITEM_SORTS = {
  name: 'ii.name',
  item_code: 'ii.item_code',
  category_name: 'ic.name',
  current_stock: 'ii.current_stock',
  minimum_stock: 'ii.minimum_stock',
  cost_per_unit: 'ii.cost_per_unit',
  expiry_date: 'ii.expiry_date',
  created_at: 'ii.created_at',
  updated_at: 'ii.updated_at',
};

/**
 * WHERE conditions (on alias ii) for the item list filters
 * @param {Object} filters
 * @param {number} [filters.category_id]
 * @param {string} [filters.search] - Part of the name or item code
 * @param {boolean} [filters.low_stock] - Only items at or below a set minimum stock
 * @param {string} [filters.stock_status] - low, out or ok (see STOCK_STATUS)
 * @param {number} [filters.expiring_days] - Only items with stock that expires within this
 *   many days: a live batch expiring, or the item's own expiry date on stock held
 * @returns {{where: string, values: Array}}
 */
function itemFilters(filters = {}) {
  const conditions = ['ii.deleted_at IS NULL'];
  const values = [];
  const param = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (filters.category_id) {
    conditions.push(`ii.category_id = ${param(filters.category_id)}`);
  }
  if (filters.search) {
    const search = param(`%${filters.search}%`);
    conditions.push(`(ii.name ILIKE ${search} OR ii.item_code ILIKE ${search})`);
  }
  if (filters.low_stock) {
    conditions.push(LOW_STOCK);
  }
  if (STOCK_STATUS[filters.stock_status]) {
    conditions.push(STOCK_STATUS[filters.stock_status]);
  }
  if (filters.expiring_days) {
    const days = param(filters.expiring_days);
    conditions.push(`(
      (ii.current_stock > 0 AND ii.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}::int)
      OR EXISTS (
        SELECT 1 FROM inventory_batches ib
         WHERE ib.inventory_item_id = ii.id
           AND ib.deleted_at IS NULL
           AND ib.status = 'active'
           AND ib.quantity > 0
           AND ib.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ${days}::int
      )
    )`);
  }

  return { where: conditions.join(' AND '), values };
}

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
   * @param {Object} filters - category_id, search, low_stock, expiring_days (see itemFilters)
   * @returns {Promise<Array>} Items with category info
   */
  async findAllWithCategory(filters = {}) {
    const { where, values } = itemFilters(filters);
    const query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ${where}
      ORDER BY ii.name ASC
    `;
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
   * @param {Object} filters - category_id, search, low_stock, stock_status, expiring_days (see itemFilters)
   * @param {Object} [sort] - { field, order }: field is a key of ITEM_SORTS, order asc or desc.
   *   Defaults to name ascending; blanks sort last either way.
   * @returns {Promise<Object>} Paginated results
   * @throws {ValidationError} For a field that is not sortable
   */
  async paginateWithFilters(page = 1, limit = 20, filters = {}, sort = {}) {
    const offset = (page - 1) * limit;
    const { where, values } = itemFilters(filters);
    const field = sort.field || 'name';
    if (!Object.hasOwn(ITEM_SORTS, field)) throw new ValidationError(`Cannot sort by: ${field}`);
    const column = ITEM_SORTS[field];
    const direction = String(sort.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ${where}
      ORDER BY ${column} ${direction} NULLS LAST, ii.name ASC, ii.id ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const countQuery = `SELECT COUNT(*) as count FROM ${this.tableName} ii WHERE ${where}`;

    const [data, countResult] = await Promise.all([
      this.db.any(query, [...values, limit, offset]),
      this.db.one(countQuery, values),
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

  /**
   * How many items are at each stock level, for the list's summary. The stock
   * level filters are ignored so every level is counted; the others apply.
   * @param {Object} filters - As for paginateWithFilters
   * @returns {Promise<{total: number, ok: number, low: number, out: number}>}
   *   low and out overlap: an item that has run out below its minimum is in both
   */
  async countByStockStatus(filters = {}) {
    // eslint-disable-next-line no-unused-vars -- every level is counted
    const { low_stock, stock_status, ...rest } = filters;
    const { where, values } = itemFilters(rest);
    return this.db.one(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE ${STOCK_STATUS.ok}) AS ok,
              COUNT(*) FILTER (WHERE ${STOCK_STATUS.low}) AS low,
              COUNT(*) FILTER (WHERE ${STOCK_STATUS.out}) AS out
         FROM ${this.tableName} ii
        WHERE ${where}`,
      values
    );
  }
}

module.exports = new InventoryItemRepository();
