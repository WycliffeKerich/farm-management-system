/** Activity types, as the backend names them, with how the timeline shows them */
export const ACTIVITY_TYPES = Object.freeze({
    input_application: { label: 'Input application', icon: 'pi pi-sparkles', domain: 'crops' },
    observation: { label: 'Observation', icon: 'pi pi-eye', domain: 'crops' },
    harvest: { label: 'Harvest', icon: 'pi pi-box', domain: 'crops' },
    pest_incident: { label: 'Pest or disease', icon: 'pi pi-exclamation-triangle', domain: 'crops' },
    feeding: { label: 'Feeding', icon: 'pi pi-shopping-bag', domain: 'animals' },
    vaccination: { label: 'Vaccination', icon: 'pi pi-shield', domain: 'animals' },
    deworming: { label: 'Deworming', icon: 'pi pi-shield', domain: 'animals' },
    health_check: { label: 'Health check', icon: 'pi pi-heart', domain: 'animals' },
    treatment: { label: 'Treatment', icon: 'pi pi-plus-circle', domain: 'animals' },
    production: { label: 'Production', icon: 'pi pi-chart-line', domain: 'animals' },
    task_work: { label: 'Task work', icon: 'pi pi-check-square', domain: 'any' }
});

export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPES).map(([value, { label }]) => ({ label, value }));

export const ACTIVITY_STATUS_OPTIONS = [
    { label: 'Done', value: 'done' },
    { label: 'Planned', value: 'planned' },
    { label: 'Cancelled', value: 'cancelled' }
];

/**
 * @param {string} type
 * @returns {string}
 */
export function activityTypeLabel(type) {
    return ACTIVITY_TYPES[type]?.label || String(type || '').replace(/_/g, ' ');
}

/**
 * @param {string} type
 * @returns {string} PrimeIcons class
 */
export function activityTypeIcon(type) {
    return ACTIVITY_TYPES[type]?.icon || 'pi pi-circle';
}

/**
 * @param {string} status
 * @returns {string} Tag severity
 */
export function activityStatusSeverity(status) {
    return { done: 'success', planned: 'info', cancelled: 'secondary' }[status] || 'secondary';
}

/**
 * What the activity was about, with where its page is
 * @param {Object} activity - A timeline row with the joined names
 * @returns {{label: string, icon: string, to: string}|null}
 */
export function activitySubject(activity) {
    if (activity.crop_batch_id) {
        return { label: activity.crop_batch_code || `Batch #${activity.crop_batch_id}`, icon: 'pi pi-th-large', to: `/crops/batches/${activity.crop_batch_id}` };
    }
    if (activity.animal_id) {
        const name = activity.animal_name ? `${activity.animal_tag_number} (${activity.animal_name})` : activity.animal_tag_number;
        return { label: name || `Animal #${activity.animal_id}`, icon: 'pi pi-id-card', to: `/animals/${activity.animal_id}` };
    }
    if (activity.animal_group_id) {
        return { label: activity.animal_group_name || `Group #${activity.animal_group_id}`, icon: 'pi pi-users', to: `/animals/groups/${activity.animal_group_id}` };
    }
    return null;
}

/**
 * Input and other cost together; null when neither is recorded
 * @param {Object} activity - input_cost and other_cost are decimal strings
 * @returns {number|null}
 */
export function activityCost(activity) {
    if (activity.input_cost == null && activity.other_cost == null) return null;
    return Number(activity.input_cost || 0) + Number(activity.other_cost || 0);
}

/**
 * Labour and cost over a page of activities
 * @param {Object[]} activities
 * @returns {{hours: number, cost: number}}
 */
export function activityTotals(activities) {
    return activities.reduce(
        (totals, activity) => ({
            hours: totals.hours + Number(activity.labour_hours || 0),
            cost: totals.cost + (activityCost(activity) || 0)
        }),
        { hours: 0, cost: 0 }
    );
}

/**
 * The day the activity happened, or is planned for
 * @param {Object} activity
 * @returns {string|null} 'YYYY-MM-DD'
 */
export function activityDate(activity) {
    const value = activity.activity_date || activity.occurred_on || activity.planned_for;
    return value ? String(value).slice(0, 10) : null;
}
