const BaseRepository = require('./base.repository');
const { ValidationError } = require('../utils/errors');
const { toPagination } = require('../utils/sql');

// Detail tables that link to their activity through activity_id
const DETAIL_TABLES = [
  'crop_input_applications',
  'growth_observations',
  'harvests',
  'crop_pests_diseases',
  'animal_feed_records',
  'animal_health_records',
  'animal_diseases_treatments',
  'animal_production_records',
];

const ON_DATE = 'COALESCE(a.occurred_on, a.planned_for)';
const TIMELINE_SORTS = {
  date: ON_DATE,
  activity_type: 'a.activity_type',
  title: 'a.title',
  status: 'a.status',
  created_at: 'a.created_at',
};
const EQUALITY_FILTERS = [
  'enterprise_id',
  'crop_batch_id',
  'animal_id',
  'animal_group_id',
  'performed_by',
  'task_id',
  'status',
];

/**
 * Repository for activities: one row per operational event (ADR-001)
 */
class ActivityRepository extends BaseRepository {
  constructor() {
    super('activities', {
      columns: [
        'activity_type',
        'status',
        'title',
        'planned_for',
        'occurred_on',
        'enterprise_id',
        'location_id',
        'crop_batch_id',
        'animal_id',
        'animal_group_id',
        'performed_by',
        'recorded_by',
        'labour_hours',
        'input_cost',
        'other_cost',
        'task_id',
        'client_request_id',
        'notes',
      ],
      sortable: ['occurred_on', 'planned_for', 'created_at'],
    });
  }

  /**
   * Find the activity recorded for an offline request, deleted or not
   * @param {string} clientRequestId - UUID sent by the client
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>}
   */
  async findByClientRequestId(clientRequestId, t) {
    return this.conn(t).oneOrNone('SELECT * FROM activities WHERE client_request_id = $1', [clientRequestId]);
  }

  /**
   * The location of a crop batch, copied onto its activities
   * @param {number} batchId - Crop batch ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<number|null>}
   */
  async batchLocationId(batchId, t) {
    const row = await this.conn(t).oneOrNone('SELECT location_id FROM crop_batches WHERE id = $1', [batchId]);
    return row ? row.location_id : null;
  }

  /**
   * The employee record of a user, if they have one
   * @param {number} userId - User ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<number|null>} Employee ID
   */
  async employeeIdForUser(userId, t) {
    const row = await this.conn(t).oneOrNone(
      `SELECT id FROM employees WHERE user_id = $1 ORDER BY deleted_at NULLS FIRST, id LIMIT 1`,
      [userId]
    );
    return row ? row.id : null;
  }

  /**
   * Total cost of the live doses given under a treatment
   * @param {number} treatmentId - Disease/treatment record ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<number|null>} Null when no dose has a cost
   */
  async treatmentMedicationCost(treatmentId, t) {
    const { total } = await this.conn(t).one(
      'SELECT SUM(total_cost) AS total FROM treatment_medications WHERE treatment_id = $1 AND deleted_at IS NULL',
      [treatmentId]
    );
    return total;
  }

  /**
   * Name and unit of a production type
   * @param {number} typeId - Production type ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>}
   */
  async productionType(typeId, t) {
    return this.conn(t).oneOrNone('SELECT name, unit FROM animal_production_types WHERE id = $1', [typeId]);
  }

  /**
   * The farm timeline: live activities, newest first, with the names of
   * their subject, enterprise and people
   * @param {number} page - Page number
   * @param {number} limit - Page size
   * @param {Object} [filters] - enterprise_id, crop_batch_id, animal_id, animal_group_id,
   *   performed_by, task_id, status, activity_type (one or an array), date_from, date_to, search
   * @param {Object} [sort] - { field, order }; field from TIMELINE_SORTS, default date
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async paginateTimeline(page = 1, limit = 20, filters = {}, sort = {}) {
    const { page: safePage, limit: safeLimit, offset } = toPagination(page, limit);

    const field = sort.field || 'date';
    if (!Object.hasOwn(TIMELINE_SORTS, field)) {
      throw new ValidationError(`Cannot sort by: ${field}`);
    }
    const direction = String(sort.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions = ['a.deleted_at IS NULL'];
    const params = [];
    const param = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    for (const column of EQUALITY_FILTERS) {
      if (filters[column] !== undefined && filters[column] !== null && filters[column] !== '') {
        conditions.push(`a.${column} = ${param(filters[column])}`);
      }
    }
    if (filters.activity_type) {
      const types = [].concat(filters.activity_type);
      conditions.push(`a.activity_type = ANY(${param(types)}::text[])`);
    }
    if (filters.date_from) conditions.push(`${ON_DATE} >= ${param(filters.date_from)}::date`);
    if (filters.date_to) conditions.push(`${ON_DATE} <= ${param(filters.date_to)}::date`);
    if (filters.search) conditions.push(`a.title ILIKE ${param(`%${filters.search}%`)}`);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const paging = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [data, { total }] = await Promise.all([
      this.db.any(
        `SELECT a.*,
                ${ON_DATE} AS activity_date,
                cb.batch_code AS crop_batch_code,
                an.tag_number AS animal_tag_number,
                an.name AS animal_name,
                ag.name AS animal_group_name,
                en.name AS enterprise_name,
                gl.name AS location_name,
                NULLIF(TRIM(CONCAT(em.first_name, ' ', em.last_name)), '') AS performed_by_name,
                NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), '') AS recorded_by_name
           FROM activities a
           LEFT JOIN crop_batches cb ON cb.id = a.crop_batch_id
           LEFT JOIN animals an ON an.id = a.animal_id
           LEFT JOIN animal_groups ag ON ag.id = a.animal_group_id
           LEFT JOIN enterprises en ON en.id = a.enterprise_id
           LEFT JOIN growing_locations gl ON gl.id = a.location_id
           LEFT JOIN employees em ON em.id = a.performed_by
           LEFT JOIN users u ON u.id = a.recorded_by
           ${where}
          ORDER BY ${TIMELINE_SORTS[field]} ${direction} NULLS LAST, a.id ${direction}
          ${paging}`,
        [...params, safeLimit, offset]
      ),
      this.db.one(`SELECT COUNT(*)::int AS total FROM activities a ${where}`, params),
    ]);

    return {
      data,
      pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }
}

module.exports = new ActivityRepository();
module.exports.DETAIL_TABLES = DETAIL_TABLES;
