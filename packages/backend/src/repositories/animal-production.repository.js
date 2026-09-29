const { db } = require('../config/database');

class AnimalProductionRepository {
  // ==================== PRODUCTION TYPES ====================

  async findAllProductionTypes(filters = {}) {
    let query = `
      SELECT * FROM animal_production_types
      WHERE 1=1
    `;
    const params = [];

    if (filters.category) {
      params.push(filters.category);
      query += ` AND category = $${params.length}`;
    }

    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND is_active = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    query += ' ORDER BY category, name';

    return db.any(query, params);
  }

  async findProductionTypeById(id) {
    return db.oneOrNone('SELECT * FROM animal_production_types WHERE id = $1', [id]);
  }

  async createProductionType(data) {
    const columns = ['name', 'category', 'unit', 'description', 'is_active'];
    const values = columns.map(col => data[col]);
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    return db.one(
      `INSERT INTO animal_production_types (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
  }

  async updateProductionType(id, data) {
    const allowedFields = ['name', 'category', 'unit', 'description', 'is_active'];
    const updates = [];
    const values = [];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        values.push(data[field]);
        updates.push(`${field} = $${values.length}`);
      }
    });

    if (updates.length === 0) return this.findProductionTypeById(id);

    values.push(id);
    return db.one(
      `UPDATE animal_production_types SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
  }

  async deleteProductionType(id) {
    return db.result('DELETE FROM animal_production_types WHERE id = $1', [id]);
  }

  // ==================== PRODUCTION RECORDS ====================

  async findAllProductionRecords(filters = {}) {
    let query = `
      SELECT
        pr.*,
        pt.name as production_type_name,
        pt.category as production_category,
        pt.unit as production_unit,
        a.tag_number as animal_tag,
        a.name as animal_name,
        ag.name as group_name,
        ag.group_code,
        u.first_name || ' ' || u.last_name as recorded_by_name
      FROM animal_production_records pr
      JOIN animal_production_types pt ON pr.production_type_id = pt.id
      LEFT JOIN animals a ON pr.animal_id = a.id
      LEFT JOIN animal_groups ag ON pr.animal_group_id = ag.id
      LEFT JOIN users u ON pr.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.production_type_id) {
      params.push(filters.production_type_id);
      query += ` AND pr.production_type_id = $${params.length}`;
    }

    if (filters.category) {
      params.push(filters.category);
      query += ` AND pt.category = $${params.length}`;
    }

    if (filters.animal_id) {
      params.push(filters.animal_id);
      query += ` AND pr.animal_id = $${params.length}`;
    }

    if (filters.animal_group_id) {
      params.push(filters.animal_group_id);
      query += ` AND pr.animal_group_id = $${params.length}`;
    }

    if (filters.date_from) {
      params.push(filters.date_from);
      query += ` AND pr.production_date >= $${params.length}`;
    }

    if (filters.date_to) {
      params.push(filters.date_to);
      query += ` AND pr.production_date <= $${params.length}`;
    }

    if (filters.quality_grade) {
      params.push(filters.quality_grade);
      query += ` AND pr.quality_grade = $${params.length}`;
    }

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    query += ' ORDER BY pr.production_date DESC, pr.created_at DESC';
    query += ` LIMIT ${limit} OFFSET ${offset}`;

    const records = await db.any(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM animal_production_records pr
      JOIN animal_production_types pt ON pr.production_type_id = pt.id
      WHERE 1=1
    `;
    const countParams = [];

    if (filters.production_type_id) {
      countParams.push(filters.production_type_id);
      countQuery += ` AND pr.production_type_id = $${countParams.length}`;
    }

    if (filters.category) {
      countParams.push(filters.category);
      countQuery += ` AND pt.category = $${countParams.length}`;
    }

    if (filters.animal_id) {
      countParams.push(filters.animal_id);
      countQuery += ` AND pr.animal_id = $${countParams.length}`;
    }

    if (filters.animal_group_id) {
      countParams.push(filters.animal_group_id);
      countQuery += ` AND pr.animal_group_id = $${countParams.length}`;
    }

    if (filters.date_from) {
      countParams.push(filters.date_from);
      countQuery += ` AND pr.production_date >= $${countParams.length}`;
    }

    if (filters.date_to) {
      countParams.push(filters.date_to);
      countQuery += ` AND pr.production_date <= $${countParams.length}`;
    }

    const { total } = await db.one(countQuery, countParams);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findProductionRecordById(id) {
    return db.oneOrNone(`
      SELECT
        pr.*,
        pt.name as production_type_name,
        pt.category as production_category,
        pt.unit as production_unit,
        a.tag_number as animal_tag,
        a.name as animal_name,
        ag.name as group_name,
        ag.group_code,
        u.first_name || ' ' || u.last_name as recorded_by_name
      FROM animal_production_records pr
      JOIN animal_production_types pt ON pr.production_type_id = pt.id
      LEFT JOIN animals a ON pr.animal_id = a.id
      LEFT JOIN animal_groups ag ON pr.animal_group_id = ag.id
      LEFT JOIN users u ON pr.recorded_by = u.id
      WHERE pr.id = $1
    `, [id]);
  }

  async createProductionRecord(data) {
    const columns = [
      'production_type_id', 'animal_id', 'animal_group_id', 'production_date',
      'quantity', 'quality_grade', 'unit_price', 'notes', 'recorded_by'
    ];
    const values = [];
    const placeholders = [];

    columns.forEach((col) => {
      if (data[col] !== undefined) {
        values.push(data[col]);
        placeholders.push(`$${values.length}`);
      } else {
        placeholders.push('NULL');
      }
    });

    // Build the query with only non-null values
    const insertColumns = [];
    const insertPlaceholders = [];
    const insertValues = [];

    columns.forEach(col => {
      if (data[col] !== undefined && data[col] !== null) {
        insertColumns.push(col);
        insertValues.push(data[col]);
        insertPlaceholders.push(`$${insertValues.length}`);
      }
    });

    return db.one(
      `INSERT INTO animal_production_records (${insertColumns.join(', ')})
       VALUES (${insertPlaceholders.join(', ')})
       RETURNING *`,
      insertValues
    );
  }

  async updateProductionRecord(id, data) {
    const allowedFields = [
      'production_type_id', 'production_date', 'quantity',
      'quality_grade', 'unit_price', 'notes'
    ];
    const updates = [];
    const values = [];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        values.push(data[field]);
        updates.push(`${field} = $${values.length}`);
      }
    });

    if (updates.length === 0) return this.findProductionRecordById(id);

    values.push(id);
    return db.one(
      `UPDATE animal_production_records SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
  }

  async deleteProductionRecord(id) {
    return db.result('DELETE FROM animal_production_records WHERE id = $1', [id]);
  }

  // ==================== STATISTICS ====================

  async getProductionStatistics(filters = {}) {
    let baseWhere = '1=1';
    const params = [];

    if (filters.date_from) {
      params.push(filters.date_from);
      baseWhere += ` AND pr.production_date >= $${params.length}`;
    }

    if (filters.date_to) {
      params.push(filters.date_to);
      baseWhere += ` AND pr.production_date <= $${params.length}`;
    }

    if (filters.category) {
      params.push(filters.category);
      baseWhere += ` AND pt.category = $${params.length}`;
    }

    const query = `
      SELECT
        pt.category,
        pt.name as production_type,
        pt.unit,
        COUNT(pr.id) as record_count,
        SUM(pr.quantity) as total_quantity,
        AVG(pr.quantity) as avg_quantity,
        SUM(pr.total_value) as total_value
      FROM animal_production_records pr
      JOIN animal_production_types pt ON pr.production_type_id = pt.id
      WHERE ${baseWhere}
      GROUP BY pt.category, pt.name, pt.unit
      ORDER BY pt.category, total_quantity DESC
    `;

    return db.any(query, params);
  }

  async getDailyProductionSummary(filters = {}) {
    let baseWhere = '1=1';
    const params = [];

    if (filters.date_from) {
      params.push(filters.date_from);
      baseWhere += ` AND pr.production_date >= $${params.length}`;
    }

    if (filters.date_to) {
      params.push(filters.date_to);
      baseWhere += ` AND pr.production_date <= $${params.length}`;
    }

    if (filters.production_type_id) {
      params.push(filters.production_type_id);
      baseWhere += ` AND pr.production_type_id = $${params.length}`;
    }

    if (filters.category) {
      params.push(filters.category);
      baseWhere += ` AND pt.category = $${params.length}`;
    }

    const query = `
      SELECT
        pr.production_date,
        pt.name as production_type,
        pt.unit,
        SUM(pr.quantity) as total_quantity,
        SUM(pr.total_value) as total_value,
        COUNT(pr.id) as record_count
      FROM animal_production_records pr
      JOIN animal_production_types pt ON pr.production_type_id = pt.id
      WHERE ${baseWhere}
      GROUP BY pr.production_date, pt.name, pt.unit
      ORDER BY pr.production_date DESC
      LIMIT 90
    `;

    return db.any(query, params);
  }

  async getProductionBySource(filters = {}) {
    let baseWhere = '1=1';
    const params = [];

    if (filters.date_from) {
      params.push(filters.date_from);
      baseWhere += ` AND pr.production_date >= $${params.length}`;
    }

    if (filters.date_to) {
      params.push(filters.date_to);
      baseWhere += ` AND pr.production_date <= $${params.length}`;
    }

    if (filters.production_type_id) {
      params.push(filters.production_type_id);
      baseWhere += ` AND pr.production_type_id = $${params.length}`;
    }

    const query = `
      SELECT
        COALESCE(a.tag_number, ag.group_code) as source_code,
        COALESCE(a.name, ag.name) as source_name,
        CASE WHEN a.id IS NOT NULL THEN 'individual' ELSE 'group' END as source_type,
        pt.name as production_type,
        pt.unit,
        SUM(pr.quantity) as total_quantity,
        AVG(pr.quantity) as avg_quantity,
        COUNT(pr.id) as record_count,
        SUM(pr.total_value) as total_value
      FROM animal_production_records pr
      JOIN animal_production_types pt ON pr.production_type_id = pt.id
      LEFT JOIN animals a ON pr.animal_id = a.id
      LEFT JOIN animal_groups ag ON pr.animal_group_id = ag.id
      WHERE ${baseWhere}
      GROUP BY
        COALESCE(a.tag_number, ag.group_code),
        COALESCE(a.name, ag.name),
        CASE WHEN a.id IS NOT NULL THEN 'individual' ELSE 'group' END,
        pt.name, pt.unit
      ORDER BY total_quantity DESC
    `;

    return db.any(query, params);
  }
}

module.exports = new AnimalProductionRepository();
