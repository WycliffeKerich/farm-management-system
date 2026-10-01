-- =====================================================
-- 019: Enterprises (Phase 5 item 4)
-- =====================================================
-- An enterprise is a line of business costed on its own: Tomatoes GH1,
-- Layers, Dairy, Apiary. Crop batches, animals and animal groups belong to
-- one; a crop type or animal type names the enterprise its new batches,
-- animals and groups default to. Activities copy their subject's enterprise
-- (ADR-001).
-- =====================================================

-- category was free text ('crops', 'animals', 'beekeeping'); enterprise_type
-- is a fixed list. Seeded names decide the finer types.
ALTER TABLE enterprises RENAME COLUMN category TO enterprise_type;

UPDATE enterprises
   SET enterprise_type = CASE
           WHEN name ILIKE '%mushroom%' THEN 'mushrooms'
           WHEN name ILIKE '%egg%' OR name ILIKE '%poultry%' OR name ILIKE '%layer%' OR name ILIKE '%broiler%'
               THEN 'poultry'
           WHEN name ILIKE '%milk%' OR name ILIKE '%dairy%' THEN 'dairy'
           WHEN enterprise_type = 'animals' THEN 'livestock'
           WHEN enterprise_type = 'beekeeping' THEN 'apiculture'
           WHEN enterprise_type IN ('crops', 'mushrooms', 'poultry', 'dairy', 'livestock', 'apiculture', 'aquaculture')
               THEN enterprise_type
           ELSE 'other'
       END,
       is_active = COALESCE(is_active, true);

ALTER TABLE enterprises
    ALTER COLUMN enterprise_type TYPE VARCHAR(20),
    ADD CONSTRAINT enterprises_type_check CHECK (enterprise_type IN (
        'crops', 'mushrooms', 'poultry', 'dairy', 'livestock', 'apiculture', 'aquaculture', 'other'
    )),
    ADD COLUMN unit_of_output VARCHAR(20),
    ALTER COLUMN is_active SET NOT NULL;

UPDATE enterprises
   SET unit_of_output = CASE enterprise_type
           WHEN 'poultry' THEN 'egg'
           WHEN 'dairy' THEN 'litre'
           WHEN 'other' THEN NULL
           ELSE 'kg'
       END;

-- Names are unique ignoring case among live enterprises, as for suppliers
ALTER TABLE enterprises DROP CONSTRAINT enterprises_name_key;
CREATE UNIQUE INDEX idx_enterprises_name_live ON enterprises (LOWER(name)) WHERE deleted_at IS NULL;

-- The enterprise new batches, animals and groups of a type default to
ALTER TABLE crop_types ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT;
ALTER TABLE animal_types ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT;

-- The enterprise a subject belongs to
ALTER TABLE crop_batches ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT;
ALTER TABLE animals ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT;
ALTER TABLE animal_groups ADD COLUMN enterprise_id INTEGER REFERENCES enterprises(id) ON DELETE RESTRICT;

CREATE INDEX idx_crop_batches_enterprise ON crop_batches(enterprise_id);
CREATE INDEX idx_animals_enterprise ON animals(enterprise_id);
CREATE INDEX idx_animal_groups_enterprise ON animal_groups(enterprise_id);
