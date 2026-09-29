import api from './api';

/**
 * Withdrawal periods and pre-harvest intervals API service
 */
const withdrawalService = {
    /**
     * Crop batches that cannot be harvested, and animals or groups whose milk,
     * meat or eggs cannot be used, on a date
     * @param {string} [date] - 'YYYY-MM-DD', defaults to today on the server
     */
    getActive(date) {
        return api.get('/withdrawals/active', { params: date ? { date } : {} });
    }
};

export default withdrawalService;
