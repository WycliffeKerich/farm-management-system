/**
 * The kinds of file that can be uploaded, told apart by their first bytes.
 * The type the browser claims is never trusted.
 */
const FILE_TYPES = [
  { mime: 'image/jpeg', extension: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    extension: 'png',
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    matches: (b) => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
  },
  { mime: 'application/pdf', extension: 'pdf', matches: (b) => b.toString('latin1', 0, 5) === '%PDF-' },
];

/**
 * The allowed type of a file's contents
 * @param {Buffer} buffer
 * @returns {{mime: string, extension: string}|null} null when the type is not allowed
 */
function detectFileType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const type = FILE_TYPES.find((candidate) => candidate.matches(buffer));
  return type ? { mime: type.mime, extension: type.extension } : null;
}

const ALLOWED_MIME_TYPES = FILE_TYPES.map((type) => type.mime);

module.exports = { detectFileType, ALLOWED_MIME_TYPES };
