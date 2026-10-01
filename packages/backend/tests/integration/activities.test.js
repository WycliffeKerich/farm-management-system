const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createBatch } = require('../factories/crop');
const { createAnimal, createGroup } = require('../factories/animal');
const { createItem } = require('../factories/inventory');

let owner;
let worker;
let batch;
let cow;

beforeEach(async () => {
  await truncateAll();
  owner = await loginAs(app, 'owner');
  worker = await loginAs(app, 'worker');
  batch = await createBatch();
  cow = await createAnimal();
});

const post = (path, body, session = worker) => request(app).post(`/api/v1${path}`).set(session.auth).send(body);
const put = (path, body, session = worker) => request(app).put(`/api/v1${path}`).set(session.auth).send(body);
const del = (path, session = owner) => request(app).delete(`/api/v1${path}`).set(session.auth);
const timeline = (query, session = worker) => request(app).get('/api/v1/activities').query(query).set(session.auth);
const bulk = (entries, session = worker) => post('/activities/bulk', { entries }, session);

const activityOf = (table, id) =>
  db.oneOrNone(`SELECT a.* FROM activities a JOIN $1:name d ON d.activity_id = a.id WHERE d.id = $2`, [table, id]);
const count = async (table) => (await db.one(`SELECT COUNT(*)::int AS n FROM ${table}`)).n;
const receive = (itemId, quantity, extra = {}) =>
  post('/inventory/batches', { inventory_item_id: itemId, quantity, ...extra }, owner);
const productionType = () =>
  db.one(`INSERT INTO animal_production_types (name, category, unit) VALUES ('Milk', 'milk', 'litres') RETURNING *`);

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('crop records write their activity', () => {
  it('records an activity for each crop record, in the same request', async () => {
    const observation = await post(`/crops/batches/${batch.id}/observations`, {
      observation_date: '2026-03-01',
      growth_stage: 'Vegetative',
    });
    const pest = await post(`/crops/batches/${batch.id}/pests-diseases`, {
      incident_date: '2026-03-02',
      type: 'disease',
      name: 'Blight',
    });
    // An application's cost comes from the stock it used
    const mancozeb = await createItem({ name: 'Mancozeb', unit: 'kg' });
    await receive(mancozeb.id, 10, { unit_cost: 150 });
    const spray = await post(`/crops/batches/${batch.id}/input-applications`, {
      application_date: '2026-03-03',
      input_type: 'fungicide',
      inventory_item_id: mancozeb.id,
      quantity: 2,
    });
    const harvest = await post(`/crops/batches/${batch.id}/harvests`, {
      harvest_date: '2026-03-20',
      quantity: 40,
      unit: 'kg',
    });

    for (const res of [observation, pest, spray, harvest]) {
      expect(res.status).toBe(201);
      expect(res.body.data.activity_id).toEqual(expect.any(Number));
    }
    expect(await activityOf('growth_observations', observation.body.data.id)).toMatchObject({
      activity_type: 'observation',
      title: 'Observation: Vegetative',
      occurred_on: '2026-03-01',
      crop_batch_id: batch.id,
      location_id: batch.location_id,
      recorded_by: worker.user.id,
      status: 'done',
    });
    expect((await activityOf('crop_pests_diseases', pest.body.data.id)).title).toBe('Disease: Blight');
    expect(await activityOf('crop_input_applications', spray.body.data.id)).toMatchObject({
      activity_type: 'input_application',
      title: 'Mancozeb 2 kg',
      input_cost: 300,
    });
    expect(await activityOf('harvests', harvest.body.data.id)).toMatchObject({
      activity_type: 'harvest',
      title: 'Harvest 40 kg',
    });
  });

  it('deletes the activity with its record', async () => {
    const harvest = await post(`/crops/batches/${batch.id}/harvests`, {
      harvest_date: '2026-03-20',
      quantity: 40,
      unit: 'kg',
    });
    expect((await del(`/crops/harvests/${harvest.body.data.id}`)).status).toBe(200);

    const activity = await db.one('SELECT * FROM activities WHERE id = $1', [harvest.body.data.activity_id]);
    expect(activity.deleted_at).not.toBeNull();
  });

  it('cannot save a record without its activity', async () => {
    await expect(
      db.none(`INSERT INTO harvests (batch_id, harvest_date, quantity, unit) VALUES ($1, '2026-03-20', 1, 'kg')`, [
        batch.id,
      ])
    ).rejects.toThrow(/activity_id/);
  });

  it('ignores an activity_id sent by the client', async () => {
    const first = await post(`/crops/batches/${batch.id}/observations`, { observation_date: '2026-03-01' });
    const second = await post(`/crops/batches/${batch.id}/observations`, {
      observation_date: '2026-03-02',
      activity_id: first.body.data.activity_id,
    });

    expect(second.status).toBe(201);
    expect(second.body.data.activity_id).not.toBe(first.body.data.activity_id);
    expect(await count('activities')).toBe(2);
  });
});

describe('animal records keep their activity in step', () => {
  it('updates the activity when a feed record changes', async () => {
    const feed = await post('/animals/feed-records', {
      animal_id: cow.id,
      feed_date: '2026-03-01',
      feed_name: 'Dairy meal',
      quantity: 4,
      unit: 'kg',
    });
    expect(feed.status).toBe(201);

    const updated = await put(`/animals/feed-records/${feed.body.data.id}`, { quantity: 6, feed_date: '2026-03-02' });
    expect(updated.status).toBe(200);

    expect(await activityOf('animal_feed_records', feed.body.data.id)).toMatchObject({
      activity_type: 'feeding',
      title: 'Dairy meal 6 kg',
      occurred_on: '2026-03-02',
      animal_id: cow.id,
    });
    expect(await count('activities')).toBe(1);
  });

  it('maps health records by type and follows their edits', async () => {
    const flock = await createGroup();
    const record = await post('/animals/health-records', {
      animal_group_id: flock.id,
      record_date: '2026-03-01',
      record_type: 'checkup',
      cost: 500,
    });
    expect(record.status).toBe(201);
    expect(await activityOf('animal_health_records', record.body.data.id)).toMatchObject({
      activity_type: 'health_check',
      title: 'Health check',
      animal_group_id: flock.id,
      other_cost: 500,
    });

    const edited = await put(
      `/animals/health-records/${record.body.data.id}`,
      { record_type: 'vaccination', medication: 'Newcastle' },
      owner
    );
    expect(edited.status).toBe(200);
    expect(await activityOf('animal_health_records', record.body.data.id)).toMatchObject({
      activity_type: 'vaccination',
      title: 'Vaccination: Newcastle',
    });
  });

  it('counts a treatment’s medicines as its input cost, as doses come and go', async () => {
    const item = await createItem({ name: 'Oxytetracycline', unit: 'ml' });
    await receive(item.id, 100, { unit_cost: 10 });

    const treatment = await post('/animals/diseases-treatments', {
      animal_id: cow.id,
      diagnosis_date: '2026-03-01',
      disease_name: 'Mastitis',
      cost: 1000,
      doses: [{ inventory_item_id: item.id, quantity: 20 }],
    });
    expect(treatment.status).toBe(201);
    const id = treatment.body.data.id;
    expect(await activityOf('animal_diseases_treatments', id)).toMatchObject({
      activity_type: 'treatment',
      title: 'Treatment: Mastitis',
      input_cost: 200,
      other_cost: 1000,
    });

    const dose = await post(`/animals/diseases-treatments/${id}/doses`, { inventory_item_id: item.id, quantity: 5 });
    expect(dose.status).toBe(201);
    expect((await activityOf('animal_diseases_treatments', id)).input_cost).toBe(250);

    expect((await del(`/animals/diseases-treatments/${id}/doses/${dose.body.data.id}`)).status).toBe(200);
    expect((await activityOf('animal_diseases_treatments', id)).input_cost).toBe(200);

    expect((await del(`/animals/diseases-treatments/${id}`)).status).toBe(200);
    expect((await activityOf('animal_diseases_treatments', id)).deleted_at).not.toBeNull();
  });

  it('records production and removes it with the record', async () => {
    const milk = await productionType();
    const record = await post('/animals/production/records', {
      production_type_id: milk.id,
      animal_id: cow.id,
      production_date: '2026-03-01',
      quantity: 12.5,
    });
    expect(record.status).toBe(201);
    expect(await activityOf('animal_production_records', record.body.data.id)).toMatchObject({
      activity_type: 'production',
      title: 'Milk 12.5 litres',
    });

    expect((await del(`/animals/production/records/${record.body.data.id}`)).status).toBe(200);
    expect((await activityOf('animal_production_records', record.body.data.id)).deleted_at).not.toBeNull();
  });
});

describe('GET /api/v1/activities', () => {
  beforeEach(async () => {
    const observe = (date, stage) =>
      post(`/crops/batches/${batch.id}/observations`, { observation_date: date, growth_stage: stage });
    await observe('2026-03-01', 'Seedling');
    await observe('2026-03-10', 'Vegetative');
    await post(`/crops/batches/${batch.id}/harvests`, { harvest_date: '2026-03-20', quantity: 40, unit: 'kg' });
    await post('/animals/feed-records', {
      animal_id: cow.id,
      feed_date: '2026-03-05',
      feed_name: 'Hay',
      quantity: 10,
      unit: 'kg',
    });
  });

  it('lists live activities newest first, with names, paged', async () => {
    const deleted = await post(`/crops/batches/${batch.id}/observations`, { observation_date: '2026-03-30' });
    await del(`/crops/observations/${deleted.body.data.id}`);

    const res = await timeline({ limit: 3 });

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(res.body.data.map((a) => a.title)).toEqual(['Harvest 40 kg', 'Observation: Vegetative', 'Hay 10 kg']);
    expect(res.body.data[0]).toMatchObject({
      activity_date: '2026-03-20',
      crop_batch_code: batch.batch_code,
      recorded_by_name: expect.any(String),
    });
    expect(res.body.data[2]).toMatchObject({ animal_tag_number: cow.tag_number });
  });

  it('filters by subject, type, dates and title', async () => {
    const titles = async (query) => (await timeline(query)).body.data.map((a) => a.title);

    expect(await titles({ animal_id: cow.id })).toEqual(['Hay 10 kg']);
    expect(await titles({ crop_batch_id: batch.id, activity_type: 'observation' })).toEqual([
      'Observation: Vegetative',
      'Observation: Seedling',
    ]);
    expect(await titles({ activity_type: ['harvest', 'feeding'] })).toEqual(['Harvest 40 kg', 'Hay 10 kg']);
    expect(await titles({ date_from: '2026-03-05', date_to: '2026-03-10' })).toEqual([
      'Observation: Vegetative',
      'Hay 10 kg',
    ]);
    expect(await titles({ search: 'seed' })).toEqual(['Observation: Seedling']);
    expect(await titles({ sort: 'title', order: 'asc', limit: 2 })).toEqual(['Harvest 40 kg', 'Hay 10 kg']);
  });

  it('refuses an unknown sort or filter value', async () => {
    expect((await timeline({ sort: 'recorded_by' })).status).toBe(400);
    expect((await timeline({ status: 'maybe' })).status).toBe(400);
    expect((await timeline({ activity_type: 'DROP TABLE' })).status).toBe(400);
  });

  it('returns one activity, or 404', async () => {
    const [first] = (await timeline({})).body.data;
    const res = await request(app).get(`/api/v1/activities/${first.id}`).set(worker.auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: first.id, title: first.title });

    expect((await request(app).get('/api/v1/activities/999999').set(worker.auth)).status).toBe(404);
  });

  it('needs a signed-in user', async () => {
    expect((await request(app).get('/api/v1/activities')).status).toBe(401);
  });
});

describe('POST /api/v1/activities/bulk', () => {
  const entries = () => [
    {
      client_request_id: uuid(1),
      kind: 'observation',
      batch_id: batch.id,
      data: { observation_date: '2026-03-01', growth_stage: 'Flowering' },
    },
    {
      client_request_id: uuid(2),
      kind: 'feeding',
      data: { animal_id: cow.id, feed_date: '2026-03-01', feed_name: 'Hay', quantity: 10, unit: 'kg' },
    },
  ];

  it('records each entry with its client_request_id, and only once', async () => {
    const first = await bulk(entries());

    expect(first.status).toBe(200);
    expect(first.body.summary).toEqual({ created: 2, duplicate: 0, failed: 0 });
    const [observation, feed] = first.body.data;
    expect(observation).toMatchObject({ client_request_id: uuid(1), status: 'created' });
    expect(observation.record).toMatchObject({ batch_id: batch.id, growth_stage: 'Flowering' });
    expect(await activityOf('animal_feed_records', feed.record.id)).toMatchObject({
      id: feed.activity_id,
      client_request_id: uuid(2),
      recorded_by: worker.user.id,
      title: 'Hay 10 kg',
    });

    // The phone did not hear back and sends the outbox again
    const again = await bulk(entries());
    expect(again.body.summary).toEqual({ created: 0, duplicate: 2, failed: 0 });
    expect(again.body.data.map((r) => r.activity_id)).toEqual([observation.activity_id, feed.activity_id]);
    expect(await count('activities')).toBe(2);
    expect(await count('growth_observations')).toBe(1);
    expect(await count('animal_feed_records')).toBe(1);
  });

  it('records the good entries when one fails, and nothing of the failed one', async () => {
    const item = await createItem({ name: 'Dairy meal', unit: 'kg' });
    await receive(item.id, 5, { unit_cost: 50 });

    const res = await bulk([
      {
        client_request_id: uuid(1),
        kind: 'feeding',
        data: { animal_id: cow.id, feed_date: '2026-03-01', inventory_item_id: item.id, quantity: 8, unit: 'kg' },
      },
      { client_request_id: uuid(2), kind: 'observation', batch_id: batch.id, data: {} },
      ...entries()
        .slice(0, 1)
        .map((e) => ({ ...e, client_request_id: uuid(3) })),
    ]);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ created: 1, duplicate: 0, failed: 2 });
    expect(res.body.data[0]).toMatchObject({ status: 'failed', error: { code: 'INSUFFICIENT_STOCK' } });
    expect(res.body.data[1]).toMatchObject({ status: 'failed', error: { code: 'VALIDATION_ERROR' } });
    expect(res.body.data[2]).toMatchObject({ status: 'created' });
    expect(await count('animal_feed_records')).toBe(0);
    expect(await count('activities')).toBe(1);

    // A failed entry can be fixed and sent again under the same id
    const retry = await bulk([
      {
        client_request_id: uuid(2),
        kind: 'observation',
        batch_id: batch.id,
        data: { observation_date: '2026-03-02' },
      },
    ]);
    expect(retry.body.data[0].status).toBe('created');
  });

  it('applies the same rules as the record’s own endpoint', async () => {
    const res = await bulk([
      {
        client_request_id: uuid(1),
        kind: 'harvest',
        batch_id: 999999,
        data: { harvest_date: '2026-03-01', quantity: 1, unit: 'kg' },
      },
      {
        client_request_id: uuid(2),
        kind: 'feeding',
        data: { animal_id: cow.id, animal_group_id: 1, feed_date: '2026-03-01', quantity: 1, unit: 'kg' },
      },
    ]);

    expect(res.body.data[0]).toMatchObject({ status: 'failed', error: { code: 'NOT_FOUND' } });
    expect(res.body.data[1]).toMatchObject({ status: 'failed', error: { code: 'VALIDATION_ERROR' } });
  });

  it('refuses a malformed request outright', async () => {
    const [entry] = entries();
    expect((await bulk([])).status).toBe(400);
    expect((await bulk([{ ...entry, client_request_id: 'not-a-uuid' }])).status).toBe(400);
    expect((await bulk([{ ...entry, kind: 'birth' }])).status).toBe(400);
    expect((await bulk([entry, entry])).status).toBe(400);
    expect(await count('activities')).toBe(0);
  });
});
