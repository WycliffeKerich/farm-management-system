const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createBatch } = require('../factories/crop');
const { createItem, createUnit } = require('../factories/inventory');

let owner;
let manager;
let worker;
let batch;

beforeEach(async () => {
  await truncateAll();
  owner = await loginAs(app, 'owner');
  manager = await loginAs(app, 'manager');
  worker = await loginAs(app, 'worker');
  batch = await createBatch();
});

const apply = (body, session = worker, batchId = batch.id) =>
  request(app).post(`/api/v1/crops/batches/${batchId}/input-applications`).set(session.auth).send(body);
const harvest = (body, session = worker) =>
  request(app)
    .post(`/api/v1/crops/batches/${batch.id}/harvests`)
    .set(session.auth)
    .send({ quantity: 20, unit: 'kg', ...body });
const receive = (itemId, quantity, extra = {}) =>
  request(app)
    .post('/api/v1/inventory/batches')
    .set(manager.auth)
    .send({ inventory_item_id: itemId, quantity, ...extra });
const stockOf = async (itemId) =>
  (await db.one('SELECT current_stock FROM inventory_items WHERE id = $1', [itemId])).current_stock;
const count = async (table) => (await db.one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n;

const spray = { application_date: '2026-03-01', input_type: 'pesticide', quantity: 2 };

describe('input applications taken from stock', () => {
  it('uses the item, converts units, keeps the cost and the pre-harvest interval', async () => {
    const kg = await createUnit({ name: 'Kilogram', symbol: 'kg' });
    await createUnit({ name: 'Gram', symbol: 'g', base: kg, conversion_factor: 0.001 });
    const item = await createItem({ name: 'Mancozeb', unit: 'kg', pre_harvest_interval_days: 7 });
    const stockBatch = (await receive(item.id, 10, { unit_cost: 200 })).body.data;

    const res = await apply({ ...spray, quantity: 500, unit: 'g', inventory_item_id: item.id });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      product_name: 'Mancozeb',
      quantity: 500,
      unit: 'g',
      inventory_item_id: item.id,
      stock_quantity: 0.5,
      total_cost: 100,
      pre_harvest_interval_days: 7,
      safe_harvest_date: '2026-03-08',
      stock: {
        current_stock: 9.5,
        unit: 'kg',
        batch_deductions: [{ batch_id: stockBatch.id, quantity_deducted: 0.5 }],
      },
    });
    expect(await stockOf(item.id)).toBe(9.5);

    const ledger = await db.one(
      `SELECT transaction_type, quantity, reference_type, reference_id, transaction_date::text AS date
         FROM inventory_transactions WHERE transaction_type = 'usage'`
    );
    expect(ledger).toEqual({
      transaction_type: 'usage',
      quantity: 0.5,
      reference_type: 'crop_input_application',
      reference_id: res.body.data.id,
      date: expect.stringMatching(/^2026-03-01/),
    });
  });

  it('keeps the longer of the entered and the labelled interval, and ignores computed fields sent in', async () => {
    const item = await createItem({ pre_harvest_interval_days: 7 });
    await receive(item.id, 10);

    const shorter = await apply({
      ...spray,
      inventory_item_id: item.id,
      pre_harvest_interval_days: 3,
      safe_harvest_date: '2026-03-02',
      stock_quantity: 99,
      total_cost: 1,
    });
    expect(shorter.body.data).toMatchObject({
      pre_harvest_interval_days: 7,
      safe_harvest_date: '2026-03-08',
      stock_quantity: 2,
      total_cost: null,
    });

    const longer = await apply({ ...spray, inventory_item_id: item.id, pre_harvest_interval_days: 14 });
    expect(longer.body.data.safe_harvest_date).toBe('2026-03-15');

    const manual = await apply({ ...spray, product_name: 'Neem oil', unit: 'L', pre_harvest_interval_days: 1 });
    expect(manual.body.data).toMatchObject({
      inventory_item_id: null,
      stock_quantity: null,
      safe_harvest_date: '2026-03-02',
    });
  });

  it('records nothing when stock is short or the batch cannot be used', async () => {
    const item = await createItem();
    const expired = (await receive(item.id, 5, { expiry_date: '2020-01-01' })).body.data;

    const short = await apply({ ...spray, inventory_item_id: item.id, pre_harvest_interval_days: 7 });
    expect(short.status).toBe(409);
    expect(short.body.error.code).toBe('INSUFFICIENT_STOCK');

    const unusable = await apply({ ...spray, inventory_item_id: item.id, inventory_batch_id: expired.id });
    expect(unusable.status).toBe(409);
    expect(unusable.body.error.code).toBe('BATCH_NOT_USABLE');

    expect(await count('crop_input_applications')).toBe(0);
    expect(await stockOf(item.id)).toBe(5);
    // With no application saved, there is no pre-harvest hold either
    expect((await harvest({ harvest_date: '2026-03-02' })).status).toBe(201);
  });

  it('needs a product name and unit unless an item is chosen', async () => {
    const missing = await apply(spray);
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.field).sort()).toEqual(['product_name', 'unit']);

    expect((await apply({ ...spray, product_name: 'X', unit: 'kg', inventory_item_id: 9999 })).status).toBe(404);
  });

  it('deleting an application puts its stock back in the batch it came from, once', async () => {
    const item = await createItem({ pre_harvest_interval_days: 7 });
    const stockBatch = (await receive(item.id, 2)).body.data;
    const application = (await apply({ ...spray, inventory_item_id: item.id })).body.data;
    expect((await db.one('SELECT status FROM inventory_batches WHERE id = $1', [stockBatch.id])).status).toBe(
      'depleted'
    );

    const del = () => request(app).delete(`/api/v1/crops/input-applications/${application.id}`).set(manager.auth);
    expect((await del()).status).toBe(200);
    expect((await del()).status).toBe(404);

    expect(await stockOf(item.id)).toBe(2);
    expect(await db.one('SELECT quantity, status FROM inventory_batches WHERE id = $1', [stockBatch.id])).toEqual({
      quantity: 2,
      status: 'active',
    });
    const returns = await db.any(
      `SELECT inventory_batch_id, quantity FROM inventory_transactions WHERE transaction_type = 'return'`
    );
    expect(returns).toEqual([{ inventory_batch_id: stockBatch.id, quantity: 2 }]);

    // The hold went with it
    expect((await harvest({ harvest_date: '2026-03-02' })).status).toBe(201);
  });

  it('completing a scheduled task with an input takes it from stock, or does nothing at all', async () => {
    const item = await createItem({ name: 'CAN', unit: 'kg' });
    await receive(item.id, 3);
    const plan = await db.one(`INSERT INTO crop_care_plans (plan_code, name) VALUES ('CP-1', 'Plan') RETURNING id`);
    const schedule = await db.one('INSERT INTO batch_care_schedules (batch_id, plan_id) VALUES ($1, $2) RETURNING id', [
      batch.id,
      plan.id,
    ]);
    const task = await db.one(
      `INSERT INTO scheduled_batch_tasks
         (batch_id, schedule_id, planned_date, due_date_start, due_date_end, task_name, input_type, input_quantity, input_unit)
       VALUES ($1, $2, '2026-03-01', '2026-02-27', '2026-03-03', 'Top dress', 'fertilizer', 2, 'kg') RETURNING id`,
      [batch.id, schedule.id]
    );
    const complete = (body) =>
      request(app).post(`/api/v1/crops/scheduled-tasks/${task.id}/complete-with-input`).set(worker.auth).send(body);

    const tooMuch = await complete({ inventory_item_id: item.id, quantity: 5 });
    expect(tooMuch.status).toBe(409);
    expect(await count('crop_input_applications')).toBe(0);
    expect((await db.one('SELECT status FROM scheduled_batch_tasks WHERE id = $1', [task.id])).status).not.toBe(
      'completed'
    );

    const done = await complete({ inventory_item_id: item.id, application_date: '2026-03-01' });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('completed');
    expect(await stockOf(item.id)).toBe(1);
    expect(await db.one('SELECT product_name, stock_quantity FROM crop_input_applications')).toEqual({
      product_name: 'CAN',
      stock_quantity: 2,
    });
  });
});

describe('pre-harvest interval', () => {
  beforeEach(async () => {
    await apply({ ...spray, product_name: 'Lambda', unit: 'L', pre_harvest_interval_days: 7 });
  });

  it('blocks a harvest inside the interval and allows one on or after the safe date', async () => {
    const blocked = await harvest({ harvest_date: '2026-03-05' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({
      code: 'WITHDRAWAL_ACTIVE',
      details: { safe_from: '2026-03-08', holds: [{ product_name: 'Lambda', applied_on: '2026-03-01' }] },
    });
    expect(await count('harvests')).toBe(0);

    expect((await harvest({ harvest_date: '2026-03-08' })).status).toBe(201);
    // A harvest before the spraying is not affected by it
    expect((await harvest({ harvest_date: '2026-02-28' })).status).toBe(201);
  });

  it('only the owner can override, and the override is recorded', async () => {
    const byManager = await harvest({ harvest_date: '2026-03-05', override_reason: 'Buyer accepted' }, manager);
    expect(byManager.status).toBe(403);

    const byOwner = await harvest({ harvest_date: '2026-03-05', override_reason: '  Buyer accepted  ' }, owner);
    expect(byOwner.status).toBe(201);
    expect(byOwner.body.data).toMatchObject({
      withdrawal_override_reason: 'Buyer accepted',
      withdrawal_override_by: owner.user.id,
    });

    // A reason given when nothing is held is not stored, and cannot be forged
    const clear = await harvest({
      harvest_date: '2026-03-10',
      override_reason: 'n/a',
      withdrawal_override_by: manager.user.id,
    });
    expect(clear.body.data).toMatchObject({ withdrawal_override_reason: null, withdrawal_override_by: null });
  });

  it('a blank override reason is no override', async () => {
    const res = await harvest({ harvest_date: '2026-03-05', override_reason: '   ' }, owner);
    expect(res.status).toBe(409);
  });
});
