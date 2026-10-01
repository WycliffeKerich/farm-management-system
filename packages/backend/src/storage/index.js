const path = require('path');
const LocalDiskStorage = require('./local-disk.storage');

let storage;

/**
 * The storage adapter for uploaded files. Local disk under UPLOAD_DIR
 * (default packages/backend/uploads, which is git-ignored and never served
 * as static files).
 * @returns {LocalDiskStorage}
 */
function getStorage() {
  if (!storage) {
    storage = new LocalDiskStorage(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));
  }
  return storage;
}

module.exports = { getStorage };
