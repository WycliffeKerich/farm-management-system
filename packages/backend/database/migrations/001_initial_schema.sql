-- Farm Management System - Initial Database Schema
-- This migration creates all core tables for the application

-- ============================================================================
-- 1. USER & EMPLOYEE MANAGEMENT
-- ============================================================================

-- Users table (system users for login and access control)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'manager', 'worker')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees (farmworkers with employment details)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    id_number VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    address TEXT,
    position VARCHAR(100),
    department VARCHAR(100),
    date_hired DATE NOT NULL,
    employment_type VARCHAR(50) CHECK (employment_type IN ('permanent', 'casual', 'seasonal')),
    salary_type VARCHAR(50) CHECK (salary_type IN ('monthly', 'daily', 'hourly')),
    base_salary DECIMAL(10, 2),
    bank_details TEXT,
    emergency_contact TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'terminated')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Employee attendance
CREATE TABLE IF NOT EXISTS employee_attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    clock_in_time TIME,
    clock_out_time TIME,
    hours_worked DECIMAL(4, 2),
    status VARCHAR(50) CHECK (status IN ('present', 'absent', 'late', 'half_day')),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee salaries
CREATE TABLE IF NOT EXISTS employee_salaries (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    basic_pay DECIMAL(10, 2) NOT NULL,
    allowances DECIMAL(10, 2) DEFAULT 0,
    deductions DECIMAL(10, 2) DEFAULT 0,
    overtime_hours DECIMAL(6, 2) DEFAULT 0,
    overtime_pay DECIMAL(10, 2) DEFAULT 0,
    total_pay DECIMAL(10, 2) NOT NULL,
    payment_date DATE,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    notes TEXT,
    processed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee leaves
CREATE TABLE IF NOT EXISTS employee_leaves (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(50) CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'maternity', 'paternity')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by INTEGER REFERENCES users(id),
    approval_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. CROP MANAGEMENT
-- ============================================================================

-- Crop types
CREATE TABLE IF NOT EXISTS crop_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    typical_growth_days INTEGER,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crop varieties
CREATE TABLE IF NOT EXISTS crop_varieties (
    id SERIAL PRIMARY KEY,
    crop_type_id INTEGER REFERENCES crop_types(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    growth_days INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Growing locations
CREATE TABLE IF NOT EXISTS growing_locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    size_sqm DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crop batches
CREATE TABLE IF NOT EXISTS crop_batches (
    id SERIAL PRIMARY KEY,
    batch_code VARCHAR(50) UNIQUE NOT NULL,
    crop_variety_id INTEGER REFERENCES crop_varieties(id),
    location_id INTEGER REFERENCES growing_locations(id),
    planting_date DATE NOT NULL,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    quantity_planted INTEGER NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('planted', 'growing', 'harvesting', 'completed')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Growth observations
CREATE TABLE IF NOT EXISTS growth_observations (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES crop_batches(id) ON DELETE CASCADE,
    observation_date DATE NOT NULL,
    growth_stage VARCHAR(100),
    health_status VARCHAR(50),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Harvests
CREATE TABLE IF NOT EXISTS harvests (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES crop_batches(id) ON DELETE CASCADE,
    harvest_date DATE NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    grade VARCHAR(50),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crop input applications
CREATE TABLE IF NOT EXISTS crop_input_applications (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES crop_batches(id) ON DELETE CASCADE,
    application_date DATE NOT NULL,
    input_type VARCHAR(50) NOT NULL CHECK (input_type IN ('fertilizer', 'pesticide', 'herbicide', 'fungicide')),
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    application_method VARCHAR(100),
    target_pest_disease VARCHAR(255),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crop pests and diseases
CREATE TABLE IF NOT EXISTS crop_pests_diseases (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES crop_batches(id) ON DELETE CASCADE,
    incident_date DATE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('pest', 'disease')),
    name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_area VARCHAR(100),
    symptoms TEXT,
    control_measures TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'controlled', 'resolved')),
    resolution_date DATE,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. ANIMAL MANAGEMENT
-- ============================================================================

-- Animal types
CREATE TABLE IF NOT EXISTS animal_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    production_types JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal breeds
CREATE TABLE IF NOT EXISTS animal_breeds (
    id SERIAL PRIMARY KEY,
    animal_type_id INTEGER REFERENCES animal_types(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal housing
CREATE TABLE IF NOT EXISTS animal_housing (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    animal_type_id INTEGER REFERENCES animal_types(id),
    capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual animals
CREATE TABLE IF NOT EXISTS animals (
    id SERIAL PRIMARY KEY,
    tag_number VARCHAR(50) UNIQUE NOT NULL,
    animal_breed_id INTEGER REFERENCES animal_breeds(id),
    housing_id INTEGER REFERENCES animal_housing(id),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
    date_of_birth DATE,
    date_acquired DATE NOT NULL,
    acquisition_type VARCHAR(50),
    purchase_price DECIMAL(10, 2),
    parent_male_id INTEGER REFERENCES animals(id),
    parent_female_id INTEGER REFERENCES animals(id),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'sold', 'deceased', 'culled')),
    status_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal groups (flocks, herds, hives)
CREATE TABLE IF NOT EXISTS animal_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    animal_breed_id INTEGER REFERENCES animal_breeds(id),
    housing_id INTEGER REFERENCES animal_housing(id),
    group_type VARCHAR(50),
    quantity INTEGER NOT NULL,
    date_established DATE NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'closed')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Animal health records
CREATE TABLE IF NOT EXISTS animal_health_records (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,
    record_date DATE NOT NULL,
    record_type VARCHAR(50) NOT NULL CHECK (record_type IN ('vaccination', 'treatment', 'checkup', 'deworming')),
    diagnosis TEXT,
    treatment TEXT,
    medication VARCHAR(255),
    veterinarian VARCHAR(255),
    cost DECIMAL(10, 2),
    next_followup_date DATE,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- Animal diseases and treatments
CREATE TABLE IF NOT EXISTS animal_diseases_treatments (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,
    diagnosis_date DATE NOT NULL,
    disease_name VARCHAR(255) NOT NULL,
    symptoms TEXT,
    severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    diagnosis TEXT,
    treatment_plan TEXT,
    medications TEXT,
    treatment_start_date DATE,
    treatment_end_date DATE,
    veterinarian VARCHAR(255),
    cost DECIMAL(10, 2),
    status VARCHAR(50) CHECK (status IN ('ongoing', 'completed', 'chronic')),
    outcome TEXT,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- Animal feed records
CREATE TABLE IF NOT EXISTS animal_feed_records (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,
    feed_date DATE NOT NULL,
    feed_type VARCHAR(100),
    feed_name VARCHAR(255),
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    feeding_time TIME,
    cost_per_unit DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- Breeding records
CREATE TABLE IF NOT EXISTS breeding_records (
    id SERIAL PRIMARY KEY,
    male_animal_id INTEGER REFERENCES animals(id),
    female_animal_id INTEGER REFERENCES animals(id),
    breeding_date DATE NOT NULL,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    offspring_count INTEGER,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production records (eggs, milk, honey)
CREATE TABLE IF NOT EXISTS production_records (
    id SERIAL PRIMARY KEY,
    animal_id INTEGER REFERENCES animals(id) ON DELETE CASCADE,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE CASCADE,
    production_date DATE NOT NULL,
    production_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK ((animal_id IS NOT NULL) OR (animal_group_id IS NOT NULL))
);

-- ============================================================================
-- 4. INVENTORY MANAGEMENT
-- ============================================================================

-- Inventory categories
CREATE TABLE IF NOT EXISTS inventory_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory items
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES inventory_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    unit VARCHAR(20) NOT NULL,
    min_stock_level DECIMAL(10, 2),
    current_stock DECIMAL(10, 2) DEFAULT 0,
    unit_cost DECIMAL(10, 2),
    supplier VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory transactions
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'adjustment', 'waste')),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    transaction_date DATE NOT NULL,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. TASK MANAGEMENT
-- ============================================================================

-- Task categories
CREATE TABLE IF NOT EXISTS task_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    task_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES task_categories(id),
    priority VARCHAR(50) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date DATE,
    start_date DATE,
    completion_date DATE,
    estimated_hours DECIMAL(6, 2),
    actual_hours DECIMAL(6, 2),
    location_id INTEGER REFERENCES growing_locations(id),
    enterprise_id INTEGER,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task assignments
CREATE TABLE IF NOT EXISTS task_assignments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL,
    assigned_by INTEGER REFERENCES users(id),
    role VARCHAR(50) CHECK (role IN ('assignee', 'supervisor')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task updates
CREATE TABLE IF NOT EXISTS task_updates (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    progress_percentage INTEGER CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    hours_worked DECIMAL(6, 2),
    notes TEXT,
    photos TEXT,
    updated_by INTEGER REFERENCES users(id)
);

-- Task checklist items
CREATE TABLE IF NOT EXISTS task_checklist_items (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    item_description TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_date TIMESTAMP,
    completed_by INTEGER REFERENCES users(id),
    order_index INTEGER DEFAULT 0
);

-- ============================================================================
-- 6. FINANCIAL MANAGEMENT
-- ============================================================================

-- Enterprises
CREATE TABLE IF NOT EXISTS enterprises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transaction categories
CREATE TABLE IF NOT EXISTS transaction_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Financial transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
    id SERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    category_id INTEGER REFERENCES transaction_categories(id),
    enterprise_id INTEGER REFERENCES enterprises(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    description TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    sale_date DATE NOT NULL,
    enterprise_id INTEGER REFERENCES enterprises(id),
    customer_name VARCHAR(255),
    product_type VARCHAR(50),
    product_description TEXT,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
    reference_type VARCHAR(50),
    reference_id INTEGER,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- Employee indexes
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_attendance_date ON employee_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_period ON employee_salaries(pay_period_start, pay_period_end);

-- Crop indexes
CREATE INDEX IF NOT EXISTS idx_crop_batches_status ON crop_batches(status);
CREATE INDEX IF NOT EXISTS idx_crop_batches_location ON crop_batches(location_id);
CREATE INDEX IF NOT EXISTS idx_crop_batches_planting_date ON crop_batches(planting_date);
CREATE INDEX IF NOT EXISTS idx_harvests_batch ON harvests(batch_id);
CREATE INDEX IF NOT EXISTS idx_harvests_date ON harvests(harvest_date);
CREATE INDEX IF NOT EXISTS idx_crop_pests_diseases_batch ON crop_pests_diseases(batch_id);

-- Animal indexes
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(status);
CREATE INDEX IF NOT EXISTS idx_animals_breed ON animals(animal_breed_id);
CREATE INDEX IF NOT EXISTS idx_animals_housing ON animals(housing_id);
CREATE INDEX IF NOT EXISTS idx_animal_groups_status ON animal_groups(status);
CREATE INDEX IF NOT EXISTS idx_production_records_date ON production_records(production_date);
CREATE INDEX IF NOT EXISTS idx_production_records_type ON production_records(production_type);
CREATE INDEX IF NOT EXISTS idx_animal_feed_date ON animal_feed_records(feed_date);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON inventory_items(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_date ON inventory_transactions(transaction_date);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignments_employee ON task_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id);

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_enterprise ON financial_transactions(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_enterprise ON sales(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(payment_status);
