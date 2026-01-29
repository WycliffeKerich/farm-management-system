const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * Morgan middleware configuration for HTTP request logging
 */

// Create a stream object with a 'write' function that will be used by `morgan`
const stream = {
  write: (message) => logger.info(message.trim()),
};

// Skip logging during tests
const skip = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'test';
};

// Morgan format configuration
const format = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';

// Build the morgan middleware
const morganMiddleware = morgan(format, {
  stream,
  skip,
});

module.exports = morganMiddleware;
