-- Migration: Add deleted_at columns for soft delete support
-- The base repository uses soft deletes, so tables need deleted_at columns

-- Crop Management tables
ALTER TABLE crop_types ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE crop_varieties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE growing_locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE crop_batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE growth_observations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE harvests ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE crop_input_applications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE crop_pests_diseases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Animal Management tables
ALTER TABLE animal_types ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_breeds ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_housing ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_health_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_diseases_treatments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_feed_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE breeding_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE production_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Inventory tables
ALTER TABLE inventory_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Task tables
ALTER TABLE task_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE task_updates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE task_checklist_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Financial tables
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE transaction_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create indexes for soft delete columns on frequently queried tables
CREATE INDEX IF NOT EXISTS idx_crop_batches_deleted ON crop_batches(deleted_at);
CREATE INDEX IF NOT EXISTS idx_crop_types_deleted ON crop_types(deleted_at);
CREATE INDEX IF NOT EXISTS idx_crop_varieties_deleted ON crop_varieties(deleted_at);
CREATE INDEX IF NOT EXISTS idx_growing_locations_deleted ON growing_locations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_harvests_deleted ON harvests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_animals_deleted ON animals(deleted_at);
CREATE INDEX IF NOT EXISTS idx_animal_groups_deleted ON animal_groups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_inventory_items_deleted ON inventory_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
