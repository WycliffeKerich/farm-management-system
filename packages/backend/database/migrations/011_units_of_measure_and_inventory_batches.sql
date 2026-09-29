-- Migration: 011_units_of_measure_and_inventory_batches.sql
-- Description: Add centralized units of measure system and inventory batches for expiry tracking
-- Date: 2026-01-29

-- =====================================================
-- 1. UNITS OF MEASURE - Centralized UOM Management
-- =====================================================

-- Create units_of_measure table for centralized UOM management
CREATE TABLE IF NOT EXISTS units_of_measure (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('weight', 'volume', 'length', 'area', 'count', 'time', 'other')),
    base_unit_id INTEGER REFERENCES units_of_measure(id),
    conversion_factor DECIMAL(15, 6) DEFAULT 1,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(symbol)
);

-- Insert common units of measure
INSERT INTO units_of_measure (name, symbol, category, description) VALUES
    -- Weight units
    ('Kilogram', 'kg', 'weight', 'Base unit for weight'),
    ('Gram', 'g', 'weight', '1/1000 of a kilogram'),
    ('Milligram', 'mg', 'weight', '1/1000 of a gram'),
    ('Metric Ton', 'ton', 'weight', '1000 kilograms'),
    ('Pound', 'lb', 'weight', 'Imperial weight unit'),
    ('Ounce', 'oz', 'weight', 'Imperial weight unit'),

    -- Volume units
    ('Liter', 'L', 'volume', 'Base unit for volume'),
    ('Milliliter', 'mL', 'volume', '1/1000 of a liter'),
    ('Gallon', 'gal', 'volume', 'Imperial volume unit'),
    ('Cubic Meter', 'm³', 'volume', '1000 liters'),

    -- Count units
    ('Piece', 'pcs', 'count', 'Individual items'),
    ('Dozen', 'doz', 'count', '12 pieces'),
    ('Pack', 'pack', 'count', 'Package of items'),
    ('Box', 'box', 'count', 'Box of items'),
    ('Bag', 'bag', 'count', 'Bag of items'),
    ('Bottle', 'bottle', 'count', 'Bottle container'),
    ('Can', 'can', 'count', 'Can container'),
    ('Roll', 'roll', 'count', 'Roll of material'),
    ('Tray', 'tray', 'count', 'Tray of items'),
    ('Crate', 'crate', 'count', 'Crate of items'),

    -- Length units
    ('Meter', 'm', 'length', 'Base unit for length'),
    ('Centimeter', 'cm', 'length', '1/100 of a meter'),
    ('Millimeter', 'mm', 'length', '1/1000 of a meter'),
    ('Foot', 'ft', 'length', 'Imperial length unit'),
    ('Inch', 'in', 'length', 'Imperial length unit'),

    -- Area units
    ('Square Meter', 'm²', 'area', 'Base unit for area'),
    ('Hectare', 'ha', 'area', '10000 square meters'),
    ('Acre', 'acre', 'area', 'Imperial area unit')
ON CONFLICT (symbol) DO NOTHING;

-- Set up base units and conversion factors
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'kg'), conversion_factor = 0.001 WHERE symbol = 'g';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'kg'), conversion_factor = 0.000001 WHERE symbol = 'mg';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'kg'), conversion_factor = 1000 WHERE symbol = 'ton';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'kg'), conversion_factor = 0.453592 WHERE symbol = 'lb';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'kg'), conversion_factor = 0.0283495 WHERE symbol = 'oz';

UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'L'), conversion_factor = 0.001 WHERE symbol = 'mL';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'L'), conversion_factor = 3.78541 WHERE symbol = 'gal';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'L'), conversion_factor = 1000 WHERE symbol = 'm³';

UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'pcs'), conversion_factor = 12 WHERE symbol = 'doz';

UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'm'), conversion_factor = 0.01 WHERE symbol = 'cm';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'm'), conversion_factor = 0.001 WHERE symbol = 'mm';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'm'), conversion_factor = 0.3048 WHERE symbol = 'ft';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'm'), conversion_factor = 0.0254 WHERE symbol = 'in';

UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'm²'), conversion_factor = 10000 WHERE symbol = 'ha';
UPDATE units_of_measure SET base_unit_id = (SELECT id FROM units_of_measure WHERE symbol = 'm²'), conversion_factor = 4046.86 WHERE symbol = 'acre';

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_units_of_measure_category ON units_of_measure(category);
CREATE INDEX IF NOT EXISTS idx_units_of_measure_active ON units_of_measure(is_active);

-- =====================================================
-- 2. UPDATE INVENTORY_ITEMS - Add UOM foreign key
-- =====================================================

-- Add unit_of_measure_id column
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_of_measure_id INTEGER REFERENCES units_of_measure(id);

-- Migrate existing unit values to the new UOM system
DO $$
DECLARE
    item_record RECORD;
    uom_id INTEGER;
BEGIN
    FOR item_record IN
        SELECT id, unit FROM inventory_items WHERE unit IS NOT NULL AND unit_of_measure_id IS NULL
    LOOP
        -- Try to find matching UOM by symbol (case-insensitive)
        SELECT id INTO uom_id FROM units_of_measure
        WHERE LOWER(symbol) = LOWER(item_record.unit) OR LOWER(name) = LOWER(item_record.unit)
        LIMIT 1;

        IF uom_id IS NOT NULL THEN
            UPDATE inventory_items SET unit_of_measure_id = uom_id WHERE id = item_record.id;
        END IF;
    END LOOP;
END$$;

-- =====================================================
-- 3. INVENTORY BATCHES - Track batches with expiry dates
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_batches (
    id SERIAL PRIMARY KEY,
    inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    initial_quantity DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    manufacture_date DATE,
    expiry_date DATE,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier VARCHAR(255),
    supplier_batch_number VARCHAR(100),
    storage_location VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'depleted', 'expired', 'quarantine', 'disposed')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(inventory_item_id, batch_number)
);

-- Create indexes for batch queries
CREATE INDEX IF NOT EXISTS idx_inventory_batches_item_id ON inventory_batches(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry_date ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON inventory_batches(status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_received_date ON inventory_batches(received_date);

-- =====================================================
-- 4. UPDATE INVENTORY TRANSACTIONS - Link to batches
-- =====================================================

-- Add batch reference to transactions
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS inventory_batch_id INTEGER REFERENCES inventory_batches(id);

-- Add stock_before and stock_after columns for audit trail
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS stock_before DECIMAL(10, 2);
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS stock_after DECIMAL(10, 2);

-- Create index on batch_id
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_batch_id ON inventory_transactions(inventory_batch_id);

-- =====================================================
-- 5. TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to auto-generate batch numbers
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
    item_code VARCHAR(50);
    batch_count INTEGER;
BEGIN
    IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
        -- Get item code
        SELECT COALESCE(item_code, 'INV') INTO item_code FROM inventory_items WHERE id = NEW.inventory_item_id;

        -- Count existing batches for this item
        SELECT COUNT(*) + 1 INTO batch_count FROM inventory_batches WHERE inventory_item_id = NEW.inventory_item_id;

        -- Generate batch number: ITEMCODE-YYYYMMDD-NNN
        NEW.batch_number := item_code || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(batch_count::TEXT, 3, '0');
    END IF;

    -- Set initial_quantity if not provided
    IF NEW.initial_quantity IS NULL THEN
        NEW.initial_quantity := NEW.quantity;
    END IF;

    -- Calculate total_cost if unit_cost is provided
    IF NEW.unit_cost IS NOT NULL AND NEW.total_cost IS NULL THEN
        NEW.total_cost := NEW.quantity * NEW.unit_cost;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_batch_number ON inventory_batches;
CREATE TRIGGER trigger_generate_batch_number
    BEFORE INSERT ON inventory_batches
    FOR EACH ROW
    EXECUTE FUNCTION generate_batch_number();

-- Function to update batch status when depleted or expired
CREATE OR REPLACE FUNCTION update_batch_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark as depleted if quantity reaches 0
    IF NEW.quantity <= 0 AND NEW.status = 'active' THEN
        NEW.status := 'depleted';
    END IF;

    -- Mark as expired if past expiry date
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'expired';
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_batch_status ON inventory_batches;
CREATE TRIGGER trigger_update_batch_status
    BEFORE UPDATE ON inventory_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_batch_status();

-- Function to update units_of_measure updated_at
CREATE OR REPLACE FUNCTION update_units_of_measure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_units_of_measure_updated_at ON units_of_measure;
CREATE TRIGGER trigger_units_of_measure_updated_at
    BEFORE UPDATE ON units_of_measure
    FOR EACH ROW
    EXECUTE FUNCTION update_units_of_measure_updated_at();

-- =====================================================
-- 6. VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for items with expiring batches
CREATE OR REPLACE VIEW v_expiring_batches AS
SELECT
    ib.id AS batch_id,
    ib.batch_number,
    ib.inventory_item_id,
    ii.name AS item_name,
    ii.item_code,
    ic.name AS category_name,
    ib.quantity,
    ib.expiry_date,
    ib.expiry_date - CURRENT_DATE AS days_until_expiry,
    ib.storage_location,
    uom.symbol AS unit_symbol
FROM inventory_batches ib
JOIN inventory_items ii ON ib.inventory_item_id = ii.id
LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
WHERE ib.status = 'active'
    AND ib.expiry_date IS NOT NULL
    AND ib.deleted_at IS NULL
    AND ii.deleted_at IS NULL
ORDER BY ib.expiry_date ASC;

-- View for low stock items with batch details
CREATE OR REPLACE VIEW v_low_stock_with_batches AS
SELECT
    ii.id AS item_id,
    ii.item_code,
    ii.name AS item_name,
    ic.name AS category_name,
    ii.current_stock,
    ii.minimum_stock,
    uom.symbol AS unit_symbol,
    COUNT(DISTINCT ib.id) AS active_batch_count,
    MIN(ib.expiry_date) AS earliest_expiry,
    SUM(CASE WHEN ib.status = 'active' THEN ib.quantity ELSE 0 END) AS total_batch_quantity
FROM inventory_items ii
LEFT JOIN inventory_categories ic ON ii.category_id = ic.id
LEFT JOIN units_of_measure uom ON ii.unit_of_measure_id = uom.id
LEFT JOIN inventory_batches ib ON ii.id = ib.inventory_item_id AND ib.status = 'active' AND ib.deleted_at IS NULL
WHERE ii.deleted_at IS NULL
    AND ii.minimum_stock IS NOT NULL
    AND ii.minimum_stock > 0
    AND ii.current_stock <= ii.minimum_stock
GROUP BY ii.id, ii.item_code, ii.name, ic.name, ii.current_stock, ii.minimum_stock, uom.symbol
ORDER BY (ii.current_stock / NULLIF(ii.minimum_stock, 0)) ASC, ii.name ASC;

-- =====================================================
-- 7. MIGRATE EXISTING EXPIRY DATA TO BATCHES
-- =====================================================

-- Create batches for existing items that have expiry dates set
DO $$
DECLARE
    item_record RECORD;
BEGIN
    FOR item_record IN
        SELECT id, item_code, name, current_stock, expiry_date, supplier, location, unit_cost
        FROM inventory_items
        WHERE expiry_date IS NOT NULL
            AND current_stock > 0
            AND deleted_at IS NULL
            AND id NOT IN (SELECT DISTINCT inventory_item_id FROM inventory_batches)
    LOOP
        INSERT INTO inventory_batches (
            inventory_item_id,
            batch_number,
            quantity,
            initial_quantity,
            unit_cost,
            expiry_date,
            received_date,
            supplier,
            storage_location,
            notes
        ) VALUES (
            item_record.id,
            COALESCE(item_record.item_code, 'INV') || '-LEGACY-001',
            item_record.current_stock,
            item_record.current_stock,
            item_record.unit_cost,
            item_record.expiry_date,
            CURRENT_DATE,
            item_record.supplier,
            item_record.location,
            'Migrated from item-level expiry date'
        );
    END LOOP;
END$$;
