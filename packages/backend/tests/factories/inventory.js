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

/**
 * Insert a unit of measure. Pass `base` (a unit row) and `conversion_factor`
 * for a derived unit: 1 of this unit = conversion_factor of the base.
 */
async function createUnit({ base, ...overrides } = {}) {
  return db.one('INSERT INTO units_of_measure ($1:name) VALUES ($1:csv) RETURNING *', [
    {
      category: base ? base.category : 'weight',
      conversion_factor: 1,
      ...overrides,
      base_unit_id: base ? base.id : null,
    },
  ]);
}

module.exports = { createCategory, createItem, createUnit };
