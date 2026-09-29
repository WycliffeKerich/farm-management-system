const BaseRepository = require('./base.repository');
const { toSqlInt } = require('../utils/sql');

/**
 * Repository for animal_deaths table operations
 */
class AnimalDeathRepository extends BaseRepository {
  constructor() {
    super('animal_deaths');
  }

  /**
   * Find all deaths with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT ad.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as reported_by_name
      FROM ${this.tableName} ad
      LEFT JOIN animals a ON ad.animal_id = a.id
      LEFT JOIN animal_groups ag ON ad.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON ad.reported_by = u.id
      WHERE ad.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_id) {
      query += ` AND ad.animal_id = $${paramIndex++}`;
      values.push(filters.animal_id);
    }

    if (filters.animal_group_id) {
      query += ` AND ad.animal_group_id = $${paramIndex++}`;
      values.push(filters.animal_group_id);
    }

    if (filters.cause_category) {
      query += ` AND ad.cause_category = $${paramIndex++}`;
      values.push(filters.cause_category);
    }

    if (filters.start_date) {
      query += ` AND ad.death_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ad.death_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY ad.death_date DESC, ad.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find death record by ID with details
   * @param {number} id - Death record ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT ad.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as reported_by_name
      FROM ${this.tableName} ad
      LEFT JOIN animals a ON ad.animal_id = a.id
      LEFT JOIN animal_groups ag ON ad.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON ad.reported_by = u.id
      WHERE ad.id = $1 AND ad.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find deaths by animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE animal_id = $1 AND deleted_at IS NULL
      ORDER BY death_date DESC
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find deaths by group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT ad.*,
             u.first_name || ' ' || u.last_name as reported_by_name
      FROM ${this.tableName} ad
      LEFT JOIN users u ON ad.reported_by = u.id
      WHERE ad.animal_group_id = $1 AND ad.deleted_at IS NULL
      ORDER BY ad.death_date DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Get death statistics
   * @param {Object} filters - Optional filters (date range, animal type)
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*) as total_records,
        SUM(ad.quantity) as total_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'disease') as disease_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'predator') as predator_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'accident') as accident_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'natural') as natural_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'culled') as culled_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'slaughtered') as slaughtered_deaths,
        COUNT(*) FILTER (WHERE ad.cause_category = 'unknown') as unknown_deaths,
        SUM(ad.estimated_loss) as total_estimated_loss
      FROM ${this.tableName} ad
      LEFT JOIN animals a ON ad.animal_id = a.id
      LEFT JOIN animal_groups ag ON ad.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      WHERE ad.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND ad.death_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ad.death_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND ab.animal_type_id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get deaths by cause category summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getDeathsByCause(filters = {}) {
    let query = `
      SELECT
        ad.cause_category,
        COUNT(*) as record_count,
        SUM(ad.quantity) as total_deaths,
        SUM(ad.estimated_loss) as total_loss
      FROM ${this.tableName} ad
      WHERE ad.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND ad.death_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ad.death_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY cause_category ORDER BY total_deaths DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get mortality rate for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Object>}
   */
  async getGroupMortalityRate(groupId) {
    const query = `
      SELECT
        ag.initial_quantity,
        ag.quantity,
        COALESCE(ag.current_quantity, ag.quantity) as current_quantity,
        COALESCE(SUM(ad.quantity), 0) as total_deaths,
        CASE
          WHEN COALESCE(ag.initial_quantity, ag.quantity) > 0
          THEN ROUND((COALESCE(SUM(ad.quantity), 0)::DECIMAL / COALESCE(ag.initial_quantity, ag.quantity)) * 100, 2)
          ELSE 0
        END as mortality_rate
      FROM animal_groups ag
      LEFT JOIN animal_deaths ad ON ag.id = ad.animal_group_id AND ad.deleted_at IS NULL
      WHERE ag.id = $1 AND ag.deleted_at IS NULL
      GROUP BY ag.id, ag.initial_quantity, ag.quantity, ag.current_quantity
    `;
    return await this.db.oneOrNone(query, [groupId]);
  }

  /**
   * Get recent deaths (alerts)
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getRecentDeaths(days = 7, limit = 10) {
    const query = `
      SELECT ad.*,
             a.tag_number as animal_tag,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} ad
      LEFT JOIN animals a ON ad.animal_id = a.id
      LEFT JOIN animal_groups ag ON ad.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ad.deleted_at IS NULL
        AND ad.death_date >= CURRENT_DATE - make_interval(days => ${toSqlInt(days, { name: 'days' })})
      ORDER BY ad.death_date DESC, ad.created_at DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }
}

module.exports = new AnimalDeathRepository();
