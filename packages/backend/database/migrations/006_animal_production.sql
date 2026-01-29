-- Animal Production Recording
-- Track production from animals (eggs, milk, honey, wool, etc.)

-- Production types table
CREATE TABLE IF NOT EXISTS animal_production_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'eggs', 'milk', 'honey', 'wool', 'meat', 'offspring', 'other'
    unit VARCHAR(50) NOT NULL, -- 'count', 'liters', 'kg', 'grams'
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production records table
CREATE TABLE IF NOT EXISTS animal_production_records (
    id SERIAL PRIMARY KEY,
    production_type_id INTEGER NOT NULL REFERENCES animal_production_types(id),
    animal_id INTEGER REFERENCES animals(id) ON DELETE SET NULL,
    animal_group_id INTEGER REFERENCES animal_groups(id) ON DELETE SET NULL,
    production_date DATE NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    quality_grade VARCHAR(50), -- 'A', 'B', 'C', 'premium', 'standard', etc.
    unit_price DECIMAL(10, 2),
    total_value DECIMAL(12, 2),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_production_source CHECK (
        (animal_id IS NOT NULL AND animal_group_id IS NULL) OR
        (animal_id IS NULL AND animal_group_id IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_production_records_type ON animal_production_records(production_type_id);
CREATE INDEX IF NOT EXISTS idx_production_records_animal ON animal_production_records(animal_id);
CREATE INDEX IF NOT EXISTS idx_production_records_group ON animal_production_records(animal_group_id);
CREATE INDEX IF NOT EXISTS idx_production_records_date ON animal_production_records(production_date);

-- Insert default production types
INSERT INTO animal_production_types (name, category, unit, description) VALUES
('Chicken Eggs', 'eggs', 'count', 'Eggs from layer chickens'),
('Duck Eggs', 'eggs', 'count', 'Eggs from ducks'),
('Quail Eggs', 'eggs', 'count', 'Eggs from quails'),
('Turkey Eggs', 'eggs', 'count', 'Eggs from turkeys'),
('Goose Eggs', 'eggs', 'count', 'Eggs from geese'),
('Cow Milk', 'milk', 'liters', 'Milk from dairy cows'),
('Goat Milk', 'milk', 'liters', 'Milk from dairy goats'),
('Sheep Milk', 'milk', 'liters', 'Milk from dairy sheep'),
('Camel Milk', 'milk', 'liters', 'Milk from camels'),
('Honey', 'honey', 'kg', 'Honey from bee hives'),
('Beeswax', 'honey', 'kg', 'Beeswax from bee hives'),
('Propolis', 'honey', 'grams', 'Propolis from bee hives'),
('Wool', 'wool', 'kg', 'Wool from sheep'),
('Cashmere', 'wool', 'kg', 'Cashmere from goats'),
('Mohair', 'wool', 'kg', 'Mohair from angora goats'),
('Rabbit Fur', 'wool', 'kg', 'Fur from rabbits'),
('Manure', 'other', 'kg', 'Animal manure for fertilizer')
ON CONFLICT (name) DO NOTHING;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_animal_production_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_animal_production_types_timestamp ON animal_production_types;
CREATE TRIGGER update_animal_production_types_timestamp
    BEFORE UPDATE ON animal_production_types
    FOR EACH ROW EXECUTE FUNCTION update_animal_production_timestamp();

DROP TRIGGER IF EXISTS update_animal_production_records_timestamp ON animal_production_records;
CREATE TRIGGER update_animal_production_records_timestamp
    BEFORE UPDATE ON animal_production_records
    FOR EACH ROW EXECUTE FUNCTION update_animal_production_timestamp();

-- Trigger to calculate total_value
CREATE OR REPLACE FUNCTION calculate_production_total_value()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unit_price IS NOT NULL THEN
        NEW.total_value = NEW.quantity * NEW.unit_price;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_production_value ON animal_production_records;
CREATE TRIGGER calculate_production_value
    BEFORE INSERT OR UPDATE ON animal_production_records
    FOR EACH ROW EXECUTE FUNCTION calculate_production_total_value();
