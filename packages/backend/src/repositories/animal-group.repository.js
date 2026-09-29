const BaseRepository = require('./base.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Repository for animal_groups table operations (flock/herd tracking)
 */
class AnimalGroupRepository extends BaseRepository {
  constructor() {
    super('animal_groups');
  }

  /**
   * Generate unique group code
   * @param {string} prefix - Group prefix (e.g., 'CHK' for chicken)
   * @returns {Promise<string>}
   */
  async generateGroupCode(prefix = 'GRP') {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const codePrefix = `${prefix.toUpperCase().slice(0, 3)}-${year}${month}`;

    const query = `
      SELECT group_code FROM ${this.tableName}
      WHERE group_code LIKE $1
      ORDER BY group_code DESC
      LIMIT 1
    `;

    const result = await this.db.oneOrNone(query, [`${codePrefix}%`]);

    if (result) {
      const lastNumber = parseInt(result.group_code.split('-').pop(), 10);
      return `${codePrefix}-${(lastNumber + 1).toString().padStart(3, '0')}`;
    }

    return `${codePrefix}-001`;
  }

  /**
   * Find all groups with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT ag.*,
             ab.name as breed_name,
             at.id as animal_type_id,
             at.name as animal_type_name,
             at.category as animal_type_category,
             ah.name as housing_name,
             u.first_name || ' ' || u.last_name as created_by_name,
             COALESCE(ag.current_quantity, ag.quantity) as effective_quantity,
             COALESCE(death_stats.total_deaths, 0) as total_deaths
      FROM ${this.tableName} ag
      LEFT JOIN animal_breeds ab ON ag.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN animal_housing ah ON ag.housing_id = ah.id
      LEFT JOIN users u ON ag.created_by = u.id
      LEFT JOIN (
        SELECT animal_group_id, SUM(quantity) as total_deaths
        FROM animal_deaths
        WHERE deleted_at IS NULL
        GROUP BY animal_group_id
      ) death_stats ON ag.id = death_stats.animal_group_id
      WHERE ag.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND ag.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.breed_id) {
      query += ` AND ag.animal_breed_id = $${paramIndex++}`;
      values.push(filters.breed_id);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.housing_id) {
      query += ` AND ag.housing_id = $${paramIndex++}`;
      values.push(filters.housing_id);
    }

    if (filters.group_type) {
      query += ` AND ag.group_type = $${paramIndex++}`;
      values.push(filters.group_type);
    }

    query += ' ORDER BY ag.date_established DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find group by ID with full details
   * @param {number} id - Group ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT ag.*,
             ab.name as breed_name,
             ab.description as breed_description,
             at.id as animal_type_id,
             at.name as animal_type_name,
             at.category as animal_type_category,
             at.tracking_mode,
             ah.name as housing_name,
             ah.capacity as housing_capacity,
             u.first_name || ' ' || u.last_name as created_by_name,
             COALESCE(ag.current_quantity, ag.quantity) as effective_quantity,
             COALESCE(death_stats.total_deaths, 0) as total_deaths,
             COALESCE(sale_stats.total_sold, 0) as total_sold
      FROM ${this.tableName} ag
      LEFT JOIN animal_breeds ab ON ag.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN animal_housing ah ON ag.housing_id = ah.id
      LEFT JOIN users u ON ag.created_by = u.id
      LEFT JOIN (
        SELECT animal_group_id, SUM(quantity) as total_deaths
        FROM animal_deaths
        WHERE deleted_at IS NULL
        GROUP BY animal_group_id
      ) death_stats ON ag.id = death_stats.animal_group_id
      LEFT JOIN (
        SELECT animal_group_id, SUM(ABS(quantity)) as total_sold
        FROM animal_group_adjustments
        WHERE adjustment_type = 'sale'
        GROUP BY animal_group_id
      ) sale_stats ON ag.id = sale_stats.animal_group_id
      WHERE ag.id = $1 AND ag.deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Find group by code
   * @param {string} groupCode - Group code
   * @returns {Promise<Object|null>}
   */
  async findByGroupCode(groupCode) {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE group_code = $1 AND deleted_at IS NULL
    `;
    return await this.db.oneOrNone(query, [groupCode]);
  }

  /**
   * Find active groups by housing
   * @param {number} housingId - Housing ID
   * @returns {Promise<Array>}
   */
  async findActiveByHousing(housingId) {
    const query = `
      SELECT ag.*,
             ab.name as breed_name,
             COALESCE(ag.current_quantity, ag.quantity) as effective_quantity
      FROM ${this.tableName} ag
      LEFT JOIN animal_breeds ab ON ag.animal_breed_id = ab.id
      WHERE ag.housing_id = $1 AND ag.status = 'active' AND ag.deleted_at IS NULL
      ORDER BY ag.name
    `;
    return await this.db.any(query, [housingId]);
  }

  /**
   * Update group quantity
   * @param {number} id - Group ID
   * @param {number} newQuantity - New quantity
   * @returns {Promise<Object>}
   */
  async updateQuantity(id, newQuantity) {
    const query = `
      UPDATE ${this.tableName}
      SET current_quantity = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id, newQuantity]);
  }

  /**
   * Adjust group quantity with tracking
   * @param {number} id - Group ID
   * @param {number} adjustment - Quantity change (positive or negative)
   * @param {string} adjustmentType - Type of adjustment
   * @param {Object} details - Additional details
   * @returns {Promise<Object>}
   */
  async adjustQuantity(id, adjustment, adjustmentType, details = {}) {
    // Get current group
    const group = await this.findById(id);
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const currentQuantity = group.current_quantity || group.quantity;
    const newQuantity = currentQuantity + adjustment;

    if (newQuantity < 0) {
      throw new ValidationError('Cannot reduce quantity below zero');
    }

    // Update group quantity
    await this.updateQuantity(id, newQuantity);

    // Record adjustment
    const adjustmentQuery = `
      INSERT INTO animal_group_adjustments (
        animal_group_id, adjustment_date, adjustment_type,
        quantity, quantity_before, quantity_after,
        reason, reference_type, reference_id, unit_value, total_value,
        notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const adjustmentRecord = await this.db.one(adjustmentQuery, [
      id,
      details.adjustment_date || new Date(),
      adjustmentType,
      adjustment,
      currentQuantity,
      newQuantity,
      details.reason || null,
      details.reference_type || null,
      details.reference_id || null,
      details.unit_value || null,
      details.total_value || null,
      details.notes || null,
      details.recorded_by || null,
    ]);

    return {
      group: await this.findByIdWithDetails(id),
      adjustment: adjustmentRecord,
    };
  }

  /**
   * Record addition to group (purchase, hatching, birth, transfer in)
   * @param {number} id - Group ID
   * @param {number} quantity - Quantity to add
   * @param {string} type - Type: 'addition', 'hatched', 'born', 'transfer_in'
   * @param {Object} details - Additional details
   * @returns {Promise<Object>}
   */
  async recordAddition(id, quantity, type, details = {}) {
    return await this.adjustQuantity(id, Math.abs(quantity), type, details);
  }

  /**
   * Record removal from group (sale, transfer out)
   * @param {number} id - Group ID
   * @param {number} quantity - Quantity to remove
   * @param {string} type - Type: 'removal', 'sale', 'transfer_out'
   * @param {Object} details - Additional details
   * @returns {Promise<Object>}
   */
  async recordRemoval(id, quantity, type, details = {}) {
    return await this.adjustQuantity(id, -Math.abs(quantity), type, details);
  }

  /**
   * Get adjustment history for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getAdjustmentHistory(groupId) {
    const query = `
      SELECT aga.*,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM animal_group_adjustments aga
      LEFT JOIN users u ON aga.recorded_by = u.id
      WHERE aga.animal_group_id = $1
      ORDER BY aga.adjustment_date DESC, aga.created_at DESC
    `;
    return await this.db.any(query, [groupId]);
  }

  /**
   * Get statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_groups,
        COUNT(*) FILTER (WHERE status = 'closed') as closed_groups,
        COUNT(*) as total_groups,
        SUM(COALESCE(current_quantity, quantity)) FILTER (WHERE status = 'active') as total_active_animals
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    return await this.db.one(query);
  }

  /**
   * Paginate groups with details
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async paginateWithDetails(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;

    let baseQuery = `
      FROM ${this.tableName} ag
      LEFT JOIN animal_breeds ab ON ag.animal_breed_id = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN animal_housing ah ON ag.housing_id = ah.id
      WHERE ag.deleted_at IS NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      baseQuery += ` AND ag.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.breed_id) {
      baseQuery += ` AND ag.animal_breed_id = $${paramIndex++}`;
      values.push(filters.breed_id);
    }

    if (filters.animal_type_id) {
      baseQuery += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.housing_id) {
      baseQuery += ` AND ag.housing_id = $${paramIndex++}`;
      values.push(filters.housing_id);
    }

    if (filters.search) {
      baseQuery += ` AND (ag.group_code ILIKE $${paramIndex} OR ag.name ILIKE $${paramIndex})`;
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const countQuery = `SELECT COUNT(*) as count ${baseQuery}`;

    const dataQuery = `
      SELECT ag.*,
             ab.name as breed_name,
             at.id as animal_type_id,
             at.name as animal_type_name,
             ah.name as housing_name,
             COALESCE(ag.current_quantity, ag.quantity) as effective_quantity
      ${baseQuery}
      ORDER BY ag.created_at DESC
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
   * Close a group (mark as closed when all animals sold/transferred/deceased)
   * @param {number} id - Group ID
   * @returns {Promise<Object>}
   */
  async closeGroup(id) {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'closed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return await this.db.one(query, [id]);
  }
}

module.exports = new AnimalGroupRepository();
