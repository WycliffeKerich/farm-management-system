import { describe, expect, it, vi } from 'vitest';
import { createAuthGuard, safeRedirect } from '@/router/guard';

function fakeStore(role) {
    return {
        initialize: vi.fn().mockResolvedValue(!!role),
        isAuthenticated: !!role,
        hasRole: (roles) => !!role && (Array.isArray(roles) ? roles.includes(role) : roles === role)
    };
}

function route(fullPath, ...metas) {
    return { fullPath, meta: Object.assign({}, ...metas), matched: metas.map((meta) => ({ meta })) };
}

const layout = { requiresAuth: true };

describe('auth guard', () => {
    it('waits for the session to be restored before deciding', async () => {
        const store = fakeStore('worker');
        await createAuthGuard(() => store)(route('/crops', layout, {}));
        expect(store.initialize).toHaveBeenCalled();
    });

    it('sends signed-out users to login and remembers the destination', async () => {
        const guard = createAuthGuard(() => fakeStore(null));

        expect(await guard(route('/crops/batches?status=active', layout, {}))).toEqual({ name: 'login', query: { redirect: '/crops/batches?status=active' } });
        expect(await guard(route('/', layout, {}))).toEqual({ name: 'login', query: {} });
    });

    it('lets signed-out users open public pages', async () => {
        const guard = createAuthGuard(() => fakeStore(null));

        expect(await guard(route('/auth/login', { guestOnly: true }))).toBe(true);
        expect(await guard(route('/auth/reset-password?token=abc', {}))).toBe(true);
    });

    it('keeps signed-in users away from guest-only pages', async () => {
        const guard = createAuthGuard(() => fakeStore('worker'));

        expect(await guard(route('/auth/login', { guestOnly: true }))).toEqual({ name: 'dashboard' });
        expect(await guard(route('/auth/setup', { guestOnly: true }))).toEqual({ name: 'dashboard' });
    });

    it('enforces route roles', async () => {
        const usersPage = route('/users', layout, { roles: ['owner'] });

        expect(await createAuthGuard(() => fakeStore('worker'))(usersPage)).toEqual({ name: 'accessDenied' });
        expect(await createAuthGuard(() => fakeStore('manager'))(usersPage)).toEqual({ name: 'accessDenied' });
        expect(await createAuthGuard(() => fakeStore('owner'))(usersPage)).toBe(true);
    });

    it('enforces roles declared on a parent route', async () => {
        const nested = route('/admin/settings', layout, { roles: ['owner', 'manager'] }, {});

        expect(await createAuthGuard(() => fakeStore('worker'))(nested)).toEqual({ name: 'accessDenied' });
        expect(await createAuthGuard(() => fakeStore('manager'))(nested)).toBe(true);
    });
});

describe('safeRedirect', () => {
    it('keeps in-app paths', () => {
        expect(safeRedirect('/crops/batches?status=active')).toBe('/crops/batches?status=active');
    });

    it.each([undefined, null, '', 'https://evil.example', '//evil.example', '/\\evil.example', ['/crops'], 'javascript:alert(1)'])('falls back to / for %j', (redirect) => {
        expect(safeRedirect(redirect)).toBe('/');
    });
});
