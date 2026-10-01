import api from './api';

/**
 * Inventory management API service
 */
const inventoryService = {
    // ==================== SUMMARY ====================

    getSummary() {
        return api.get('/inventory/summary');
    },

    // ==================== STOCK ALERTS ====================

    getLowStockItems() {
        return api.get('/inventory/low-stock');
    },

    getExpiringItems(days = 30) {
        return api.get('/inventory/expiring', { params: { days } });
    },

    // ==================== CATEGORIES ====================

    getCategories() {
        return api.get('/inventory/categories');
    },

    getCategoryById(id) {
        return api.get(`/inventory/categories/${id}`);
    },

    createCategory(data) {
        return api.post('/inventory/categories', data);
    },

    updateCategory(id, data) {
        return api.put(`/inventory/categories/${id}`, data);
    },

    deleteCategory(id) {
        return api.delete(`/inventory/categories/${id}`);
    },

    // ==================== ITEMS ====================

    getItems(params = {}) {
        return api.get('/inventory/items', { params });
    },

    getItemById(id) {
        return api.get(`/inventory/items/${id}`);
    },

    getItemByCode(code) {
        return api.get(`/inventory/items/code/${code}`);
    },

    createItem(data) {
        return api.post('/inventory/items', data);
    },

    updateItem(id, data) {
        return api.put(`/inventory/items/${id}`, data);
    },

    deleteItem(id) {
        return api.delete(`/inventory/items/${id}`);
    },

    // ==================== TRANSACTIONS ====================

    getTransactions(params = {}) {
        return api.get('/inventory/transactions', { params });
    },

    createTransaction(data) {
        return api.post('/inventory/transactions', data);
    },

    /** Use stock from the item's batches, earliest expiry first */
    useStock(itemId, data) {
        return api.post(`/inventory/items/${itemId}/use`, data);
    },

    // ==================== REPORTS ====================

    getUsageReport(itemId, dateFrom, dateTo) {
        return api.get(`/inventory/items/${itemId}/usage-report`, {
            params: { date_from: dateFrom, date_to: dateTo }
        });
    },

    /** Stock value by category and item, at batch cost where known */
    getValuationReport(params = {}) {
        return api.get('/inventory/reports/valuation', { params });
    },

    /** Items at or below minimum stock, with a suggested order and supplier */
    getReorderReport(usageDays = 30) {
        return api.get('/inventory/reports/reorder', { params: { usage_days: usageDays } });
    },

    /** Batches expired or expiring within `days`, with the value at risk */
    getExpiringReport(days = 30) {
        return api.get('/inventory/reports/expiring', { params: { days } });
    },

    // ==================== SUPPLIERS ====================

    getSuppliers(params = {}) {
        return api.get('/suppliers', { params });
    },

    getSupplier(id) {
        return api.get(`/suppliers/${id}`);
    },

    createSupplier(data) {
        return api.post('/suppliers', data);
    },

    updateSupplier(id, data) {
        return api.put(`/suppliers/${id}`, data);
    },

    deleteSupplier(id) {
        return api.delete(`/suppliers/${id}`);
    },

    // ==================== UNITS OF MEASURE ====================

    getUnitsOfMeasure(category = null) {
        const params = category ? { category } : {};
        return api.get('/inventory/units', { params });
    },

    getUnitCategories() {
        return api.get('/inventory/units/categories');
    },

    getUnitById(id) {
        return api.get(`/inventory/units/${id}`);
    },

    createUnit(data) {
        return api.post('/inventory/units', data);
    },

    updateUnit(id, data) {
        return api.put(`/inventory/units/${id}`, data);
    },

    deleteUnit(id) {
        return api.delete(`/inventory/units/${id}`);
    },

    convertUnits(quantity, fromUnitId, toUnitId) {
        return api.post('/inventory/units/convert', {
            quantity,
            from_unit_id: fromUnitId,
            to_unit_id: toUnitId
        });
    },

    // ==================== BATCHES ====================

    getBatches(params = {}) {
        return api.get('/inventory/batches', { params });
    },

    getBatchById(id) {
        return api.get(`/inventory/batches/${id}`);
    },

    getItemBatches(itemId, options = {}) {
        return api.get(`/inventory/items/${itemId}/batches`, { params: options });
    },

    getExpiringBatches(days = 30) {
        return api.get('/inventory/batches/expiring', { params: { days } });
    },

    getExpiredBatches() {
        return api.get('/inventory/batches/expired');
    },

    createBatch(data) {
        return api.post('/inventory/batches', data);
    },

    updateBatch(id, data) {
        return api.put(`/inventory/batches/${id}`, data);
    },

    deleteBatch(id) {
        return api.delete(`/inventory/batches/${id}`);
    },

    markExpiredBatches() {
        return api.post('/inventory/batches/mark-expired');
    }
};

export default inventoryService;
