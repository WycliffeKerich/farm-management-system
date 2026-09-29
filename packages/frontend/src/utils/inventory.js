/**
 * Inventory ledger rules, matching the backend (config/constants.js):
 * quantities are magnitudes, purchase and return add stock, adjustment is
 * signed, and every other type removes stock.
 */
const INCOMING_TYPES = ['purchase', 'return'];

const TYPE_LABELS = {
    purchase: 'Purchase',
    usage: 'Usage',
    adjustment: 'Adjustment',
    return: 'Return',
    expired: 'Expired',
    transfer: 'Transfer Out',
    waste: 'Waste'
};

/** Ledger types, for filters */
export const TRANSACTION_TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ label, value }));

/**
 * What a user can record by hand. Adjustments are split into add and remove
 * so the quantity field can stay positive; toTransactionPayload signs it.
 */
export const MOVEMENT_OPTIONS = [
    { label: 'Purchase', value: 'purchase' },
    { label: 'Usage', value: 'usage' },
    { label: 'Adjustment (Add)', value: 'adjustment_add' },
    { label: 'Adjustment (Remove)', value: 'adjustment_remove' },
    { label: 'Return', value: 'return' },
    { label: 'Waste', value: 'waste' },
    { label: 'Expired', value: 'expired' },
    { label: 'Transfer Out', value: 'transfer' }
];

export const REFERENCE_TYPE_OPTIONS = [
    { label: 'Crop Batch', value: 'crop_batch' },
    { label: 'Animal', value: 'animal' },
    { label: 'Animal Group', value: 'animal_group' },
    { label: 'Task', value: 'task' },
    { label: 'Manual', value: 'manual' }
];

/**
 * Whether a movement chosen in a form takes stock away
 * @param {string} movement - A MOVEMENT_OPTIONS value
 * @returns {boolean}
 */
export function isReducingMovement(movement) {
    if (!movement) return false;
    if (movement === 'adjustment_add') return false;
    if (movement === 'adjustment_remove') return true;
    return !INCOMING_TYPES.includes(movement);
}

/**
 * Build the POST /inventory/transactions body from a form's movement and quantity
 * @param {number} itemId
 * @param {Object} form - { movement, quantity, ...other fields sent as-is }
 * @returns {Object}
 */
export function toTransactionPayload(itemId, { movement, quantity, ...rest }) {
    if (movement === 'adjustment_add' || movement === 'adjustment_remove') {
        return { ...rest, item_id: itemId, transaction_type: 'adjustment', quantity: movement === 'adjustment_add' ? quantity : -quantity };
    }
    return { ...rest, item_id: itemId, transaction_type: movement, quantity };
}

/**
 * A ledger row's effect on stock: positive adds, negative removes
 * @param {{ transaction_type: string, quantity: number }} row
 * @returns {number}
 */
export function signedQuantity(row) {
    const quantity = Number(row.quantity) || 0;
    if (row.transaction_type === 'adjustment') return quantity;
    return INCOMING_TYPES.includes(row.transaction_type) ? quantity : -quantity;
}

/**
 * '+5 kg' / '-0.25 kg'
 * @param {Object} row - Ledger row
 * @param {string} [unit]
 * @returns {string}
 */
export function formatSignedQuantity(row, unit = '') {
    const signed = signedQuantity(row);
    return `${signed >= 0 ? '+' : '-'}${Math.abs(signed)}${unit ? ` ${unit}` : ''}`;
}

export function formatTransactionType(type) {
    return TYPE_LABELS[type] || type;
}

export function formatReferenceType(type) {
    return REFERENCE_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;
}

/**
 * Tag severity for a ledger row
 * @param {Object} row
 * @returns {string}
 */
export function transactionSeverity(row) {
    if (row.transaction_type === 'usage' || row.transaction_type === 'transfer') return 'info';
    if (['waste', 'expired'].includes(row.transaction_type)) return 'danger';
    return signedQuantity(row) >= 0 ? 'success' : 'warn';
}

/**
 * Totals for the usage report, from GET /inventory/items/:id/usage-report
 * @param {{ summary: Array, transactions: Array }} report
 * @returns {{ used: number, received: number, net: number, byReference: Array<{ reference_type: string, quantity: number }> }}
 */
export function summariseUsage(report) {
    const summary = report?.summary || [];
    const round = (value) => Math.round(value * 100) / 100;
    const used = summary.filter((row) => row.transaction_type === 'usage').reduce((sum, row) => sum + Number(row.total_quantity), 0);
    const received = summary.filter((row) => INCOMING_TYPES.includes(row.transaction_type)).reduce((sum, row) => sum + Number(row.total_quantity), 0);
    const net = summary.reduce((sum, row) => sum + Number(row.net_change), 0);

    const references = new Map();
    for (const row of report?.transactions || []) {
        if (row.transaction_type !== 'usage' || !row.reference_type) continue;
        references.set(row.reference_type, (references.get(row.reference_type) || 0) + Number(row.quantity));
    }

    return {
        used: round(used),
        received: round(received),
        net: round(net),
        byReference: [...references].map(([reference_type, quantity]) => ({ reference_type, quantity: round(quantity) }))
    };
}

export function formatCurrency(value) {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value || 0);
}
