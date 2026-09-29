const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createCropType, createVariety, createLocation, createBatch } = require('../factories/crop');

const API = '/api/v1/crops';

/** ISO date (YYYY-MM-DD) offset from today */
function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

let manager;
let worker;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
  worker = await loginAs(app, 'worker');
});

describe('crop types', () => {
  it('supports create, read, update and conflict detection', async () => {
    const created = await request(app)
      .post(`${API}/crop-types`)
      .set(manager.auth)
      .send({ name: 'Maize', category: 'cereal', typical_growth_days: 120 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const dup = await request(app).post(`${API}/crop-types`).set(manager.auth).send({ name: 'Maize', category: 'x' });
    expect(dup.status).toBe(409);

    await createCropType({ name: 'Beans', category: 'legume' });
    const rename = await request(app).put(`${API}/crop-types/${id}`).set(manager.auth).send({ name: 'Beans' });
    expect(rename.status).toBe(409);

    const update = await request(app).put(`${API}/crop-types/${id}`).set(manager.auth).send({ category: 'grain' });
    expect(update.status).toBe(200);
    expect(update.body.data.category).toBe('grain');

    const one = await request(app).get(`${API}/crop-types/${id}`).set(worker.auth);
    expect(one.body.data.name).toBe('Maize');

    const list = await request(app).get(`${API}/crop-types`).set(worker.auth);
    expect(list.body.data.map((t) => t.name).sort()).toEqual(['Beans', 'Maize']);

    const categories = await request(app).get(`${API}/crop-types/categories`).set(worker.auth);
    expect(categories.status).toBe(200);
    expect(categories.body.data.length).toBe(2);

    expect((await request(app).get(`${API}/crop-types/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/crop-types/9999`).set(manager.auth).send({ name: 'Q' })).status).toBe(404);
    expect((await request(app).delete(`${API}/crop-types/9999`).set(manager.auth)).status).toBe(404);
  });

  it('validates input and restricts writes to managers', async () => {
    const invalid = await request(app).post(`${API}/crop-types`).set(manager.auth).send({ name: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const forbidden = await request(app).post(`${API}/crop-types`).set(worker.auth).send({ name: 'X', category: 'y' });
    expect(forbidden.status).toBe(403);

    expect((await request(app).get(`${API}/crop-types/abc`).set(worker.auth)).status).toBe(400);
    expect((await request(app).get(`${API}/crop-types`)).status).toBe(401);
  });
});

describe('crop varieties', () => {
  it('supports create, list by type, read and update', async () => {
    const type = await createCropType({ name: 'Tomato' });
    const other = await createCropType({ name: 'Onion' });

    const created = await request(app)
      .post(`${API}/varieties`)
      .set(manager.auth)
      .send({ crop_type_id: type.id, name: 'Roma', growth_days: 75 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const dup = await request(app)
      .post(`${API}/varieties`)
      .set(manager.auth)
      .send({ crop_type_id: type.id, name: 'Roma' });
    expect(dup.status).toBe(409);

    const missingType = await request(app)
      .post(`${API}/varieties`)
      .set(manager.auth)
      .send({ crop_type_id: 9999, name: 'Ghost' });
    expect(missingType.status).toBe(404);

    await createVariety({ crop_type_id: other.id, name: 'Red Creole' });

    const all = await request(app).get(`${API}/varieties`).set(worker.auth);
    expect(all.body.data).toHaveLength(2);
    const byType = await request(app).get(`${API}/varieties?crop_type_id=${type.id}`).set(worker.auth);
    expect(byType.body.data.map((v) => v.name)).toEqual(['Roma']);

    const one = await request(app).get(`${API}/varieties/${id}`).set(worker.auth);
    expect(one.body.data.crop_type_name).toBe('Tomato');

    // Saving a variety under its own name is not a conflict
    const same = await request(app)
      .put(`${API}/varieties/${id}`)
      .set(manager.auth)
      .send({ name: 'Roma', growth_days: 80 });
    expect(same.status).toBe(200);
    expect(same.body.data.growth_days).toBe(80);

    expect((await request(app).get(`${API}/varieties/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/varieties/9999`).set(manager.auth).send({ name: 'Q' })).status).toBe(404);
    expect((await request(app).delete(`${API}/varieties/9999`).set(manager.auth)).status).toBe(404);
  });
});

describe('growing locations', () => {
  it('supports CRUD, active filter and type listing', async () => {
    const created = await request(app)
      .post(`${API}/locations`)
      .set(manager.auth)
      .send({ name: 'North Field', type: 'open_field', size_sqm: 4000 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const dup = await request(app).post(`${API}/locations`).set(manager.auth).send({ name: 'North Field', type: 'x' });
    expect(dup.status).toBe(409);

    const inactive = await createLocation({ name: 'Old Shed', is_active: false });

    const all = await request(app).get(`${API}/locations`).set(worker.auth);
    expect(all.body.data).toHaveLength(2);
    const active = await request(app).get(`${API}/locations?active_only=true`).set(worker.auth);
    expect(active.body.data.map((l) => l.id)).toEqual([id]);

    const types = await request(app).get(`${API}/locations/types`).set(worker.auth);
    expect(types.status).toBe(200);

    const rename = await request(app).put(`${API}/locations/${id}`).set(manager.auth).send({ name: 'Old Shed' });
    expect(rename.status).toBe(409);
    const update = await request(app).put(`${API}/locations/${id}`).set(manager.auth).send({ size_sqm: 5000 });
    expect(Number(update.body.data.size_sqm)).toBe(5000);

    expect((await request(app).get(`${API}/locations/${id}`).set(worker.auth)).body.data.name).toBe('North Field');
    expect((await request(app).get(`${API}/locations/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/locations/9999`).set(manager.auth).send({ name: 'Q' })).status).toBe(404);
    expect((await request(app).delete(`${API}/locations/9999`).set(manager.auth)).status).toBe(404);

    expect((await request(app).delete(`${API}/locations/${inactive.id}`).set(manager.auth)).status).toBe(200);
  });

  it('refuses to delete a location with active batches', async () => {
    const location = await createLocation();
    await createBatch({ location_id: location.id, status: 'growing' });

    const res = await request(app).delete(`${API}/locations/${location.id}`).set(manager.auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('IN_USE');
  });
});

describe('crop batches', () => {
  it('creates a batch with a generated code and expected harvest date', async () => {
    const type = await createCropType({ name: 'Cabbage' });
    const variety = await createVariety({ crop_type_id: type.id, growth_days: 90 });
    const location = await createLocation();

    const res = await request(app).post(`${API}/batches`).set(worker.auth).send({
      crop_variety_id: variety.id,
      location_id: location.id,
      planting_date: '2026-03-01',
      quantity_planted: 500,
      unit: 'seedlings',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.batch_code).toMatch(/^CAB-/);
    expect(res.body.data.status).toBe('planted');
    expect(res.body.data.expected_harvest_date).toBe('2026-05-30');
    expect(res.body.data.created_by).toBe(worker.user.id);
  });

  it('rejects invalid batches', async () => {
    const variety = await createVariety();

    const missing = await request(app).post(`${API}/batches`).set(worker.auth).send({ crop_variety_id: variety.id });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['planting_date', 'quantity_planted', 'unit'])
    );

    const base = { planting_date: '2026-03-01', quantity_planted: 1, unit: 'plants' };
    const noVariety = await request(app)
      .post(`${API}/batches`)
      .set(worker.auth)
      .send({ ...base, crop_variety_id: 9999 });
    expect(noVariety.status).toBe(404);
    const noLocation = await request(app)
      .post(`${API}/batches`)
      .set(worker.auth)
      .send({ ...base, crop_variety_id: variety.id, location_id: 9999 });
    expect(noLocation.status).toBe(404);
  });

  it('lists with filters, search and pagination', async () => {
    const location = await createLocation();
    const growing = await createBatch({ location_id: location.id, status: 'growing' });
    await createBatch({ status: 'completed' });
    await createBatch({ status: 'planted' });

    const byStatus = await request(app).get(`${API}/batches?status=growing,planted`).set(worker.auth);
    expect(byStatus.body.data).toHaveLength(2);

    const byLocation = await request(app).get(`${API}/batches?location_id=${location.id}`).set(worker.auth);
    expect(byLocation.body.data.map((b) => b.id)).toEqual([growing.id]);

    const search = await request(app).get(`${API}/batches?search=${growing.batch_code}`).set(worker.auth);
    expect(search.body.data.map((b) => b.id)).toEqual([growing.id]);

    const page = await request(app).get(`${API}/batches?page=1&limit=2`).set(worker.auth);
    expect(page.status).toBe(200);
    expect(page.body.data).toHaveLength(2);
    expect(page.body.pagination.total).toBe(3);

    expect((await request(app).get(`${API}/batches?status=bogus`).set(worker.auth)).status).toBe(400);

    const stats = await request(app).get(`${API}/batches/statistics`).set(worker.auth);
    expect(Number(stats.body.data.total_count)).toBe(3);
  });

  it('updates details and status', async () => {
    const batch = await createBatch();
    const otherVariety = await createVariety();
    const otherLocation = await createLocation();

    const update = await request(app)
      .put(`${API}/batches/${batch.id}`)
      .set(worker.auth)
      .send({ crop_variety_id: otherVariety.id, location_id: otherLocation.id, notes: 'moved' });
    expect(update.status).toBe(200);
    expect(update.body.data.location_id).toBe(otherLocation.id);

    const badVariety = await request(app)
      .put(`${API}/batches/${batch.id}`)
      .set(worker.auth)
      .send({ crop_variety_id: 9999 });
    expect(badVariety.status).toBe(404);
    const badLocation = await request(app)
      .put(`${API}/batches/${batch.id}`)
      .set(worker.auth)
      .send({ location_id: 9999 });
    expect(badLocation.status).toBe(404);

    const status = await request(app)
      .patch(`${API}/batches/${batch.id}/status`)
      .set(worker.auth)
      .send({ status: 'completed' });
    expect(status.body.data.status).toBe('completed');

    expect((await request(app).put(`${API}/batches/9999`).set(worker.auth).send({ notes: 'x' })).status).toBe(404);
    expect(
      (await request(app).patch(`${API}/batches/9999/status`).set(worker.auth).send({ status: 'growing' })).status
    ).toBe(404);
  });
});

describe('batch records', () => {
  let batch;

  beforeEach(async () => {
    batch = await createBatch({ status: 'growing' });
  });

  it('records and removes growth observations', async () => {
    const created = await request(app)
      .post(`${API}/batches/${batch.id}/observations`)
      .set(worker.auth)
      .send({ observation_date: '2026-02-01', growth_stage: 'vegetative', health_status: 'good' });
    expect(created.status).toBe(201);
    expect(created.body.data.recorded_by).toBe(worker.user.id);

    const list = await request(app).get(`${API}/batches/${batch.id}/observations`).set(worker.auth);
    expect(list.body.data).toHaveLength(1);

    const detail = await request(app).get(`${API}/batches/${batch.id}`).set(worker.auth);
    expect(detail.body.data.observations).toHaveLength(1);

    expect(
      (
        await request(app)
          .post(`${API}/batches/9999/observations`)
          .set(worker.auth)
          .send({ observation_date: '2026-02-01' })
      ).status
    ).toBe(404);

    expect((await request(app).delete(`${API}/observations/${created.body.data.id}`).set(manager.auth)).status).toBe(
      200
    );
    expect((await request(app).delete(`${API}/observations/${created.body.data.id}`).set(manager.auth)).status).toBe(
      404
    );
  });

  it('records harvests, moves the batch to harvesting and summarises by crop type', async () => {
    const created = await request(app)
      .post(`${API}/batches/${batch.id}/harvests`)
      .set(worker.auth)
      .send({ harvest_date: '2026-04-10', quantity: 42.5, unit: 'kg', grade: 'A' });
    expect(created.status).toBe(201);

    const detail = await request(app).get(`${API}/batches/${batch.id}`).set(worker.auth);
    expect(detail.body.data.status).toBe('harvesting');
    expect(Number(detail.body.data.total_harvested)).toBe(42.5);

    const all = await request(app)
      .get(`${API}/harvests?harvest_date_from=2026-04-01&harvest_date_to=2026-04-30&grade=A`)
      .set(worker.auth);
    expect(all.body.data).toHaveLength(1);

    const summary = await request(app)
      .get(`${API}/harvests/summary?start_date=2026-01-01&end_date=2026-12-31`)
      .set(worker.auth);
    expect(summary.status).toBe(200);
    expect(summary.body.data).toHaveLength(1);

    expect(
      (
        await request(app)
          .post(`${API}/batches/9999/harvests`)
          .set(worker.auth)
          .send({ harvest_date: '2026-04-10', quantity: 1, unit: 'kg' })
      ).status
    ).toBe(404);
    expect((await request(app).delete(`${API}/harvests/9999`).set(manager.auth)).status).toBe(404);
  });

  it('records input applications', async () => {
    const created = await request(app).post(`${API}/batches/${batch.id}/input-applications`).set(worker.auth).send({
      application_date: '2026-02-15',
      input_type: 'fertilizer',
      product_name: 'CAN',
      quantity: 25,
      unit: 'kg',
    });
    expect(created.status).toBe(201);

    const invalid = await request(app)
      .post(`${API}/batches/${batch.id}/input-applications`)
      .set(worker.auth)
      .send({ application_date: '2026-02-15', input_type: 'magic', product_name: 'X', quantity: 1, unit: 'kg' });
    expect(invalid.status).toBe(400);

    const forBatch = await request(app).get(`${API}/batches/${batch.id}/input-applications`).set(worker.auth);
    expect(forBatch.body.data).toHaveLength(1);
    const all = await request(app).get(`${API}/input-applications?input_type=fertilizer`).set(worker.auth);
    expect(all.body.data).toHaveLength(1);

    expect(
      (await request(app).delete(`${API}/input-applications/${created.body.data.id}`).set(manager.auth)).status
    ).toBe(200);
    expect((await request(app).get(`${API}/input-applications`).set(worker.auth)).body.data).toHaveLength(0);
    expect((await request(app).delete(`${API}/input-applications/9999`).set(manager.auth)).status).toBe(404);
  });

  it('tracks pest and disease incidents through to resolution', async () => {
    const created = await request(app)
      .post(`${API}/batches/${batch.id}/pests-diseases`)
      .set(worker.auth)
      .send({ incident_date: '2026-03-01', type: 'pest', name: 'Aphids', severity: 'high' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('active');
    const id = created.body.data.id;

    const alerts = await request(app).get(`${API}/pests-diseases/alerts?limit=5`).set(worker.auth);
    expect(alerts.body.data.map((a) => a.id)).toEqual([id]);

    const filtered = await request(app)
      .get(`${API}/pests-diseases?type=pest&status=active&severity=high`)
      .set(worker.auth);
    expect(filtered.body.data).toHaveLength(1);
    const forBatch = await request(app).get(`${API}/batches/${batch.id}/pests-diseases`).set(worker.auth);
    expect(forBatch.body.data).toHaveLength(1);

    const resolved = await request(app)
      .patch(`${API}/pests-diseases/${id}`)
      .set(worker.auth)
      .send({ status: 'resolved', control_measures: 'Neem spray' });
    expect(resolved.body.data.status).toBe('resolved');
    expect(resolved.body.data.control_measures).toBe('Neem spray');

    const stats = await request(app).get(`${API}/pests-diseases/statistics`).set(worker.auth);
    expect(stats.status).toBe(200);

    expect(
      (await request(app).patch(`${API}/pests-diseases/9999`).set(worker.auth).send({ status: 'resolved' })).status
    ).toBe(404);
    expect((await request(app).delete(`${API}/pests-diseases/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/pests-diseases/${id}`).set(manager.auth)).status).toBe(404);
  });
});

describe('care plans and schedules', () => {
  async function createPlanWithTasks() {
    const variety = await createVariety();
    const plan = await request(app)
      .post(`${API}/care-plans`)
      .set(manager.auth)
      .send({ name: 'Tomato programme', crop_variety_id: variety.id, total_duration_days: 60, is_template: true });
    expect(plan.status).toBe(201);
    const planId = plan.body.data.id;

    // Day 0: long overdue by the time we apply the plan (planted 30 days ago)
    await request(app)
      .post(`${API}/care-plans/${planId}/tasks`)
      .set(manager.auth)
      .send({
        task_name: 'Basal fertiliser',
        days_from_planting: 0,
        input_type: 'fertilizer',
        input_product_name: 'DAP',
      })
      .expect(201);
    // Every 14 days from day 0 to day 56 → 5 instances
    await request(app)
      .post(`${API}/care-plans/${planId}/tasks`)
      .set(manager.auth)
      .send({
        task_name: 'Scout for pests',
        days_from_planting: 0,
        is_recurring: true,
        recurrence_interval_days: 14,
        recurrence_end_days: 56,
      })
      .expect(201);
    // Day 32: two days from now → upcoming
    await request(app)
      .post(`${API}/care-plans/${planId}/tasks`)
      .set(manager.auth)
      .send({ task_name: 'Top dress', days_from_planting: 32 })
      .expect(201);

    return { planId, variety };
  }

  it('manages plans and their tasks', async () => {
    const { planId, variety } = await createPlanWithTasks();

    const detail = await request(app).get(`${API}/care-plans/${planId}`).set(worker.auth);
    expect(detail.body.data.tasks.map((t) => t.task_sequence)).toEqual([1, 2, 3]);

    expect((await request(app).get(`${API}/care-plans`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/care-plans?templates_only=true`).set(worker.auth)).body.data).toHaveLength(
      1
    );
    expect(
      (await request(app).get(`${API}/care-plans?variety_id=${variety.id}`).set(worker.auth)).body.data
    ).toHaveLength(1);

    const update = await request(app).put(`${API}/care-plans/${planId}`).set(manager.auth).send({ status: 'active' });
    expect(update.body.data.status).toBe('active');
    expect(
      (await request(app).put(`${API}/care-plans/${planId}`).set(manager.auth).send({ crop_variety_id: 9999 })).status
    ).toBe(404);

    const clone = await request(app).post(`${API}/care-plans/${planId}/clone`).set(manager.auth).send({ name: 'Copy' });
    expect(clone.status).toBe(201);
    const cloneTasks = await request(app).get(`${API}/care-plans/${clone.body.data.id}/tasks`).set(worker.auth);
    expect(cloneTasks.body.data).toHaveLength(3);

    const [first] = detail.body.data.tasks;
    const renamed = await request(app)
      .put(`${API}/care-plan-tasks/${first.id}`)
      .set(manager.auth)
      .send({ task_name: 'Basal DAP' });
    expect(renamed.body.data.task_name).toBe('Basal DAP');

    // Removing the first task re-numbers the rest
    expect((await request(app).delete(`${API}/care-plan-tasks/${first.id}`).set(manager.auth)).status).toBe(200);
    const remaining = await request(app).get(`${API}/care-plans/${planId}/tasks`).set(worker.auth);
    expect(remaining.body.data.map((t) => t.task_sequence)).toEqual([1, 2]);

    expect(
      (await request(app).put(`${API}/care-plan-tasks/9999`).set(manager.auth).send({ priority: 'low' })).status
    ).toBe(404);
    expect((await request(app).delete(`${API}/care-plan-tasks/9999`).set(manager.auth)).status).toBe(404);
    expect(
      (
        await request(app)
          .post(`${API}/care-plans/9999/tasks`)
          .set(manager.auth)
          .send({ task_name: 'x', days_from_planting: 1 })
      ).status
    ).toBe(404);
    expect(
      (await request(app).post(`${API}/care-plans`).set(manager.auth).send({ name: 'Bad', crop_variety_id: 9999 }))
        .status
    ).toBe(404);

    expect((await request(app).delete(`${API}/care-plans/${planId}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/care-plans/${planId}`).set(worker.auth)).status).toBe(404);
    expect((await request(app).delete(`${API}/care-plans/${planId}`).set(manager.auth)).status).toBe(404);
  });

  it('applies a plan to a batch and works through the generated tasks', async () => {
    const { planId, variety } = await createPlanWithTasks();
    const batch = await createBatch({ crop_variety_id: variety.id, planting_date: daysFromToday(-30) });

    const applied = await request(app)
      .post(`${API}/batches/${batch.id}/care-schedule`)
      .set(worker.auth)
      .send({ plan_id: planId });
    expect(applied.status).toBe(201);
    const { tasks, progress } = applied.body.data;
    expect(tasks).toHaveLength(1 + 5 + 1);
    expect(Number(progress.total_tasks)).toBe(7);

    const byName = (name) => tasks.filter((t) => t.task_name === name);
    expect(byName('Scout for pests').map((t) => t.recurring_sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(byName('Basal fertiliser')[0].status).toBe('overdue');

    const schedule = await request(app).get(`${API}/batches/${batch.id}/care-schedule`).set(worker.auth);
    expect(schedule.body.data.plan_id).toBe(planId);

    const schedules = await request(app).get(`${API}/care-schedules?status=active`).set(worker.auth);
    expect(schedules.body.data).toHaveLength(1);

    const alerts = await request(app).get(`${API}/care-schedules/alerts?days_ahead=7`).set(worker.auth);
    expect(alerts.body.data.overdue_count).toBeGreaterThan(0);
    expect(alerts.body.data.upcoming_count).toBeGreaterThan(0);

    const overdue = await request(app).get(`${API}/scheduled-tasks?overdue_only=true`).set(worker.auth);
    expect(overdue.body.data.length).toBe(alerts.body.data.overdue_count);
    const forBatch = await request(app).get(`${API}/scheduled-tasks?batch_id=${batch.id}`).set(worker.auth);
    expect(forBatch.body.data).toHaveLength(7);
    const inRange = await request(app)
      .get(`${API}/scheduled-tasks?start_date=${daysFromToday(-31)}&end_date=${daysFromToday(-29)}`)
      .set(worker.auth);
    expect(inRange.body.data).toHaveLength(2);
    const upcoming = await request(app).get(`${API}/scheduled-tasks?days_ahead=7`).set(worker.auth);
    expect(upcoming.status).toBe(200);

    const now = new Date();
    const calendar = await request(app)
      .get(`${API}/scheduled-tasks/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .set(worker.auth);
    expect(calendar.status).toBe(200);

    // Complete the fertiliser task and record the input in one go
    const basal = byName('Basal fertiliser')[0];
    const withInput = await request(app)
      .post(`${API}/scheduled-tasks/${basal.id}/complete-with-input`)
      .set(worker.auth)
      .send({ quantity: 50, unit: 'kg', notes: 'done' });
    expect(withInput.status).toBe(200);
    expect(withInput.body.data.status).toBe('completed');
    const inputs = await request(app).get(`${API}/batches/${batch.id}/input-applications`).set(worker.auth);
    expect(inputs.body.data[0].product_name).toBe('DAP');

    const [scout1, scout2] = byName('Scout for pests');
    const done = await request(app)
      .patch(`${API}/scheduled-tasks/${scout1.id}/complete`)
      .set(worker.auth)
      .send({ notes: 'clean' });
    expect(done.body.data.status).toBe('completed');
    expect((await request(app).patch(`${API}/scheduled-tasks/${scout1.id}/complete`).set(worker.auth)).status).toBe(
      409
    );

    const noReason = await request(app).patch(`${API}/scheduled-tasks/${scout2.id}/skip`).set(worker.auth).send({});
    expect(noReason.status).toBe(400);
    const skipped = await request(app)
      .patch(`${API}/scheduled-tasks/${scout2.id}/skip`)
      .set(worker.auth)
      .send({ reason: 'rain' });
    expect(skipped.body.data.status).toBe('skipped');
    expect(
      (await request(app).patch(`${API}/scheduled-tasks/${scout2.id}/skip`).set(worker.auth).send({ reason: 'x' }))
        .status
    ).toBe(409);

    expect((await request(app).patch(`${API}/scheduled-tasks/9999/complete`).set(worker.auth)).status).toBe(404);
    expect(
      (await request(app).patch(`${API}/scheduled-tasks/9999/skip`).set(worker.auth).send({ reason: 'x' })).status
    ).toBe(404);
    expect((await request(app).post(`${API}/scheduled-tasks/9999/complete-with-input`).set(worker.auth)).status).toBe(
      404
    );

    const statuses = await request(app).post(`${API}/scheduled-tasks/update-statuses`).set(manager.auth);
    expect(Number(statuses.body.data.completed)).toBe(2);
    expect((await request(app).post(`${API}/scheduled-tasks/update-statuses`).set(worker.auth)).status).toBe(403);

    // Re-applying replaces the active schedule; cancelling leaves none
    await request(app)
      .post(`${API}/batches/${batch.id}/care-schedule`)
      .set(worker.auth)
      .send({ plan_id: planId })
      .expect(201);
    expect(await db.one("SELECT COUNT(*)::int AS n FROM batch_care_schedules WHERE status = 'active'")).toEqual({
      n: 1,
    });

    expect((await request(app).delete(`${API}/batches/${batch.id}/care-schedule`).set(manager.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/batches/${batch.id}/care-schedule`).set(worker.auth)).body.data).toBeNull();
    expect((await request(app).delete(`${API}/batches/${batch.id}/care-schedule`).set(manager.auth)).status).toBe(404);
  });

  it('rejects applying a plan to an unknown batch or plan', async () => {
    const { planId } = await createPlanWithTasks();
    const batch = await createBatch();

    expect(
      (await request(app).post(`${API}/batches/9999/care-schedule`).set(worker.auth).send({ plan_id: planId })).status
    ).toBe(404);
    expect(
      (await request(app).post(`${API}/batches/${batch.id}/care-schedule`).set(worker.auth).send({ plan_id: 9999 }))
        .status
    ).toBe(404);
  });
});
