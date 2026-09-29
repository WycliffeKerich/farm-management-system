const BaseRepository = require('./base.repository');
const { toSqlInt } = require('../utils/sql');

/**
 * Repository for animal_diseases_treatments table operations
 */
class AnimalDiseaseTreatmentRepository extends BaseRepository {
  constructor() {
    super('animal_diseases_treatments');
  }

  /**
   * Find all disease/treatment records with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT adt.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} adt
      LEFT JOIN animals a ON adt.animal_id = a.id
      LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON adt.recorded_by = u.id
      WHERE adt.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_id) {
      query += ` AND adt.animal_id = $${paramIndex++}`;
      values.push(filters.animal_id);
    }

    if (filters.animal_group_id) {
      query += ` AND adt.animal_group_id = $${paramIndex++}`;
      values.push(filters.animal_group_id);
    }

    if (filters.status) {
      query += ` AND adt.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.severity) {
      query += ` AND adt.severity = $${paramIndex++}`;
      values.push(filters.severity);
    }

    if (filters.disease_name) {
      query += ` AND adt.disease_name ILIKE $${paramIndex++}`;
      values.push(`%${filters.disease_name}%`);
    }

    if (filters.start_date) {
      query += ` AND adt.diagnosis_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND adt.diagnosis_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    query += ' ORDER BY adt.diagnosis_date DESC, adt.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find disease/treatment record by ID with details
   * @param {number} id - Disease/treatment record ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT adt.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} adt
      LEFT JOIN animals a ON adt.animal_id = a.id
      LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON adt.recorded_by = u.id
      WHERE adt.id = $1 AND adt.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find disease/treatment records by animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async findByAnimalId(animalId) {
    const query = `
      SELECT adt.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} adt
      LEFT JOIN users u ON adt.recorded_by = u.id
      WHERE adt.animal_id = $1 AND adt.deleted_at IS NULL
      ORDER BY adt.diagnosis_date DESC, adt.created_at DESC
    `;
    return await this.db.any(query, [animalId]);
  }

  /**
   * Find disease/treatment records by group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT adt.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} adt
      LEFT JOIN users u ON adt.recorded_by = u.id
      WHERE adt.animal_group_id = $1 AND adt.deleted_at IS NULL
      ORDER BY adt.diagnosis_date DESC, adt.created_at DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Get disease statistics
   * @param {Object} filters - Optional filters (date range, animal type)
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*)::integer as total_records,
        COUNT(*) FILTER (WHERE adt.status = 'ongoing')::integer as ongoing_count,
        COUNT(*) FILTER (WHERE adt.status = 'completed')::integer as completed_count,
        COUNT(*) FILTER (WHERE adt.status = 'chronic')::integer as chronic_count,
        COUNT(*) FILTER (WHERE adt.severity = 'critical')::integer as critical_count,
        COUNT(*) FILTER (WHERE adt.severity = 'high')::integer as high_count,
        COUNT(*) FILTER (WHERE adt.severity = 'medium')::integer as medium_count,
        COUNT(*) FILTER (WHERE adt.severity = 'low')::integer as low_count,
        COALESCE(SUM(adt.cost), 0)::numeric as total_cost
      FROM ${this.tableName} adt
    `;

    // Only add JOINs if we need to filter by animal_type_id
    if (filters.animal_type_id) {
      query += `
        LEFT JOIN animals a ON adt.animal_id = a.id
        LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
        LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      `;
    }

    query += ` WHERE adt.deleted_at IS NULL`;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND adt.diagnosis_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND adt.diagnosis_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND ab.animal_type_id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get disease occurrence summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getDiseaseOccurrenceSummary(filters = {}) {
    let query = `
      SELECT
        disease_name,
        COUNT(*) as occurrence_count,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE severity = 'high') as high_count,
        COUNT(*) FILTER (WHERE status = 'ongoing') as ongoing_count,
        COUNT(*) FILTER (WHERE status = 'chronic') as chronic_count,
        COALESCE(SUM(cost), 0) as total_cost
      FROM ${this.tableName} adt
      WHERE adt.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND adt.diagnosis_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND adt.diagnosis_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY disease_name ORDER BY occurrence_count DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get ongoing treatments
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getOngoingTreatments(limit = 20) {
    const query = `
      SELECT adt.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} adt
      LEFT JOIN animals a ON adt.animal_id = a.id
      LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE adt.deleted_at IS NULL
        AND adt.status = 'ongoing'
      ORDER BY adt.diagnosis_date DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get chronic conditions
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getChronicConditions(limit = 20) {
    const query = `
      SELECT adt.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} adt
      LEFT JOIN animals a ON adt.animal_id = a.id
      LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE adt.deleted_at IS NULL
        AND adt.status = 'chronic'
      ORDER BY adt.diagnosis_date DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get recent disease diagnoses (alerts)
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getRecentDiagnoses(days = 7, limit = 10) {
    const query = `
      SELECT adt.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} adt
      LEFT JOIN animals a ON adt.animal_id = a.id
      LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE adt.deleted_at IS NULL
        AND adt.diagnosis_date >= CURRENT_DATE - make_interval(days => ${toSqlInt(days, { name: 'days' })})
      ORDER BY adt.diagnosis_date DESC, adt.created_at DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get critical cases
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getCriticalCases(limit = 10) {
    const query = `
      SELECT adt.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             at.name as animal_type_name
      FROM ${this.tableName} adt
      LEFT JOIN animals a ON adt.animal_id = a.id
      LEFT JOIN animal_groups ag ON adt.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE adt.deleted_at IS NULL
        AND adt.severity = 'critical'
        AND adt.status IN ('ongoing', 'chronic')
      ORDER BY adt.diagnosis_date DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }
}

module.exports = new AnimalDiseaseTreatmentRepository();
