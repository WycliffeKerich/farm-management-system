import api from './api';

/**
 * Authentication service for login, logout, and user management
 */
const authService = {
    /**
     * Login user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} Login response with user and token
     */
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },

    /**
     * Logout current user
     * @returns {Promise<void>}
     */
    async logout() {
        try {
            await api.post('/auth/logout');
        } finally {
            localStorage.removeItem('accessToken');
        }
    },

    /**
     * Get current user profile
     * @returns {Promise<Object>} User profile data
     */
    async getCurrentUser() {
        const response = await api.get('/auth/me');
        return response.data;
    },

    /**
     * Refresh access token
     * @returns {Promise<Object>} New access token
     */
    async refreshToken() {
        const response = await api.post('/auth/refresh');
        return response.data;
    },

    /**
     * Update user profile
     * @param {Object} data - Profile data to update
     * @returns {Promise<Object>} Updated user profile
     */
    async updateProfile(data) {
        const response = await api.put('/auth/profile', data);
        return response.data;
    },

    /**
     * Change user password
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<Object>} Success response
     */
    async changePassword(currentPassword, newPassword) {
        const response = await api.put('/auth/password', {
            currentPassword,
            newPassword
        });
        return response.data;
    }
};

export default authService;
