/**
 * Tables with the audit trigger (migrations 020-022). production_records was
 * dropped in 023 but its history stays in the log.
 */
export const AUDITED_TABLES = Object.freeze([
    'activities',
    'animal_breeds',
    'animal_care_plan_tasks',
    'animal_care_plans',
    'animal_care_schedules',
    'animal_deaths',
    'animal_diseases_treatments',
    'animal_feed_records',
    'animal_group_adjustments',
    'animal_groups',
    'animal_health_records',
    'animal_housing',
    'animal_production_records',
    'animal_production_types',
    'animal_types',
    'animals',
    'attachments',
    'batch_care_schedules',
    'breeding_records',
    'crop_batches',
    'crop_care_plan_tasks',
    'crop_care_plans',
    'crop_input_applications',
    'crop_pests_diseases',
    'crop_types',
    'crop_varieties',
    'employee_attendance',
    'employee_leaves',
    'employee_salaries',
    'employees',
    'enterprises',
    'farm_settings',
    'financial_transactions',
    'growing_locations',
    'growth_observations',
    'harvests',
    'incubation_records',
    'inventory_batches',
    'inventory_categories',
    'inventory_items',
    'inventory_transactions',
    'production_records',
    'sales',
    'scheduled_animal_tasks',
    'scheduled_batch_tasks',
    'suppliers',
    'task_assignments',
    'task_categories',
    'task_checklist_items',
    'task_updates',
    'tasks',
    'transaction_categories',
    'treatment_medications',
    'units_of_measure',
    'users'
]);

export const AUDIT_ACTION_OPTIONS = [
    { label: 'Created', value: 'insert' },
    { label: 'Changed', value: 'update' },
    { label: 'Archived', value: 'soft_delete' },
    { label: 'Deleted', value: 'delete' }
];

/**
 * @param {string} action
 * @returns {string}
 */
export function auditActionLabel(action) {
    return AUDIT_ACTION_OPTIONS.find((option) => option.value === action)?.label || action;
}

/**
 * @param {string} action
 * @returns {string} Tag severity
 */
export function auditActionSeverity(action) {
    return { insert: 'success', update: 'info', soft_delete: 'warn', delete: 'danger' }[action] || 'secondary';
}

/**
 * A table name for people: crop_batches → Crop batches
 * @param {string} table
 * @returns {string}
 */
export function tableLabel(table) {
    const words = String(table || '').replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
}

const RECORD_ROUTES = {
    crop_batches: 'crop-batch-detail',
    crop_care_plans: 'care-plan-detail',
    animals: 'animal-detail',
    animal_groups: 'animal-group-detail',
    animal_care_plans: 'animal-care-plan-detail',
    inventory_items: 'inventory-item-detail'
};

/**
 * The page showing an audited record, if it has one. A deleted record's
 * page will say it cannot be found.
 * @param {string} table
 * @param {number} id
 * @returns {{name: string, params: {id: number}}|null}
 */
export function auditRecordRoute(table, id) {
    const name = RECORD_ROUTES[table];
    return name && id ? { name, params: { id } } : null;
}

// Bookkeeping columns every row has; they say nothing about the change
const NOISE = new Set(['updated_at']);

/**
 * The fields an entry touched, with their values before and after.
 * A change lists only what changed; a new row lists what it was created
 * with; a removed row lists what it held.
 * @param {{action: string, before: Object|null, after: Object|null, changed_fields?: string[]}} entry
 * @returns {{field: string, before: *, after: *}[]}
 */
export function auditChanges(entry) {
    const before = entry.before || {};
    const after = entry.after || {};
    let fields;
    if (entry.action === 'update' || entry.action === 'soft_delete') {
        fields = entry.changed_fields?.length ? entry.changed_fields : Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    } else {
        fields = Object.keys(entry.action === 'delete' ? before : after).filter((key) => before[key] != null || after[key] != null);
    }
    return fields
        .filter((field) => !NOISE.has(field) || fields.length === 1)
        .sort()
        .map((field) => ({ field, before: before[field] ?? null, after: after[field] ?? null }));
}

/**
 * One value from a row snapshot, for a table cell
 * @param {*} value
 * @returns {string}
 */
export function auditValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}
