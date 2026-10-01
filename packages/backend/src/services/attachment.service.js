const path = require('path');
const attachmentRepository = require('../repositories/attachment.repository');
const { getStorage } = require('../storage');
const { detectFileType, ALLOWED_MIME_TYPES } = require('../utils/file-types');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');

// Records only some roles may see, and so only they may attach to or read from
const RESTRICTED_ENTITIES = { financial_transactions: ['owner', 'manager'] };
// Who may remove someone else's attachment
const MODERATORS = ['owner', 'manager'];

/**
 * An attachment as the API shows it (the storage key stays inside)
 * @param {Object} row
 * @returns {Object}
 */
function present(row) {
  const { storage_key: _storageKey, deleted_at: _deletedAt, ...shown } = row;
  return shown;
}

/**
 * The name to keep for an uploaded file: no directories, no control characters
 * @param {string} name
 * @returns {string}
 */
function cleanFileName(name) {
  // eslint-disable-next-line no-control-regex
  const base = path.basename(String(name || '').replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '');
  return base.trim().slice(-255) || 'file';
}

/**
 * Files attached to records: pest photos, treatment notes, receipts, inspections
 */
class AttachmentService {
  /**
   * Refuse records the user may not see
   * @param {string} entityType
   * @param {Object} user - req.user
   */
  assertMaySee(entityType, user) {
    const roles = RESTRICTED_ENTITIES[entityType];
    if (roles && !roles.includes(user.role)) {
      throw new AuthorizationError('Insufficient permissions');
    }
  }

  /**
   * A live attachment the user may see
   * @param {number} id
   * @param {Object} user
   * @returns {Promise<Object>} The full row, storage key included
   */
  async findVisible(id, user) {
    const attachment = await attachmentRepository.findById(id);
    if (!attachment) {
      throw new NotFoundError('Attachment not found');
    }
    this.assertMaySee(attachment.entity_type, user);
    return attachment;
  }

  /**
   * A record's attachments, paged
   * @param {string} entityType
   * @param {number} entityId
   * @param {Object} user
   * @param {number} page
   * @param {number} limit
   */
  async listFor(entityType, entityId, user, page, limit) {
    this.assertMaySee(entityType, user);
    return attachmentRepository.paginateFor(entityType, entityId, page, limit);
  }

  /**
   * Store an uploaded file and attach it to a record
   * @param {Object} file - multer file (memory storage): originalname, buffer, size
   * @param {Object} data - entity_type, entity_id, caption
   * @param {Object} user - req.user
   * @returns {Promise<Object>} The attachment
   */
  async upload(file, data, user) {
    if (!file || !file.buffer || file.size === 0) {
      throw new ValidationError('A file is required');
    }
    this.assertMaySee(data.entity_type, user);

    const type = detectFileType(file.buffer);
    if (!type) {
      throw new ValidationError(`Only these file types can be uploaded: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
    if (!(await attachmentRepository.entityExists(data.entity_type, data.entity_id))) {
      throw new NotFoundError('The record to attach to was not found');
    }

    const storage = getStorage();
    const storageKey = storage.newKey(type.extension);
    await storage.save(storageKey, file.buffer);
    try {
      const attachment = await attachmentRepository.create({
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        file_name: cleanFileName(file.originalname),
        mime_type: type.mime,
        size_bytes: file.size,
        storage_key: storageKey,
        caption: data.caption ?? null,
        uploaded_by: user.id,
      });
      return present(attachment);
    } catch (error) {
      await storage.remove(storageKey);
      throw error;
    }
  }

  /**
   * An attachment's details and a stream of its file
   * @param {number} id
   * @param {Object} user
   * @returns {Promise<{attachment: Object, stream: import('stream').Readable}>}
   */
  async open(id, user) {
    const attachment = await this.findVisible(id, user);
    const stream = await getStorage().open(attachment.storage_key);
    return { attachment: present(attachment), stream };
  }

  /**
   * Change an attachment's caption (its uploader, an owner or a manager)
   * @param {number} id
   * @param {Object} data - caption
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  async update(id, data, user) {
    const attachment = await this.findVisible(id, user);
    this.assertMayChange(attachment, user);
    return present(await attachmentRepository.update(id, { caption: data.caption ?? null }));
  }

  /**
   * Remove an attachment (its uploader, an owner or a manager). The row is
   * soft-deleted and the file kept, so the audit log still points at it.
   * @param {number} id
   * @param {Object} user
   */
  async delete(id, user) {
    const attachment = await this.findVisible(id, user);
    this.assertMayChange(attachment, user);
    await attachmentRepository.softDelete(id);
  }

  /**
   * @param {Object} attachment
   * @param {Object} user
   */
  assertMayChange(attachment, user) {
    if (attachment.uploaded_by !== user.id && !MODERATORS.includes(user.role)) {
      throw new AuthorizationError('Only the uploader, an owner or a manager can change this attachment');
    }
  }
}

module.exports = new AttachmentService();
