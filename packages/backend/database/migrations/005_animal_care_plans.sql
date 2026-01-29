-- Migration: Animal Care Plan System
-- Mirrors the crop care plan structure for animal management
-- Supports vaccination schedules, feeding plans, health checkups, etc.

-- ============================================================================
-- 1. ANIMAL CARE PLANS - Templates for animal care schedules
-- ============================================================================

CREATE TABLE IF NOT EXISTS animal_care_plans (
    id SERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL,

    -- Can be linked to specific animal type/breed or be generic
    animal_type_id INTEGER REFERENCES animal_types(id) ON DELETE SET NULL,
    animal_breed_id INTEGER REFERENCES animal_breeds(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Plan type categorization
    plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN (
        'vaccination', 'feeding', 'health_checkup', 'breeding',
        'growth_monitoring', 'general', 'custom'
    )),

    -- Template settings
    is_template BOOLEAN DEFAULT true,
    total_duration_days INTEGER, -- Total plan duration (e.g., lifecycle of a broiler: 42 days)

    -- Applicability
    applies_to VARCHAR(20) DEFAULT 'both' CHECK (applies_to IN ('individual', 'flock', 'both')),

    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),

    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ============================================================================
-- 2. ANIMAL CARE PLAN TASKS - Individual activities within a care plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS animal_care_plan_tasks (
    id SERIAL PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES animal_care_plans(id) ON DELETE CASCADE,
    task_sequence INTEGER NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    task_category_id INTEGER REFERENCES task_categories(id),

    -- Task type for animal-specific activities
    task_type VARCHAR(50) CHECK (task_type IN (
        'vaccination', 'deworming', 'health_check', 'weighing',
        'feeding_change', 'medication', 'supplement', 'observation',
        'breeding_check', 'pregnancy_check', 'other'
    )),

    -- Scheduling: when to perform relative to start date (acquisition/birth/hatch)
    days_from_start INTEGER NOT NULL, -- Day 0 = start date (acquisition, birth, or hatch date)
    tolerance_days_before INTEGER DEFAULT 0,
    tolerance_days_after INTEGER DEFAULT 2,

    -- Age-based scheduling alternative (useful for ongoing flocks)
    age_based BOOLEAN DEFAULT false,
    target_age_days INTEGER, -- Perform when animal reaches this age

    -- Recurring task support
    is_recurring BOOLEAN DEFAULT false,
    recurrence_interval_days INTEGER,
    recurrence_end_days INTEGER,
    recurrence_start_days INTEGER,

    -- Task details
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_hours DECIMAL(6,2),

    -- Input requirements (for medications, vaccines, feed)
    input_type VARCHAR(50) CHECK (input_type IN (
        'vaccine', 'medication', 'dewormer', 'supplement',
        'feed', 'vitamin', 'mineral', 'other'
    )),
    input_product_name VARCHAR(255),
    input_quantity DECIMAL(10,2),
    input_unit VARCHAR(20),
    input_dosage_per_animal VARCHAR(100), -- e.g., "0.5ml per bird"
    input_application_method VARCHAR(100), -- e.g., "injection", "oral", "in water"

    -- Veterinary requirements
    requires_vet BOOLEAN DEFAULT false,
    vet_instructions TEXT,

    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- ============================================================================
-- 3. ANIMAL CARE SCHEDULES - Links animals/groups to applied care plans
-- ============================================================================

CREATE TABLE IF NOT EXISTS animal_care_schedules (
    id SERIAL PRIMARY KEY,

    -- Can be linked to individual animal or group
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,

    plan_id INTEGER NOT NULL REFERENCES animal_care_plans(id) ON DELETE SET NULL,

    -- Schedule details
    start_date DATE NOT NULL, -- The reference date for calculating task dates
    applied_date DATE DEFAULT CURRENT_DATE,

    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    notes TEXT,
    applied_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Ensure either animal_id or animal_group_id is set
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- Partial unique index to ensure only one active schedule per animal/group per plan type
CREATE UNIQUE INDEX IF NOT EXISTS idx_animal_care_schedules_active_animal
    ON animal_care_schedules(animal_id, plan_id)
    WHERE animal_id IS NOT NULL AND deleted_at IS NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_animal_care_schedules_active_group
    ON animal_care_schedules(animal_group_id, plan_id)
    WHERE animal_group_id IS NOT NULL AND deleted_at IS NULL AND status = 'active';

-- ============================================================================
-- 4. SCHEDULED ANIMAL TASKS - Actual scheduled activities
-- ============================================================================

CREATE TABLE IF NOT EXISTS scheduled_animal_tasks (
    id SERIAL PRIMARY KEY,

    -- Links
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,
    schedule_id INTEGER NOT NULL REFERENCES animal_care_schedules(id) ON DELETE CASCADE,
    plan_task_id INTEGER REFERENCES animal_care_plan_tasks(id) ON DELETE SET NULL,

    -- Scheduling
    planned_date DATE NOT NULL,
    due_date_start DATE NOT NULL,
    due_date_end DATE NOT NULL,
    actual_date DATE,

    -- Task details (copied from plan task for reference)
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50),
    priority VARCHAR(50) DEFAULT 'medium',
    estimated_hours DECIMAL(6,2),

    -- Input details
    input_type VARCHAR(50),
    input_product_name VARCHAR(255),
    input_quantity DECIMAL(10,2),
    input_unit VARCHAR(20),
    input_dosage_per_animal VARCHAR(100),
    input_application_method VARCHAR(100),

    -- For flock tasks, track how many animals were treated
    quantity_treated INTEGER,
    quantity_total INTEGER,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending', 'upcoming', 'due', 'overdue', 'completed', 'skipped', 'partially_completed'
    )),
    completion_notes TEXT,
    completed_by INTEGER REFERENCES users(id),

    -- Links to other records
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    health_record_id INTEGER REFERENCES animal_health_records(id) ON DELETE SET NULL,

    -- Recurring task tracking
    is_recurring_instance BOOLEAN DEFAULT false,
    recurring_sequence INTEGER,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,

    -- Ensure either animal_id or animal_group_id is set
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Animal care plans indexes
CREATE INDEX IF NOT EXISTS idx_animal_care_plans_type ON animal_care_plans(animal_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_plans_breed ON animal_care_plans(animal_breed_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_plans_template ON animal_care_plans(is_template) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_plans_status ON animal_care_plans(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_plans_plan_type ON animal_care_plans(plan_type) WHERE deleted_at IS NULL;

-- Animal care plan tasks indexes
CREATE INDEX IF NOT EXISTS idx_animal_care_plan_tasks_plan ON animal_care_plan_tasks(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_plan_tasks_days ON animal_care_plan_tasks(days_from_start);
CREATE INDEX IF NOT EXISTS idx_animal_care_plan_tasks_recurring ON animal_care_plan_tasks(is_recurring) WHERE is_recurring = true;

-- Animal care schedules indexes
CREATE INDEX IF NOT EXISTS idx_animal_care_schedules_animal ON animal_care_schedules(animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_schedules_group ON animal_care_schedules(animal_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_schedules_plan ON animal_care_schedules(plan_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_animal_care_schedules_status ON animal_care_schedules(status) WHERE deleted_at IS NULL;

-- Scheduled animal tasks indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_animal_tasks_animal ON scheduled_animal_tasks(animal_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_animal_tasks_group ON scheduled_animal_tasks(animal_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_animal_tasks_schedule ON scheduled_animal_tasks(schedule_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_animal_tasks_planned ON scheduled_animal_tasks(planned_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_animal_tasks_status ON scheduled_animal_tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_animal_tasks_due_end ON scheduled_animal_tasks(due_date_end)
    WHERE deleted_at IS NULL AND status NOT IN ('completed', 'skipped');

-- ============================================================================
-- 6. HELPER FUNCTION: Update scheduled animal task statuses
-- ============================================================================

CREATE OR REPLACE FUNCTION update_scheduled_animal_task_statuses()
RETURNS void AS $$
BEGIN
    -- Mark tasks as 'upcoming' if within 7 days
    UPDATE scheduled_animal_tasks
    SET status = 'upcoming', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending'
      AND deleted_at IS NULL
      AND planned_date <= CURRENT_DATE + INTERVAL '7 days'
      AND planned_date > CURRENT_DATE;

    -- Mark tasks as 'due' if within tolerance window
    UPDATE scheduled_animal_tasks
    SET status = 'due', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('pending', 'upcoming')
      AND deleted_at IS NULL
      AND CURRENT_DATE >= due_date_start
      AND CURRENT_DATE <= due_date_end;

    -- Mark tasks as 'overdue' if past tolerance window
    UPDATE scheduled_animal_tasks
    SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
    WHERE status IN ('pending', 'upcoming', 'due')
      AND deleted_at IS NULL
      AND CURRENT_DATE > due_date_end;
END;
$$ LANGUAGE plpgsql;
