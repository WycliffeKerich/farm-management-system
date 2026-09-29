import { describe, expect, it } from 'vitest';
import { validationMessage } from '@/utils/forms';

const apiError = (error) => ({ response: { data: { success: false, error } } });

describe('validationMessage', () => {
    it('joins field-level validation details', () => {
        const err = apiError({
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: [
                { field: 'email', message: 'Please provide a valid email' },
                { field: 'password', message: 'Password must be at least 10 characters' }
            ]
        });

        expect(validationMessage(err, 'fallback')).toBe('Please provide a valid email. Password must be at least 10 characters');
    });

    it('uses the error message when there are no details', () => {
        expect(validationMessage(apiError({ code: 'LAST_OWNER', message: 'The farm must keep at least one active owner' }), 'fallback')).toBe('The farm must keep at least one active owner');
        expect(validationMessage(apiError({ code: 'X', details: [] }), 'fallback')).toBe('fallback');
    });

    it('falls back when the response carries no API error', () => {
        expect(validationMessage(new Error('Network Error'), 'Could not reach the server')).toBe('Could not reach the server');
        expect(validationMessage(undefined, 'fallback')).toBe('fallback');
    });
});
