const { pipeline } = require('stream/promises');
const attachmentService = require('../services/attachment.service');

/**
 * Content-Disposition for a stored file name, ASCII-safe with a UTF-8 form
 * @param {string} disposition - inline or attachment
 * @param {string} fileName
 * @returns {string}
 */
function contentDisposition(disposition, fileName) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Controller for attachment endpoints
 */
class AttachmentController {
  async list(req, res, next) {
    try {
      const { entity_type, entity_id, page, limit } = req.query;
      const result = await attachmentService.listFor(
        entity_type,
        entity_id,
        req.user,
        parseInt(page, 10) || 1,
        parseInt(limit, 10) || 20
      );
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async upload(req, res, next) {
    try {
      const attachment = await attachmentService.upload(req.file, req.body, req.user);
      res.status(201).json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  }

  // The file itself: shown in the browser, or saved with ?download=true
  async download(req, res, next) {
    try {
      const { attachment, stream } = await attachmentService.open(req.params.id, req.user);
      const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
      res.set({
        'Content-Type': attachment.mime_type,
        'Content-Length': String(attachment.size_bytes),
        'Content-Disposition': contentDisposition(disposition, attachment.file_name),
        'Cache-Control': 'private, max-age=300',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      });
      await pipeline(stream, res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error);
      } else {
        next(error);
      }
    }
  }

  async update(req, res, next) {
    try {
      const attachment = await attachmentService.update(req.params.id, req.body, req.user);
      res.json({ success: true, data: attachment });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await attachmentService.delete(req.params.id, req.user);
      res.json({ success: true, message: 'Attachment deleted' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AttachmentController();
