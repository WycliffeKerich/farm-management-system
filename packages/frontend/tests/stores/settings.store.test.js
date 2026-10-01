import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import settingsService from '@/services/settings.service';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings.store';
import { configureFormat, formatConfig } from '@/utils/format';

vi.mock('@/services/settings.service', () => ({
    default: { get: vi.fn(), update: vi.fn() }
}));

const farm = { farm_name: 'Kerich Farm', currency: 'USD', timezone: 'UTC', farm_location: null };

describe('settings store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    afterEach(() => configureFormat());

    it('loads once, even when asked twice at the same time, and formats with the result', async () => {
        settingsService.get.mockResolvedValue({ data: { data: farm } });
        const store = useSettingsStore();

        await Promise.all([store.load(), store.load()]);
        await store.load();

        expect(settingsService.get).toHaveBeenCalledTimes(1);
        expect(store.loaded).toBe(true);
        expect(store.settings).toEqual(farm);
        expect(formatConfig).toEqual({ currency: 'USD', timeZone: 'UTC' });

        await store.load({ force: true });
        expect(settingsService.get).toHaveBeenCalledTimes(2);
    });

    it('keeps the defaults when loading fails', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        settingsService.get.mockRejectedValue(new Error('offline'));
        const store = useSettingsStore();

        expect(await store.load()).toEqual(DEFAULT_SETTINGS);
        expect(store.loaded).toBe(false);
        expect(formatConfig.currency).toBe('KES');
        error.mockRestore();
    });

    it('saves changes and applies what the server returns', async () => {
        settingsService.update.mockResolvedValue({ data: { data: { ...farm, currency: 'EUR' } } });
        const store = useSettingsStore();

        await store.save({ currency: 'EUR' });

        expect(settingsService.update).toHaveBeenCalledWith({ currency: 'EUR' });
        expect(store.settings.currency).toBe('EUR');
        expect(store.loaded).toBe(true);
        expect(formatConfig.currency).toBe('EUR');
    });
});
