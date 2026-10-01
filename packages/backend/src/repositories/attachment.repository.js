const BaseRepository = require('./base.repository');
const { toPagination } = require('../utils/sql');

/**
 * Repository for attachments (file metadata; the files are in storage)
 */
class AttachmentRepository extends BaseRepository {
  constructor() {
    super('attachments', {
      columns: [
        'entity_type',
        'entity_id',
        'file_name',
        'mime_type',
        'size_bytes',
        'storage_key',
        'caption',
        'uploaded_by',
      ],
      sortable: ['created_at'],
    });
  }

  /**
   * Whether a live row exists in an attachable table
   * @param {string} table - One of ATTACHMENT_ENTITY_TYPES (checked by the caller)
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async entityExists(table, id) {
    const row = await this.db.oneOrNone('SELECT 1 FROM $1:name WHERE id = $2 AND deleted_at IS NULL', [table, id]);
    return row !== null;
  }

  /**
   * A record's live attachments, newest first, with the uploader's name
   * @param {string} entityType
   * @param {number} entityId
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async paginateFor(entityType, entityId, page = 1, limit = 20) {
    const { page: safePage, limit: safeLimit, offset } = toPagination(page, limit);
    const where = 'WHERE a.entity_type = $1 AND a.entity_id = $2 AND a.deleted_at IS NULL';

    const [data, { total }] = await Promise.all([
      this.db.any(
        `SELECT a.id, a.entity_type, a.entity_id, a.file_name, a.mime_type, a.size_bytes, a.caption,
                a.uploaded_by, a.created_at,
                NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS uploaded_by_name
           FROM attachments a
           LEFT JOIN users u ON u.id = a.uploaded_by
           ${where}
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT $3 OFFSET $4`,
        [entityType, entityId, safeLimit, offset]
      ),
      this.db.one(`SELECT COUNT(*)::int AS total FROM attachments a ${where}`, [entityType, entityId]),
    ]);

    return {
      data,
      pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }
}

module.exports = new AttachmentRepository();
