import api, { refreshSession, setAccessToken } from './api';

/**
 * Authentication API: session, profile, first-run setup and password reset
 */
const authService = {
    /**
     * @returns {Promise<{user: Object, accessToken: string}>}
     */
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        setAccessToken(response.data.data.accessToken);
        return response.data.data;
    },

    /**
     * Revoke this device's session. The local token is cleared even if the call fails.
     */
    async logout() {
        try {
            await api.post('/auth/logout');
        } finally {
            setAccessToken(null);
        }
    },

    /**
     * Sign out of every device
     */
    async logoutAll() {
        try {
            await api.post('/auth/logout-all');
        } finally {
            setAccessToken(null);
        }
    },

    /**
     * Restore a session from the refresh cookie
     * @returns {Promise<{user: Object, accessToken: string}>}
     */
    refresh() {
        return refreshSession();
    },

    async getCurrentUser() {
        const response = await api.get('/auth/me');
        return response.data.data;
    },

    /**
     * @param {Object} data - { first_name, last_name, phone }
     */
    async updateProfile(data) {
        const response = await api.put('/auth/me', data);
        return response.data.data;
    },

    async changePassword(currentPassword, newPassword, confirmPassword) {
        const response = await api.put('/auth/change-password', { currentPassword, newPassword, confirmPassword });
        return response.data;
    },

    /**
     * @returns {Promise<boolean>} Whether the first owner still has to be created
     */
    async needsSetup() {
        const response = await api.get('/auth/bootstrap');
        return response.data.data.needsSetup;
    },

    /**
     * Create the first owner account
     * @param {Object} data - { email, password, first_name, last_name, phone }
     */
    async bootstrap(data) {
        const response = await api.post('/auth/bootstrap', data);
        return response.data;
    },

    async forgotPassword(email) {
        const response = await api.post('/auth/forgot-password', { email });
        return response.data;
    },

    async resetPassword(token, password) {
        const response = await api.post('/auth/reset-password', { token, password });
        return response.data;
    }
};

export default authService;
