-- Migration: Add crop care plan system for scheduled activities
-- Enables template-based care plans with automatic task scheduling

-- ============================================================================
-- CROP CARE PLANS - Templates for variety-specific care schedules
-- ============================================================================

CREATE TABLE IF NOT EXISTS crop_care_plans (
    id SERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    crop_variety_id INTEGER REFERENCES crop_varieties(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_template BOOLEAN DEFAULT true,
    total_duration_days INTEGER, -- Total plan duration (can differ from variety growth_days)
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ============================================================================
-- CROP CARE PLAN TASKS - Individual activities within a care plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS crop_care_plan_tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES crop_care_plans(id) ON DELETE CASCADE,
    task_sequence INTEGER NOT NULL, -- Order in plan
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    task_category_id INTEGER REFERENCES task_categories(id),

    -- Scheduling: when to perform relative to planting
    days_from_planting INTEGER NOT NULL, -- Day 0 = planting date
    tolerance_days_before INTEGER DEFAULT 0, -- Can be done X days early
    tolerance_days_after INTEGER DEFAULT 2, -- Can be done X days late

    -- Recurring task support
    is_recurring BOOLEAN DEFAULT false,
    recurrence_interval_days INTEGER, -- e.g., every 7 days
    recurrence_end_days INTEGER, -- Stop recurring after day X (null = until harvest)
    recurrence_start_days INTEGER, -- Start recurring from day X (null = from days_from_planting)

    -- Task details
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_hours DECIMAL(6,2),

    -- Input requirements (for fertilizer/pesticide applications)
    input_type VARCHAR(50), -- 'fertilizer', 'pesticide', 'herbicide', 'fungicide', 'water', 'other'
    input_product_name VARCHAR(255),
    input_quantity DECIMAL(10,2),
    input_unit VARCHAR(20),
    input_application_method VARCHAR(100),

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ============================================================================
-- BATCH CARE SCHEDULES - Links a batch to its applied care plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_care_schedules (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES crop_batches(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES crop_care_plans(id) ON DELETE SET NULL,
    applied_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    notes TEXT,
    applied_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Partial unique index to ensure only one active schedule per batch
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_care_schedules_active_batch
    ON batch_care_schedules(batch_id)
    WHERE deleted_at IS NULL AND status = 'active';

-- ============================================================================
-- SCHEDULED BATCH TASKS - Actual scheduled activities per batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_batch_tasks (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES crop_batches(id) ON DELETE CASCADE,
    schedule_id INTEGER NOT NULL REFERENCES batch_care_schedules(id) ON DELETE CASCADE,
    plan_task_id INTEGER REFERENCES crop_care_plan_tasks(id) ON DELETE SET NULL,

    -- Scheduling
    planned_date DATE NOT NULL,
    due_date_start DATE NOT NULL, -- Earliest acceptable date (planned - tolerance_before)
    due_date_end DATE NOT NULL, -- Latest acceptable date (planned + tolerance_after)
    actual_date DATE, -- When it was actually completed

    -- Task details (copied from plan task for reference)
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium',
    estimated_hours DECIMAL(6,2),

    -- Input details (for fertilizer/pesticide tasks)
    input_type VARCHAR(50),
    input_product_name VARCHAR(255),
    input_quantity DECIMAL(10,2),
    input_unit VARCHAR(20),
    input_application_method VARCHAR(100),

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'upcoming', 'due', 'overdue', 'completed', 'skipped')),
    completion_notes TEXT,
    completed_by INTEGER REFERENCES users(id),

    -- Links to other systems
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL, -- Link to farm task if created
    input_application_id INTEGER REFERENCES crop_input_applications(id) ON DELETE SET NULL, -- Link if input was applied

    -- Recurring task tracking
    is_recurring_instance BOOLEAN DEFAULT false,
    recurring_sequence INTEGER, -- Which occurrence (1st, 2nd, 3rd, etc.)

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crop_care_plans_variety ON crop_care_plans(crop_variety_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crop_care_plans_template ON crop_care_plans(is_template) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crop_care_plans_status ON crop_care_plans(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_plan ON crop_care_plan_tasks(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_days ON crop_care_plan_tasks(days_from_planting);
CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_recurring ON crop_care_plan_tasks(is_recurring) WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_batch_care_schedules_batch ON batch_care_schedules(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batch_care_schedules_plan ON batch_care_schedules(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_batch_care_schedules_status ON batch_care_schedules(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_batch_tasks_batch ON scheduled_batch_tasks(batch_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_batch_tasks_schedule ON scheduled_batch_tasks(schedule_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_batch_tasks_planned ON scheduled_batch_tasks(planned_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_batch_tasks_status ON scheduled_batch_tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_batch_tasks_due_end ON scheduled_batch_tasks(due_date_end) WHERE deleted_at IS NULL AND status NOT IN ('completed', 'skipped');

-- ============================================================================
-- HELPER FUNCTION: Update scheduled task statuses based on current date
-- ============================================================================

CREATE OR REPLACE FUNCTION update_scheduled_task_statuses()
RETURNS void AS $$
BEGIN
    -- Mark tasks as 'upcoming' if within 7 days
    UPDATE scheduled_batch_tasks
    SET status = 'upcoming', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending'
      AND deleted_at IS NULL
      AND planned_date <= CURRENT_DATE + INTERVAL '7 days'
      AND planned_date > CURRENT_DATE;

    -- Mark tasks as 'due' if within tolerance window
    UPDATE scheduled_batch_tasks
    SET status = 'due', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('pending', 'upcoming')
      AND deleted_at IS NULL
      AND CURRENT_DATE >= due_date_start
      AND CURRENT_DATE <= due_date_end;

    -- Mark tasks as 'overdue' if past tolerance window
    UPDATE scheduled_batch_tasks
    SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('pending', 'upcoming', 'due')
      AND deleted_at IS NULL
      AND CURRENT_DATE > due_date_end;
END;
$$ LANGUAGE plpgsql;
