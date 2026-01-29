-- Migration: Enhance animal management system
-- Adds tracking mode support (individual vs flock), death tracking, and soft deletes

-- ============================================================================
-- 1. ADD TRACKING MODE TO ANIMAL TYPES
-- ============================================================================

-- Add tracking_mode to animal_types to indicate how animals of this type are tracked
ALTER TABLE animal_types
ADD COLUMN IF NOT EXISTS tracking_mode VARCHAR(20) DEFAULT 'individual'
    CHECK (tracking_mode IN ('individual', 'flock', 'both')),
ADD COLUMN IF NOT EXISTS default_lifespan_days INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add comments for clarity
COMMENT ON COLUMN animal_types.tracking_mode IS 'How animals of this type are tracked: individual (cattle, pigs), flock (chickens), or both';

-- ============================================================================
-- 2. ENHANCE ANIMAL BREEDS TABLE
-- ============================================================================

ALTER TABLE animal_breeds
ADD COLUMN IF NOT EXISTS average_lifespan_years INTEGER,
ADD COLUMN IF NOT EXISTS average_weight_kg DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 3. ENHANCE ANIMAL HOUSING TABLE
-- ============================================================================

ALTER TABLE animal_housing
ADD COLUMN IF NOT EXISTS housing_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 4. ENHANCE ANIMALS TABLE FOR INDIVIDUAL TRACKING
-- ============================================================================

ALTER TABLE animals
ADD COLUMN IF NOT EXISTS name VARCHAR(100),
ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS weight_date DATE,
ADD COLUMN IF NOT EXISTS is_breeding_stock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 5. ENHANCE ANIMAL GROUPS TABLE FOR FLOCK TRACKING
-- ============================================================================

ALTER TABLE animal_groups
ADD COLUMN IF NOT EXISTS group_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS initial_quantity INTEGER,
ADD COLUMN IF NOT EXISTS current_quantity INTEGER,
ADD COLUMN IF NOT EXISTS acquisition_type VARCHAR(50) CHECK (acquisition_type IN ('purchased', 'hatched', 'born', 'transferred', 'other')),
ADD COLUMN IF NOT EXISTS acquisition_date DATE,
ADD COLUMN IF NOT EXISTS acquisition_cost DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS age_at_acquisition_days INTEGER,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Make group_code unique where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_animal_groups_code ON animal_groups(group_code) WHERE group_code IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- 6. CREATE ANIMAL DEATHS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS animal_deaths (
    id SERIAL PRIMARY KEY,

    -- Link to either individual animal or group (one must be set)
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,

    -- Death details
    death_date DATE NOT NULL,
    quantity INTEGER DEFAULT 1, -- For groups, can record multiple deaths at once

    -- Cause and classification
    cause_of_death VARCHAR(255),
    cause_category VARCHAR(50) CHECK (cause_category IN (
        'disease', 'predator', 'accident', 'natural', 'culled',
        'slaughtered', 'unknown', 'other'
    )),

    -- Additional details
    symptoms TEXT,
    veterinary_findings TEXT,
    was_expected BOOLEAN DEFAULT false,
    was_preventable BOOLEAN,

    -- Financial impact
    estimated_loss DECIMAL(12, 2),
    insurance_claim_filed BOOLEAN DEFAULT false,
    insurance_claim_amount DECIMAL(12, 2),

    -- Disposal
    disposal_method VARCHAR(100),
    disposal_date DATE,
    disposal_notes TEXT,

    -- Tracking
    notes TEXT,
    reported_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Ensure either animal_id or animal_group_id is set
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- ============================================================================
-- 7. CREATE ANIMAL GROUP ADJUSTMENTS TABLE
-- For tracking quantity changes in flocks (additions, removals, transfers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS animal_group_adjustments (
    id SERIAL PRIMARY KEY,
    animal_group_id INTEGER NOT NULL REFERENCES animal_groups(id) ON DELETE CASCADE,

    adjustment_date DATE NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
        'addition', 'removal', 'death', 'sale', 'transfer_in', 'transfer_out',
        'hatched', 'born', 'correction'
    )),

    quantity INTEGER NOT NULL, -- Positive for additions, negative for removals
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,

    -- Reason and reference
    reason TEXT,
    reference_type VARCHAR(50), -- 'death', 'sale', 'transfer', etc.
    reference_id INTEGER, -- Link to death record, sale record, etc.

    -- Financial
    unit_value DECIMAL(10, 2),
    total_value DECIMAL(12, 2),

    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. ADD SOFT DELETE TO HEALTH RECORDS
-- ============================================================================

ALTER TABLE animal_health_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 9. ADD SOFT DELETE TO DISEASES/TREATMENTS
-- ============================================================================

ALTER TABLE animal_diseases_treatments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 10. ADD SOFT DELETE TO FEED RECORDS
-- ============================================================================

ALTER TABLE animal_feed_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 11. ADD SOFT DELETE TO BREEDING RECORDS
-- ============================================================================

ALTER TABLE breeding_records
ADD COLUMN IF NOT EXISTS breeding_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'delivered')),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 12. ADD SOFT DELETE TO PRODUCTION RECORDS
-- ============================================================================

ALTER TABLE production_records
ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(50),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ============================================================================
-- 13. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Animal deaths indexes
CREATE INDEX IF NOT EXISTS idx_animal_deaths_animal ON animal_deaths(animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_deaths_group ON animal_deaths(animal_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_deaths_date ON animal_deaths(death_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_deaths_cause ON animal_deaths(cause_category) WHERE deleted_at IS NULL;

-- Animal group adjustments indexes
CREATE INDEX IF NOT EXISTS idx_group_adjustments_group ON animal_group_adjustments(animal_group_id);
CREATE INDEX IF NOT EXISTS idx_group_adjustments_date ON animal_group_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_group_adjustments_type ON animal_group_adjustments(adjustment_type);

-- Update existing indexes to account for soft delete
DROP INDEX IF EXISTS idx_animals_status;
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status) WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_animal_groups_status;
CREATE INDEX IF NOT EXISTS idx_animal_groups_status ON animal_groups(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- 14. TRIGGER TO UPDATE GROUP QUANTITY ON DEATH
-- ============================================================================

CREATE OR REPLACE FUNCTION update_group_quantity_on_death()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.animal_group_id IS NOT NULL THEN
        -- Update current quantity in the group
        UPDATE animal_groups
        SET current_quantity = COALESCE(current_quantity, quantity) - COALESCE(NEW.quantity, 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.animal_group_id;

        -- Create adjustment record
        INSERT INTO animal_group_adjustments (
            animal_group_id, adjustment_date, adjustment_type,
            quantity, quantity_before, quantity_after,
            reason, reference_type, reference_id, recorded_by
        )
        SELECT
            NEW.animal_group_id,
            NEW.death_date,
            'death',
            -COALESCE(NEW.quantity, 1),
            ag.current_quantity + COALESCE(NEW.quantity, 1),
            ag.current_quantity,
            NEW.cause_of_death,
            'death',
            NEW.id,
            NEW.reported_by
        FROM animal_groups ag
        WHERE ag.id = NEW.animal_group_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_group_on_death ON animal_deaths;
CREATE TRIGGER trigger_update_group_on_death
    AFTER INSERT ON animal_deaths
    FOR EACH ROW
    EXECUTE FUNCTION update_group_quantity_on_death();

-- ============================================================================
-- 15. TRIGGER TO UPDATE INDIVIDUAL ANIMAL STATUS ON DEATH
-- ============================================================================

CREATE OR REPLACE FUNCTION update_animal_status_on_death()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.animal_id IS NOT NULL THEN
        UPDATE animals
        SET status = 'deceased',
            status_date = NEW.death_date,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.animal_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_animal_on_death ON animal_deaths;
CREATE TRIGGER trigger_update_animal_on_death
    AFTER INSERT ON animal_deaths
    FOR EACH ROW
    EXECUTE FUNCTION update_animal_status_on_death();
