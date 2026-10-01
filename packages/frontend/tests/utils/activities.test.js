import { describe, expect, it } from 'vitest';
import { ACTIVITY_TYPE_OPTIONS, activityCost, activityDate, activityStatusSeverity, activitySubject, activityTotals, activityTypeIcon, activityTypeLabel } from '@/utils/activities';

describe('activity types and statuses', () => {
    it('labels the known types and falls back for others', () => {
        expect(ACTIVITY_TYPE_OPTIONS).toHaveLength(11);
        expect(activityTypeLabel('pest_incident')).toBe('Pest or disease');
        expect(activityTypeLabel('new_kind')).toBe('new kind');
        expect(activityTypeIcon('harvest')).toBe('pi pi-box');
        expect(activityTypeIcon('new_kind')).toBe('pi pi-circle');
        expect(activityStatusSeverity('done')).toBe('success');
        expect(activityStatusSeverity('planned')).toBe('info');
        expect(activityStatusSeverity('other')).toBe('secondary');
    });
});

describe('activitySubject', () => {
    it('links a batch, an animal or a group', () => {
        expect(activitySubject({ crop_batch_id: 3, crop_batch_code: 'MZ-01' })).toEqual({ label: 'MZ-01', icon: 'pi pi-th-large', to: '/crops/batches/3' });
        expect(activitySubject({ animal_id: 7, animal_tag_number: 'C-07', animal_name: 'Daisy' })).toMatchObject({ label: 'C-07 (Daisy)', to: '/animals/7' });
        expect(activitySubject({ animal_id: 8, animal_tag_number: 'C-08' }).label).toBe('C-08');
        expect(activitySubject({ animal_id: 9 }).label).toBe('Animal #9');
        expect(activitySubject({ animal_group_id: 2, animal_group_name: 'Layers' })).toMatchObject({ label: 'Layers', to: '/animals/groups/2' });
        expect(activitySubject({ crop_batch_id: 4 }).label).toBe('Batch #4');
    });

    it('is null for farm-level work', () => {
        expect(activitySubject({ activity_type: 'task_work' })).toBeNull();
    });
});

describe('activity cost and totals', () => {
    it('adds the input and other cost, or has none', () => {
        expect(activityCost({ input_cost: '120.50', other_cost: '30' })).toBe(150.5);
        expect(activityCost({ input_cost: null, other_cost: '30' })).toBe(30);
        expect(activityCost({ input_cost: null, other_cost: null })).toBeNull();
    });

    it('sums labour and cost over a page', () => {
        expect(
            activityTotals([
                { labour_hours: '1.5', input_cost: '100', other_cost: null },
                { labour_hours: null, input_cost: null, other_cost: null },
                { labour_hours: 2, input_cost: null, other_cost: '50' }
            ])
        ).toEqual({ hours: 3.5, cost: 150 });
        expect(activityTotals([])).toEqual({ hours: 0, cost: 0 });
    });
});

describe('activityDate', () => {
    it('uses the activity date, then when it happened, then when it is planned', () => {
        expect(activityDate({ activity_date: '2026-09-30' })).toBe('2026-09-30');
        expect(activityDate({ occurred_on: '2026-09-29T08:00:00.000Z' })).toBe('2026-09-29');
        expect(activityDate({ planned_for: '2026-10-05' })).toBe('2026-10-05');
        expect(activityDate({})).toBeNull();
    });
});
