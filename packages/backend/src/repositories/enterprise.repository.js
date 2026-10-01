const BaseRepository = require('./base.repository');
const { AppError } = require('../utils/errors');

// Subject tables, and the activities column that names each subject
const SUBJECT_ACTIVITY_COLUMNS = {
  crop_batches: 'crop_batch_id',
  animals: 'animal_id',
  animal_groups: 'animal_group_id',
};

/**
 * Repository for enterprises. Names are unique ignoring case among live rows.
 */
class EnterpriseRepository extends BaseRepository {
  constructor() {
    super('enterprises', {
      columns: ['name', 'enterprise_type', 'unit_of_output', 'description', 'is_active'],
      sortable: ['name', 'enterprise_type', 'created_at'],
    });
  }

  /**
   * Find a live enterprise by name, ignoring case and surrounding spaces
   * @param {string} name - Enterprise name
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object|null>} Enterprise or null
   */
  async findByName(name, t) {
    return this.conn(t).oneOrNone(
      `SELECT * FROM ${this.tableName} WHERE LOWER(name) = LOWER(TRIM($1)) AND deleted_at IS NULL`,
      [name]
    );
  }

  /**
   * Find an enterprise with how many live batches, animals, groups and
   * activities belong to it
   * @param {number} id - Enterprise ID
   * @returns {Promise<Object|null>}
   */
  async findByIdWithCounts(id) {
    return this.db.oneOrNone(
      `SELECT e.*,
              (SELECT COUNT(*)::int FROM crop_batches WHERE enterprise_id = e.id AND deleted_at IS NULL)
                AS crop_batch_count,
              (SELECT COUNT(*)::int FROM animals WHERE enterprise_id = e.id AND deleted_at IS NULL) AS animal_count,
              (SELECT COUNT(*)::int FROM animal_groups WHERE enterprise_id = e.id AND deleted_at IS NULL)
                AS animal_group_count,
              (SELECT COUNT(*)::int FROM activities WHERE enterprise_id = e.id AND deleted_at IS NULL)
                AS activity_count
         FROM ${this.tableName} e
        WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    );
  }

  /**
   * Whether any live type, subject, activity, task, sale or transaction
   * refers to the enterprise
   * @param {number} id - Enterprise ID
   * @returns {Promise<boolean>}
   */
  async isInUse(id) {
    const tables = [
      'crop_types',
      'animal_types',
      'crop_batches',
      'animals',
      'animal_groups',
      'activities',
      'tasks',
      'sales',
      'financial_transactions',
    ];
    const { in_use: inUse } = await this.db.one(
      `SELECT ${tables
        .map((table) => `EXISTS (SELECT 1 FROM ${table} WHERE enterprise_id = $1 AND deleted_at IS NULL)`)
        .join(' OR ')} AS in_use`,
      [id]
    );
    return inUse;
  }

  /**
   * Give a subject's live activities that have no enterprise the subject's
   * one. Activities already costed to an enterprise keep it (ADR-001).
   * @param {string} subjectTable - crop_batches, animals or animal_groups
   * @param {number} subjectId - The batch, animal or group
   * @param {number} enterpriseId - Its enterprise
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<number>} How many activities were filled
   */
  async fillSubjectActivities(subjectTable, subjectId, enterpriseId, t) {
    const column = SUBJECT_ACTIVITY_COLUMNS[subjectTable];
    if (!column) {
      throw new AppError(`Not an enterprise subject: ${subjectTable}`, 500, 'SERVER_ERROR');
    }
    const result = await this.conn(t).result(
      `UPDATE activities SET enterprise_id = $3, updated_at = CURRENT_TIMESTAMP
        WHERE $1:name = $2 AND enterprise_id IS NULL AND deleted_at IS NULL`,
      [column, subjectId, enterpriseId]
    );
    return result.rowCount;
  }
}

module.exports = new EnterpriseRepository();
