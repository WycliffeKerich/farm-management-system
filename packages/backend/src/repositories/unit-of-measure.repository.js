const BaseRepository = require('./base.repository');

/**
 * Repository for units of measure
 */
class UnitOfMeasureRepository extends BaseRepository {
  constructor() {
    super('units_of_measure');
  }

  /**
   * Find unit by symbol
   * @param {string} symbol - Unit symbol
   * @returns {Promise<Object|null>} Unit or null
   */
  async findBySymbol(symbol) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(symbol) = LOWER($1) AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [symbol]);
  }

  /**
   * Find unit by name
   * @param {string} name - Unit name
   * @returns {Promise<Object|null>} Unit or null
   */
  async findByName(name) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [name]);
  }

  /**
   * Get all active units grouped by category
   * @returns {Promise<Array>} Units grouped by category
   */
  async findAllGroupedByCategory() {
    const query = `
      SELECT
        uom.*,
        base.symbol as base_unit_symbol,
        base.name as base_unit_name
      FROM ${this.tableName} uom
      LEFT JOIN ${this.tableName} base ON uom.base_unit_id = base.id
      WHERE uom.deleted_at IS NULL AND uom.is_active = true
      ORDER BY uom.category ASC, uom.name ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Get units by category
   * @param {string} category - Category name
   * @returns {Promise<Array>} Units in category
   */
  async findByCategory(category) {
    const query = `
      SELECT
        uom.*,
        base.symbol as base_unit_symbol
      FROM ${this.tableName} uom
      LEFT JOIN ${this.tableName} base ON uom.base_unit_id = base.id
      WHERE uom.category = $1 AND uom.deleted_at IS NULL AND uom.is_active = true
      ORDER BY uom.name ASC
    `;
    return await this.db.any(query, [category]);
  }

  /**
   * Get convertible units for a given unit
   * @param {number} unitId - Unit ID
   * @returns {Promise<Array>} Convertible units
   */
  async findConvertibleUnits(unitId) {
    const query = `
      WITH unit_category AS (
        SELECT category, base_unit_id FROM ${this.tableName} WHERE id = $1
      )
      SELECT uom.*
      FROM ${this.tableName} uom
      WHERE uom.category = (SELECT category FROM unit_category)
        AND uom.deleted_at IS NULL
        AND uom.is_active = true
        AND uom.id != $1
      ORDER BY uom.name ASC
    `;
    return await this.db.any(query, [unitId]);
  }

  /**
   * Convert quantity from one unit to another
   * @param {number} quantity - Quantity to convert
   * @param {number} fromUnitId - Source unit ID
   * @param {number} toUnitId - Target unit ID
   * @returns {Promise<number|null>} Converted quantity or null if not convertible
   */
  async convertQuantity(quantity, fromUnitId, toUnitId) {
    if (fromUnitId === toUnitId) {
      return quantity;
    }

    const query = `
      WITH from_unit AS (
        SELECT id, category, base_unit_id, conversion_factor FROM ${this.tableName} WHERE id = $1
      ),
      to_unit AS (
        SELECT id, category, base_unit_id, conversion_factor FROM ${this.tableName} WHERE id = $2
      )
      SELECT
        fu.category as from_category,
        tu.category as to_category,
        fu.conversion_factor as from_factor,
        tu.conversion_factor as to_factor,
        fu.base_unit_id as from_base,
        tu.base_unit_id as to_base
      FROM from_unit fu, to_unit tu
    `;

    const result = await this.db.oneOrNone(query, [fromUnitId, toUnitId]);

    if (!result || result.from_category !== result.to_category) {
      return null; // Cannot convert between different categories
    }

    // Convert: value * from_factor / to_factor
    const converted = (quantity * result.from_factor) / result.to_factor;
    return Math.round(converted * 1000000) / 1000000; // Round to 6 decimal places
  }

  /**
   * Get all categories
   * @returns {Promise<Array>} Unique categories
   */
  async getCategories() {
    const query = `
      SELECT DISTINCT category
      FROM ${this.tableName}
      WHERE deleted_at IS NULL AND is_active = true
      ORDER BY category ASC
    `;
    const result = await this.db.any(query);
    return result.map((r) => r.category);
  }

  /**
   * Search units by name or symbol
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching units
   */
  async search(searchTerm) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE deleted_at IS NULL
        AND is_active = true
        AND (LOWER(name) LIKE LOWER($1) OR LOWER(symbol) LIKE LOWER($1))
      ORDER BY name ASC
    `;
    return await this.db.any(query, [`%${searchTerm}%`]);
  }
}

module.exports = new UnitOfMeasureRepository();
