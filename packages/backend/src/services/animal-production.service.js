const animalProductionRepository = require('../repositories/animal-production.repository');
const { AppError, ConflictError, NotFoundError, ValidationError } = require('../utils/errors');

class AnimalProductionService {
  // ==================== PRODUCTION TYPES ====================

  async getAllProductionTypes(filters = {}) {
    return animalProductionRepository.findAllProductionTypes(filters);
  }

  async getProductionTypeById(id) {
    const type = await animalProductionRepository.findProductionTypeById(id);
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

  async getProductionRecordById(id) {
    const record = await animalProductionRepository.findProductionRecordById(id);
    if (!record) {
      throw new NotFoundError('Production record not found');
    }
    return record;
  }

  async createProductionRecord(data, userId) {
    // Validate that either animal_id or animal_group_id is provided
    if (!data.animal_id && !data.animal_group_id) {
      throw new ValidationError('Either animal or animal group must be specified');
    }

    if (data.animal_id && data.animal_group_id) {
      throw new ValidationError('Cannot specify both animal and animal group');
    }

    await this.getProductionTypeById(data.production_type_id);

    // Set recorded_by
    data.recorded_by = userId;

    return animalProductionRepository.createProductionRecord(data);
  }

  async updateProductionRecord(id, data) {
    await this.getProductionRecordById(id);
    return animalProductionRepository.updateProductionRecord(id, data);
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
