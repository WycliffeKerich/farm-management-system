/**
 * Shaping the inventory report endpoints for display
 */

/**
 * Group reorder items into one order per usual supplier, suppliers by name,
 * items without a supplier last
 * @param {Array<Object>} items - GET /inventory/reports/reorder items
 * @returns {Array<{supplier_id: number|null, supplier_name: string|null, supplier_phone: string|null, supplier_email: string|null, items: Array, estimated_cost: number, uncosted_count: number}>}
 */
export function reorderBySupplier(items = []) {
    const orders = new Map();
    for (const item of items) {
        const key = item.supplier_id ?? null;
        if (!orders.has(key)) {
            orders.set(key, {
                supplier_id: key,
                supplier_name: item.supplier_name ?? null,
                supplier_phone: item.supplier_phone ?? null,
                supplier_email: item.supplier_email ?? null,
                items: [],
                estimated_cost: 0,
                uncosted_count: 0
            });
        }
        const order = orders.get(key);
        order.items.push(item);
        if (item.estimated_cost == null) order.uncosted_count += 1;
        else order.estimated_cost = Math.round((order.estimated_cost + Number(item.estimated_cost)) * 100) / 100;
    }

    return [...orders.values()].sort((a, b) => {
        if (a.supplier_id === null) return 1;
        if (b.supplier_id === null) return -1;
        return a.supplier_name.localeCompare(b.supplier_name);
    });
}

/**
 * How long stock lasts at recent usage
 * @param {number|null} days - days_of_cover from the reorder report
 * @returns {string} e.g. '5 days', 'Under a day', or 'No recent use'
 */
export function formatDaysOfCover(days) {
    if (days === null || days === undefined) return 'No recent use';
    if (days < 1) return 'Under a day';
    return days === 1 ? '1 day' : `${days} days`;
}

/**
 * When an expiring entry expires, relative to today
 * @param {number} days - days_until_expiry from the expiring report
 * @returns {string} e.g. 'Expired 3 days ago', 'Expires today', 'In 12 days'
 */
export function formatExpiryDistance(days) {
    if (days < 0) return days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`;
    if (days === 0) return 'Expires today';
    return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

/**
 * A plain-text order for a supplier, to paste into a message or email
 * @param {Object} order - One entry from reorderBySupplier
 * @param {string} [farmName]
 * @returns {string}
 */
export function orderText(order, farmName = '') {
    const greeting = order.supplier_name ? `Hello ${order.supplier_name},` : 'Hello,';
    const from = farmName ? ` for ${farmName}` : '';
    const lines = order.items.map((item) => `- ${item.name}: ${item.suggested_quantity} ${item.unit || ''}`.trimEnd());
    return [greeting, '', `Please supply the following${from}:`, ...lines, '', 'Thank you.'].join('\n');
}
