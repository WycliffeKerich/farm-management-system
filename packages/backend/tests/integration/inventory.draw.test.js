const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createItem, createUnit } = require('../factories/inventory');
const { addDays } = require('../../src/utils/dates');

let manager;
let today;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
  ({ today } = await db.one('SELECT CURRENT_DATE::text AS today'));
});

const move = (body) => request(app).post('/api/v1/inventory/transactions').set(manager.auth).send(body);
const use = (itemId, body) => request(app).post(`/api/v1/inventory/items/${itemId}/use`).set(manager.auth).send(body);
const receive = (itemId, quantity, extra = {}) =>
  request(app)
    .post('/api/v1/inventory/batches')
    .set(manager.auth)
    .send({ inventory_item_id: itemId, quantity, ...extra });
const stockOf = async (itemId) =>
  (await db.one('SELECT current_stock FROM inventory_items WHERE id = $1', [itemId])).current_stock;
const batchRow = (id) => db.one('SELECT quantity, status FROM inventory_batches WHERE id = $1', [id]);

describe('drawing stock', () => {
  it('draws batches first expiry first, then stock no batch holds', async () => {
    const item = await createItem({ cost_per_unit: 10 });
    const batch = (await receive(item.id, 5, { expiry_date: addDays(today, 30), unit_cost: 12 })).body.data;
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 4 });

    const res = await use(item.id, { quantity: 7 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      batch_deductions: [{ batch_id: batch.id, quantity_deducted: 5, remaining_in_batch: 0 }],
      unbatched_quantity: 2,
      quantity: 7,
      unit: 'kg',
      total_cost: 80, // 5 × 12 from the batch + 2 × 10 at the item cost
      current_stock: 2,
    });
    expect(res.body.data.transactions.map((row) => [row.inventory_batch_id, row.quantity, row.total_cost])).toEqual([
      [batch.id, 5, 60],
      [null, 2, 20],
    ]);
  });

  it('never draws from a batch past its expiry date, even with unbatched stock beside it', async () => {
    const item = await createItem();
    await receive(item.id, 5, { expiry_date: addDays(today, -1) });
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 3 });

    const res = await use(item.id, { quantity: 4 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: 3, requested: 4 } });
    expect(await stockOf(item.id)).toBe(8);
  });

  it('total_cost is null when any part of the draw has no known cost', async () => {
    const item = await createItem();
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 2 });

    const res = await use(item.id, { quantity: 1 });
    expect(res.body.data.total_cost).toBeNull();
  });
});

describe('a named batch', () => {
  it('draws only from that batch', async () => {
    const item = await createItem();
    await receive(item.id, 5, { expiry_date: addDays(today, 30) });
    const later = (await receive(item.id, 5, { expiry_date: addDays(today, 90) })).body.data;

    const res = await use(item.id, { quantity: 2, inventory_batch_id: later.id });

    expect(res.status).toBe(201);
    expect(res.body.data.batch_deductions).toEqual([
      { batch_id: later.id, batch_number: later.batch_number, quantity_deducted: 2, remaining_in_batch: 3 },
    ]);
    expect((await use(item.id, { quantity: 4, inventory_batch_id: later.id })).status).toBe(409);
  });

  it('refuses to use a batch past its expiry date, but lets it be written off', async () => {
    const item = await createItem();
    const old = (await receive(item.id, 5, { expiry_date: addDays(today, -1) })).body.data;

    const refused = await use(item.id, { quantity: 1, inventory_batch_id: old.id });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('BATCH_NOT_USABLE');

    const waste = await move({ item_id: item.id, transaction_type: 'waste', quantity: 5, inventory_batch_id: old.id });
    expect(waste.status).toBe(201);
    expect(await stockOf(item.id)).toBe(0);
  });

  it('a batch of another item is not found', async () => {
    const item = await createItem();
    const other = await createItem();
    const batch = (await receive(other.id, 5)).body.data;
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 5 });

    expect((await use(item.id, { quantity: 1, inventory_batch_id: batch.id })).status).toBe(404);
  });
});

describe('other movement types', () => {
  it('an expired write-off takes the expired batches, not the good ones', async () => {
    const item = await createItem();
    const old = (await receive(item.id, 5, { expiry_date: addDays(today, -1) })).body.data;
    const good = (await receive(item.id, 5, { expiry_date: addDays(today, 60) })).body.data;

    const res = await move({ item_id: item.id, transaction_type: 'expired', quantity: 5 });

    expect(res.status).toBe(201);
    expect(res.body.data.batch_deductions.map((d) => d.batch_id)).toEqual([old.id]);
    expect((await batchRow(good.id)).quantity).toBe(5);
    expect((await move({ item_id: item.id, transaction_type: 'expired', quantity: 1 })).status).toBe(409);
  });

  it('waste spanning two batches reports the whole movement', async () => {
    const item = await createItem();
    await receive(item.id, 3, { expiry_date: addDays(today, 30) });
    await receive(item.id, 3, { expiry_date: addDays(today, 60) });

    const res = await move({ item_id: item.id, transaction_type: 'waste', quantity: 4 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ quantity: 4, stock_before: 6, stock_after: 2 });
    expect(res.body.data.transactions).toHaveLength(2);
  });

  it('a negative adjustment draws from batches and keeps its sign in the ledger', async () => {
    const item = await createItem();
    const batch = (await receive(item.id, 5)).body.data;

    const res = await move({ item_id: item.id, transaction_type: 'adjustment', quantity: -1.5 });

    expect(res.status).toBe(201);
    expect(res.body.data.quantity).toBe(-1.5);
    expect((await batchRow(batch.id)).quantity).toBe(3.5);
  });

  it('a return into a depleted batch adds to it and makes it active again', async () => {
    const item = await createItem();
    const batch = (await receive(item.id, 2)).body.data;
    await use(item.id, { quantity: 2 });
    expect((await batchRow(batch.id)).status).toBe('depleted');

    const res = await move({ item_id: item.id, transaction_type: 'return', quantity: 1, inventory_batch_id: batch.id });

    expect(res.status).toBe(201);
    expect(await batchRow(batch.id)).toEqual({ quantity: 1, status: 'active' });
    expect(await stockOf(item.id)).toBe(1);
  });
});

describe('units', () => {
  let kg;

  beforeEach(async () => {
    kg = await createUnit({ name: 'Kilogram', symbol: 'kg' });
    await createUnit({ name: 'Gram', symbol: 'g', base: kg, conversion_factor: 0.001 });
    await createUnit({ name: 'Piece', symbol: 'pcs', category: 'count' });
    await createUnit({ name: 'Bag', symbol: 'bag', category: 'count' });
  });

  it('converts a quantity in grams to an item stocked in kilograms', async () => {
    const item = await createItem({ unit: 'kg', unit_of_measure_id: kg.id, cost_per_unit: 200 });
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 2 });

    const res = await use(item.id, { quantity: 500, unit: 'g' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ quantity: 0.5, unit: 'kg', total_cost: 100, current_stock: 1.5 });
  });

  it('finds the item unit by its symbol when the item has no unit id', async () => {
    const item = await createItem({ unit: 'KG' });
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 1 });

    expect((await use(item.id, { quantity: 250, unit: 'Gram' })).body.data.current_stock).toBe(0.75);
  });

  it('refuses units that do not share a base unit, even in the same category', async () => {
    const item = await createItem({ unit: 'bag' });
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 3 });

    for (const unit of ['pcs', 'g', 'furlong']) {
      const res = await use(item.id, { quantity: 1, unit });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toMatchObject({ code: 'UNIT_MISMATCH' });
    }
    expect(await stockOf(item.id)).toBe(3);
  });

  it('refuses an amount that rounds to nothing in the item unit', async () => {
    const item = await createItem({ unit: 'kg', unit_of_measure_id: kg.id });
    await move({ item_id: item.id, transaction_type: 'purchase', quantity: 1 });

    expect((await use(item.id, { quantity: 1, unit: 'g' })).status).toBe(400);
  });
});
