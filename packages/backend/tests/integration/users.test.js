const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { createUser, loginAs } = require('../factories/user');
const { resetRateLimits } = require('../../src/middleware/rate-limit.middleware');

let owner;

beforeEach(async () => {
  await truncateAll();
  resetRateLimits();
  owner = await loginAs(app, 'owner');
});

describe('access', () => {
  it.each(['manager', 'worker'])('is forbidden for %s', async (role) => {
    const { auth } = await loginAs(app, role);
    const res = await request(app).get('/api/v1/users').set(auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/users')).status).toBe(401);
  });
});

describe('create and list', () => {
  const newUser = {
    email: 'New.Worker@farm.test',
    password: 'initial-password',
    first_name: 'New',
    last_name: 'Worker',
    role: 'worker',
  };

  it('creates a user who can then log in', async () => {
    const res = await request(app).post('/api/v1/users').set(owner.auth).send(newUser);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'new.worker@farm.test', role: 'worker', is_active: true });
    expect(res.body.data).not.toHaveProperty('password_hash');

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newUser.email, password: newUser.password });
    expect(login.status).toBe(200);
  });

  it('rejects duplicate emails regardless of case', async () => {
    await request(app).post('/api/v1/users').set(owner.auth).send(newUser);
    const res = await request(app)
      .post('/api/v1/users')
      .set(owner.auth)
      .send({ ...newUser, email: 'NEW.worker@FARM.test' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE');
  });

  it('validates role and password', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set(owner.auth)
      .send({ ...newUser, role: 'admin', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(['password', 'role']);
  });

  it('filters the list by role and search', async () => {
    await createUser({ role: 'manager', first_name: 'Grace' });
    await createUser({ role: 'worker', first_name: 'Otieno' });

    const managers = await request(app).get('/api/v1/users?role=manager').set(owner.auth);
    expect(managers.body.data.map((u) => u.first_name)).toEqual(['Grace']);

    const search = await request(app).get('/api/v1/users?search=otie').set(owner.auth);
    expect(search.body.data.map((u) => u.first_name)).toEqual(['Otieno']);

    const all = await request(app).get('/api/v1/users').set(owner.auth);
    expect(all.body.data).toHaveLength(3);
    all.body.data.forEach((u) => expect(u).not.toHaveProperty('password_hash'));
  });

  it('returns a user with their active sessions', async () => {
    const res = await request(app).get(`/api/v1/users/${owner.user.id}`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.sessions).toHaveLength(1);
    expect(res.body.data.sessions[0]).not.toHaveProperty('token_hash');

    expect((await request(app).get('/api/v1/users/999999').set(owner.auth)).status).toBe(404);
  });
});

describe('update', () => {
  it('changes role and details', async () => {
    const worker = await createUser({ role: 'worker' });
    const res = await request(app)
      .put(`/api/v1/users/${worker.id}`)
      .set(owner.auth)
      .send({ role: 'manager', phone: '+254700000000', password_hash: 'ignored' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'manager', phone: '+254700000000' });
    const row = await db.one('SELECT password_hash FROM users WHERE id = $1', [worker.id]);
    expect(row.password_hash).toBe(worker.password_hash);
  });

  it('deactivation signs the user out immediately', async () => {
    const worker = await loginAs(app, 'worker');

    const res = await request(app).put(`/api/v1/users/${worker.user.id}`).set(owner.auth).send({ is_active: false });
    expect(res.status).toBe(200);

    expect((await request(app).get('/api/v1/auth/me').set(worker.auth)).status).toBe(401);
    expect((await worker.agent.post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('never demotes or deactivates the last active owner', async () => {
    const demote = await request(app).put(`/api/v1/users/${owner.user.id}`).set(owner.auth).send({ role: 'manager' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('LAST_OWNER');

    const deactivate = await request(app)
      .put(`/api/v1/users/${owner.user.id}`)
      .set(owner.auth)
      .send({ is_active: false });
    expect(deactivate.status).toBe(409);

    // With a second owner it is allowed
    const second = await createUser({ role: 'owner' });
    const ok = await request(app).put(`/api/v1/users/${second.id}`).set(owner.auth).send({ role: 'manager' });
    expect(ok.status).toBe(200);
  });

  it('rejects taking another user’s email', async () => {
    const a = await createUser();
    const b = await createUser();
    const res = await request(app).put(`/api/v1/users/${b.id}`).set(owner.auth).send({ email: a.email.toUpperCase() });
    expect(res.status).toBe(409);
  });
});

describe('password and sessions', () => {
  it('setting a password signs the user out and unlocks them', async () => {
    const worker = await loginAs(app, 'worker');
    await db.none("UPDATE users SET locked_until = NOW() + INTERVAL '1 hour' WHERE id = $1", [worker.user.id]);

    const res = await request(app)
      .put(`/api/v1/users/${worker.user.id}/password`)
      .set(owner.auth)
      .send({ password: 'owner-chosen-password' });
    expect(res.status).toBe(200);

    expect((await worker.agent.post('/api/v1/auth/refresh')).status).toBe(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: worker.user.email, password: 'owner-chosen-password' });
    expect(login.status).toBe(200);
  });

  it('revokes all sessions for a user', async () => {
    const worker = await loginAs(app, 'worker');

    const res = await request(app).delete(`/api/v1/users/${worker.user.id}/sessions`).set(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.revoked).toBe(1);
    expect((await worker.agent.post('/api/v1/auth/refresh')).status).toBe(401);
  });
});
