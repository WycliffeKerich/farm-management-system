-- Migration 009: Reproduction Enhancements
-- Description: Add exclude_from_reproduction flag and external egg source support

-- Add exclude_from_reproduction column to animal_types
ALTER TABLE animal_types
ADD COLUMN IF NOT EXISTS exclude_from_reproduction BOOLEAN DEFAULT FALSE;

-- Update bees to be excluded from reproduction tracking
UPDATE animal_types
SET exclude_from_reproduction = TRUE
WHERE LOWER(name) LIKE '%bee%'
   OR LOWER(name) LIKE '%apiary%';

-- Add comment
COMMENT ON COLUMN animal_types.exclude_from_reproduction IS 'If true, this animal type is excluded from breeding and incubation tracking (e.g., bees)';

-- Add egg_source column to incubation_records
ALTER TABLE incubation_records
ADD COLUMN IF NOT EXISTS egg_source VARCHAR(20) DEFAULT 'internal'
CHECK (egg_source IN ('internal', 'external'));

-- Add supplier info for external eggs
ALTER TABLE incubation_records
ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200);

ALTER TABLE incubation_records
ADD COLUMN IF NOT EXISTS supplier_contact VARCHAR(100);

ALTER TABLE incubation_records
ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(12, 2);

-- Add comment
COMMENT ON COLUMN incubation_records.egg_source IS 'Source of eggs: internal (from own flock) or external (purchased)';

-- Create index for egg_source filtering
CREATE INDEX IF NOT EXISTS idx_incubation_records_egg_source ON incubation_records(egg_source) WHERE deleted_at IS NULL;
