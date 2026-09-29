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

/**
 * Run a callback inside a transaction.
 * Sets `app.user_id` for the duration of the transaction so database-level
 * auditing (Phase 5) can attribute changes to the acting user.
 * @param {number|null} userId - Acting user ID (may be null for system actions)
 * @param {Function} fn - async (t) => result
 * @returns {Promise<*>} Result of fn
 */
async function withTx(userId, fn) {
  return db.tx(async (t) => {
    if (userId) {
      await t.func('set_config', ['app.user_id', String(userId), true]);
    }
    return fn(t);
  });
}

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
  withTx,
  closeDatabase,
};
