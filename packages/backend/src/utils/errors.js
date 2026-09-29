/**
 * Custom error classes for the application
 *
 * Services must throw one of these (never a bare Error) so the error
 * middleware can map them to the right HTTP status and a stable error code.
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable message (safe to show to users)
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Stable machine-readable error code
   * @param {Object} [details] - Optional structured details for the client
   */
  constructor(message, statusCode, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = undefined) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', code = 'AUTHENTICATION_ERROR') {
    super(message, 401, code);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict with the current state of the resource', code = 'CONFLICT', details = undefined) {
    super(message, 409, code, details);
    this.name = 'ConflictError';
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  // Alias used in the plan/docs
  ForbiddenError: AuthorizationError,
  NotFoundError,
  ConflictError,
};
