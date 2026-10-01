-- =====================================================
-- 016: TIMESTAMP → TIMESTAMPTZ
-- =====================================================
-- TIMESTAMP columns hold a wall-clock time with no zone, so what they mean
-- depends on the time zone of whoever wrote and reads them (Node serialises
-- Dates in its local zone). TIMESTAMPTZ stores an instant.
--
-- Existing values are read in this session's TimeZone, the same zone the
-- server has been writing them in, so every stored instant is kept.
-- DATE columns are unchanged.
-- =====================================================

-- Views that read a converted column block ALTER COLUMN ... TYPE; they are
-- recreated unchanged below
DROP VIEW IF EXISTS v_expiring_batches;
DROP VIEW IF EXISTS v_low_stock_with_batches;

DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN
        SELECT c.table_name,
               string_agg(format('ALTER COLUMN %I TYPE timestamptz', c.column_name), ', '
                          ORDER BY c.ordinal_position) AS changes
          FROM information_schema.columns c
          JOIN information_schema.tables t
            ON t.table_schema = c.table_schema AND t.table_name = c.table_name
         WHERE c.table_schema = current_schema()
           AND t.table_type = 'BASE TABLE'
           AND c.data_type = 'timestamp without time zone'
         GROUP BY c.table_name
         ORDER BY c.table_name
    LOOP
        -- One statement per table, so each table is rewritten once
        EXECUTE format('ALTER TABLE %I %s', tbl.table_name, tbl.changes);
    END LOOP;
END$$;

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
