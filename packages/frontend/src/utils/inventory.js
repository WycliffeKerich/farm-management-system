import { toApiDate } from '@/utils/dates';

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

/**
 * '12.5 kg in stock' for a product picker
 * @param {{ current_stock: number|string, unit: string }} item
 * @returns {string}
 */
export function formatStock(item) {
    const stock = Math.round((Number(item?.current_stock) || 0) * 100) / 100;
    return `${stock}${item?.unit ? ` ${item.unit}` : ''} in stock`;
}

const ANIMAL_PRODUCTS = ['milk', 'meat', 'egg'];

/**
 * The waiting period an item carries: 'PHI 14 d' for crops, 'Milk 3 d · Meat 28 d' for animals
 * @param {Object} item - Inventory item
 * @param {'crop'|'animal'} use - What the product is applied to
 * @returns {string} Empty when the item has none
 */
export function withdrawalSummary(item, use) {
    if (!item) return '';
    if (use === 'crop') {
        return Number(item.pre_harvest_interval_days) > 0 ? `PHI ${item.pre_harvest_interval_days} d` : '';
    }
    return ANIMAL_PRODUCTS.filter((product) => Number(item[`${product}_withdrawal_days`]) > 0)
        .map((product) => `${product[0].toUpperCase()}${product.slice(1)} ${item[`${product}_withdrawal_days`]} d`)
        .join(' · ');
}

/**
 * A blank treatment dose
 * @param {Date} [administeredDate]
 * @returns {Object}
 */
export function emptyDose(administeredDate = new Date()) {
    return { inventory_item_id: null, product_name: '', quantity: null, unit: '', administered_date: administeredDate, milk_withdrawal_days: null, meat_withdrawal_days: null, egg_withdrawal_days: null };
}

/**
 * Fill a dose from the chosen stock item. The backend keeps the longer of the
 * dose's and the item's withdrawal days, so the item's days are the floor.
 * @param {Object} dose
 * @param {Object|null} item - null when the picker is cleared
 * @returns {Object}
 */
export function applyItemToDose(dose, item) {
    if (!item) return { ...dose, inventory_item_id: null };
    const withdrawal = Object.fromEntries(ANIMAL_PRODUCTS.map((product) => [`${product}_withdrawal_days`, item[`${product}_withdrawal_days`] ?? null]));
    return { ...dose, ...withdrawal, inventory_item_id: item.id, product_name: item.name, unit: item.unit };
}

/**
 * The doses array for POST /animals/diseases-treatments, without rows left blank
 * @param {Array<Object>} doses
 * @returns {Array<Object>}
 */
export function toDosesPayload(doses) {
    return doses
        .filter((dose) => dose.quantity > 0 && (dose.inventory_item_id || dose.product_name?.trim()))
        .map((dose) => ({
            ...dose,
            product_name: dose.product_name?.trim() || null,
            unit: dose.unit || null,
            administered_date: dose.administered_date ? toApiDate(dose.administered_date) : null
        }));
}

/** Item fields for reordering and safety intervals, edited together in ItemSupplyFields */
export const ITEM_SUPPLY_FIELDS = ['default_supplier_id', 'reorder_quantity', 'active_ingredient', 'pre_harvest_interval_days', 'milk_withdrawal_days', 'meat_withdrawal_days', 'egg_withdrawal_days'];

/**
 * An item's supply fields for an edit form, null where unset
 * @param {Object} [item] - Inventory item; omit for a new item
 * @returns {Object}
 */
export function itemSupplyFields(item) {
    return Object.fromEntries(ITEM_SUPPLY_FIELDS.map((field) => [field, item?.[field] ?? null]));
}

/**
 * A blank purchase of an item, filled from what the item was last bought as
 * @param {Object} item - Inventory item
 * @returns {Object}
 */
export function emptyPurchase(item) {
    return {
        quantity: null,
        supplier_id: item?.default_supplier_id ?? null,
        unit_cost: item?.cost_per_unit ?? null,
        received_date: new Date(),
        batch_number: '',
        supplier_batch_number: '',
        manufacture_date: null,
        expiry_date: null,
        storage_location: item?.location || '',
        notes: ''
    };
}

/**
 * The body for POST /inventory/batches: blank text fields are left out, so the
 * server numbers the batch when no batch number is given
 * @param {number} itemId
 * @param {Object} purchase - From emptyPurchase
 * @returns {Object}
 */
export function toPurchasePayload(itemId, purchase) {
    const text = (value) => value?.trim() || undefined;
    return {
        inventory_item_id: itemId,
        quantity: purchase.quantity,
        supplier_id: purchase.supplier_id ?? undefined,
        unit_cost: purchase.unit_cost ?? undefined,
        received_date: toApiDate(purchase.received_date),
        manufacture_date: toApiDate(purchase.manufacture_date),
        expiry_date: toApiDate(purchase.expiry_date),
        batch_number: text(purchase.batch_number),
        supplier_batch_number: text(purchase.supplier_batch_number),
        storage_location: text(purchase.storage_location),
        notes: text(purchase.notes)
    };
}

export function formatCurrency(value) {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value || 0);
}
