const { closeDatabase } = require('../../src/config/database');

afterAll(() => {
  closeDatabase();
});
