import { describe, expect, it } from 'vitest';
import { AUDITED_TABLES, auditActionLabel, auditActionSeverity, auditChanges, auditRecordRoute, auditValue, tableLabel } from '@/utils/audit';

describe('audit labels', () => {
    it('names actions and tables for people', () => {
        expect(auditActionLabel('soft_delete')).toBe('Archived');
        expect(auditActionLabel('mystery')).toBe('mystery');
        expect(auditActionSeverity('delete')).toBe('danger');
        expect(auditActionSeverity('mystery')).toBe('secondary');
        expect(tableLabel('crop_batches')).toBe('Crop batches');
        expect(tableLabel(null)).toBe('');
        expect(AUDITED_TABLES).toContain('farm_settings');
        expect(AUDITED_TABLES).toContain('attachments');
    });

    it('links records that have a page', () => {
        expect(auditRecordRoute('animals', 4)).toEqual({ name: 'animal-detail', params: { id: 4 } });
        expect(auditRecordRoute('harvests', 4)).toBeNull();
        expect(auditRecordRoute('animals', null)).toBeNull();
    });
});

describe('auditChanges', () => {
    it('lists the changed fields of an update, from the server or by comparing', () => {
        const entry = {
            action: 'update',
            before: { id: 1, status: 'active', quantity: 10, updated_at: 'a' },
            after: { id: 1, status: 'sold', quantity: 10, updated_at: 'b' }
        };
        expect(auditChanges({ ...entry, changed_fields: ['status'] })).toEqual([{ field: 'status', before: 'active', after: 'sold' }]);
        expect(auditChanges(entry)).toEqual([{ field: 'status', before: 'active', after: 'sold' }]);
    });

    it('keeps updated_at when nothing else changed', () => {
        expect(auditChanges({ action: 'update', before: { updated_at: 'a' }, after: { updated_at: 'b' } })).toEqual([{ field: 'updated_at', before: 'a', after: 'b' }]);
    });

    it('lists what a new row was created with, skipping empty fields, sorted', () => {
        expect(auditChanges({ action: 'insert', before: null, after: { name: 'Maize', id: 3, notes: null } })).toEqual([
            { field: 'id', before: null, after: 3 },
            { field: 'name', before: null, after: 'Maize' }
        ]);
    });

    it('lists what a deleted row held', () => {
        expect(auditChanges({ action: 'delete', before: { name: 'Old', notes: null }, after: null })).toEqual([{ field: 'name', before: 'Old', after: null }]);
    });

    it('shows what an archive changed', () => {
        const entry = { action: 'soft_delete', before: { deleted_at: null }, after: { deleted_at: '2026-10-01T08:00:00Z' }, changed_fields: ['deleted_at'] };
        expect(auditChanges(entry)).toEqual([{ field: 'deleted_at', before: null, after: '2026-10-01T08:00:00Z' }]);
    });
});

describe('auditValue', () => {
    it('shows blanks, objects and scalars', () => {
        expect(auditValue(null)).toBe('—');
        expect(auditValue(undefined)).toBe('—');
        expect(auditValue({ latitude: 1 })).toBe('{"latitude":1}');
        expect(auditValue(false)).toBe('false');
        expect(auditValue(0)).toBe('0');
    });
});
