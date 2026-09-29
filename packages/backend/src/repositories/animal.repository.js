const BaseRepository = require('./base.repository');

/**
 * Repository for animals table operations (individual animal tracking)
 */
class AnimalRepository extends BaseRepository {
  constructor() {
    super('animals');
  }

  /**
   * Generate unique tag number
   * @param {string} prefix - Tag prefix (e.g., 'CAT' for cattle)
   * @returns {Promise<string>}
   */
  async generateTagNumber(prefix = 'ANM') {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const tagPrefix = `${prefix.toUpperCase().slice(0, 3)}-${year}`;

    const query = `
      SELECT tag_number FROM ${this.tableName}
      WHERE tag_number LIKE $1
      ORDER BY tag_number DESC
      LIMIT 1
    `;

    const result = await this.db.oneOrNone(query, [`${tagPrefix}%`]);

    if (result) {
      const lastNumber = parseInt(result.tag_number.split('-').pop(), 10);
      return `${tagPrefix}-${(lastNumber + 1).toString().padStart(4, '0')}`;
    }

    return `${tagPrefix}-0001`;
  }

  /**
   * Find all animals with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT a.*,
             ab.name as breed_name,
             at.id as animal_type_id,
             at.name as animal_type_name,
             at.category as animal_type_category,
             ah.name as housing_name,
             u.first_name || ' ' || u.last_name as created_by_name,
             pm.tag_number as parent_male_tag,
             pf.tag_number as parent_female_tag
      FROM ${this.tableName} a
      LEFT JOIN animal_breeds ab ON a.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN animal_housing ah ON a.housing_id = ah.id
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN animals pm ON a.parent_male_id = pm.id
      LEFT JOIN animals pf ON a.parent_female_id = pf.id
      WHERE a.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND a.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.breed_id) {
      query += ` AND a.animal_breed_id = $${paramIndex++}`;
      values.push(filters.breed_id);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.housing_id) {
      query += ` AND a.housing_id = $${paramIndex++}`;
      values.push(filters.housing_id);
    }

    if (filters.gender) {
      query += ` AND a.gender = $${paramIndex++}`;
      values.push(filters.gender);
    }

    if (filters.is_breeding_stock !== undefined) {
      query += ` AND a.is_breeding_stock = $${paramIndex++}`;
      values.push(filters.is_breeding_stock);
    }

    query += ' ORDER BY a.tag_number';

    return await this.db.any(query, values);
  }

  /**
   * Find animal by ID with full details
   * @param {number} id - Animal ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT a.*,
             ab.name as breed_name,
             ab.description as breed_description,
             at.id as animal_type_id,
             at.name as animal_type_name,
             at.category as animal_type_category,
             at.tracking_mode,
             ah.name as housing_name,
             ah.capacity as housing_capacity,
             u.first_name || ' ' || u.last_name as created_by_name,
             pm.tag_number as parent_male_tag,
             pm.name as parent_male_name,
             pf.tag_number as parent_female_tag,
             pf.name as parent_female_name
      FROM ${this.tableName} a
      LEFT JOIN animal_breeds ab ON a.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN animal_housing ah ON a.housing_id = ah.id
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN animals pm ON a.parent_male_id = pm.id
      LEFT JOIN animals pf ON a.parent_female_id = pf.id
      WHERE a.id = $1 AND a.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find animal by tag number
   * @param {string} tagNumber - Tag number
   * @returns {Promise<Object|null>}
   */
  async findByTagNumber(tagNumber) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE tag_number = $1 AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [tagNumber]);
  }

  /**
   * Find active animals by housing
   * @param {number} housingId - Housing ID
   * @returns {Promise<Array>}
   */
  async findActiveByHousing(housingId) {
    const query = `
      SELECT a.*,
             ab.name as breed_name
      FROM ${this.tableName} a
      LEFT JOIN animal_breeds ab ON a.animal_breed_id = ab.id
      WHERE a.housing_id = $1 AND a.status = 'active' AND a.deleted_at IS NULL
      ORDER BY a.tag_number
    `;
    return await this.db.any(query, [housingId]);
  }

  /**
   * Update animal status
   * @param {number} id - Animal ID
   * @param {string} status - New status
   * @param {Date} statusDate - Status change date
   * @param {Object} [t] - pg-promise task or transaction
   * @returns {Promise<Object>}
   */
  async updateStatus(id, status, statusDate = new Date(), t) {
    const query = `
      UPDATE ${this.tableName}
      SET status = $2, status_date = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.conn(t).one(query, [id, status, statusDate]);
  }

  /**
   * Get breeding stock
   * @param {string} gender - Optional gender filter
   * @param {number} breedId - Optional breed filter
   * @returns {Promise<Array>}
   */
  async findBreedingStock(gender = null, breedId = null) {
    let query = `
      SELECT a.*,
             ab.name as breed_name,
             at.name as animal_type_name
      FROM ${this.tableName} a
      LEFT JOIN animal_breeds ab ON a.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE a.is_breeding_stock = true
        AND a.status = 'active'
        AND a.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (gender) {
      query += ` AND a.gender = $${paramIndex++}`;
      values.push(gender);
    }

    if (breedId) {
      query += ` AND a.animal_breed_id = $${paramIndex++}`;
      values.push(breedId);
    }

    query += ' ORDER BY a.tag_number';

    return await this.db.any(query, values);
  }

  /**
   * Get offspring of an animal
   * @param {number} parentId - Parent animal ID
   * @returns {Promise<Array>}
   */
  async findOffspring(parentId) {
    const query = `
      SELECT a.*,
             ab.name as breed_name
      FROM ${this.tableName} a
      LEFT JOIN animal_breeds ab ON a.animal_breed_id = ab.id
      WHERE (a.parent_male_id = $1 OR a.parent_female_id = $1)
        AND a.deleted_at IS NULL
      ORDER BY a.date_of_birth DESC
    `;
    return await this.db.any(query, [parentId]);
  }

  /**
   * Get statistics by status
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'sold') as sold_count,
        COUNT(*) FILTER (WHERE status = 'deceased') as deceased_count,
        COUNT(*) FILTER (WHERE status = 'culled') as culled_count,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE is_breeding_stock = true AND status = 'active') as breeding_stock_count
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    return await this.db.one(query);
  }

  /**
   * Paginate animals with details
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async paginateWithDetails(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM ${this.tableName} a
      LEFT JOIN animal_breeds ab ON a.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN animal_housing ah ON a.housing_id = ah.id
      WHERE a.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      baseQuery += ` AND a.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.breed_id) {
      baseQuery += ` AND a.animal_breed_id = $${paramIndex++}`;
      values.push(filters.breed_id);
    }

    if (filters.animal_type_id) {
      baseQuery += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.housing_id) {
      baseQuery += ` AND a.housing_id = $${paramIndex++}`;
      values.push(filters.housing_id);
    }

    if (filters.search) {
      baseQuery += ` AND (a.tag_number ILIKE $${paramIndex} OR a.name ILIKE $${paramIndex})`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;

    const dataQuery = `
      SELECT a.*,
             ab.name as breed_name,
             at.id as animal_type_id,
             at.name as animal_type_name,
             ah.name as housing_name
      ${baseQuery}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    values.push(limit, offset);

    const [countResult, data] = await Promise.all([
      this.db.one(countQuery, values.slice(0, -2)),
      this.db.any(dataQuery, values),
    ]);

    const total = parseInt(countResult.count, 10);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Record a sale (updates status to sold)
   * @param {number} id - Animal ID
   * @param {Date} saleDate - Date of sale
   * @returns {Promise<Object>}
   */
  async recordSale(id, saleDate = new Date()) {
    return await this.updateStatus(id, 'sold', saleDate);
  }

  /**
   * Record acquisition (create new animal)
   * @param {Object} data - Animal data with acquisition details
   * @returns {Promise<Object>}
   */
  async recordAcquisition(data) {
    const animalData = {
      ...data,
      status: 'active',
      acquisition_type: data.acquisition_type || 'purchased',
    };
    return await this.create(animalData);
  }
}

module.exports = new AnimalRepository();
