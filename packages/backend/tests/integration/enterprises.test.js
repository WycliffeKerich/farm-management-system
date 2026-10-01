const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createEnterprise } = require('../factories/enterprise');
const { createActivity } = require('../factories/activity');
const { createBatch, createCropType, createVariety } = require('../factories/crop');
const { createAnimalType, createBreed } = require('../factories/animal');

let manager;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
});

const call = (method, path, body, session = manager) =>
  request(app)[method](`/api/v1${path}`).set(session.auth).send(body);
const post = (path, body, session) => call('post', path, body, session);
const put = (path, body, session) => call('put', path, body, session);
const get = (path, session = manager) => request(app).get(`/api/v1${path}`).set(session.auth);

describe('enterprise CRUD', () => {
  it('creates, pages, filters, sorts and updates enterprises', async () => {
    const created = await post('/enterprises', {
      name: '  Tomatoes GH1 ',
      enterprise_type: 'crops',
      unit_of_output: 'kg',
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ name: 'Tomatoes GH1', enterprise_type: 'crops', is_active: true });

    await post('/enterprises', { name: 'Layers', enterprise_type: 'poultry', unit_of_output: 'tray' });
    await post('/enterprises', { name: 'Apiary', enterprise_type: 'apiculture', is_active: false });

    const all = await get('/enterprises');
    expect(all.body.data.map((e) => e.name)).toEqual(['Apiary', 'Layers', 'Tomatoes GH1']);
    expect(all.body.pagination).toMatchObject({ page: 1, total: 3 });

    const paged = await get('/enterprises?limit=2&page=2');
    expect(paged.body.data.map((e) => e.name)).toEqual(['Tomatoes GH1']);
    expect(paged.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });

    expect((await get('/enterprises?is_active=true')).body.data).toHaveLength(2);
    expect((await get('/enterprises?enterprise_type=poultry')).body.data.map((e) => e.name)).toEqual(['Layers']);
    expect((await get('/enterprises?sort=enterprise_type&order=desc')).body.data[0].name).toBe('Layers');

    const updated = await put(`/enterprises/${created.body.data.id}`, { unit_of_output: 'crate', is_active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ unit_of_output: 'crate', is_active: false });
  });

  it('returns one enterprise with counts of what belongs to it', async () => {
    const enterprise = await createEnterprise();
    const batch = await createBatch({ enterprise_id: enterprise.id });
    await createActivity({ crop_batch_id: batch.id, enterprise_id: enterprise.id });

    const res = await get(`/enterprises/${enterprise.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      crop_batch_count: 1,
      animal_count: 0,
      animal_group_count: 0,
      activity_count: 1,
    });
    expect((await get('/enterprises/999999')).status).toBe(404);
  });

  it('names are unique ignoring case among live enterprises', async () => {
    const first = (await post('/enterprises', { name: 'Dairy', enterprise_type: 'dairy' })).body.data;
    const other = (await post('/enterprises', { name: 'Other', enterprise_type: 'other' })).body.data;

    expect((await post('/enterprises', { name: 'DAIRY', enterprise_type: 'dairy' })).status).toBe(409);
    expect((await put(`/enterprises/${other.id}`, { name: 'dairy' })).status).toBe(409);
    expect((await put(`/enterprises/${first.id}`, { name: 'DAIRY' })).status).toBe(200);

    expect((await call('delete', `/enterprises/${first.id}`)).status).toBe(200);
    expect((await post('/enterprises', { name: 'Dairy', enterprise_type: 'dairy' })).status).toBe(201);
  });

  it('validates input and restricts writes to owners and managers', async () => {
    expect((await post('/enterprises', { name: 'X' })).status).toBe(400);
    expect((await post('/enterprises', { name: 'X', enterprise_type: 'fishing' })).status).toBe(400);
    expect((await post('/enterprises', { name: '', enterprise_type: 'crops' })).status).toBe(400);
    expect((await get('/enterprises?sort=description')).status).toBe(400);
    expect((await get('/enterprises?enterprise_type=fishing')).status).toBe(400);

    const worker = await loginAs(app, 'worker');
    expect((await post('/enterprises', { name: 'X', enterprise_type: 'crops' }, worker)).status).toBe(403);
    expect((await get('/enterprises', worker)).status).toBe(200);
    expect((await request(app).get('/api/v1/enterprises')).status).toBe(401);
  });

  it('an enterprise something refers to cannot be deleted; an unused one can', async () => {
    const used = await createEnterprise();
    const unused = await createEnterprise();
    await createBatch({ enterprise_id: used.id });

    const refused = await call('delete', `/enterprises/${used.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('IN_USE');

    expect((await call('delete', `/enterprises/${unused.id}`)).status).toBe(200);
    expect((await get(`/enterprises/${unused.id}`)).status).toBe(404);
  });
});

describe('batches, animals and groups belong to an enterprise', () => {
  it('a new batch takes its crop type’s enterprise unless one is given', async () => {
    const tomatoes = await createEnterprise({ name: 'Tomatoes GH1' });
    const other = await createEnterprise();
    const cropType = await createCropType();
    const variety = await createVariety({ crop_type_id: cropType.id });

    expect((await put(`/crops/crop-types/${cropType.id}`, { enterprise_id: tomatoes.id })).status).toBe(200);

    const batch = (body = {}) =>
      post('/crops/batches', {
        crop_variety_id: variety.id,
        planting_date: '2026-03-01',
        quantity_planted: 200,
        unit: 'plants',
        ...body,
      });

    expect((await batch()).body.data.enterprise_id).toBe(tomatoes.id);
    expect((await batch({ enterprise_id: other.id })).body.data.enterprise_id).toBe(other.id);
    expect((await batch({ enterprise_id: null })).body.data.enterprise_id).toBeNull();

    // An inactive default is not handed on; an inactive enterprise cannot be chosen
    await db.none('UPDATE enterprises SET is_active = false WHERE id = $1', [tomatoes.id]);
    expect((await batch()).body.data.enterprise_id).toBeNull();
    expect((await batch({ enterprise_id: tomatoes.id })).status).toBe(400);
    expect((await batch({ enterprise_id: 999999 })).status).toBe(404);
    expect((await batch({ enterprise_id: 'abc' })).status).toBe(400);
  });

  it('new animals and groups take their animal type’s enterprise', async () => {
    const dairy = await createEnterprise({ name: 'Dairy', enterprise_type: 'dairy', unit_of_output: 'litre' });
    const created = await post('/animals/types', {
      name: 'Dairy cow',
      category: 'livestock',
      enterprise_id: dairy.id,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.enterprise_id).toBe(dairy.id);
    const breed = await createBreed({ animal_type_id: created.body.data.id });

    const animal = await post('/animals/individuals', { animal_breed_id: breed.id, date_acquired: '2026-02-01' });
    expect(animal.status).toBe(201);
    expect(animal.body.data.enterprise_id).toBe(dairy.id);

    const group = await post('/animals/groups', {
      name: 'Heifers',
      animal_breed_id: breed.id,
      quantity: 5,
      date_established: '2026-02-01',
    });
    expect(group.status).toBe(201);
    expect(group.body.data.enterprise_id).toBe(dairy.id);

    // A type with no default leaves them unassigned
    const plainBreed = await createBreed({ animal_type_id: (await createAnimalType()).id });
    const plain = await post('/animals/individuals', { animal_breed_id: plainBreed.id, date_acquired: '2026-02-01' });
    expect(plain.body.data.enterprise_id).toBeNull();
  });

  it('a type cannot default to an inactive or missing enterprise', async () => {
    const closed = await createEnterprise({ is_active: false });
    expect(
      (await post('/crops/crop-types', { name: 'Kale', category: 'leafy', enterprise_id: closed.id })).status
    ).toBe(400);
    expect((await post('/crops/crop-types', { name: 'Kale', category: 'leafy', enterprise_id: 999999 })).status).toBe(
      404
    );
  });
});

describe('activities are costed to their subject’s enterprise', () => {
  it('a new activity copies its subject’s enterprise, and the timeline filters by it', async () => {
    const tomatoes = await createEnterprise();
    const batch = await createBatch({ enterprise_id: tomatoes.id });
    const loose = await createBatch();

    const observed = await post(`/crops/batches/${batch.id}/observations`, { observation_date: '2026-03-01' });
    expect(observed.status).toBe(201);
    await post(`/crops/batches/${loose.id}/observations`, { observation_date: '2026-03-02' });

    const activity = await db.one('SELECT * FROM activities WHERE id = $1', [observed.body.data.activity_id]);
    expect(activity.enterprise_id).toBe(tomatoes.id);

    const timeline = await get(`/activities?enterprise_id=${tomatoes.id}`);
    expect(timeline.body.data).toHaveLength(1);
    expect(timeline.body.data[0]).toMatchObject({ crop_batch_id: batch.id, enterprise_name: tomatoes.name });
  });

  it('putting a batch under an enterprise costs its unassigned activities to it; costed ones keep theirs', async () => {
    const tomatoes = await createEnterprise();
    const earlier = await createEnterprise();
    const batch = await createBatch();
    const unassigned = await createActivity({ crop_batch_id: batch.id });
    const costed = await createActivity({ crop_batch_id: batch.id, enterprise_id: earlier.id });

    const res = await put(`/crops/batches/${batch.id}`, { enterprise_id: tomatoes.id });
    expect(res.status).toBe(200);
    expect(res.body.data.enterprise_id).toBe(tomatoes.id);

    const enterpriseOf = async (id) =>
      (await db.one('SELECT enterprise_id FROM activities WHERE id = $1', [id])).enterprise_id;
    expect(await enterpriseOf(unassigned.id)).toBe(tomatoes.id);
    expect(await enterpriseOf(costed.id)).toBe(earlier.id);

    // Taking the batch out of the enterprise leaves its activities as they were
    expect((await put(`/crops/batches/${batch.id}`, { enterprise_id: null })).body.data.enterprise_id).toBeNull();
    expect(await enterpriseOf(unassigned.id)).toBe(tomatoes.id);
  });
});
