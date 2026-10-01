import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, configureFormat, formatBytes, formatConfig, formatDateTime, formatMoney, formatNumber } from '@/utils/format';

describe('formatting with the farm settings', () => {
    afterEach(() => configureFormat());

    it('formats money in the configured currency, defaulting to KES', () => {
        expect(formatMoney(1234.5)).toMatch(/Ksh\s?1,234\.50/);
        expect(formatMoney('99.9')).toMatch(/99\.90/);
        expect(formatMoney(null)).toMatch(/0\.00/);

        configureFormat({ currency: 'USD', timezone: 'UTC' });
        expect(formatConfig).toEqual({ currency: 'USD', timeZone: 'UTC' });
        expect(formatMoney(5)).toMatch(/\$\s?5\.00/);
        expect(formatMoney(5, { currency: 'KES' })).toMatch(/Ksh/);
    });

    it('falls back to the defaults for missing settings', () => {
        configureFormat({ currency: 'EUR' });
        expect(formatConfig.timeZone).toBe(DEFAULT_FORMAT.timeZone);
        configureFormat({});
        expect(formatConfig.currency).toBe('KES');
    });

    it('shows a timestamp in the farm time zone', () => {
        // 21:30 UTC is 00:30 the next day in Nairobi (UTC+3)
        expect(formatDateTime('2026-09-30T21:30:00Z')).toMatch(/1 Oct 2026/);
        configureFormat({ currency: 'KES', timezone: 'UTC' });
        expect(formatDateTime('2026-09-30T21:30:00Z')).toMatch(/30 Sept? 2026/);
        expect(formatDateTime(null)).toBe('');
        expect(formatDateTime('not a date')).toBe('');
    });
});

describe('formatNumber', () => {
    it('groups thousands, keeps up to two decimals and leaves blanks empty', () => {
        expect(formatNumber(12345.678)).toBe('12,345.68');
        expect(formatNumber('7')).toBe('7');
        expect(formatNumber(1.23456, 3)).toBe('1.235');
        expect(formatNumber(0)).toBe('0');
        expect(formatNumber(null)).toBe('');
        expect(formatNumber('')).toBe('');
        expect(formatNumber('abc')).toBe('');
    });
});

describe('formatBytes', () => {
    it('picks bytes, kilobytes or megabytes', () => {
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(2048)).toBe('2 KB');
        expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
        expect(formatBytes(undefined)).toBe('0 B');
    });
});
