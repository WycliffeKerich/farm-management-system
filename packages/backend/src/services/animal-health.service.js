const animalHealthRecordRepository = require('../repositories/animal-health-record.repository');
const animalDiseaseTreatmentRepository = require('../repositories/animal-disease-treatment.repository');
const animalRepository = require('../repositories/animal.repository');
const animalGroupRepository = require('../repositories/animal-group.repository');
const inventoryItemRepository = require('../repositories/inventory-item.repository');
const treatmentMedicationRepository = require('../repositories/treatment-medication.repository');
const inventoryService = require('./inventory.service');
const { db } = require('../config/database');
const { INVENTORY_REFERENCE_TYPES, WITHDRAWAL_PRODUCTS } = require('../config/constants');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { addDays, longerInterval, toDateString } = require('../utils/dates');

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
    return { ...record, doses: await treatmentMedicationRepository.findByTreatmentId(record.id) };
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
   * Create a disease/treatment record, with the doses given under it. See
   * giveDose: each dose can come from stock and sets withdrawal dates. All or
   * nothing: short stock for any dose records no treatment.
   * @param {Object} data - Disease/treatment data, with recorded_by and optional doses[]
   * @returns {Promise<Object>} The record, with `doses`
   * @throws {ConflictError} INSUFFICIENT_STOCK, BATCH_NOT_USABLE
   */
  async createDiseaseTreatment(data) {
    if (!data.animal_id && !data.animal_group_id) {
      throw new ValidationError('Either animal_id or animal_group_id is required');
    }

    if (data.animal_id && data.animal_group_id) {
      throw new ValidationError('Cannot specify both animal_id and animal_group_id');
    }

    const { doses = [], ...fields } = data;
    return db.tx(async (tx) => {
      // Verify animal or group exists
      if (data.animal_id) {
        const animal = await animalRepository.findById(data.animal_id, tx);
        if (!animal) {
          throw new NotFoundError('Animal not found');
        }
      }

      if (data.animal_group_id) {
        const group = await animalGroupRepository.findById(data.animal_group_id, tx);
        if (!group) {
          throw new NotFoundError('Animal group not found');
        }
      }

      const treatment = await animalDiseaseTreatmentRepository.create(fields, tx);
      const given = [];
      for (const dose of doses) {
        given.push(await this.giveDose(treatment, dose, data.recorded_by, tx));
      }
      return { ...treatment, doses: given };
    });
  }

  /**
   * Update a disease/treatment record (doses are added and removed on their own)
   * @param {number} id - Disease/treatment record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateDiseaseTreatment(id, data) {
    const record = await animalDiseaseTreatmentRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Disease/treatment record not found');
    }
    // eslint-disable-next-line no-unused-vars
    const { doses, ...changes } = data;
    return await animalDiseaseTreatmentRepository.update(id, changes);
  }

  /**
   * Delete a disease/treatment record with its doses; stock they used goes back
   * @param {number} id - Disease/treatment record ID
   * @param {number} userId - User deleting it
   * @returns {Promise<void>}
   */
  async deleteDiseaseTreatment(id, userId) {
    await db.tx(async (tx) => {
      const record = await animalDiseaseTreatmentRepository.findById(id, tx);
      if (!record) {
        throw new NotFoundError('Disease/treatment record not found');
      }
      for (const dose of await treatmentMedicationRepository.findByTreatmentId(record.id, tx)) {
        await this.removeDose(dose, userId, tx);
      }
      await animalDiseaseTreatmentRepository.softDelete(record.id, tx);
    });
  }

  /**
   * Record another dose under a treatment
   * @param {number} treatmentId - Disease/treatment record ID
   * @param {Object} dose - See giveDose
   * @param {number} userId - User giving it
   * @returns {Promise<Object>} The dose, with `stock` when stock was used
   */
  async addDose(treatmentId, dose, userId) {
    return db.tx(async (tx) => {
      const treatment = await animalDiseaseTreatmentRepository.findById(treatmentId, tx);
      if (!treatment) {
        throw new NotFoundError('Disease/treatment record not found');
      }
      return this.giveDose(treatment, dose, userId, tx);
    });
  }

  /**
   * Delete a dose recorded in error; its stock goes back and its withdrawal
   * dates no longer hold anything
   * @param {number} treatmentId - Disease/treatment record ID
   * @param {number} doseId - Dose ID
   * @param {number} userId - User deleting it
   * @returns {Promise<void>}
   */
  async deleteDose(treatmentId, doseId, userId) {
    await db.tx(async (tx) => {
      const dose = await treatmentMedicationRepository.findById(doseId, tx);
      if (!dose || dose.treatment_id !== treatmentId) {
        throw new NotFoundError('Dose not found');
      }
      await this.removeDose(dose, userId, tx);
    });
  }

  /**
   * Save one dose. Given an inventory_item_id it is taken from stock
   * (optionally from one inventory_batch_id), and product_name and unit
   * default to the item's. Each withdrawal period is the longer of the one
   * entered and the item's own, counted from administered_date (by default
   * the treatment's start, else its diagnosis date).
   * @private
   */
  async giveDose(treatment, dose, userId, tx) {
    let item = null;
    if (dose.inventory_item_id) {
      item = await inventoryItemRepository.findById(dose.inventory_item_id, tx);
      if (!item) {
        throw new NotFoundError('Inventory item not found');
      }
    }
    const productName = dose.product_name || (item && item.name);
    const unit = dose.unit || (item && item.unit);
    if (!productName || !unit) {
      throw new ValidationError('A dose needs a product name and unit unless an inventory item is chosen');
    }

    const administered = toDateString(
      dose.administered_date || treatment.treatment_start_date || treatment.diagnosis_date
    );
    const withdrawal = {};
    for (const product of WITHDRAWAL_PRODUCTS) {
      const days = longerInterval(dose[`${product}_withdrawal_days`], item && item[`${product}_withdrawal_days`]);
      withdrawal[`${product}_withdrawal_days`] = days;
      withdrawal[`${product}_safe_from`] = days === null ? null : addDays(administered, days);
    }

    // Computed columns are set here only, never taken from the request
    const saved = await treatmentMedicationRepository.create(
      {
        treatment_id: treatment.id,
        inventory_item_id: item ? item.id : null,
        product_name: productName,
        quantity: dose.quantity,
        unit,
        administered_date: administered,
        ...withdrawal,
        notes: dose.notes,
        recorded_by: userId,
      },
      tx
    );
    if (!item) {
      return saved;
    }

    const drawn = await inventoryService.useStock(
      item.id,
      saved.quantity,
      {
        unit,
        inventory_batch_id: dose.inventory_batch_id,
        reference_type: INVENTORY_REFERENCE_TYPES.TREATMENT_MEDICATION,
        reference_id: saved.id,
        transaction_date: administered,
        notes: `Treatment ${treatment.id}: ${treatment.disease_name}`,
      },
      userId,
      tx
    );
    const updated = await treatmentMedicationRepository.update(
      saved.id,
      { stock_quantity: drawn.quantity, total_cost: drawn.total_cost },
      tx
    );
    return {
      ...updated,
      stock: { batch_deductions: drawn.batch_deductions, current_stock: drawn.current_stock, unit: drawn.unit },
    };
  }

  /** Soft-delete a dose and put back the stock it used @private */
  async removeDose(dose, userId, tx) {
    await treatmentMedicationRepository.softDelete(dose.id, tx);
    await inventoryService.reverseReference(INVENTORY_REFERENCE_TYPES.TREATMENT_MEDICATION, dose.id, userId, tx);
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
