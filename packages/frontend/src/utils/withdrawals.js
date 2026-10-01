import { formatApiDate } from '@/utils/dates';

/** What each hold stops, as the API names it */
export const PRODUCT_LABELS = { harvest: 'Harvest', milk: 'Milk', meat: 'Meat', egg: 'Eggs' };

/** Production type categories a withdrawal period applies to, and the product held */
const HELD_PRODUCT_BY_CATEGORY = { milk: 'milk', eggs: 'egg', meat: 'meat' };

/**
 * The held product for a production type category
 * @param {string} category - e.g. 'milk', 'eggs', 'wool'
 * @returns {string|null} 'milk', 'egg', 'meat', or null when nothing is ever held
 */
export function heldProductFor(category) {
    return HELD_PRODUCT_BY_CATEGORY[category] || null;
}

/**
 * The details of a 409 WITHDRAWAL_ACTIVE refusal, or null for any other error
 * @param {Error} err - Axios error
 * @returns {{message: string, safe_from: string, holds: Array}|null}
 */
export function withdrawalConflict(err) {
    const error = err?.response?.data?.error;
    if (err?.response?.status !== 409 || error?.code !== 'WITHDRAWAL_ACTIVE') return null;
    return {
        message: error.message,
        safe_from: error.details?.safe_from || null,
        holds: Array.isArray(error.details?.holds) ? error.details.holds : []
    };
}

/**
 * Index GET /withdrawals/active by what is held. Holds sit on the animal or
 * group that was treated, so a group's holds are not repeated on its animals.
 * @param {Object} active - { crops, animals } from the API
 * @returns {{batches: Map, animals: Map, groups: Map}} batch id to its entry;
 *   animal or group id to its entries (one per product)
 */
export function indexHolds(active) {
    const batches = new Map();
    const animals = new Map();
    const groups = new Map();
    const push = (map, id, entry) => map.set(id, [...(map.get(id) || []), entry]);

    for (const entry of active?.crops || []) batches.set(entry.batch_id, entry);
    for (const entry of active?.animals || []) {
        if (entry.animal_id) push(animals, entry.animal_id, entry);
        else if (entry.animal_group_id) push(groups, entry.animal_group_id, entry);
    }
    return { batches, animals, groups };
}

/**
 * Short badge text for one held product
 * @param {Object} entry - A crops or animals entry
 * @returns {string} e.g. 'Meat: safe 16/03/2026'
 */
export function holdBadgeLabel(entry) {
    return `${PRODUCT_LABELS[entry.product] || entry.product}: safe ${formatApiDate(entry.safe_from)}`;
}

/**
 * The products behind an entry's holds
 * @param {Object} entry - A crops or animals entry
 * @returns {string} e.g. 'Ridomil, Duduthrin'
 */
export function holdProducts(entry) {
    return [...new Set((entry.holds || []).map((hold) => hold.product_name))].join(', ');
}

/**
 * Tooltip text for one held product: what caused the hold
 * @param {Object} entry - A crops or animals entry
 * @returns {string}
 */
export function holdTooltip(entry) {
    const kind = entry.product === 'harvest' ? 'Pre-harvest interval' : 'Withdrawal period';
    const products = holdProducts(entry);
    return products ? `${kind}: ${products}` : kind;
}

/**
 * One line describing a hold in a refusal
 * @param {Object} hold - { product_name, applied_on, safe_from, disease_name? }
 * @returns {string}
 */
export function describeHold(hold) {
    const treated = hold.disease_name ? ` for ${hold.disease_name}` : '';
    return `${hold.product_name}${treated}, applied ${formatApiDate(hold.applied_on)}: safe from ${formatApiDate(hold.safe_from)}`;
}
