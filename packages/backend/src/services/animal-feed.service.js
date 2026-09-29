const animalFeedRecordRepository = require('../repositories/animal-feed-record.repository');
const animalRepository = require('../repositories/animal.repository');
const animalGroupRepository = require('../repositories/animal-group.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for animal feed records and feed statistics
 */
class AnimalFeedService {
  // ==================== FEED RECORDS ====================

  /**
   * Get all feed records with optional filters
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllFeedRecords(filters = {}) {
    return await animalFeedRecordRepository.findAllWithDetails(filters);
  }

  /**
   * Get feed record by ID
   * @param {number} id - Feed record ID
   * @returns {Promise<Object>}
   */
  async getFeedRecordById(id) {
    const record = await animalFeedRecordRepository.findByIdWithDetails(id);
    if (!record) {
      throw new NotFoundError('Feed record not found');
    }
    return record;
  }

  /**
   * Get feed records for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async getFeedRecordsByAnimal(animalId) {
    return await animalFeedRecordRepository.findByAnimalId(animalId);
  }

  /**
   * Get feed records for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getFeedRecordsByGroup(groupId) {
    return await animalFeedRecordRepository.findByGroupId(groupId);
  }

  /**
   * Create a feed record
   * @param {Object} data - Feed record data
   * @returns {Promise<Object>}
   */
  async createFeedRecord(data) {
    if (!data.animal_id && !data.animal_group_id) {
      throw new ValidationError('Either animal_id or animal_group_id is required');
    }

    if (data.animal_id && data.animal_group_id) {
      throw new ValidationError('Cannot specify both animal_id and animal_group_id');
    }

    // Verify animal or group exists
    if (data.animal_id) {
      const animal = await animalRepository.findById(data.animal_id);
      if (!animal) {
        throw new NotFoundError('Animal not found');
      }
    }

    if (data.animal_group_id) {
      const group = await animalGroupRepository.findById(data.animal_group_id);
      if (!group) {
        throw new NotFoundError('Animal group not found');
      }
    }

    // Calculate total_cost if not provided
    if (!data.total_cost && data.quantity && data.cost_per_unit) {
      data.total_cost = data.quantity * data.cost_per_unit;
    }

    return await animalFeedRecordRepository.create(data);
  }

  /**
   * Update a feed record
   * @param {number} id - Feed record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateFeedRecord(id, data) {
    const record = await animalFeedRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Feed record not found');
    }

    // Recalculate total_cost if quantity or cost_per_unit changed
    if (data.quantity || data.cost_per_unit) {
      const quantity = data.quantity || record.quantity;
      const costPerUnit = data.cost_per_unit || record.cost_per_unit;
      data.total_cost = quantity * costPerUnit;
    }

    return await animalFeedRecordRepository.update(id, data);
  }

  /**
   * Delete a feed record
   * @param {number} id - Feed record ID
   * @returns {Promise<void>}
   */
  async deleteFeedRecord(id) {
    const record = await animalFeedRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Feed record not found');
    }
    await animalFeedRecordRepository.softDelete(id);
  }

  /**
   * Get feed consumption statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getFeedStatistics(filters = {}) {
    return await animalFeedRecordRepository.getStatistics(filters);
  }

  /**
   * Get consumption by feed type
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getConsumptionByFeedType(filters = {}) {
    return await animalFeedRecordRepository.getConsumptionByFeedType(filters);
  }

  /**
   * Get daily consumption
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getDailyFeedConsumption(filters = {}) {
    return await animalFeedRecordRepository.getDailyConsumption(filters);
  }

  /**
   * Get feed cost by animal type
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getFeedCostByAnimalType(filters = {}) {
    return await animalFeedRecordRepository.getCostByAnimalType(filters);
  }

  /**
   * Get average daily feed cost
   * @param {number} animalId - Animal ID
   * @param {number} groupId - Group ID
   * @param {number} days - Days to calculate
   * @returns {Promise<Object>}
   */
  async getAverageDailyFeedCost(animalId = null, groupId = null, days = 30) {
    return await animalFeedRecordRepository.getAverageDailyCost(animalId, groupId, days);
  }
}

module.exports = new AnimalFeedService();
