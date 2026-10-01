const { db, truncateAll } = require('../helpers/db');
const { createUser } = require('../factories/user');
const { createBatch, createHarvest } = require('../factories/crop');
const { createAnimal, createGroup } = require('../factories/animal');

const insert = (table, row) => db.one('INSERT INTO $1:name ($2:name) VALUES ($2:csv) RETURNING *', [table, row]);
const backfill = async () => (await db.one('SELECT backfill_activities() AS n')).n;
const activityOf = (table, id) =>
  db.one(`SELECT a.* FROM activities a JOIN $1:name d ON d.activity_id = a.id WHERE d.id = $2`, [table, id]);

let user;
let employee;
let batch;

beforeEach(async () => {
  await truncateAll();
  user = await createUser();
  employee = await insert('employees', {
    user_id: user.id,
    employee_code: 'EMP-1',
    first_name: 'Jane',
    last_name: 'Wanjiru',
    date_hired: '2025-01-01',
  });
  batch = await createBatch();
});

describe('backfill_activities()', () => {
  it('creates and links one activity per crop record, with subject, location, cost and performer', async () => {
    const spray = await insert('crop_input_applications', {
      batch_id: batch.id,
      application_date: '2026-03-01',
      input_type: 'fungicide',
      product_name: 'Mancozeb',
      quantity: 2,
      unit: 'kg',
      total_cost: 300,
      recorded_by: user.id,
      notes: 'Morning spray',
    });
    const observation = await insert('growth_observations', {
      batch_id: batch.id,
      observation_date: '2026-03-02',
      growth_stage: 'Flowering',
    });
    const pest = await insert('crop_pests_diseases', {
      batch_id: batch.id,
      incident_date: '2026-03-03',
      type: 'pest',
      name: 'Aphids',
    });
    const harvest = await createHarvest(batch.id, { harvest_date: '2026-04-01', quantity: 12.5 });
    await db.none('UPDATE harvests SET deleted_at = now() WHERE id = $1', [harvest.id]);

    expect(await backfill()).toBe(4);

    expect(await activityOf('crop_input_applications', spray.id)).toMatchObject({
      activity_type: 'input_application',
      status: 'done',
      title: 'Mancozeb 2 kg',
      occurred_on: '2026-03-01',
      crop_batch_id: batch.id,
      location_id: batch.location_id,
      animal_id: null,
      performed_by: employee.id,
      recorded_by: user.id,
      input_cost: 300,
      other_cost: null,
      notes: 'Morning spray',
      deleted_at: null,
    });
    expect(await activityOf('growth_observations', observation.id)).toMatchObject({
      activity_type: 'observation',
      title: 'Observation: Flowering',
      performed_by: null,
    });
    expect((await activityOf('crop_pests_diseases', pest.id)).title).toBe('Pest: Aphids');

    // A deleted record keeps its history, deleted alike
    const harvested = await activityOf('harvests', harvest.id);
    expect(harvested).toMatchObject({ activity_type: 'harvest', title: 'Harvest 12.5 kg', occurred_on: '2026-04-01' });
    expect(harvested.deleted_at).not.toBeNull();
  });

  it('maps animal records to their activity types and splits treatment costs', async () => {
    const cow = await createAnimal();
    const flock = await createGroup();

    // Old data could name both; the animal is the more specific subject
    const feed = await insert('animal_feed_records', {
      animal_id: cow.id,
      animal_group_id: flock.id,
      feed_date: '2026-03-01',
      feed_type: 'concentrate',
      feed_name: 'Dairy meal',
      quantity: 4,
      unit: 'kg',
      total_cost: 220,
    });
    const checkup = await insert('animal_health_records', {
      animal_group_id: flock.id,
      record_date: '2026-03-02',
      record_type: 'checkup',
      cost: 500,
    });
    const vaccination = await insert('animal_health_records', {
      animal_group_id: flock.id,
      record_date: '2026-03-03',
      record_type: 'vaccination',
      medication: 'Newcastle',
    });
    const treatment = await insert('animal_diseases_treatments', {
      animal_id: cow.id,
      diagnosis_date: '2026-03-04',
      disease_name: 'Mastitis',
      cost: 1000,
    });
    for (const [cost, deleted] of [
      [150, false],
      [50, false],
      [999, true],
    ]) {
      await insert('treatment_medications', {
        treatment_id: treatment.id,
        product_name: 'Pen-strep',
        quantity: 1,
        unit: 'vial',
        total_cost: cost,
        administered_date: '2026-03-04',
        deleted_at: deleted ? new Date() : null,
      });
    }
    const eggs = await insert('animal_production_types', { name: 'Eggs', category: 'eggs', unit: 'count' });
    const collection = await insert('animal_production_records', {
      production_type_id: eggs.id,
      animal_group_id: flock.id,
      production_date: '2026-03-05',
      quantity: 87,
    });

    expect(await backfill()).toBe(5);

    expect(await activityOf('animal_feed_records', feed.id)).toMatchObject({
      activity_type: 'feeding',
      title: 'Dairy meal 4 kg',
      animal_id: cow.id,
      animal_group_id: null,
      input_cost: 220,
    });
    expect(await activityOf('animal_health_records', checkup.id)).toMatchObject({
      activity_type: 'health_check',
      title: 'Health check',
      animal_group_id: flock.id,
      other_cost: 500,
    });
    expect(await activityOf('animal_health_records', vaccination.id)).toMatchObject({
      activity_type: 'vaccination',
      title: 'Vaccination: Newcastle',
    });
    expect(await activityOf('animal_diseases_treatments', treatment.id)).toMatchObject({
      activity_type: 'treatment',
      title: 'Treatment: Mastitis',
      input_cost: 200,
      other_cost: 1000,
    });
    expect(await activityOf('animal_production_records', collection.id)).toMatchObject({
      activity_type: 'production',
      title: 'Eggs 87 count',
      occurred_on: '2026-03-05',
    });
  });

  it('only fills in what is missing when run again', async () => {
    const first = await createHarvest(batch.id);
    expect(await backfill()).toBe(1);
    const linked = (await db.one('SELECT activity_id FROM harvests WHERE id = $1', [first.id])).activity_id;

    await createHarvest(batch.id);
    expect(await backfill()).toBe(1);
    expect(await backfill()).toBe(0);

    expect((await db.one('SELECT activity_id FROM harvests WHERE id = $1', [first.id])).activity_id).toBe(linked);
    expect((await db.one('SELECT COUNT(*)::int AS n FROM activities')).n).toBe(2);
  });
});

describe('activities constraints', () => {
  const activity = (row) => insert('activities', { activity_type: 'observation', title: 'Look', ...row });

  it('needs exactly one subject, except for task work', async () => {
    const cow = await createAnimal();
    await expect(activity({ occurred_on: '2026-03-01' })).rejects.toThrow(/activities_subject_check/);
    await expect(activity({ occurred_on: '2026-03-01', crop_batch_id: batch.id, animal_id: cow.id })).rejects.toThrow(
      /activities_subject_check/
    );
    await expect(activity({ activity_type: 'task_work', occurred_on: '2026-03-01' })).resolves.toBeDefined();
  });

  it('needs a date for what was done or is planned, and one id per offline request', async () => {
    await expect(activity({ crop_batch_id: batch.id })).rejects.toThrow(/activities_dates_check/);
    await expect(activity({ crop_batch_id: batch.id, status: 'planned' })).rejects.toThrow(/activities_dates_check/);
    await expect(activity({ crop_batch_id: batch.id, status: 'cancelled' })).resolves.toBeDefined();

    const key = '6f1c2a54-0b8e-4c3a-9d55-2f6a1e7b9c10';
    await activity({ crop_batch_id: batch.id, occurred_on: '2026-03-01', client_request_id: key });
    await expect(
      activity({ crop_batch_id: batch.id, occurred_on: '2026-03-01', client_request_id: key })
    ).rejects.toThrow(/activities_client_request_id_key/);
  });

  it('one activity belongs to one detail row', async () => {
    const a = await activity({ crop_batch_id: batch.id, occurred_on: '2026-03-01' });
    await createHarvest(batch.id, { activity_id: a.id });
    await expect(createHarvest(batch.id, { activity_id: a.id })).rejects.toThrow(/uq_harvests_activity/);
  });
});
