import { describe, expect, it } from 'vitest';
import { formatApiDate } from '@/utils/dates';
import { describeHold, heldProductFor, holdBadgeLabel, holdProducts, holdTooltip, indexHolds, withdrawalConflict } from '@/utils/withdrawals';

const conflict = (code, details) => ({ response: { status: 409, data: { error: { code, message: 'This harvest falls within the withdrawal period of Lambda; it is safe from 2026-03-08', details } } } });

describe('withdrawal helpers', () => {
    it('reads a WITHDRAWAL_ACTIVE refusal and ignores other errors', () => {
        const holds = [{ source: 'crop_input_application', id: 3, product_name: 'Lambda', applied_on: '2026-03-01', safe_from: '2026-03-08' }];

        expect(withdrawalConflict(conflict('WITHDRAWAL_ACTIVE', { safe_from: '2026-03-08', holds }))).toEqual({
            message: 'This harvest falls within the withdrawal period of Lambda; it is safe from 2026-03-08',
            safe_from: '2026-03-08',
            holds
        });
        expect(withdrawalConflict(conflict('WITHDRAWAL_ACTIVE', undefined))).toMatchObject({ safe_from: null, holds: [] });
        expect(withdrawalConflict(conflict('DUPLICATE_ENTRY', {}))).toBeNull();
        expect(withdrawalConflict({ response: { status: 403, data: { error: { code: 'WITHDRAWAL_ACTIVE' } } } })).toBeNull();
        expect(withdrawalConflict(new Error('Network Error'))).toBeNull();
    });

    it('indexes holds by batch, animal and group', () => {
        const index = indexHolds({
            crops: [{ batch_id: 4, product: 'harvest', safe_from: '2026-03-08', holds: [] }],
            animals: [
                { animal_id: 7, animal_group_id: null, product: 'meat', safe_from: '2026-03-16', holds: [] },
                { animal_id: 7, animal_group_id: null, product: 'milk', safe_from: '2026-03-09', holds: [] },
                { animal_id: null, animal_group_id: 2, product: 'egg', safe_from: '2026-03-06', holds: [] }
            ]
        });

        expect(index.batches.get(4).safe_from).toBe('2026-03-08');
        expect(index.animals.get(7).map((entry) => entry.product)).toEqual(['meat', 'milk']);
        expect(index.groups.get(2).map((entry) => entry.product)).toEqual(['egg']);
        expect(index.animals.has(2)).toBe(false);

        const empty = indexHolds(null);
        expect([empty.batches.size, empty.animals.size, empty.groups.size]).toEqual([0, 0, 0]);
    });

    it('labels holds for badges and refusals', () => {
        const entry = {
            product: 'meat',
            safe_from: '2026-03-16',
            holds: [
                { product_name: 'Oxytetracycline', applied_on: '2026-03-01', safe_from: '2026-03-16', disease_name: 'Mastitis' },
                { product_name: 'Oxytetracycline', applied_on: '2026-03-02', safe_from: '2026-03-12' },
                { product_name: 'Penicillin', applied_on: '2026-03-02', safe_from: '2026-03-10' }
            ]
        };

        expect(holdBadgeLabel(entry)).toBe(`Meat: safe ${formatApiDate('2026-03-16')}`);
        expect(holdProducts(entry)).toBe('Oxytetracycline, Penicillin');
        expect(holdTooltip(entry)).toBe('Withdrawal period: Oxytetracycline, Penicillin');
        expect(holdTooltip({ product: 'harvest', holds: [] })).toBe('Pre-harvest interval');
        expect(describeHold(entry.holds[0])).toBe(`Oxytetracycline for Mastitis, applied ${formatApiDate('2026-03-01')}: safe from ${formatApiDate('2026-03-16')}`);
        expect(describeHold(entry.holds[2])).toMatch(/^Penicillin, applied /);
    });

    it('maps production categories to the product a withdrawal holds', () => {
        expect(['milk', 'eggs', 'meat', 'wool'].map(heldProductFor)).toEqual(['milk', 'egg', 'meat', null]);
    });
});
