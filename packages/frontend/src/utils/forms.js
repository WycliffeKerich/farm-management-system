/** Must match the backend auth validator */
export const PASSWORD_MIN = 10;

export const ROLE_OPTIONS = [
    { label: 'Owner', value: 'owner' },
    { label: 'Manager', value: 'manager' },
    { label: 'Worker', value: 'worker' }
];

/**
 * Turn an API error into one readable line, including field-level validation details
 * @param {Error} err - Axios error
 * @param {string} fallback - Message when the response has none
 * @returns {string}
 */
export function validationMessage(err, fallback) {
    const error = err?.response?.data?.error;
    if (!error) return fallback;
    if (Array.isArray(error.details) && error.details.length > 0) {
        return error.details.map((detail) => detail.message || detail.msg).join('. ');
    }
    return error.message || fallback;
}
