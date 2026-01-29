const BaseRepository = require('./base.repository');

/**
 * Repository for animal_health_records table operations
 */
class AnimalHealthRecordRepository extends BaseRepository {
  constructor() {
    super('animal_health_records');
  }

  /**
   * Find all health records with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT ahr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ahr
      LEFT JOIN animals a ON ahr.animal_id = a.id
      LEFT JOIN animal_groups ag ON ahr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON ahr.recorded_by = u.id
      WHERE ahr.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_id) {
      query += ` AND ahr.animal_id = $${paramIndex++}`;
      values.push(filters.animal_id);
    }

    if (filters.animal_group_id) {
      query += ` AND ahr.animal_group_id = $${paramIndex++}`;
      values.push(filters.animal_group_id);
    }

    if (filters.record_type) {
      query += ` AND ahr.record_type = $${paramIndex++}`;
      values.push(filters.record_type);
    }

    if (filters.start_date) {
      query += ` AND ahr.record_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ahr.record_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY ahr.record_date DESC, ahr.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find health record by ID with details
   * @param {number} id - Health record ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT ahr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ahr
      LEFT JOIN animals a ON ahr.animal_id = a.id
      LEFT JOIN animal_groups ag ON ahr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON ahr.recorded_by = u.id
      WHERE ahr.id = $1 AND ahr.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find health records by animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT ahr.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ahr
      LEFT JOIN users u ON ahr.recorded_by = u.id
      WHERE ahr.animal_id = $1 AND ahr.deleted_at IS NULL
      ORDER BY ahr.record_date DESC, ahr.created_at DESC
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find health records by group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT ahr.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ahr
      LEFT JOIN users u ON ahr.recorded_by = u.id
      WHERE ahr.animal_group_id = $1 AND ahr.deleted_at IS NULL
      ORDER BY ahr.record_date DESC, ahr.created_at DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Get health statistics
   * @param {Object} filters - Optional filters (date range, animal type)
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE record_type = 'vaccination') as vaccination_count,
        COUNT(*) FILTER (WHERE record_type = 'treatment') as treatment_count,
        COUNT(*) FILTER (WHERE record_type = 'checkup') as checkup_count,
        COUNT(*) FILTER (WHERE record_type = 'deworming') as deworming_count,
        COALESCE(SUM(cost), 0) as total_cost
      FROM ${this.tableName} ahr
      LEFT JOIN animals a ON ahr.animal_id = a.id
      LEFT JOIN animal_groups ag ON ahr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      WHERE ahr.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND ahr.record_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ahr.record_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND ab.animal_type_id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get health records by type summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getRecordsByType(filters = {}) {
    let query = `
      SELECT
        record_type,
        COUNT(*) as record_count,
        COALESCE(SUM(cost), 0) as total_cost
      FROM ${this.tableName} ahr
      WHERE ahr.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND ahr.record_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ahr.record_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY record_type ORDER BY record_count DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get upcoming followups
   * @param {number} days - Number of days to look ahead
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getUpcomingFollowups(days = 30, limit = 10) {
    const query = `
      SELECT ahr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} ahr
      LEFT JOIN animals a ON ahr.animal_id = a.id
      LEFT JOIN animal_groups ag ON ahr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ahr.deleted_at IS NULL
        AND ahr.next_followup_date IS NOT NULL
        AND ahr.next_followup_date >= CURRENT_DATE
        AND ahr.next_followup_date <= CURRENT_DATE + INTERVAL '${days} days'
      ORDER BY ahr.next_followup_date ASC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get overdue followups
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getOverdueFollowups(limit = 10) {
    const query = `
      SELECT ahr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} ahr
      LEFT JOIN animals a ON ahr.animal_id = a.id
      LEFT JOIN animal_groups ag ON ahr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ahr.deleted_at IS NULL
        AND ahr.next_followup_date IS NOT NULL
        AND ahr.next_followup_date < CURRENT_DATE
      ORDER BY ahr.next_followup_date ASC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get recent health records (alerts)
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getRecentRecords(days = 7, limit = 10) {
    const query = `
      SELECT ahr.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} ahr
      LEFT JOIN animals a ON ahr.animal_id = a.id
      LEFT JOIN animal_groups ag ON ahr.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE ahr.deleted_at IS NULL
        AND ahr.record_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY ahr.record_date DESC, ahr.created_at DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }
}

module.exports = new AnimalHealthRecordRepository();
