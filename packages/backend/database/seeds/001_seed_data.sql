-- Farm Management System - Seed Data
-- This file contains initial seed data for development and testing

-- ============================================================================
-- 1. SEED USERS
-- ============================================================================
-- Password for all users: password123 (hashed with bcrypt rounds=12)
-- In production, users should change these immediately

INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active) VALUES
('owner@farm.com', '$2a$12$klmaxRRxiz2CsuTqWXvSn.X2Z.U1/frVdlxP//xKmDd9S92NVvjoi', 'John', 'Owner', 'owner', '+254712345678', true),
('manager@farm.com', '$2a$12$klmaxRRxiz2CsuTqWXvSn.X2Z.U1/frVdlxP//xKmDd9S92NVvjoi', 'Jane', 'Manager', 'manager', '+254723456789', true),
('worker@farm.com', '$2a$12$klmaxRRxiz2CsuTqWXvSn.X2Z.U1/frVdlxP//xKmDd9S92NVvjoi', 'Mike', 'Worker', 'worker', '+254734567890', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- 2. SEED CROP TYPES AND VARIETIES
-- ============================================================================

INSERT INTO crop_types (name, category, typical_growth_days, description) VALUES
('Tomato', 'greenhouse', 75, 'Popular greenhouse vegetable crop'),
('Capsicum', 'greenhouse', 80, 'Bell peppers for greenhouse production'),
('Strawberry', 'greenhouse', 90, 'Strawberries grown in controlled environment'),
('Button Mushroom', 'mushroom', 21, 'Common edible mushroom variety'),
('Oyster Mushroom', 'mushroom', 14, 'Fast-growing oyster mushroom')
ON CONFLICT (LOWER(name)) WHERE deleted_at IS NULL DO NOTHING;

INSERT INTO crop_varieties (crop_type_id, name, growth_days, notes) VALUES
(1, 'Cherry Tomato', 65, 'Small sweet tomatoes'),
(1, 'Beefsteak Tomato', 85, 'Large slicing tomatoes'),
(2, 'Red Bell Pepper', 80, 'Red capsicum variety'),
(2, 'Yellow Bell Pepper', 80, 'Yellow capsicum variety'),
(3, 'Albion Strawberry', 90, 'Day-neutral strawberry variety'),
(4, 'White Button', 21, 'Standard button mushroom'),
(5, 'Pearl Oyster', 14, 'Common oyster mushroom')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. SEED GROWING LOCATIONS
-- ============================================================================

INSERT INTO growing_locations (name, type, size_sqm, is_active, notes) VALUES
('Greenhouse 1', 'greenhouse', 500.00, true, 'Main greenhouse for tomatoes'),
('Greenhouse 2', 'greenhouse', 400.00, true, 'Greenhouse for capsicum and strawberries'),
('Mushroom House A', 'mushroom_house', 200.00, true, 'Button mushroom production'),
('Mushroom House B', 'mushroom_house', 200.00, true, 'Oyster mushroom production')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. SEED ANIMAL TYPES AND BREEDS
-- ============================================================================

INSERT INTO animal_types (name, category, production_types) VALUES
('Chicken', 'poultry', '["eggs", "meat"]'),
('Goat', 'livestock', '["milk", "meat"]'),
('Sheep', 'livestock', '["meat", "wool"]'),
('Cow', 'livestock', '["milk", "meat"]'),
('Bee', 'apiculture', '["honey"]')
ON CONFLICT (LOWER(name)) WHERE deleted_at IS NULL DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description) VALUES
(1, 'Improved Kienyeji', 'Indigenous chicken breed improved for better production'),
(2, 'Dairy Goat', 'Goat breed optimized for milk production'),
(3, 'Dorper Sheep', 'Hardy meat sheep breed'),
(4, 'Dairy Cow', 'High milk production cattle'),
(5, 'African Bee', 'Local bee species for honey production')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. SEED ANIMAL HOUSING
-- ============================================================================

INSERT INTO animal_housing (name, animal_type_id, capacity, is_active, notes) VALUES
('Chicken Coop 1', 1, 100, true, 'Main layer house'),
('Goat Shed A', 2, 20, true, 'Dairy goat housing'),
('Sheep Pen 1', 3, 30, true, 'Dorper sheep enclosure'),
('Cow Shed', 4, 10, true, 'Dairy cow housing'),
('Apiary 1', 5, 20, true, 'Bee hive location')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. SEED INVENTORY CATEGORIES
-- ============================================================================

INSERT INTO inventory_categories (name, type, description) VALUES
('Seeds', 'consumable', 'Crop seeds and planting material'),
('Feed', 'consumable', 'Animal feed and supplements'),
('Fertilizer', 'consumable', 'Soil fertilizers and nutrients'),
('Pesticide', 'consumable', 'Pest control products'),
('Medicine', 'consumable', 'Veterinary medicines and vaccines'),
('Equipment', 'equipment', 'Farm tools and equipment')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. SEED TASK CATEGORIES
-- ============================================================================

INSERT INTO task_categories (name, description) VALUES
('Planting', 'Crop planting and transplanting tasks'),
('Harvesting', 'Crop harvesting activities'),
('Feeding', 'Animal feeding tasks'),
('Maintenance', 'General farm maintenance'),
('Health Management', 'Animal health and treatment tasks'),
('Cleaning', 'Cleaning and sanitation tasks')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. SEED ENTERPRISES
-- ============================================================================

INSERT INTO enterprises (name, enterprise_type, unit_of_output, description, is_active) VALUES
('Tomato Production', 'crops', 'kg', 'Greenhouse tomato farming', true),
('Capsicum Production', 'crops', 'kg', 'Bell pepper production', true),
('Strawberry Production', 'crops', 'kg', 'Strawberry farming', true),
('Mushroom Production', 'mushrooms', 'kg', 'Button and oyster mushroom cultivation', true),
('Egg Production', 'poultry', 'egg', 'Layer chicken egg production', true),
('Milk Production - Goats', 'dairy', 'litre', 'Dairy goat milk production', true),
('Milk Production - Cows', 'dairy', 'litre', 'Dairy cow milk production', true),
('Sheep Farming', 'livestock', 'kg', 'Dorper sheep meat production', true),
('Honey Production', 'apiculture', 'kg', 'Honey from beehives', true)
ON CONFLICT (LOWER(name)) WHERE deleted_at IS NULL DO NOTHING;

-- The enterprise each type's new batches, animals and groups default to
UPDATE crop_types ct SET enterprise_id = e.id
  FROM enterprises e,
       (VALUES ('Tomato', 'Tomato Production'), ('Capsicum', 'Capsicum Production'),
               ('Strawberry', 'Strawberry Production'), ('Button Mushroom', 'Mushroom Production'),
               ('Oyster Mushroom', 'Mushroom Production')) AS link(type_name, enterprise_name)
 WHERE ct.enterprise_id IS NULL AND ct.deleted_at IS NULL
   AND LOWER(ct.name) = LOWER(link.type_name)
   AND LOWER(e.name) = LOWER(link.enterprise_name) AND e.deleted_at IS NULL;

UPDATE animal_types at SET enterprise_id = e.id
  FROM enterprises e,
       (VALUES ('Chicken', 'Egg Production'), ('Goat', 'Milk Production - Goats'),
               ('Cow', 'Milk Production - Cows'), ('Sheep', 'Sheep Farming'),
               ('Bee', 'Honey Production')) AS link(type_name, enterprise_name)
 WHERE at.enterprise_id IS NULL AND at.deleted_at IS NULL
   AND LOWER(at.name) = LOWER(link.type_name)
   AND LOWER(e.name) = LOWER(link.enterprise_name) AND e.deleted_at IS NULL;

-- ============================================================================
-- 9. SEED TRANSACTION CATEGORIES
-- ============================================================================

INSERT INTO transaction_categories (name, type, description) VALUES
-- Income categories
('Crop Sales', 'income', 'Revenue from crop sales'),
('Animal Product Sales', 'income', 'Revenue from eggs, milk, honey'),
('Animal Sales', 'income', 'Revenue from livestock sales'),

-- Expense categories
('Seeds Purchase', 'expense', 'Purchase of seeds and planting material'),
('Feed Purchase', 'expense', 'Purchase of animal feed'),
('Fertilizer Purchase', 'expense', 'Purchase of fertilizers'),
('Pesticide Purchase', 'expense', 'Purchase of pesticides'),
('Veterinary Services', 'expense', 'Veterinary consultation and treatment'),
('Medicine Purchase', 'expense', 'Purchase of veterinary medicines'),
('Labor Costs', 'expense', 'Employee salaries and wages'),
('Utilities', 'expense', 'Water, electricity, fuel'),
('Maintenance', 'expense', 'Equipment and infrastructure maintenance'),
('Transport', 'expense', 'Transportation costs')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. SEED CROP CARE PLANS AND TASKS
-- Note: These use ON CONFLICT to handle re-running the seed
-- Column names: description, tolerance_days_before, tolerance_days_after, estimated_hours, input_product_name
-- ============================================================================

-- Tomato Care Plan (Template for 75-day growth cycle)
INSERT INTO crop_care_plans (name, plan_code, crop_variety_id, description, total_duration_days, is_template, status, created_by)
SELECT 'Tomato Standard Care Plan', 'TCP-001', cv.id,
       'Comprehensive care plan for greenhouse tomatoes including fertilization, pest management, and maintenance tasks.',
       75, true, 'active', 1
FROM crop_varieties cv
JOIN crop_types ct ON cv.crop_type_id = ct.id
WHERE ct.name = 'Tomato' AND cv.name = 'Cherry Tomato'
LIMIT 1
ON CONFLICT (plan_code) DO NOTHING;

-- Tomato Care Plan Tasks
-- Note: task_category_id references: 1=Planting, 2=Harvesting, 3=Feeding, 4=Maintenance, 5=Health Management, 6=Cleaning

-- Initial transplant care (Day 0-3)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, input_type, input_product_name, input_quantity, input_unit, task_sequence)
SELECT cp.id, 'Initial Watering', 'Water transplants thoroughly after planting', 4, 0, 0, 1, 'high', 0.5, NULL, NULL, NULL, NULL, 1
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, input_type, input_product_name, input_quantity, input_unit, task_sequence)
SELECT cp.id, 'Starter Fertilizer Application', 'Apply starter fertilizer to encourage root development', 4, 3, 1, 2, 'high', 0.75, 'fertilizer', 'NPK 10-52-10', 2.0, 'kg/100 plants', 2
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- Weekly pest scouting (recurring from day 7)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, is_recurring, recurrence_interval_days, recurrence_start_days, recurrence_end_days, task_sequence)
SELECT cp.id, 'Pest Scouting', 'Scout for aphids, whiteflies, spider mites, and tomato hornworms', 5, 7, 1, 2, 'medium', 0.5, true, 7, 7, NULL, 3
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- Bi-weekly fertilizer application (recurring from day 14)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, input_type, input_product_name, input_quantity, input_unit, is_recurring, recurrence_interval_days, recurrence_start_days, recurrence_end_days, task_sequence)
SELECT cp.id, 'Growth Fertilizer Application', 'Apply balanced fertilizer for vegetative growth', 4, 14, 2, 3, 'high', 1.0, 'fertilizer', 'NPK 20-20-20', 3.0, 'kg/100 plants', true, 14, 14, 45, 4
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- Pruning and training (day 14, then weekly)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, is_recurring, recurrence_interval_days, recurrence_start_days, recurrence_end_days, task_sequence)
SELECT cp.id, 'Pruning and Training', 'Remove suckers, tie plants to stakes/trellis', 4, 14, 1, 2, 'medium', 1.5, true, 7, 14, NULL, 5
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- Preventive fungicide spray (day 21, then bi-weekly)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, input_type, input_product_name, input_quantity, input_unit, is_recurring, recurrence_interval_days, recurrence_start_days, recurrence_end_days, task_sequence)
SELECT cp.id, 'Preventive Fungicide Application', 'Apply fungicide to prevent early blight and other fungal diseases', 5, 21, 2, 3, 'medium', 0.75, 'pesticide', 'Copper-based Fungicide', 50.0, 'ml/20L water', true, 14, 21, 70, 6
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- Flowering stage fertilizer (day 35)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, input_type, input_product_name, input_quantity, input_unit, task_sequence)
SELECT cp.id, 'Flowering Stage Fertilizer', 'Switch to high-phosphorus fertilizer for flowering', 4, 35, 2, 3, 'high', 1.0, 'fertilizer', 'NPK 10-30-20', 3.0, 'kg/100 plants', 7
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- Pre-harvest inspection (day 60)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'Pre-Harvest Quality Check', 'Inspect plants for fruit maturity and estimate harvest timing', 2, 60, 3, 5, 'medium', 0.75, 8
FROM crop_care_plans cp WHERE cp.plan_code = 'TCP-001'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Capsicum Care Plan (Template for 80-day growth cycle)
-- ============================================================================

INSERT INTO crop_care_plans (name, plan_code, crop_variety_id, description, total_duration_days, is_template, status, created_by)
SELECT 'Capsicum Standard Care Plan', 'CCP-001', cv.id,
       'Complete care plan for greenhouse bell peppers with focus on nutrient management and pest control.',
       80, true, 'active', 1
FROM crop_varieties cv
JOIN crop_types ct ON cv.crop_type_id = ct.id
WHERE ct.name = 'Capsicum' AND cv.name = 'Red Bell Pepper'
LIMIT 1
ON CONFLICT (plan_code) DO NOTHING;

-- Capsicum Care Plan Tasks
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'Transplant Establishment Watering', 'Ensure adequate moisture for transplant establishment', 4, 0, 0, 1, 'high', 0.5, 1
FROM crop_care_plans cp WHERE cp.plan_code = 'CCP-001'
ON CONFLICT DO NOTHING;

-- Weekly pest monitoring
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, is_recurring, recurrence_interval_days, recurrence_start_days, recurrence_end_days, task_sequence)
SELECT cp.id, 'Pest Monitoring', 'Check for aphids, thrips, and pepper weevils', 5, 10, 1, 2, 'medium', 0.5, true, 7, 10, NULL, 2
FROM crop_care_plans cp WHERE cp.plan_code = 'CCP-001'
ON CONFLICT DO NOTHING;

-- Staking and support (day 21)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'Plant Staking', 'Install stakes and tie plants for support as they grow', 4, 21, 2, 5, 'medium', 1.5, 3
FROM crop_care_plans cp WHERE cp.plan_code = 'CCP-001'
ON CONFLICT DO NOTHING;

-- Flowering stage nutrition (day 45)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, input_type, input_product_name, input_quantity, input_unit, task_sequence)
SELECT cp.id, 'Flowering Booster', 'Apply phosphorus-rich fertilizer for flower development', 4, 45, 3, 5, 'high', 1.0, 'fertilizer', 'NPK 10-40-10', 2.5, 'kg/100 plants', 4
FROM crop_care_plans cp WHERE cp.plan_code = 'CCP-001'
ON CONFLICT DO NOTHING;

-- Harvest readiness check (day 70)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'Harvest Readiness Assessment', 'Check pepper size, color, and firmness for harvest timing', 2, 70, 3, 5, 'medium', 0.75, 5
FROM crop_care_plans cp WHERE cp.plan_code = 'CCP-001'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Mushroom Care Plan (Button Mushroom - 21-day cycle)
-- ============================================================================

INSERT INTO crop_care_plans (name, plan_code, crop_variety_id, description, total_duration_days, is_template, status, created_by)
SELECT 'Button Mushroom Production Plan', 'MCP-001', cv.id,
       'Care plan for button mushroom cultivation including substrate management, humidity control, and harvesting.',
       21, true, 'active', 1
FROM crop_varieties cv
JOIN crop_types ct ON cv.crop_type_id = ct.id
WHERE ct.name = 'Button Mushroom' AND cv.name = 'White Button'
LIMIT 1
ON CONFLICT (plan_code) DO NOTHING;

-- Mushroom Care Plan Tasks
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'Substrate Preparation Check', 'Verify compost temperature and moisture before spawning', 1, 0, 0, 0, 'high', 0.5, 1
FROM crop_care_plans cp WHERE cp.plan_code = 'MCP-001'
ON CONFLICT DO NOTHING;

-- Daily humidity monitoring (recurring)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, is_recurring, recurrence_interval_days, recurrence_start_days, recurrence_end_days, task_sequence)
SELECT cp.id, 'Humidity & Temperature Check', 'Monitor and adjust humidity (85-95%) and temperature (16-18°C)', 4, 1, 0, 0, 'high', 0.25, true, 1, 1, 21, 2
FROM crop_care_plans cp WHERE cp.plan_code = 'MCP-001'
ON CONFLICT DO NOTHING;

-- Casing application (day 10)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'Casing Layer Application', 'Apply casing soil layer when mycelium has fully colonized substrate', 4, 10, 1, 2, 'high', 1.0, 3
FROM crop_care_plans cp WHERE cp.plan_code = 'MCP-001'
ON CONFLICT DO NOTHING;

-- First harvest (day 17-19)
INSERT INTO crop_care_plan_tasks (plan_id, task_name, description, task_category_id, days_from_planting, tolerance_days_before, tolerance_days_after, priority, estimated_hours, task_sequence)
SELECT cp.id, 'First Flush Harvest', 'Harvest first flush of mushrooms when caps are still closed', 2, 18, 1, 1, 'high', 1.5, 4
FROM crop_care_plans cp WHERE cp.plan_code = 'MCP-001'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED DATA COMPLETE
-- ============================================================================
