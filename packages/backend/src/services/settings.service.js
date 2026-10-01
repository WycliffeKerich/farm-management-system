const { db } = require('../config/database');
const farmSettingRepository = require('../repositories/farm-setting.repository');
const { toDateString } = require('../utils/dates');
const { ValidationError } = require('../utils/errors');

const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

/**
 * @param {string} timezone
 * @returns {boolean} Whether the runtime knows the IANA zone (aliases included)
 */
function isTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {*} value
 * @param {number} limit
 * @returns {number|null} The number, if it is one within ±limit
 */
function coordinate(value, limit) {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) && Math.abs(number) <= limit ? Math.round(number * 1e6) / 1e6 : null;
}

/**
 * Refuse a setting's new value
 * @param {string} message
 */
function fail(message) {
  throw new ValidationError(message);
}

// Every setting: its default and how a new value is checked. parse returns
// the value to store, or fails with a ValidationError.
const SETTINGS = {
  farm_name: {
    default: 'My Farm',
    parse(value) {
      const name = typeof value === 'string' ? value.trim() : '';
      if (!name || name.length > 100) fail('farm_name must be 1 to 100 characters');
      return name;
    },
  },
  currency: {
    default: 'KES',
    parse(value) {
      const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
      if (!CURRENCIES.has(code)) fail('currency must be an ISO 4217 code such as KES');
      return code;
    },
  },
  timezone: {
    default: 'Africa/Nairobi',
    parse(value) {
      if (typeof value !== 'string' || !isTimezone(value.trim())) {
        fail('timezone must be an IANA time zone such as Africa/Nairobi');
      }
      return value.trim();
    },
  },
  // Where the farm is (for weather, Phase 9); null when not set
  farm_location: {
    default: null,
    parse(value) {
      if (value === null) return null;
      const latitude = coordinate(value?.latitude, 90);
      const longitude = coordinate(value?.longitude, 180);
      if (latitude === null || longitude === null) {
        fail('farm_location must be null or { latitude: -90..90, longitude: -180..180 }');
      }
      return { latitude, longitude };
    },
  },
};

/**
 * Farm-wide settings with typed accessors. Values not yet saved take their default.
 */
class SettingsService {
  /**
   * Every setting in force on a date (today by default)
   * @param {string} [onDate] - YYYY-MM-DD
   * @returns {Promise<Object>}
   */
  async getAll(onDate = toDateString(new Date())) {
    const stored = await farmSettingRepository.valuesOn(onDate);
    return Object.fromEntries(
      Object.entries(SETTINGS).map(([key, setting]) => [
        key,
        Object.hasOwn(stored, key) ? stored[key] : setting.default,
      ])
    );
  }

  /** @returns {Promise<string>} ISO 4217 code */
  async getCurrency() {
    return (await this.getAll()).currency;
  }

  /** @returns {Promise<string>} IANA time zone */
  async getTimezone() {
    return (await this.getAll()).timezone;
  }

  /** @returns {Promise<{latitude: number, longitude: number}|null>} */
  async getFarmLocation() {
    return (await this.getAll()).farm_location;
  }

  /** @returns {Promise<string>} */
  async getFarmName() {
    return (await this.getAll()).farm_name;
  }

  /**
   * Change some settings; all are checked before any is saved
   * @param {Object} changes - { key: value }
   * @param {Object} user - req.user
   * @returns {Promise<Object>} Every setting after the change
   */
  async update(changes, user) {
    const unknown = Object.keys(changes).filter((key) => !Object.hasOwn(SETTINGS, key));
    if (unknown.length) {
      throw new ValidationError(`Unknown setting: ${unknown.join(', ')}`);
    }
    if (Object.keys(changes).length === 0) {
      throw new ValidationError('No settings given');
    }

    const parsed = {};
    const errors = [];
    for (const [key, value] of Object.entries(changes)) {
      try {
        parsed[key] = SETTINGS[key].parse(value);
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        errors.push({ field: key, message: error.message });
      }
    }
    if (errors.length) {
      throw new ValidationError(errors.map((error) => error.message).join('; '), errors);
    }

    await db.tx(async (t) => {
      for (const [key, value] of Object.entries(parsed)) {
        await farmSettingRepository.setPlain(key, value, user.id, t);
      }
    });
    return this.getAll();
  }
}

module.exports = new SettingsService();
module.exports.SETTING_DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([key, s]) => [key, s.default]));
