import { formatBytes } from '@/utils/format';

/** What the backend accepts; it checks the content too, this only saves a wasted upload */
export const ACCEPTED_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,.pdf';
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Why a file cannot be uploaded, or null when it can
 * @param {{type: string, size: number}} file
 * @param {number} [maxBytes]
 * @returns {string|null}
 */
export function uploadProblem(file, maxBytes = MAX_UPLOAD_BYTES) {
    if (!file) return 'Choose a file';
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Only JPEG, PNG, WebP images and PDF documents can be attached';
    if (file.size > maxBytes) return `The file is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}`;
    return null;
}

/**
 * @param {{mime_type: string}} attachment
 * @returns {boolean}
 */
export function isImage(attachment) {
    return String(attachment?.mime_type || '').startsWith('image/');
}

/**
 * Whether the user may change the caption or delete: the uploader, an owner or a manager
 * @param {{uploaded_by: number}} attachment
 * @param {{id: number, role: string}|null} user
 * @returns {boolean}
 */
export function canChangeAttachment(attachment, user) {
    if (!user) return false;
    return user.role === 'owner' || user.role === 'manager' || attachment.uploaded_by === user.id;
}
