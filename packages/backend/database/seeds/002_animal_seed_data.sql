-- Animal Management System - Seed Data
-- This file contains seed data for animal management features
-- Run after 001_seed_data.sql

-- ============================================================================
-- 1. UPDATE EXISTING ANIMAL TYPES WITH TRACKING MODE
-- ============================================================================

UPDATE animal_types SET tracking_mode = 'flock', default_lifespan_days = 365 WHERE name = 'Chicken';
UPDATE animal_types SET tracking_mode = 'individual', default_lifespan_days = 3650 WHERE name = 'Goat';
UPDATE animal_types SET tracking_mode = 'individual', default_lifespan_days = 3650 WHERE name = 'Sheep';
UPDATE animal_types SET tracking_mode = 'individual', default_lifespan_days = 7300 WHERE name = 'Cow';
UPDATE animal_types SET tracking_mode = 'flock', default_lifespan_days = 1825 WHERE name = 'Bee';

-- Add more animal types
INSERT INTO animal_types (name, category, production_types, tracking_mode, default_lifespan_days)
VALUES
    ('Duck', 'poultry', '["eggs", "meat"]', 'flock', 365),
    ('Turkey', 'poultry', '["meat"]', 'flock', 180),
    ('Pig', 'livestock', '["meat"]', 'both', 3650),
    ('Rabbit', 'livestock', '["meat", "fur"]', 'both', 2555)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. UPDATE EXISTING ANIMAL BREEDS WITH MORE DETAILS
-- ============================================================================

UPDATE animal_breeds SET
    average_lifespan_years = 3,
    average_weight_kg = 2.5
WHERE name = 'Improved Kienyeji';

UPDATE animal_breeds SET
    average_lifespan_years = 12,
    average_weight_kg = 45
WHERE name = 'Dairy Goat';

UPDATE animal_breeds SET
    average_lifespan_years = 12,
    average_weight_kg = 60
WHERE name = 'Dorper Sheep';

UPDATE animal_breeds SET
    average_lifespan_years = 20,
    average_weight_kg = 500
WHERE name = 'Dairy Cow';

-- Add more breeds
INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Broiler Chicken', 'Fast-growing meat chicken', 0.17, 2.5
FROM animal_types at WHERE at.name = 'Chicken'
ON CONFLICT DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Layer Chicken', 'Egg-laying chicken breed', 3, 2.0
FROM animal_types at WHERE at.name = 'Chicken'
ON CONFLICT DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Boer Goat', 'Meat goat breed', 12, 80
FROM animal_types at WHERE at.name = 'Goat'
ON CONFLICT DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Merino Sheep', 'Wool sheep breed', 12, 70
FROM animal_types at WHERE at.name = 'Sheep'
ON CONFLICT DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Friesian Cow', 'High milk production dairy cattle', 20, 600
FROM animal_types at WHERE at.name = 'Cow'
ON CONFLICT DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Large White Pig', 'Commercial meat pig', 10, 250
FROM animal_types at WHERE at.name = 'Pig'
ON CONFLICT DO NOTHING;

INSERT INTO animal_breeds (animal_type_id, name, description, average_lifespan_years, average_weight_kg)
SELECT at.id, 'Khaki Campbell', 'Egg-laying duck breed', 8, 2.5
FROM animal_types at WHERE at.name = 'Duck'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. UPDATE EXISTING ANIMAL HOUSING WITH HOUSING TYPE
-- ============================================================================

UPDATE animal_housing SET housing_type = 'coop', current_occupancy = 0 WHERE name = 'Chicken Coop 1';
UPDATE animal_housing SET housing_type = 'pen', current_occupancy = 0 WHERE name = 'Goat Shed A';
UPDATE animal_housing SET housing_type = 'pen', current_occupancy = 0 WHERE name = 'Sheep Pen 1';
UPDATE animal_housing SET housing_type = 'barn', current_occupancy = 0 WHERE name = 'Cow Shed';
UPDATE animal_housing SET housing_type = 'other', current_occupancy = 0 WHERE name = 'Apiary 1';

-- Add more housing
INSERT INTO animal_housing (name, animal_type_id, capacity, is_active, housing_type, current_occupancy, notes)
SELECT 'Broiler House 1', at.id, 500, true, 'coop', 0, 'Broiler chicken production house'
FROM animal_types at WHERE at.name = 'Chicken'
ON CONFLICT DO NOTHING;

INSERT INTO animal_housing (name, animal_type_id, capacity, is_active, housing_type, current_occupancy, notes)
SELECT 'Pig Sty 1', at.id, 50, true, 'pen', 0, 'Main pig housing'
FROM animal_types at WHERE at.name = 'Pig'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. SEED SAMPLE INDIVIDUAL ANIMALS
-- ============================================================================

-- Add some cows
INSERT INTO animals (animal_breed_id, tag_number, name, gender, date_of_birth, status, status_date, acquisition_type, date_acquired, housing_id, weight, weight_unit, weight_date, is_breeding_stock, notes)
SELECT
    ab.id,
    'COW-001',
    'Bessie',
    'female',
    '2021-03-15',
    'active',
    CURRENT_DATE,
    'purchased',
    '2022-01-10',
    ah.id,
    450.0,
    'kg',
    CURRENT_DATE - INTERVAL '30 days',
    true,
    'Primary dairy cow, excellent milk producer'
FROM animal_breeds ab
JOIN animal_types at ON ab.animal_type_id = at.id
JOIN animal_housing ah ON ah.name = 'Cow Shed'
WHERE ab.name = 'Friesian Cow' OR ab.name = 'Dairy Cow'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO animals (animal_breed_id, tag_number, name, gender, date_of_birth, status, status_date, acquisition_type, date_acquired, housing_id, weight, weight_unit, weight_date, is_breeding_stock, notes)
SELECT
    ab.id,
    'COW-002',
    'Daisy',
    'female',
    '2022-05-20',
    'active',
    CURRENT_DATE,
    'born',
    '2022-05-20',
    ah.id,
    380.0,
    'kg',
    CURRENT_DATE - INTERVAL '30 days',
    false,
    'Young heifer, future dairy cow'
FROM animal_breeds ab
JOIN animal_types at ON ab.animal_type_id = at.id
JOIN animal_housing ah ON ah.name = 'Cow Shed'
WHERE ab.name = 'Friesian Cow' OR ab.name = 'Dairy Cow'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Add some goats
INSERT INTO animals (animal_breed_id, tag_number, name, gender, date_of_birth, status, status_date, acquisition_type, date_acquired, housing_id, weight, weight_unit, weight_date, is_breeding_stock)
SELECT
    ab.id,
    'GOAT-001',
    'Billy',
    'male',
    '2020-08-10',
    'active',
    CURRENT_DATE,
    'purchased',
    '2021-02-15',
    ah.id,
    55.0,
    'kg',
    CURRENT_DATE - INTERVAL '14 days',
    true
FROM animal_breeds ab
JOIN animal_types at ON ab.animal_type_id = at.id
JOIN animal_housing ah ON ah.name = 'Goat Shed A'
WHERE ab.name = 'Dairy Goat'
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO animals (animal_breed_id, tag_number, name, gender, date_of_birth, status, status_date, acquisition_type, date_acquired, housing_id, weight, weight_unit, weight_date, is_breeding_stock)
SELECT
    ab.id,
    'GOAT-002',
    'Nanny',
    'female',
    '2021-02-22',
    'active',
    CURRENT_DATE,
    'purchased',
    '2021-06-10',
    ah.id,
    42.0,
    'kg',
    CURRENT_DATE - INTERVAL '14 days',
    true
FROM animal_breeds ab
JOIN animal_types at ON ab.animal_type_id = at.id
JOIN animal_housing ah ON ah.name = 'Goat Shed A'
WHERE ab.name = 'Dairy Goat'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. SEED SAMPLE ANIMAL GROUPS (FLOCKS)
-- ============================================================================

-- Layer chicken flock
INSERT INTO animal_groups (animal_breed_id, name, group_code, quantity, initial_quantity, current_quantity, status, housing_id, date_established, acquisition_type, acquisition_date, cost_per_unit, age_at_acquisition_days, notes)
SELECT
    ab.id,
    'Layer Flock A',
    'LF-001',
    150,
    150,
    145,
    'active',
    ah.id,
    CURRENT_DATE - INTERVAL '6 months',
    'purchased',
    CURRENT_DATE - INTERVAL '6 months',
    5.50,
    21,
    'Point-of-lay pullets, now in full production'
FROM animal_breeds ab
JOIN animal_types at ON ab.animal_type_id = at.id
JOIN animal_housing ah ON ah.name = 'Chicken Coop 1'
WHERE ab.name = 'Layer Chicken' OR ab.name = 'Improved Kienyeji'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Broiler batch
INSERT INTO animal_groups (animal_breed_id, name, group_code, quantity, initial_quantity, current_quantity, status, housing_id, date_established, acquisition_type, acquisition_date, cost_per_unit, age_at_acquisition_days, notes)
SELECT
    ab.id,
    'Broiler Batch 2024-01',
    'BB-2401',
    300,
    300,
    295,
    'active',
    ah.id,
    CURRENT_DATE - INTERVAL '3 weeks',
    'purchased',
    CURRENT_DATE - INTERVAL '3 weeks',
    1.25,
    1,
    'Day-old chicks, Cobb 500 strain'
FROM animal_breeds ab
JOIN animal_types at ON ab.animal_type_id = at.id
JOIN animal_housing ah ON ah.name = 'Chicken Coop 1'
WHERE ab.name = 'Broiler Chicken'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. SEED ANIMAL CARE PLANS
-- ============================================================================

-- Broiler Chicken Vaccination Plan
INSERT INTO animal_care_plans (plan_code, animal_type_id, name, description, plan_type, is_template, total_duration_days, applies_to, status, created_by)
SELECT
    'ACP-BROILER-VAX',
    at.id,
    'Broiler Vaccination Schedule',
    'Standard vaccination program for broiler chickens from day 1 to slaughter',
    'vaccination',
    true,
    42,
    'flock',
    'active',
    1
FROM animal_types at WHERE at.name = 'Chicken'
ON CONFLICT (plan_code) DO NOTHING;

-- Broiler vaccination tasks
INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, input_dosage_per_animal, input_application_method, requires_vet)
SELECT
    acp.id,
    1,
    'Marek''s Disease Vaccine',
    'Administer Marek''s disease vaccine at hatchery or day 1',
    'vaccination',
    1,
    0,
    0,
    'urgent',
    'vaccine',
    'Marek''s Disease Vaccine (HVT)',
    '0.2ml per chick',
    'subcutaneous injection',
    false
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-BROILER-VAX'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, input_dosage_per_animal, input_application_method, requires_vet)
SELECT
    acp.id,
    2,
    'Newcastle Disease - First Dose',
    'Administer first dose of Newcastle disease vaccine',
    'vaccination',
    7,
    1,
    2,
    'high',
    'vaccine',
    'Lasota Vaccine',
    '1 drop per chick',
    'eye drop or drinking water',
    false
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-BROILER-VAX'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, input_dosage_per_animal, input_application_method, requires_vet)
SELECT
    acp.id,
    3,
    'Gumboro Disease Vaccine',
    'Administer Infectious Bursal Disease (Gumboro) vaccine',
    'vaccination',
    14,
    1,
    2,
    'high',
    'vaccine',
    'Gumboro Vaccine (IBD)',
    '1 drop per bird',
    'drinking water',
    false
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-BROILER-VAX'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, input_dosage_per_animal, input_application_method, requires_vet)
SELECT
    acp.id,
    4,
    'Newcastle Disease - Booster',
    'Administer booster dose of Newcastle disease vaccine',
    'vaccination',
    21,
    1,
    2,
    'high',
    'vaccine',
    'Lasota Vaccine',
    '1 drop per bird',
    'drinking water',
    false
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-BROILER-VAX'
ON CONFLICT DO NOTHING;

-- Layer Chicken Health Plan
INSERT INTO animal_care_plans (plan_code, animal_type_id, name, description, plan_type, is_template, total_duration_days, applies_to, status, created_by)
SELECT
    'ACP-LAYER-HEALTH',
    at.id,
    'Layer Chicken Health Program',
    'Comprehensive health management plan for layer chickens including vaccinations and deworming',
    'health_checkup',
    true,
    365,
    'flock',
    'active',
    1
FROM animal_types at WHERE at.name = 'Chicken'
ON CONFLICT (plan_code) DO NOTHING;

-- Layer health tasks
INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, input_dosage_per_animal, input_application_method, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    1,
    'Deworming Treatment',
    'Administer broad-spectrum dewormer to the flock',
    'deworming',
    30,
    3,
    7,
    'medium',
    'medication',
    'Piperazine or Levamisole',
    'As per product label',
    'drinking water',
    true,
    90
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-LAYER-HEALTH'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    2,
    'Flock Health Observation',
    'Observe flock for signs of disease, monitor feed and water consumption',
    'observation',
    7,
    0,
    1,
    'medium',
    true,
    7
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-LAYER-HEALTH'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, is_recurring, recurrence_interval_days, estimated_hours)
SELECT
    acp.id,
    3,
    'Weighing Sample',
    'Weigh sample of birds to monitor growth and feed efficiency',
    'weighing',
    14,
    2,
    3,
    'low',
    true,
    14,
    0.5
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-LAYER-HEALTH'
ON CONFLICT DO NOTHING;

-- Dairy Cow Care Plan
INSERT INTO animal_care_plans (plan_code, animal_type_id, name, description, plan_type, is_template, total_duration_days, applies_to, status, created_by)
SELECT
    'ACP-DAIRY-COW',
    at.id,
    'Dairy Cow Annual Health Plan',
    'Annual health management program for dairy cattle including vaccinations, deworming, and hoof care',
    'health_checkup',
    true,
    365,
    'individual',
    'active',
    1
FROM animal_types at WHERE at.name = 'Cow'
ON CONFLICT (plan_code) DO NOTHING;

-- Dairy cow tasks
INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, requires_vet, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    1,
    'FMD Vaccination',
    'Foot and Mouth Disease vaccination',
    'vaccination',
    1,
    7,
    7,
    'high',
    'vaccine',
    'FMD Vaccine',
    true,
    true,
    180
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-DAIRY-COW'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, requires_vet, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    2,
    'Deworming',
    'Administer broad-spectrum anthelmintic',
    'deworming',
    30,
    7,
    7,
    'medium',
    'medication',
    'Ivermectin or Albendazole',
    false,
    true,
    90
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-DAIRY-COW'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, requires_vet, is_recurring, recurrence_interval_days, estimated_hours)
SELECT
    acp.id,
    3,
    'Hoof Trimming',
    'Trim hooves to prevent lameness',
    'health_check',
    60,
    14,
    14,
    'medium',
    false,
    true,
    120,
    1.0
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-DAIRY-COW'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, requires_vet)
SELECT
    acp.id,
    4,
    'Pregnancy Check',
    'Check for pregnancy status (for breeding cows)',
    'pregnancy_check',
    90,
    7,
    14,
    'high',
    true
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-DAIRY-COW'
ON CONFLICT DO NOTHING;

-- Goat Health Plan
INSERT INTO animal_care_plans (plan_code, animal_type_id, name, description, plan_type, is_template, total_duration_days, applies_to, status, created_by)
SELECT
    'ACP-GOAT-HEALTH',
    at.id,
    'Goat Annual Health Program',
    'Annual health management for dairy and meat goats',
    'health_checkup',
    true,
    365,
    'both',
    'active',
    1
FROM animal_types at WHERE at.name = 'Goat'
ON CONFLICT (plan_code) DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    1,
    'PPR Vaccination',
    'Peste des Petits Ruminants vaccination',
    'vaccination',
    1,
    7,
    7,
    'high',
    'vaccine',
    'PPR Vaccine',
    false,
    0
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-GOAT-HEALTH'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, input_type, input_product_name, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    2,
    'Deworming',
    'Administer goat-safe dewormer',
    'deworming',
    30,
    7,
    7,
    'medium',
    'medication',
    'Fenbendazole or Ivermectin',
    true,
    60
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-GOAT-HEALTH'
ON CONFLICT DO NOTHING;

INSERT INTO animal_care_plan_tasks (plan_id, task_sequence, task_name, description, task_type, days_from_start, tolerance_days_before, tolerance_days_after, priority, is_recurring, recurrence_interval_days)
SELECT
    acp.id,
    3,
    'Hoof Trimming',
    'Trim hooves to prevent foot rot',
    'health_check',
    45,
    7,
    14,
    'medium',
    true,
    90
FROM animal_care_plans acp WHERE acp.plan_code = 'ACP-GOAT-HEALTH'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. UPDATE HOUSING OCCUPANCY
-- ============================================================================

UPDATE animal_housing ah
SET current_occupancy = (
    SELECT COALESCE(SUM(ag.current_quantity), 0) + (
        SELECT COUNT(*) FROM animals a WHERE a.housing_id = ah.id AND a.status = 'active' AND a.deleted_at IS NULL
    )
    FROM animal_groups ag
    WHERE ag.housing_id = ah.id AND ag.status = 'active' AND ag.deleted_at IS NULL
);

-- ============================================================================
-- 8. ENTERPRISES OF BATCHES, ANIMALS AND GROUPS
-- ============================================================================
-- Batches, animals and groups with no enterprise take their type's, and
-- their activities with none take the subject's, as the services do

UPDATE crop_batches cb SET enterprise_id = ct.enterprise_id
  FROM crop_varieties cv JOIN crop_types ct ON ct.id = cv.crop_type_id
 WHERE cv.id = cb.crop_variety_id AND cb.enterprise_id IS NULL AND ct.enterprise_id IS NOT NULL;

UPDATE animals a SET enterprise_id = at.enterprise_id
  FROM animal_breeds ab JOIN animal_types at ON at.id = ab.animal_type_id
 WHERE ab.id = a.animal_breed_id AND a.enterprise_id IS NULL AND at.enterprise_id IS NOT NULL;

UPDATE animal_groups ag SET enterprise_id = at.enterprise_id
  FROM animal_breeds ab JOIN animal_types at ON at.id = ab.animal_type_id
 WHERE ab.id = ag.animal_breed_id AND ag.enterprise_id IS NULL AND at.enterprise_id IS NOT NULL;

UPDATE activities act
   SET enterprise_id = COALESCE(
           (SELECT enterprise_id FROM crop_batches WHERE id = act.crop_batch_id),
           (SELECT enterprise_id FROM animals WHERE id = act.animal_id),
           (SELECT enterprise_id FROM animal_groups WHERE id = act.animal_group_id))
 WHERE act.enterprise_id IS NULL;

-- ============================================================================
-- ANIMAL SEED DATA COMPLETE
-- ============================================================================
