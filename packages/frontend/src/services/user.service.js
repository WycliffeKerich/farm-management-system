import api from './api';

/**
 * User management (owner only)
 */
const userService = {
    /**
     * @param {Object} params - { role, is_active, search }
     */
    async list(params = {}) {
        const response = await api.get('/users', { params });
        return response.data.data;
    },

    /**
     * A user with their active sessions
     */
    async get(id) {
        const response = await api.get(`/users/${id}`);
        return response.data.data;
    },

    /**
     * @param {Object} data - { email, password, first_name, last_name, phone, role }
     */
    async create(data) {
        const response = await api.post('/users', data);
        return response.data.data;
    },

    /**
     * @param {Object} data - Any of { email, first_name, last_name, phone, role, is_active }
     */
    async update(id, data) {
        const response = await api.put(`/users/${id}`, data);
        return response.data.data;
    },

    async setPassword(id, password) {
        const response = await api.put(`/users/${id}/password`, { password });
        return response.data;
    },

    /**
     * Sign the user out of every device
     * @returns {Promise<number>} Sessions revoked
     */
    async revokeSessions(id) {
        const response = await api.delete(`/users/${id}/sessions`);
        return response.data.data.revoked;
    }
};

export default userService;
