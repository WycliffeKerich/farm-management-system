/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/after-env.js'],
  globalSetup: '<rootDir>/tests/setup/global-setup.js',
  // Integration suites share one database; run files serially
  maxWorkers: 1,
  testTimeout: 15000,
  coverageDirectory: './coverage',
  collectCoverageFrom: ['src/**/*.js', '!src/index.js', '!src/database/migrate.js', '!src/database/seed.js'],
  coverageThreshold: {
    global: { lines: 60 },
  },
};
