-- Migration: 014_inventory_integrity.sql
-- Description: Database-level guarantees for inventory stock:
--   - stock and batch quantities can never go negative
--   - ledger quantities are magnitudes; only adjustments carry a sign
--   - batches and their ledger rows are history, so deleting an item or batch is blocked
--   - inventory_signed_quantity() gives each ledger row's effect on stock, for reports
--     and the reconcile script
-- Date: 2026-09-29

-- =====================================================
-- 1. Refuse to run over data that already breaks the rules
-- =====================================================
DO $$
DECLARE
    bad TEXT;
BEGIN
    SELECT string_agg(format('item %s (%s)', id, current_stock), ', ') INTO bad
      FROM inventory_items WHERE current_stock < 0;
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'Negative stock must be corrected before this migration: %', bad;
    END IF;

    SELECT string_agg(format('batch %s (%s)', id, quantity), ', ') INTO bad
      FROM inventory_batches WHERE quantity < 0;
    IF bad IS NOT NULL THEN
        RAISE EXCEPTION 'Negative batch quantities must be corrected before this migration: %', bad;
    END IF;
END$$;

-- Ledger rows written with a negative quantity for an outgoing type become magnitudes
UPDATE inventory_transactions
   SET quantity = ABS(quantity)
 WHERE quantity < 0 AND transaction_type <> 'adjustment';

-- =====================================================
-- 2. Stock columns
-- =====================================================
UPDATE inventory_items SET current_stock = 0 WHERE current_stock IS NULL;
ALTER TABLE inventory_items
    ALTER COLUMN current_stock SET NOT NULL,
    ALTER COLUMN current_stock SET DEFAULT 0,
    ADD CONSTRAINT inventory_items_current_stock_non_negative CHECK (current_stock >= 0),
    ADD CONSTRAINT inventory_items_minimum_stock_non_negative CHECK (minimum_stock IS NULL OR minimum_stock >= 0);

ALTER TABLE inventory_batches
    ADD CONSTRAINT inventory_batches_quantity_non_negative CHECK (quantity >= 0),
    ADD CONSTRAINT inventory_batches_initial_quantity_non_negative CHECK (initial_quantity >= 0);

ALTER TABLE inventory_transactions
    ADD CONSTRAINT inventory_transactions_quantity_sign CHECK (
        (transaction_type = 'adjustment' AND quantity <> 0) OR quantity > 0
    );

-- =====================================================
-- 3. History foreign keys: RESTRICT instead of CASCADE
-- =====================================================
ALTER TABLE inventory_batches
    DROP CONSTRAINT inventory_batches_inventory_item_id_fkey,
    ADD CONSTRAINT inventory_batches_inventory_item_id_fkey
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT;

ALTER TABLE inventory_transactions
    DROP CONSTRAINT inventory_transactions_inventory_batch_id_fkey,
    ADD CONSTRAINT inventory_transactions_inventory_batch_id_fkey
        FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT;

-- =====================================================
-- 4. Signed effect of a ledger row on stock
-- =====================================================
CREATE OR REPLACE FUNCTION inventory_signed_quantity(transaction_type TEXT, quantity NUMERIC)
RETURNS NUMERIC AS $$
    SELECT CASE
        WHEN transaction_type IN ('purchase', 'return', 'adjustment') THEN quantity
        ELSE -quantity
    END;
$$ LANGUAGE sql IMMUTABLE;

-- =====================================================
-- 5. Batch number trigger: the 011 version declared a variable named item_code,
--    which clashes with the column, so every insert without a batch number failed
-- =====================================================
CREATE OR REPLACE FUNCTION generate_batch_number()
RETURNS TRIGGER AS $$
DECLARE
    v_item_code VARCHAR(50);
    v_batch_count INTEGER;
BEGIN
    IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
        SELECT COALESCE(ii.item_code, 'INV') INTO v_item_code
          FROM inventory_items ii WHERE ii.id = NEW.inventory_item_id;

        SELECT COUNT(*) + 1 INTO v_batch_count
          FROM inventory_batches ib WHERE ib.inventory_item_id = NEW.inventory_item_id;

        -- ITEMCODE-YYYYMMDD-NNN
        NEW.batch_number := v_item_code || '-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(v_batch_count::TEXT, 3, '0');
    END IF;

    IF NEW.initial_quantity IS NULL THEN
        NEW.initial_quantity := NEW.quantity;
    END IF;

    IF NEW.unit_cost IS NOT NULL AND NEW.total_cost IS NULL THEN
        NEW.total_cost := NEW.quantity * NEW.unit_cost;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FEFO picks the active batches of one item in expiry order
CREATE INDEX IF NOT EXISTS idx_inventory_batches_fefo
    ON inventory_batches (inventory_item_id, expiry_date, received_date, id)
    WHERE status = 'active' AND deleted_at IS NULL;

-- Ledger rows default to today in the database's time zone
ALTER TABLE inventory_transactions ALTER COLUMN transaction_date SET DEFAULT CURRENT_DATE;
