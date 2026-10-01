const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createEnterprise } = require('../factories/enterprise');
const { createBatch } = require('../factories/crop');

let owner;
let manager;

beforeEach(async () => {
  await truncateAll();
  owner = await loginAs(app, 'owner');
  manager = await loginAs(app, 'manager');
});

const call = (method, path, body, session = manager) =>
  request(app)[method](`/api/v1${path}`).set(session.auth).send(body);
const auditLog = (query = '', session = owner) => request(app).get(`/api/v1/audit-log${query}`).set(session.auth);
const rowsFor = (table, recordId) =>
  db.any('SELECT * FROM audit_log WHERE table_name = $1 AND record_id = $2 ORDER BY id', [table, recordId]);

describe('the audit trigger', () => {
  it('records inserts, updates and soft deletes with who made them', async () => {
    const created = (await call('post', '/enterprises', { name: 'Layers', enterprise_type: 'poultry' })).body.data;
    await call('put', `/enterprises/${created.id}`, { unit_of_output: 'tray' });
    await call('delete', `/enterprises/${created.id}`);

    const rows = await rowsFor('enterprises', created.id);
    expect(rows.map((row) => row.action)).toEqual(['insert', 'update', 'soft_delete']);
    expect(rows.every((row) => row.changed_by === manager.user.id)).toBe(true);

    const [insert, update] = rows;
    expect(insert.before).toBeNull();
    expect(insert.after).toMatchObject({ id: created.id, name: 'Layers', unit_of_output: null });
    expect(update.before.unit_of_output).toBeNull();
    expect(update.after.unit_of_output).toBe('tray');
  });

  it('attributes every row written in a transaction to the acting user', async () => {
    const batch = await createBatch();
    const observed = await call('post', `/crops/batches/${batch.id}/observations`, { observation_date: '2026-03-01' });
    expect(observed.status).toBe(201);

    const [activity] = await rowsFor('activities', observed.body.data.activity_id);
    const [observation] = await rowsFor('growth_observations', observed.body.data.id);
    expect(activity).toMatchObject({ action: 'insert', changed_by: manager.user.id });
    expect(observation).toMatchObject({ action: 'insert', changed_by: manager.user.id });
  });

  it('keeps users apart when their requests overlap', async () => {
    const [mine, theirs] = await Promise.all([
      call('post', '/enterprises', { name: 'Dairy', enterprise_type: 'dairy' }, owner),
      call('post', '/enterprises', { name: 'Apiary', enterprise_type: 'apiculture' }, manager),
    ]);
    expect((await rowsFor('enterprises', mine.body.data.id))[0].changed_by).toBe(owner.user.id);
    expect((await rowsFor('enterprises', theirs.body.data.id))[0].changed_by).toBe(manager.user.id);
  });

  it('writes outside a request have no user; changes to nothing but updated_at are not logged', async () => {
    const enterprise = await createEnterprise();
    await db.none('UPDATE enterprises SET updated_at = now() WHERE id = $1', [enterprise.id]);
    await db.none('DELETE FROM enterprises WHERE id = $1', [enterprise.id]);

    const rows = await rowsFor('enterprises', enterprise.id);
    expect(rows.map((row) => [row.action, row.changed_by])).toEqual([
      ['insert', null],
      ['delete', null],
    ]);
    expect(rows[1].before.name).toBe(enterprise.name);
    expect(rows[1].after).toBeNull();
  });

  it('logs role changes but never the password hash or login bookkeeping', async () => {
    const worker = await loginAs(app, 'worker');
    expect((await call('put', `/users/${worker.user.id}`, { role: 'manager' }, owner)).status).toBe(200);

    const rows = await rowsFor('users', worker.user.id);
    // The login itself (last_login, failed_login_count) leaves no row
    expect(rows.map((row) => row.action)).toEqual(['insert', 'update']);
    expect(rows[1]).toMatchObject({ changed_by: owner.user.id });
    expect(rows[1].after.role).toBe('manager');
    for (const row of rows) {
      expect(row.after).not.toHaveProperty('password_hash');
      expect(row.after).not.toHaveProperty('last_login');
    }
  });
});

describe('GET /audit-log', () => {
  it('pages one record’s history with the changed fields and who changed them', async () => {
    const enterprise = (await call('post', '/enterprises', { name: 'Layers', enterprise_type: 'poultry' })).body.data;
    await call('put', `/enterprises/${enterprise.id}`, { unit_of_output: 'tray', description: 'Shed 2' });
    await call('post', '/enterprises', { name: 'Dairy', enterprise_type: 'dairy' }, owner);

    const history = await auditLog(`?table=enterprises&record_id=${enterprise.id}`);
    expect(history.status).toBe(200);
    expect(history.body.data.map((row) => row.action)).toEqual(['update', 'insert']);
    expect(history.body.data[0]).toMatchObject({
      changed_by: manager.user.id,
      changed_by_name: `${manager.user.first_name} ${manager.user.last_name}`,
      changed_fields: ['description', 'unit_of_output'],
    });
    expect(history.body.data[1].changed_fields).toBeNull();
    expect(history.body.pagination).toMatchObject({ page: 1, total: 2 });

    const oldestFirst = await auditLog(`?table=enterprises&record_id=${enterprise.id}&order=asc&limit=1`);
    expect(oldestFirst.body.data.map((row) => row.action)).toEqual(['insert']);
    expect(oldestFirst.body.pagination).toMatchObject({ total: 2, totalPages: 2 });

    expect((await auditLog(`?table=enterprises&changed_by=${owner.user.id}`)).body.data).toHaveLength(1);
    expect((await auditLog('?table=enterprises&action=update')).body.data).toHaveLength(1);
    expect((await auditLog('?table=enterprises&action=insert&action=update')).body.data).toHaveLength(3);
    expect((await auditLog('?table=enterprises&date_to=2000-01-01')).body.data).toHaveLength(0);
  });

  it('is for the owner only, and checks its filters', async () => {
    const worker = await loginAs(app, 'worker');
    expect((await auditLog('', manager)).status).toBe(403);
    expect((await auditLog('', worker)).status).toBe(403);
    expect((await request(app).get('/api/v1/audit-log')).status).toBe(401);

    expect((await auditLog('?action=truncate')).status).toBe(400);
    expect((await auditLog('?table=users;drop')).status).toBe(400);
    expect((await auditLog('?record_id=abc')).status).toBe(400);
    expect((await auditLog('?date_from=yesterday')).status).toBe(400);
  });
});
