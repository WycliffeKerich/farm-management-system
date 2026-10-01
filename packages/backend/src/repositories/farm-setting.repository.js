const { db } = require('../config/database');

// Plain (undated) settings are stored effective from the beginning of time
const ALWAYS = '-infinity';

/**
 * Repository for farm_settings: key → jsonb value, by effective date
 */
class FarmSettingRepository {
  /**
   * Each key's value in force on a date
   * @param {string} onDate - YYYY-MM-DD
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} { key: value }
   */
  async valuesOn(onDate, t = db) {
    const rows = await t.any(
      `SELECT DISTINCT ON (key) key, value
         FROM farm_settings
        WHERE effective_from <= $1::date
        ORDER BY key, effective_from DESC`,
      [onDate]
    );
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  /**
   * Set a plain setting's value
   * @param {string} key
   * @param {*} value - Stored as jsonb
   * @param {number|null} userId
   * @param {Object} [t] - Task/transaction
   */
  async setPlain(key, value, userId, t = db) {
    await t.none(
      `INSERT INTO farm_settings (key, value, effective_from, updated_by)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (key, effective_from)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value), ALWAYS, userId]
    );
  }
}

module.exports = new FarmSettingRepository();
