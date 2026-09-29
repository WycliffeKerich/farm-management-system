import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getAccessToken, setAccessToken } from '@/services/api';
import authService from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/services/auth.service', () => ({
    default: {
        login: vi.fn(),
        logout: vi.fn(),
        logoutAll: vi.fn(),
        refresh: vi.fn(),
        updateProfile: vi.fn()
    }
}));

const owner = { id: 1, email: 'owner@farm.test', first_name: 'Ada', last_name: 'Owner', role: 'owner' };
const apiError = (message) => Object.assign(new Error(message), { response: { data: { error: { message } } } });

describe('auth store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        setAccessToken(null);
    });

    it('signs in and exposes the user', async () => {
        authService.login.mockResolvedValue({ user: owner, accessToken: 'token' });
        const store = useAuthStore();

        expect(await store.login('owner@farm.test', 'secret-password')).toBe(true);

        expect(store.isAuthenticated).toBe(true);
        expect(store.userName).toBe('Ada Owner');
        expect(store.hasRole('owner')).toBe(true);
        expect(store.hasRole(['manager', 'worker'])).toBe(false);
        expect(store.initialized).toBe(true);
    });

    it('reports a failed sign-in', async () => {
        authService.login.mockRejectedValue(apiError('Invalid email or password'));
        const store = useAuthStore();

        expect(await store.login('owner@farm.test', 'wrong')).toBe(false);

        expect(store.isAuthenticated).toBe(false);
        expect(store.error).toBe('Invalid email or password');
        expect(store.loading).toBe(false);
    });

    it('restores the session from the refresh cookie once', async () => {
        authService.refresh.mockResolvedValue({ user: owner, accessToken: 'token' });
        const store = useAuthStore();

        const [first, second] = await Promise.all([store.initialize(), store.initialize()]);
        const third = await store.initialize();

        expect([first, second, third]).toEqual([true, true, true]);
        expect(authService.refresh).toHaveBeenCalledTimes(1);
        expect(store.user).toEqual(owner);
        expect(store.initialized).toBe(true);
    });

    it('starts signed out when there is no session to restore', async () => {
        authService.refresh.mockRejectedValue(apiError('Invalid refresh token'));
        setAccessToken('stale');
        const store = useAuthStore();

        expect(await store.initialize()).toBe(false);

        expect(store.isAuthenticated).toBe(false);
        expect(store.initialized).toBe(true);
        expect(getAccessToken()).toBeNull();
    });

    it('clears the session on logout even if the API call fails', async () => {
        authService.login.mockResolvedValue({ user: owner, accessToken: 'token' });
        authService.logout.mockRejectedValue(new Error('Network Error'));
        const store = useAuthStore();
        await store.login('owner@farm.test', 'secret-password');
        setAccessToken('token');

        await store.logout();

        expect(store.user).toBeNull();
        expect(getAccessToken()).toBeNull();
    });

    it('merges profile changes into the signed-in user', async () => {
        authService.login.mockResolvedValue({ user: owner, accessToken: 'token' });
        authService.updateProfile.mockResolvedValue({ ...owner, phone: '+254700000000' });
        const store = useAuthStore();
        await store.login('owner@farm.test', 'secret-password');

        expect(await store.updateProfile({ phone: '+254700000000' })).toBe(true);

        expect(store.user.phone).toBe('+254700000000');
    });
});
