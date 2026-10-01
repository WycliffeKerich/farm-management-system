-- Migration: 015_inventory_integration.sql
-- Description: Link crop and animal records to inventory, and make safety intervals enforceable:
--   - suppliers, carried over from the free-text supplier columns
--   - items carry their pre-harvest interval, withdrawal periods and reorder quantity
--   - input applications, feed records and treatment medications point at the item they
--     used, the quantity deducted in the item's unit, and what it cost
--   - applications and medications keep the date the produce becomes safe again, so a
--     later change to the item never rewrites history
--   - harvests, production records and sales can record an owner's override
--   - a depleted batch that gets stock back becomes active again
-- Date: 2026-09-29

-- =====================================================
-- 1. Suppliers
-- =====================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    kra_pin VARCHAR(20),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_unique
    ON suppliers (LOWER(name)) WHERE deleted_at IS NULL;

-- Every distinct free-text supplier becomes a supplier record
INSERT INTO suppliers (name)
SELECT DISTINCT ON (LOWER(name)) name
  FROM (
        SELECT TRIM(supplier) AS name FROM inventory_items WHERE TRIM(COALESCE(supplier, '')) <> ''
        UNION ALL
        SELECT TRIM(supplier) FROM inventory_batches WHERE TRIM(COALESCE(supplier, '')) <> ''
       ) named
 ORDER BY LOWER(name), name
ON CONFLICT (LOWER(name)) WHERE deleted_at IS NULL DO NOTHING;

-- =====================================================
-- 2. Items: safety intervals, reorder quantity, default supplier
-- =====================================================
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS active_ingredient VARCHAR(255),
    ADD COLUMN IF NOT EXISTS pre_harvest_interval_days INTEGER
        CONSTRAINT inventory_items_phi_non_negative CHECK (pre_harvest_interval_days >= 0),
    ADD COLUMN IF NOT EXISTS milk_withdrawal_days INTEGER
        CONSTRAINT inventory_items_milk_withdrawal_non_negative CHECK (milk_withdrawal_days >= 0),
    ADD COLUMN IF NOT EXISTS meat_withdrawal_days INTEGER
        CONSTRAINT inventory_items_meat_withdrawal_non_negative CHECK (meat_withdrawal_days >= 0),
    ADD COLUMN IF NOT EXISTS egg_withdrawal_days INTEGER
        CONSTRAINT inventory_items_egg_withdrawal_non_negative CHECK (egg_withdrawal_days >= 0),
    ADD COLUMN IF NOT EXISTS reorder_quantity DECIMAL(10, 2)
        CONSTRAINT inventory_items_reorder_quantity_non_negative CHECK (reorder_quantity >= 0),
    ADD COLUMN IF NOT EXISTS default_supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT;

UPDATE inventory_items ii
   SET default_supplier_id = s.id
  FROM suppliers s
 WHERE s.deleted_at IS NULL
   AND LOWER(s.name) = LOWER(TRIM(ii.supplier))
   AND ii.default_supplier_id IS NULL;

ALTER TABLE inventory_batches
    ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT;

UPDATE inventory_batches ib
   SET supplier_id = s.id
  FROM suppliers s
 WHERE s.deleted_at IS NULL
   AND LOWER(s.name) = LOWER(TRIM(ib.supplier))
   AND ib.supplier_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_batches_supplier ON inventory_batches (supplier_id);

-- =====================================================
-- 3. Crop input applications
-- =====================================================
ALTER TABLE crop_input_applications
    ADD COLUMN IF NOT EXISTS inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE RESTRICT,
    -- quantity deducted from stock, in the item's unit
    ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12, 2),
    ADD COLUMN IF NOT EXISTS pre_harvest_interval_days INTEGER
        CONSTRAINT crop_input_applications_phi_non_negative CHECK (pre_harvest_interval_days >= 0),
    -- application_date + pre_harvest_interval_days: harvesting before this date is blocked
    ADD COLUMN IF NOT EXISTS safe_harvest_date DATE;

CREATE INDEX IF NOT EXISTS idx_crop_input_applications_item ON crop_input_applications (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_crop_input_applications_phi
    ON crop_input_applications (batch_id, safe_harvest_date)
    WHERE safe_harvest_date IS NOT NULL AND deleted_at IS NULL;

-- =====================================================
-- 4. Feed records
-- =====================================================
ALTER TABLE animal_feed_records
    ADD COLUMN IF NOT EXISTS inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_animal_feed_records_item ON animal_feed_records (inventory_item_id);

-- =====================================================
-- 5. Treatment medications: one row per product given
-- =====================================================
CREATE TABLE IF NOT EXISTS treatment_medications (
    id SERIAL PRIMARY KEY,
    treatment_id INTEGER NOT NULL REFERENCES animal_diseases_treatments(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    stock_quantity DECIMAL(10, 2),
    total_cost DECIMAL(12, 2),
    administered_date DATE NOT NULL,
    milk_withdrawal_days INTEGER CHECK (milk_withdrawal_days >= 0),
    meat_withdrawal_days INTEGER CHECK (meat_withdrawal_days >= 0),
    egg_withdrawal_days INTEGER CHECK (egg_withdrawal_days >= 0),
    -- administered_date + the withdrawal days: produce before this date is blocked
    milk_safe_from DATE,
    meat_safe_from DATE,
    egg_safe_from DATE,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_treatment_medications_treatment ON treatment_medications (treatment_id);
CREATE INDEX IF NOT EXISTS idx_treatment_medications_item ON treatment_medications (inventory_item_id);

-- =====================================================
-- 6. Owner overrides of a withdrawal or pre-harvest interval
-- =====================================================
ALTER TABLE harvests
    ADD COLUMN IF NOT EXISTS withdrawal_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS withdrawal_override_by INTEGER REFERENCES users(id);

ALTER TABLE animal_production_records
    ADD COLUMN IF NOT EXISTS withdrawal_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS withdrawal_override_by INTEGER REFERENCES users(id);

ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS withdrawal_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS withdrawal_override_by INTEGER REFERENCES users(id);

-- =====================================================
-- 7. Batch status: restocking a depleted batch makes it active again
-- =====================================================
CREATE OR REPLACE FUNCTION update_batch_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity <= 0 AND NEW.status = 'active' THEN
        NEW.status := 'depleted';
    ELSIF NEW.quantity > 0 AND NEW.status = 'depleted' THEN
        NEW.status := 'active';
    END IF;

    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'expired';
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
