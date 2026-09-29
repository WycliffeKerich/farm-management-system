import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError } from 'axios';

/**
 * Every request goes through this adapter; each test decides the responses.
 * It has to be installed before api.js creates its axios instances.
 */
let handler;
const calls = [];

function respond(config, status, data) {
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 200 && status < 300) return Promise.resolve(response);
    return Promise.reject(new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response));
}

let api, setAccessToken, getAccessToken, setSessionExpiredHandler, refreshSession;

beforeAll(async () => {
    axios.defaults.adapter = (config) => {
        calls.push({ url: config.url, authorization: config.headers?.Authorization });
        return handler(config);
    };
    ({ default: api, setAccessToken, getAccessToken, setSessionExpiredHandler, refreshSession } = await import('@/services/api'));
});

afterEach(() => {
    calls.length = 0;
    setAccessToken(null);
    setSessionExpiredHandler(() => {});
});

const refreshCalls = () => calls.filter((call) => call.url === '/auth/refresh').length;
const unauthorized = (config, code = 'TOKEN_EXPIRED') => respond(config, 401, { success: false, error: { code, message: 'Unauthorized' } });

describe('api client', () => {
    it('sends the in-memory access token as a Bearer header', async () => {
        setAccessToken('token-1');
        handler = (config) => respond(config, 200, { success: true });

        await api.get('/crops');

        expect(calls[0].authorization).toBe('Bearer token-1');
    });

    it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
        setAccessToken('expired');
        handler = (config) => {
            if (config.url === '/auth/refresh') {
                return new Promise((resolve) => setTimeout(resolve, 10)).then(() => respond(config, 200, { success: true, data: { user: { id: 1 }, accessToken: 'fresh' } }));
            }
            return config.headers.Authorization === 'Bearer fresh' ? respond(config, 200, { success: true, data: config.url }) : unauthorized(config);
        };

        const results = await Promise.all([api.get('/crops'), api.get('/animals'), api.get('/users')]);

        expect(results.map((response) => response.data.data)).toEqual(['/crops', '/animals', '/users']);
        expect(refreshCalls()).toBe(1);
        expect(getAccessToken()).toBe('fresh');
    });

    it('drops the session and rejects with the original error when the refresh fails', async () => {
        setAccessToken('expired');
        const onExpired = vi.fn();
        setSessionExpiredHandler(onExpired);
        handler = (config) => (config.url === '/auth/refresh' ? respond(config, 401, { success: false, error: { code: 'INVALID_REFRESH_TOKEN' } }) : unauthorized(config));

        await expect(api.get('/crops')).rejects.toMatchObject({ response: { status: 401 }, config: { url: '/crops' } });

        expect(onExpired).toHaveBeenCalledTimes(1);
        expect(getAccessToken()).toBeNull();
    });

    it('retries a request only once', async () => {
        setAccessToken('expired');
        handler = (config) => (config.url === '/auth/refresh' ? respond(config, 200, { success: true, data: { accessToken: 'fresh' } }) : unauthorized(config));

        await expect(api.get('/crops')).rejects.toMatchObject({ response: { status: 401 } });

        expect(calls.filter((call) => call.url === '/crops')).toHaveLength(2);
        expect(refreshCalls()).toBe(1);
    });

    it('does not refresh when an auth endpoint answers 401', async () => {
        handler = (config) => unauthorized(config, 'INVALID_CREDENTIALS');

        await expect(api.post('/auth/login', { email: 'a@b.c', password: 'wrong' })).rejects.toMatchObject({ response: { status: 401 } });

        expect(refreshCalls()).toBe(0);
    });

    it('does not refresh when a wrong current password is rejected', async () => {
        setAccessToken('valid');
        handler = (config) => unauthorized(config, 'INVALID_CREDENTIALS');

        await expect(api.put('/auth/change-password', {})).rejects.toMatchObject({ response: { status: 401 } });

        expect(refreshCalls()).toBe(0);
        expect(getAccessToken()).toBe('valid');
    });

    it('passes non-401 errors straight through', async () => {
        handler = (config) => respond(config, 403, { success: false, error: { code: 'FORBIDDEN' } });

        await expect(api.get('/users')).rejects.toMatchObject({ response: { status: 403 } });

        expect(refreshCalls()).toBe(0);
    });

    it('shares one in-flight refresh between direct callers', async () => {
        handler = (config) => respond(config, 200, { success: true, data: { user: { id: 1 }, accessToken: 'fresh' } });

        const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

        expect(first).toBe(second);
        expect(refreshCalls()).toBe(1);

        await refreshSession();
        expect(refreshCalls()).toBe(2);
    });
});
