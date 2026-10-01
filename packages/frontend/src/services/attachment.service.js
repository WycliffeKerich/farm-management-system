import api from './api';

/**
 * Photos and documents attached to records
 */
const attachmentService = {
    /**
     * A record's attachments, newest first
     * @param {string} entityType - e.g. activities
     * @param {number} entityId
     */
    list(entityType, entityId, params = {}) {
        return api.get('/attachments', { params: { entity_type: entityType, entity_id: entityId, limit: 100, ...params } });
    },

    /**
     * @param {string} entityType
     * @param {number} entityId
     * @param {File} file
     * @param {string} [caption]
     */
    upload(entityType, entityId, file, caption) {
        const form = new FormData();
        form.append('entity_type', entityType);
        form.append('entity_id', String(entityId));
        if (caption) form.append('caption', caption);
        form.append('file', file);
        // Not the default JSON type, which would serialise the form; in the browser
        // axios then leaves the header to the browser, which adds the boundary
        return api.post('/attachments', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },

    /**
     * The file as a Blob; it needs the access token, so it cannot be a plain link
     * @param {number} id
     */
    async file(id) {
        const response = await api.get(`/attachments/${id}`, { responseType: 'blob' });
        return response.data;
    },

    updateCaption(id, caption) {
        return api.put(`/attachments/${id}`, { caption });
    },

    delete(id) {
        return api.delete(`/attachments/${id}`);
    }
};

export default attachmentService;
