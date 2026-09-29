require('dotenv').config();
const { db, testConnection, closeDatabase } = require('../config/database');
const { migrate } = require('./migrator');
const logger = require('../utils/logger');

/**
 * Run pending database migrations
 *
 * Usage:
 *   npm run migrate                          Apply pending migrations
 *   npm run migrate -- --baseline            Record all pending files as applied without running them
 *                                            (one-off, for a database created before versioned migrations)
 *   npm run migrate -- --mark-applied=a.sql,b.sql
 *                                            Record specific files as applied without running them
 */
async function runMigrations() {
  const args = process.argv.slice(2);
  const baseline = args.includes('--baseline');
  const markArg = args.find((arg) => arg.startsWith('--mark-applied='));
  const markApplied = markArg ? markArg.split('=')[1].split(',').filter(Boolean) : [];

  try {
    logger.info('Starting database migrations...');

    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    const result = await migrate({ db, baseline, markApplied, logger });

    if (result.applied.length === 0 && result.baselined.length === 0) {
      logger.info('✓ Database is up to date');
    } else {
      logger.info(`✓ Applied ${result.applied.length}, marked ${result.baselined.length} migration(s)`);
    }
    closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    closeDatabase();
    process.exit(1);
  }
}

runMigrations();
