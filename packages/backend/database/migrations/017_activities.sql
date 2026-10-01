-- =====================================================
-- 017: Activities (ADR-001)
-- =====================================================
-- One row per operational event, written in the same transaction as the
-- event's detail row. Detail tables keep the domain detail and point at
-- their activity through activity_id (one activity per detail row).
--
-- activity_id stays nullable until every detail-writing service records
-- activities; a later migration re-runs backfill_activities(), makes the
-- column NOT NULL and drops the function.
-- =====================================================

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    activity_type VARCHAR(50) NOT NULL
        CONSTRAINT activities_type_check CHECK (activity_type IN (
            'input_application', 'observation', 'harvest', 'pest_incident',
            'feeding', 'vaccination', 'deworming', 'health_check', 'treatment', 'production',
            'task_work'
        )),
    status VARCHAR(20) NOT NULL DEFAULT 'done'
        CONSTRAINT activities_status_check CHECK (status IN ('planned', 'done', 'cancelled')),
    -- Short display text for the timeline, e.g. "Mancozeb 2 kg"
    title VARCHAR(255) NOT NULL,
    planned_for DATE,
    occurred_on DATE,
    enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT,
    location_id INTEGER REFERENCES growing_locations(id) ON DELETE RESTRICT,
    crop_batch_id INTEGER REFERENCES crop_batches(id) ON DELETE RESTRICT,
    animal_id INTEGER REFERENCES animals(id) ON DELETE RESTRICT,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE RESTRICT,
    -- Whose labour this was; recorded_by is whoever entered it
    performed_by INTEGER REFERENCES employees(id) ON DELETE RESTRICT,
    recorded_by INTEGER REFERENCES users(id),
    labour_hours DECIMAL(6, 2) CONSTRAINT activities_labour_hours_check CHECK (labour_hours >= 0),
    input_cost DECIMAL(12, 2) CONSTRAINT activities_input_cost_check CHECK (input_cost >= 0),
    other_cost DECIMAL(12, 2) CONSTRAINT activities_other_cost_check CHECK (other_cost >= 0),
    task_id INTEGER REFERENCES tasks(id) ON DELETE RESTRICT,
    -- Offline idempotency key: a replayed request finds its earlier activity
    client_request_id UUID CONSTRAINT activities_client_request_id_key UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    -- One subject at most; only task work may have none
    CONSTRAINT activities_subject_check CHECK (
        num_nonnulls(crop_batch_id, animal_id, animal_group_id) = 1
        OR (activity_type = 'task_work' AND num_nonnulls(crop_batch_id, animal_id, animal_group_id) = 0)
    ),
    CONSTRAINT activities_dates_check CHECK (
        (status <> 'done' OR occurred_on IS NOT NULL)
        AND (status <> 'planned' OR planned_for IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_activities_timeline
    ON activities (COALESCE(occurred_on, planned_for) DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_crop_batch ON activities (crop_batch_id) WHERE crop_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_animal ON activities (animal_id) WHERE animal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_animal_group ON activities (animal_group_id) WHERE animal_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_enterprise ON activities (enterprise_id) WHERE enterprise_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_performed_by ON activities (performed_by) WHERE performed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_task ON activities (task_id) WHERE task_id IS NOT NULL;

-- =====================================================
-- activity_id on the detail tables
-- =====================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'crop_input_applications', 'growth_observations', 'harvests', 'crop_pests_diseases',
        'animal_feed_records', 'animal_health_records', 'animal_diseases_treatments', 'animal_production_records'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS activity_id INTEGER
                 CONSTRAINT %I REFERENCES activities(id) ON DELETE RESTRICT',
            tbl, tbl || '_activity_id_fkey');
        -- One detail row per activity
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (activity_id)',
            'uq_' || tbl || '_activity', tbl);
    END LOOP;
END$$;

-- =====================================================
-- Backfill
-- =====================================================
-- Creates the activity for every detail row that has none and links it.
-- Safe to run again: rows already linked are skipped.
--
-- Each block allocates the activity ids up front, so the insert and the
-- link back are one statement. A row naming both an animal and a group (only
-- possible in old data) takes the animal. performed_by is the employee
-- linked to the recording user, if there is one.
CREATE OR REPLACE FUNCTION backfill_activities() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    n INTEGER;
    total INTEGER := 0;
BEGIN
    -- Crop input applications
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM crop_input_applications d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, crop_batch_id, location_id,
                                performed_by, recorded_by, input_cost, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'input_application',
               left(s.product_name || ' ' || trim_scale(s.quantity) || ' ' || s.unit, 255),
               s.application_date, s.batch_id, b.location_id,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.total_cost, s.notes, s.created_at, s.created_at, s.deleted_at
          FROM src s LEFT JOIN crop_batches b ON b.id = s.batch_id
    )
    UPDATE crop_input_applications d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Growth observations
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM growth_observations d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, crop_batch_id, location_id,
                                performed_by, recorded_by, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'observation',
               left('Observation' || COALESCE(': ' || NULLIF(s.growth_stage, ''), ''), 255),
               s.observation_date, s.batch_id, b.location_id,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.notes, s.created_at, s.created_at, s.deleted_at
          FROM src s LEFT JOIN crop_batches b ON b.id = s.batch_id
    )
    UPDATE growth_observations d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Harvests
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM harvests d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, crop_batch_id, location_id,
                                performed_by, recorded_by, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'harvest',
               left('Harvest ' || trim_scale(s.quantity) || ' ' || s.unit, 255),
               s.harvest_date, s.batch_id, b.location_id,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.notes, s.created_at, s.created_at, s.deleted_at
          FROM src s LEFT JOIN crop_batches b ON b.id = s.batch_id
    )
    UPDATE harvests d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Pest and disease incidents
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM crop_pests_diseases d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, crop_batch_id, location_id,
                                performed_by, recorded_by, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'pest_incident',
               left(initcap(s.type) || ': ' || s.name, 255),
               s.incident_date, s.batch_id, b.location_id,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.notes, s.created_at, s.updated_at, s.deleted_at
          FROM src s LEFT JOIN crop_batches b ON b.id = s.batch_id
    )
    UPDATE crop_pests_diseases d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Feedings
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM animal_feed_records d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, animal_id, animal_group_id,
                                performed_by, recorded_by, input_cost, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'feeding',
               left(COALESCE(NULLIF(s.feed_name, ''), NULLIF(s.feed_type, ''), 'Feed')
                    || ' ' || trim_scale(s.quantity) || ' ' || s.unit, 255),
               s.feed_date, s.animal_id, CASE WHEN s.animal_id IS NULL THEN s.animal_group_id END,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.total_cost, s.notes, s.created_at, s.created_at, s.deleted_at
          FROM src s
    )
    UPDATE animal_feed_records d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Health records: vaccination, deworming, check-up or treatment
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM animal_health_records d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, animal_id, animal_group_id,
                                performed_by, recorded_by, other_cost, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id,
               CASE s.record_type WHEN 'checkup' THEN 'health_check' ELSE s.record_type END,
               left(CASE s.record_type WHEN 'checkup' THEN 'Health check' ELSE initcap(s.record_type) END
                    || COALESCE(': ' || NULLIF(s.medication, ''), ''), 255),
               s.record_date, s.animal_id, CASE WHEN s.animal_id IS NULL THEN s.animal_group_id END,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.cost, s.notes, s.created_at, s.created_at, s.deleted_at
          FROM src s
    )
    UPDATE animal_health_records d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Disease treatments: medicines from stock are the input cost, the rest
    -- (vet fees and the like) is other cost
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM animal_diseases_treatments d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, animal_id, animal_group_id,
                                performed_by, recorded_by, input_cost, other_cost, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'treatment',
               left('Treatment: ' || s.disease_name, 255),
               s.diagnosis_date, s.animal_id, CASE WHEN s.animal_id IS NULL THEN s.animal_group_id END,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by,
               (SELECT SUM(m.total_cost) FROM treatment_medications m
                 WHERE m.treatment_id = s.detail_id AND m.deleted_at IS NULL),
               s.cost, s.notes, s.created_at, s.updated_at, s.deleted_at
          FROM src s
    )
    UPDATE animal_diseases_treatments d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    -- Production (eggs, milk, ...)
    WITH src AS (
        SELECT d.id AS detail_id, nextval(pg_get_serial_sequence('activities', 'id')) AS new_activity_id, d.*
          FROM animal_production_records d WHERE d.activity_id IS NULL
    ), ins AS (
        INSERT INTO activities (id, activity_type, title, occurred_on, animal_id, animal_group_id,
                                performed_by, recorded_by, notes, created_at, updated_at, deleted_at)
        SELECT s.new_activity_id, 'production',
               left(pt.name || ' ' || trim_scale(s.quantity) || ' ' || pt.unit, 255),
               s.production_date, s.animal_id, s.animal_group_id,
               (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
               s.recorded_by, s.notes, s.created_at, s.updated_at, s.deleted_at
          FROM src s JOIN animal_production_types pt ON pt.id = s.production_type_id
    )
    UPDATE animal_production_records d SET activity_id = s.new_activity_id FROM src s WHERE d.id = s.detail_id;
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;

    RETURN total;
END$$;

DO $$ BEGIN PERFORM backfill_activities(); END$$;
