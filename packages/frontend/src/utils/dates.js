const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format a date for a DATE column as the calendar day the user sees.
 *
 * DatePicker values are local midnight, so toISOString() would send the
 * previous day east of UTC (Nairobi midnight is 21:00 UTC the day before).
 * @param {Date|string|null} value - Date, 'YYYY-MM-DD' or a timestamp string
 * @returns {string|null} 'YYYY-MM-DD'
 */
export function toApiDate(value) {
    if (!value) return null;
    if (typeof value === 'string' && DATE_ONLY.test(value)) return value;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Turn a DATE string from the API into a local-midnight Date for a DatePicker.
 * new Date('YYYY-MM-DD') is UTC midnight, which is the previous day west of UTC.
 * @param {string|null} value - 'YYYY-MM-DD'
 * @returns {Date|null}
 */
export function fromApiDate(value) {
    if (!value) return null;
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

/**
 * Show a DATE string from the API as the same calendar day in the user's locale
 * @param {string|null} value - 'YYYY-MM-DD'
 * @returns {string}
 */
export function formatApiDate(value) {
    const date = fromApiDate(value);
    return date ? date.toLocaleDateString() : '';
}

/**
 * Whole days from today to a DATE string (negative once it has passed)
 * @param {string} value - 'YYYY-MM-DD'
 * @param {Date} [now]
 * @returns {number|null}
 */
export function daysUntil(value, now = new Date()) {
    const date = fromApiDate(value);
    if (!date) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((date - today) / 86400000);
}

/**
 * How old something born on a DATE string is: days under two months, then
 * months, then years and months
 * @param {string} value - 'YYYY-MM-DD'
 * @param {Date} [now]
 * @returns {string}
 */
export function formatAge(value, now = new Date()) {
    const born = fromApiDate(value);
    if (!born) return '';
    const days = -daysUntil(value, now);
    if (days < 0) return '';
    let months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth();
    if (now.getDate() < born.getDate()) months -= 1;
    if (months < 2) return `${days} ${days === 1 ? 'day' : 'days'}`;
    if (months < 24) return `${months} months`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    return rest ? `${years} y ${rest} m` : `${years} years`;
}
