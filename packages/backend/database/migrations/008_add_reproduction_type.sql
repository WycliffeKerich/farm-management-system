-- Migration 008: Add reproduction type to animal types
-- Description: Differentiate between mammals and birds for breeding vs incubation

-- Add reproduction_type column to animal_types
ALTER TABLE animal_types
ADD COLUMN IF NOT EXISTS reproduction_type VARCHAR(20)
CHECK (reproduction_type IN ('mammal', 'bird', 'other'))
DEFAULT 'mammal';

-- Update existing records based on common patterns
UPDATE animal_types
SET reproduction_type = 'bird'
WHERE LOWER(name) LIKE '%chicken%'
   OR LOWER(name) LIKE '%duck%'
   OR LOWER(name) LIKE '%turkey%'
   OR LOWER(name) LIKE '%goose%'
   OR LOWER(name) LIKE '%quail%'
   OR LOWER(name) LIKE '%bird%'
   OR LOWER(name) LIKE '%poultry%';

UPDATE animal_types
SET reproduction_type = 'mammal'
WHERE LOWER(name) LIKE '%cow%'
   OR LOWER(name) LIKE '%cattle%'
   OR LOWER(name) LIKE '%pig%'
   OR LOWER(name) LIKE '%goat%'
   OR LOWER(name) LIKE '%sheep%'
   OR LOWER(name) LIKE '%rabbit%';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_animal_types_reproduction ON animal_types(reproduction_type);

-- Add comment
COMMENT ON COLUMN animal_types.reproduction_type IS 'Reproduction type: mammal (live birth/breeding), bird (egg-laying/incubation), or other';
