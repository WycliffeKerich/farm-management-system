/**
 * Recreate the test database from scratch and apply every migration.
 * Runs once per `jest` invocation, so the schema always matches the migrations on disk.
 */
require('./env');
const pgPromise = require('pg-promise');
const { migrate } = require('../../src/database/migrator');

module.exports = async function globalSetup() {
  const pgp = pgPromise();
  const connection = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
  const dbName = process.env.DB_NAME;

  try {
    const admin = pgp({ ...connection, database: 'postgres' });
    await admin.none('DROP DATABASE IF EXISTS $1:name WITH (FORCE)', [dbName]);
    await admin.none('CREATE DATABASE $1:name', [dbName]);

    const testDb = pgp({ ...connection, database: dbName });
    const quietLogger = { info() {}, warn: console.warn };
    await migrate({ db: testDb, logger: quietLogger });
  } finally {
    pgp.end();
  }
};
