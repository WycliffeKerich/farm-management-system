-- =====================================================
-- Phase 5: attachments
-- Photos and documents (pest photos, treatment notes, receipts, inspection
-- reports) attached to a record. The file itself lives in the storage
-- adapter (local disk for now) under a random storage_key; this table holds
-- what is known about it.
-- =====================================================

CREATE TABLE IF NOT EXISTS attachments (
    id SERIAL PRIMARY KEY,
    -- The table the attachment belongs to, and the row in it
    entity_type VARCHAR(40) NOT NULL
        CONSTRAINT attachments_entity_type_check CHECK (entity_type IN (
            'activities',
            'animal_diseases_treatments',
            'animal_health_records',
            'crop_pests_diseases',
            'financial_transactions',
            'growth_observations',
            'inventory_transactions'
        )),
    entity_id INTEGER NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL CONSTRAINT attachments_size_check CHECK (size_bytes > 0),
    storage_key VARCHAR(255) NOT NULL CONSTRAINT attachments_storage_key_key UNIQUE,
    caption TEXT,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity
    ON attachments (entity_type, entity_id) WHERE deleted_at IS NULL;

DO $$ BEGIN PERFORM audit_attach('attachments'); END$$;
