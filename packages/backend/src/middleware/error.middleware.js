const logger = require('../utils/logger');
const { AppError, NotFoundError } = require('../utils/errors');

/**
 * Map PostgreSQL error codes to operational errors
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 * @param {Error} err - Error thrown by pg / pg-promise
 * @returns {AppError|null} Mapped error, or null if not a known database error
 */
function mapDatabaseError(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return new AppError('A record with the same value already exists', 409, 'DUPLICATE', {
        constraint: err.constraint,
      });
    case '23001': // restrict_violation (ON DELETE RESTRICT)
    case '23503': // foreign_key_violation
      // On DELETE/UPDATE of a parent the message says the key "is still referenced"
      if (err.code === '23001' || /still referenced/i.test(err.detail || '')) {
        return new AppError('This record is in use by other records and cannot be removed', 409, 'IN_USE', {
          constraint: err.constraint,
        });
      }
      return new AppError('A referenced record does not exist', 400, 'INVALID_REFERENCE', {
        constraint: err.constraint,
      });
    case '23502': // not_null_violation
      return new AppError(`Missing required value${err.column ? `: ${err.column}` : ''}`, 400, 'VALIDATION_ERROR');
    case '23514': // check_violation
      return new AppError('A value is outside the allowed range', 400, 'CONSTRAINT_VIOLATION', {
        constraint: err.constraint,
      });
    case '22P02': // invalid_text_representation (e.g. 'abc' for an integer)
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
    case '22003': // numeric_value_out_of_range
    case '22001': // string_data_right_truncation
      return new AppError('Invalid value format', 400, 'VALIDATION_ERROR');
    default:
      return null;
  }
}

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError)) {
    error = mapDatabaseError(err) || err;
  }

  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    error = new AppError('Malformed JSON body', 400, 'VALIDATION_ERROR');
  }

  const isOperational = error instanceof AppError;
  const statusCode = isOperational ? error.statusCode : 500;

  const logPayload = {
    message: err.message,
    code: err.code,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
  };
  if (statusCode >= 500) {
    logger.error('Unhandled error', { ...logPayload, stack: err.stack });
  } else {
    logger.warn('Request failed', { ...logPayload, statusCode });
  }

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: {
      code: isOperational ? error.code : 'SERVER_ERROR',
      // Never leak internal messages for unexpected errors in production
      message: isOperational || !isProduction ? error.message : 'An unexpected error occurred',
      ...(isOperational && error.details !== undefined && { details: error.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

/**
 * Handle 404 errors for undefined routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function notFound(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = {
  errorHandler,
  notFound,
  mapDatabaseError,
};
