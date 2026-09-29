const { db } = require('../../src/config/database');

/**
 * Empty every table (except the migration log) and reset sequences.
 * Call in beforeEach of integration suites for full isolation.
 */
async function truncateAll() {
  if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
    throw new Error('truncateAll may only run against a *_test database');
  }
  const tables = await db.map(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
    [],
    (row) => row.tablename
  );
  if (tables.length === 0) return;
  await db.none('TRUNCATE TABLE $1:name RESTART IDENTITY CASCADE', [tables]);
}

module.exports = { db, truncateAll };
