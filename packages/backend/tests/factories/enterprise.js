const { db } = require('../../src/config/database');

let sequence = 0;

async function createEnterprise(overrides = {}) {
  sequence += 1;
  return db.one('INSERT INTO enterprises ($1:name) VALUES ($1:csv) RETURNING *', [
    { name: `Enterprise ${sequence}`, enterprise_type: 'crops', unit_of_output: 'kg', ...overrides },
  ]);
}

module.exports = { createEnterprise };
