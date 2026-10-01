const fs = require('fs');
const path = require('path');
const { db, truncateAll } = require('../helpers/db');
const { createUser } = require('../factories/user');
const { createAnimal, createGroup } = require('../factories/animal');
const { createEnterprise } = require('../factories/enterprise');

// Migration 023 moves production_records into animal_production_records and
// drops it. This suite puts the old table back, fills it, and runs the file.
const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../database/migrations/023_drop_production_records.sql'),
  'utf8'
);
// production_records as it stood before 023 (001, then 004, 013 and 016)
const OLD_TABLE = `
  CREATE TABLE production_records (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id) ON DELETE RESTRICT,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE RESTRICT,
    production_date DATE NOT NULL,
    production_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    quality_grade VARCHAR(50),
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
  )`;

describe('migration 023', () => {
  const insert = (table, row) => db.one('INSERT INTO $1:name ($2:name) VALUES ($2:csv) RETURNING *', [table, row]);
  const oldRecord = (row) =>
    insert('production_records', { production_date: '2026-02-10', quantity: 30, unit: 'count', ...row });
  const migrate = () => db.tx((t) => t.none(MIGRATION));
  const moved = () =>
    db.any(
      `SELECT pr.*, pt.name AS type_name, pt.category, pt.unit AS type_unit,
              row_to_json(a.*) AS activity
         FROM animal_production_records pr
         JOIN animal_production_types pt ON pt.id = pr.production_type_id
         JOIN activities a ON a.id = pr.activity_id
        ORDER BY pr.notes`
    );

  let user;
  let employee;
  let enterprise;
  let cow;
  let flock;
  let eggs;

  beforeEach(async () => {
    await truncateAll();
    await db.none('DROP TABLE IF EXISTS production_records');
    await db.none(OLD_TABLE);
    user = await createUser();
    employee = await insert('employees', {
      user_id: user.id,
      employee_code: 'EMP-1',
      first_name: 'Jane',
      last_name: 'Wanjiru',
      date_hired: '2025-01-01',
    });
    enterprise = await createEnterprise({ name: 'Layers', enterprise_type: 'poultry' });
    cow = await createAnimal();
    flock = await createGroup({ enterprise_id: enterprise.id });
    eggs = await insert('animal_production_types', { name: 'Chicken Eggs', category: 'eggs', unit: 'count' });
    await insert('animal_production_types', { name: 'Goat Milk', category: 'milk', unit: 'liters' });
  });

  afterAll(async () => {
    await truncateAll();
    await db.none('DROP TABLE IF EXISTS production_records');
  });

  it('moves every row, with an activity each, and drops the old table', async () => {
    await oldRecord({
      animal_group_id: flock.id,
      production_type: ' chicken eggs ',
      unit: 'COUNT',
      quantity: 87,
      quality_grade: 'A',
      recorded_by: user.id,
      notes: '1 same name and unit',
      created_at: '2026-02-10T06:00:00Z',
    });
    await oldRecord({
      animal_group_id: flock.id,
      production_type: 'Chicken Eggs',
      unit: 'trays',
      quantity: 3,
      notes: '2 same name, other unit',
    });
    await oldRecord({
      animal_id: cow.id,
      production_type: 'Rabbit droppings',
      unit: 'kg',
      quantity: 4.5,
      notes: '3 new type',
    });
    await oldRecord({
      animal_id: cow.id,
      animal_group_id: flock.id,
      production_type: 'rabbit droppings',
      unit: 'KG',
      quantity: 1,
      notes: '4 both subjects',
    });
    await oldRecord({
      animal_id: cow.id,
      production_type: 'Goat milk',
      unit: 'litres',
      quantity: 2,
      notes: '5 deleted',
      deleted_at: '2026-02-11T00:00:00Z',
    });

    await migrate();

    const exists = await db.one("SELECT to_regclass('production_records') IS NOT NULL AS exists");
    expect(exists.exists).toBe(false);

    const [same, otherUnit, newType, both, deleted] = await moved();
    expect(same).toMatchObject({
      production_type_id: eggs.id,
      animal_group_id: flock.id,
      animal_id: null,
      quantity: 87,
      quality_grade: 'A',
      recorded_by: user.id,
    });
    expect(same.activity).toMatchObject({
      activity_type: 'production',
      status: 'done',
      title: 'Chicken Eggs 87 count',
      occurred_on: '2026-02-10',
      animal_group_id: flock.id,
      enterprise_id: enterprise.id,
      recorded_by: user.id,
      performed_by: employee.id,
      deleted_at: null,
    });
    expect(new Date(same.activity.created_at).toISOString()).toBe('2026-02-10T06:00:00.000Z');

    expect(otherUnit).toMatchObject({ type_name: 'Chicken Eggs (trays)', category: 'eggs', type_unit: 'trays' });
    expect(otherUnit.activity.title).toBe('Chicken Eggs (trays) 3 trays');

    expect(newType).toMatchObject({ type_name: 'Rabbit droppings', category: 'other', type_unit: 'kg' });
    expect(both).toMatchObject({
      production_type_id: newType.production_type_id,
      animal_id: cow.id,
      animal_group_id: null,
    });
    expect(both.activity).toMatchObject({ animal_id: cow.id, animal_group_id: null });

    expect(deleted).toMatchObject({ type_name: 'Goat milk (litres)', category: 'milk' });
    expect(deleted.deleted_at).not.toBeNull();
    expect(deleted.activity.deleted_at).not.toBeNull();
  });

  it('names a new type by its unit when the old rows use the name with several units', async () => {
    await oldRecord({ animal_id: cow.id, production_type: 'Manure', unit: 'kg', notes: '1' });
    await oldRecord({ animal_id: cow.id, production_type: 'manure', unit: 'bags', notes: '2' });

    await migrate();

    expect((await moved()).map((row) => [row.type_name, row.type_unit])).toEqual([
      ['Manure (kg)', 'kg'],
      ['manure (bags)', 'bags'],
    ]);
  });

  it('stops, changing nothing, when a row has no type in its unit to go to', async () => {
    // "Chicken Eggs (trays)" is taken, but counted in something else
    await insert('animal_production_types', { name: 'Chicken eggs (TRAYS)', category: 'eggs', unit: 'crates' });
    await oldRecord({ animal_group_id: flock.id, production_type: 'Chicken Eggs', unit: 'trays' });

    await expect(migrate()).rejects.toThrow(/no production type to move these to .*: Chicken Eggs \(trays\)/);
    expect(await db.one('SELECT count(*)::int AS n FROM production_records')).toEqual({ n: 1 });
    expect(await db.one('SELECT count(*)::int AS n FROM activities')).toEqual({ n: 0 });
  });

  it('drops an empty old table', async () => {
    await migrate();
    expect(await db.one('SELECT count(*)::int AS n FROM animal_production_records')).toEqual({ n: 0 });
    expect((await db.one("SELECT to_regclass('production_records') AS t")).t).toBeNull();
  });
});
