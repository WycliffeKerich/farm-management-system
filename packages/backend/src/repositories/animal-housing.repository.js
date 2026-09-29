const BaseRepository = require('./base.repository');

/**
 * Repository for animal_housing table operations
 */
class AnimalHousingRepository extends BaseRepository {
  constructor() {
    super('animal_housing');
  }

  /**
   * Find all housing with animal type and occupancy info
   * @returns {Promise<Array>}
   */
  async findAllWithDetails() {
    const query = `
      SELECT ah.*,
             at.name as animal_type_name,
             at.tracking_mode,
             COALESCE(individual_count.count, 0) as individual_animal_count,
             COALESCE(group_count.total, 0) as group_animal_count,
             COALESCE(individual_count.count, 0) + COALESCE(group_count.total, 0) as total_occupancy
      FROM ${this.tableName} ah
      LEFT JOIN animal_types at ON ah.animal_type_id = at.id
      LEFT JOIN (
        SELECT housing_id, COUNT(*) as count
        FROM animals
        WHERE status = 'active' AND deleted_at IS NULL
        GROUP BY housing_id
      ) individual_count ON ah.id = individual_count.housing_id
      LEFT JOIN (
        SELECT housing_id, SUM(COALESCE(current_quantity, quantity)) as total
        FROM animal_groups
        WHERE status = 'active' AND deleted_at IS NULL
        GROUP BY housing_id
      ) group_count ON ah.id = group_count.housing_id
      WHERE ah.deleted_at IS NULL
      ORDER BY ah.name
    `;
    return await this.db.any(query);
  }

  /**
   * Find active housing units
   * @returns {Promise<Array>}
   */
  async findAllActive() {
    const query = `
      SELECT ah.*,
             at.name as animal_type_name
      FROM ${this.tableName} ah
      LEFT JOIN animal_types at ON ah.animal_type_id = at.id
      WHERE ah.is_active = true AND ah.deleted_at IS NULL
      ORDER BY ah.name
    `;
    return await this.db.any(query);
  }

  /**
   * Find housing by name
   * @param {string} name - Housing name
   * @returns {Promise<Object|null>}
   */
  async findByName(name) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [name]);
  }

  /**
   * Find housing by animal type
   * @param {number} animalTypeId - Animal type ID
   * @returns {Promise<Array>}
   */
  async findByAnimalType(animalTypeId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE animal_type_id = $1 AND is_active = true AND deleted_at IS NULL
      ORDER BY name
    `;
    return await this.db.any(query, [animalTypeId]);
  }

  /**
   * Get housing availability (capacity vs occupancy)
   * @param {number} id - Housing ID
   * @returns {Promise<Object|null>}
   */
  async getAvailability(id) {
    const query = `
      SELECT ah.*,
             COALESCE(individual_count.count, 0) as individual_count,
             COALESCE(group_count.total, 0) as group_count,
             COALESCE(individual_count.count, 0) + COALESCE(group_count.total, 0) as total_occupancy,
             ah.capacity - (COALESCE(individual_count.count, 0) + COALESCE(group_count.total, 0)) as available_capacity
      FROM ${this.tableName} ah
      LEFT JOIN (
        SELECT housing_id, COUNT(*) as count
        FROM animals
        WHERE status = 'active' AND deleted_at IS NULL
        GROUP BY housing_id
      ) individual_count ON ah.id = individual_count.housing_id
      LEFT JOIN (
        SELECT housing_id, SUM(COALESCE(current_quantity, quantity)) as total
        FROM animal_groups
        WHERE status = 'active' AND deleted_at IS NULL
        GROUP BY housing_id
      ) group_count ON ah.id = group_count.housing_id
      WHERE ah.id = $1 AND ah.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Get housing types
   * @returns {Promise<Array>}
   */
  async getTypes() {
    const query = `
      SELECT DISTINCT housing_type
      FROM ${this.tableName}
      WHERE housing_type IS NOT NULL AND deleted_at IS NULL
      ORDER BY housing_type
    `;
    const result = await this.db.any(query);
    return result.map((r) => r.housing_type);
  }
}

module.exports = new AnimalHousingRepository();
