const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createCropType, createVariety, createBatch, createHarvest } = require('../factories/crop');
const { createActivity } = require('../factories/activity');
const { mapDatabaseError } = require('../../src/middleware/error.middleware');

let manager;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
});

describe('crop batches', () => {
  it('deleting a batch with harvests soft-deletes it and keeps the harvest rows', async () => {
    const batch = await createBatch();
    const harvest = await createHarvest(batch.id);

    const res = await request(app).delete(`/api/v1/crops/batches/${batch.id}`).set(manager.auth);
    expect(res.status).toBe(200);

    const row = await db.one('SELECT deleted_at FROM crop_batches WHERE id = $1', [batch.id]);
    expect(row.deleted_at).toBeInstanceOf(Date);
    expect(await db.oneOrNone('SELECT id FROM harvests WHERE id = $1', [harvest.id])).toEqual({ id: harvest.id });
  });

  it('soft-deleted batches disappear from list, detail and statistics endpoints', async () => {
    const kept = await createBatch();
    const removed = await createBatch();
    await request(app).delete(`/api/v1/crops/batches/${removed.id}`).set(manager.auth);

    const list = await request(app).get('/api/v1/crops/batches').set(manager.auth);
    const ids = (list.body.data.data || list.body.data).map((b) => b.id);
    expect(ids).toEqual([kept.id]);

    expect((await request(app).get(`/api/v1/crops/batches/${removed.id}`).set(manager.auth)).status).toBe(404);
    expect((await request(app).delete(`/api/v1/crops/batches/${removed.id}`).set(manager.auth)).status).toBe(404);

    const stats = await request(app).get('/api/v1/crops/batches/statistics').set(manager.auth);
    expect(Number(stats.body.data.total_count)).toBe(1);
  });

  it('a deleted harvest no longer counts towards the batch total', async () => {
    const batch = await createBatch();
    await createHarvest(batch.id, { quantity: 10 });
    const mistake = await createHarvest(batch.id, { quantity: 500 });

    await request(app).delete(`/api/v1/crops/harvests/${mistake.id}`).set(manager.auth);

    const res = await request(app).get(`/api/v1/crops/batches/${batch.id}`).set(manager.auth);
    expect(Number(res.body.data.total_harvested)).toBe(10);
    const harvests = await request(app).get(`/api/v1/crops/batches/${batch.id}/harvests`).set(manager.auth);
    expect(harvests.body.data).toHaveLength(1);
  });

  it('workers cannot delete', async () => {
    const worker = await loginAs(app, 'worker');
    const batch = await createBatch();
    expect((await request(app).delete(`/api/v1/crops/batches/${batch.id}`).set(worker.auth)).status).toBe(403);
  });
});

describe('reference data', () => {
  it('a crop type with live varieties cannot be deleted; once they are gone its name can be reused', async () => {
    const type = await createCropType({ name: 'Tomato' });
    const variety = await createVariety({ crop_type_id: type.id });

    const blocked = await request(app).delete(`/api/v1/crops/crop-types/${type.id}`).set(manager.auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('IN_USE');

    expect((await request(app).delete(`/api/v1/crops/varieties/${variety.id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`/api/v1/crops/crop-types/${type.id}`).set(manager.auth)).status).toBe(200);

    const recreated = await request(app)
      .post('/api/v1/crops/crop-types')
      .set(manager.auth)
      .send({ name: 'tomato', category: 'vegetable' });
    expect(recreated.status).toBe(201);
  });

  it('live crop type names stay unique regardless of case', async () => {
    await createCropType({ name: 'Kale' });
    await expect(createCropType({ name: 'KALE' })).rejects.toMatchObject({ code: '23505' });
  });

  it('a variety with an active batch cannot be deleted, but one with only completed batches can', async () => {
    const variety = await createVariety();
    const batch = await createBatch({ crop_variety_id: variety.id, status: 'growing' });

    const blocked = await request(app).delete(`/api/v1/crops/varieties/${variety.id}`).set(manager.auth);
    expect(blocked.status).toBe(409);

    await db.none("UPDATE crop_batches SET status = 'completed' WHERE id = $1", [batch.id]);
    expect((await request(app).delete(`/api/v1/crops/varieties/${variety.id}`).set(manager.auth)).status).toBe(200);

    // The completed batch still shows its variety name
    const detail = await request(app).get(`/api/v1/crops/batches/${batch.id}`).set(manager.auth);
    expect(detail.body.data.variety_name).toBe(variety.name);
  });
});

describe('RESTRICT foreign keys', () => {
  it('a hard DELETE of a batch with harvests is blocked and maps to 409 IN_USE', async () => {
    const batch = await createBatch();
    await createHarvest(batch.id);

    const error = await db.none('DELETE FROM crop_batches WHERE id = $1', [batch.id]).catch((e) => e);
    expect(error.code).toBe('23001'); // restrict_violation
    expect(mapDatabaseError(error)).toMatchObject({ statusCode: 409, code: 'IN_USE' });
  });

  it('a hard DELETE of an inventory item with ledger rows is blocked', async () => {
    const item = await db.one("INSERT INTO inventory_items (name, unit) VALUES ('Fertiliser', 'kg') RETURNING id");
    await db.none(
      `INSERT INTO inventory_transactions (item_id, transaction_type, quantity, transaction_date)
       VALUES ($1, 'purchase', 50, '2026-03-01')`,
      [item.id]
    );

    await expect(db.none('DELETE FROM inventory_items WHERE id = $1', [item.id])).rejects.toMatchObject({
      code: '23001',
    });
  });

  it('composition children still cascade', async () => {
    const plan = await db.one(
      "INSERT INTO crop_care_plans (name, plan_code) VALUES ('Plan', 'CP-TEST-1') RETURNING id"
    );
    await db.none(
      "INSERT INTO crop_care_plan_tasks (plan_id, task_sequence, task_name, days_from_planting) VALUES ($1, 1, 'Water', 1)",
      [plan.id]
    );

    await db.none('DELETE FROM crop_care_plans WHERE id = $1', [plan.id]);
    expect(await db.one('SELECT COUNT(*)::int AS n FROM crop_care_plan_tasks')).toEqual({ n: 0 });
  });
});

describe('animal production', () => {
  it('deleting a production record soft-deletes it and hides it from lists', async () => {
    const type = await db.one(
      "INSERT INTO animal_production_types (name, category, unit) VALUES ('Milk', 'dairy', 'litres') RETURNING id"
    );
    const group = await db.one(
      "INSERT INTO animal_groups (name, quantity, date_established, status) VALUES ('Herd', 5, CURRENT_DATE, 'active') RETURNING id"
    );
    const activity = await createActivity({
      activity_type: 'production',
      title: 'Milk 20 litres',
      animal_group_id: group.id,
    });
    const record = await db.one(
      `INSERT INTO animal_production_records (production_type_id, animal_group_id, production_date, quantity, activity_id)
       VALUES ($1, $2, '2026-05-01', 20, $3) RETURNING id`,
      [type.id, group.id, activity.id]
    );

    const res = await request(app).delete(`/api/v1/animals/production/records/${record.id}`).set(manager.auth);
    expect(res.status).toBe(200);

    const row = await db.one('SELECT deleted_at FROM animal_production_records WHERE id = $1', [record.id]);
    expect(row.deleted_at).toBeInstanceOf(Date);
    expect((await request(app).get(`/api/v1/animals/production/records/${record.id}`).set(manager.auth)).status).toBe(
      404
    );
  });
});
