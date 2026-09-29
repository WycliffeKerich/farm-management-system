const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Middleware to handle express-validator validation results
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function validate(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const details = errors.array().map((err) => ({ field: err.path, message: err.msg }));
    throw new ValidationError(details.map((d) => d.message).join(', '), details);
  }

  next();
}

module.exports = {
  validate,
};
