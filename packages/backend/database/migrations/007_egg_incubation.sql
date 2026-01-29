-- Migration 007: Egg Incubation and Hatching System
-- Description: Add table for tracking egg incubation and hatching records

-- Create incubation_records table
CREATE TABLE IF NOT EXISTS incubation_records (
    id SERIAL PRIMARY KEY,
    batch_code VARCHAR(50) UNIQUE NOT NULL,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE SET NULL,
    animal_breed_id INTEGER REFERENCES animal_breeds(id),
    eggs_count INTEGER NOT NULL CHECK (eggs_count > 0),
    incubation_start_date DATE NOT NULL,
    expected_hatch_date DATE NOT NULL,
    actual_hatch_date DATE,
    hatched_count INTEGER CHECK (hatched_count >= 0),
    unhatched_count INTEGER CHECK (unhatched_count >= 0),
    target_group_id INTEGER REFERENCES animal_groups(id) ON DELETE SET NULL,
    incubator_id VARCHAR(100),
    temperature DECIMAL(5, 2),
    humidity DECIMAL(5, 2),
    status VARCHAR(20) DEFAULT 'incubating' CHECK (status IN ('incubating', 'hatched', 'failed', 'partial')),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_incubation_records_status ON incubation_records(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incubation_records_group ON incubation_records(animal_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incubation_records_breed ON incubation_records(animal_breed_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incubation_records_dates ON incubation_records(incubation_start_date, expected_hatch_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incubation_records_deleted ON incubation_records(deleted_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_incubation_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists before creating it
DROP TRIGGER IF EXISTS incubation_records_updated_at ON incubation_records;

CREATE TRIGGER incubation_records_updated_at
    BEFORE UPDATE ON incubation_records
    FOR EACH ROW
    EXECUTE FUNCTION update_incubation_records_updated_at();

-- Add comment
COMMENT ON TABLE incubation_records IS 'Tracks egg incubation batches and hatching outcomes for poultry management';
