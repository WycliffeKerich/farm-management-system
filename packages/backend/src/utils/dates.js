/**
 * Date-only helpers. DATE columns come back from pg as 'YYYY-MM-DD' strings
 * (see config/database.js); all arithmetic here is done in UTC so the server's
 * time zone can never move a date by a day.
 */

/**
 * Normalise a DATE string, ISO timestamp or Date to 'YYYY-MM-DD'
 * @param {string|Date} value
 * @returns {string}
 */
function toDateString(value) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

/**
 * Add (or subtract) whole days to a date
 * @param {string|Date} value - Start date
 * @param {number} days - Days to add; negative to subtract
 * @returns {string} 'YYYY-MM-DD'
 */
function addDays(value, days) {
  const date = new Date(`${toDateString(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

module.exports = { toDateString, addDays };
