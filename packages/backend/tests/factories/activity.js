const { db } = require('../../src/config/database');

/**
 * Insert a done activity. A detail row inserted straight into its table
 * needs one, as the services would have recorded it (ADR-001).
 */
async function createActivity(overrides = {}) {
  return db.one('INSERT INTO activities ($1:name) VALUES ($1:csv) RETURNING *', [
    { activity_type: 'observation', title: 'Activity', occurred_on: '2026-04-01', ...overrides },
  ]);
}

module.exports = { createActivity };
