const animalProductionRepository = require('../repositories/animal-production.repository');
const withdrawalService = require('./withdrawal.service');
const { db } = require('../config/database');
const { toDateString } = require('../utils/dates');
const { AppError, ConflictError, NotFoundError, ValidationError } = require('../utils/errors');

class AnimalProductionService {
  // ==================== PRODUCTION TYPES ====================

  async getAllProductionTypes(filters = {}) {
    return animalProductionRepository.findAllProductionTypes(filters);
  }

  async getProductionTypeById(id, t) {
    const type = await animalProductionRepository.findProductionTypeById(id, t);
    if (!type) {
      throw new NotFoundError('Production type not found');
    }
    return type;
  }

  async createProductionType(data) {
    return animalProductionRepository.createProductionType(data);
  }

  async updateProductionType(id, data) {
    await this.getProductionTypeById(id);
    return animalProductionRepository.updateProductionType(id, data);
  }

  async deleteProductionType(id) {
    await this.getProductionTypeById(id);
    if (await animalProductionRepository.productionTypeInUse(id)) {
      throw new ConflictError('Cannot delete a production type that has records', 'IN_USE');
    }
    const result = await animalProductionRepository.deleteProductionType(id);
    if (result.rowCount === 0) {
      throw new AppError('Failed to delete production type', 500, 'SERVER_ERROR');
    }
    return { message: 'Production type deleted successfully' };
  }

  // ==================== PRODUCTION RECORDS ====================

  async getAllProductionRecords(filters = {}) {
    return animalProductionRepository.findAllProductionRecords(filters);
  }

  async getProductionRecordById(id, t) {
    const record = await animalProductionRepository.findProductionRecordById(id, t);
    if (!record) {
      throw new NotFoundError('Production record not found');
    }
    return record;
  }

  /**
   * Record milk, eggs, meat or other produce. Milk, eggs or meat from an
   * animal or group inside a withdrawal period is refused (409
   * WITHDRAWAL_ACTIVE) unless the owner gives an override_reason.
   * @param {Object} data - Production record data, with optional override_reason
   * @param {Object} user - { id, role }
   * @returns {Promise<Object>}
   */
  async createProductionRecord(data, user) {
    // Validate that either animal_id or animal_group_id is provided
    if (!data.animal_id && !data.animal_group_id) {
      throw new ValidationError('Either animal or animal group must be specified');
    }

    if (data.animal_id && data.animal_group_id) {
      throw new ValidationError('Cannot specify both animal and animal group');
    }

    return db.tx(async (tx) => {
      const type = await this.getProductionTypeById(data.production_type_id, tx);
      const override = await withdrawalService.checkProduction(
        data,
        type.category,
        { user, override_reason: data.override_reason },
        tx
      );
      return animalProductionRepository.createProductionRecord(
        { ...withdrawalService.withoutOverride(data), ...override, recorded_by: user && user.id },
        tx
      );
    });
  }

  /**
   * Update a production record. Moving it to another date or type checks the
   * withdrawal periods again, as for a new record.
   * @param {number} id - Production record ID
   * @param {Object} data - Changes, with optional override_reason
   * @param {Object} user - { id, role }
   * @returns {Promise<Object>}
   */
  async updateProductionRecord(id, data, user) {
    return db.tx(async (tx) => {
      const record = await this.getProductionRecordById(id, tx);
      const changes = withdrawalService.withoutOverride(data);

      const date = changes.production_date ? toDateString(changes.production_date) : record.production_date;
      const typeId = changes.production_type_id ? Number(changes.production_type_id) : record.production_type_id;
      if (date !== record.production_date || typeId !== record.production_type_id) {
        const type = await this.getProductionTypeById(typeId, tx);
        const override = await withdrawalService.checkProduction(
          { animal_id: record.animal_id, animal_group_id: record.animal_group_id, production_date: date },
          type.category,
          { user, override_reason: data.override_reason },
          tx
        );
        Object.assign(changes, override);
      }

      return animalProductionRepository.updateProductionRecord(record.id, changes, tx);
    });
  }

  async deleteProductionRecord(id) {
    await this.getProductionRecordById(id);
    const result = await animalProductionRepository.deleteProductionRecord(id);
    if (result.rowCount === 0) {
      throw new AppError('Failed to delete production record', 500, 'SERVER_ERROR');
    }
    return { message: 'Production record deleted successfully' };
  }

  // ==================== STATISTICS ====================

  async getProductionStatistics(filters = {}) {
    return animalProductionRepository.getProductionStatistics(filters);
  }

  async getDailyProductionSummary(filters = {}) {
    return animalProductionRepository.getDailyProductionSummary(filters);
  }

  async getProductionBySource(filters = {}) {
    return animalProductionRepository.getProductionBySource(filters);
  }
}

module.exports = new AnimalProductionService();
