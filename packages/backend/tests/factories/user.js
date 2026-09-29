const bcrypt = require('bcryptjs');
const request = require('supertest');
const { db } = require('../../src/config/database');

const DEFAULT_PASSWORD = 'correct-horse-battery';
let sequence = 0;

/**
 * Insert a user directly
 * @param {Object} [overrides] - Column overrides; `password` is hashed
 * @returns {Promise<Object>} User row plus the plain `password`
 */
async function createUser(overrides = {}) {
  sequence += 1;
  const { password = DEFAULT_PASSWORD, ...columns } = overrides;
  const row = await db.one(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
     VALUES ($<email>, $<password_hash>, $<first_name>, $<last_name>, $<role>, $<is_active>)
     RETURNING *`,
    {
      email: `user${sequence}.${Date.now()}@farm.test`,
      first_name: 'Test',
      last_name: `User${sequence}`,
      role: 'worker',
      is_active: true,
      ...columns,
      password_hash: await bcrypt.hash(password, 4),
    }
  );
  return { ...row, password };
}

/**
 * Create a user and log in through the API
 * @param {Object} app - Express app
 * @param {string|Object} roleOrOverrides - Role name or createUser overrides
 * @returns {Promise<{user: Object, token: string, agent: Object, auth: Object}>}
 *   `agent` keeps the refresh cookie; `auth` is the Authorization header object
 */
async function loginAs(app, roleOrOverrides = 'worker') {
  const overrides = typeof roleOrOverrides === 'string' ? { role: roleOrOverrides } : roleOrOverrides;
  const user = await createUser(overrides);
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email: user.email, password: user.password });
  if (res.status !== 200) {
    throw new Error(`loginAs failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const token = res.body.data.accessToken;
  return { user, token, agent, auth: { Authorization: `Bearer ${token}` } };
}

module.exports = { createUser, loginAs, DEFAULT_PASSWORD };
