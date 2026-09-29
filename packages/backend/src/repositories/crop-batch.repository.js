const BaseRepository = require('./base.repository');

/**
 * Repository for crop_batches table operations
 */
class CropBatchRepository extends BaseRepository {
  constructor() {
    super('crop_batches');
  }

  /**
   * Generate unique batch code
   * @param {string} cropTypePrefix - Crop type prefix (e.g., 'TOM' for Tomato)
   * @returns {Promise<string>}
   */
  async generateBatchCode(cropTypePrefix) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `${cropTypePrefix.toUpperCase().slice(0, 3)}-${year}${month}`;

    const query = `
      SELECT batch_code FROM ${this.tableName}
      WHERE batch_code LIKE $1
      ORDER BY batch_code DESC
      LIMIT 1
    `;

    const result = await this.db.oneOrNone(query, [`${prefix}%`]);

    if (result) {
      const lastNumber = parseInt(result.batch_code.split('-').pop(), 10);
      return `${prefix}-${(lastNumber + 1).toString().padStart(3, '0')}`;
    }

    return `${prefix}-001`;
  }

  /**
   * Find all batches with full details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT cb.*,
             cv.name as variety_name,
             ct.name as crop_type_name,
             ct.category as crop_type_category,
             gl.name as location_name,
             gl.type as location_type,
             u.first_name || ' ' || u.last_name as created_by_name,
             COALESCE(SUM(h.quantity), 0) as total_harvested
      FROM crop_batches cb
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON cb.created_by = u.id
      LEFT JOIN harvests h ON cb.id = h.batch_id AND h.deleted_at IS NULL
    `;

    const conditions = ['cb.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      // Handle single status or comma-separated statuses
      const statuses = Array.isArray(filters.status) ? filters.status : filters.status.split(',').map((s) => s.trim());

      if (statuses.length === 1) {
        conditions.push(`cb.status = $${paramIndex++}`);
        values.push(statuses[0]);
      } else {
        const placeholders = statuses.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`cb.status IN (${placeholders})`);
        values.push(...statuses);
      }
    }

    if (filters.location_id) {
      conditions.push(`cb.location_id = $${paramIndex++}`);
      values.push(filters.location_id);
    }

    if (filters.crop_type_id) {
      conditions.push(`ct.id = $${paramIndex++}`);
      values.push(filters.crop_type_id);
    }

    if (filters.variety_id) {
      conditions.push(`cb.crop_variety_id = $${paramIndex++}`);
      values.push(filters.variety_id);
    }

    if (filters.planting_date_from) {
      conditions.push(`cb.planting_date >= $${paramIndex++}`);
      values.push(filters.planting_date_from);
    }

    if (filters.planting_date_to) {
      conditions.push(`cb.planting_date <= $${paramIndex++}`);
      values.push(filters.planting_date_to);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY cb.id, cv.name, ct.name, ct.category, gl.name, gl.type, u.first_name, u.last_name
      ORDER BY cb.planting_date DESC
    `;

    return await this.db.any(query, values);
  }

  /**
   * Find batch by ID with full details
   * @param {number} id - Batch ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT cb.*,
             cv.name as variety_name,
             cv.growth_days as variety_growth_days,
             ct.id as crop_type_id,
             ct.name as crop_type_name,
             ct.category as crop_type_category,
             ct.typical_growth_days as crop_type_growth_days,
             gl.name as location_name,
             gl.type as location_type,
             gl.size_sqm as location_size,
             u.first_name || ' ' || u.last_name as created_by_name,
             COALESCE(SUM(h.quantity), 0) as total_harvested
      FROM crop_batches cb
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON cb.created_by = u.id
      LEFT JOIN harvests h ON cb.id = h.batch_id AND h.deleted_at IS NULL
      WHERE cb.id = $1 AND cb.deleted_at IS NULL
      GROUP BY cb.id, cv.name, cv.growth_days, ct.id, ct.name, ct.category, ct.typical_growth_days,
               gl.name, gl.type, gl.size_sqm, u.first_name, u.last_name
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find batch by batch code
   * @param {string} batchCode - Batch code
   * @returns {Promise<Object|null>}
   */
  async findByBatchCode(batchCode) {
    const query = `SELECT * FROM ${this.tableName} WHERE batch_code = $1`;
    return await this.db.oneOrNone(query, [batchCode]);
  }

  /**
   * Update batch status
   * @param {number} id - Batch ID
   * @param {string} status - New status
   * @returns {Promise<Object>}
   */
  async updateStatus(id, status) {
    const updateData = { status };

    if (status === 'completed') {
      updateData.actual_harvest_date = new Date();
    }

    return await this.update(id, updateData);
  }

  /**
   * Get batch statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'planted') as planted_count,
        COUNT(*) FILTER (WHERE status = 'growing') as growing_count,
        COUNT(*) FILTER (WHERE status = 'harvesting') as harvesting_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) as total_count
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    return await this.db.one(query);
  }

  /**
   * Get active batches by location
   * @param {number} locationId - Location ID
   * @returns {Promise<Array>}
   */
  async findActiveByLocation(locationId) {
    const query = `
      SELECT cb.*,
             cv.name as variety_name,
             ct.name as crop_type_name
      FROM crop_batches cb
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      WHERE cb.location_id = $1
        AND cb.deleted_at IS NULL
        AND cb.status IN ('planted', 'growing', 'harvesting')
      ORDER BY cb.planting_date DESC
    `;
    return await this.db.any(query, [locationId]);
  }

  /**
   * Paginate batches with filters
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>}
   */
  async paginateWithDetails(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM crop_batches cb
      JOIN crop_varieties cv ON cb.crop_variety_id = cv.id
      JOIN crop_types ct ON cv.crop_type_id = ct.id
      LEFT JOIN growing_locations gl ON cb.location_id = gl.id
      LEFT JOIN users u ON cb.created_by = u.id
    `;

    const conditions = ['cb.deleted_at IS NULL'];
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      // Handle single status or comma-separated statuses
      const statuses = Array.isArray(filters.status) ? filters.status : filters.status.split(',').map((s) => s.trim());

      if (statuses.length === 1) {
        conditions.push(`cb.status = $${paramIndex++}`);
        values.push(statuses[0]);
      } else {
        const placeholders = statuses.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`cb.status IN (${placeholders})`);
        values.push(...statuses);
      }
    }

    if (filters.location_id) {
      conditions.push(`cb.location_id = $${paramIndex++}`);
      values.push(filters.location_id);
    }

    if (filters.crop_type_id) {
      conditions.push(`ct.id = $${paramIndex++}`);
      values.push(filters.crop_type_id);
    }

    if (filters.search) {
      conditions.push(`(
        cb.batch_code ILIKE $${paramIndex} OR
        cv.name ILIKE $${paramIndex} OR
        ct.name ILIKE $${paramIndex}
      )`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countQuery = `SELECT COUNT(DISTINCT cb.id) as count ${baseQuery}`;
    const countResult = await this.db.one(countQuery, values);
    const total = parseInt(countResult.count, 10);

    const dataQuery = `
      SELECT cb.*,
             cv.name as variety_name,
             ct.name as crop_type_name,
             ct.category as crop_type_category,
             gl.name as location_name,
             u.first_name || ' ' || u.last_name as created_by_name
      ${baseQuery}
      ORDER BY cb.planting_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    values.push(limit, offset);

    const data = await this.db.any(dataQuery, values);

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
}

module.exports = new CropBatchRepository();
