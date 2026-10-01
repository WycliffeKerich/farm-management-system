import api from './api';

/**
 * Farm settings: anyone signed in reads them, the owner changes them
 */
const settingsService = {
    get() {
        return api.get('/settings');
    },

    /**
     * @param {Object} changes - Any of farm_name, currency, timezone, farm_location
     */
    update(changes) {
        return api.put('/settings', changes);
    }
};

export default settingsService;
