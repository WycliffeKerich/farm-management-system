const BaseRepository = require('./base.repository');

/**
 * Repository for inventory items
 * Note: Uses existing schema column names for compatibility
 */
class InventoryItemRepository extends BaseRepository {
  constructor() {
    super('inventory_items');
  }

  /**
   * Find item by item code
   * @param {string} itemCode - Item code
   * @returns {Promise<Object|null>} Item or null
   */
  async findByItemCode(itemCode) {
    const query = `
      SELECT ii.*, ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.item_code = $1 AND ii.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [itemCode]);
  }

  /**
   * Find item by name within a category
   * @param {string} name - Item name
   * @param {number} categoryId - Category ID
   * @returns {Promise<Object|null>} Item or null
   */
  async findByNameInCategory(name, categoryId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1) AND category_id = $2 AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [name, categoryId]);
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

    return await this.db.any(query, values);
  }

  /**
   * Find item by ID with category info
   * @param {number} id - Item ID
   * @returns {Promise<Object|null>} Item or null
   */
  async findByIdWithCategory(id) {
    const query = `
      SELECT
        ii.*,
        ic.name as category_name
      FROM ${this.tableName} ii
      JOIN inventory_categories ic ON ii.category_id = ic.id
      WHERE ii.id = $1 AND ii.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Get items with low stock (current_stock <= min_stock_level)
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
    return await this.db.any(query);
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
        AND ii.expiry_date <= CURRENT_DATE + $1
        AND ii.expiry_date >= CURRENT_DATE
        AND ii.current_stock > 0
      ORDER BY ii.expiry_date ASC
    `;
    return await this.db.any(query, [days]);
  }

  /**
   * Update stock level
   * @param {number} id - Item ID
   * @param {number} quantity - Quantity to add (can be negative)
   * @returns {Promise<Object>} Updated item
   */
  async updateStock(id, quantity) {
    const query = `
      UPDATE ${this.tableName}
      SET current_stock = current_stock + $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id, quantity]);
  }

  /**
   * Get the next item code for a category
   * @param {string} categoryPrefix - Category prefix (e.g., 'SED', 'FED')
   * @returns {Promise<string>} Next item code
   */
  async getNextItemCode(categoryPrefix) {
    const query = `
      SELECT item_code FROM ${this.tableName}
      WHERE item_code LIKE $1
      ORDER BY item_code DESC
      LIMIT 1
    `;
    const result = await this.db.oneOrNone(query, [`${categoryPrefix}%`]);

    if (!result) {
      return `${categoryPrefix}-0001`;
    }

    const currentNumber = parseInt(result.item_code.split('-')[1], 10);
    const nextNumber = currentNumber + 1;
    return `${categoryPrefix}-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Create item with schema-compatible column names
   * @param {Object} data - Item data
   * @returns {Promise<Object>} Created item
   */
  async create(data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    return await this.db.one(query, values);
  }

  /**
   * Update item with schema-compatible column names
   * @param {number} id - Item ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated item
   */
  async update(id, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;

    return await this.db.one(query, [id, ...values]);
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
      query += ` AND ii.expiry_date IS NOT NULL AND ii.expiry_date <= CURRENT_DATE + $${paramIndex++} AND ii.expiry_date >= CURRENT_DATE`;
      countQuery += ` AND ii.expiry_date IS NOT NULL AND ii.expiry_date <= CURRENT_DATE + $${countParamIndex++} AND ii.expiry_date >= CURRENT_DATE`;
      values.push(filters.expiring_days);
      countValues.push(filters.expiring_days);
    }

    query += ` ORDER BY ii.name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
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

module.exports = new InventoryItemRepository();
