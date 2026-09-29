const crypto = require('crypto');

/**
 * Generate an opaque, URL-safe random token
 * @param {number} [bytes=32]
 * @returns {string}
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Hash a token for storage. Tokens are high-entropy, so a fast hash is sufficient.
 * @param {string} token
 * @returns {string} SHA-256 hex digest
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { generateToken, hashToken };
