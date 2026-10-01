const inventoryReportRepository = require('../repositories/inventory-report.repository');

const round2 = (value) => Math.round(value * 100) / 100;
const hasCost = (cost) => cost !== null && cost !== undefined;

/**
 * Inventory reports: what stock is worth, what to reorder, and what is about
 * to expire. Quantities are in each item's own unit.
 */
class InventoryReportService {
  /**
   * Stock valuation at batch cost. Stock in a batch is valued at that batch's
   * unit cost; stock held outside any batch at the item's cost per unit.
   * Stock with neither cost is counted as uncosted rather than guessed.
   * @param {Object} [filters] - category_id
   * @returns {Promise<Object>} { total_value, item_count, uncosted_item_count, categories, items }
   */
  async valuation(filters = {}) {
    const rows = await inventoryReportRepository.findStockForValuation(filters);
    const items = rows.map(valueItem);

    const categories = new Map();
    for (const item of items) {
      if (!categories.has(item.category_id)) {
        categories.set(item.category_id, {
          category_id: item.category_id,
          category_name: item.category_name,
          item_count: 0,
          uncosted_item_count: 0,
          value: 0,
        });
      }
      const category = categories.get(item.category_id);
      category.item_count += 1;
      category.uncosted_item_count += item.uncosted_quantity > 0 ? 1 : 0;
      category.value = round2(category.value + item.value);
    }

    return {
      total_value: round2(items.reduce((sum, item) => sum + item.value, 0)),
      item_count: items.length,
      uncosted_item_count: items.filter((item) => item.uncosted_quantity > 0).length,
      categories: [...categories.values()],
      items,
    };
  }

  /**
   * Items at or below their minimum stock, with how long the stock will last
   * at recent usage and how much to order. The suggested quantity is the
   * item's reorder quantity, or else enough to bring stock up to twice the
   * minimum.
   * @param {number} [usageDays=30] - Days of history to average usage over
   * @returns {Promise<Object>} { usage_days, item_count, estimated_cost, items }
   */
  async reorder(usageDays = 30) {
    usageDays = Number(usageDays);
    const rows = await inventoryReportRepository.findReorderItems(usageDays);

    const items = rows.map((row) => {
      const dailyUsage = round2(row.used / usageDays);
      const suggested =
        row.reorder_quantity > 0 ? row.reorder_quantity : round2(2 * row.minimum_stock - row.current_stock);
      return {
        item_id: row.item_id,
        item_code: row.item_code,
        name: row.name,
        unit: row.unit,
        category_id: row.category_id,
        category_name: row.category_name,
        current_stock: row.current_stock,
        minimum_stock: row.minimum_stock,
        reorder_quantity: row.reorder_quantity,
        shortfall: round2(row.minimum_stock - row.current_stock),
        average_daily_usage: dailyUsage,
        days_of_cover: dailyUsage > 0 ? Math.floor(row.current_stock / dailyUsage) : null,
        suggested_quantity: suggested,
        unit_cost: row.item_unit_cost,
        estimated_cost: hasCost(row.item_unit_cost) ? round2(suggested * row.item_unit_cost) : null,
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        supplier_phone: row.supplier_phone,
        supplier_email: row.supplier_email,
      };
    });

    return {
      usage_days: usageDays,
      item_count: items.length,
      estimated_cost: round2(items.reduce((sum, item) => sum + (item.estimated_cost || 0), 0)),
      items,
    };
  }

  /**
   * Stock that expires within `days` days, and stock already expired but not
   * yet written off, with the value at risk. Batches carry their own expiry
   * date; stock held outside any batch goes by the item's expiry date.
   * @param {number} [days=30]
   * @returns {Promise<Object>} { days, expired, expiring, totals }
   */
  async expiring(days = 30) {
    days = Number(days);
    const [batches, unbatched] = await Promise.all([
      inventoryReportRepository.findExpiringBatches(days),
      inventoryReportRepository.findExpiringUnbatchedStock(days),
    ]);

    const entries = [
      ...batches,
      ...unbatched.map((row) => ({ batch_id: null, batch_number: null, status: null, supplier: null, ...row })),
    ]
      .map((row) => ({
        ...row,
        value_at_risk: hasCost(row.unit_cost) ? round2(row.quantity * row.unit_cost) : null,
      }))
      .sort((a, b) => a.days_until_expiry - b.days_until_expiry || a.item_name.localeCompare(b.item_name));

    const expired = entries.filter((entry) => entry.days_until_expiry < 0);
    const expiring = entries.filter((entry) => entry.days_until_expiry >= 0);
    const valueOf = (list) => round2(list.reduce((sum, entry) => sum + (entry.value_at_risk || 0), 0));

    return {
      days,
      expired,
      expiring,
      totals: {
        expired_count: expired.length,
        expired_value: valueOf(expired),
        expiring_count: expiring.length,
        expiring_value: valueOf(expiring),
        uncosted_count: entries.filter((entry) => entry.value_at_risk === null).length,
      },
    };
  }
}

/** Value one item's stock (see valuation) */
function valueItem(row) {
  const unbatched = Math.max(round2(row.current_stock - row.batch_quantity), 0);
  const itemCosted = hasCost(row.item_unit_cost);
  const value = round2(row.batch_value + (itemCosted ? unbatched * row.item_unit_cost : 0));
  const uncosted = round2(row.uncosted_batch_quantity + (itemCosted ? 0 : unbatched));
  const costed = round2(row.batch_quantity + unbatched - uncosted);

  return {
    item_id: row.item_id,
    item_code: row.item_code,
    name: row.name,
    unit: row.unit,
    category_id: row.category_id,
    category_name: row.category_name,
    quantity: row.current_stock,
    batched_quantity: row.batch_quantity,
    unbatched_quantity: unbatched,
    uncosted_quantity: uncosted,
    value,
    average_unit_cost: costed > 0 ? round2(value / costed) : null,
  };
}

module.exports = new InventoryReportService();
