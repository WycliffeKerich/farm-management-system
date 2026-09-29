const BaseRepository = require('./base.repository');
const { toSqlInt } = require('../utils/sql');

/**
 * Repository for incubation_records table operations
 */
class IncubationRecordRepository extends BaseRepository {
  constructor() {
    super('incubation_records');
  }

  /**
   * Generate unique batch code
   * @param {string} prefix - Batch prefix (e.g., 'INC' for incubation)
   * @returns {Promise<string>}
   */
  async generateBatchCode(prefix = 'INC') {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const codePrefix = `${prefix.toUpperCase()}-${year}${month}`;

    const query = `
      SELECT batch_code FROM ${this.tableName}
      WHERE batch_code LIKE $1
      ORDER BY batch_code DESC
      LIMIT 1
    `;

    const result = await this.db.oneOrNone(query, [`${codePrefix}%`]);

    if (result) {
      const lastNumber = parseInt(result.batch_code.split('-').pop(), 10);
      return `${codePrefix}-${(lastNumber + 1).toString().padStart(4, '0')}`;
    }

    return `${codePrefix}-0001`;
  }

  /**
   * Find all incubation records with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT ir.*,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             tg.name as target_group_name,
             tg.group_code as target_group_code,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ir
      LEFT JOIN animal_groups ag ON ir.animal_group_id = ag.id
      LEFT JOIN animal_groups tg ON ir.target_group_id = tg.id
      LEFT JOIN animal_breeds ab ON ir.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON ir.recorded_by = u.id
      WHERE ir.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND ir.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.animal_group_id) {
      query += ` AND ir.animal_group_id = $${paramIndex++}`;
      values.push(filters.animal_group_id);
    }

    if (filters.animal_breed_id) {
      query += ` AND ir.animal_breed_id = $${paramIndex++}`;
      values.push(filters.animal_breed_id);
    }

    if (filters.start_date) {
      query += ` AND ir.incubation_start_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ir.incubation_start_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' ORDER BY ir.incubation_start_date DESC, ir.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find incubation record by ID with details
   * @param {number} id - Incubation record ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT ir.*,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             tg.name as target_group_name,
             tg.group_code as target_group_code,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ir
      LEFT JOIN animal_groups ag ON ir.animal_group_id = ag.id
      LEFT JOIN animal_groups tg ON ir.target_group_id = tg.id
      LEFT JOIN animal_breeds ab ON ir.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN users u ON ir.recorded_by = u.id
      WHERE ir.id = $1 AND ir.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find incubation records by group
   * @param {number} groupId - Animal group ID
   * @returns {Promise<Array>}
   */
  async findByGroupId(groupId) {
    const query = `
      SELECT ir.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} ir
      LEFT JOIN users u ON ir.recorded_by = u.id
      WHERE ir.animal_group_id = $1 AND ir.deleted_at IS NULL
      ORDER BY ir.incubation_start_date DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Get active incubation batches
   * @returns {Promise<Array>}
   */
  async getActiveIncubations() {
    const query = `
      SELECT ir.*,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             CURRENT_DATE - ir.incubation_start_date as days_incubating,
             ir.expected_hatch_date - CURRENT_DATE as days_until_hatch
      FROM ${this.tableName} ir
      LEFT JOIN animal_groups ag ON ir.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON ir.animal_breed_id = ab.id
      WHERE ir.status = 'incubating' AND ir.deleted_at IS NULL
      ORDER BY ir.expected_hatch_date ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Get due to hatch records
   * @param {number} days - Days to look ahead (default 7)
   * @returns {Promise<Array>}
   */
  async getDueToHatch(days = 7) {
    const query = `
      SELECT ir.*,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             ir.expected_hatch_date - CURRENT_DATE as days_until_hatch
      FROM ${this.tableName} ir
      LEFT JOIN animal_groups ag ON ir.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON ir.animal_breed_id = ab.id
      WHERE ir.status = 'incubating'
        AND ir.expected_hatch_date BETWEEN CURRENT_DATE AND CURRENT_DATE + make_interval(days => ${toSqlInt(days, { name: 'days' })})
        AND ir.deleted_at IS NULL
      ORDER BY ir.expected_hatch_date ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Get overdue hatching records
   * @returns {Promise<Array>}
   */
  async getOverdueHatching() {
    const query = `
      SELECT ir.*,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             CURRENT_DATE - ir.expected_hatch_date as days_overdue
      FROM ${this.tableName} ir
      LEFT JOIN animal_groups ag ON ir.animal_group_id = ag.id
      LEFT JOIN animal_breeds ab ON ir.animal_breed_id = ab.id
      WHERE ir.status = 'incubating'
        AND ir.expected_hatch_date < CURRENT_DATE
        AND ir.deleted_at IS NULL
      ORDER BY ir.expected_hatch_date ASC
    `;
    return await this.db.any(query);
  }

  /**
   * Get incubation statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*)::integer as total_batches,
        COUNT(*) FILTER (WHERE status = 'incubating')::integer as active_batches,
        COUNT(*) FILTER (WHERE status = 'hatched')::integer as completed_batches,
        COALESCE(SUM(eggs_count), 0)::integer as total_eggs_incubated,
        COALESCE(SUM(hatched_count), 0)::integer as total_hatched,
        COALESCE(SUM(unhatched_count), 0)::integer as total_unhatched,
        CASE
          WHEN SUM(eggs_count) > 0 THEN
            ROUND((SUM(hatched_count)::decimal / SUM(eggs_count)::decimal * 100), 2)
          ELSE 0
        END as hatch_rate_percentage
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND incubation_start_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND incubation_start_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_breed_id) {
      query += ` AND animal_breed_id = $${paramIndex++}`;
      values.push(filters.animal_breed_id);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get hatch success rate by breed
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getHatchRateByBreed(filters = {}) {
    let query = `
      SELECT
        ab.name as breed_name,
        ab.id as breed_id,
        COUNT(*)::integer as batch_count,
        SUM(ir.eggs_count)::integer as total_eggs,
        SUM(ir.hatched_count)::integer as total_hatched,
        CASE
          WHEN SUM(ir.eggs_count) > 0 THEN
            ROUND((SUM(ir.hatched_count)::decimal / SUM(ir.eggs_count)::decimal * 100), 2)
          ELSE 0
        END as hatch_rate_percentage
      FROM ${this.tableName} ir
      LEFT JOIN animal_breeds ab ON ir.animal_breed_id = ab.id
      WHERE ir.deleted_at IS NULL
        AND ir.status IN ('hatched', 'partial')
        AND ab.id IS NOT NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND ir.incubation_start_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND ir.incubation_start_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY ab.id, ab.name ORDER BY hatch_rate_percentage DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get monthly incubation summary
   * @param {number} months - Number of months to look back (default 6)
   * @returns {Promise<Array>}
   */
  async getMonthlyIncubationSummary(months = 6) {
    const query = `
      SELECT
        TO_CHAR(incubation_start_date, 'YYYY-MM') as month,
        COUNT(*)::integer as batch_count,
        SUM(eggs_count)::integer as total_eggs,
        SUM(hatched_count)::integer as total_hatched,
        CASE
          WHEN SUM(eggs_count) > 0 THEN
            ROUND((SUM(hatched_count)::decimal / SUM(eggs_count)::decimal * 100), 2)
          ELSE 0
        END as hatch_rate
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
        AND incubation_start_date >= CURRENT_DATE - make_interval(months => ${toSqlInt(months, { max: 120, name: 'months' })})
      GROUP BY month
      ORDER BY month DESC
    `;
    return await this.db.any(query);
  }
}

module.exports = new IncubationRecordRepository();
