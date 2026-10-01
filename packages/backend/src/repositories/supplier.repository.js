const BaseRepository = require('./base.repository');

/**
 * Repository for suppliers. Names are unique ignoring case among live rows.
 */
class SupplierRepository extends BaseRepository {
  constructor() {
    super('suppliers', {
      columns: ['name', 'contact_person', 'phone', 'email', 'kra_pin', 'address', 'notes', 'is_active'],
      sortable: ['name', 'created_at'],
    });
  }

  /**
   * Find a live supplier by name, ignoring case and surrounding spaces
   * @param {string} name - Supplier name
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Supplier or null
   */
  async findByName(name, t) {
    return this.conn(t).oneOrNone(
      `SELECT * FROM ${this.tableName} WHERE LOWER(name) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
      [name]
    );
  }

  /**
   * List suppliers with how many items and batches name them
   * @param {Object} [filters] - search (name, contact, phone), include_inactive
   * @returns {Promise<Array>} Suppliers with item_count and batch_count
   */
  async findAllWithCounts({ search, include_inactive: includeInactive } = {}) {
    return this.db.any(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM inventory_items ii
                WHERE ii.default_supplier_id = s.id AND ii.deleted_at IS NULL) AS item_count,
              (SELECT COUNT(*)::int FROM inventory_batches ib
                WHERE ib.supplier_id = s.id AND ib.deleted_at IS NULL) AS batch_count
         FROM ${this.tableName} s
        WHERE s.deleted_at IS NULL
          AND ($1 OR s.is_active)
          AND ($2::text IS NULL OR s.name ILIKE $2 OR s.contact_person ILIKE $2 OR s.phone ILIKE $2)
        ORDER BY LOWER(s.name)`,
      [Boolean(includeInactive), search ? `%${search}%` : null]
    );
  }

  /**
   * Whether any live item or batch refers to the supplier
   * @param {number} id - Supplier ID
   * @returns {Promise<boolean>}
   */
  async isInUse(id) {
    const { in_use: inUse } = await this.db.one(
      `SELECT EXISTS (SELECT 1 FROM inventory_items WHERE default_supplier_id = $1 AND deleted_at IS NULL)
           OR EXISTS (SELECT 1 FROM inventory_batches WHERE supplier_id = $1 AND deleted_at IS NULL) AS in_use`,
      [id]
    );
    return inUse;
  }
}

module.exports = new SupplierRepository();
