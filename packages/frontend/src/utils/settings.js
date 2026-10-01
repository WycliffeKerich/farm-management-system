/**
 * The settings as the form edits them: the location split into two numbers
 * @param {Object} settings - From GET /settings
 * @returns {Object}
 */
export function toSettingsForm(settings) {
    return {
        farm_name: settings.farm_name || '',
        currency: settings.currency || null,
        timezone: settings.timezone || null,
        latitude: settings.farm_location?.latitude ?? null,
        longitude: settings.farm_location?.longitude ?? null
    };
}

const blank = (value) => value === null || value === undefined || value === '';

/**
 * Problems the form can see before saving, by field
 * @param {Object} form - From toSettingsForm
 * @returns {Object} { field: message }; empty when the form is fine
 */
export function settingsFormErrors(form) {
    const errors = {};
    const name = form.farm_name?.trim() || '';
    if (!name) errors.farm_name = 'Farm name is required';
    else if (name.length > 100) errors.farm_name = 'Farm name must be at most 100 characters';
    if (!form.currency) errors.currency = 'Currency is required';
    if (!form.timezone) errors.timezone = 'Time zone is required';
    if (blank(form.latitude) !== blank(form.longitude)) {
        errors.farm_location = 'Give both latitude and longitude, or neither';
    } else if (!blank(form.latitude) && (Math.abs(form.latitude) > 90 || Math.abs(form.longitude) > 180)) {
        errors.farm_location = 'Latitude is -90 to 90 and longitude -180 to 180';
    }
    return errors;
}

/**
 * The PUT /settings body: only what the form changed
 * @param {Object} settings - The saved settings
 * @param {Object} form - From toSettingsForm
 * @returns {Object}
 */
export function settingsChanges(settings, form) {
    const changes = {};
    const name = form.farm_name.trim();
    if (name !== settings.farm_name) changes.farm_name = name;
    if (form.currency !== settings.currency) changes.currency = form.currency;
    if (form.timezone !== settings.timezone) changes.timezone = form.timezone;

    const location = blank(form.latitude) ? null : { latitude: Number(form.latitude), longitude: Number(form.longitude) };
    const saved = settings.farm_location || null;
    if (location?.latitude !== saved?.latitude || location?.longitude !== saved?.longitude) {
        changes.farm_location = location;
    }
    return changes;
}

/**
 * Field errors from a 400 response, by field
 * @param {Error} err - Axios error
 * @returns {Object}
 */
export function fieldErrors(err) {
    const details = err?.response?.data?.error?.details;
    if (!Array.isArray(details)) return {};
    return Object.fromEntries(details.filter((detail) => detail.field).map((detail) => [detail.field, detail.message]));
}

/**
 * Choices for a Select, with a fallback when the browser cannot list them
 * @param {'currency'|'timeZone'} key
 * @param {string[]} fallback
 * @returns {string[]}
 */
export function supportedValues(key, fallback) {
    try {
        return Intl.supportedValuesOf(key);
    } catch {
        return fallback;
    }
}
