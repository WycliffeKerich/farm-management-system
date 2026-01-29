require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, testConnection } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Run database migrations
 * Executes all SQL files in the migrations folder in order
 */
async function runMigrations() {
  try {
    logger.info('Starting database migrations...');

    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Get all migration files sorted by name
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    logger.info(`Found ${migrationFiles.length} migration file(s)`);

    // Execute each migration
    for (const file of migrationFiles) {
      const migrationFile = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationFile, 'utf8');

      logger.info(`Running migration: ${file}`);
      await db.none(sql);
      logger.info(`✓ Completed: ${file}`);
    }

    logger.info('✓ All database migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
