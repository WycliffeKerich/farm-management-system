require('dotenv').config();
const { testConnection, closeDatabase } = require('../config/database');
const inventoryService = require('../services/inventory.service');
const logger = require('../utils/logger');

/**
 * Report inventory items whose stock does not match their history
 *
 * Usage:
 *   npm run inventory:reconcile
 *
 * Read-only. Exits 1 when drift is found so it can run from cron or CI.
 * Fix drift with an 'adjustment' transaction that explains the difference.
 */
async function reconcile() {
  try {
    if (!(await testConnection())) {
      throw new Error('Database connection failed');
    }

    const { ledger, batches } = await inventoryService.findStockDrift();

    for (const row of ledger) {
      logger.warn(
        `Item ${row.item_id} ${row.item_code || ''} "${row.name}": current_stock ${row.current_stock}, ` +
          `ledger ${row.ledger_stock} (drift ${row.drift})`
      );
    }
    for (const row of batches) {
      logger.warn(
        `Item ${row.item_id} ${row.item_code || ''} "${row.name}": batches hold ${row.batch_stock}, ` +
          `more than current_stock ${row.current_stock}`
      );
    }

    const problems = ledger.length + batches.length;
    if (problems === 0) {
      logger.info('✓ Inventory stock matches the ledger');
    } else {
      logger.warn(`✗ ${ledger.length} item(s) drift from the ledger, ${batches.length} with excess batch stock`);
    }
    closeDatabase();
    process.exit(problems === 0 ? 0 : 1);
  } catch (error) {
    logger.error(`Reconcile failed: ${error.message}`);
    closeDatabase();
    process.exit(2);
  }
}

reconcile();
