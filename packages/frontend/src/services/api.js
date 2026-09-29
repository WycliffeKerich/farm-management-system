import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

/**
 * The access token lives only in memory, never in localStorage, so a script
 * injected into the page cannot lift a long-lived credential. On reload the
 * session is restored from the httpOnly refresh cookie via /auth/refresh.
 */
let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

export const getAccessToken = () => accessToken;

export function setAccessToken(token) {
    accessToken = token || null;
}

/**
 * Called once a refresh has failed, i.e. the session is gone for good
 * @param {Function} handler
 */
export function setSessionExpiredHandler(handler) {
    onSessionExpired = handler;
}

// Requests that must never trigger a refresh-and-retry
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/bootstrap', '/auth/forgot-password', '/auth/reset-password'];

const isAuthEndpoint = (url = '') => AUTH_ENDPOINTS.some((path) => url.startsWith(path) || url.startsWith(`${baseURL}${path}`));

/**
 * Plain client (no interceptors) used for the refresh call itself
 */
const bare = axios.create({ baseURL, withCredentials: true });

/**
 * Exchange the refresh cookie for a new access token. Concurrent callers share
 * one request: the refresh token rotates on every use, so two parallel refreshes
 * would present the same token twice and trip reuse detection.
 * @returns {Promise<{user: Object, accessToken: string}>}
 */
export function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = bare
            .post('/auth/refresh')
            .then((response) => {
                const data = response.data.data;
                setAccessToken(data.accessToken);
                return data;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

/**
 * Axios instance configured for the Farm Management API
 */
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        // INVALID_CREDENTIALS is a wrong password (e.g. change-password), not an expired session
        if (error.response?.status !== 401 || error.response.data?.error?.code === 'INVALID_CREDENTIALS' || !original || original._retry || isAuthEndpoint(original.url)) {
            return Promise.reject(error);
        }

        original._retry = true;
        try {
            await refreshSession();
        } catch (refreshError) {
            setAccessToken(null);
            onSessionExpired();
            return Promise.reject(error);
        }

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
    }
);

export default api;
