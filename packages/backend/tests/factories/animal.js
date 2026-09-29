const { db } = require('../../src/config/database');

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

const insert = (table, row) => db.one('INSERT INTO $1:name ($2:name) VALUES ($2:csv) RETURNING *', [table, row]);

async function createAnimalType(overrides = {}) {
  const n = next();
  return insert('animal_types', { name: `Animal ${n}`, category: 'livestock', tracking_mode: 'both', ...overrides });
}

async function createBreed(overrides = {}) {
  const n = next();
  const typeId = overrides.animal_type_id || (await createAnimalType()).id;
  return insert('animal_breeds', { name: `Breed ${n}`, ...overrides, animal_type_id: typeId });
}

async function createHousing(overrides = {}) {
  const n = next();
  return insert('animal_housing', { name: `Pen ${n}`, ...overrides });
}

async function createAnimal(overrides = {}) {
  const n = next();
  const breedId = overrides.animal_breed_id || (await createBreed()).id;
  return insert('animals', {
    tag_number: `TAG-${String(n).padStart(4, '0')}`,
    date_acquired: '2026-01-10',
    gender: 'female',
    status: 'active',
    ...overrides,
    animal_breed_id: breedId,
  });
}

async function createGroup(overrides = {}) {
  const n = next();
  const breedId = overrides.animal_breed_id || (await createBreed()).id;
  const quantity = overrides.quantity ?? 100;
  return insert('animal_groups', {
    name: `Flock ${n}`,
    group_code: `GRP-${String(n).padStart(4, '0')}`,
    date_established: '2026-01-10',
    status: 'active',
    quantity,
    initial_quantity: quantity,
    current_quantity: quantity,
    ...overrides,
    animal_breed_id: breedId,
  });
}

module.exports = { createAnimalType, createBreed, createHousing, createAnimal, createGroup };
