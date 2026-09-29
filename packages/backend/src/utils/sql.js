const { ValidationError } = require('./errors');

/**
 * Coerce a value to a bounded integer that is safe to place in SQL text
 * (e.g. inside make_interval()). Throws ValidationError for anything else.
 * @param {*} value - Raw value (often a query-string)
 * @param {Object} [options]
 * @param {number} [options.min=0]
 * @param {number} [options.max=3650]
 * @param {string} [options.name='value'] - Name used in the error message
 * @returns {number}
 */
function toSqlInt(value, { min = 0, max = 3650, name = 'value' } = {}) {
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

/**
 * Normalise pagination input
 * @param {*} page
 * @param {*} limit
 * @param {number} [maxLimit=200]
 * @returns {{page: number, limit: number, offset: number}}
 */
function toPagination(page, limit, maxLimit = 200) {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), maxLimit);
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

module.exports = { toSqlInt, toPagination };
