const auditLogService = require('../services/audit-log.service');

/**
 * Controller for the audit log viewer
 */
class AuditLogController {
  async list(req, res, next) {
    try {
      const { page, limit, order, table, record_id, changed_by, action, date_from, date_to } = req.query;
      const result = await auditLogService.getAll(
        parseInt(page, 10) || 1,
        parseInt(limit, 10) || 20,
        { table, record_id, changed_by, action, date_from, date_to },
        order
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuditLogController();
