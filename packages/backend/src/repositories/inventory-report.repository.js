const { db } = require('../config/database');

/*
 * Batches that still count towards an item's stock. Expired and quarantined
 * batches stay in current_stock until they are written off, so they are
 * valued (and reported as at risk) too.
 */
const HELD_BATCH = `ib.deleted_at IS NULL AND ib.quantity > 0 AND ib.status IN ('active', 'quarantine', 'expired')`;

/**
 * Read-only queries behind the inventory reports
 */
class InventoryReportRepository {
  /**
   * Stock held per item, split into what batches hold (with their cost) and
   * the remainder held outside any batch
   * @param {Object} [filters] - category_id
   * @returns {Promise<Array>} One row per item with stock
   */
  async findStockForValuation(filters = {}) {
    return db.any(
      `SELECT ii.id AS item_id, ii.item_code, ii.name, ii.unit,
              ii.category_id, ic.name AS category_name,
              ii.current_stock,
              COALESCE(ii.cost_per_unit, ii.unit_cost) AS item_unit_cost,
              COALESCE(b.batch_quantity, 0) AS batch_quantity,
              COALESCE(b.batch_value, 0) AS batch_value,
              COALESCE(b.uncosted_batch_quantity, 0) AS uncosted_batch_quantity
         FROM inventory_items ii
         JOIN inventory_categories ic ON ic.id = ii.category_id
         LEFT JOIN (
           SELECT ib.inventory_item_id,
                  SUM(ib.quantity) AS batch_quantity,
                  SUM(ib.quantity * ib.unit_cost) AS batch_value,
                  SUM(ib.quantity) FILTER (WHERE ib.unit_cost IS NULL) AS uncosted_batch_quantity
             FROM inventory_batches ib
            WHERE ${HELD_BATCH}
            GROUP BY ib.inventory_item_id
         ) b ON b.inventory_item_id = ii.id
        WHERE ii.deleted_at IS NULL
          AND ii.current_stock > 0
          AND ($1::int IS NULL OR ii.category_id = $1)
        ORDER BY ic.name, ii.name`,
      [filters.category_id || null]
    );
  }

  /**
   * Items at or below their minimum stock, with their default supplier and
   * net usage (usage less returns) over the last `usageDays` days
   * @param {number} usageDays - Days of history to average usage over
   * @returns {Promise<Array>}
   */
  async findReorderItems(usageDays) {
    return db.any(
      `SELECT ii.id AS item_id, ii.item_code, ii.name, ii.unit,
              ii.category_id, ic.name AS category_name,
              ii.current_stock, ii.minimum_stock, ii.reorder_quantity,
              COALESCE(ii.cost_per_unit, ii.unit_cost) AS item_unit_cost,
              ii.default_supplier_id AS supplier_id,
              COALESCE(s.name, ii.supplier) AS supplier_name,
              s.phone AS supplier_phone, s.email AS supplier_email,
              GREATEST(COALESCE(u.used, 0), 0) AS used
         FROM inventory_items ii
         JOIN inventory_categories ic ON ic.id = ii.category_id
         LEFT JOIN suppliers s ON s.id = ii.default_supplier_id AND s.deleted_at IS NULL
         LEFT JOIN (
           SELECT it.item_id,
                  SUM(CASE WHEN it.transaction_type = 'usage' THEN it.quantity ELSE -it.quantity END) AS used
             FROM inventory_transactions it
            WHERE it.deleted_at IS NULL
              AND it.transaction_type IN ('usage', 'return')
              AND it.transaction_date > CURRENT_DATE - $1::int
              AND it.transaction_date <= CURRENT_DATE
            GROUP BY it.item_id
         ) u ON u.item_id = ii.id
        WHERE ii.deleted_at IS NULL
          AND ii.is_active IS NOT FALSE
          AND ii.minimum_stock > 0
          AND ii.current_stock <= ii.minimum_stock
        ORDER BY ii.current_stock / ii.minimum_stock, ii.name`,
      [usageDays]
    );
  }

  /**
   * Batches holding stock that expire within `days` days, or have expired
   * @param {number} days
   * @returns {Promise<Array>}
   */
  async findExpiringBatches(days) {
    return db.any(
      `SELECT ib.id AS batch_id, ib.batch_number,
              ii.id AS item_id, ii.item_code, ii.name AS item_name, ii.unit,
              ic.name AS category_name,
              ib.quantity, ib.unit_cost, ib.expiry_date, ib.status,
              ib.storage_location, ib.supplier,
              ib.expiry_date - CURRENT_DATE AS days_until_expiry
         FROM inventory_batches ib
         JOIN inventory_items ii ON ii.id = ib.inventory_item_id
         JOIN inventory_categories ic ON ic.id = ii.category_id
        WHERE ${HELD_BATCH}
          AND ii.deleted_at IS NULL
          AND ib.expiry_date <= CURRENT_DATE + $1::int
        ORDER BY ib.expiry_date, ii.name, ib.batch_number`,
      [days]
    );
  }

  /**
   * Stock held outside any batch on items whose own expiry date falls within
   * `days` days, or has passed
   * @param {number} days
   * @returns {Promise<Array>} quantity is the unbatched remainder
   */
  async findExpiringUnbatchedStock(days) {
    return db.any(
      `SELECT ii.id AS item_id, ii.item_code, ii.name AS item_name, ii.unit,
              ic.name AS category_name,
              ii.current_stock - COALESCE(b.batch_quantity, 0) AS quantity,
              COALESCE(ii.cost_per_unit, ii.unit_cost) AS unit_cost,
              ii.expiry_date, ii.location AS storage_location,
              ii.expiry_date - CURRENT_DATE AS days_until_expiry
         FROM inventory_items ii
         JOIN inventory_categories ic ON ic.id = ii.category_id
         LEFT JOIN (
           SELECT ib.inventory_item_id, SUM(ib.quantity) AS batch_quantity
             FROM inventory_batches ib
            WHERE ${HELD_BATCH}
            GROUP BY ib.inventory_item_id
         ) b ON b.inventory_item_id = ii.id
        WHERE ii.deleted_at IS NULL
          AND ii.expiry_date <= CURRENT_DATE + $1::int
          AND ii.current_stock - COALESCE(b.batch_quantity, 0) > 0
        ORDER BY ii.expiry_date, ii.name`,
      [days]
    );
  }
}

module.exports = new InventoryReportRepository();
