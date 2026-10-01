const { db } = require('../config/database');
const { toPagination } = require('../utils/sql');

// Columns the audit log can be filtered on by equality
const EQUALITY_FILTERS = { table: 'al.table_name', record_id: 'al.record_id', changed_by: 'al.changed_by' };

/**
 * Read access to audit_log. Rows are written only by the audit trigger
 * (migration 020), never by the app.
 */
class AuditLogRepository {
  /**
   * Changes, newest first, with the name of who made them and, for updates,
   * which fields changed
   * @param {number} page - Page number
   * @param {number} limit - Page size
   * @param {Object} [filters] - table, record_id, changed_by, action (one or an array), date_from, date_to
   * @param {string} [order] - 'asc' or 'desc' (by changed_at)
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async paginate(page = 1, limit = 50, filters = {}, order = 'desc') {
    const { page: safePage, limit: safeLimit, offset } = toPagination(page, limit);
    const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];
    const param = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    for (const [key, column] of Object.entries(EQUALITY_FILTERS)) {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        conditions.push(`${column} = ${param(filters[key])}`);
      }
    }
    if (filters.action) conditions.push(`al.action = ANY(${param([].concat(filters.action))}::text[])`);
    if (filters.date_from) conditions.push(`al.changed_at >= ${param(filters.date_from)}::date`);
    if (filters.date_to) conditions.push(`al.changed_at < ${param(filters.date_to)}::date + 1`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const paging = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [data, { total }] = await Promise.all([
      db.any(
        `SELECT al.*,
                NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS changed_by_name,
                CASE WHEN al.before IS NOT NULL AND al.after IS NOT NULL THEN
                  ARRAY(SELECT key FROM jsonb_object_keys(al.after) AS key
                         WHERE key <> 'updated_at' AND al.before -> key IS DISTINCT FROM al.after -> key
                         ORDER BY key)
                END AS changed_fields
           FROM audit_log al
           LEFT JOIN users u ON u.id = al.changed_by
           ${where}
          ORDER BY al.changed_at ${direction}, al.id ${direction}
          ${paging}`,
        [...params, safeLimit, offset]
      ),
      db.one(`SELECT COUNT(*)::int AS total FROM audit_log al ${where}`, params),
    ]);

    return {
      data,
      pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }
}

module.exports = new AuditLogRepository();
