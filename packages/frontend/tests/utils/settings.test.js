import { describe, expect, it } from 'vitest';
import { fieldErrors, settingsChanges, settingsFormErrors, supportedValues, toSettingsForm } from '@/utils/settings';

const saved = { farm_name: 'Kerich Farm', currency: 'KES', timezone: 'Africa/Nairobi', farm_location: { latitude: -0.5, longitude: 35.27 } };

describe('toSettingsForm', () => {
    it('splits the location into two numbers', () => {
        expect(toSettingsForm(saved)).toEqual({ farm_name: 'Kerich Farm', currency: 'KES', timezone: 'Africa/Nairobi', latitude: -0.5, longitude: 35.27 });
        expect(toSettingsForm({})).toEqual({ farm_name: '', currency: null, timezone: null, latitude: null, longitude: null });
    });
});

describe('settingsFormErrors', () => {
    const form = (changes) => ({ ...toSettingsForm(saved), ...changes });

    it('accepts a complete form, with or without a location', () => {
        expect(settingsFormErrors(form())).toEqual({});
        expect(settingsFormErrors(form({ latitude: null, longitude: null }))).toEqual({});
        expect(settingsFormErrors(form({ latitude: 0, longitude: 0 }))).toEqual({});
    });

    it('requires a name, a currency and a time zone', () => {
        expect(settingsFormErrors(form({ farm_name: '  ', currency: null, timezone: '' }))).toEqual({
            farm_name: 'Farm name is required',
            currency: 'Currency is required',
            timezone: 'Time zone is required'
        });
        expect(settingsFormErrors(form({ farm_name: 'x'.repeat(101) })).farm_name).toMatch(/100/);
    });

    it('wants both coordinates or neither, within range', () => {
        expect(settingsFormErrors(form({ longitude: null })).farm_location).toMatch(/both/);
        expect(settingsFormErrors(form({ latitude: 91 })).farm_location).toMatch(/-90 to 90/);
        expect(settingsFormErrors(form({ longitude: -181 })).farm_location).toMatch(/-180 to 180/);
    });
});

describe('settingsChanges', () => {
    it('sends only what changed', () => {
        expect(settingsChanges(saved, toSettingsForm(saved))).toEqual({});
        expect(settingsChanges(saved, { ...toSettingsForm(saved), farm_name: ' New Name ', currency: 'USD' })).toEqual({ farm_name: 'New Name', currency: 'USD' });
    });

    it('sends the whole location when a coordinate changes, and null to clear it', () => {
        expect(settingsChanges(saved, { ...toSettingsForm(saved), latitude: -0.6 })).toEqual({ farm_location: { latitude: -0.6, longitude: 35.27 } });
        expect(settingsChanges(saved, { ...toSettingsForm(saved), latitude: null, longitude: null })).toEqual({ farm_location: null });
        expect(settingsChanges({ ...saved, farm_location: null }, { ...toSettingsForm(saved), latitude: null, longitude: null })).toEqual({});
    });
});

describe('fieldErrors', () => {
    it('maps validation details by field', () => {
        const err = { response: { data: { error: { details: [{ field: 'currency', message: 'Unknown currency' }, { message: 'no field' }] } } } };
        expect(fieldErrors(err)).toEqual({ currency: 'Unknown currency' });
        expect(fieldErrors(new Error('network'))).toEqual({});
    });
});

describe('supportedValues', () => {
    it('lists what Intl supports, or the fallback', () => {
        expect(supportedValues('currency', [])).toContain('KES');
        expect(supportedValues('not-a-key', ['KES'])).toEqual(['KES']);
    });
});
