const animalFeedRecordRepository = require('../repositories/animal-feed-record.repository');
const animalRepository = require('../repositories/animal.repository');
const animalGroupRepository = require('../repositories/animal-group.repository');
const inventoryItemRepository = require('../repositories/inventory-item.repository');
const inventoryService = require('./inventory.service');
const { db } = require('../config/database');
const { INVENTORY_REFERENCE_TYPES } = require('../config/constants');
const { NotFoundError, ValidationError } = require('../utils/errors');

/** A feed record's cost as entered: total_cost, or quantity × cost_per_unit */
function costOf(data) {
  if (data.total_cost) return data.total_cost;
  return data.quantity && data.cost_per_unit ? data.quantity * data.cost_per_unit : data.total_cost;
}

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
   * Create a feed record. Given an inventory_item_id, the feed is taken from
   * stock (optionally from one inventory_batch_id), once for the whole animal
   * or group, and the record's cost comes from the stock used. All or
   * nothing: short stock records no feeding.
   * @param {Object} data - Feed record data, with recorded_by
   * @returns {Promise<Object>} The record, with `stock` when stock was used
   * @throws {ConflictError} INSUFFICIENT_STOCK, BATCH_NOT_USABLE
   */
  async createFeedRecord(data) {
    if (!data.animal_id && !data.animal_group_id) {
      throw new ValidationError('Either animal_id or animal_group_id is required');
    }

    if (data.animal_id && data.animal_group_id) {
      throw new ValidationError('Cannot specify both animal_id and animal_group_id');
    }

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

      let item = null;
      if (data.inventory_item_id) {
        item = await inventoryItemRepository.findById(data.inventory_item_id, tx);
        if (!item) {
          throw new NotFoundError('Inventory item not found');
        }
      }
      const unit = data.unit || (item && item.unit);
      if (!unit) {
        throw new ValidationError('Unit is required unless an inventory item is chosen');
      }

      // stock_quantity is set from the stock used, never taken from the request
      // eslint-disable-next-line no-unused-vars
      const { inventory_batch_id: batchId, stock_quantity, ...fields } = data;
      const record = await animalFeedRecordRepository.create(
        {
          ...fields,
          feed_name: data.feed_name || (item && item.name),
          unit,
          inventory_item_id: item ? item.id : null,
          total_cost: costOf(data),
        },
        tx
      );

      return item ? this.takeFeedFromStock(record, batchId, data.recorded_by, tx) : record;
    });
  }

  /**
   * Update a feed record. Changing the quantity, unit or date of a feeding
   * taken from stock puts the old amount back and takes the new one.
   * @param {number} id - Feed record ID
   * @param {Object} data - Updated data (the item itself cannot be changed)
   * @param {number} userId - User making the change
   * @returns {Promise<Object>}
   */
  async updateFeedRecord(id, data, userId) {
    return db.tx(async (tx) => {
      const record = await animalFeedRecordRepository.findById(id, tx);
      if (!record) {
        throw new NotFoundError('Feed record not found');
      }

      // eslint-disable-next-line no-unused-vars
      const { inventory_item_id, inventory_batch_id: batchId, stock_quantity, ...changes } = data;

      // Recalculate total_cost if quantity or cost_per_unit changed
      if (changes.quantity || changes.cost_per_unit) {
        const quantity = changes.quantity || record.quantity;
        const costPerUnit = changes.cost_per_unit || record.cost_per_unit;
        changes.total_cost = quantity * costPerUnit;
      }

      const updated = await animalFeedRecordRepository.update(record.id, changes, tx);
      const restock =
        record.inventory_item_id &&
        (Number(updated.quantity) !== Number(record.quantity) ||
          updated.unit !== record.unit ||
          updated.feed_date !== record.feed_date ||
          Boolean(batchId));
      if (!restock) {
        return updated;
      }

      await inventoryService.reverseReference(INVENTORY_REFERENCE_TYPES.ANIMAL_FEED_RECORD, record.id, userId, tx);
      return this.takeFeedFromStock(updated, batchId, userId, tx);
    });
  }

  /**
   * Delete a feed record; any stock it used goes back
   * @param {number} id - Feed record ID
   * @param {number} userId - User deleting it
   * @returns {Promise<void>}
   */
  async deleteFeedRecord(id, userId) {
    await db.tx(async (tx) => {
      const record = await animalFeedRecordRepository.findById(id, tx);
      if (!record) {
        throw new NotFoundError('Feed record not found');
      }
      await animalFeedRecordRepository.softDelete(record.id, tx);
      await inventoryService.reverseReference(INVENTORY_REFERENCE_TYPES.ANIMAL_FEED_RECORD, record.id, userId, tx);
    });
  }

  /**
   * Draw a stock-linked feed record's quantity and keep what it cost
   * @private
   */
  async takeFeedFromStock(record, batchId, userId, tx) {
    const drawn = await inventoryService.useStock(
      record.inventory_item_id,
      record.quantity,
      {
        unit: record.unit,
        inventory_batch_id: batchId,
        reference_type: INVENTORY_REFERENCE_TYPES.ANIMAL_FEED_RECORD,
        reference_id: record.id,
        transaction_date: record.feed_date,
        notes: `Feed record ${record.id}`,
      },
      userId,
      tx
    );

    const changes = { stock_quantity: drawn.quantity };
    if (drawn.total_cost !== null) {
      changes.total_cost = drawn.total_cost;
      changes.cost_per_unit = Math.round((drawn.total_cost / Number(record.quantity)) * 100) / 100;
    }
    const updated = await animalFeedRecordRepository.update(record.id, changes, tx);
    return {
      ...updated,
      stock: { batch_deductions: drawn.batch_deductions, current_stock: drawn.current_stock, unit: drawn.unit },
    };
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
