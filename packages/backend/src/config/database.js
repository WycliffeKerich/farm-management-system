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

module.exports = {
  db,
  pgp,
  testConnection,
};
