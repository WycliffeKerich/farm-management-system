const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createCategory, createItem } = require('../factories/inventory');
const { addDays } = require('../../src/utils/dates');
const inventoryService = require('../../src/services/inventory.service');

let manager;
let today;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
  ({ today } = await db.one('SELECT CURRENT_DATE::text AS today'));
});

const move = (session, body) => request(app).post('/api/v1/inventory/transactions').set(session.auth).send(body);
const stockOf = async (itemId) =>
  (await db.one('SELECT current_stock FROM inventory_items WHERE id = $1', [itemId])).current_stock;
const ledgerCount = async (itemId) =>
  (await db.one('SELECT COUNT(*)::int AS n FROM inventory_transactions WHERE item_id = $1', [itemId])).n;

describe('stock movements', () => {
  it('purchase then usage leaves exact decimal stock and returns numbers', async () => {
    const item = await createItem();

    expect((await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 10.5 })).status).toBe(201);
    const usage = await move(manager, { item_id: item.id, transaction_type: 'usage', quantity: 0.25 });

    expect(usage.status).toBe(201);
    expect(usage.body.data).toMatchObject({ quantity: 0.25, stock_before: 10.5, stock_after: 10.25 });
    expect(await stockOf(item.id)).toBe(10.25);

    const detail = await request(app).get(`/api/v1/inventory/items/${item.id}`).set(manager.auth);
    expect(detail.body.data.current_stock).toBe(10.25);
  });

  it('float noise never reaches the stock (0.1 + 0.2 = 0.3)', async () => {
    const item = await createItem();
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 0.1 });
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 0.2 });

    const usage = await move(manager, { item_id: item.id, transaction_type: 'usage', quantity: 0.3 });
    expect(usage.status).toBe(201);
    expect(await stockOf(item.id)).toBe(0);
  });

  it('usage beyond stock returns 409 and writes nothing', async () => {
    const item = await createItem();
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 3 });

    const res = await move(manager, { item_id: item.id, transaction_type: 'usage', quantity: 3.01 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: 3, requested: 3.01 } });
    expect(await stockOf(item.id)).toBe(3);
    expect(await ledgerCount(item.id)).toBe(1);
  });

  it('a negative adjustment below zero is refused; a positive one adds stock', async () => {
    const item = await createItem();
    expect((await move(manager, { item_id: item.id, transaction_type: 'adjustment', quantity: -1 })).status).toBe(409);
    expect((await move(manager, { item_id: item.id, transaction_type: 'adjustment', quantity: 4 })).status).toBe(201);
    expect((await move(manager, { item_id: item.id, transaction_type: 'adjustment', quantity: -1.5 })).status).toBe(
      201
    );
    expect(await stockOf(item.id)).toBe(2.5);
  });

  it('rejects zero or negative quantities for directional types', async () => {
    const item = await createItem();
    for (const quantity of [0, -2]) {
      const res = await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity });
      expect(res.status).toBe(400);
    }
    expect(await ledgerCount(item.id)).toBe(0);
  });

  it('10 concurrent usages of 1 against stock 5: exactly 5 succeed and stock ends at 0', async () => {
    const item = await createItem();
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 5 });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => move(manager, { item_id: item.id, transaction_type: 'usage', quantity: 1 }))
    );
    const statuses = results.map((res) => res.status).sort();

    expect(statuses).toEqual([201, 201, 201, 201, 201, 409, 409, 409, 409, 409]);
    expect(await stockOf(item.id)).toBe(0);
    expect(await ledgerCount(item.id)).toBe(6);

    // Each successful row saw the stock the previous one left
    const afters = await db.map(
      "SELECT stock_after FROM inventory_transactions WHERE item_id = $1 AND transaction_type = 'usage' ORDER BY id",
      [item.id],
      (row) => row.stock_after
    );
    expect(afters).toEqual([4, 3, 2, 1, 0]);
  });

  it('workers can record movements but not create items', async () => {
    const worker = await loginAs(app, 'worker');
    const item = await createItem();

    expect((await move(worker, { item_id: item.id, transaction_type: 'purchase', quantity: 2 })).status).toBe(201);
    const create = await request(app)
      .post('/api/v1/inventory/items')
      .set(worker.auth)
      .send({ name: 'Maize seed', category_id: item.category_id, unit: 'kg' });
    expect(create.status).toBe(403);
  });
});

describe('items', () => {
  it('opening stock on create goes through the ledger', async () => {
    const category = await createCategory({ name: 'Feed' });

    const res = await request(app)
      .post('/api/v1/inventory/items')
      .set(manager.auth)
      .send({ name: 'Layers mash', category_id: category.id, unit: 'kg', current_stock: 70 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ item_code: 'FED-0001', current_stock: 70 });
    const ledger = await db.one(
      'SELECT transaction_type, quantity, notes FROM inventory_transactions WHERE item_id = $1',
      [res.body.data.id]
    );
    expect(ledger).toEqual({ transaction_type: 'adjustment', quantity: 70, notes: 'Opening stock' });
  });

  it('ignores unknown body keys instead of putting them in SQL', async () => {
    const category = await createCategory();

    const res = await request(app).post('/api/v1/inventory/items').set(manager.auth).send({
      name: 'Urea',
      category_id: category.id,
      unit: 'kg',
      'name) VALUES (1); --': 'x',
      deleted_at: '2026-01-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.deleted_at).toBeNull();
  });

  it('updating an item cannot change its stock', async () => {
    const item = await createItem();
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 8 });

    const res = await request(app)
      .put(`/api/v1/inventory/items/${item.id}`)
      .set(manager.auth)
      .send({ name: item.name, current_stock: 999, notes: 'Top shelf' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ current_stock: 8, notes: 'Top shelf' });
  });

  it('accepts the item form as the UI sends it, with empty optional fields as null', async () => {
    const category = await createCategory();
    const form = {
      name: 'Dairy Meal',
      category_id: category.id,
      unit: 'bags',
      minimum_stock: 0,
      cost_per_unit: null,
      expiry_date: null,
      supplier: '',
      location: '',
      description: '',
      is_active: true,
    };

    const created = await request(app)
      .post('/api/v1/inventory/items')
      .set(manager.auth)
      .send({ ...form, current_stock: 0, expiry_date: '2027-03-01' });
    expect(created.status).toBe(201);
    expect(created.body.data.expiry_date).toBe('2027-03-01');

    const cleared = await request(app)
      .put(`/api/v1/inventory/items/${created.body.data.id}`)
      .set(manager.auth)
      .send(form);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ expiry_date: null, cost_per_unit: null });
  });

  it('transaction listings carry the item unit', async () => {
    const item = await createItem({ unit: 'L' });
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 3 });

    const all = await request(app).get('/api/v1/inventory/transactions').set(manager.auth);
    expect(all.body.data[0]).toMatchObject({ item_id: item.id, unit: 'L' });
  });

  it('unknown item → 404', async () => {
    const res = await move(manager, { item_id: 999999, transaction_type: 'purchase', quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe('batches and FEFO', () => {
  const receive = (itemId, quantity, extra = {}) =>
    request(app)
      .post('/api/v1/inventory/batches')
      .set(manager.auth)
      .send({ inventory_item_id: itemId, quantity, ...extra });
  const use = (itemId, quantity) =>
    request(app).post(`/api/v1/inventory/items/${itemId}/use`).set(manager.auth).send({ quantity });
  const batchQuantities = (itemId) =>
    db.map(
      'SELECT quantity FROM inventory_batches WHERE inventory_item_id = $1 ORDER BY id',
      [itemId],
      (row) => row.quantity
    );

  it('receiving a batch adds its quantity to stock once, with a linked purchase row', async () => {
    const item = await createItem();

    const res = await receive(item.id, 12.5, { unit_cost: 40, expiry_date: addDays(today, 90) });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ quantity: 12.5, initial_quantity: 12.5, total_cost: 500 });
    expect(await stockOf(item.id)).toBe(12.5);
    const ledger = await db.one(
      'SELECT transaction_type, quantity, inventory_batch_id FROM inventory_transactions WHERE item_id = $1',
      [item.id]
    );
    expect(ledger).toEqual({ transaction_type: 'purchase', quantity: 12.5, inventory_batch_id: res.body.data.id });
  });

  it('consumes the earliest-expiry batch first, across batches, one ledger row per batch', async () => {
    const item = await createItem();
    const late = (await receive(item.id, 5, { expiry_date: addDays(today, 200) })).body.data;
    const early = (await receive(item.id, 5, { expiry_date: addDays(today, 30) })).body.data;
    const noExpiry = (await receive(item.id, 5)).body.data;

    const res = await use(item.id, 7);

    expect(res.status).toBe(201);
    expect(res.body.data.batch_deductions).toEqual([
      { batch_id: early.id, batch_number: early.batch_number, quantity_deducted: 5, remaining_in_batch: 0 },
      { batch_id: late.id, batch_number: late.batch_number, quantity_deducted: 2, remaining_in_batch: 3 },
    ]);
    expect(res.body.data.transactions.map((row) => [row.inventory_batch_id, row.quantity, row.stock_after])).toEqual([
      [early.id, 5, 10],
      [late.id, 2, 8],
    ]);
    expect(res.body.data.current_stock).toBe(8);
    expect(await batchQuantities(item.id)).toEqual([3, 0, 5]);
    expect((await db.one('SELECT status FROM inventory_batches WHERE id = $1', [early.id])).status).toBe('depleted');
    expect(noExpiry.quantity).toBe(5);
  });

  it('skips batches that are already past their expiry date', async () => {
    const item = await createItem();
    await receive(item.id, 5, { expiry_date: addDays(today, -1) });
    const good = (await receive(item.id, 5, { expiry_date: addDays(today, 60) })).body.data;

    const res = await use(item.id, 2);

    expect(res.status).toBe(201);
    expect(res.body.data.batch_deductions.map((d) => d.batch_id)).toEqual([good.id]);
    expect((await use(item.id, 4)).status).toBe(409);
  });

  it('insufficient batch stock leaves every batch, the stock and the ledger unchanged', async () => {
    const item = await createItem();
    await receive(item.id, 5, { expiry_date: addDays(today, 30) });
    await receive(item.id, 5, { expiry_date: addDays(today, 60) });

    const res = await use(item.id, 10.01);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await batchQuantities(item.id)).toEqual([5, 5]);
    expect(await stockOf(item.id)).toBe(10);
    expect(await ledgerCount(item.id)).toBe(2);
  });

  it('a batch with stock cannot be deleted', async () => {
    const item = await createItem();
    const batch = (await receive(item.id, 5)).body.data;

    const res = await request(app).delete(`/api/v1/inventory/batches/${batch.id}`).set(manager.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HAS_STOCK');
  });

  it('current_stock equals the ledger after a mixed sequence', async () => {
    const item = await createItem();
    await receive(item.id, 20, { expiry_date: addDays(today, 30) });
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 4.75 });
    await use(item.id, 6.5);
    await move(manager, { item_id: item.id, transaction_type: 'waste', quantity: 0.25 });
    await move(manager, { item_id: item.id, transaction_type: 'adjustment', quantity: -1 });
    await move(manager, { item_id: item.id, transaction_type: 'return', quantity: 2 });
    await move(manager, { item_id: item.id, transaction_type: 'usage', quantity: 100 }); // refused

    expect(await stockOf(item.id)).toBe(19);
    expect(await inventoryService.findStockDrift()).toEqual({ ledger: [], batches: [] });
  });

  it('the reconcile check reports drift introduced behind the ledger', async () => {
    const item = await createItem();
    await move(manager, { item_id: item.id, transaction_type: 'purchase', quantity: 5 });
    await db.none('UPDATE inventory_items SET current_stock = 7 WHERE id = $1', [item.id]);

    const { ledger } = await inventoryService.findStockDrift();
    expect(ledger).toEqual([
      expect.objectContaining({ item_id: item.id, current_stock: 7, ledger_stock: 5, drift: 2 }),
    ]);
  });
});

describe('database guarantees', () => {
  it('stock and batch quantities cannot go negative', async () => {
    const item = await createItem();
    await expect(
      db.none('UPDATE inventory_items SET current_stock = -1 WHERE id = $1', [item.id])
    ).rejects.toMatchObject({
      code: '23514',
    });

    const batch = await db.one(
      "INSERT INTO inventory_batches (inventory_item_id, batch_number, quantity, initial_quantity) VALUES ($1, 'B1', 1, 1) RETURNING id",
      [item.id]
    );
    await expect(
      db.none('UPDATE inventory_batches SET quantity = -0.01 WHERE id = $1', [batch.id])
    ).rejects.toMatchObject({
      code: '23514',
    });
  });

  it('a hard DELETE of an item with batches is blocked', async () => {
    const item = await createItem();
    await db.none(
      "INSERT INTO inventory_batches (inventory_item_id, batch_number, quantity, initial_quantity) VALUES ($1, 'B1', 0, 0)",
      [item.id]
    );
    await expect(db.none('DELETE FROM inventory_items WHERE id = $1', [item.id])).rejects.toMatchObject({
      code: '23001',
    });
  });
});
