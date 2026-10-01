-- =====================================================
-- 018: Every detail row has its activity (ADR-001)
-- =====================================================
-- Every service that writes a detail row now records its activity in the
-- same transaction. Rows written between 017 and this release are filled in
-- once more, then activity_id becomes required and backfill_activities(),
-- with nothing left to do, is dropped.
-- =====================================================

DO $$ BEGIN PERFORM backfill_activities(); END$$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'crop_input_applications', 'growth_observations', 'harvests', 'crop_pests_diseases',
        'animal_feed_records', 'animal_health_records', 'animal_diseases_treatments',
        'animal_production_records'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN activity_id SET NOT NULL', tbl);
    END LOOP;
END$$;

DROP FUNCTION backfill_activities();
