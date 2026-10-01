import { describe, expect, it } from 'vitest';
import { daysUntil, formatAge, fromApiDate, toApiDate } from '@/utils/dates';

describe('fromApiDate', () => {
    it('reads a DATE string as local midnight, so it round-trips', () => {
        const date = fromApiDate('2026-01-29');
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 0, 29, 0]);
        expect(toApiDate(fromApiDate('2026-12-31'))).toBe('2026-12-31');
        expect(fromApiDate(null)).toBeNull();
        expect(fromApiDate('garbage')).toBeNull();
    });
});

describe('daysUntil', () => {
    const now = new Date(2026, 8, 29, 18, 30);

    it('counts calendar days, ignoring the time of day', () => {
        expect(daysUntil('2026-09-29', now)).toBe(0);
        expect(daysUntil('2026-10-29', now)).toBe(30);
        expect(daysUntil('2026-09-28', now)).toBe(-1);
        expect(daysUntil(null, now)).toBeNull();
    });
});

describe('toApiDate', () => {
    it('keeps the calendar day of a DatePicker value (local midnight)', () => {
        expect(toApiDate(new Date(2026, 0, 29))).toBe('2026-01-29');
        expect(toApiDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    });

    it('passes DATE strings from the API through unchanged', () => {
        expect(toApiDate('2026-03-01')).toBe('2026-03-01');
    });

    it('returns null for empty or invalid values', () => {
        expect(toApiDate(null)).toBeNull();
        expect(toApiDate('')).toBeNull();
        expect(toApiDate('not a date')).toBeNull();
    });
});

describe('formatAge', () => {
    const now = new Date(2026, 9, 1, 9, 0);

    it('counts days, then months, then years and months', () => {
        expect(formatAge('2026-10-01', now)).toBe('0 days');
        expect(formatAge('2026-09-30', now)).toBe('1 day');
        expect(formatAge('2026-08-15', now)).toBe('47 days');
        expect(formatAge('2026-08-01', now)).toBe('2 months');
        expect(formatAge('2025-10-02', now)).toBe('11 months');
        expect(formatAge('2024-10-01', now)).toBe('2 years');
        expect(formatAge('2023-07-01', now)).toBe('3 y 3 m');
    });

    it('is empty for a future or missing date', () => {
        expect(formatAge('2026-10-02', now)).toBe('');
        expect(formatAge(null, now)).toBe('');
    });
});
