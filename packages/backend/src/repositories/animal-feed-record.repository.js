const BaseRepository = require('./base.repository');
const { ValidationError } = require('../utils/errors');

/**
 * Repository for animal_feed_records table operations
 */
class AnimalFeedRecordRepository extends BaseRepository {
  constructor() {
    super('animal_feed_records');
  }

  /**
   * Find all feed records with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT afr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} afr
      LEFT JOIN animals a ON afr.animal_id = a.id
      LEFT JOIN animal_groups ag ON afr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON afr.recorded_by = u.id
      WHERE afr.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_id) {
      query += ` AND afr.animal_id = $${paramIndex++}`;
      values.push(filters.animal_id);
    }

    if (filters.animal_group_id) {
      query += ` AND afr.animal_group_id = $${paramIndex++}`;
      values.push(filters.animal_group_id);
    }

    if (filters.feed_type) {
      query += ` AND afr.feed_type = $${paramIndex++}`;
      values.push(filters.feed_type);
    }

    if (filters.feed_name) {
      query += ` AND afr.feed_name ILIKE $${paramIndex++}`;
      values.push(`%${filters.feed_name}%`);
    }

    if (filters.start_date) {
      query += ` AND afr.feed_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND afr.feed_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY afr.feed_date DESC, afr.feeding_time DESC, afr.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find feed record by ID with details
   * @param {number} id - Feed record ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT afr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} afr
      LEFT JOIN animals a ON afr.animal_id = a.id
      LEFT JOIN animal_groups ag ON afr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON afr.recorded_by = u.id
      WHERE afr.id = $1 AND afr.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find feed records by animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT afr.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} afr
      LEFT JOIN users u ON afr.recorded_by = u.id
      WHERE afr.animal_id = $1 AND afr.deleted_at IS NULL
      ORDER BY afr.feed_date DESC, afr.feeding_time DESC, afr.created_at DESC
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find feed records by group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT afr.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} afr
      LEFT JOIN users u ON afr.recorded_by = u.id
      WHERE afr.animal_group_id = $1 AND afr.deleted_at IS NULL
      ORDER BY afr.feed_date DESC, afr.feeding_time DESC, afr.created_at DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Get feed consumption statistics
   * @param {Object} filters - Optional filters (date range, animal type)
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*)::integer as total_records,
        COALESCE(SUM(quantity), 0)::numeric as total_quantity,
        COALESCE(SUM(total_cost), 0)::numeric as total_cost,
        COUNT(DISTINCT feed_name)::integer as unique_feed_types
      FROM ${this.tableName} afr
    `;

    // Only add JOINs if we need to filter by animal_type_id
    if (filters.animal_type_id) {
      query += `
        LEFT JOIN animals a ON afr.animal_id = a.id
        LEFT JOIN animal_groups ag ON afr.animal_group_id = ag.id
        LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      `;
    }

    query += ` WHERE afr.deleted_at IS NULL`;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND afr.feed_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND afr.feed_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND ab.animal_type_id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.feed_type) {
      query += ` AND afr.feed_type = $${paramIndex++}`;
      values.push(filters.feed_type);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get feed consumption by type summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getConsumptionByFeedType(filters = {}) {
    let query = `
      SELECT
        feed_name,
        feed_type,
        unit,
        COUNT(*) as record_count,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(AVG(cost_per_unit), 0) as avg_cost_per_unit
      FROM ${this.tableName} afr
      WHERE afr.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND afr.feed_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND afr.feed_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.feed_type) {
      query += ` AND afr.feed_type = $${paramIndex++}`;
      values.push(filters.feed_type);
    }

    query += ' GROUP BY feed_name, feed_type, unit ORDER BY total_quantity DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get daily feed consumption
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getDailyConsumption(filters = {}) {
    let query = `
      SELECT
        feed_date,
        COUNT(*) as record_count,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM ${this.tableName} afr
      WHERE afr.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND afr.feed_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND afr.feed_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY feed_date ORDER BY feed_date DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(filters.limit);
    }

    return await this.db.any(query, values);
  }

  /**
   * Get feed cost by animal type
   * @param {Object} filters - Optional filters (date range)
   * @returns {Promise<Array>}
   */
  async getCostByAnimalType(filters = {}) {
    let query = `
      SELECT
        at.name as animal_type_name,
        at.id as animal_type_id,
        COUNT(*) as record_count,
        COALESCE(SUM(afr.quantity), 0) as total_quantity,
        COALESCE(SUM(afr.total_cost), 0) as total_cost
      FROM ${this.tableName} afr
      LEFT JOIN animals a ON afr.animal_id = a.id
      LEFT JOIN animal_groups ag ON afr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE afr.deleted_at IS NULL
        AND at.id IS NOT NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND afr.feed_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND afr.feed_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY at.id, at.name ORDER BY total_cost DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get recent feed records
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getRecentRecords(days = 7, limit = 10) {
    const query = `
      SELECT afr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} afr
      LEFT JOIN animals a ON afr.animal_id = a.id
      LEFT JOIN animal_groups ag ON afr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE afr.deleted_at IS NULL
        AND afr.feed_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY afr.feed_date DESC, afr.feeding_time DESC, afr.created_at DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get average daily feed cost for an animal or group
   * @param {number} animalId - Animal ID
   * @param {number} groupId - Group ID
   * @param {number} days - Number of days to calculate average (default 30)
   * @returns {Promise<Object>}
   */
  async getAverageDailyCost(animalId = null, groupId = null, days = 30) {
    if (!animalId && !groupId) {
      throw new ValidationError('Either animalId or groupId must be provided');
    }

    const condition = animalId ? 'animal_id = $1' : 'animal_group_id = $1';
    const id = animalId || groupId;

    const query = `
      SELECT
        COALESCE(AVG(daily_cost), 0) as avg_daily_cost,
        COALESCE(SUM(daily_cost), 0) as total_cost,
        COUNT(*) as days_with_records
      FROM (
        SELECT
          feed_date,
          SUM(total_cost) as daily_cost
        FROM ${this.tableName}
        WHERE ${condition}
          AND deleted_at IS NULL
          AND feed_date >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY feed_date
      ) daily_totals
    `;
    return await this.db.oneOrNone(query, [id]);
  }
}

module.exports = new AnimalFeedRecordRepository();
