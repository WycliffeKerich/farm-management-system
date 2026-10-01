-- =====================================================
-- Phase 5: audit log
-- A row trigger on every business table records who changed what.
-- The app names the acting user per statement or transaction with
-- set_config('app.user_id', <id>, true) (see src/config/database.js);
-- writes made outside a request (migrations, seeds, jobs) have no user.
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(63) NOT NULL,
    record_id BIGINT,
    action VARCHAR(12) NOT NULL
        CONSTRAINT audit_log_action_check CHECK (action IN ('insert', 'update', 'delete', 'soft_delete')),
    -- No foreign key: the log must never block a write or lose rows with a user
    changed_by INTEGER,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    before JSONB,
    after JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log (table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by ON audit_log (changed_by);

-- Trigger arguments name columns to leave out of before/after (secrets and
-- bookkeeping). An update that changes nothing but those and updated_at is
-- not logged; one that sets deleted_at is logged as a soft_delete.
CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ignored TEXT[] := COALESCE(TG_ARGV, '{}');
    old_row JSONB;
    new_row JSONB;
    change VARCHAR(12) := lower(TG_OP);
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        old_row := to_jsonb(OLD) - ignored;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        new_row := to_jsonb(NEW) - ignored;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF old_row - 'updated_at' = new_row - 'updated_at' THEN
            RETURN NULL;
        END IF;
        IF old_row -> 'deleted_at' = 'null'::jsonb AND new_row -> 'deleted_at' <> 'null'::jsonb THEN
            change := 'soft_delete';
        END IF;
    END IF;

    INSERT INTO audit_log (table_name, record_id, action, changed_by, before, after)
    VALUES (
        TG_TABLE_NAME,
        (COALESCE(new_row, old_row) ->> 'id')::BIGINT,
        change,
        NULLIF(current_setting('app.user_id', true), '')::INTEGER,
        old_row,
        new_row
    );
    RETURN NULL;
END;
$$;

-- Attach (or re-attach) the audit trigger to a table. New business tables
-- in later migrations call this too.
CREATE OR REPLACE FUNCTION audit_attach(target REGCLASS, ignored TEXT[] DEFAULT '{}') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS audit_row_change ON %s', target);
    EXECUTE format(
        'CREATE TRIGGER audit_row_change AFTER INSERT OR UPDATE OR DELETE ON %s
           FOR EACH ROW EXECUTE FUNCTION audit_row_change(%s)',
        target,
        COALESCE((SELECT string_agg(quote_literal(col), ', ') FROM unnest(ignored) AS col), '')
    );
END;
$$;

-- Every business table. Left out: schema_migrations, audit_log itself, and
-- user_sessions / password_reset_tokens (token hashes, no business meaning).
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'activities',
        'animal_breeds', 'animal_care_plan_tasks', 'animal_care_plans', 'animal_care_schedules',
        'animal_deaths', 'animal_diseases_treatments', 'animal_feed_records', 'animal_group_adjustments',
        'animal_groups', 'animal_health_records', 'animal_housing', 'animal_production_records',
        'animal_production_types', 'animal_types', 'animals', 'batch_care_schedules', 'breeding_records',
        'crop_batches', 'crop_care_plan_tasks', 'crop_care_plans', 'crop_input_applications',
        'crop_pests_diseases', 'crop_types', 'crop_varieties',
        'employee_attendance', 'employee_leaves', 'employee_salaries', 'employees',
        'enterprises', 'financial_transactions', 'growing_locations', 'growth_observations', 'harvests',
        'incubation_records', 'inventory_batches', 'inventory_categories', 'inventory_items',
        'inventory_transactions', 'production_records', 'sales', 'scheduled_animal_tasks',
        'scheduled_batch_tasks', 'suppliers', 'task_assignments', 'task_categories',
        'task_checklist_items', 'task_updates', 'tasks', 'transaction_categories',
        'treatment_medications', 'units_of_measure'
    ] LOOP
        PERFORM audit_attach(tbl::REGCLASS);
    END LOOP;

    -- Users: role, name and status changes are kept; the password hash and
    -- the login bookkeeping are not
    PERFORM audit_attach('users', ARRAY['password_hash', 'last_login', 'failed_login_count', 'locked_until']);
END$$;
