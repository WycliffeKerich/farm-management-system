const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createCategory, createItem } = require('../factories/inventory');

let manager;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
});

const api = (session = manager) => ({
  list: (query = '') => request(app).get(`/api/v1/suppliers${query}`).set(session.auth),
  create: (body) => request(app).post('/api/v1/suppliers').set(session.auth).send(body),
  update: (id, body) => request(app).put(`/api/v1/suppliers/${id}`).set(session.auth).send(body),
  remove: (id) => request(app).delete(`/api/v1/suppliers/${id}`).set(session.auth),
});

describe('suppliers', () => {
  it('creates, lists, searches and updates suppliers', async () => {
    const created = await api().create({ name: '  Agrovet Ltd ', phone: '0712 000000', kra_pin: 'P051234567X' });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Agrovet Ltd', is_active: true });

    await api().create({ name: 'Unga Feeds', contact_person: 'Wanjiku' });

    expect((await api().list()).body.data.map((s) => s.name)).toEqual(['Agrovet Ltd', 'Unga Feeds']);
    expect((await api().list('?search=wanj')).body.data.map((s) => s.name)).toEqual(['Unga Feeds']);

    const updated = await api().update(created.body.data.id, { email: 'sales@agrovet.test', is_active: false });
    expect(updated.body.data).toMatchObject({ email: 'sales@agrovet.test', is_active: false });
    expect((await api().list()).body.data).toHaveLength(1);
    expect((await api().list('?include_inactive=true')).body.data).toHaveLength(2);
  });

  it('names are unique ignoring case', async () => {
    const first = (await api().create({ name: 'Agrovet Ltd' })).body.data;
    const other = (await api().create({ name: 'Other' })).body.data;

    expect((await api().create({ name: 'AGROVET LTD' })).status).toBe(409);
    expect((await api().update(other.id, { name: 'agrovet ltd' })).status).toBe(409);
    expect((await api().update(first.id, { name: 'Agrovet LTD' })).status).toBe(200);
  });

  it('validates input and restricts writes to owners and managers', async () => {
    expect((await api().create({ name: '' })).status).toBe(400);
    expect((await api().create({ name: 'X', email: 'not-an-email' })).status).toBe(400);

    const worker = await loginAs(app, 'worker');
    expect((await api(worker).create({ name: 'X' })).status).toBe(403);
    expect((await api(worker).list()).status).toBe(200);
  });

  it('a supplier still named by an item cannot be deleted; an unused one can', async () => {
    const used = (await api().create({ name: 'Used' })).body.data;
    const unused = (await api().create({ name: 'Unused' })).body.data;
    await createItem({ default_supplier_id: used.id });

    const refused = await api().remove(used.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('IN_USE');

    expect((await api().remove(unused.id)).status).toBe(200);
    expect((await api().list()).body.data.map((s) => [s.name, s.item_count])).toEqual([['Used', 1]]);
    // The name is free again once deleted
    expect((await api().create({ name: 'Unused' })).status).toBe(201);
  });
});

describe('suppliers on items and batches', () => {
  it('an item or batch given a supplier id also carries its name', async () => {
    const supplier = (await api().create({ name: 'Agrovet Ltd' })).body.data;
    const category = await createCategory();

    const item = await request(app)
      .post('/api/v1/inventory/items')
      .set(manager.auth)
      .send({ name: 'DAP', category_id: category.id, unit: 'kg', default_supplier_id: supplier.id });
    expect(item.status).toBe(201);
    expect(item.body.data).toMatchObject({ default_supplier_id: supplier.id, supplier: 'Agrovet Ltd' });

    const batch = await request(app)
      .post('/api/v1/inventory/batches')
      .set(manager.auth)
      .send({ inventory_item_id: item.body.data.id, quantity: 50, supplier_id: supplier.id });
    expect(batch.status).toBe(201);
    expect(batch.body.data).toMatchObject({ supplier_id: supplier.id, supplier: 'Agrovet Ltd' });
  });

  it('a free-text supplier that matches a supplier is linked; clearing it unlinks', async () => {
    const supplier = (await api().create({ name: 'Agrovet Ltd' })).body.data;
    const item = await createItem();

    const linked = await request(app)
      .put(`/api/v1/inventory/items/${item.id}`)
      .set(manager.auth)
      .send({ supplier: 'agrovet ltd' });
    expect(linked.body.data).toMatchObject({ default_supplier_id: supplier.id, supplier: 'Agrovet Ltd' });

    const cleared = await request(app)
      .put(`/api/v1/inventory/items/${item.id}`)
      .set(manager.auth)
      .send({ supplier: '' });
    expect(cleared.body.data.default_supplier_id).toBeNull();
  });

  it('an unknown supplier id is refused', async () => {
    const item = await createItem();
    const res = await request(app)
      .post('/api/v1/inventory/batches')
      .set(manager.auth)
      .send({ inventory_item_id: item.id, quantity: 5, supplier_id: 999 });
    expect(res.status).toBe(404);
    expect(await db.one('SELECT COUNT(*)::int AS n FROM inventory_batches')).toEqual({ n: 0 });
  });
});
