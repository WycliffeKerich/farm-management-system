const request = require('supertest');
const app = require('../../src/app');
const AuthService = require('../../src/services/auth.service');
const { db, truncateAll } = require('../helpers/db');
const { createUser, loginAs } = require('../factories/user');
const { resetRateLimits } = require('../../src/middleware/rate-limit.middleware');

const REFRESH_COOKIE = 'rt';

function refreshCookie(res) {
  const cookies = res.headers['set-cookie'] || [];
  return cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
}

function cookieValue(setCookie) {
  return setCookie.split(';')[0].split('=')[1];
}

beforeEach(async () => {
  await truncateAll();
  resetRateLimits();
});

describe('bootstrap', () => {
  const owner = {
    email: 'Owner@Farm.test',
    password: 'a-strong-password',
    first_name: 'Olive',
    last_name: 'Owner',
  };

  it('creates the first owner once, then refuses', async () => {
    expect((await request(app).get('/api/v1/auth/bootstrap')).body.data.needsSetup).toBe(true);

    const first = await request(app)
      .post('/api/v1/auth/bootstrap')
      .send({ ...owner, role: 'worker' });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ email: 'owner@farm.test', role: 'owner' });
    expect(first.body.data).not.toHaveProperty('password_hash');

    const second = await request(app)
      .post('/api/v1/auth/bootstrap')
      .send({ ...owner, email: 'other@farm.test' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_BOOTSTRAPPED');
    expect((await request(app).get('/api/v1/auth/bootstrap')).body.data.needsSetup).toBe(false);
  });

  it('only one of several concurrent attempts succeeds', async () => {
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        request(app)
          .post('/api/v1/auth/bootstrap')
          .send({ ...owner, email: `owner${n}@farm.test` })
      )
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it('rejects short passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/bootstrap')
      .send({ ...owner, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'password' })]);
  });
});

describe('public registration', () => {
  it('no longer exists', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@farm.test', password: 'a-strong-password', first_name: 'X', last_name: 'Y', role: 'owner' });
    expect(res.status).toBe(404);
  });
});

describe('login', () => {
  it('returns an access token and sets a scoped httpOnly refresh cookie', async () => {
    const user = await createUser({ email: 'mary@farm.test' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'MARY@farm.test', password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ id: user.id, email: 'mary@farm.test' });
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data).not.toHaveProperty('refreshToken');

    const cookie = refreshCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const stored = await db.one('SELECT token_hash FROM user_sessions WHERE user_id = $1', [user.id]);
    expect(stored.token_hash).not.toBe(cookieValue(cookie));
  });

  it('gives the same error for unknown email and wrong password', async () => {
    const user = await createUser();
    const unknown = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@farm.test', password: 'x' });
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-password' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toEqual(wrong.body.error);
  });

  it('rejects deactivated accounts only after a correct password', async () => {
    const user = await createUser({ is_active: false });
    const wrong = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-password' });
    const right = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });

    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(right.status).toBe(401);
    expect(right.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('rate limits the 6th attempt for the same email from the same IP', async () => {
    const user = await createUser();
    const attempt = () =>
      request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'wrong-password' });

    for (let i = 0; i < 5; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const sixth = await attempt();
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('RATE_LIMITED');

    // Other accounts are unaffected
    const other = await createUser();
    const ok = await request(app).post('/api/v1/auth/login').send({ email: other.email, password: other.password });
    expect(ok.status).toBe(200);
  });

  it('locks the account after 10 failures, even with the right password', async () => {
    const user = await createUser();
    const service = new AuthService();

    for (let i = 0; i < 10; i += 1) {
      await expect(service.login(user.email, 'wrong-password')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    }
    await expect(service.login(user.email, user.password)).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });

    await db.none("UPDATE users SET locked_until = NOW() - INTERVAL '1 second' WHERE id = $1", [user.id]);
    await expect(service.login(user.email, user.password)).resolves.toHaveProperty('accessToken');
  });
});

describe('refresh token rotation', () => {
  it('rotates the refresh cookie and returns a new access token', async () => {
    const { agent, user } = await loginAs(app);

    const res = await agent.post('/api/v1/auth/refresh');

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeDefined();

    // Access token works
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const user = await createUser();
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    const original = refreshCookie(login).split(';')[0];

    const rotated = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
    expect(rotated.status).toBe(200);
    const next = refreshCookie(rotated).split(';')[0];

    // Pretend the grace window has passed, then replay the old token (as a thief would)
    await db.none("UPDATE user_sessions SET last_used_at = NOW() - INTERVAL '1 minute'");
    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // The legitimate holder's newer token is dead too
    const legit = await request(app).post('/api/v1/auth/refresh').set('Cookie', next);
    expect(legit.status).toBe(401);

    const active = await db.one('SELECT COUNT(*) AS n FROM user_sessions WHERE revoked_at IS NULL');
    expect(active.n).toBe(0);
  });

  it('tolerates a near-simultaneous double refresh (two tabs)', async () => {
    const user = await createUser();
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    const original = refreshCookie(login).split(';')[0];

    const first = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);
    const second = await request(app).post('/api/v1/auth/refresh').set('Cookie', original);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('rejects missing, unknown and expired tokens', async () => {
    expect((await request(app).post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', 'rt=garbage')).status).toBe(401);

    const { agent } = await loginAs(app);
    await db.none("UPDATE user_sessions SET expires_at = NOW() - INTERVAL '1 second'");
    const res = await agent.post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});

describe('logout', () => {
  it('revokes the session without needing an access token', async () => {
    const { agent } = await loginAs(app);

    const res = await agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(200);

    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
  });

  it('logout-all revokes every device', async () => {
    const { user, auth, agent } = await loginAs(app);
    const secondDevice = request.agent(app);
    await secondDevice.post('/api/v1/auth/login').send({ email: user.email, password: user.password });

    expect((await request(app).post('/api/v1/auth/logout-all').set(auth)).status).toBe(200);

    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await secondDevice.post('/api/v1/auth/refresh')).status).toBe(401);
  });
});

describe('access tokens', () => {
  it('stop working as soon as the user is deactivated', async () => {
    const { user, auth } = await loginAs(app);
    await db.none('UPDATE users SET is_active = false WHERE id = $1', [user.id]);

    const res = await request(app).get('/api/v1/auth/me').set(auth);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('reject tampered tokens', async () => {
    const { token } = await loginAs(app);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token.slice(0, -2)}xx`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('profile', () => {
  it('only updates name and phone', async () => {
    const { user, auth } = await loginAs(app, 'worker');

    const res = await request(app).put('/api/v1/auth/me').set(auth).send({
      first_name: 'New',
      role: 'owner',
      is_active: false,
      email: 'hijack@farm.test',
      password_hash: 'x',
    });

    expect(res.status).toBe(200);
    const row = await db.one('SELECT * FROM users WHERE id = $1', [user.id]);
    expect(row).toMatchObject({ first_name: 'New', role: 'worker', is_active: true, email: user.email });
    expect(row.password_hash).toBe(user.password_hash);
  });
});

describe('change password', () => {
  it('requires the current password and signs out other devices', async () => {
    const { user, auth, agent } = await loginAs(app);
    const otherDevice = request.agent(app);
    await otherDevice.post('/api/v1/auth/login').send({ email: user.email, password: user.password });

    const wrong = await agent
      .put('/api/v1/auth/change-password')
      .set(auth)
      .send({
        currentPassword: 'nope',
        newPassword: 'another-good-password',
        confirmPassword: 'another-good-password',
      });
    expect(wrong.status).toBe(401);

    const res = await agent.put('/api/v1/auth/change-password').set(auth).send({
      currentPassword: user.password,
      newPassword: 'another-good-password',
      confirmPassword: 'another-good-password',
    });
    expect(res.status).toBe(200);

    expect((await otherDevice.post('/api/v1/auth/refresh')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'another-good-password' });
    expect(login.status).toBe(200);
  });
});

describe('password reset', () => {
  it('always answers 200 for forgot-password', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@farm.test' });
    expect(res.status).toBe(200);
  });

  it('resets once with a valid token and revokes sessions', async () => {
    const { user, agent } = await loginAs(app);
    const token = await new AuthService().forgotPassword(user.email);

    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'a-brand-new-password' });
    expect(res.status).toBe(200);

    const reuse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'yet-another-password' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');

    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'a-brand-new-password' });
    expect(login.status).toBe(200);
  });

  it('rejects expired tokens and invalidates older tokens when a new one is issued', async () => {
    const user = await createUser();
    const service = new AuthService();
    const older = await service.forgotPassword(user.email);
    const newer = await service.forgotPassword(user.email);

    const withOlder = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: older, password: 'a-brand-new-password' });
    expect(withOlder.status).toBe(400);

    await db.none("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 second'");
    const withExpired = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: newer, password: 'a-brand-new-password' });
    expect(withExpired.status).toBe(400);
  });

  it('clears an account lock', async () => {
    const user = await createUser({ locked_until: new Date(Date.now() + 60 * 60 * 1000) });
    const token = await new AuthService().forgotPassword(user.email);
    await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'a-brand-new-password' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'a-brand-new-password' });
    expect(login.status).toBe(200);
  });
});
