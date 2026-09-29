const { db, pgp } = require('../config/database');
const { AppError, ValidationError, NotFoundError } = require('../utils/errors');

// Columns that callers can never write directly
const PROTECTED_COLUMNS = ['id', 'created_at', 'updated_at', 'deleted_at'];

// Column lists per table, loaded once from information_schema
const columnCache = new Map();

/**
 * Base repository class with common CRUD operations
 * All specific repositories should extend this class
 *
 * Safety rules:
 * - identifiers are never interpolated raw; they are checked against the table's
 *   real columns and escaped with pg-promise's :name filter
 * - create/update only write whitelisted columns: `columns` if the subclass declares
 *   it, otherwise every real column except id/timestamps. Unknown keys are dropped.
 * - filters and sort fields must be real columns (sort: `sortable` if declared)
 * - every method accepts an optional task/transaction `t` as its last argument
 */
class BaseRepository {
  /**
   * @param {string} tableName - Name of the database table
   * @param {Object} [options]
   * @param {Array<string>} [options.columns] - Writable columns (strict whitelist)
   * @param {Array<string>} [options.sortable] - Columns allowed in ORDER BY
   */
  constructor(tableName, { columns, sortable } = {}) {
    this.tableName = tableName;
    this.db = db;
    this.columns = columns;
    this.sortable = sortable;
  }

  /**
   * Database handle: the given task/transaction, or the pool
   * @param {Object} [t] - pg-promise task or transaction
   */
  conn(t) {
    return t || this.db;
  }

  /**
   * All column names of the table (cached)
   * @returns {Promise<Set<string>>}
   */
  async getTableColumns() {
    if (!columnCache.has(this.tableName)) {
      const promise = this.db
        .map(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = $1`,
          [this.tableName],
          (row) => row.column_name
        )
        .then((names) => {
          if (names.length === 0) {
            throw new AppError(`Table "${this.tableName}" does not exist`, 500, 'SERVER_ERROR');
          }
          return new Set(names);
        });
      // Do not cache failures
      promise.catch(() => columnCache.delete(this.tableName));
      columnCache.set(this.tableName, promise);
    }
    return columnCache.get(this.tableName);
  }

  /**
   * Keep only writable columns
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async pickWritable(data) {
    const tableColumns = await this.getTableColumns();
    const allowed = this.columns
      ? this.columns.filter((col) => tableColumns.has(col))
      : [...tableColumns].filter((col) => !PROTECTED_COLUMNS.includes(col));

    const picked = {};
    for (const key of Object.keys(data || {})) {
      if (allowed.includes(key) && data[key] !== undefined) {
        picked[key] = data[key];
      }
    }
    return picked;
  }

  /**
   * Build a WHERE clause from equality criteria
   * @param {Object} criteria - { column: value }; null → IS NULL, array → = ANY
   * @returns {Promise<string>} Formatted clause starting with WHERE
   */
  async buildWhere(criteria = {}) {
    const tableColumns = await this.getTableColumns();
    const conditions = [];

    if (tableColumns.has('deleted_at')) {
      conditions.push('deleted_at IS NULL');
    }

    for (const [key, value] of Object.entries(criteria)) {
      if (value === undefined) continue;
      if (!tableColumns.has(key)) {
        throw new ValidationError(`Unknown filter field: ${key}`);
      }
      if (value === null) {
        conditions.push(pgp.as.format('$1:name IS NULL', [key]));
      } else if (Array.isArray(value)) {
        conditions.push(pgp.as.format('$1:name = ANY($2)', [key, value]));
      } else {
        conditions.push(pgp.as.format('$1:name = $2', [key, value]));
      }
    }

    return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * Build an ORDER BY clause from a whitelist
   * @param {string|Object} sort - 'column', 'column DESC' or { field, order }
   * @returns {Promise<string>}
   */
  async buildOrderBy(sort) {
    let field;
    let order;
    if (typeof sort === 'string') {
      [field, order] = sort.trim().split(/\s+/);
    } else if (sort) {
      ({ field, order } = sort);
    }
    field = field || 'id';
    order = String(order || 'DESC').toUpperCase();

    const tableColumns = await this.getTableColumns();
    const allowed = this.sortable || [...tableColumns];
    if (!allowed.includes(field) || !tableColumns.has(field)) {
      throw new ValidationError(`Cannot sort by: ${field}`);
    }
    if (order !== 'ASC' && order !== 'DESC') {
      throw new ValidationError(`Invalid sort order: ${order}`);
    }
    return pgp.as.format(`ORDER BY $1:name ${order}`, [field]);
  }

  /**
   * Find all records
   * @param {Object} filters - Optional equality filters
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>} Array of records
   */
  async findAll(filters = {}, t) {
    const where = await this.buildWhere(filters);
    return this.conn(t).any('SELECT * FROM $1:name $2:raw', [this.tableName, where]);
  }

  /**
   * Find record by ID
   * @param {number} id - Record ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Record or null
   */
  async findById(id, t) {
    const where = await this.buildWhere({ id });
    return this.conn(t).oneOrNone('SELECT * FROM $1:name $2:raw', [this.tableName, where]);
  }

  /**
   * Find one record by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Record or null
   */
  async findOne(criteria, t) {
    const where = await this.buildWhere(criteria);
    return this.conn(t).oneOrNone('SELECT * FROM $1:name $2:raw LIMIT 1', [this.tableName, where]);
  }

  /**
   * Create a new record
   * @param {Object} data - Record data (non-writable keys are ignored)
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} Created record
   */
  async create(data, t) {
    const values = await this.pickWritable(data);
    if (Object.keys(values).length === 0) {
      throw new ValidationError('No valid fields provided');
    }
    const query = pgp.helpers.insert(values, null, this.tableName) + ' RETURNING *';
    return this.conn(t).one(query);
  }

  /**
   * Update a record by ID
   * @param {number} id - Record ID
   * @param {Object} data - Updated data (non-writable keys are ignored)
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} Updated record
   * @throws {NotFoundError} If the record does not exist or is soft-deleted
   */
  async update(id, data, t) {
    const tableColumns = await this.getTableColumns();
    const values = await this.pickWritable(data);

    if (Object.keys(values).length === 0) {
      const existing = await this.findById(id, t);
      if (!existing) throw new NotFoundError('Record not found');
      return existing;
    }

    let setClause = pgp.helpers.sets(values);
    if (tableColumns.has('updated_at')) {
      setClause += ', updated_at = CURRENT_TIMESTAMP';
    }
    const where = await this.buildWhere({ id });

    const row = await this.conn(t).oneOrNone('UPDATE $1:name SET $2:raw $3:raw RETURNING *', [
      this.tableName,
      setClause,
      where,
    ]);
    if (!row) throw new NotFoundError('Record not found');
    return row;
  }

  /**
   * Soft delete a record by ID
   * @param {number} id - Record ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<boolean>} True if a record was deleted
   */
  async softDelete(id, t) {
    const tableColumns = await this.getTableColumns();
    if (!tableColumns.has('deleted_at')) {
      throw new AppError(`Table "${this.tableName}" does not support soft delete`, 500, 'SERVER_ERROR');
    }
    const result = await this.conn(t).result(
      'UPDATE $1:name SET deleted_at = CURRENT_TIMESTAMP WHERE id = $2 AND deleted_at IS NULL',
      [this.tableName, id]
    );
    return result.rowCount > 0;
  }

  /**
   * Hard delete a record by ID
   * @param {number} id - Record ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<boolean>} True if a record was deleted
   */
  async delete(id, t) {
    const result = await this.conn(t).result('DELETE FROM $1:name WHERE id = $2', [this.tableName, id]);
    return result.rowCount > 0;
  }

  /**
   * Count records
   * @param {Object} filters - Optional filters
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<number>} Count of records
   */
  async count(filters = {}, t) {
    const where = await this.buildWhere(filters);
    const result = await this.conn(t).one('SELECT COUNT(*) AS count FROM $1:name $2:raw', [this.tableName, where]);
    return result.count;
  }

  /**
   * Check if record exists
   * @param {Object} criteria - Search criteria
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<boolean>} True if exists
   */
  async exists(criteria, t) {
    const where = await this.buildWhere(criteria);
    const result = await this.conn(t).one('SELECT EXISTS(SELECT 1 FROM $1:name $2:raw) AS exists', [
      this.tableName,
      where,
    ]);
    return result.exists;
  }

  /**
   * Paginate results
   * @param {number} page - Page number (1-indexed)
   * @param {number} limit - Records per page (max 200)
   * @param {Object} filters - Optional filters
   * @param {string|Object} sort - 'column DESC' or { field, order }; must be sortable
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} Paginated results with metadata
   */
  async paginate(page = 1, limit = 20, filters = {}, sort = 'id DESC', t) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const offset = (safePage - 1) * safeLimit;

    const where = await this.buildWhere(filters);
    const orderBy = await this.buildOrderBy(sort);

    const [data, total] = await Promise.all([
      this.conn(t).any('SELECT * FROM $1:name $2:raw $3:raw LIMIT $4 OFFSET $5', [
        this.tableName,
        where,
        orderBy,
        safeLimit,
        offset,
      ]),
      this.count(filters, t),
    ]);

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }
}

module.exports = BaseRepository;
