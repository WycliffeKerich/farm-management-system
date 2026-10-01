-- =====================================================
-- Phase 5: farm settings
-- One value per key and effective date. Plain settings (currency, timezone,
-- farm location) have a single row effective from -infinity; dated ones
-- (statutory rate tables, Phase 7) add a row per change, and the value on a
-- date is the row with the latest effective_from on or before it.
-- Keys, types and defaults are defined in src/services/settings.service.js.
-- =====================================================

CREATE TABLE IF NOT EXISTS farm_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(60) NOT NULL,
    value JSONB NOT NULL,
    effective_from DATE NOT NULL DEFAULT '-infinity',
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT farm_settings_key_effective_key UNIQUE (key, effective_from)
);

DO $$ BEGIN PERFORM audit_attach('farm_settings'); END$$;
