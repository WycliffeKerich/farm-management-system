const BaseRepository = require('./base.repository');

/**
 * Repository for inventory categories
 */
class InventoryCategoryRepository extends BaseRepository {
  constructor() {
    super('inventory_categories', {
      columns: ['name', 'type', 'description'],
      sortable: ['name', 'created_at'],
    });
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
    return this.db.oneOrNone(query, [name]);
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
        COALESCE(SUM(ii.current_stock * COALESCE(ii.cost_per_unit, ii.unit_cost)), 0) as total_value
      FROM ${this.tableName} ic
      LEFT JOIN inventory_items ii ON ic.id = ii.category_id AND ii.deleted_at IS NULL
      WHERE ic.deleted_at IS NULL
      GROUP BY ic.id
      ORDER BY ic.name ASC
    `;
    return this.db.any(query);
  }
}

module.exports = new InventoryCategoryRepository();
