const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

/**
 * Checksum of a migration file, insensitive to line-ending differences
 * @param {string} sql - File contents
 * @returns {string} SHA-256 hex digest
 */
function checksum(sql) {
  return crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

/**
 * List migration files in apply order
 * @param {string} dir - Migrations directory
 * @returns {Array<{filename: string, sql: string, checksum: string}>}
 */
function readMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const sql = fs.readFileSync(path.join(dir, filename), 'utf8');
      return { filename, sql, checksum: checksum(sql) };
    });
}

async function ensureMigrationsTable(db) {
  await db.none(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Apply pending migrations. Each file runs once, inside its own transaction,
 * and is recorded in schema_migrations with its checksum. Editing a file that
 * has already been applied is an error - write a new migration instead.
 *
 * @param {Object} options
 * @param {Object} options.db - pg-promise database
 * @param {string} [options.dir] - Migrations directory
 * @param {boolean} [options.baseline] - Record all pending files as applied without running them
 * @param {Array<string>} [options.markApplied] - Record only these pending files as applied without running them
 * @param {Object} [options.logger] - Logger with info/warn
 * @returns {Promise<{applied: string[], baselined: string[]}>}
 */
async function migrate({ db, dir = DEFAULT_MIGRATIONS_DIR, baseline = false, markApplied = [], logger = console }) {
  await ensureMigrationsTable(db);

  const files = readMigrations(dir);
  const appliedRows = await db.any('SELECT filename, checksum FROM schema_migrations');
  const applied = new Map(appliedRows.map((row) => [row.filename, row.checksum]));

  const changed = files.filter((f) => applied.has(f.filename) && applied.get(f.filename) !== f.checksum);
  if (changed.length > 0) {
    throw new Error(
      `Applied migration(s) have been modified: ${changed.map((f) => f.filename).join(', ')}. ` +
        'Never edit an applied migration; add a new one instead.'
    );
  }

  const pending = files.filter((f) => !applied.has(f.filename));
  const lastApplied = [...applied.keys()].sort().pop();
  const result = { applied: [], baselined: [] };

  for (const file of pending) {
    if (baseline || markApplied.includes(file.filename)) {
      await db.none('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
        file.filename,
        file.checksum,
      ]);
      result.baselined.push(file.filename);
      logger.info(`↷ Marked as applied (not run): ${file.filename}`);
      continue;
    }

    if (lastApplied && file.filename < lastApplied) {
      logger.warn(`Applying out-of-order migration ${file.filename} (latest applied: ${lastApplied})`);
    }

    logger.info(`Running migration: ${file.filename}`);
    await db.tx(async (t) => {
      await t.none(file.sql);
      await t.none('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [
        file.filename,
        file.checksum,
      ]);
    });
    result.applied.push(file.filename);
    logger.info(`✓ Completed: ${file.filename}`);
  }

  return result;
}

module.exports = {
  migrate,
  checksum,
  readMigrations,
  DEFAULT_MIGRATIONS_DIR,
};
