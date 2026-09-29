const BaseRepository = require('../../src/repositories/base.repository');
const { db, truncateAll } = require('../helpers/db');
const { ValidationError, NotFoundError } = require('../../src/utils/errors');

describe('BaseRepository', () => {
  const cropTypes = new BaseRepository('crop_types', {
    sortable: ['name', 'created_at'],
  });

  beforeEach(truncateAll);

  describe('create', () => {
    it('inserts whitelisted columns and ignores unknown or protected keys', async () => {
      const row = await cropTypes.create({
        name: 'Maize',
        category: 'cereal',
        id: 999,
        created_at: '2000-01-01',
        not_a_column: 'x',
      });

      expect(row.id).not.toBe(999);
      expect(row.name).toBe('Maize');
      expect(row.created_at.getFullYear()).not.toBe(2000);
      expect(row).not.toHaveProperty('not_a_column');
    });

    it('respects an explicit columns whitelist', async () => {
      const strict = new BaseRepository('crop_types', {
        columns: ['name', 'category'],
      });
      const row = await strict.create({
        name: 'Beans',
        category: 'legume',
        description: 'ignored',
      });
      expect(row.description).toBeNull();
    });

    it('treats hostile keys as unknown columns instead of SQL', async () => {
      const row = await cropTypes.create({
        name: 'Rice',
        category: 'cereal',
        'description) VALUES (1); DROP TABLE users; --': 'x',
      });
      expect(row.name).toBe('Rice');
      const users = await db.one("SELECT to_regclass('public.users') IS NOT NULL AS present");
      expect(users.present).toBe(true);
    });

    it('rejects data with no writable fields', async () => {
      await expect(cropTypes.create({ bogus: 1 })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('update', () => {
    it('updates writable fields and bumps updated_at', async () => {
      const created = await cropTypes.create({
        name: 'Maize',
        category: 'cereal',
      });
      await db.none("UPDATE crop_types SET updated_at = NOW() - INTERVAL '1 day' WHERE id = $1", [created.id]);

      const updated = await cropTypes.update(created.id, {
        description: 'Staple',
        id: 5,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.description).toBe('Staple');
      expect(updated.updated_at.getTime()).toBeGreaterThan(Date.now() - 60 * 1000);
    });

    it('works on tables without updated_at', async () => {
      const groupId = await createAnimalGroup();
      const adjustments = new BaseRepository('animal_group_adjustments');
      const adj = await adjustments.create({
        animal_group_id: groupId,
        adjustment_date: '2026-01-01',
        adjustment_type: 'addition',
        quantity: 5,
        quantity_before: 0,
        quantity_after: 5,
        unit_value: '12.50',
      });

      expect(adj.unit_value).toBe(12.5); // NUMERIC parsed to number
      const updated = await adjustments.update(adj.id, { notes: 'checked' });
      expect(updated.notes).toBe('checked');
    });

    it('throws NotFoundError for missing or soft-deleted rows', async () => {
      await expect(cropTypes.update(12345, { name: 'x' })).rejects.toBeInstanceOf(NotFoundError);

      const created = await cropTypes.create({
        name: 'Maize',
        category: 'cereal',
      });
      await cropTypes.softDelete(created.id);
      await expect(cropTypes.update(created.id, { name: 'y' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('queries', () => {
    beforeEach(async () => {
      await cropTypes.create({ name: 'Maize', category: 'cereal' });
      await cropTypes.create({ name: 'Beans', category: 'legume' });
      const deleted = await cropTypes.create({
        name: 'Wheat',
        category: 'cereal',
      });
      await cropTypes.softDelete(deleted.id);
    });

    it('findAll filters and hides soft-deleted rows', async () => {
      const cereals = await cropTypes.findAll({ category: 'cereal' });
      expect(cereals.map((r) => r.name)).toEqual(['Maize']);
    });

    it('supports null and array filters', async () => {
      expect(await cropTypes.count({ description: null })).toBe(2);
      expect(await cropTypes.count({ name: ['Maize', 'Beans', 'Wheat'] })).toBe(2);
    });

    it('rejects unknown filter fields', async () => {
      await expect(cropTypes.findAll({ '1=1 OR name': 'x' })).rejects.toBeInstanceOf(ValidationError);
    });

    it('findOne, count and exists', async () => {
      expect((await cropTypes.findOne({ name: 'Beans' })).category).toBe('legume');
      expect(await cropTypes.count()).toBe(2);
      expect(await cropTypes.exists({ name: 'Wheat' })).toBe(false);
    });

    it('paginates with whitelisted sort only', async () => {
      const page = await cropTypes.paginate(1, 1, {}, { field: 'name', order: 'asc' });
      expect(page.data.map((r) => r.name)).toEqual(['Beans']);
      expect(page.pagination).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      });

      await expect(cropTypes.paginate(1, 10, {}, 'description ASC')).rejects.toBeInstanceOf(ValidationError);
      await expect(cropTypes.paginate(1, 10, {}, 'name; DROP TABLE users')).rejects.toBeInstanceOf(ValidationError);
      await expect(cropTypes.paginate(1, 10, {}, { field: 'name', order: 'sideways' })).rejects.toBeInstanceOf(
        ValidationError
      );
    });
  });

  describe('transactions', () => {
    it('runs inside a caller-provided transaction', async () => {
      await expect(
        db.tx(async (t) => {
          await cropTypes.create({ name: 'Maize', category: 'cereal' }, t);
          expect(await cropTypes.count({}, t)).toBe(1);
          throw new Error('rollback');
        })
      ).rejects.toThrow('rollback');

      expect(await cropTypes.count()).toBe(0);
    });
  });

  describe('delete', () => {
    it('softDelete and delete report whether a row was affected', async () => {
      const row = await cropTypes.create({ name: 'Maize', category: 'cereal' });
      expect(await cropTypes.softDelete(row.id)).toBe(true);
      expect(await cropTypes.softDelete(row.id)).toBe(false);
      expect(await cropTypes.delete(row.id)).toBe(true);
      expect(await cropTypes.delete(row.id)).toBe(false);
    });
  });
});

async function createAnimalGroup() {
  const type = await db.one("INSERT INTO animal_types (name, category) VALUES ('Chicken', 'poultry') RETURNING id");
  const breed = await db.one("INSERT INTO animal_breeds (animal_type_id, name) VALUES ($1, 'Kienyeji') RETURNING id", [
    type.id,
  ]);
  const group = await db.one(
    "INSERT INTO animal_groups (group_code, name, animal_breed_id, quantity, date_established, status) VALUES ('G-1', 'Flock', $1, 0, CURRENT_DATE, 'active') RETURNING id",
    [breed.id]
  );
  return group.id;
}
