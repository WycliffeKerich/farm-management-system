import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, canChangeAttachment, isImage, uploadProblem } from '@/utils/attachments';

describe('uploadProblem', () => {
    it('accepts images and PDFs within the size limit', () => {
        expect(uploadProblem({ type: 'image/jpeg', size: 1000 })).toBeNull();
        expect(uploadProblem({ type: 'application/pdf', size: MAX_UPLOAD_BYTES })).toBeNull();
    });

    it('says why a file cannot go', () => {
        expect(uploadProblem(null)).toBe('Choose a file');
        expect(uploadProblem({ type: 'text/plain', size: 10 })).toMatch(/Only JPEG/);
        expect(uploadProblem({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1 })).toMatch(/limit is 10\.0 MB/);
        expect(uploadProblem({ type: 'image/png', size: 2048 }, 1024)).toBe('The file is 2 KB; the limit is 1 KB');
    });
});

describe('isImage', () => {
    it('reads the MIME type', () => {
        expect(isImage({ mime_type: 'image/webp' })).toBe(true);
        expect(isImage({ mime_type: 'application/pdf' })).toBe(false);
        expect(isImage(null)).toBe(false);
    });
});

describe('canChangeAttachment', () => {
    const attachment = { uploaded_by: 5 };

    it('lets owners, managers and the uploader change it', () => {
        expect(canChangeAttachment(attachment, { id: 1, role: 'owner' })).toBe(true);
        expect(canChangeAttachment(attachment, { id: 2, role: 'manager' })).toBe(true);
        expect(canChangeAttachment(attachment, { id: 5, role: 'worker' })).toBe(true);
        expect(canChangeAttachment(attachment, { id: 6, role: 'worker' })).toBe(false);
        expect(canChangeAttachment(attachment, null)).toBe(false);
    });
});
