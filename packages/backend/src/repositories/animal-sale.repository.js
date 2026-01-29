const BaseRepository = require('./base.repository');

/**
 * Repository for animal sales (uses sales table with reference_type='animal')
 */
class AnimalSaleRepository extends BaseRepository {
  constructor() {
    super('sales');
  }

  /**
   * Find all animal sales with details
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async findAllWithDetails(filters = {}) {
    let query = `
      SELECT s.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             e.name as enterprise_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} s
      LEFT JOIN animals a ON s.reference_type = 'animal' AND s.reference_id = a.id
      LEFT JOIN animal_groups ag ON s.reference_type = 'animal_group' AND s.reference_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN enterprises e ON s.enterprise_id = e.id
      LEFT JOIN users u ON s.recorded_by = u.id
      WHERE s.reference_type IN ('animal', 'animal_group')
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.animal_id) {
      query += ` AND s.reference_type = 'animal' AND s.reference_id = $${paramIndex++}`;
      values.push(filters.animal_id);
    }

    if (filters.animal_group_id) {
      query += ` AND s.reference_type = 'animal_group' AND s.reference_id = $${paramIndex++}`;
      values.push(filters.animal_group_id);
    }

    if (filters.start_date) {
      query += ` AND s.sale_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND s.sale_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND at.id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    if (filters.payment_status) {
      query += ` AND s.payment_status = $${paramIndex++}`;
      values.push(filters.payment_status);
    }

    if (filters.customer_name) {
      query += ` AND s.customer_name ILIKE $${paramIndex++}`;
      values.push(`%${filters.customer_name}%`);
    }

    query += ' ORDER BY s.sale_date DESC, s.created_at DESC';

    return await this.db.any(query, values);
  }

  /**
   * Find sale by ID with details
   * @param {number} id - Sale ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithDetails(id) {
    const query = `
      SELECT s.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             ag.group_code,
             ab.name as breed_name,
             at.name as animal_type_name,
             e.name as enterprise_name,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM ${this.tableName} s
      LEFT JOIN animals a ON s.reference_type = 'animal' AND s.reference_id = a.id
      LEFT JOIN animal_groups ag ON s.reference_type = 'animal_group' AND s.reference_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      LEFT JOIN enterprises e ON s.enterprise_id = e.id
      LEFT JOIN users u ON s.recorded_by = u.id
      WHERE s.id = $1 AND s.reference_type IN ('animal', 'animal_group')
    `;
    return await this.db.oneOrNone(query, [id]);
  }

  /**
   * Get animal sales statistics
   * @param {Object} filters - Optional filters (date range, animal type)
   * @returns {Promise<Object>}
   */
  async getStatistics(filters = {}) {
    let query = `
      SELECT
        COUNT(*) as total_sales,
        COALESCE(SUM(s.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(AVG(s.unit_price), 0) as avg_unit_price,
        COUNT(*) FILTER (WHERE s.payment_status = 'paid') as paid_count,
        COUNT(*) FILTER (WHERE s.payment_status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE s.payment_status = 'partial') as partial_count,
        COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_status = 'paid'), 0) as paid_revenue,
        COALESCE(SUM(s.total_amount) FILTER (WHERE s.payment_status = 'pending'), 0) as pending_revenue
      FROM ${this.tableName} s
      LEFT JOIN animals a ON s.reference_type = 'animal' AND s.reference_id = a.id
      LEFT JOIN animal_groups ag ON s.reference_type = 'animal_group' AND s.reference_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      WHERE s.reference_type IN ('animal', 'animal_group')
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND s.sale_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND s.sale_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    if (filters.animal_type_id) {
      query += ` AND ab.animal_type_id = $${paramIndex++}`;
      values.push(filters.animal_type_id);
    }

    return await this.db.one(query, values);
  }

  /**
   * Get sales by animal type
   * @param {Object} filters - Optional filters (date range)
   * @returns {Promise<Array>}
   */
  async getSalesByAnimalType(filters = {}) {
    let query = `
      SELECT
        at.name as animal_type_name,
        at.id as animal_type_id,
        COUNT(*) as sale_count,
        COALESCE(SUM(s.quantity), 0) as total_quantity,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(AVG(s.unit_price), 0) as avg_unit_price
      FROM ${this.tableName} s
      LEFT JOIN animals a ON s.reference_type = 'animal' AND s.reference_id = a.id
      LEFT JOIN animal_groups ag ON s.reference_type = 'animal_group' AND s.reference_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE s.reference_type IN ('animal', 'animal_group')
        AND at.id IS NOT NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND s.sale_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND s.sale_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY at.id, at.name ORDER BY total_revenue DESC';

    return await this.db.any(query, values);
  }

  /**
   * Get monthly sales summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getMonthlySales(filters = {}) {
    let query = `
      SELECT
        DATE_TRUNC('month', s.sale_date) as month,
        COUNT(*) as sale_count,
        COALESCE(SUM(s.quantity), 0) as total_quantity,
        COALESCE(SUM(s.total_amount), 0) as total_revenue
      FROM ${this.tableName} s
      WHERE s.reference_type IN ('animal', 'animal_group')
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND s.sale_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND s.sale_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY month ORDER BY month DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      values.push(filters.limit);
    }

    return await this.db.any(query, values);
  }

  /**
   * Get top customers
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getTopCustomers(filters = {}) {
    let query = `
      SELECT
        s.customer_name,
        COUNT(*) as purchase_count,
        COALESCE(SUM(s.quantity), 0) as total_quantity,
        COALESCE(SUM(s.total_amount), 0) as total_spent
      FROM ${this.tableName} s
      WHERE s.reference_type IN ('animal', 'animal_group')
        AND s.customer_name IS NOT NULL
    `;

    const values = [];
    let paramIndex = 1;

    if (filters.start_date) {
      query += ` AND s.sale_date >= $${paramIndex++}`;
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND s.sale_date <= $${paramIndex++}`;
      values.push(filters.end_date);
    }

    query += ' GROUP BY s.customer_name ORDER BY total_spent DESC';

    const limit = filters.limit || 10;
    query += ` LIMIT $${paramIndex++}`;
    values.push(limit);

    return await this.db.any(query, values);
  }

  /**
   * Get recent sales
   * @param {number} days - Number of days to look back
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getRecentSales(days = 30, limit = 10) {
    const query = `
      SELECT s.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             at.name as animal_type_name
      FROM ${this.tableName} s
      LEFT JOIN animals a ON s.reference_type = 'animal' AND s.reference_id = a.id
      LEFT JOIN animal_groups ag ON s.reference_type = 'animal_group' AND s.reference_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE s.reference_type IN ('animal', 'animal_group')
        AND s.sale_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY s.sale_date DESC, s.created_at DESC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }

  /**
   * Get pending payment sales
   * @param {number} limit - Maximum records
   * @returns {Promise<Array>}
   */
  async getPendingPayments(limit = 20) {
    const query = `
      SELECT s.*,
             a.tag_number as animal_tag,
             a.name as animal_name,
             ag.name as group_name,
             at.name as animal_type_name
      FROM ${this.tableName} s
      LEFT JOIN animals a ON s.reference_type = 'animal' AND s.reference_id = a.id
      LEFT JOIN animal_groups ag ON s.reference_type = 'animal_group' AND s.reference_id = ag.id
      LEFT JOIN animal_breeds ab ON COALESCE(a.animal_breed_id, ag.animal_breed_id) = ab.id
      LEFT JOIN animal_types at ON ab.animal_type_id = at.id
      WHERE s.reference_type IN ('animal', 'animal_group')
        AND s.payment_status IN ('pending', 'partial')
      ORDER BY s.sale_date ASC
      LIMIT $1
    `;
    return await this.db.any(query, [limit]);
  }
}

module.exports = new AnimalSaleRepository();
