const enterpriseRepository = require('../repositories/enterprise.repository');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');

/**
 * Service for enterprises: the lines of business the farm costs on their
 * own. Crop batches, animals and animal groups belong to one, and their
 * activities are costed to it (ADR-001).
 */
class EnterpriseService {
  /**
   * List enterprises
   * @param {number} page - Page number
   * @param {number} limit - Page size
   * @param {Object} [filters] - enterprise_type, is_active
   * @param {Object} [sort] - { field, order }; field: name, enterprise_type or created_at
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async getAll(page, limit, filters = {}, sort = {}) {
    return enterpriseRepository.paginate(page, limit, filters, {
      field: sort.field || 'name',
      order: sort.order || 'asc',
    });
  }

  /**
   * Get an enterprise with its counts of batches, animals, groups and activities
   * @param {number} id - Enterprise ID
   * @returns {Promise<Object>}
   * @throws {NotFoundError}
   */
  async getById(id) {
    const enterprise = await enterpriseRepository.findByIdWithCounts(id);
    if (!enterprise) {
      throw new NotFoundError('Enterprise not found');
    }
    return enterprise;
  }

  /**
   * Create an enterprise
   * @param {Object} data - Enterprise fields
   * @returns {Promise<Object>} Created enterprise
   * @throws {ConflictError} DUPLICATE when the name is taken
   */
  async create(data) {
    await this.assertNameFree(data.name);
    return enterpriseRepository.create({ ...data, name: data.name.trim() });
  }

  /**
   * Update an enterprise
   * @param {number} id - Enterprise ID
   * @param {Object} data - Changed fields
   * @returns {Promise<Object>} Updated enterprise
   * @throws {NotFoundError|ConflictError}
   */
  async update(id, data) {
    const enterprise = await this.findLive(id);
    if (data.name) {
      await this.assertNameFree(data.name, enterprise.id);
      data = { ...data, name: data.name.trim() };
    }
    return enterpriseRepository.update(enterprise.id, data);
  }

  /**
   * Delete an enterprise nothing refers to (deactivate it otherwise)
   * @param {number} id - Enterprise ID
   * @throws {NotFoundError|ConflictError} IN_USE
   */
  async delete(id) {
    const enterprise = await this.findLive(id);
    if (await enterpriseRepository.isInUse(enterprise.id)) {
      throw new ConflictError(
        'Types, batches, animals, groups or records still refer to this enterprise; deactivate it instead',
        'IN_USE'
      );
    }
    await enterpriseRepository.softDelete(enterprise.id);
  }

  /**
   * Check that a type or subject may be put under an enterprise
   * @param {number|null|undefined} id - Enterprise ID; null or undefined pass
   * @param {Object} [t] - Task/transaction
   * @throws {NotFoundError|ValidationError} When it is missing or inactive
   */
  async assertAssignable(id, t) {
    if (id === null || id === undefined) return;
    const enterprise = await this.findLive(id, t);
    if (!enterprise.is_active) {
      throw new ValidationError(`Enterprise "${enterprise.name}" is inactive`);
    }
  }

  /**
   * The enterprise a new batch, animal or group belongs to: the one given,
   * otherwise its type's default while that enterprise is live and active
   * @param {Object} data - The new subject's fields
   * @param {number|null} typeEnterpriseId - The crop or animal type's default
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<number|null>}
   * @throws {NotFoundError|ValidationError} When the given enterprise cannot be used
   */
  async forNewSubject(data, typeEnterpriseId, t) {
    if (data.enterprise_id !== undefined) {
      await this.assertAssignable(data.enterprise_id, t);
      return data.enterprise_id;
    }
    if (!typeEnterpriseId) return null;
    const enterprise = await enterpriseRepository.findById(typeEnterpriseId, t);
    return enterprise && enterprise.is_active ? enterprise.id : null;
  }

  /**
   * After a subject gains an enterprise, cost its activities that have none to it
   * @param {Object} t - Transaction
   * @param {string} subjectTable - crop_batches, animals or animal_groups
   * @param {Object} subject - The saved batch, animal or group
   */
  async subjectSaved(t, subjectTable, subject) {
    if (subject.enterprise_id) {
      await enterpriseRepository.fillSubjectActivities(subjectTable, subject.id, subject.enterprise_id, t);
    }
  }

  /**
   * @private
   */
  async findLive(id, t) {
    const enterprise = await enterpriseRepository.findById(id, t);
    if (!enterprise) {
      throw new NotFoundError('Enterprise not found');
    }
    return enterprise;
  }

  /**
   * @private
   */
  async assertNameFree(name, exceptId) {
    const existing = await enterpriseRepository.findByName(name);
    if (existing && existing.id !== exceptId) {
      throw new ConflictError('An enterprise with this name already exists', 'DUPLICATE');
    }
  }
}

module.exports = new EnterpriseService();
