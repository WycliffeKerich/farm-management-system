const BaseRepository = require('./base.repository');

/**
 * Repository for animal_types table operations
 */
class AnimalTypeRepository extends BaseRepository {
  constructor() {
    super('animal_types');
  }

  /**
   * Find all animal types with breed counts
   * @returns {Promise<Array>}
   */
  async findAllWithBreeds() {
    const query = `
      SELECT at.*,
             COUNT(ab.id) as breed_count
      FROM ${this.tableName} at
      LEFT JOIN animal_breeds ab ON at.id = ab.animal_type_id AND ab.deleted_at IS NULL
      WHERE at.deleted_at IS NULL
      GROUP BY at.id
      ORDER BY at.name
    `;
    return await this.db.any(query);
  }

  /**
   * Find animal type by name
   * @param {string} name - Animal type name
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
   * Find animal type with all breeds
   * @param {number} id - Animal type ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithBreeds(id) {
    const typeQuery = `
      SELECT * FROM ${this.tableName}
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const breedsQuery = `
      SELECT * FROM animal_breeds
      WHERE animal_type_id = $1 AND deleted_at IS NULL
      ORDER BY name
    `;

    const [type, breeds] = await Promise.all([this.db.oneOrNone(typeQuery, [id]), this.db.any(breedsQuery, [id])]);

    if (type) {
      type.breeds = breeds;
    }

    return type;
  }

  /**
   * Get distinct categories
   * @returns {Promise<Array>}
   */
  async getCategories() {
    const query = `
      SELECT DISTINCT category
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
      ORDER BY category
    `;
    const result = await this.db.any(query);
    return result.map((r) => r.category);
  }

  /**
   * Find by tracking mode
   * @param {string} trackingMode - 'individual', 'flock', or 'both'
   * @returns {Promise<Array>}
   */
  async findByTrackingMode(trackingMode) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE deleted_at IS NULL
        AND (tracking_mode = $1 OR tracking_mode = 'both')
      ORDER BY name
    `;
    return await this.db.any(query, [trackingMode]);
  }
}

module.exports = new AnimalTypeRepository();
