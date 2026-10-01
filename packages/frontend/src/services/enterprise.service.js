import api from './api';

/**
 * Enterprises: the farm's lines of business, for costing and the timeline
 */
const enterpriseService = {
    /**
     * @param {Object} params - page, limit, sort, order, enterprise_type, is_active
     */
    list(params = {}) {
        return api.get('/enterprises', { params });
    },

    /**
     * With counts of the batches, animals, groups and activities under it
     */
    get(id) {
        return api.get(`/enterprises/${id}`);
    },

    create(data) {
        return api.post('/enterprises', data);
    },

    update(id, data) {
        return api.put(`/enterprises/${id}`, data);
    },

    delete(id) {
        return api.delete(`/enterprises/${id}`);
    }
};

export default enterpriseService;
