const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createAnimalType, createBreed, createHousing, createAnimal, createGroup } = require('../factories/animal');

const API = '/api/v1/animals';

/** ISO date (YYYY-MM-DD) offset from today */
function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const groupQuantity = async (id) =>
  (await db.one('SELECT current_quantity FROM animal_groups WHERE id = $1', [id])).current_quantity;

let manager;
let worker;

beforeEach(async () => {
  await truncateAll();
  manager = await loginAs(app, 'manager');
  worker = await loginAs(app, 'worker');
});

describe('reference data', () => {
  it('manages animal types', async () => {
    const created = await request(app)
      .post(`${API}/types`)
      .set(manager.auth)
      .send({ name: 'Goat', category: 'livestock', tracking_mode: 'individual', reproduction_type: 'mammal' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect(
      (await request(app).post(`${API}/types`).set(manager.auth).send({ name: 'Goat', category: 'x' })).status
    ).toBe(409);
    expect((await request(app).post(`${API}/types`).set(worker.auth).send({ name: 'Pig', category: 'x' })).status).toBe(
      403
    );
    expect((await request(app).post(`${API}/types`).set(manager.auth).send({ name: 'Pig' })).status).toBe(400);

    await createAnimalType({ name: 'Chicken', category: 'poultry' });
    const rename = await request(app).put(`${API}/types/${id}`).set(manager.auth).send({ name: 'Chicken' });
    expect(rename.status).toBe(409);
    const update = await request(app).put(`${API}/types/${id}`).set(manager.auth).send({ category: 'small stock' });
    expect(update.body.data.category).toBe('small stock');

    expect((await request(app).get(`${API}/types`).set(worker.auth)).body.data).toHaveLength(2);
    expect((await request(app).get(`${API}/types/categories`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/types/${id}`).set(worker.auth)).body.data.name).toBe('Goat');
    expect((await request(app).get(`${API}/types/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/types/9999`).set(manager.auth).send({ name: 'Q' })).status).toBe(404);

    await createBreed({ animal_type_id: id });
    const blocked = await request(app).delete(`${API}/types/${id}`).set(manager.auth);
    expect(blocked.status).toBe(409);
    expect((await request(app).delete(`${API}/types/9999`).set(manager.auth)).status).toBe(404);
  });

  it('manages breeds', async () => {
    const type = await createAnimalType({ name: 'Cattle' });
    const other = await createAnimalType({ name: 'Sheep' });

    const created = await request(app)
      .post(`${API}/breeds`)
      .set(manager.auth)
      .send({ animal_type_id: type.id, name: 'Friesian' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect(
      (await request(app).post(`${API}/breeds`).set(manager.auth).send({ animal_type_id: type.id, name: 'Friesian' }))
        .status
    ).toBe(409);
    expect(
      (await request(app).post(`${API}/breeds`).set(manager.auth).send({ animal_type_id: 9999, name: 'Ghost' })).status
    ).toBe(404);

    await createBreed({ animal_type_id: other.id, name: 'Dorper' });
    expect((await request(app).get(`${API}/breeds`).set(worker.auth)).body.data).toHaveLength(2);
    expect(
      (await request(app).get(`${API}/breeds?animal_type_id=${type.id}`).set(worker.auth)).body.data.map((b) => b.name)
    ).toEqual(['Friesian']);
    expect((await request(app).get(`${API}/breeds/${id}`).set(worker.auth)).body.data.name).toBe('Friesian');

    // Saving a breed under its own name is not a conflict
    const same = await request(app).put(`${API}/breeds/${id}`).set(manager.auth).send({ name: 'Friesian' });
    expect(same.status).toBe(200);

    expect((await request(app).get(`${API}/breeds/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/breeds/9999`).set(manager.auth).send({ name: 'Q' })).status).toBe(404);

    await createAnimal({ animal_breed_id: id });
    expect((await request(app).delete(`${API}/breeds/${id}`).set(manager.auth)).status).toBe(409);
    expect((await request(app).delete(`${API}/breeds/9999`).set(manager.auth)).status).toBe(404);
  });

  it('manages housing', async () => {
    const created = await request(app)
      .post(`${API}/housing`)
      .set(manager.auth)
      .send({ name: 'Barn A', housing_type: 'barn', capacity: 20 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect((await request(app).post(`${API}/housing`).set(manager.auth).send({ name: 'Barn A' })).status).toBe(409);
    await createHousing({ name: 'Coop' });
    expect((await request(app).put(`${API}/housing/${id}`).set(manager.auth).send({ name: 'Coop' })).status).toBe(409);
    expect(
      (await request(app).put(`${API}/housing/${id}`).set(manager.auth).send({ capacity: 25 })).body.data.capacity
    ).toBe(25);

    expect((await request(app).get(`${API}/housing`).set(worker.auth)).body.data).toHaveLength(2);
    expect((await request(app).get(`${API}/housing/types`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/housing/${id}`).set(worker.auth)).body.data.name).toBe('Barn A');
    expect((await request(app).get(`${API}/housing/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/housing/9999`).set(manager.auth).send({ name: 'Q' })).status).toBe(404);

    await createAnimal({ housing_id: id });
    expect((await request(app).delete(`${API}/housing/${id}`).set(manager.auth)).status).toBe(409);
    expect((await request(app).delete(`${API}/housing/9999`).set(manager.auth)).status).toBe(404);
  });
});

describe('individual animals', () => {
  it('registers, lists, updates and removes animals', async () => {
    const type = await createAnimalType({ name: 'Cattle' });
    const breed = await createBreed({ animal_type_id: type.id });
    const housing = await createHousing();

    const created = await request(app).post(`${API}/individuals`).set(worker.auth).send({
      animal_breed_id: breed.id,
      housing_id: housing.id,
      date_acquired: '2026-02-01',
      gender: 'female',
      name: 'Daisy',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.tag_number).toMatch(/^CAT-/);
    expect(created.body.data.status).toBe('active');
    const id = created.body.data.id;

    const dupTag = await request(app)
      .post(`${API}/individuals`)
      .set(worker.auth)
      .send({ animal_breed_id: breed.id, date_acquired: '2026-02-01', tag_number: created.body.data.tag_number });
    expect(dupTag.status).toBe(409);
    expect(
      (
        await request(app)
          .post(`${API}/individuals`)
          .set(worker.auth)
          .send({ animal_breed_id: 9999, date_acquired: '2026-02-01' })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`${API}/individuals`)
          .set(worker.auth)
          .send({ animal_breed_id: breed.id, date_acquired: '2026-02-01', housing_id: 9999 })
      ).status
    ).toBe(404);

    const bull = await createAnimal({ animal_breed_id: breed.id, gender: 'male', is_breeding_stock: true });
    const calf = await createAnimal({ animal_breed_id: breed.id, parent_female_id: id });

    const all = await request(app).get(`${API}/individuals`).set(worker.auth);
    expect(all.body.data).toHaveLength(3);
    const females = await request(app).get(`${API}/individuals?gender=female`).set(worker.auth);
    expect(females.body.data).toHaveLength(2);
    const page = await request(app).get(`${API}/individuals?page=1&limit=2`).set(worker.auth);
    expect(page.body.data).toHaveLength(2);
    expect(page.body.pagination.total).toBe(3);

    const detail = await request(app).get(`${API}/individuals/${id}`).set(worker.auth);
    expect(detail.body.data.name).toBe('Daisy');
    const offspring = await request(app).get(`${API}/individuals/${id}/offspring`).set(worker.auth);
    expect(offspring.body.data.map((a) => a.id)).toEqual([calf.id]);

    expect((await request(app).get(`${API}/individuals/statistics`).set(worker.auth)).status).toBe(200);
    const stock = await request(app).get(`${API}/individuals/breeding-stock?gender=male`).set(worker.auth);
    expect(stock.body.data.map((a) => a.id)).toContain(bull.id);

    const renamed = await request(app).put(`${API}/individuals/${id}`).set(worker.auth).send({ name: 'Daisy II' });
    expect(renamed.body.data.name).toBe('Daisy II');
    expect(
      (await request(app).put(`${API}/individuals/${id}`).set(worker.auth).send({ tag_number: bull.tag_number })).status
    ).toBe(409);
    expect(
      (await request(app).put(`${API}/individuals/${id}`).set(worker.auth).send({ animal_breed_id: 9999 })).status
    ).toBe(404);
    expect(
      (await request(app).put(`${API}/individuals/${id}`).set(worker.auth).send({ housing_id: 9999 })).status
    ).toBe(404);

    const culled = await request(app)
      .patch(`${API}/individuals/${calf.id}/status`)
      .set(worker.auth)
      .send({ status: 'culled' });
    expect(culled.body.data.status).toBe('culled');
    expect((await request(app).post(`${API}/individuals/${calf.id}/sale`).set(worker.auth).send({})).status).toBe(409);
    const sold = await request(app)
      .post(`${API}/individuals/${bull.id}/sale`)
      .set(worker.auth)
      .send({ sale_date: '2026-06-01' });
    expect(sold.body.data.status).toBe('sold');

    expect((await request(app).get(`${API}/individuals/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/individuals/9999`).set(worker.auth).send({ name: 'x' })).status).toBe(404);
    expect(
      (await request(app).patch(`${API}/individuals/9999/status`).set(worker.auth).send({ status: 'culled' })).status
    ).toBe(404);
    expect((await request(app).post(`${API}/individuals/9999/sale`).set(worker.auth).send({})).status).toBe(404);

    expect((await request(app).delete(`${API}/individuals/${id}`).set(worker.auth)).status).toBe(403);
    expect((await request(app).delete(`${API}/individuals/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/individuals/${id}`).set(worker.auth)).status).toBe(404);
    expect((await request(app).delete(`${API}/individuals/${id}`).set(manager.auth)).status).toBe(404);
  });

  it('records a death, and deleting the death record reactivates the animal', async () => {
    const animal = await createAnimal();

    const death = await request(app)
      .post(`${API}/individuals/${animal.id}/death`)
      .set(worker.auth)
      .send({ death_date: '2026-05-01', cause_category: 'disease', cause_of_death: 'ECF', estimated_loss: 80000 });
    expect(death.status).toBe(201);

    const after = await request(app).get(`${API}/individuals/${animal.id}`).set(worker.auth);
    expect(after.body.data.status).toBe('deceased');
    expect(after.body.data.status_date).toBe('2026-05-01');

    expect(
      (
        await request(app)
          .post(`${API}/individuals/${animal.id}/death`)
          .set(worker.auth)
          .send({ death_date: '2026-05-02' })
      ).status
    ).toBe(409);
    expect(
      (await request(app).post(`${API}/individuals/9999/death`).set(worker.auth).send({ death_date: '2026-05-02' }))
        .status
    ).toBe(404);

    expect((await request(app).delete(`${API}/deaths/${death.body.data.id}`).set(manager.auth)).status).toBe(200);
    const restored = await request(app).get(`${API}/individuals/${animal.id}`).set(worker.auth);
    expect(restored.body.data.status).toBe('active');
  });
});

describe('animal groups', () => {
  it('creates a group and tracks additions, removals, deaths and closure', async () => {
    const type = await createAnimalType({ name: 'Chicken', category: 'poultry' });
    const breed = await createBreed({ animal_type_id: type.id });

    const created = await request(app).post(`${API}/groups`).set(worker.auth).send({
      name: 'Layers 2026',
      animal_breed_id: breed.id,
      quantity: 500,
      date_established: '2026-03-01',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.group_code).toMatch(/^CHI-/);
    expect(created.body.data.current_quantity).toBe(500);
    const id = created.body.data.id;

    expect(
      (
        await request(app).post(`${API}/groups`).set(worker.auth).send({
          name: 'Dup',
          animal_breed_id: breed.id,
          quantity: 1,
          date_established: '2026-03-01',
          group_code: created.body.data.group_code,
        })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`${API}/groups`)
          .set(worker.auth)
          .send({ name: 'X', animal_breed_id: 9999, quantity: 1, date_established: '2026-03-01' })
      ).status
    ).toBe(404);

    const added = await request(app)
      .post(`${API}/groups/${id}/addition`)
      .set(worker.auth)
      .send({ quantity: 20, type: 'hatched', adjustment_date: '2026-03-05' });
    expect(added.status).toBe(201);
    expect(await groupQuantity(id)).toBe(520);

    const removed = await request(app)
      .post(`${API}/groups/${id}/removal`)
      .set(worker.auth)
      .send({ quantity: 10, type: 'transfer_out', adjustment_date: '2026-03-06' });
    expect(removed.status).toBe(201);
    expect(await groupQuantity(id)).toBe(510);

    expect(
      (await request(app).post(`${API}/groups/${id}/removal`).set(worker.auth).send({ quantity: 9999 })).status
    ).toBe(400);

    const death = await request(app)
      .post(`${API}/groups/${id}/death`)
      .set(worker.auth)
      .send({ death_date: '2026-03-07', quantity: 5, cause_category: 'predator' });
    expect(death.status).toBe(201);
    expect(await groupQuantity(id)).toBe(505);
    expect(
      (
        await request(app)
          .post(`${API}/groups/${id}/death`)
          .set(worker.auth)
          .send({ death_date: '2026-03-07', quantity: 9999 })
      ).status
    ).toBe(400);

    const adjustments = await request(app).get(`${API}/groups/${id}/adjustments`).set(worker.auth);
    expect(adjustments.body.data.map((a) => a.adjustment_type).sort()).toEqual(['death', 'hatched', 'transfer_out']);

    const mortality = await request(app).get(`${API}/groups/${id}/mortality-rate`).set(worker.auth);
    expect(Number(mortality.body.data.total_deaths)).toBe(5);

    const detail = await request(app).get(`${API}/groups/${id}`).set(worker.auth);
    expect(detail.body.data.adjustments).toHaveLength(3);

    // Deleting the death record returns the birds to the group
    expect((await request(app).delete(`${API}/deaths/${death.body.data.id}`).set(manager.auth)).status).toBe(200);
    expect(await groupQuantity(id)).toBe(510);

    const updated = await request(app).put(`${API}/groups/${id}`).set(worker.auth).send({ name: 'Layers A' });
    expect(updated.body.data.name).toBe('Layers A');
    const other = await createGroup();
    expect(
      (await request(app).put(`${API}/groups/${id}`).set(worker.auth).send({ group_code: other.group_code })).status
    ).toBe(409);

    expect((await request(app).get(`${API}/groups`).set(worker.auth)).body.data).toHaveLength(2);
    const page = await request(app).get(`${API}/groups?page=1&limit=1`).set(worker.auth);
    expect(page.body.pagination.total).toBe(2);
    expect((await request(app).get(`${API}/groups/statistics`).set(worker.auth)).status).toBe(200);

    const closed = await request(app).patch(`${API}/groups/${id}/close`).set(worker.auth);
    expect(closed.body.data.status).toBe('closed');

    for (const [method, path, body] of [
      ['get', '/groups/9999'],
      ['put', '/groups/9999', { name: 'x' }],
      ['post', '/groups/9999/addition', { quantity: 1 }],
      ['post', '/groups/9999/removal', { quantity: 1 }],
      ['post', '/groups/9999/death', { death_date: '2026-03-07', quantity: 1 }],
      ['patch', '/groups/9999/close'],
    ]) {
      const res = await request(app)[method](`${API}${path}`).set(worker.auth).send(body);
      expect([method, path, res.status]).toEqual([method, path, 404]);
    }

    expect((await request(app).delete(`${API}/groups/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/groups/${id}`).set(manager.auth)).status).toBe(404);
  });

  it('a group can be emptied to zero and no further', async () => {
    const group = await createGroup({ quantity: 3 });
    await request(app).post(`${API}/groups/${group.id}/removal`).set(worker.auth).send({ quantity: 3 }).expect(201);
    expect(await groupQuantity(group.id)).toBe(0);

    const res = await request(app).post(`${API}/groups/${group.id}/removal`).set(worker.auth).send({ quantity: 1 });
    expect(res.status).toBe(400);
    expect(await groupQuantity(group.id)).toBe(0);
  });
});

describe('deaths', () => {
  it('lists, summarises and edits death records', async () => {
    const group = await createGroup({ quantity: 50 });
    const animal = await createAnimal();
    await request(app)
      .post(`${API}/groups/${group.id}/death`)
      .set(worker.auth)
      .send({ death_date: daysFromToday(-1), quantity: 4, cause_category: 'disease', estimated_loss: 2000 })
      .expect(201);
    const single = await request(app)
      .post(`${API}/individuals/${animal.id}/death`)
      .set(worker.auth)
      .send({ death_date: daysFromToday(-2), cause_category: 'accident' })
      .expect(201);

    expect((await request(app).get(`${API}/deaths`).set(worker.auth)).body.data).toHaveLength(2);
    expect((await request(app).get(`${API}/deaths?cause_category=disease`).set(worker.auth)).body.data).toHaveLength(1);

    const stats = await request(app).get(`${API}/deaths/statistics`).set(worker.auth);
    expect(stats.body.data).toMatchObject({ total_records: 2, total_deaths: 5, disease_deaths: 1, accident_deaths: 1 });
    expect(stats.body.data.total_estimated_loss).toBe(2000);

    const byCause = await request(app).get(`${API}/deaths/by-cause`).set(worker.auth);
    expect(byCause.body.data[0]).toMatchObject({ cause_category: 'disease', total_deaths: 4 });

    expect((await request(app).get(`${API}/deaths/alerts`).set(worker.auth)).body.data).toHaveLength(2);

    const id = single.body.data.id;
    expect((await request(app).get(`${API}/deaths/${id}`).set(worker.auth)).body.data.animal_tag).toBe(
      animal.tag_number
    );
    const edited = await request(app).put(`${API}/deaths/${id}`).set(worker.auth).send({ cause_of_death: 'Fell' });
    expect(edited.body.data.cause_of_death).toBe('Fell');

    expect((await request(app).get(`${API}/deaths/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/deaths/9999`).set(worker.auth).send({ cause_of_death: 'x' })).status).toBe(
      404
    );
    expect((await request(app).delete(`${API}/deaths/9999`).set(manager.auth)).status).toBe(404);
  });
});

describe('care plans and schedules', () => {
  async function createPlan(appliesTo = 'both', name = `Vaccination ${appliesTo}`) {
    const plan = await request(app).post(`${API}/care-plans`).set(manager.auth).send({
      name,
      plan_type: 'vaccination',
      applies_to: appliesTo,
      total_duration_days: 60,
    });
    expect(plan.status).toBe(201);
    const planId = plan.body.data.id;

    // Planned 30 days after start → with a start 30 days ago this is due today
    await request(app)
      .post(`${API}/care-plans/${planId}/tasks`)
      .set(manager.auth)
      .send({ task_name: 'Newcastle vaccine', days_from_start: 0, task_type: 'vaccination' })
      .expect(201);
    await request(app)
      .post(`${API}/care-plans/${planId}/tasks`)
      .set(manager.auth)
      .send({
        task_name: 'Weigh',
        days_from_start: 0,
        is_recurring: true,
        recurrence_interval_days: 20,
        recurrence_end_days: 60,
      })
      .expect(201);
    return planId;
  }

  it('manages plans and tasks', async () => {
    const planId = await createPlan();

    const detail = await request(app).get(`${API}/care-plans/${planId}`).set(worker.auth);
    expect(detail.body.data.tasks).toHaveLength(2);
    expect((await request(app).get(`${API}/care-plans`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/care-plans/${planId}/tasks`).set(worker.auth)).body.data).toHaveLength(2);

    const updated = await request(app).put(`${API}/care-plans/${planId}`).set(manager.auth).send({ status: 'active' });
    expect(updated.body.data.status).toBe('active');

    const clone = await request(app).post(`${API}/care-plans/${planId}/clone`).set(manager.auth).send({ name: 'Copy' });
    expect(clone.status).toBe(201);
    expect(
      (await request(app).get(`${API}/care-plans/${clone.body.data.id}/tasks`).set(worker.auth)).body.data
    ).toHaveLength(2);

    const [first] = detail.body.data.tasks;
    const task = await request(app)
      .put(`${API}/care-plan-tasks/${first.id}`)
      .set(manager.auth)
      .send({ priority: 'high' });
    expect(task.body.data.priority).toBe('high');
    expect((await request(app).delete(`${API}/care-plan-tasks/${first.id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/care-plans/${planId}/tasks`).set(worker.auth)).body.data).toHaveLength(1);

    expect(
      (await request(app).post(`${API}/care-plans`).set(worker.auth).send({ name: 'x', plan_type: 'general' })).status
    ).toBe(403);
    expect((await request(app).get(`${API}/care-plans/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/care-plans/9999`).set(manager.auth).send({ name: 'x' })).status).toBe(404);
    expect(
      (
        await request(app)
          .post(`${API}/care-plans/9999/tasks`)
          .set(manager.auth)
          .send({ task_name: 'x', days_from_start: 1 })
      ).status
    ).toBe(404);
    expect(
      (await request(app).put(`${API}/care-plan-tasks/9999`).set(manager.auth).send({ priority: 'low' })).status
    ).toBe(404);
    expect((await request(app).delete(`${API}/care-plan-tasks/9999`).set(manager.auth)).status).toBe(404);

    expect((await request(app).delete(`${API}/care-plans/${planId}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/care-plans/${planId}`).set(manager.auth)).status).toBe(404);
  });

  it('applies a plan to a group and works through its tasks', async () => {
    const planId = await createPlan('flock');
    const group = await createGroup({ quantity: 200 });

    const applied = await request(app)
      .post(`${API}/groups/${group.id}/care-schedule`)
      .set(worker.auth)
      .send({ plan_id: planId, start_date: daysFromToday(-30) });
    expect(applied.status).toBe(201);

    expect(applied.body.data).toMatchObject({ plan_id: planId, animal_group_id: group.id, status: 'active' });
    expect(applied.body.data.tasks).toHaveLength(5);

    const schedule = await request(app).get(`${API}/groups/${group.id}/care-schedule`).set(worker.auth);
    expect(schedule.body.data.map((s) => s.plan_id)).toEqual([planId]);

    const tasks = await request(app).get(`${API}/scheduled-tasks?animal_group_id=${group.id}`).set(worker.auth);
    // 1 one-off + weigh on days 0, 20, 40, 60
    const all = await db.any('SELECT * FROM scheduled_animal_tasks WHERE animal_group_id = $1 ORDER BY planned_date', [
      group.id,
    ]);
    expect(all).toHaveLength(5);
    expect(all.every((t) => t.quantity_total === 200)).toBe(true);
    expect(tasks.status).toBe(200);

    const vaccine = all.find((t) => t.task_name === 'Newcastle vaccine');
    expect(vaccine.status).toBe('overdue');

    const partial = await request(app)
      .patch(`${API}/scheduled-tasks/${vaccine.id}/partial-complete`)
      .set(worker.auth)
      .send({ quantity_treated: 120 });
    expect(partial.status).toBe(200);
    expect(partial.body.data).toMatchObject({ status: 'partially_completed', quantity_treated: 120 });

    const done = await request(app)
      .patch(`${API}/scheduled-tasks/${vaccine.id}/complete`)
      .set(worker.auth)
      .send({ quantity_treated: 80, notes: 'second round' });
    expect(done.body.data.status).toBe('completed');
    expect(
      (await request(app).patch(`${API}/scheduled-tasks/${vaccine.id}/complete`).set(worker.auth).send({})).status
    ).toBe(409);

    const weighs = all.filter((t) => t.task_name === 'Weigh');
    const skipped = await request(app)
      .patch(`${API}/scheduled-tasks/${weighs[0].id}/skip`)
      .set(worker.auth)
      .send({ reason: 'scale broken' });
    expect(skipped.body.data.status).toBe('skipped');
    expect(
      (await request(app).patch(`${API}/scheduled-tasks/${weighs[0].id}/skip`).set(worker.auth).send({ reason: 'x' }))
        .status
    ).toBe(409);

    expect((await request(app).get(`${API}/scheduled-tasks?overdue_only=true`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/scheduled-tasks?days_ahead=30`).set(worker.auth)).status).toBe(200);
    expect(
      (
        await request(app)
          .get(`${API}/scheduled-tasks?start_date=${daysFromToday(-40)}&end_date=${daysFromToday(40)}`)
          .set(worker.auth)
      ).body.data.length
    ).toBeGreaterThan(0);
    const now = new Date();
    expect(
      (
        await request(app)
          .get(`${API}/scheduled-tasks/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
          .set(worker.auth)
      ).status
    ).toBe(200);
    expect((await request(app).get(`${API}/care-schedules`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/care-schedules/alerts?days_ahead=30`).set(worker.auth)).status).toBe(200);

    const statuses = await request(app).post(`${API}/scheduled-tasks/update-statuses`).set(manager.auth);
    expect(statuses.status).toBe(200);
    expect((await request(app).post(`${API}/scheduled-tasks/update-statuses`).set(worker.auth)).status).toBe(403);

    for (const [path, body] of [
      ['/scheduled-tasks/9999/complete', {}],
      ['/scheduled-tasks/9999/partial-complete', { quantity_treated: 1 }],
      ['/scheduled-tasks/9999/skip', { reason: 'x' }],
    ]) {
      expect((await request(app).patch(`${API}${path}`).set(worker.auth).send(body)).status).toBe(404);
    }

    const scheduleId = schedule.body.data[0].id;
    expect((await request(app).delete(`${API}/care-schedules/${scheduleId}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/care-schedules/9999`).set(manager.auth)).status).toBe(404);
  });

  // F20: applying a plan used to cancel every other plan the animal was on
  it('lets an animal and a group follow several plans, each once at a time', async () => {
    const vaccinations = await createPlan('both', 'Vaccinations');
    const deworming = await createPlan('both', 'Deworming');
    const animal = await createAnimal();
    const group = await createGroup();
    const apply = (path, planId) =>
      request(app)
        .post(`${API}${path}/care-schedule`)
        .set(worker.auth)
        .send({ plan_id: planId, start_date: daysFromToday(0) });
    const active = async (path) =>
      (await request(app).get(`${API}${path}/care-schedule`).set(worker.auth)).body.data.map((s) => s.plan_name);

    for (const path of [`/individuals/${animal.id}`, `/groups/${group.id}`]) {
      expect((await apply(path, vaccinations)).status).toBe(201);
      expect((await apply(path, deworming)).status).toBe(201);
      expect(await active(path)).toEqual(['Vaccinations', 'Deworming']);

      const again = await apply(path, vaccinations);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe('CARE_PLAN_ALREADY_ACTIVE');
      expect(await active(path)).toEqual(['Vaccinations', 'Deworming']);
    }

    // Cancelling a schedule frees its plan to start again; the other plan is untouched
    const [first] = (await request(app).get(`${API}/individuals/${animal.id}/care-schedule`).set(worker.auth)).body
      .data;
    await request(app).delete(`${API}/care-schedules/${first.id}`).set(manager.auth).expect(200);
    expect(await active(`/individuals/${animal.id}`)).toEqual(['Deworming']);
    expect((await apply(`/individuals/${animal.id}`, vaccinations)).status).toBe(201);
    expect(await active(`/individuals/${animal.id}`)).toEqual(['Deworming', 'Vaccinations']);
    // Each schedule keeps its own tasks: 5 per plan applied, the cancelled one's included
    const tasks = await db.one('SELECT count(*)::int AS n FROM scheduled_animal_tasks WHERE animal_id = $1', [
      animal.id,
    ]);
    expect(tasks.n).toBe(15);
  });

  it('applies a plan to an individual and respects applies_to', async () => {
    const flockOnly = await createPlan('flock');
    const individualOnly = await createPlan('individual');
    const animal = await createAnimal();
    const group = await createGroup();

    expect(
      (
        await request(app)
          .post(`${API}/individuals/${animal.id}/care-schedule`)
          .set(worker.auth)
          .send({ plan_id: flockOnly })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/groups/${group.id}/care-schedule`)
          .set(worker.auth)
          .send({ plan_id: individualOnly })
      ).status
    ).toBe(400);

    const applied = await request(app)
      .post(`${API}/individuals/${animal.id}/care-schedule`)
      .set(worker.auth)
      .send({ plan_id: individualOnly, start_date: daysFromToday(0) });
    expect(applied.status).toBe(201);
    const schedule = await request(app).get(`${API}/individuals/${animal.id}/care-schedule`).set(worker.auth);
    expect(schedule.body.data.map((s) => s.plan_id)).toEqual([individualOnly]);

    expect(
      (
        await request(app)
          .post(`${API}/individuals/9999/care-schedule`)
          .set(worker.auth)
          .send({ plan_id: individualOnly })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`${API}/individuals/${animal.id}/care-schedule`)
          .set(worker.auth)
          .send({ plan_id: 9999 })
      ).status
    ).toBe(404);
    expect(
      (await request(app).post(`${API}/groups/9999/care-schedule`).set(worker.auth).send({ plan_id: flockOnly })).status
    ).toBe(404);
  });
});

describe('health, disease and feed records', () => {
  it('records health events for animals and groups', async () => {
    const animal = await createAnimal();
    const group = await createGroup();

    const record = await request(app)
      .post(`${API}/health-records`)
      .set(worker.auth)
      .send({
        animal_id: animal.id,
        record_date: '2026-04-01',
        record_type: 'vaccination',
        medication: 'FMD vaccine',
        next_due_date: daysFromToday(10),
      });
    expect(record.status).toBe(201);
    await request(app)
      .post(`${API}/health-records`)
      .set(worker.auth)
      .send({ animal_group_id: group.id, record_date: '2026-04-02', record_type: 'deworming' })
      .expect(201);

    expect(
      (
        await request(app)
          .post(`${API}/health-records`)
          .set(worker.auth)
          .send({ record_date: '2026-04-02', record_type: 'checkup' })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/health-records`)
          .set(worker.auth)
          .send({ animal_id: 9999, record_date: '2026-04-02', record_type: 'checkup' })
      ).status
    ).toBe(404);

    expect((await request(app).get(`${API}/health-records`).set(worker.auth)).body.data).toHaveLength(2);
    expect(
      (await request(app).get(`${API}/individuals/${animal.id}/health-records`).set(worker.auth)).body.data
    ).toHaveLength(1);
    expect(
      (await request(app).get(`${API}/groups/${group.id}/health-records`).set(worker.auth)).body.data
    ).toHaveLength(1);
    expect((await request(app).get(`${API}/health-records/statistics`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/health-records/upcoming-followups`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/health-records/overdue-followups`).set(worker.auth)).status).toBe(200);

    const id = record.body.data.id;
    expect((await request(app).get(`${API}/health-records/${id}`).set(worker.auth)).body.data.medication).toBe(
      'FMD vaccine'
    );
    const updated = await request(app).put(`${API}/health-records/${id}`).set(manager.auth).send({ cost: 1500 });
    expect(updated.body.data.cost).toBe(1500);

    expect((await request(app).get(`${API}/health-records/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/health-records/9999`).set(manager.auth).send({ cost: 1 })).status).toBe(404);
    expect((await request(app).delete(`${API}/health-records/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/health-records/${id}`).set(manager.auth)).status).toBe(404);
  });

  it('tracks diseases and treatments', async () => {
    const animal = await createAnimal();
    const group = await createGroup();

    const created = await request(app).post(`${API}/diseases-treatments`).set(worker.auth).send({
      animal_id: animal.id,
      diagnosis_date: '2026-04-05',
      disease_name: 'Mastitis',
      severity: 'critical',
      status: 'ongoing',
    });
    expect(created.status).toBe(201);
    await request(app)
      .post(`${API}/diseases-treatments`)
      .set(worker.auth)
      .send({ animal_group_id: group.id, diagnosis_date: '2026-04-06', disease_name: 'Coccidiosis', status: 'chronic' })
      .expect(201);
    expect(
      (
        await request(app)
          .post(`${API}/diseases-treatments`)
          .set(worker.auth)
          .send({ diagnosis_date: '2026-04-06', disease_name: 'X' })
      ).status
    ).toBe(400);

    expect((await request(app).get(`${API}/diseases-treatments`).set(worker.auth)).body.data).toHaveLength(2);
    expect(
      (await request(app).get(`${API}/individuals/${animal.id}/diseases-treatments`).set(worker.auth)).body.data
    ).toHaveLength(1);
    expect(
      (await request(app).get(`${API}/groups/${group.id}/diseases-treatments`).set(worker.auth)).body.data
    ).toHaveLength(1);
    expect((await request(app).get(`${API}/diseases-treatments/ongoing`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/diseases-treatments/chronic`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/diseases-treatments/critical`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/diseases-treatments/statistics`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/diseases-treatments/occurrence-summary`).set(worker.auth)).status).toBe(200);

    const id = created.body.data.id;
    const resolved = await request(app)
      .put(`${API}/diseases-treatments/${id}`)
      .set(worker.auth)
      .send({ status: 'completed' });
    expect(resolved.body.data.status).toBe('completed');
    expect((await request(app).get(`${API}/diseases-treatments/${id}`).set(worker.auth)).body.data.disease_name).toBe(
      'Mastitis'
    );

    expect((await request(app).get(`${API}/diseases-treatments/9999`).set(worker.auth)).status).toBe(404);
    expect(
      (await request(app).put(`${API}/diseases-treatments/9999`).set(worker.auth).send({ notes: 'x' })).status
    ).toBe(404);
    expect((await request(app).delete(`${API}/diseases-treatments/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/diseases-treatments/${id}`).set(manager.auth)).status).toBe(404);
  });

  it('records feed and reports consumption and cost', async () => {
    const animal = await createAnimal();
    const group = await createGroup();

    const created = await request(app)
      .post(`${API}/feed-records`)
      .set(worker.auth)
      .send({
        animal_group_id: group.id,
        feed_date: daysFromToday(-1),
        feed_type: 'Layers mash',
        quantity: 50,
        unit: 'kg',
        cost: 3000,
      });
    expect(created.status).toBe(201);
    await request(app)
      .post(`${API}/feed-records`)
      .set(worker.auth)
      .send({
        animal_id: animal.id,
        feed_date: daysFromToday(-1),
        feed_type: 'Hay',
        quantity: 5,
        unit: 'kg',
        cost: 200,
      })
      .expect(201);
    expect(
      (
        await request(app)
          .post(`${API}/feed-records`)
          .set(worker.auth)
          .send({ feed_date: '2026-04-01', quantity: 1, unit: 'kg' })
      ).status
    ).toBe(400);

    expect((await request(app).get(`${API}/feed-records`).set(worker.auth)).body.data).toHaveLength(2);
    expect(
      (await request(app).get(`${API}/individuals/${animal.id}/feed-records`).set(worker.auth)).body.data
    ).toHaveLength(1);
    expect((await request(app).get(`${API}/groups/${group.id}/feed-records`).set(worker.auth)).body.data).toHaveLength(
      1
    );
    for (const path of ['statistics', 'by-feed-type', 'daily-consumption', 'cost-by-type']) {
      expect([path, (await request(app).get(`${API}/feed-records/${path}`).set(worker.auth)).status]).toEqual([
        path,
        200,
      ]);
    }
    const avg = await request(app).get(`${API}/feed-records/average-daily-cost?group_id=${group.id}`).set(worker.auth);
    expect(avg.status).toBe(200);
    expect((await request(app).get(`${API}/feed-records/average-daily-cost`).set(worker.auth)).status).toBe(400);

    const id = created.body.data.id;
    const updated = await request(app).put(`${API}/feed-records/${id}`).set(worker.auth).send({ quantity: 55 });
    expect(updated.body.data.quantity).toBe(55);
    expect((await request(app).get(`${API}/feed-records/${id}`).set(worker.auth)).body.data.feed_type).toBe(
      'Layers mash'
    );

    expect((await request(app).get(`${API}/feed-records/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/feed-records/9999`).set(worker.auth).send({ quantity: 1 })).status).toBe(
      404
    );
    expect((await request(app).delete(`${API}/feed-records/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/feed-records/${id}`).set(manager.auth)).status).toBe(404);
  });
});

describe('breeding and incubation', () => {
  it('records breeding and adds offspring to a group only once', async () => {
    const type = await createAnimalType({ name: 'Rabbit', reproduction_type: 'mammal' });
    const breed = await createBreed({ animal_type_id: type.id });
    const buck = await createAnimal({ animal_breed_id: breed.id, gender: 'male' });
    const doe = await createAnimal({ animal_breed_id: breed.id, gender: 'female' });
    const litter = await createGroup({ animal_breed_id: breed.id, quantity: 0 });

    const created = await request(app)
      .post(`${API}/breeding-records`)
      .set(worker.auth)
      .send({
        male_animal_id: buck.id,
        female_animal_id: doe.id,
        breeding_date: '2026-04-01',
        expected_delivery_date: daysFromToday(5),
      });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    expect(
      (
        await request(app)
          .post(`${API}/breeding-records`)
          .set(worker.auth)
          .send({ male_animal_id: doe.id, female_animal_id: buck.id, breeding_date: '2026-04-01' })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/breeding-records`)
          .set(worker.auth)
          .send({ male_animal_id: 9999, female_animal_id: doe.id, breeding_date: '2026-04-01' })
      ).status
    ).toBe(404);
    const otherType = await createAnimal({ gender: 'male' });
    expect(
      (
        await request(app)
          .post(`${API}/breeding-records`)
          .set(worker.auth)
          .send({ male_animal_id: otherType.id, female_animal_id: doe.id, breeding_date: '2026-04-01' })
      ).status
    ).toBe(400);

    expect((await request(app).get(`${API}/breeding-records`).set(worker.auth)).body.data).toHaveLength(1);
    expect(
      (await request(app).get(`${API}/individuals/${doe.id}/breeding-records`).set(worker.auth)).body.data
    ).toHaveLength(1);
    expect((await request(app).get(`${API}/individuals/${doe.id}/breeding-performance`).set(worker.auth)).status).toBe(
      200
    );
    expect(
      (await request(app).get(`${API}/breeding-records/expected-deliveries`).set(worker.auth)).body.data
    ).toHaveLength(1);
    for (const path of ['statistics', 'overdue-deliveries', 'success-rate-by-type']) {
      expect([path, (await request(app).get(`${API}/breeding-records/${path}`).set(worker.auth)).status]).toEqual([
        path,
        200,
      ]);
    }

    const delivery = {
      status: 'delivered',
      actual_delivery_date: '2026-05-02',
      offspring_count: 6,
      target_group_id: litter.id,
    };
    const delivered = await request(app).put(`${API}/breeding-records/${id}`).set(worker.auth).send(delivery);
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.offspring_count).toBe(6);
    expect(await groupQuantity(litter.id)).toBe(6);

    // Re-saving the same record (e.g. to edit notes) must not add the litter again
    await request(app)
      .put(`${API}/breeding-records/${id}`)
      .set(worker.auth)
      .send({ ...delivery, notes: 'healthy litter' })
      .expect(200);
    expect(await groupQuantity(litter.id)).toBe(6);

    expect((await request(app).get(`${API}/breeding-records/${id}`).set(worker.auth)).body.data.notes).toBe(
      'healthy litter'
    );
    expect((await request(app).get(`${API}/breeding-records/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/breeding-records/9999`).set(worker.auth).send({ notes: 'x' })).status).toBe(
      404
    );
    expect((await request(app).delete(`${API}/breeding-records/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/breeding-records/${id}`).set(manager.auth)).status).toBe(404);
  });

  it('tracks incubation and adds hatched chicks to a group only once', async () => {
    const type = await createAnimalType({ name: 'Chicken', reproduction_type: 'bird' });
    const breed = await createBreed({ animal_type_id: type.id });
    const brood = await createGroup({ animal_breed_id: breed.id, quantity: 10 });

    const created = await request(app)
      .post(`${API}/incubation-records`)
      .set(worker.auth)
      .send({
        animal_breed_id: breed.id,
        eggs_count: 100,
        incubation_start_date: daysFromToday(-20),
        expected_hatch_date: daysFromToday(1),
      });
    expect(created.status).toBe(201);
    expect(created.body.data.batch_code).toMatch(/^INC-/);
    const id = created.body.data.id;

    expect(
      (
        await request(app).post(`${API}/incubation-records`).set(worker.auth).send({
          animal_breed_id: 9999,
          eggs_count: 1,
          incubation_start_date: '2026-04-01',
          expected_hatch_date: '2026-04-22',
        })
      ).status
    ).toBe(404);

    expect((await request(app).get(`${API}/incubation-records`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/incubation-records/active`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/incubation-records/due-to-hatch`).set(worker.auth)).body.data).toHaveLength(
      1
    );
    for (const path of ['statistics', 'overdue', 'hatch-rate-by-breed', 'monthly-summary']) {
      expect([path, (await request(app).get(`${API}/incubation-records/${path}`).set(worker.auth)).status]).toEqual([
        path,
        200,
      ]);
    }

    const hatch = { actual_hatch_date: daysFromToday(0), hatched_count: 85, target_group_id: brood.id };
    const hatched = await request(app).put(`${API}/incubation-records/${id}`).set(worker.auth).send(hatch);
    expect(hatched.status).toBe(200);
    expect(hatched.body.data.status).toBe('partial');
    expect(await groupQuantity(brood.id)).toBe(95);

    await request(app)
      .put(`${API}/incubation-records/${id}`)
      .set(worker.auth)
      .send({ ...hatch, notes: 'good hatch' })
      .expect(200);
    expect(await groupQuantity(brood.id)).toBe(95);

    expect((await request(app).get(`${API}/groups/${brood.id}/incubation-records`).set(worker.auth)).status).toBe(200);
    expect((await request(app).get(`${API}/incubation-records/${id}`).set(worker.auth)).body.data.notes).toBe(
      'good hatch'
    );
    expect((await request(app).get(`${API}/incubation-records/9999`).set(worker.auth)).status).toBe(404);
    expect(
      (await request(app).put(`${API}/incubation-records/9999`).set(worker.auth).send({ notes: 'x' })).status
    ).toBe(404);
    expect((await request(app).delete(`${API}/incubation-records/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/incubation-records/${id}`).set(manager.auth)).status).toBe(404);
  });
});

describe('sales', () => {
  const sale = (overrides) => ({
    sale_date: '2026-06-01',
    quantity: 1,
    unit: 'head',
    unit_price: 25000,
    customer_name: 'Wanjiru',
    ...overrides,
  });

  it('selling an individual marks it sold; deleting the sale reactivates it', async () => {
    const animal = await createAnimal();
    expect(
      (
        await request(app)
          .post(`${API}/sales`)
          .set(worker.auth)
          .send(sale({ reference_type: 'animal', reference_id: animal.id }))
      ).status
    ).toBe(403);

    const created = await request(app)
      .post(`${API}/sales`)
      .set(manager.auth)
      .send(sale({ reference_type: 'animal', reference_id: animal.id }));
    expect(created.status).toBe(201);
    expect(created.body.data.total_amount).toBe(25000);
    expect(created.body.data.payment_status).toBe('paid');
    expect((await db.one('SELECT status FROM animals WHERE id = $1', [animal.id])).status).toBe('sold');

    const again = await request(app)
      .post(`${API}/sales`)
      .set(manager.auth)
      .send(sale({ reference_type: 'animal', reference_id: animal.id }));
    expect(again.status).toBe(409);

    expect((await request(app).delete(`${API}/sales/${created.body.data.id}`).set(manager.auth)).status).toBe(200);
    expect((await db.one('SELECT status FROM animals WHERE id = $1', [animal.id])).status).toBe('active');
  });

  it('selling from a group reduces it atomically; deleting the sale restores it', async () => {
    const group = await createGroup({ quantity: 30 });

    const created = await request(app)
      .post(`${API}/sales`)
      .set(manager.auth)
      .send(
        sale({
          reference_type: 'animal_group',
          reference_id: group.id,
          quantity: 10,
          unit_price: 800,
          payment_status: 'pending',
        })
      );
    expect(created.status).toBe(201);
    expect(created.body.data.total_amount).toBe(8000);
    expect(await groupQuantity(group.id)).toBe(20);

    const adjustment = await db.one("SELECT * FROM animal_group_adjustments WHERE adjustment_type = 'sale'");
    expect(adjustment).toMatchObject({ quantity: -10, reference_type: 'sale', reference_id: created.body.data.id });

    // Overselling is rejected and leaves no sale behind
    const oversell = await request(app)
      .post(`${API}/sales`)
      .set(manager.auth)
      .send(sale({ reference_type: 'animal_group', reference_id: group.id, quantity: 21 }));
    expect(oversell.status).toBe(400);
    expect((await db.one('SELECT COUNT(*)::int AS n FROM sales')).n).toBe(1);
    expect(await groupQuantity(group.id)).toBe(20);

    const id = created.body.data.id;
    expect((await request(app).get(`${API}/sales`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/sales/${id}`).set(worker.auth)).body.data.customer_name).toBe('Wanjiru');
    expect((await request(app).get(`${API}/sales/pending-payments`).set(worker.auth)).body.data).toHaveLength(1);
    for (const path of ['statistics', 'by-animal-type', 'monthly', 'top-customers', 'recent']) {
      expect([path, (await request(app).get(`${API}/sales/${path}`).set(worker.auth)).status]).toEqual([path, 200]);
    }

    const paid = await request(app)
      .put(`${API}/sales/${id}`)
      .set(manager.auth)
      .send({ payment_status: 'paid', unit_price: 900 });
    expect(paid.body.data.total_amount).toBe(9000);

    expect((await request(app).delete(`${API}/sales/${id}`).set(manager.auth)).status).toBe(200);
    expect(await groupQuantity(group.id)).toBe(30);

    await db.none("UPDATE animal_groups SET status = 'closed' WHERE id = $1", [group.id]);
    expect(
      (
        await request(app)
          .post(`${API}/sales`)
          .set(manager.auth)
          .send(sale({ reference_type: 'animal_group', reference_id: group.id }))
      ).status
    ).toBe(409);

    expect(
      (
        await request(app)
          .post(`${API}/sales`)
          .set(manager.auth)
          .send(sale({ reference_type: 'animal', reference_id: 9999 }))
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`${API}/sales`)
          .set(manager.auth)
          .send(sale({ reference_type: 'animal_group', reference_id: 9999 }))
      ).status
    ).toBe(404);
    expect((await request(app).get(`${API}/sales/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).put(`${API}/sales/9999`).set(manager.auth).send({ notes: 'x' })).status).toBe(404);
    expect((await request(app).delete(`${API}/sales/9999`).set(manager.auth)).status).toBe(404);
  });
});

describe('production', () => {
  it('manages production types and records', async () => {
    const type = await request(app)
      .post(`${API}/production/types`)
      .set(manager.auth)
      .send({ name: 'Milk', category: 'dairy', unit: 'litres', default_unit_price: 60 });
    expect(type.status).toBe(201);
    const typeId = type.body.data.id;
    expect((await request(app).post(`${API}/production/types`).set(worker.auth).send({ name: 'Eggs' })).status).toBe(
      403
    );

    const cow = await createAnimal();
    const flock = await createGroup();

    const record = await request(app)
      .post(`${API}/production/records`)
      .set(worker.auth)
      .send({
        production_type_id: typeId,
        animal_id: cow.id,
        production_date: daysFromToday(0),
        quantity: 12.5,
        unit_price: 60,
      });
    expect(record.status).toBe(201);
    expect(record.body.data.total_value).toBe(750);

    expect(
      (
        await request(app)
          .post(`${API}/production/records`)
          .set(worker.auth)
          .send({ production_type_id: typeId, production_date: daysFromToday(0), quantity: 1 })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/production/records`)
          .set(worker.auth)
          .send({
            production_type_id: typeId,
            animal_id: cow.id,
            animal_group_id: flock.id,
            production_date: daysFromToday(0),
            quantity: 1,
          })
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post(`${API}/production/records`)
          .set(worker.auth)
          .send({ production_type_id: 9999, animal_id: cow.id, production_date: daysFromToday(0), quantity: 1 })
      ).status
    ).toBe(404);

    expect((await request(app).get(`${API}/production/types`).set(worker.auth)).body.data).toHaveLength(1);
    expect((await request(app).get(`${API}/production/types/${typeId}`).set(worker.auth)).body.data.name).toBe('Milk');
    expect(
      (await request(app).put(`${API}/production/types/${typeId}`).set(manager.auth).send({ unit: 'L' })).body.data.unit
    ).toBe('L');
    expect((await request(app).get(`${API}/production/records`).set(worker.auth)).body.data).toHaveLength(1);
    for (const path of ['statistics', 'daily-summary', 'by-source']) {
      expect([path, (await request(app).get(`${API}/production/${path}`).set(worker.auth)).status]).toEqual([
        path,
        200,
      ]);
    }

    const id = record.body.data.id;
    const updated = await request(app).put(`${API}/production/records/${id}`).set(worker.auth).send({ quantity: 14 });
    expect(updated.body.data.quantity).toBe(14);

    expect((await request(app).get(`${API}/production/types/9999`).set(worker.auth)).status).toBe(404);
    expect((await request(app).get(`${API}/production/records/9999`).set(worker.auth)).status).toBe(404);
    expect(
      (await request(app).put(`${API}/production/records/9999`).set(worker.auth).send({ quantity: 1 })).status
    ).toBe(404);

    // A type with records cannot be removed
    expect((await request(app).delete(`${API}/production/types/${typeId}`).set(manager.auth)).status).toBe(409);
    expect((await request(app).delete(`${API}/production/records/${id}`).set(worker.auth)).status).toBe(403);
    expect((await request(app).delete(`${API}/production/records/${id}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/production/types/${typeId}`).set(manager.auth)).status).toBe(200);
    expect((await request(app).delete(`${API}/production/types/${typeId}`).set(manager.auth)).status).toBe(404);
  });
});
