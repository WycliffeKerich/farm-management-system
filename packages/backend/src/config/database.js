const { AsyncLocalStorage } = require('node:async_hooks');
const pgPromise = require('pg-promise');

/**
 * Database configuration and connection setup
 */

const initOptions = {
  // Initialization options
  error(error, e) {
    if (e.cn) {
      // A connection-related error
      console.error('Database connection error:', error.message || error);
    }
  },
};

const pgp = pgPromise(initOptions);

// Return NUMERIC/DECIMAL (OID 1700) and BIGINT/COUNT(*) (OID 20) as JS numbers
// instead of strings, so arithmetic and comparisons behave as expected.
// NUMERIC(14,2) money values are well within double precision.
pgp.pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));
pgp.pg.types.setTypeParser(20, (value) => (value === null ? null : parseInt(value, 10)));

// Keep DATE (OID 1082) as a 'YYYY-MM-DD' string. The default parser builds a
// local-midnight Date, which serialises to the previous day in UTC for any
// server east of Greenwich (e.g. EAT, UTC+3).
pgp.pg.types.setTypeParser(1082, (value) => value);

// Database connection configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'farm_management',
  user: process.env.DB_USER || 'farm_admin',
  password: process.env.DB_PASSWORD || 'farm_password_dev',
  max: 30, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
};

// Create database instance
const db = pgp(config);

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection is successful
 */
async function testConnection() {
  try {
    await db.one('SELECT 1 as test');
    console.log('✓ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
}

// The user a request acts for, so the audit trigger (migration 020) can say
// who made each change. authenticate() runs the rest of the request inside it.
const actingUser = new AsyncLocalStorage();

/**
 * Run fn (and everything it awaits) as the given user
 * @param {number|null} userId - Acting user ID (null for system actions)
 * @param {Function} fn
 * @returns {*} Result of fn
 */
function runAsUser(userId, fn) {
  return actingUser.run({ userId }, fn);
}

/**
 * The user the current request acts for
 * @returns {number|null}
 */
function currentUserId() {
  return actingUser.getStore()?.userId ?? null;
}

// SET LOCAL lasts until the end of the transaction. A query sent on its own
// is its own transaction, and so are several statements sent as one string.
const setUserSql = (userId) => `SELECT set_config('app.user_id', '${Math.trunc(Number(userId))}', true);`;

// Queries straight on the pool name the user in the same round trip
const poolQuery = db.query;
db.query = function query(text, values, qrm) {
  const userId = currentUserId();
  const named = userId && typeof text === 'string' ? `${setUserSql(userId)}\n${text}` : text;
  return poolQuery.call(this, named, values, qrm);
};

// Transactions name the user first; their queries run on the transaction
const poolTx = db.tx;
db.tx = function tx(...args) {
  const userId = currentUserId();
  const callback = args.pop();
  if (!userId || typeof callback !== 'function') {
    return poolTx.call(this, ...args, callback);
  }
  return poolTx.call(this, ...args, async function asUser(t) {
    await t.any(setUserSql(userId));
    return callback.call(this, t);
  });
};

/**
 * Close all pool connections (used by tests and scripts)
 */
function closeDatabase() {
  pgp.end();
}

module.exports = {
  db,
  pgp,
  testConnection,
  runAsUser,
  currentUserId,
  closeDatabase,
};
