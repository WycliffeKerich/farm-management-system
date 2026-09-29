const { db } = require('../../src/config/database');

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

async function createCropType(overrides = {}) {
  const n = next();
  return db.one('INSERT INTO crop_types ($1:name) VALUES ($1:csv) RETURNING *', [
    { name: `Crop ${n}`, category: 'vegetable', ...overrides },
  ]);
}

async function createVariety(overrides = {}) {
  const n = next();
  const cropTypeId = overrides.crop_type_id || (await createCropType()).id;
  return db.one('INSERT INTO crop_varieties ($1:name) VALUES ($1:csv) RETURNING *', [
    { name: `Variety ${n}`, growth_days: 90, ...overrides, crop_type_id: cropTypeId },
  ]);
}

async function createLocation(overrides = {}) {
  const n = next();
  return db.one('INSERT INTO growing_locations ($1:name) VALUES ($1:csv) RETURNING *', [
    { name: `Greenhouse ${n}`, type: 'greenhouse', ...overrides },
  ]);
}

/**
 * Insert a crop batch (creates a variety and location unless given)
 */
async function createBatch(overrides = {}) {
  const n = next();
  const varietyId = overrides.crop_variety_id || (await createVariety()).id;
  const locationId = overrides.location_id || (await createLocation()).id;
  return db.one('INSERT INTO crop_batches ($1:name) VALUES ($1:csv) RETURNING *', [
    {
      batch_code: `TST-${String(n).padStart(4, '0')}`,
      planting_date: '2026-01-15',
      quantity_planted: 100,
      unit: 'plants',
      status: 'growing',
      ...overrides,
      crop_variety_id: varietyId,
      location_id: locationId,
    },
  ]);
}

async function createHarvest(batchId, overrides = {}) {
  return db.one('INSERT INTO harvests ($1:name) VALUES ($1:csv) RETURNING *', [
    { harvest_date: '2026-04-01', quantity: 12.5, unit: 'kg', ...overrides, batch_id: batchId },
  ]);
}

module.exports = { createCropType, createVariety, createLocation, createBatch, createHarvest };
