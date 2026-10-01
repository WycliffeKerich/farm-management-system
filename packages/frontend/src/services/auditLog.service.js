import api from './api';

/**
 * The audit trail (owner only)
 */
const auditLogService = {
    /**
     * @param {Object} params - page, limit, order, table, record_id, changed_by,
     *   action (one or an array), date_from, date_to
     */
    list(params = {}) {
        return api.get('/audit-log', { params, paramsSerializer: { indexes: null } });
    }
};

export default auditLogService;
