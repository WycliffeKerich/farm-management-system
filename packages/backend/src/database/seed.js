require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, testConnection } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Run database seeds
 * Executes all SQL files in the seeds folder in order
 */
async function runSeeds() {
  try {
    logger.info('Starting database seeding...');

    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Get all seed files sorted by name
    const seedsDir = path.join(__dirname, '../../database/seeds');
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    logger.info(`Found ${seedFiles.length} seed file(s)`);

    // Execute each seed
    for (const file of seedFiles) {
      const seedFile = path.join(seedsDir, file);
      const sql = fs.readFileSync(seedFile, 'utf8');

      logger.info(`Running seed: ${file}`);
      await db.none(sql);
      logger.info(`✓ Completed: ${file}`);
    }

    logger.info('✓ Database seeding completed successfully');
    logger.info('Default users created:');
    logger.info('  - owner@farm.com (password: password123)');
    logger.info('  - manager@farm.com (password: password123)');
    logger.info('  - worker@farm.com (password: password123)');
    logger.info('⚠ Please change these passwords in production!');

    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

runSeeds();
