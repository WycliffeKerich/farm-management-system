const BaseRepository = require('./base.repository');

/**
 * Repository for units of measure
 */
class UnitOfMeasureRepository extends BaseRepository {
  constructor() {
    super('units_of_measure', {
      columns: ['name', 'symbol', 'category', 'base_unit_id', 'conversion_factor', 'description', 'is_active'],
      sortable: ['name', 'symbol', 'category'],
    });
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
      WITH unit_family AS (
        SELECT COALESCE(base_unit_id, id) AS family FROM ${this.tableName} WHERE id = $1
      )
      SELECT uom.*
      FROM ${this.tableName} uom
      WHERE COALESCE(uom.base_unit_id, uom.id) = (SELECT family FROM unit_family)
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
    if (Number(fromUnitId) === Number(toUnitId)) {
      return quantity;
    }

    const units = await this.db.any(`SELECT * FROM ${this.tableName} WHERE id IN ($1, $2) AND deleted_at IS NULL`, [
      fromUnitId,
      toUnitId,
    ]);
    const from = units.find((unit) => unit.id === Number(fromUnitId));
    const to = units.find((unit) => unit.id === Number(toUnitId));
    const factor = from && to ? this.factorBetween(from, to) : null;

    return factor === null ? null : Math.round(quantity * factor * 1000000) / 1000000; // 6 decimal places
  }

  /**
   * Find a unit by its symbol or name, ignoring case (symbol wins)
   * @param {string} label - e.g. 'kg', 'Kilogram'
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Unit or null
   */
  async findByLabel(label, t) {
    return this.conn(t).oneOrNone(
      `SELECT * FROM ${this.tableName}
        WHERE deleted_at IS NULL AND (LOWER(symbol) = LOWER($1) OR LOWER(name) = LOWER($1))
        ORDER BY (LOWER(symbol) = LOWER($1)) DESC
        LIMIT 1`,
      [label]
    );
  }

  /**
   * How many `to` units one `from` unit is. Units convert only within one
   * family (the same base unit): kg ↔ g, but not bag ↔ piece, although both
   * are counts.
   * @param {Object} from - Unit row
   * @param {Object} to - Unit row
   * @returns {number|null} Factor, or null when they do not convert
   */
  factorBetween(from, to) {
    const family = (unit) => unit.base_unit_id || unit.id;
    if (family(from) !== family(to)) {
      return null;
    }
    const factor = (unit) => (unit.base_unit_id ? Number(unit.conversion_factor) : 1);
    return factor(from) / factor(to);
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
