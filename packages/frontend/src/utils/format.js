import { reactive } from 'vue';

/** Number and date conventions; the currency and time zone come from the farm settings */
export const LOCALE = 'en-KE';
export const DEFAULT_FORMAT = Object.freeze({ currency: 'KES', timeZone: 'Africa/Nairobi' });

/**
 * The farm's currency and time zone. Reactive, so a template that formats with
 * them redraws once the settings load.
 */
export const formatConfig = reactive({ ...DEFAULT_FORMAT });

/**
 * Use the farm settings for formatting from now on
 * @param {{currency?: string, timezone?: string}} settings
 */
export function configureFormat({ currency, timezone } = {}) {
    formatConfig.currency = currency || DEFAULT_FORMAT.currency;
    formatConfig.timeZone = timezone || DEFAULT_FORMAT.timeZone;
}

/**
 * An amount in the farm's currency
 * @param {number|string|null} value - Decimal strings from the API are fine
 * @param {{currency?: string}} [options]
 * @returns {string}
 */
export function formatMoney(value, { currency = formatConfig.currency } = {}) {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(Number(value) || 0);
}

/**
 * A number with grouping, up to two decimals
 * @param {number|string|null} value
 * @returns {string}
 */
export function formatNumber(value, maximumFractionDigits = 2) {
    if (value === null || value === undefined || value === '') return '';
    const number = Number(value);
    return Number.isNaN(number) ? '' : new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(number);
}

/**
 * A timestamp as the farm's local date and time
 * @param {string|Date|null} value - ISO timestamp
 * @param {{timeZone?: string}} [options]
 * @returns {string}
 */
export function formatDateTime(value, { timeZone = formatConfig.timeZone } = {}) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

/**
 * A file size for people
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
