const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createCategory, createItem } = require('../factories/inventory');
const { addDays } = require('../../src/utils/dates');

let manager;
let today;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
  // The reports count days from the database's CURRENT_DATE
  today = (await db.one('SELECT CURRENT_DATE::text AS today')).today;
});

const get = (path, session = manager) => request(app).get(`/api/v1/inventory${path}`).set(session.auth);
const receive = async (itemId, quantity, extra = {}) => {
  const res = await request(app)
    .post('/api/v1/inventory/batches')
    .set(manager.auth)
    .send({ inventory_item_id: itemId, quantity, ...extra });
  expect(res.status).toBe(201);
  return res.body.data;
};
const purchase = async (itemId, quantity) => {
  const res = await request(app)
    .post('/api/v1/inventory/transactions')
    .set(manager.auth)
    .send({ item_id: itemId, transaction_type: 'purchase', quantity });
  expect(res.status).toBe(201);
};
const use = async (itemId, quantity, extra = {}) => {
  const res = await request(app)
    .post(`/api/v1/inventory/items/${itemId}/use`)
    .set(manager.auth)
    .send({ quantity, ...extra });
  expect(res.status).toBe(201);
};

describe('stock valuation', () => {
  it('values batches at their own cost and unbatched stock at the item cost', async () => {
    const feed = await createCategory({ name: 'Feed' });
    const vet = await createCategory({ name: 'Veterinary' });
    const dairyMeal = await createItem({ name: 'Dairy meal', category_id: feed.id, cost_per_unit: 100 });
    const vaccine = await createItem({ name: 'Vaccine', category_id: vet.id, unit: 'dose' });
    await createItem({ name: 'Out of stock', category_id: feed.id, cost_per_unit: 50 });

    await receive(dairyMeal.id, 10, { unit_cost: 200 });
    await receive(dairyMeal.id, 5, { unit_cost: 300 });
    await purchase(dairyMeal.id, 3);
    await receive(vaccine.id, 4);

    const res = await get('/reports/valuation');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total_value: 3800,
      item_count: 2,
      uncosted_item_count: 1,
      categories: [
        { category_id: feed.id, category_name: 'Feed', item_count: 1, uncosted_item_count: 0, value: 3800 },
        { category_id: vet.id, category_name: 'Veterinary', item_count: 1, uncosted_item_count: 1, value: 0 },
      ],
      items: [
        expect.objectContaining({
          item_id: dairyMeal.id,
          quantity: 18,
          batched_quantity: 15,
          unbatched_quantity: 3,
          uncosted_quantity: 0,
          value: 3800,
          average_unit_cost: 211.11,
        }),
        expect.objectContaining({
          item_id: vaccine.id,
          unit: 'dose',
          quantity: 4,
          uncosted_quantity: 4,
          value: 0,
          average_unit_cost: null,
        }),
      ],
    });

    const feedOnly = await get(`/reports/valuation?category_id=${feed.id}`);
    expect(feedOnly.body.data).toMatchObject({ total_value: 3800, item_count: 1 });

    // The dashboard summary uses the same values
    const summary = (await get('/summary')).body.data;
    expect(summary.total_value).toBe(3800);
    expect(summary.categories.find((cat) => cat.id === feed.id).total_value).toBe(3800);
  });

  it('follows stock drawn from the earliest-expiring batch', async () => {
    const item = await createItem({ cost_per_unit: 100 });
    await receive(item.id, 10, { unit_cost: 200, expiry_date: addDays(today, 10) });
    await receive(item.id, 10, { unit_cost: 300, expiry_date: addDays(today, 90) });

    await use(item.id, 4);

    const [row] = (await get('/reports/valuation')).body.data.items;
    expect(row).toMatchObject({ quantity: 16, value: 6 * 200 + 10 * 300 });
  });

  it('is for owners and managers', async () => {
    const worker = await loginAs(app, 'worker');
    expect((await get('/reports/valuation', worker)).status).toBe(403);
    expect((await get('/reports/reorder', worker)).status).toBe(403);
    expect((await get('/reports/expiring', worker)).status).toBe(403);
  });
});

describe('reorder report', () => {
  it('lists items at or below minimum with usage, cover and a suggested order', async () => {
    const supplier = await db.one(
      `INSERT INTO suppliers (name, phone) VALUES ('Unga Feeds', '0712 000000') RETURNING *`
    );
    const layersMash = await createItem({
      name: 'Layers mash',
      minimum_stock: 10,
      cost_per_unit: 50,
      default_supplier_id: supplier.id,
      supplier: supplier.name,
    });
    const dewormer = await createItem({ name: 'Dewormer', minimum_stock: 5, reorder_quantity: 20, cost_per_unit: 30 });
    const plenty = await createItem({ name: 'Plenty', minimum_stock: 5 });
    const noMinimum = await createItem({ name: 'No minimum' });

    await receive(layersMash.id, 20, { received_date: addDays(today, -60) });
    await use(layersMash.id, 10, { transaction_date: addDays(today, -40) });
    await use(layersMash.id, 6);
    await receive(dewormer.id, 5);
    await receive(plenty.id, 50);
    await receive(noMinimum.id, 1);

    const res = await get('/reports/reorder');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ usage_days: 30, item_count: 2, estimated_cost: 16 * 50 + 20 * 30 });
    expect(res.body.data.items).toEqual([
      expect.objectContaining({
        item_id: layersMash.id,
        current_stock: 4,
        minimum_stock: 10,
        shortfall: 6,
        // Only the 6 used in the last 30 days count
        average_daily_usage: 0.2,
        days_of_cover: 20,
        suggested_quantity: 16,
        estimated_cost: 800,
        supplier_id: supplier.id,
        supplier_name: 'Unga Feeds',
        supplier_phone: '0712 000000',
      }),
      expect.objectContaining({
        item_id: dewormer.id,
        current_stock: 5,
        shortfall: 0,
        average_daily_usage: 0,
        days_of_cover: null,
        suggested_quantity: 20,
        estimated_cost: 600,
        supplier_id: null,
      }),
    ]);

    const longer = (await get('/reports/reorder?usage_days=60')).body.data;
    expect(longer.items[0]).toMatchObject({ average_daily_usage: 0.27, days_of_cover: 14 });

    expect((await get('/reports/reorder?usage_days=3')).status).toBe(400);
  });

  it('nets returned stock off usage', async () => {
    const item = await createItem({ minimum_stock: 10 });
    await receive(item.id, 12);
    const res = await request(app)
      .post('/api/v1/inventory/transactions')
      .set(manager.auth)
      .send({ item_id: item.id, transaction_type: 'usage', quantity: 9 });
    expect(res.status).toBe(201);
    await request(app)
      .post('/api/v1/inventory/transactions')
      .set(manager.auth)
      .send({ item_id: item.id, transaction_type: 'return', quantity: 3 });

    const [row] = (await get('/reports/reorder')).body.data.items;
    expect(row).toMatchObject({ current_stock: 6, average_daily_usage: 0.2 });
  });
});

describe('expiring report', () => {
  it('lists stock expiring within the window and expired stock still held, with the value at risk', async () => {
    const vaccine = await createItem({ name: 'Vaccine' });
    const milkReplacer = await createItem({ name: 'Milk replacer', cost_per_unit: 7, expiry_date: addDays(today, 20) });

    const soon = await receive(vaccine.id, 5, { unit_cost: 40, expiry_date: addDays(today, 10) });
    const later = await receive(vaccine.id, 5, { unit_cost: 40, expiry_date: addDays(today, 60) });
    const expired = await receive(vaccine.id, 2, { unit_cost: 10, expiry_date: addDays(today, -5) });
    await receive(vaccine.id, 1, { expiry_date: addDays(today, 3) });
    const usedUp = await receive(vaccine.id, 1, { unit_cost: 40, expiry_date: addDays(today, 1) });
    await use(vaccine.id, 1, { inventory_batch_id: usedUp.id });
    await purchase(milkReplacer.id, 3);

    const res = await get('/reports/expiring');

    expect(res.status).toBe(200);
    const report = res.body.data;
    expect(report.days).toBe(30);
    expect(report.expired).toEqual([
      expect.objectContaining({
        batch_id: expired.id,
        item_id: vaccine.id,
        quantity: 2,
        days_until_expiry: -5,
        value_at_risk: 20,
      }),
    ]);
    expect(
      report.expiring.map((entry) => [entry.batch_id, entry.item_name, entry.days_until_expiry, entry.value_at_risk])
    ).toEqual([
      [expect.any(Number), 'Vaccine', 3, null],
      [soon.id, 'Vaccine', 10, 200],
      [null, 'Milk replacer', 20, 21],
    ]);
    expect(report.totals).toEqual({
      expired_count: 1,
      expired_value: 20,
      expiring_count: 3,
      expiring_value: 221,
      uncosted_count: 1,
    });

    const wider = (await get('/reports/expiring?days=90')).body.data;
    expect(wider.expiring.map((entry) => entry.batch_id)).toContain(later.id);
  });
});

describe('item list filters', () => {
  it('the unpaged and paged lists both honour low_stock and expiring_days', async () => {
    const low = await createItem({ name: 'Low', minimum_stock: 10 });
    const batchExpiring = await createItem({ name: 'Batch expiring' });
    const itemExpiring = await createItem({ name: 'Item expiring', expiry_date: addDays(today, 5) });
    const emptyExpiring = await createItem({ name: 'Empty but dated', expiry_date: addDays(today, 5) });
    await createItem({ name: 'Plain' });

    await receive(low.id, 2);
    await receive(batchExpiring.id, 5, { expiry_date: addDays(today, 7) });
    await receive(batchExpiring.id, 5, { expiry_date: addDays(today, 200) });
    await purchase(itemExpiring.id, 1);

    const names = (res) => res.body.data.map((item) => item.name);

    expect(names(await get('/items?low_stock=true'))).toEqual(['Low']);
    expect(names(await get('/items?page=1&low_stock=true'))).toEqual(['Low']);
    expect(names(await get('/items?expiring_days=30'))).toEqual(['Batch expiring', 'Item expiring']);
    expect(names(await get('/items?page=1&limit=10&expiring_days=30'))).toEqual(['Batch expiring', 'Item expiring']);
    expect((await get('/items?page=1&limit=10&expiring_days=30')).body.pagination.total).toBe(2);
    expect(names(await get('/items?expiring_days=30&search=item'))).toEqual(['Item expiring']);
    expect(names(await get('/items'))).toContain(emptyExpiring.name);
  });

  it('filters by stock level and counts every level for the summary', async () => {
    const low = await createItem({ name: 'Low', minimum_stock: 10 });
    await createItem({ name: 'Out below minimum', minimum_stock: 5 });
    await createItem({ name: 'Out, no minimum', minimum_stock: null });
    const plenty = await createItem({ name: 'Plenty', minimum_stock: 1 });
    const unwatched = await createItem({ name: 'Unwatched', minimum_stock: null });
    await receive(low.id, 2);
    await receive(plenty.id, 50);
    await receive(unwatched.id, 3);

    const names = (res) => res.body.data.map((item) => item.name);

    expect(names(await get('/items?stock_status=low'))).toEqual(['Low', 'Out below minimum']);
    expect(names(await get('/items?page=1&stock_status=out'))).toEqual(['Out below minimum', 'Out, no minimum']);
    expect(names(await get('/items?page=1&stock_status=ok'))).toEqual(['Plenty', 'Unwatched']);

    const res = await get('/items?page=1&limit=2&stock_status=ok');
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.stock_counts).toEqual({ total: 5, ok: 2, low: 2, out: 2 });
    expect((await get('/items?page=1&search=out')).body.stock_counts).toEqual({ total: 2, ok: 0, low: 1, out: 2 });

    expect((await get('/items?stock_status=empty')).status).toBe(400);
  });

  it('sorts the paged list by a whitelisted column, blanks last', async () => {
    const feed = await createCategory({ name: 'Feed' });
    const vet = await createCategory({ name: 'Veterinary' });
    await createItem({ name: 'Bravo', category_id: vet.id, cost_per_unit: 50 });
    await createItem({ name: 'Alpha', category_id: vet.id });
    await createItem({ name: 'Charlie', category_id: feed.id, cost_per_unit: 10 });

    const names = async (query) => (await get(`/items?page=1&${query}`)).body.data.map((item) => item.name);

    expect(await names('')).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(await names('sort=name&order=desc')).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(await names('sort=category_name')).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(await names('sort=cost_per_unit&order=asc')).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(await names('sort=cost_per_unit&order=desc')).toEqual(['Bravo', 'Charlie', 'Alpha']);

    expect((await get('/items?page=1&sort=supplier')).status).toBe(400);
    expect((await get('/items?page=1&sort=constructor')).status).toBe(400);
    expect((await get('/items?page=1&sort=name&order=sideways')).status).toBe(400);
  });
});
