const { AsyncResource } = require('node:async_hooks');
const multer = require('multer');
const { AppError, ValidationError } = require('../utils/errors');

const MAX_UPLOAD_MB = parseInt(process.env.UPLOAD_MAX_MB || '10', 10);

/**
 * Accept one file in the multipart field `fieldName`, held in memory (the
 * service checks its contents before anything is written to storage), plus a
 * few small text fields.
 * @param {string} fieldName
 * @returns {Function} Express middleware
 */
function singleUpload(fieldName) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 10 * 1024 },
  }).single(fieldName);

  return (req, res, next) => {
    // multer calls back from the request stream's events; binding keeps the
    // request's context (the acting user the audit log reads)
    upload(
      req,
      res,
      AsyncResource.bind((error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(`The file is larger than ${MAX_UPLOAD_MB} MB`, 413, 'FILE_TOO_LARGE'));
          }
          return next(new ValidationError(`Upload refused: ${error.message}`));
        }
        return next(error);
      })
    );
  };
}

module.exports = { singleUpload, MAX_UPLOAD_MB };
