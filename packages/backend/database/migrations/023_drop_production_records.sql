-- =====================================================
-- 023: One production table (F18)
-- =====================================================
-- production_records (001) was never written by the app; animal_production_records
-- (006) is the production table. Any rows in the old table move across, each
-- with its activity, and the old table is dropped.
--
-- The old table names its product in free text with its own unit. A row takes
-- the live production type of the same name and unit (any case). Otherwise a
-- type is created under the old name, or as "<name> (<unit>)" when that name is
-- already a type with another unit or the old rows use it with several units,
-- so no quantity is read in the wrong unit.
--
-- A row naming both an animal and a group takes the animal, as in 017.
-- =====================================================

CREATE TEMP TABLE production_type_map ON COMMIT DROP AS
SELECT DISTINCT ON (lower(trim(production_type)), lower(trim(unit)))
       trim(production_type) AS old_type,
       trim(unit) AS old_unit,
       NULL::INTEGER AS type_id,
       NULL::VARCHAR(100) AS new_name
  FROM production_records
 ORDER BY lower(trim(production_type)), lower(trim(unit)), id;

UPDATE production_type_map m
   SET type_id = pt.id
  FROM animal_production_types pt
 WHERE pt.deleted_at IS NULL
   AND lower(pt.name) = lower(m.old_type) AND lower(pt.unit) = lower(m.old_unit);

UPDATE production_type_map m
   SET new_name = CASE
           WHEN EXISTS (SELECT 1 FROM animal_production_types pt
                         WHERE pt.deleted_at IS NULL AND lower(pt.name) = lower(m.old_type))
             OR (SELECT count(*) FROM production_type_map o WHERE lower(o.old_type) = lower(m.old_type)) > 1
           THEN m.old_type || ' (' || m.old_unit || ')'
           ELSE m.old_type
       END
 WHERE m.type_id IS NULL;

INSERT INTO animal_production_types (name, category, unit, description)
SELECT new_name,
       CASE
           WHEN old_type ~* 'egg' THEN 'eggs'
           WHEN old_type ~* 'milk' THEN 'milk'
           WHEN old_type ~* 'honey|wax|propolis' THEN 'honey'
           WHEN old_type ~* 'wool|fur|fib(re|er)|cashmere|mohair' THEN 'wool'
           ELSE 'other'
       END,
       old_unit,
       'From the old production records'
  FROM production_type_map
 WHERE type_id IS NULL
ON CONFLICT (lower(name)) WHERE deleted_at IS NULL DO NOTHING;

UPDATE production_type_map m
   SET type_id = pt.id
  FROM animal_production_types pt
 WHERE m.type_id IS NULL AND pt.deleted_at IS NULL
   AND lower(pt.name) = lower(m.new_name) AND lower(pt.unit) = lower(m.old_unit);

-- A name already taken with another unit is left unmapped: stop rather than guess
DO $$
DECLARE
    unmapped TEXT;
BEGIN
    SELECT string_agg(new_name, ', ' ORDER BY new_name) INTO unmapped
      FROM production_type_map WHERE type_id IS NULL;
    IF unmapped IS NOT NULL THEN
        RAISE EXCEPTION 'production_records: no production type to move these to (the name is taken with another unit): %',
            unmapped;
    END IF;
END$$;

-- Each old row with its production type and the id of its new activity
CREATE TEMP TABLE production_moves ON COMMIT DROP AS
SELECT pr.*,
       m.type_id,
       CASE WHEN pr.animal_id IS NULL THEN pr.animal_group_id END AS group_id,
       nextval(pg_get_serial_sequence('activities', 'id'))::INTEGER AS new_activity_id
  FROM production_records pr
  JOIN production_type_map m
    ON lower(m.old_type) = lower(trim(pr.production_type)) AND lower(m.old_unit) = lower(trim(pr.unit));

INSERT INTO activities (id, activity_type, title, occurred_on, enterprise_id, animal_id, animal_group_id,
                        performed_by, recorded_by, notes, created_at, updated_at, deleted_at)
SELECT s.new_activity_id, 'production',
       left(pt.name || ' ' || trim_scale(s.quantity) || ' ' || pt.unit, 255),
       s.production_date,
       COALESCE(a.enterprise_id, g.enterprise_id),
       s.animal_id, s.group_id,
       (SELECT e.id FROM employees e WHERE e.user_id = s.recorded_by ORDER BY e.deleted_at NULLS FIRST, e.id LIMIT 1),
       s.recorded_by, s.notes,
       COALESCE(s.created_at, CURRENT_TIMESTAMP), COALESCE(s.created_at, CURRENT_TIMESTAMP), s.deleted_at
  FROM production_moves s
  JOIN animal_production_types pt ON pt.id = s.type_id
  LEFT JOIN animals a ON a.id = s.animal_id
  LEFT JOIN animal_groups g ON g.id = s.group_id;

INSERT INTO animal_production_records (production_type_id, animal_id, animal_group_id, production_date, quantity,
                                       quality_grade, notes, recorded_by, created_at, updated_at, deleted_at,
                                       activity_id)
SELECT type_id, animal_id, group_id, production_date, quantity,
       quality_grade, notes, recorded_by, created_at, created_at, deleted_at,
       new_activity_id
  FROM production_moves;

DO $$
BEGIN
    IF (SELECT count(*) FROM production_moves) <> (SELECT count(*) FROM production_records) THEN
        RAISE EXCEPTION 'production_records: % rows, but % were moved',
            (SELECT count(*) FROM production_records), (SELECT count(*) FROM production_moves);
    END IF;
END$$;

DROP TABLE production_records;
