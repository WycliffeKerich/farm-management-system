const auditLogRepository = require('../repositories/audit-log.repository');

/**
 * The audit log: who changed which record, and how. Written by the database
 * trigger from migration 020; this service only reads it.
 */
class AuditLogService {
  /**
   * Paged changes, newest first unless order is 'asc'
   * @param {number} page
   * @param {number} limit
   * @param {Object} filters - table, record_id, changed_by, action, date_from, date_to
   * @param {string} [order]
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async getAll(page, limit, filters, order) {
    return auditLogRepository.paginate(page, limit, filters, order);
  }
}

module.exports = new AuditLogService();
