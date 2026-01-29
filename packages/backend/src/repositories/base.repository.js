const { db } = require('../config/database');

/**
 * Base repository class with common CRUD operations
 * All specific repositories should extend this class
 */
class BaseRepository {
  /**
   * @param {string} tableName - Name of the database table
   */
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  /**
   * Find all records
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of records
   */
  async findAll(filters = {}) {
    let query = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const values = [];

    // Add filters dynamically
    Object.keys(filters).forEach((key, index) => {
      query += ` AND ${key} = $${index + 1}`;
      values.push(filters[key]);
    });

    return await this.db.any(query, values);
  }

  /**
   * Find record by ID
   * @param {number} id - Record ID
   * @returns {Promise<Object|null>} Record or null
   */
  async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1 AND deleted_at IS NULL`;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find one record by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object|null>} Record or null
   */
  async findOne(criteria) {
    let query = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const values = [];

    Object.keys(criteria).forEach((key, index) => {
      query += ` AND ${key} = $${index + 1}`;
      values.push(criteria[key]);
    });

    query += ' LIMIT 1';

    return await this.db.oneOrNone(query, values);
  }

  /**
   * Create a new record
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record
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
   * Update a record by ID
   * @param {number} id - Record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>} Updated record
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
   * Soft delete a record by ID
   * @param {number} id - Record ID
   * @returns {Promise<void>}
   */
  async softDelete(id) {
    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await this.db.none(query, [id]);
  }

  /**
   * Hard delete a record by ID
   * @param {number} id - Record ID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    await this.db.none(query, [id]);
  }

  /**
   * Count records
   * @param {Object} filters - Optional filters
   * @returns {Promise<number>} Count of records
   */
  async count(filters = {}) {
    let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const values = [];

    Object.keys(filters).forEach((key, index) => {
      query += ` AND ${key} = $${index + 1}`;
      values.push(filters[key]);
    });

    const result = await this.db.one(query, values);
    return parseInt(result.count, 10);
  }

  /**
   * Check if record exists
   * @param {Object} criteria - Search criteria
   * @returns {Promise<boolean>} True if exists
   */
  async exists(criteria) {
    let query = `SELECT EXISTS(SELECT 1 FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const values = [];

    Object.keys(criteria).forEach((key, index) => {
      query += ` AND ${key} = $${index + 1}`;
      values.push(criteria[key]);
    });

    query += ') as exists';

    const result = await this.db.one(query, values);
    return result.exists;
  }

  /**
   * Paginate results
   * @param {number} page - Page number (1-indexed)
   * @param {number} limit - Records per page
   * @param {Object} filters - Optional filters
   * @param {string} orderBy - Order by clause
   * @returns {Promise<Object>} Paginated results with metadata
   */
  async paginate(page = 1, limit = 20, filters = {}, orderBy = 'id DESC') {
    const offset = (page - 1) * limit;
    let query = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL`;
    const values = [];

    // Add filters
    Object.keys(filters).forEach((key, index) => {
      query += ` AND ${key} = $${index + 1}`;
      values.push(filters[key]);
    });

    // Add ordering and pagination
    query += ` ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limit, offset);

    const [data, total] = await Promise.all([
      this.db.any(query, values),
      this.count(filters),
    ]);

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

module.exports = BaseRepository;
