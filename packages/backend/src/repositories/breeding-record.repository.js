const BaseRepository = require('./base.repository');
const { toSqlInt } = require('../utils/sql');

/**
 * Repository for breeding_records table operations
 */
class BreedingRecordRepository extends BaseRepository {
  constructor() {
    super('breeding_records');
  }

  /**
   * Find all breeding records with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT br.*,
             male.tag_number as male_tag,
             male.name as male_name,
             female.tag_number as female_tag,
             female.name as female_name,
             male_breed.name as male_breed_name,
             female_breed.name as female_breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      LEFT JOIN animal_breeds female_breed ON female.animal_breed_id = female_breed.id
      LEFT JOIN animal_types at ON male_breed.animal_type_id = at.id
      LEFT JOIN users u ON br.recorded_by = u.id
      WHERE br.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.male_animal_id) {
      query += ` AND br.male_animal_id = $${paramIndex++}`;
      values.push(filters.male_animal_id);
    }

    if (filters.female_animal_id) {
      query += ` AND br.female_animal_id = $${paramIndex++}`;
      values.push(filters.female_animal_id);
    }

    if (filters.animal_id) {
      query += ` AND (br.male_animal_id = $${paramIndex} OR br.female_animal_id = $${paramIndex})`;
      paramIndex++;
      values.push(filters.animal_id);
    }

    if (filters.start_date) {
      query += ` AND br.breeding_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND br.breeding_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.has_delivered !== undefined) {
      if (filters.has_delivered) {
        query += ` AND br.actual_delivery_date IS NOT NULL`;
      } else {
        query += ` AND br.actual_delivery_date IS NULL`;
      }
    }

    if (filters.expected_soon) {
      // Get breeding records with expected delivery in next 30 days
      query += ` AND br.expected_delivery_date IS NOT NULL
                 AND br.expected_delivery_date >= CURRENT_DATE
                 AND br.expected_delivery_date <= CURRENT_DATE + INTERVAL '30 days'
                 AND br.actual_delivery_date IS NULL`;
    }

    query += ' ORDER BY br.breeding_date DESC, br.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find breeding record by ID with details
   * @param {number} id - Breeding record ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT br.*,
             male.tag_number as male_tag,
             male.name as male_name,
             male.date_of_birth as male_dob,
             female.tag_number as female_tag,
             female.name as female_name,
             female.date_of_birth as female_dob,
             male_breed.name as male_breed_name,
             female_breed.name as female_breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      LEFT JOIN animal_breeds female_breed ON female.animal_breed_id = female_breed.id
      LEFT JOIN animal_types at ON male_breed.animal_type_id = at.id
      LEFT JOIN users u ON br.recorded_by = u.id
      WHERE br.id = $1 AND br.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find breeding records by animal (as either male or female)
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT br.*,
             male.tag_number as male_tag,
             male.name as male_name,
             female.tag_number as female_tag,
             female.name as female_name,
             male_breed.name as male_breed_name,
             female_breed.name as female_breed_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      LEFT JOIN animal_breeds female_breed ON female.animal_breed_id = female_breed.id
      LEFT JOIN users u ON br.recorded_by = u.id
      WHERE (br.male_animal_id = $1 OR br.female_animal_id = $1)
        AND br.deleted_at IS NULL
      ORDER BY br.breeding_date DESC, br.created_at DESC
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find breeding records as male
   * @param {number} maleId - Male animal ID
   * @returns {Promise<Array>}
   */
  async findByMaleId(maleId) {
    const query = `
      SELECT br.*,
             female.tag_number as female_tag,
             female.name as female_name,
             female_breed.name as female_breed_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} br
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds female_breed ON female.animal_breed_id = female_breed.id
      LEFT JOIN users u ON br.recorded_by = u.id
      WHERE br.male_animal_id = $1 AND br.deleted_at IS NULL
      ORDER BY br.breeding_date DESC
    `;
    return await this.db.any(query, [maleId]);
  }

  /**
   * Find breeding records as female
   * @param {number} femaleId - Female animal ID
   * @returns {Promise<Array>}
   */
  async findByFemaleId(femaleId) {
    const query = `
      SELECT br.*,
             male.tag_number as male_tag,
             male.name as male_name,
             male_breed.name as male_breed_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      LEFT JOIN users u ON br.recorded_by = u.id
      WHERE br.female_animal_id = $1 AND br.deleted_at IS NULL
      ORDER BY br.breeding_date DESC
    `;
    return await this.db.any(query, [femaleId]);
  }

  /**
   * Get breeding statistics
   * @param {Object} filters - Optional filters (date range, animal type)
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*) as total_breeding_records,
        COUNT(*) FILTER (WHERE actual_delivery_date IS NOT NULL) as delivered_count,
        COUNT(*) FILTER (WHERE actual_delivery_date IS NULL AND expected_delivery_date >= CURRENT_DATE) as pending_count,
        COUNT(*) FILTER (WHERE actual_delivery_date IS NULL AND expected_delivery_date < CURRENT_DATE) as overdue_count,
        COALESCE(SUM(offspring_count), 0) as total_offspring,
        COALESCE(AVG(offspring_count), 0) as avg_offspring_per_breeding
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      WHERE br.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND br.breeding_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND br.breeding_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND male_breed.animal_type_id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get expected deliveries
   * @param {number} days - Number of days to look ahead (default 30)
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getExpectedDeliveries(days = 30, limit = 20) {
    const query = `
      SELECT br.*,
             male.tag_number as male_tag,
             female.tag_number as female_tag,
             female.name as female_name,
             at.name as animal_type_name,
             CURRENT_DATE - br.expected_delivery_date as days_until_delivery
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds female_breed ON female.animal_breed_id = female_breed.id
      LEFT JOIN animal_types at ON female_breed.animal_type_id = at.id
      WHERE br.deleted_at IS NULL
        AND br.actual_delivery_date IS NULL
        AND br.expected_delivery_date IS NOT NULL
        AND br.expected_delivery_date >= CURRENT_DATE
        AND br.expected_delivery_date <= CURRENT_DATE + make_interval(days => ${toSqlInt(days, { name: 'days' })})
      ORDER BY br.expected_delivery_date ASC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get overdue deliveries
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getOverdueDeliveries(limit = 20) {
    const query = `
      SELECT br.*,
             male.tag_number as male_tag,
             female.tag_number as female_tag,
             female.name as female_name,
             at.name as animal_type_name,
             CURRENT_DATE - br.expected_delivery_date as days_overdue
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds female_breed ON female.animal_breed_id = female_breed.id
      LEFT JOIN animal_types at ON female_breed.animal_type_id = at.id
      WHERE br.deleted_at IS NULL
        AND br.actual_delivery_date IS NULL
        AND br.expected_delivery_date IS NOT NULL
        AND br.expected_delivery_date < CURRENT_DATE
      ORDER BY br.expected_delivery_date ASC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get breeding performance by animal
   * @param {number} animalId - Animal ID
   * @param {string} role - 'male' or 'female'
   * @returns {Promise<Object>}
   */
  async getBreedingPerformance(animalId, role = 'both') {
    let roleCondition = '';
    if (role === 'male') {
      roleCondition = 'AND br.male_animal_id = $1';
    } else if (role === 'female') {
      roleCondition = 'AND br.female_animal_id = $1';
    } else {
      roleCondition = 'AND (br.male_animal_id = $1 OR br.female_animal_id = $1)';
    }

    const query = `
      SELECT
        COUNT(*) as total_breedings,
        COUNT(*) FILTER (WHERE actual_delivery_date IS NOT NULL) as successful_deliveries,
        COALESCE(SUM(offspring_count), 0) as total_offspring,
        COALESCE(AVG(offspring_count), 0) as avg_offspring_per_delivery,
        MIN(breeding_date) as first_breeding_date,
        MAX(breeding_date) as last_breeding_date
      FROM ${this.tableName} br
      WHERE br.deleted_at IS NULL ${roleCondition}
    `;
    return await this.db.oneOrNone(query, [animalId]);
  }

  /**
   * Get recent breeding records
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getRecentRecords(days = 30, limit = 10) {
    const query = `
      SELECT br.*,
             male.tag_number as male_tag,
             male.name as male_name,
             female.tag_number as female_tag,
             female.name as female_name,
             at.name as animal_type_name
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animals female ON br.female_animal_id = female.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      LEFT JOIN animal_types at ON male_breed.animal_type_id = at.id
      WHERE br.deleted_at IS NULL
        AND br.breeding_date >= CURRENT_DATE - make_interval(days => ${toSqlInt(days, { name: 'days' })})
      ORDER BY br.breeding_date DESC, br.created_at DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get breeding success rate by animal type
   * @param {Object} filters - Optional filters (date range)
   * @returns {Promise<Array>}
   */
  async getSuccessRateByType(filters = {}) {
    let query = `
      SELECT
        at.name as animal_type_name,
        at.id as animal_type_id,
        COUNT(*) as total_breedings,
        COUNT(*) FILTER (WHERE br.actual_delivery_date IS NOT NULL) as successful_deliveries,
        ROUND(
          (COUNT(*) FILTER (WHERE br.actual_delivery_date IS NOT NULL)::DECIMAL /
          NULLIF(COUNT(*), 0)) * 100, 2
        ) as success_rate,
        COALESCE(SUM(br.offspring_count), 0) as total_offspring
      FROM ${this.tableName} br
      LEFT JOIN animals male ON br.male_animal_id = male.id
      LEFT JOIN animal_breeds male_breed ON male.animal_breed_id = male_breed.id
      LEFT JOIN animal_types at ON male_breed.animal_type_id = at.id
      WHERE br.deleted_at IS NULL
        AND at.id IS NOT NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND br.breeding_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND br.breeding_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY at.id, at.name ORDER BY total_breedings DESC';

    return await this.db.any(query, values);
  }
}

module.exports = new BreedingRecordRepository();
