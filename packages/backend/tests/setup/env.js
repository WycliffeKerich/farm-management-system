/**
 * Loaded before every test file (and by global setup).
 * Points the app at the dedicated test database so tests can never touch dev data.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'farm_management_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.BCRYPT_ROUNDS = '4';
// Uploaded files go to a throwaway folder, never the dev uploads
process.env.UPLOAD_DIR = path.join(require('os').tmpdir(), 'farm-management-uploads-test');

if (!process.env.DB_NAME.endsWith('_test')) {
  throw new Error(`Refusing to run tests against non-test database "${process.env.DB_NAME}"`);
}
