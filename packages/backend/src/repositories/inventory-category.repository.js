const BaseRepository = require('./base.repository');

/**
 * Repository for inventory categories
 * Note: Uses existing schema which has a 'type' column
 */
class InventoryCategoryRepository extends BaseRepository {
  constructor() {
    super('inventory_categories');
  }

  /**
   * Find category by name
   * @param {string} name - Category name
   * @returns {Promise<Object|null>} Category or null
   */
  async findByName(name) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [name]);
  }

  /**
   * Get all categories with item counts
   * @returns {Promise<Array>} Categories with item counts
   */
  async findAllWithItemCounts() {
    const query = `
      SELECT
        ic.*,
        COUNT(ii.id) as item_count,
        COALESCE(SUM(ii.current_stock * ii.unit_cost), 0) as total_value
      FROM ${this.tableName} ic
      LEFT JOIN inventory_items ii ON ic.id = ii.category_id AND ii.deleted_at IS NULL
      WHERE ic.deleted_at IS NULL
      GROUP BY ic.id
      ORDER BY ic.name ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Create category with type field
   * @param {Object} data - Category data
   * @returns {Promise<Object>} Created category
   */
  async create(data) {
    // Add type field if not provided (use lowercase name as type)
    const categoryData = {
      ...data,
      type: data.type || data.name.toLowerCase().replace(/\s+/g, '_'),
    };

    const columns = Object.keys(categoryData);
    const values = Object.values(categoryData);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    return await this.db.one(query, values);
  }
}

module.exports = new InventoryCategoryRepository();
