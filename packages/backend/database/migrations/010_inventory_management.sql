-- Migration: 010_inventory_management.sql
-- Description: Enhance inventory management tables with additional columns
-- Date: 2026-01-29

-- =====================================================
-- INVENTORY CATEGORIES - Make type column optional
-- =====================================================
ALTER TABLE inventory_categories ALTER COLUMN type DROP NOT NULL;

-- Add Supplies category if missing
INSERT INTO inventory_categories (name, type, description)
VALUES ('Supplies', 'supplies', 'General farm supplies')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- INVENTORY ITEMS - Add missing columns
-- =====================================================

-- Add item_code column for unique item identification
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);

-- Create unique index on item_code (only if column was added and index doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_items_item_code') THEN
        CREATE UNIQUE INDEX idx_inventory_items_item_code ON inventory_items(item_code) WHERE item_code IS NOT NULL;
    END IF;
END$$;

-- Rename min_stock_level to minimum_stock for consistency (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'min_stock_level')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'minimum_stock') THEN
        ALTER TABLE inventory_items RENAME COLUMN min_stock_level TO minimum_stock;
    END IF;
END$$;

-- Add minimum_stock if it doesn't exist
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS minimum_stock DECIMAL(10, 2) DEFAULT 0;

-- Add cost_per_unit if unit_cost doesn't exist
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(10, 2);

-- Copy unit_cost to cost_per_unit if both exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'unit_cost')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'cost_per_unit') THEN
        UPDATE inventory_items SET cost_per_unit = unit_cost WHERE cost_per_unit IS NULL AND unit_cost IS NOT NULL;
    END IF;
END$$;

-- Add location column for storage location
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS location VARCHAR(200);

-- Add expiry_date column for perishable items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Add notes column
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on expiry_date for expiring items queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_items_expiry_date') THEN
        CREATE INDEX idx_inventory_items_expiry_date ON inventory_items(expiry_date);
    END IF;
END$$;

-- Create index on current_stock for low stock queries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_items_current_stock') THEN
        CREATE INDEX idx_inventory_items_current_stock ON inventory_items(current_stock);
    END IF;
END$$;

-- =====================================================
-- INVENTORY TRANSACTIONS - Add missing columns
-- =====================================================

-- Add created_by column if recorded_by exists but created_by doesn't
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_transactions' AND column_name = 'recorded_by')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_transactions' AND column_name = 'created_by') THEN
        ALTER TABLE inventory_transactions RENAME COLUMN recorded_by TO created_by;
    END IF;
END$$;

-- Add created_by if it doesn't exist
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Add updated_at column
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update check constraint to allow more transaction types
DO $$
BEGIN
    -- Drop old constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'inventory_transactions_transaction_type_check'
               AND table_name = 'inventory_transactions') THEN
        ALTER TABLE inventory_transactions DROP CONSTRAINT inventory_transactions_transaction_type_check;
    END IF;
END$$;

-- Add new constraint with all transaction types
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_transaction_type_check
    CHECK (transaction_type IN ('purchase', 'usage', 'adjustment', 'return', 'expired', 'transfer', 'waste'));

-- Create index on created_by
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_transactions_created_by') THEN
        CREATE INDEX idx_inventory_transactions_created_by ON inventory_transactions(created_by);
    END IF;
END$$;

-- Create index on transaction_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_transactions_type') THEN
        CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
    END IF;
END$$;

-- Create index on reference columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inventory_transactions_reference') THEN
        CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_type, reference_id);
    END IF;
END$$;

-- =====================================================
-- Generate item codes for existing items without codes
-- =====================================================
DO $$
DECLARE
    item_record RECORD;
    category_prefix VARCHAR(3);
    item_counter INTEGER;
BEGIN
    FOR item_record IN
        SELECT ii.id, ii.category_id, ic.name as category_name
        FROM inventory_items ii
        JOIN inventory_categories ic ON ii.category_id = ic.id
        WHERE ii.item_code IS NULL
        ORDER BY ii.id
    LOOP
        -- Determine prefix based on category
        category_prefix := CASE item_record.category_name
            WHEN 'Seeds' THEN 'SED'
            WHEN 'Feed' THEN 'FED'
            WHEN 'Fertilizer' THEN 'FER'
            WHEN 'Pesticide' THEN 'PES'
            WHEN 'Medicine' THEN 'MED'
            WHEN 'Equipment' THEN 'EQP'
            WHEN 'Supplies' THEN 'SUP'
            ELSE 'INV'
        END;

        -- Count existing items with this prefix
        SELECT COUNT(*) + 1 INTO item_counter
        FROM inventory_items
        WHERE item_code LIKE category_prefix || '-%';

        -- Update the item with a generated code
        UPDATE inventory_items
        SET item_code = category_prefix || '-' || LPAD(item_counter::TEXT, 4, '0')
        WHERE id = item_record.id;
    END LOOP;
END$$;

-- =====================================================
-- TRIGGERS for updated_at
-- =====================================================

-- Trigger for inventory_items
CREATE OR REPLACE FUNCTION update_inventory_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trigger_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_items_updated_at();

-- Trigger for inventory_categories
CREATE OR REPLACE FUNCTION update_inventory_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_categories_updated_at ON inventory_categories;
CREATE TRIGGER trigger_inventory_categories_updated_at
    BEFORE UPDATE ON inventory_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_categories_updated_at();

-- Trigger for inventory_transactions
CREATE OR REPLACE FUNCTION update_inventory_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_transactions_updated_at ON inventory_transactions;
CREATE TRIGGER trigger_inventory_transactions_updated_at
    BEFORE UPDATE ON inventory_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_transactions_updated_at();
