const BaseRepository = require('./base.repository');

/**
 * Repository for animal_breeds table operations
 */
class AnimalBreedRepository extends BaseRepository {
  constructor() {
    super('animal_breeds');
  }

  /**
   * Find all breeds with animal type info
   * @returns {Promise<Array>}
   */
  async findAllWithType() {
    const query = `
      SELECT ab.*,
             at.name as animal_type_name,
             at.category as animal_type_category,
             at.tracking_mode
      FROM ${this.tableName} ab
      JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ab.deleted_at IS NULL
      ORDER BY at.name, ab.name
    `;
    return await this.db.any(query);
  }

  /**
   * Find breeds by animal type ID
   * @param {number} animalTypeId - Animal type ID
   * @returns {Promise<Array>}
   */
  async findByAnimalTypeId(animalTypeId) {
    const query = `
      SELECT ab.*,
             at.name as animal_type_name,
             at.tracking_mode
      FROM ${this.tableName} ab
      JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ab.animal_type_id = $1 AND ab.deleted_at IS NULL
      ORDER BY ab.name
    `;
    return await this.db.any(query, [animalTypeId]);
  }

  /**
   * Find breed by name and animal type
   * @param {string} name - Breed name
   * @param {number} animalTypeId - Animal type ID
   * @returns {Promise<Object|null>}
   */
  async findByNameAndType(name, animalTypeId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE LOWER(name) = LOWER($1)
        AND animal_type_id = $2
        AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [name, animalTypeId]);
  }

  /**
   * Find breed by ID with type details
   * @param {number} id - Breed ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT ab.*,
             at.name as animal_type_name,
             at.category as animal_type_category,
             at.tracking_mode,
             at.production_types,
             at.enterprise_id as animal_type_enterprise_id
      FROM ${this.tableName} ab
      JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ab.id = $1 AND ab.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find breeds by reproduction type
   * @param {string} reproductionType - Reproduction type (mammal, bird, other)
   * @returns {Promise<Array>}
   */
  async findByReproductionType(reproductionType) {
    const query = `
      SELECT ab.*,
             at.name as animal_type_name,
             at.category as animal_type_category,
             at.tracking_mode,
             at.reproduction_type
      FROM ${this.tableName} ab
      JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE at.reproduction_type = $1
        AND (at.exclude_from_reproduction IS NULL OR at.exclude_from_reproduction = FALSE)
        AND ab.deleted_at IS NULL
      ORDER BY at.name, ab.name
    `;
    return await this.db.any(query, [reproductionType]);
  }
}

module.exports = new AnimalBreedRepository();
