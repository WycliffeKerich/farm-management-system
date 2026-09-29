const animalHealthRecordRepository = require('../repositories/animal-health-record.repository');
const animalDiseaseTreatmentRepository = require('../repositories/animal-disease-treatment.repository');
const animalRepository = require('../repositories/animal.repository');
const animalGroupRepository = require('../repositories/animal-group.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for animal health records, diseases and treatments
 */
class AnimalHealthService {
  // ==================== HEALTH RECORDS ====================

  /**
   * Get all health records with optional filters
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllHealthRecords(filters = {}) {
    return await animalHealthRecordRepository.findAllWithDetails(filters);
  }

  /**
   * Get health record by ID
   * @param {number} id - Health record ID
   * @returns {Promise<Object>}
   */
  async getHealthRecordById(id) {
    const record = await animalHealthRecordRepository.findByIdWithDetails(id);
    if (!record) {
      throw new NotFoundError('Health record not found');
    }
    return record;
  }

  /**
   * Get health records for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async getHealthRecordsByAnimal(animalId) {
    return await animalHealthRecordRepository.findByAnimalId(animalId);
  }

  /**
   * Get health records for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getHealthRecordsByGroup(groupId) {
    return await animalHealthRecordRepository.findByGroupId(groupId);
  }

  /**
   * Create a health record
   * @param {Object} data - Health record data
   * @returns {Promise<Object>}
   */
  async createHealthRecord(data) {
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

    return await animalHealthRecordRepository.create(data);
  }

  /**
   * Update a health record
   * @param {number} id - Health record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateHealthRecord(id, data) {
    const record = await animalHealthRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Health record not found');
    }
    return await animalHealthRecordRepository.update(id, data);
  }

  /**
   * Delete a health record
   * @param {number} id - Health record ID
   * @returns {Promise<void>}
   */
  async deleteHealthRecord(id) {
    const record = await animalHealthRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Health record not found');
    }
    await animalHealthRecordRepository.softDelete(id);
  }

  /**
   * Get health statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getHealthStatistics(filters = {}) {
    return await animalHealthRecordRepository.getStatistics(filters);
  }

  /**
   * Get upcoming followups
   * @param {number} days - Days to look ahead
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getUpcomingFollowups(days = 30, limit = 10) {
    return await animalHealthRecordRepository.getUpcomingFollowups(days, limit);
  }

  /**
   * Get overdue followups
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getOverdueFollowups(limit = 10) {
    return await animalHealthRecordRepository.getOverdueFollowups(limit);
  }

  // ==================== DISEASE & TREATMENT ====================

  /**
   * Get all disease/treatment records with optional filters
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllDiseaseTreatments(filters = {}) {
    return await animalDiseaseTreatmentRepository.findAllWithDetails(filters);
  }

  /**
   * Get disease/treatment record by ID
   * @param {number} id - Disease/treatment record ID
   * @returns {Promise<Object>}
   */
  async getDiseaseTreatmentById(id) {
    const record = await animalDiseaseTreatmentRepository.findByIdWithDetails(id);
    if (!record) {
      throw new NotFoundError('Disease/treatment record not found');
    }
    return record;
  }

  /**
   * Get disease/treatment records for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async getDiseaseTreatmentsByAnimal(animalId) {
    return await animalDiseaseTreatmentRepository.findByAnimalId(animalId);
  }

  /**
   * Get disease/treatment records for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getDiseaseTreatmentsByGroup(groupId) {
    return await animalDiseaseTreatmentRepository.findByGroupId(groupId);
  }

  /**
   * Create a disease/treatment record
   * @param {Object} data - Disease/treatment data
   * @returns {Promise<Object>}
   */
  async createDiseaseTreatment(data) {
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

    return await animalDiseaseTreatmentRepository.create(data);
  }

  /**
   * Update a disease/treatment record
   * @param {number} id - Disease/treatment record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateDiseaseTreatment(id, data) {
    const record = await animalDiseaseTreatmentRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Disease/treatment record not found');
    }
    return await animalDiseaseTreatmentRepository.update(id, data);
  }

  /**
   * Delete a disease/treatment record
   * @param {number} id - Disease/treatment record ID
   * @returns {Promise<void>}
   */
  async deleteDiseaseTreatment(id) {
    const record = await animalDiseaseTreatmentRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Disease/treatment record not found');
    }
    await animalDiseaseTreatmentRepository.softDelete(id);
  }

  /**
   * Get disease statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getDiseaseStatistics(filters = {}) {
    return await animalDiseaseTreatmentRepository.getStatistics(filters);
  }

  /**
   * Get disease occurrence summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getDiseaseOccurrenceSummary(filters = {}) {
    return await animalDiseaseTreatmentRepository.getDiseaseOccurrenceSummary(filters);
  }

  /**
   * Get ongoing treatments
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getOngoingTreatments(limit = 20) {
    return await animalDiseaseTreatmentRepository.getOngoingTreatments(limit);
  }

  /**
   * Get chronic conditions
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getChronicConditions(limit = 20) {
    return await animalDiseaseTreatmentRepository.getChronicConditions(limit);
  }

  /**
   * Get critical cases
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getCriticalCases(limit = 10) {
    return await animalDiseaseTreatmentRepository.getCriticalCases(limit);
  }
}

module.exports = new AnimalHealthService();
