const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createAnimal, createGroup } = require('../factories/animal');
const { createBatch } = require('../factories/crop');
const { createItem, createUnit } = require('../factories/inventory');

const API = '/api/v1/animals';

let owner;
let manager;
let worker;
let cow;

beforeEach(async () => {
  await truncateAll();
  owner = await loginAs(app, 'owner');
  manager = await loginAs(app, 'manager');
  worker = await loginAs(app, 'worker');
  cow = await createAnimal();
});

const post = (path, body, session = worker) => request(app).post(`${API}${path}`).set(session.auth).send(body);
const put = (path, body, session = worker) => request(app).put(`${API}${path}`).set(session.auth).send(body);
const del = (path, session = manager) => request(app).delete(`${API}${path}`).set(session.auth);
const receive = (itemId, quantity, extra = {}) =>
  request(app)
    .post('/api/v1/inventory/batches')
    .set(manager.auth)
    .send({ inventory_item_id: itemId, quantity, ...extra });
const stockOf = async (itemId) =>
  (await db.one('SELECT current_stock FROM inventory_items WHERE id = $1', [itemId])).current_stock;
const count = async (table) => (await db.one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n;
const ledger = (type) =>
  db.any(
    `SELECT transaction_type, quantity FROM inventory_transactions
      WHERE reference_type = $1 ORDER BY id`,
    [type]
  );

const treat = (body, session = worker) =>
  post(
    '/diseases-treatments',
    {
      animal_id: cow.id,
      diagnosis_date: '2026-03-01',
      treatment_start_date: '2026-03-02',
      disease_name: 'Mastitis',
      ...body,
    },
    session
  );

describe('feed taken from stock', () => {
  let item;
  let flock;

  beforeEach(async () => {
    const kg = await createUnit({ name: 'Kilogram', symbol: 'kg' });
    await createUnit({ name: 'Gram', symbol: 'g', base: kg, conversion_factor: 0.001 });
    item = await createItem({ name: 'Layers mash', unit: 'kg' });
    await receive(item.id, 50, { unit_cost: 80 });
    flock = await createGroup();
  });

  const feed = (body) =>
    post('/feed-records', { animal_group_id: flock.id, feed_date: '2026-03-01', inventory_item_id: item.id, ...body });

  it('draws once for the whole group, converting units, and keeps what it cost', async () => {
    const res = await feed({ quantity: 2500, unit: 'g', stock_quantity: 99, total_cost: 1 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      feed_name: 'Layers mash',
      quantity: 2500,
      unit: 'g',
      inventory_item_id: item.id,
      stock_quantity: 2.5,
      total_cost: 200,
      cost_per_unit: 0.08,
      stock: { current_stock: 47.5, unit: 'kg' },
    });
    expect(await stockOf(item.id)).toBe(47.5);
    expect(await ledger('animal_feed_record')).toEqual([{ transaction_type: 'usage', quantity: 2.5 }]);

    // The unit defaults to the item's
    expect((await feed({ quantity: 1 })).body.data).toMatchObject({ unit: 'kg', stock_quantity: 1 });
  });

  it('records nothing when stock is short, and needs a unit without an item', async () => {
    const short = await feed({ quantity: 60 });
    expect(short.status).toBe(409);
    expect(short.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await count('animal_feed_records')).toBe(0);
    expect(await stockOf(item.id)).toBe(50);

    const noUnit = await feed({ quantity: 1, inventory_item_id: null, feed_name: 'Grass' });
    expect(noUnit.status).toBe(400);
    expect((await feed({ quantity: 1, inventory_item_id: 9999 })).status).toBe(404);
  });

  it('changing the amount puts the old draw back and takes the new one; deleting returns it', async () => {
    const record = (await feed({ quantity: 5 })).body.data;

    const notes = await put(`/feed-records/${record.id}`, { notes: 'Morning' });
    expect(notes.status).toBe(200);
    expect(await ledger('animal_feed_record')).toHaveLength(1);

    const changed = await put(`/feed-records/${record.id}`, { quantity: 3, stock_quantity: 99 });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ quantity: 3, stock_quantity: 3, total_cost: 240 });
    expect(await stockOf(item.id)).toBe(47);
    expect(await ledger('animal_feed_record')).toEqual([
      { transaction_type: 'usage', quantity: 5 },
      { transaction_type: 'return', quantity: 5 },
      { transaction_type: 'usage', quantity: 3 },
    ]);

    // More than is in stock: the change is refused and the old draw stands
    expect((await put(`/feed-records/${record.id}`, { quantity: 80 })).status).toBe(409);
    expect(await stockOf(item.id)).toBe(47);

    expect((await del(`/feed-records/${record.id}`)).status).toBe(200);
    expect((await del(`/feed-records/${record.id}`)).status).toBe(404);
    expect(await stockOf(item.id)).toBe(50);
  });
});

describe('treatment doses', () => {
  let item;

  beforeEach(async () => {
    item = await createItem({ name: 'Oxytetracycline', unit: 'ml', milk_withdrawal_days: 7, meat_withdrawal_days: 28 });
    await receive(item.id, 100, { unit_cost: 10 });
  });

  it('takes doses from stock and sets safe dates from the longer withdrawal period', async () => {
    const res = await treat({
      doses: [
        { inventory_item_id: item.id, quantity: 20, milk_withdrawal_days: 3, meat_withdrawal_days: 35 },
        { product_name: 'Wound spray', unit: 'can', quantity: 1, administered_date: '2026-03-04' },
      ],
    });

    expect(res.status).toBe(201);
    const [oxy, spray] = res.body.data.doses;
    expect(oxy).toMatchObject({
      product_name: 'Oxytetracycline',
      unit: 'ml',
      administered_date: '2026-03-02',
      milk_withdrawal_days: 7,
      meat_withdrawal_days: 35,
      egg_withdrawal_days: null,
      milk_safe_from: '2026-03-09',
      meat_safe_from: '2026-04-06',
      egg_safe_from: null,
      stock_quantity: 20,
      total_cost: 200,
      stock: { current_stock: 80 },
    });
    expect(spray).toMatchObject({ inventory_item_id: null, administered_date: '2026-03-04', milk_safe_from: null });
    expect(await stockOf(item.id)).toBe(80);

    const fetched = await request(app).get(`${API}/diseases-treatments/${res.body.data.id}`).set(worker.auth);
    expect(fetched.body.data.doses.map((dose) => dose.product_name)).toEqual(['Oxytetracycline', 'Wound spray']);
  });

  it('records no treatment when a dose cannot be given', async () => {
    const short = await treat({
      doses: [
        { product_name: 'X', unit: 'ml', quantity: 1 },
        { inventory_item_id: item.id, quantity: 500 },
      ],
    });
    expect(short.status).toBe(409);
    expect(await count('animal_diseases_treatments')).toBe(0);
    expect(await count('treatment_medications')).toBe(0);

    expect((await treat({ doses: [{ quantity: 1 }] })).status).toBe(400);
    expect((await treat({ doses: [{ product_name: 'X', unit: 'ml', quantity: 0 }] })).status).toBe(400);
  });

  it('adds and removes doses, and deleting the treatment returns its stock and lifts its holds', async () => {
    const treatment = (await treat({ doses: [{ inventory_item_id: item.id, quantity: 10 }] })).body.data;
    const other = (await treat({ disease_name: 'Foot rot' })).body.data;

    const added = await post(`/diseases-treatments/${treatment.id}/doses`, {
      inventory_item_id: item.id,
      quantity: 5,
      administered_date: '2026-03-03',
    });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ treatment_id: treatment.id, milk_safe_from: '2026-03-10' });
    expect(await stockOf(item.id)).toBe(85);
    expect((await post('/diseases-treatments/9999/doses', { product_name: 'X', unit: 'ml', quantity: 1 })).status).toBe(
      404
    );

    expect((await del(`/diseases-treatments/${other.id}/doses/${added.body.data.id}`)).status).toBe(404);
    expect((await del(`/diseases-treatments/${treatment.id}/doses/${added.body.data.id}`, worker)).status).toBe(403);
    expect((await del(`/diseases-treatments/${treatment.id}/doses/${added.body.data.id}`)).status).toBe(200);
    expect(await stockOf(item.id)).toBe(90);

    expect((await del(`/diseases-treatments/${treatment.id}`)).status).toBe(200);
    expect(await stockOf(item.id)).toBe(100);
    expect(await count('treatment_medications WHERE deleted_at IS NULL')).toBe(0);
    const holds = await request(app).get('/api/v1/withdrawals/active?date=2026-03-05').set(worker.auth);
    expect(holds.body.data.animals).toEqual([]);
  });
});

describe('withdrawal holds on produce and sales', () => {
  let milk;
  let eggs;
  let honey;
  let treatment;

  beforeEach(async () => {
    const type = async (name, category) =>
      (await post('/production/types', { name, category, unit: 'litres' }, manager)).body.data;
    milk = await type('Milk', 'milk');
    eggs = await type('Eggs', 'eggs');
    honey = await type('Honey', 'honey');
    treatment = (
      await treat({
        doses: [
          { product_name: 'Penicillin', unit: 'ml', quantity: 10, milk_withdrawal_days: 7, meat_withdrawal_days: 14 },
        ],
      })
    ).body.data;
  });

  const produce = (body, session = worker) =>
    post('/production/records', { production_type_id: milk.id, animal_id: cow.id, quantity: 12, ...body }, session);

  it('refuses milk inside the withdrawal period and allows it before the dose and from the safe date', async () => {
    const blocked = await produce({ production_date: '2026-03-05' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toMatchObject({
      code: 'WITHDRAWAL_ACTIVE',
      details: {
        safe_from: '2026-03-09',
        holds: [
          {
            source: 'treatment_medication',
            treatment_id: treatment.id,
            disease_name: 'Mastitis',
            product_name: 'Penicillin',
            applied_on: '2026-03-02',
            safe_from: '2026-03-09',
          },
        ],
      },
    });
    expect(await count('animal_production_records')).toBe(0);

    expect((await produce({ production_date: '2026-03-09' })).status).toBe(201);
    expect((await produce({ production_date: '2026-03-01' })).status).toBe(201);
    // Produce that no withdrawal period covers, and another animal, are not held
    expect((await produce({ production_date: '2026-03-05', production_type_id: honey.id })).status).toBe(201);
    expect((await produce({ production_date: '2026-03-05', production_type_id: eggs.id })).status).toBe(201);
    const heifer = await createAnimal();
    expect((await produce({ production_date: '2026-03-05', animal_id: heifer.id })).status).toBe(201);
  });

  it('only the owner can override, the override is recorded, and it cannot be forged', async () => {
    expect((await produce({ production_date: '2026-03-05', override_reason: 'Fed to calves' }, manager)).status).toBe(
      403
    );

    const overridden = await produce({ production_date: '2026-03-05', override_reason: ' Fed to calves ' }, owner);
    expect(overridden.status).toBe(201);
    expect(overridden.body.data).toMatchObject({
      withdrawal_override_reason: 'Fed to calves',
      withdrawal_override_by: owner.user.id,
    });

    const forged = await produce({
      production_date: '2026-03-10',
      withdrawal_override_reason: 'x',
      withdrawal_override_by: owner.user.id,
    });
    expect(forged.body.data).toMatchObject({ withdrawal_override_reason: null, withdrawal_override_by: null });
    expect((await produce({ production_date: '2026-03-05', override_reason: '  ' }, owner)).status).toBe(409);
  });

  it('checks again when a record is moved into the withdrawal period', async () => {
    const record = (await produce({ production_date: '2026-03-10' })).body.data;

    expect((await put(`/production/records/${record.id}`, { quantity: 11 })).status).toBe(200);
    const moved = await put(`/production/records/${record.id}`, { production_date: '2026-03-04' });
    expect(moved.status).toBe(409);

    const allowed = await put(
      `/production/records/${record.id}`,
      { production_date: '2026-03-04', override_reason: 'Discarded' },
      owner
    );
    expect(allowed.status).toBe(200);
    expect(allowed.body.data).toMatchObject({ production_date: '2026-03-04', withdrawal_override_by: owner.user.id });
  });

  it("holds a group's eggs on the group's own treatments", async () => {
    const flock = await createGroup();
    await post('/diseases-treatments', {
      animal_group_id: flock.id,
      diagnosis_date: '2026-03-01',
      disease_name: 'Coccidiosis',
      doses: [{ product_name: 'Amprolium', unit: 'g', quantity: 50, egg_withdrawal_days: 5 }],
    });

    const layEggs = (date) =>
      produce({ production_type_id: eggs.id, animal_id: null, animal_group_id: flock.id, production_date: date });
    expect((await layEggs('2026-03-03')).status).toBe(409);
    expect((await layEggs('2026-03-06')).status).toBe(201);
  });

  it('refuses selling an animal inside its meat withdrawal period unless the owner overrides', async () => {
    const sell = (body, session = manager) =>
      post(
        '/sales',
        { reference_type: 'animal', reference_id: cow.id, quantity: 1, unit: 'head', unit_price: 50000, ...body },
        session
      );

    const blocked = await sell({ sale_date: '2026-03-10' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.details.safe_from).toBe('2026-03-16');
    expect((await db.one('SELECT status FROM animals WHERE id = $1', [cow.id])).status).toBe('active');

    const sold = await sell({ sale_date: '2026-03-10', override_reason: 'Sold as breeding stock' }, owner);
    expect(sold.status).toBe(201);
    expect(sold.body.data.withdrawal_override_by).toBe(owner.user.id);

    const later = await put(`/sales/${sold.body.data.id}`, { sale_date: '2026-03-20' }, manager);
    expect(later.body.data).toMatchObject({ withdrawal_override_reason: null, withdrawal_override_by: null });
    expect((await put(`/sales/${sold.body.data.id}`, { sale_date: '2026-03-12' }, manager)).status).toBe(409);
  });

  it('lists what is held on a date', async () => {
    const batch = await createBatch();
    await request(app).post(`/api/v1/crops/batches/${batch.id}/input-applications`).set(worker.auth).send({
      application_date: '2026-03-01',
      input_type: 'pesticide',
      product_name: 'Lambda',
      unit: 'L',
      quantity: 1,
      pre_harvest_interval_days: 7,
    });

    const res = await request(app).get('/api/v1/withdrawals/active?date=2026-03-05').set(worker.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      date: '2026-03-05',
      crops: [{ batch_id: batch.id, product: 'harvest', safe_from: '2026-03-08', holds: [{ product_name: 'Lambda' }] }],
      animals: [
        { animal_id: cow.id, animal_tag: cow.tag_number, product: 'meat', safe_from: '2026-03-16' },
        { animal_id: cow.id, product: 'milk', safe_from: '2026-03-09', holds: [{ treatment_id: treatment.id }] },
      ],
    });

    const later = await request(app).get('/api/v1/withdrawals/active?date=2026-03-20').set(worker.auth);
    expect(later.body.data).toMatchObject({ crops: [], animals: [] });
    expect((await request(app).get('/api/v1/withdrawals/active?date=soon').set(worker.auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/withdrawals/active')).status).toBe(401);
  });
});
