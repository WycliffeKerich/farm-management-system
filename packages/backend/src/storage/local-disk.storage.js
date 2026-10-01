const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AppError } = require('../utils/errors');

// Keys are made here: YYYY/MM/<uuid>.<ext>. Anything else is refused, so a
// key can never point outside the root.
const KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

/**
 * StorageAdapter on the local disk. Another adapter (S3-compatible, later)
 * keeps the same methods: newKey, save, open, remove.
 */
class LocalDiskStorage {
  /**
   * @param {string} root - Directory the files live under (outside the web root)
   */
  constructor(root) {
    this.root = path.resolve(root);
  }

  /**
   * A fresh random key for a file of the given extension
   * @param {string} extension - Without the dot
   * @returns {string}
   */
  newKey(extension) {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${extension}`;
  }

  /**
   * Absolute path of a key
   * @param {string} key
   * @returns {string}
   */
  pathOf(key) {
    if (!KEY_PATTERN.test(key)) {
      throw new AppError('Invalid storage key', 500, 'SERVER_ERROR');
    }
    return path.join(this.root, key);
  }

  /**
   * Write a file; never overwrites
   * @param {string} key
   * @param {Buffer} buffer
   * @returns {Promise<void>}
   */
  async save(key, buffer) {
    const target = this.pathOf(key);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, buffer, { flag: 'wx', mode: 0o640 });
  }

  /**
   * A read stream of a stored file
   * @param {string} key
   * @returns {Promise<fs.ReadStream>} Rejects with a 404 AppError when the file is gone
   */
  async open(key) {
    const target = this.pathOf(key);
    try {
      await fs.promises.access(target, fs.constants.R_OK);
    } catch {
      throw new AppError('The file is missing from storage', 404, 'FILE_MISSING');
    }
    return fs.createReadStream(target);
  }

  /**
   * Delete a stored file; a missing file is not an error
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    await fs.promises.rm(this.pathOf(key), { force: true });
  }
}

module.exports = LocalDiskStorage;
