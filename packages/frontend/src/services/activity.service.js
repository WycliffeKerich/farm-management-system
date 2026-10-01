import api from './api';

/**
 * The farm timeline: one activity per operational event
 */
const activityService = {
    /**
     * @param {Object} params - page, limit, sort, order and the filters: enterprise_id,
     *   crop_batch_id, animal_id, animal_group_id, performed_by, task_id, status,
     *   activity_type (one or an array), date_from, date_to, search
     */
    list(params = {}) {
        return api.get('/activities', { params, paramsSerializer: { indexes: null } });
    },

    get(id) {
        return api.get(`/activities/${id}`);
    }
};

export default activityService;
