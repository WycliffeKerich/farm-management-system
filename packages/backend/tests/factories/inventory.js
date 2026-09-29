const { db } = require('../../src/config/database');

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

async function createCategory(overrides = {}) {
  const n = next();
  return db.one('INSERT INTO inventory_categories ($1:name) VALUES ($1:csv) RETURNING *', [
    { name: `Category ${n}`, type: `category_${n}`, ...overrides },
  ]);
}

/**
 * Insert an item with zero stock (creates a category unless given).
 * Add stock through the API so it has ledger rows.
 */
async function createItem(overrides = {}) {
  const n = next();
  const categoryId = overrides.category_id || (await createCategory()).id;
  return db.one('INSERT INTO inventory_items ($1:name) VALUES ($1:csv) RETURNING *', [
    {
      name: `Item ${n}`,
      item_code: `TST-${String(n).padStart(4, '0')}`,
      unit: 'kg',
      minimum_stock: 0,
      ...overrides,
      category_id: categoryId,
    },
  ]);
}

module.exports = { createCategory, createItem };
