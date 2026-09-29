-- Migration 013: protect history from hard deletes
--
-- Records that describe what happened (harvests, observations, treatments,
-- feedings, deaths, stock movements, attendance, salaries, task updates, ...)
-- must outlive their parent. The app soft-deletes parents; these FKs make any
-- hard delete of a parent that still has history fail (409 IN_USE) instead of
-- silently cascading the history away.
--
-- CASCADE is kept only for true composition children that have no meaning
-- without their parent: care plan tasks, task checklist items and
-- assignments, care schedules and their scheduled tasks, sessions and reset
-- tokens.

-- ---------------------------------------------------------------------------
-- History FKs: CASCADE / SET NULL -> RESTRICT
-- ---------------------------------------------------------------------------

ALTER TABLE animal_breeds
  DROP CONSTRAINT animal_breeds_animal_type_id_fkey,
  ADD CONSTRAINT animal_breeds_animal_type_id_fkey FOREIGN KEY (animal_type_id) REFERENCES animal_types(id) ON DELETE RESTRICT;
ALTER TABLE animal_deaths
  DROP CONSTRAINT animal_deaths_animal_group_id_fkey,
  ADD CONSTRAINT animal_deaths_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE animal_deaths
  DROP CONSTRAINT animal_deaths_animal_id_fkey,
  ADD CONSTRAINT animal_deaths_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT;
ALTER TABLE animal_diseases_treatments
  DROP CONSTRAINT animal_diseases_treatments_animal_group_id_fkey,
  ADD CONSTRAINT animal_diseases_treatments_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE animal_diseases_treatments
  DROP CONSTRAINT animal_diseases_treatments_animal_id_fkey,
  ADD CONSTRAINT animal_diseases_treatments_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT;
ALTER TABLE animal_feed_records
  DROP CONSTRAINT animal_feed_records_animal_group_id_fkey,
  ADD CONSTRAINT animal_feed_records_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE animal_feed_records
  DROP CONSTRAINT animal_feed_records_animal_id_fkey,
  ADD CONSTRAINT animal_feed_records_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT;
ALTER TABLE animal_group_adjustments
  DROP CONSTRAINT animal_group_adjustments_animal_group_id_fkey,
  ADD CONSTRAINT animal_group_adjustments_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE animal_health_records
  DROP CONSTRAINT animal_health_records_animal_group_id_fkey,
  ADD CONSTRAINT animal_health_records_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE animal_health_records
  DROP CONSTRAINT animal_health_records_animal_id_fkey,
  ADD CONSTRAINT animal_health_records_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT;
ALTER TABLE animal_production_records
  DROP CONSTRAINT animal_production_records_animal_group_id_fkey,
  ADD CONSTRAINT animal_production_records_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE animal_production_records
  DROP CONSTRAINT animal_production_records_animal_id_fkey,
  ADD CONSTRAINT animal_production_records_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT;
ALTER TABLE crop_input_applications
  DROP CONSTRAINT crop_input_applications_batch_id_fkey,
  ADD CONSTRAINT crop_input_applications_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES crop_batches(id) ON DELETE RESTRICT;
ALTER TABLE crop_pests_diseases
  DROP CONSTRAINT crop_pests_diseases_batch_id_fkey,
  ADD CONSTRAINT crop_pests_diseases_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES crop_batches(id) ON DELETE RESTRICT;
ALTER TABLE crop_varieties
  DROP CONSTRAINT crop_varieties_crop_type_id_fkey,
  ADD CONSTRAINT crop_varieties_crop_type_id_fkey FOREIGN KEY (crop_type_id) REFERENCES crop_types(id) ON DELETE RESTRICT;
ALTER TABLE employee_attendance
  DROP CONSTRAINT employee_attendance_employee_id_fkey,
  ADD CONSTRAINT employee_attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE employee_leaves
  DROP CONSTRAINT employee_leaves_employee_id_fkey,
  ADD CONSTRAINT employee_leaves_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE employee_salaries
  DROP CONSTRAINT employee_salaries_employee_id_fkey,
  ADD CONSTRAINT employee_salaries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE growth_observations
  DROP CONSTRAINT growth_observations_batch_id_fkey,
  ADD CONSTRAINT growth_observations_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES crop_batches(id) ON DELETE RESTRICT;
ALTER TABLE harvests
  DROP CONSTRAINT harvests_batch_id_fkey,
  ADD CONSTRAINT harvests_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES crop_batches(id) ON DELETE RESTRICT;
ALTER TABLE inventory_transactions
  DROP CONSTRAINT inventory_transactions_item_id_fkey,
  ADD CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT;
ALTER TABLE production_records
  DROP CONSTRAINT production_records_animal_group_id_fkey,
  ADD CONSTRAINT production_records_animal_group_id_fkey FOREIGN KEY (animal_group_id) REFERENCES animal_groups(id) ON DELETE RESTRICT;
ALTER TABLE production_records
  DROP CONSTRAINT production_records_animal_id_fkey,
  ADD CONSTRAINT production_records_animal_id_fkey FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE RESTRICT;
ALTER TABLE task_assignments
  DROP CONSTRAINT task_assignments_employee_id_fkey,
  ADD CONSTRAINT task_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE task_updates
  DROP CONSTRAINT task_updates_task_id_fkey,
  ADD CONSTRAINT task_updates_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Soft delete where it was missing
-- (animal_group_adjustments is an append-only ledger and stays hard-only)
-- ---------------------------------------------------------------------------

ALTER TABLE animal_production_types ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE animal_production_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE employee_attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE employee_leaves ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE employee_salaries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- ---------------------------------------------------------------------------
-- Reference names are unique among live rows only (case-insensitive), so a
-- deleted crop or animal type can be recreated
-- ---------------------------------------------------------------------------

ALTER TABLE crop_types DROP CONSTRAINT crop_types_name_key;
CREATE UNIQUE INDEX idx_crop_types_name_live ON crop_types (LOWER(name)) WHERE deleted_at IS NULL;

ALTER TABLE animal_types DROP CONSTRAINT animal_types_name_key;
CREATE UNIQUE INDEX idx_animal_types_name_live ON animal_types (LOWER(name)) WHERE deleted_at IS NULL;

ALTER TABLE animal_production_types DROP CONSTRAINT animal_production_types_name_key;
CREATE UNIQUE INDEX idx_animal_production_types_name_live
  ON animal_production_types (LOWER(name)) WHERE deleted_at IS NULL;
