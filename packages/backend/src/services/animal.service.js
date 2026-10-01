const animalTypeRepository = require('../repositories/animal-type.repository');
const animalBreedRepository = require('../repositories/animal-breed.repository');
const animalHousingRepository = require('../repositories/animal-housing.repository');
const animalRepository = require('../repositories/animal.repository');
const animalGroupRepository = require('../repositories/animal-group.repository');
const animalDeathRepository = require('../repositories/animal-death.repository');
const animalCarePlanRepository = require('../repositories/animal-care-plan.repository');
const animalCarePlanTaskRepository = require('../repositories/animal-care-plan-task.repository');
const animalCareScheduleRepository = require('../repositories/animal-care-schedule.repository');
const scheduledAnimalTaskRepository = require('../repositories/scheduled-animal-task.repository');
const breedingRecordRepository = require('../repositories/breeding-record.repository');
const animalSaleRepository = require('../repositories/animal-sale.repository');
const incubationRecordRepository = require('../repositories/incubation-record.repository');
const withdrawalService = require('./withdrawal.service');
const enterpriseService = require('./enterprise.service');
const { db } = require('../config/database');
const { ConflictError, NotFoundError, ValidationError } = require('../utils/errors');
const { addDays, toDateString } = require('../utils/dates');

/**
 * Service for animal management operations
 */
class AnimalService {
  // ==================== ANIMAL TYPES ====================

  /**
   * Get all animal types
   * @returns {Promise<Array>}
   */
  async getAllAnimalTypes() {
    return await animalTypeRepository.findAllWithBreeds();
  }

  /**
   * Get animal type by ID
   * @param {number} id - Animal type ID
   * @returns {Promise<Object>}
   */
  async getAnimalTypeById(id) {
    const animalType = await animalTypeRepository.findByIdWithBreeds(id);
    if (!animalType) {
      throw new NotFoundError('Animal type not found');
    }
    return animalType;
  }

  /**
   * Create a new animal type
   * @param {Object} data - Animal type data
   * @returns {Promise<Object>}
   */
  async createAnimalType(data) {
    const existing = await animalTypeRepository.findByName(data.name);
    if (existing) {
      throw new ConflictError('Animal type with this name already exists');
    }
    await enterpriseService.assertAssignable(data.enterprise_id);
    return await animalTypeRepository.create(data);
  }

  /**
   * Update an animal type
   * @param {number} id - Animal type ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateAnimalType(id, data) {
    const animalType = await animalTypeRepository.findById(id);
    if (!animalType) {
      throw new NotFoundError('Animal type not found');
    }

    if (data.name && data.name !== animalType.name) {
      const existing = await animalTypeRepository.findByName(data.name);
      if (existing) {
        throw new ConflictError('Animal type with this name already exists');
      }
    }
    if (data.enterprise_id !== animalType.enterprise_id) {
      await enterpriseService.assertAssignable(data.enterprise_id);
    }

    return await animalTypeRepository.update(id, data);
  }

  /**
   * Delete an animal type
   * @param {number} id - Animal type ID
   * @returns {Promise<void>}
   */
  async deleteAnimalType(id) {
    const animalType = await animalTypeRepository.findById(id);
    if (!animalType) {
      throw new NotFoundError('Animal type not found');
    }
    if (await animalBreedRepository.exists({ animal_type_id: id })) {
      throw new ConflictError('Delete this animal type’s breeds first', 'IN_USE');
    }
    await animalTypeRepository.softDelete(id);
  }

  /**
   * Get animal type categories
   * @returns {Promise<Array>}
   */
  async getAnimalTypeCategories() {
    return await animalTypeRepository.getCategories();
  }

  /**
   * Get animal types by tracking mode
   * @param {string} trackingMode - 'individual' or 'flock'
   * @returns {Promise<Array>}
   */
  async getAnimalTypesByTrackingMode(trackingMode) {
    return await animalTypeRepository.findByTrackingMode(trackingMode);
  }

  // ==================== ANIMAL BREEDS ====================

  /**
   * Get all breeds
   * @param {Object} filters - Optional filters (reproduction_type)
   * @returns {Promise<Array>}
   */
  async getAllBreeds(filters = {}) {
    if (filters.reproduction_type) {
      return await animalBreedRepository.findByReproductionType(filters.reproduction_type);
    }
    return await animalBreedRepository.findAllWithType();
  }

  /**
   * Get breeds by animal type
   * @param {number} animalTypeId - Animal type ID
   * @returns {Promise<Array>}
   */
  async getBreedsByAnimalType(animalTypeId) {
    return await animalBreedRepository.findByAnimalTypeId(animalTypeId);
  }

  /**
   * Get breed by ID
   * @param {number} id - Breed ID
   * @returns {Promise<Object>}
   */
  async getBreedById(id) {
    const breed = await animalBreedRepository.findByIdWithDetails(id);
    if (!breed) {
      throw new NotFoundError('Animal breed not found');
    }
    return breed;
  }

  /**
   * Create a new breed
   * @param {Object} data - Breed data
   * @returns {Promise<Object>}
   */
  async createBreed(data) {
    const animalType = await animalTypeRepository.findById(data.animal_type_id);
    if (!animalType) {
      throw new NotFoundError('Animal type not found');
    }

    const existing = await animalBreedRepository.findByNameAndType(data.name, data.animal_type_id);
    if (existing) {
      throw new ConflictError('Breed with this name already exists for this animal type');
    }

    return await animalBreedRepository.create(data);
  }

  /**
   * Update a breed
   * @param {number} id - Breed ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateBreed(id, data) {
    const breed = await animalBreedRepository.findById(id);
    if (!breed) {
      throw new NotFoundError('Animal breed not found');
    }

    if (data.name && (data.name !== breed.name || data.animal_type_id !== breed.animal_type_id)) {
      const existing = await animalBreedRepository.findByNameAndType(
        data.name,
        data.animal_type_id || breed.animal_type_id
      );
      if (existing && existing.id !== Number(id)) {
        throw new ConflictError('Breed with this name already exists for this animal type');
      }
    }

    return await animalBreedRepository.update(id, data);
  }

  /**
   * Delete a breed
   * @param {number} id - Breed ID
   * @returns {Promise<void>}
   */
  async deleteBreed(id) {
    const breed = await animalBreedRepository.findById(id);
    if (!breed) {
      throw new NotFoundError('Animal breed not found');
    }
    if (
      (await animalRepository.exists({ animal_breed_id: id, status: 'active' })) ||
      (await animalGroupRepository.exists({ animal_breed_id: id, status: 'active' }))
    ) {
      throw new ConflictError('Cannot delete a breed with active animals or groups', 'IN_USE');
    }
    await animalBreedRepository.softDelete(id);
  }

  // ==================== ANIMAL HOUSING ====================

  /**
   * Get all housing
   * @returns {Promise<Array>}
   */
  async getAllHousing() {
    return await animalHousingRepository.findAllWithDetails();
  }

  /**
   * Get active housing
   * @returns {Promise<Array>}
   */
  async getActiveHousing() {
    return await animalHousingRepository.findAllActive();
  }

  /**
   * Get housing by ID
   * @param {number} id - Housing ID
   * @returns {Promise<Object>}
   */
  async getHousingById(id) {
    const housing = await animalHousingRepository.getAvailability(id);
    if (!housing) {
      throw new NotFoundError('Animal housing not found');
    }
    return housing;
  }

  /**
   * Create new housing
   * @param {Object} data - Housing data
   * @returns {Promise<Object>}
   */
  async createHousing(data) {
    const existing = await animalHousingRepository.findByName(data.name);
    if (existing) {
      throw new ConflictError('Housing with this name already exists');
    }
    return await animalHousingRepository.create(data);
  }

  /**
   * Update housing
   * @param {number} id - Housing ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateHousing(id, data) {
    const housing = await animalHousingRepository.findById(id);
    if (!housing) {
      throw new NotFoundError('Animal housing not found');
    }

    if (data.name && data.name !== housing.name) {
      const existing = await animalHousingRepository.findByName(data.name);
      if (existing) {
        throw new ConflictError('Housing with this name already exists');
      }
    }

    return await animalHousingRepository.update(id, data);
  }

  /**
   * Delete housing
   * @param {number} id - Housing ID
   * @returns {Promise<void>}
   */
  async deleteHousing(id) {
    const housing = await animalHousingRepository.getAvailability(id);
    if (!housing) {
      throw new NotFoundError('Animal housing not found');
    }

    if (housing.total_occupancy > 0) {
      throw new ConflictError('Cannot delete housing with animals');
    }

    await animalHousingRepository.softDelete(id);
  }

  /**
   * Get housing types
   * @returns {Promise<Array>}
   */
  async getHousingTypes() {
    return await animalHousingRepository.getTypes();
  }

  // ==================== INDIVIDUAL ANIMALS ====================

  /**
   * Get all animals with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllAnimals(filters = {}) {
    return await animalRepository.findAllWithDetails(filters);
  }

  /**
   * Get paginated animals
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>}
   */
  async getPaginatedAnimals(page, limit, filters) {
    return await animalRepository.paginateWithDetails(page, limit, filters);
  }

  /**
   * Get animal by ID with full details
   * @param {number} id - Animal ID
   * @returns {Promise<Object>}
   */
  async getAnimalById(id) {
    const animal = await animalRepository.findByIdWithDetails(id);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }
    return animal;
  }

  /**
   * Create a new animal (acquisition)
   * @param {Object} data - Animal data
   * @param {number} userId - User ID creating the animal
   * @returns {Promise<Object>}
   */
  async createAnimal(data, userId) {
    const breed = await animalBreedRepository.findByIdWithDetails(data.animal_breed_id);
    if (!breed) {
      throw new NotFoundError('Animal breed not found');
    }

    if (data.housing_id) {
      const housing = await animalHousingRepository.findById(data.housing_id);
      if (!housing) {
        throw new NotFoundError('Animal housing not found');
      }
    }

    // Generate tag number
    const tagNumber = data.tag_number || (await animalRepository.generateTagNumber(breed.animal_type_name));

    // Check for duplicate tag
    const existingTag = await animalRepository.findByTagNumber(tagNumber);
    if (existingTag) {
      throw new ConflictError('An animal with this tag number already exists');
    }

    const animalData = {
      ...data,
      enterprise_id: await enterpriseService.forNewSubject(data, breed.animal_type_enterprise_id),
      tag_number: tagNumber,
      status: data.status || 'active',
      created_by: userId,
    };

    return await animalRepository.create(animalData);
  }

  /**
   * Update an animal
   * @param {number} id - Animal ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateAnimal(id, data) {
    const animal = await animalRepository.findById(id);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }

    if (data.tag_number && data.tag_number !== animal.tag_number) {
      const existing = await animalRepository.findByTagNumber(data.tag_number);
      if (existing) {
        throw new ConflictError('An animal with this tag number already exists');
      }
    }

    if (data.animal_breed_id && data.animal_breed_id !== animal.animal_breed_id) {
      const breed = await animalBreedRepository.findById(data.animal_breed_id);
      if (!breed) {
        throw new NotFoundError('Animal breed not found');
      }
    }

    if (data.housing_id && data.housing_id !== animal.housing_id) {
      const housing = await animalHousingRepository.findById(data.housing_id);
      if (!housing) {
        throw new NotFoundError('Animal housing not found');
      }
    }

    if (data.enterprise_id !== animal.enterprise_id) {
      await enterpriseService.assertAssignable(data.enterprise_id);
    }

    return db.tx(async (t) => {
      const updated = await animalRepository.update(id, data, t);
      await enterpriseService.subjectSaved(t, 'animals', updated);
      return updated;
    });
  }

  /**
   * Update animal status
   * @param {number} id - Animal ID
   * @param {string} status - New status
   * @param {Date} statusDate - Status change date
   * @returns {Promise<Object>}
   */
  async updateAnimalStatus(id, status, statusDate = new Date()) {
    const animal = await animalRepository.findById(id);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }
    if (status === 'sold' && animal.status !== 'sold') {
      await this.assertNoMeatWithdrawal('animal', animal.id, statusDate);
    }
    return await animalRepository.updateStatus(id, status, statusDate);
  }

  /**
   * Selling an animal, or animals from a group, without a sale record leaves
   * nowhere to keep an owner's override, so inside a meat withdrawal period it
   * is refused outright (409 WITHDRAWAL_ACTIVE). The owner overrides by
   * recording the sale itself (POST /animals/sales).
   * @param {string} referenceType - 'animal' or 'animal_group'
   * @param {number} id - Animal or group ID
   * @param {string|Date} date - Sale date
   */
  async assertNoMeatWithdrawal(referenceType, id, date) {
    await withdrawalService.checkSale({ reference_type: referenceType, reference_id: id, sale_date: date }, {});
  }

  /**
   * Record animal sale
   * @param {number} id - Animal ID
   * @param {Date} saleDate - Date of sale
   * @returns {Promise<Object>}
   */
  async recordAnimalSale(id, saleDate = new Date()) {
    const animal = await animalRepository.findById(id);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }
    if (animal.status !== 'active') {
      throw new ConflictError('Can only sell active animals');
    }
    await this.assertNoMeatWithdrawal('animal', animal.id, saleDate);
    return await animalRepository.recordSale(id, saleDate);
  }

  /**
   * Delete an animal
   * @param {number} id - Animal ID
   * @returns {Promise<void>}
   */
  async deleteAnimal(id) {
    const animal = await animalRepository.findById(id);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }
    await animalRepository.softDelete(id);
  }

  /**
   * Get animal statistics
   * @returns {Promise<Object>}
   */
  async getAnimalStatistics() {
    return await animalRepository.getStatistics();
  }

  /**
   * Get breeding stock
   * @param {string} gender - Optional gender filter
   * @param {number} breedId - Optional breed filter
   * @returns {Promise<Array>}
   */
  async getBreedingStock(gender = null, breedId = null) {
    return await animalRepository.findBreedingStock(gender, breedId);
  }

  /**
   * Get offspring of an animal
   * @param {number} parentId - Parent animal ID
   * @returns {Promise<Array>}
   */
  async getOffspring(parentId) {
    return await animalRepository.findOffspring(parentId);
  }

  // ==================== ANIMAL GROUPS (FLOCKS) ====================

  /**
   * Get all animal groups with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllGroups(filters = {}) {
    return await animalGroupRepository.findAllWithDetails(filters);
  }

  /**
   * Get paginated groups
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   * @param {Object} filters - Filters
   * @returns {Promise<Object>}
   */
  async getPaginatedGroups(page, limit, filters) {
    return await animalGroupRepository.paginateWithDetails(page, limit, filters);
  }

  /**
   * Get group by ID with full details
   * @param {number} id - Group ID
   * @returns {Promise<Object>}
   */
  async getGroupById(id) {
    const group = await animalGroupRepository.findByIdWithDetails(id);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }

    // Get adjustment history
    const adjustments = await animalGroupRepository.getAdjustmentHistory(id);
    group.adjustments = adjustments;

    return group;
  }

  /**
   * Create a new animal group
   * @param {Object} data - Group data
   * @param {number} userId - User ID creating the group
   * @returns {Promise<Object>}
   */
  async createGroup(data, userId) {
    const breed = await animalBreedRepository.findByIdWithDetails(data.animal_breed_id);
    if (!breed) {
      throw new NotFoundError('Animal breed not found');
    }

    if (data.housing_id) {
      const housing = await animalHousingRepository.findById(data.housing_id);
      if (!housing) {
        throw new NotFoundError('Animal housing not found');
      }
    }

    // Generate group code
    const groupCode = data.group_code || (await animalGroupRepository.generateGroupCode(breed.animal_type_name));

    // Check for duplicate code
    if (groupCode) {
      const existingCode = await animalGroupRepository.findByGroupCode(groupCode);
      if (existingCode) {
        throw new ConflictError('A group with this code already exists');
      }
    }

    const groupData = {
      ...data,
      enterprise_id: await enterpriseService.forNewSubject(data, breed.animal_type_enterprise_id),
      group_code: groupCode,
      initial_quantity: data.quantity,
      current_quantity: data.quantity,
      status: data.status || 'active',
      created_by: userId,
    };

    return await animalGroupRepository.create(groupData);
  }

  /**
   * Update a group
   * @param {number} id - Group ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateGroup(id, data) {
    const group = await animalGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }

    if (data.group_code && data.group_code !== group.group_code) {
      const existing = await animalGroupRepository.findByGroupCode(data.group_code);
      if (existing) {
        throw new ConflictError('A group with this code already exists');
      }
    }

    if (data.enterprise_id !== group.enterprise_id) {
      await enterpriseService.assertAssignable(data.enterprise_id);
    }

    return db.tx(async (t) => {
      const updated = await animalGroupRepository.update(id, data, t);
      await enterpriseService.subjectSaved(t, 'animal_groups', updated);
      return updated;
    });
  }

  /**
   * Record addition to group (purchase, hatching, etc.)
   * @param {number} groupId - Group ID
   * @param {Object} data - Addition data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async recordGroupAddition(groupId, data, userId) {
    const group = await animalGroupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }

    return await animalGroupRepository.recordAddition(groupId, data.quantity, data.type || 'addition', {
      adjustment_date: data.adjustment_date || new Date(),
      reason: data.reason,
      unit_value: data.unit_value,
      total_value: data.total_value,
      notes: data.notes,
      recorded_by: userId,
    });
  }

  /**
   * Record removal from group (sale, transfer, etc.)
   * @param {number} groupId - Group ID
   * @param {Object} data - Removal data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async recordGroupRemoval(groupId, data, userId) {
    const group = await animalGroupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }

    const currentQuantity = group.current_quantity ?? group.quantity;
    if (data.quantity > currentQuantity) {
      throw new ValidationError('Cannot remove more animals than currently in group');
    }

    const adjustmentDate = data.adjustment_date || new Date();
    if (data.type === 'sale') {
      await this.assertNoMeatWithdrawal('animal_group', groupId, adjustmentDate);
    }

    return await animalGroupRepository.recordRemoval(groupId, data.quantity, data.type || 'removal', {
      adjustment_date: adjustmentDate,
      reason: data.reason,
      unit_value: data.unit_value,
      total_value: data.total_value,
      notes: data.notes,
      recorded_by: userId,
    });
  }

  /**
   * Get group adjustment history
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getGroupAdjustmentHistory(groupId) {
    return await animalGroupRepository.getAdjustmentHistory(groupId);
  }

  /**
   * Close a group
   * @param {number} id - Group ID
   * @returns {Promise<Object>}
   */
  async closeGroup(id) {
    const group = await animalGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }
    return await animalGroupRepository.closeGroup(id);
  }

  /**
   * Delete a group
   * @param {number} id - Group ID
   * @returns {Promise<void>}
   */
  async deleteGroup(id) {
    const group = await animalGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }
    await animalGroupRepository.softDelete(id);
  }

  /**
   * Get group statistics
   * @returns {Promise<Object>}
   */
  async getGroupStatistics() {
    return await animalGroupRepository.getStatistics();
  }

  // ==================== ANIMAL DEATHS ====================

  /**
   * Record a death for an individual animal
   * @param {number} animalId - Animal ID
   * @param {Object} data - Death data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async recordAnimalDeath(animalId, data, userId) {
    const animal = await animalRepository.findById(animalId);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }

    if (animal.status === 'deceased') {
      throw new ConflictError('Animal is already marked as deceased');
    }

    const deathData = {
      ...data,
      animal_id: animalId,
      quantity: 1,
      reported_by: userId,
    };

    // The trigger will update the animal status automatically
    return await animalDeathRepository.create(deathData);
  }

  /**
   * Record deaths in a group
   * @param {number} groupId - Group ID
   * @param {Object} data - Death data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async recordGroupDeaths(groupId, data, userId) {
    const group = await animalGroupRepository.findById(groupId);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }

    const currentQuantity = group.current_quantity ?? group.quantity;
    if (data.quantity > currentQuantity) {
      throw new ValidationError('Cannot record more deaths than animals in group');
    }

    const deathData = {
      ...data,
      animal_group_id: groupId,
      reported_by: userId,
    };

    // The trigger will update the group quantity automatically
    return await animalDeathRepository.create(deathData);
  }

  /**
   * Get all deaths with filters
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getAllDeaths(filters = {}) {
    return await animalDeathRepository.findAllWithDetails(filters);
  }

  /**
   * Get death by ID
   * @param {number} id - Death record ID
   * @returns {Promise<Object>}
   */
  async getDeathById(id) {
    const death = await animalDeathRepository.findByIdWithDetails(id);
    if (!death) {
      throw new NotFoundError('Death record not found');
    }
    return death;
  }

  /**
   * Get deaths for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async getDeathsByAnimal(animalId) {
    return await animalDeathRepository.findByAnimalId(animalId);
  }

  /**
   * Get deaths for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getDeathsByGroup(groupId) {
    return await animalDeathRepository.findByGroupId(groupId);
  }

  /**
   * Get death statistics
   * @param {Object} filters - Filters
   * @returns {Promise<Object>}
   */
  async getDeathStatistics(filters = {}) {
    return await animalDeathRepository.getStatistics(filters);
  }

  /**
   * Get deaths by cause
   * @param {Object} filters - Filters
   * @returns {Promise<Array>}
   */
  async getDeathsByCause(filters = {}) {
    return await animalDeathRepository.getDeathsByCause(filters);
  }

  /**
   * Get group mortality rate
   * @param {number} groupId - Group ID
   * @returns {Promise<Object>}
   */
  async getGroupMortalityRate(groupId) {
    return await animalDeathRepository.getGroupMortalityRate(groupId);
  }

  /**
   * Get recent death alerts
   * @param {number} days - Days to look back
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getRecentDeathAlerts(days = 7, limit = 10) {
    return await animalDeathRepository.getRecentDeaths(days, limit);
  }

  /**
   * Update a death record
   * @param {number} id - Death record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateDeath(id, data) {
    const death = await animalDeathRepository.findById(id);
    if (!death) {
      throw new NotFoundError('Death record not found');
    }
    return await animalDeathRepository.update(id, data);
  }

  /**
   * Delete a death record
   * @param {number} id - Death record ID
   * @returns {Promise<void>}
   */
  async deleteDeath(id) {
    const death = await animalDeathRepository.findById(id);
    if (!death) {
      throw new NotFoundError('Death record not found');
    }

    // Deleting a death record means it was recorded in error, so undo what the
    // insert triggers did: return the animals to the group / reactivate the animal
    await db.tx(async (t) => {
      await animalDeathRepository.softDelete(id, t);

      if (death.animal_group_id) {
        await animalGroupRepository.recordAddition(
          death.animal_group_id,
          death.quantity || 1,
          'correction',
          { reason: 'Death record deleted', reference_type: 'death', reference_id: death.id },
          t
        );
      } else if (death.animal_id) {
        const animal = await animalRepository.findById(death.animal_id, t);
        if (animal && animal.status === 'deceased') {
          await animalRepository.updateStatus(death.animal_id, 'active', new Date(), t);
        }
      }
    });
  }

  // ==================== CARE PLANS ====================

  /**
   * Get all care plans
   * @returns {Promise<Array>}
   */
  async getAllCarePlans() {
    return await animalCarePlanRepository.findAllWithStats();
  }

  /**
   * Get care plan templates
   * @returns {Promise<Array>}
   */
  async getCarePlanTemplates() {
    return await animalCarePlanRepository.findAllTemplates();
  }

  /**
   * Get care plans by animal type
   * @param {number} animalTypeId - Animal type ID
   * @returns {Promise<Array>}
   */
  async getCarePlansByAnimalType(animalTypeId) {
    return await animalCarePlanRepository.findByAnimalTypeId(animalTypeId);
  }

  /**
   * Get care plans by breed
   * @param {number} breedId - Breed ID
   * @returns {Promise<Array>}
   */
  async getCarePlansByBreed(breedId) {
    return await animalCarePlanRepository.findByBreedId(breedId);
  }

  /**
   * Get care plans by type
   * @param {string} planType - Plan type
   * @returns {Promise<Array>}
   */
  async getCarePlansByType(planType) {
    return await animalCarePlanRepository.findByPlanType(planType);
  }

  /**
   * Get care plan by ID with tasks
   * @param {number} id - Plan ID
   * @returns {Promise<Object>}
   */
  async getCarePlanById(id) {
    const plan = await animalCarePlanRepository.findWithTasks(id);
    if (!plan) {
      throw new NotFoundError('Care plan not found');
    }
    return plan;
  }

  /**
   * Create a new care plan
   * @param {Object} data - Plan data
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async createCarePlan(data, userId) {
    if (data.animal_type_id) {
      const animalType = await animalTypeRepository.findById(data.animal_type_id);
      if (!animalType) {
        throw new NotFoundError('Animal type not found');
      }
    }

    if (data.animal_breed_id) {
      const breed = await animalBreedRepository.findById(data.animal_breed_id);
      if (!breed) {
        throw new NotFoundError('Animal breed not found');
      }
    }

    const planCode = await animalCarePlanRepository.generatePlanCode(data.name?.slice(0, 3) || 'ACP');

    const planData = {
      ...data,
      plan_code: planCode,
      created_by: userId,
    };

    return await animalCarePlanRepository.create(planData);
  }

  /**
   * Update a care plan
   * @param {number} id - Plan ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateCarePlan(id, data) {
    const plan = await animalCarePlanRepository.findById(id);
    if (!plan) {
      throw new NotFoundError('Care plan not found');
    }

    return await animalCarePlanRepository.update(id, data);
  }

  /**
   * Clone a care plan
   * @param {number} planId - Source plan ID
   * @param {string} newName - Name for cloned plan
   * @param {number} userId - User ID
   * @returns {Promise<Object>}
   */
  async cloneCarePlan(planId, newName, userId) {
    return await animalCarePlanRepository.clonePlan(planId, newName, userId);
  }

  /**
   * Delete a care plan
   * @param {number} id - Plan ID
   * @returns {Promise<void>}
   */
  async deleteCarePlan(id) {
    const plan = await animalCarePlanRepository.findById(id);
    if (!plan) {
      throw new NotFoundError('Care plan not found');
    }
    await animalCarePlanRepository.softDelete(id);
  }

  // ==================== CARE PLAN TASKS ====================

  /**
   * Get tasks for a care plan
   * @param {number} planId - Plan ID
   * @returns {Promise<Array>}
   */
  async getCarePlanTasks(planId) {
    return await animalCarePlanTaskRepository.findByPlanId(planId);
  }

  /**
   * Add a task to a care plan
   * @param {number} planId - Plan ID
   * @param {Object} data - Task data
   * @returns {Promise<Object>}
   */
  async addCarePlanTask(planId, data) {
    const plan = await animalCarePlanRepository.findById(planId);
    if (!plan) {
      throw new NotFoundError('Care plan not found');
    }

    const sequence = await animalCarePlanTaskRepository.getNextSequence(planId);

    const taskData = {
      ...data,
      plan_id: planId,
      task_sequence: data.task_sequence || sequence,
    };

    return await animalCarePlanTaskRepository.create(taskData);
  }

  /**
   * Update a care plan task
   * @param {number} taskId - Task ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateCarePlanTask(taskId, data) {
    const task = await animalCarePlanTaskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Care plan task not found');
    }
    return await animalCarePlanTaskRepository.update(taskId, data);
  }

  /**
   * Delete a care plan task
   * @param {number} taskId - Task ID
   * @returns {Promise<void>}
   */
  async deleteCarePlanTask(taskId) {
    const task = await animalCarePlanTaskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Care plan task not found');
    }
    await animalCarePlanTaskRepository.softDelete(taskId);
    await animalCarePlanTaskRepository.reorderTasks(task.plan_id);
  }

  // ==================== CARE SCHEDULES ====================

  /**
   * Apply a care plan to an individual animal. An animal can follow several
   * plans at once, but each plan only once at a time.
   * @param {number} animalId - Animal ID
   * @param {number} planId - Care plan ID
   * @param {Date} startDate - Start date for the schedule
   * @param {number} userId - User ID
   * @returns {Promise<Object>} The new schedule with its tasks and progress
   */
  async applyCarePlanToAnimal(animalId, planId, startDate, userId) {
    const animal = await animalRepository.findByIdWithDetails(animalId);
    if (!animal) {
      throw new NotFoundError('Animal not found');
    }

    const plan = await animalCarePlanRepository.findWithTasks(planId);
    if (!plan) {
      throw new NotFoundError('Care plan not found');
    }

    if (plan.applies_to === 'flock') {
      throw new ValidationError('This care plan is only applicable to flocks/groups');
    }

    return this._applyCarePlan(plan, {
      animalId,
      startDate: startDate || animal.date_of_birth || animal.date_acquired,
      userId,
    });
  }

  /**
   * Apply a care plan to a group. A group can follow several plans at once,
   * but each plan only once at a time.
   * @param {number} groupId - Group ID
   * @param {number} planId - Care plan ID
   * @param {Date} startDate - Start date for the schedule
   * @param {number} userId - User ID
   * @returns {Promise<Object>} The new schedule with its tasks and progress
   */
  async applyCarePlanToGroup(groupId, planId, startDate, userId) {
    const group = await animalGroupRepository.findByIdWithDetails(groupId);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }

    const plan = await animalCarePlanRepository.findWithTasks(planId);
    if (!plan) {
      throw new NotFoundError('Care plan not found');
    }

    if (plan.applies_to === 'individual') {
      throw new ValidationError('This care plan is only applicable to individual animals');
    }

    return this._applyCarePlan(plan, {
      groupId,
      startDate: startDate || group.date_established || group.acquisition_date,
      userId,
      groupQuantity: group.current_quantity ?? group.quantity,
    });
  }

  /**
   * Create a schedule for an animal or a group, with its tasks
   * @private
   */
  async _applyCarePlan(plan, { animalId = null, groupId = null, startDate, userId, groupQuantity = null }) {
    const subject = animalId ? { animal_id: animalId } : { animal_group_id: groupId };
    if (await animalCareScheduleRepository.exists({ ...subject, plan_id: plan.id, status: 'active' })) {
      throw new ConflictError(
        `This ${animalId ? 'animal' : 'group'} already follows this care plan; cancel that schedule to start it again`,
        'CARE_PLAN_ALREADY_ACTIVE'
      );
    }

    const schedule = await db.tx(async (t) => {
      const created = await animalCareScheduleRepository.create(
        { ...subject, plan_id: plan.id, start_date: startDate, applied_by: userId, status: 'active' },
        t
      );
      const scheduleStartDate = new Date(created.start_date);
      const totalDays = plan.total_duration_days || 365;
      for (const planTask of plan.tasks) {
        await this._generateScheduledAnimalTasks(
          created.id,
          animalId,
          groupId,
          planTask,
          scheduleStartDate,
          totalDays,
          groupQuantity,
          t
        );
      }
      return created;
    });

    // Update statuses based on current date
    await scheduledAnimalTaskRepository.updateStatuses();

    return this._withTasksAndProgress(await animalCareScheduleRepository.findWithPlan(schedule.id));
  }

  /**
   * Generate scheduled tasks from a plan task
   * @private
   */
  async _generateScheduledAnimalTasks(
    scheduleId,
    animalId,
    groupId,
    planTask,
    startDate,
    totalDays,
    groupQuantity = null,
    t
  ) {
    const createTask = async (dayOffset, recurringSeq = null) => {
      const plannedDate = addDays(startDate, dayOffset);
      const dueStart = addDays(plannedDate, -(planTask.tolerance_days_before || 0));
      const dueEnd = addDays(plannedDate, planTask.tolerance_days_after || 2);

      await scheduledAnimalTaskRepository.create(
        {
          animal_id: animalId,
          animal_group_id: groupId,
          schedule_id: scheduleId,
          plan_task_id: planTask.id,
          planned_date: plannedDate,
          due_date_start: dueStart,
          due_date_end: dueEnd,
          task_name: planTask.task_name,
          description: planTask.description,
          task_type: planTask.task_type,
          priority: planTask.priority,
          estimated_hours: planTask.estimated_hours,
          input_type: planTask.input_type,
          input_product_name: planTask.input_product_name,
          input_quantity: planTask.input_quantity,
          input_unit: planTask.input_unit,
          input_dosage_per_animal: planTask.input_dosage_per_animal,
          input_application_method: planTask.input_application_method,
          quantity_total: groupQuantity,
          is_recurring_instance: recurringSeq !== null,
          recurring_sequence: recurringSeq,
          status: 'pending',
        },
        t
      );
    };

    // Create the initial task
    await createTask(planTask.days_from_start, planTask.is_recurring ? 1 : null);

    // Handle recurring tasks
    if (planTask.is_recurring && planTask.recurrence_interval_days) {
      const startDay =
        planTask.recurrence_start_days !== null ? planTask.recurrence_start_days : planTask.days_from_start;
      const endDay = planTask.recurrence_end_days !== null ? planTask.recurrence_end_days : totalDays;

      let currentDay = startDay + planTask.recurrence_interval_days;
      let sequence = 2;

      while (currentDay <= endDay) {
        await createTask(currentDay, sequence);
        currentDay += planTask.recurrence_interval_days;
        sequence++;
      }
    }
  }

  /**
   * Active care schedules of an animal, each with its tasks and progress
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async getAnimalCareSchedules(animalId) {
    const schedules = await animalCareScheduleRepository.findActive({ animal_id: animalId });
    return Promise.all(schedules.map((schedule) => this._withTasksAndProgress(schedule)));
  }

  /**
   * Active care schedules of a group, each with its tasks and progress
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getGroupCareSchedules(groupId) {
    const schedules = await animalCareScheduleRepository.findActive({ animal_group_id: groupId });
    return Promise.all(schedules.map((schedule) => this._withTasksAndProgress(schedule)));
  }

  /**
   * @private
   */
  async _withTasksAndProgress(schedule) {
    const [tasks, progress] = await Promise.all([
      scheduledAnimalTaskRepository.findByScheduleId(schedule.id),
      animalCareScheduleRepository.getProgress(schedule.id),
    ]);
    return { ...schedule, tasks, progress };
  }

  /**
   * Get all care schedules with progress
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllCareSchedules(filters = {}) {
    return await animalCareScheduleRepository.findAllWithProgress(filters);
  }

  /**
   * Cancel a care schedule
   * @param {number} scheduleId - Schedule ID
   * @returns {Promise<void>}
   */
  async cancelCareSchedule(scheduleId) {
    const schedule = await animalCareScheduleRepository.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundError('Care schedule not found');
    }

    await animalCareScheduleRepository.update(scheduleId, { status: 'cancelled' });
  }

  // ==================== SCHEDULED TASKS ====================

  /**
   * Get upcoming scheduled tasks
   * @param {number} daysAhead - Days to look ahead
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getUpcomingScheduledTasks(daysAhead = 7, filters = {}) {
    return await scheduledAnimalTaskRepository.findUpcoming(daysAhead, filters);
  }

  /**
   * Get overdue scheduled tasks
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getOverdueScheduledTasks(filters = {}) {
    return await scheduledAnimalTaskRepository.findOverdue(filters);
  }

  /**
   * Get scheduled tasks by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getScheduledTasksByDateRange(startDate, endDate, filters = {}) {
    return await scheduledAnimalTaskRepository.findByDateRange(startDate, endDate, filters);
  }

  /**
   * Complete a scheduled task
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} notes - Completion notes
   * @param {number} quantityTreated - For groups, how many were treated
   * @returns {Promise<Object>}
   */
  async completeScheduledTask(taskId, userId, notes = null, quantityTreated = null) {
    const task = await scheduledAnimalTaskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Scheduled task not found');
    }

    if (task.status === 'completed') {
      throw new ConflictError('Task is already completed');
    }

    return await scheduledAnimalTaskRepository.markCompleted(taskId, userId, notes, quantityTreated);
  }

  /**
   * Partially complete a scheduled task (for groups)
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {number} quantityTreated - Number treated
   * @param {string} notes - Notes
   * @returns {Promise<Object>}
   */
  async partiallyCompleteScheduledTask(taskId, userId, quantityTreated, notes = null) {
    const task = await scheduledAnimalTaskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Scheduled task not found');
    }

    if (task.status === 'completed' || task.status === 'skipped') {
      throw new ConflictError('Task is already completed or skipped');
    }

    return await scheduledAnimalTaskRepository.markPartiallyCompleted(taskId, userId, quantityTreated, notes);
  }

  /**
   * Skip a scheduled task
   * @param {number} taskId - Task ID
   * @param {number} userId - User ID
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>}
   */
  async skipScheduledTask(taskId, userId, reason) {
    const task = await scheduledAnimalTaskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundError('Scheduled task not found');
    }

    if (task.status === 'completed' || task.status === 'skipped') {
      throw new ConflictError('Task is already completed or skipped');
    }

    return await scheduledAnimalTaskRepository.markSkipped(taskId, userId, reason);
  }

  /**
   * Update scheduled task statuses
   * @returns {Promise<Object>}
   */
  async updateScheduledTaskStatuses() {
    return await scheduledAnimalTaskRepository.updateStatuses();
  }

  /**
   * Get calendar data for scheduled tasks
   * @param {number} year - Year
   * @param {number} month - Month
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getScheduledTasksCalendar(year, month, filters = {}) {
    return await scheduledAnimalTaskRepository.getCalendarData(year, month, filters);
  }

  /**
   * Get care alerts summary
   * @param {number} daysAhead - Days to look ahead for upcoming
   * @returns {Promise<Object>}
   */
  async getCareAlertsSummary(daysAhead = 7) {
    const [upcoming, overdue, recentDeaths] = await Promise.all([
      scheduledAnimalTaskRepository.findUpcoming(daysAhead),
      scheduledAnimalTaskRepository.findOverdue(),
      animalDeathRepository.getRecentDeaths(7, 5),
    ]);

    return {
      upcoming_count: upcoming.length,
      overdue_count: overdue.length,
      recent_deaths_count: recentDeaths.length,
      upcoming_tasks: upcoming.slice(0, 10),
      overdue_tasks: overdue.slice(0, 10),
      recent_deaths: recentDeaths,
    };
  }

  // ==================== BREEDING RECORDS ====================

  /**
   * Get all breeding records with optional filters
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllBreedingRecords(filters = {}) {
    return await breedingRecordRepository.findAllWithDetails(filters);
  }

  /**
   * Get breeding record by ID
   * @param {number} id - Breeding record ID
   * @returns {Promise<Object>}
   */
  async getBreedingRecordById(id) {
    const record = await breedingRecordRepository.findByIdWithDetails(id);
    if (!record) {
      throw new NotFoundError('Breeding record not found');
    }
    return record;
  }

  /**
   * Get breeding records for an animal
   * @param {number} animalId - Animal ID
   * @returns {Promise<Array>}
   */
  async getBreedingRecordsByAnimal(animalId) {
    return await breedingRecordRepository.findByAnimalId(animalId);
  }

  /**
   * Create a breeding record
   * @param {Object} data - Breeding record data
   * @returns {Promise<Object>}
   */
  async createBreedingRecord(data) {
    if (!data.male_animal_id || !data.female_animal_id) {
      throw new ValidationError('Both male_animal_id and female_animal_id are required');
    }

    // Verify both animals exist
    const maleAnimal = await animalRepository.findById(data.male_animal_id);
    if (!maleAnimal) {
      throw new NotFoundError('Male animal not found');
    }

    const femaleAnimal = await animalRepository.findById(data.female_animal_id);
    if (!femaleAnimal) {
      throw new NotFoundError('Female animal not found');
    }

    // Verify they are the same type
    if (maleAnimal.animal_breed_id !== femaleAnimal.animal_breed_id) {
      const maleBreed = await animalBreedRepository.findById(maleAnimal.animal_breed_id);
      const femaleBreed = await animalBreedRepository.findById(femaleAnimal.animal_breed_id);

      if (maleBreed.animal_type_id !== femaleBreed.animal_type_id) {
        throw new ValidationError('Animals must be of the same type for breeding');
      }
    }

    // Verify gender
    if (maleAnimal.gender !== 'male') {
      throw new ValidationError('First animal must be male');
    }
    if (femaleAnimal.gender !== 'female') {
      throw new ValidationError('Second animal must be female');
    }

    return await breedingRecordRepository.create(data);
  }

  /**
   * Update a breeding record
   * @param {number} id - Breeding record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateBreedingRecord(id, data) {
    const record = await breedingRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Breeding record not found');
    }

    // Offspring go into the target group only the first time they are recorded,
    // so re-saving the record does not add them again
    const addOffspring = data.target_group_id && data.offspring_count > 0 && !(record.offspring_count > 0);
    if (addOffspring) {
      const group = await animalGroupRepository.findById(data.target_group_id);
      if (!group) {
        throw new NotFoundError('Target group not found');
      }
    }

    // Remove target_group_id from data as it's not a breeding_records column
    const { target_group_id: targetGroupId, ...breedingData } = data;

    return await db.tx(async (t) => {
      if (addOffspring) {
        await animalGroupRepository.recordAddition(
          targetGroupId,
          data.offspring_count,
          'born',
          {
            adjustment_date: data.actual_delivery_date || new Date(),
            reason: 'Birth/Hatching from breeding record',
            reference_type: 'breeding_record',
            reference_id: id,
            notes: data.notes || `Added ${data.offspring_count} offspring from breeding`,
            recorded_by: data.recorded_by,
          },
          t
        );
      }
      return await breedingRecordRepository.update(id, breedingData, t);
    });
  }

  /**
   * Delete a breeding record
   * @param {number} id - Breeding record ID
   * @returns {Promise<void>}
   */
  async deleteBreedingRecord(id) {
    const record = await breedingRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Breeding record not found');
    }
    await breedingRecordRepository.softDelete(id);
  }

  /**
   * Get breeding statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getBreedingStatistics(filters = {}) {
    return await breedingRecordRepository.getStatistics(filters);
  }

  /**
   * Get expected deliveries
   * @param {number} days - Days to look ahead
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getExpectedDeliveries(days = 30, limit = 20) {
    return await breedingRecordRepository.getExpectedDeliveries(days, limit);
  }

  /**
   * Get overdue deliveries
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getOverdueDeliveries(limit = 20) {
    return await breedingRecordRepository.getOverdueDeliveries(limit);
  }

  /**
   * Get breeding performance for an animal
   * @param {number} animalId - Animal ID
   * @param {string} role - 'male', 'female', or 'both'
   * @returns {Promise<Object>}
   */
  async getBreedingPerformance(animalId, role = 'both') {
    return await breedingRecordRepository.getBreedingPerformance(animalId, role);
  }

  /**
   * Get breeding success rate by type
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getBreedingSuccessRateByType(filters = {}) {
    return await breedingRecordRepository.getSuccessRateByType(filters);
  }

  // ==================== LIVESTOCK SALES ====================

  /**
   * Get all animal sales with optional filters
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllAnimalSales(filters = {}) {
    return await animalSaleRepository.findAllWithDetails(filters);
  }

  /**
   * Get animal sale by ID
   * @param {number} id - Sale ID
   * @returns {Promise<Object>}
   */
  async getAnimalSaleById(id) {
    const sale = await animalSaleRepository.findByIdWithDetails(id);
    if (!sale) {
      throw new NotFoundError('Sale record not found');
    }
    return sale;
  }

  /**
   * Create an animal sale record. Selling an animal, or animals from a group,
   * inside a meat withdrawal period is refused (409 WITHDRAWAL_ACTIVE) unless
   * the owner gives an override_reason.
   * @param {Object} data - Sale data, with optional override_reason
   * @param {Object} user - { id, role }
   * @returns {Promise<Object>}
   */
  async createAnimalSale(data, user) {
    // Validate that either animal_id or animal_group_id is provided in reference
    if (!data.reference_type || !data.reference_id) {
      throw new ValidationError('Reference type and ID are required');
    }

    if (!['animal', 'animal_group'].includes(data.reference_type)) {
      throw new ValidationError('Reference type must be animal or animal_group');
    }

    // Calculate total if not provided
    if (!data.total_amount && data.quantity && data.unit_price) {
      data.total_amount = data.quantity * data.unit_price;
    }

    // Set default payment status
    if (!data.payment_status) {
      data.payment_status = 'paid';
    }

    if (data.reference_type === 'animal') {
      const animal = await animalRepository.findById(data.reference_id);
      if (!animal) {
        throw new NotFoundError('Animal not found');
      }
      if (animal.status !== 'active') {
        throw new ConflictError('Can only sell active animals');
      }

      return await db.tx(async (t) => {
        const sale = await animalSaleRepository.create(await this.withSaleOverride(data, user, t), t);
        await animalRepository.updateStatus(data.reference_id, 'sold', data.sale_date, t);
        return sale;
      });
    }

    const group = await animalGroupRepository.findById(data.reference_id);
    if (!group) {
      throw new NotFoundError('Animal group not found');
    }
    if (group.status === 'closed') {
      throw new ConflictError('Cannot sell from a closed group');
    }

    return await db.tx(async (t) => {
      const sale = await animalSaleRepository.create(await this.withSaleOverride(data, user, t), t);
      // Throws (and rolls back the sale) if the group does not have enough animals
      await animalGroupRepository.recordRemoval(
        data.reference_id,
        data.quantity,
        'sale',
        {
          adjustment_date: data.sale_date,
          reason: `Sold to ${data.customer_name || 'customer'}`,
          reference_type: 'sale',
          reference_id: sale.id,
          unit_value: data.unit_price,
          total_value: data.total_amount,
          notes: data.notes,
          recorded_by: data.recorded_by,
        },
        t
      );
      return sale;
    });
  }

  /**
   * Update an animal sale record. Moving it to another date checks the meat
   * withdrawal period again, as for a new sale.
   * @param {number} id - Sale ID
   * @param {Object} data - Updated data, with optional override_reason
   * @param {Object} user - { id, role }
   * @returns {Promise<Object>}
   */
  async updateAnimalSale(id, data, user) {
    return db.tx(async (t) => {
      const sale = await animalSaleRepository.findById(id, t);
      if (!sale) {
        throw new NotFoundError('Sale record not found');
      }

      const changes = withdrawalService.withoutOverride(data);
      // Recalculate total if quantity or unit_price changed
      if (changes.quantity || changes.unit_price) {
        const quantity = changes.quantity || sale.quantity;
        const unitPrice = changes.unit_price || sale.unit_price;
        changes.total_amount = quantity * unitPrice;
      }

      if (changes.sale_date && toDateString(changes.sale_date) !== sale.sale_date) {
        const override = await withdrawalService.checkSale(
          { ...sale, sale_date: changes.sale_date },
          { user, override_reason: data.override_reason },
          t
        );
        Object.assign(changes, override);
      }

      return await animalSaleRepository.update(sale.id, changes, t);
    });
  }

  /**
   * Sale data to save: the client's fields without override columns, plus
   * the override if the owner had to give one
   * @private
   */
  async withSaleOverride(data, user, t) {
    const override = await withdrawalService.checkSale(data, { user, override_reason: data.override_reason }, t);
    return { ...withdrawalService.withoutOverride(data), ...override };
  }

  /**
   * Delete an animal sale record
   * @param {number} id - Sale ID
   * @returns {Promise<void>}
   */
  async deleteAnimalSale(id) {
    const sale = await animalSaleRepository.findById(id);
    if (!sale) {
      throw new NotFoundError('Sale record not found');
    }

    // Deleting a sale means it was recorded in error: put the stock back
    await db.tx(async (t) => {
      await animalSaleRepository.softDelete(id, t);

      if (sale.reference_type === 'animal_group') {
        await animalGroupRepository.recordAddition(
          sale.reference_id,
          sale.quantity,
          'correction',
          { reason: 'Sale record deleted', reference_type: 'sale', reference_id: sale.id },
          t
        );
      } else if (sale.reference_type === 'animal') {
        const animal = await animalRepository.findById(sale.reference_id, t);
        if (animal && animal.status === 'sold') {
          await animalRepository.updateStatus(sale.reference_id, 'active', new Date(), t);
        }
      }
    });
  }

  /**
   * Get animal sales statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getAnimalSalesStatistics(filters = {}) {
    return await animalSaleRepository.getStatistics(filters);
  }

  /**
   * Get sales by animal type
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getSalesByAnimalType(filters = {}) {
    return await animalSaleRepository.getSalesByAnimalType(filters);
  }

  /**
   * Get monthly sales summary
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getMonthlySales(filters = {}) {
    return await animalSaleRepository.getMonthlySales(filters);
  }

  /**
   * Get top customers
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getTopCustomers(filters = {}) {
    return await animalSaleRepository.getTopCustomers(filters);
  }

  /**
   * Get recent animal sales
   * @param {number} days - Days to look back
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getRecentAnimalSales(days = 30, limit = 10) {
    return await animalSaleRepository.getRecentSales(days, limit);
  }

  /**
   * Get pending payment sales
   * @param {number} limit - Max records
   * @returns {Promise<Array>}
   */
  async getPendingPayments(limit = 20) {
    return await animalSaleRepository.getPendingPayments(limit);
  }

  // ==================== INCUBATION RECORDS ====================

  /**
   * Get all incubation records
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getAllIncubationRecords(filters = {}) {
    return await incubationRecordRepository.findAllWithDetails(filters);
  }

  /**
   * Get incubation record by ID
   * @param {number} id - Incubation record ID
   * @returns {Promise<Object>}
   */
  async getIncubationRecordById(id) {
    const record = await incubationRecordRepository.findByIdWithDetails(id);
    if (!record) {
      throw new NotFoundError('Incubation record not found');
    }
    return record;
  }

  /**
   * Get incubation records for a group
   * @param {number} groupId - Group ID
   * @returns {Promise<Array>}
   */
  async getIncubationRecordsByGroup(groupId) {
    return await incubationRecordRepository.findByGroupId(groupId);
  }

  /**
   * Create an incubation record
   * @param {Object} data - Incubation data
   * @returns {Promise<Object>}
   */
  async createIncubationRecord(data) {
    // Generate batch code if not provided
    if (!data.batch_code) {
      data.batch_code = await incubationRecordRepository.generateBatchCode('INC');
    }

    // Verify breed exists
    if (data.animal_breed_id) {
      const breed = await animalBreedRepository.findById(data.animal_breed_id);
      if (!breed) {
        throw new NotFoundError('Animal breed not found');
      }
    }

    // Verify source group exists if provided
    if (data.animal_group_id) {
      const group = await animalGroupRepository.findById(data.animal_group_id);
      if (!group) {
        throw new NotFoundError('Source animal group not found');
      }
    }

    // Verify target group exists if provided
    if (data.target_group_id) {
      const targetGroup = await animalGroupRepository.findById(data.target_group_id);
      if (!targetGroup) {
        throw new NotFoundError('Target group not found');
      }
    }

    return await incubationRecordRepository.create(data);
  }

  /**
   * Update an incubation record
   * @param {number} id - Incubation record ID
   * @param {Object} data - Updated data
   * @returns {Promise<Object>}
   */
  async updateIncubationRecord(id, data) {
    const record = await incubationRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Incubation record not found');
    }

    // Hatched chicks go into the target group only the first time the hatch is
    // recorded, so re-saving the record does not add them again
    const recordHatch =
      data.actual_hatch_date && data.hatched_count > 0 && data.target_group_id && !record.actual_hatch_date;
    if (recordHatch) {
      const targetGroup = await animalGroupRepository.findById(data.target_group_id);
      if (!targetGroup) {
        throw new NotFoundError('Target group not found');
      }

      // Auto-update status based on hatch results
      data.status = data.hatched_count >= record.eggs_count ? 'hatched' : 'partial';
    }

    return await db.tx(async (t) => {
      if (recordHatch) {
        await animalGroupRepository.recordAddition(
          data.target_group_id,
          data.hatched_count,
          'hatched',
          {
            adjustment_date: data.actual_hatch_date,
            reason: 'Hatched from incubation',
            reference_type: 'incubation_record',
            reference_id: id,
            notes: data.notes || `Added ${data.hatched_count} hatched chicks from batch ${record.batch_code}`,
            recorded_by: data.recorded_by,
          },
          t
        );
      }
      return await incubationRecordRepository.update(id, data, t);
    });
  }

  /**
   * Delete an incubation record
   * @param {number} id - Incubation record ID
   * @returns {Promise<void>}
   */
  async deleteIncubationRecord(id) {
    const record = await incubationRecordRepository.findById(id);
    if (!record) {
      throw new NotFoundError('Incubation record not found');
    }
    await incubationRecordRepository.softDelete(id);
  }

  /**
   * Get active incubations
   * @returns {Promise<Array>}
   */
  async getActiveIncubations() {
    return await incubationRecordRepository.getActiveIncubations();
  }

  /**
   * Get incubations due to hatch
   * @param {number} days - Days to look ahead
   * @returns {Promise<Array>}
   */
  async getDueToHatch(days = 7) {
    return await incubationRecordRepository.getDueToHatch(days);
  }

  /**
   * Get overdue hatching records
   * @returns {Promise<Array>}
   */
  async getOverdueHatching() {
    return await incubationRecordRepository.getOverdueHatching();
  }

  /**
   * Get incubation statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>}
   */
  async getIncubationStatistics(filters = {}) {
    return await incubationRecordRepository.getStatistics(filters);
  }

  /**
   * Get hatch rate by breed
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getHatchRateByBreed(filters = {}) {
    return await incubationRecordRepository.getHatchRateByBreed(filters);
  }

  /**
   * Get monthly incubation summary
   * @param {number} months - Months to look back
   * @returns {Promise<Array>}
   */
  async getMonthlyIncubationSummary(months = 6) {
    return await incubationRecordRepository.getMonthlyIncubationSummary(months);
  }
}

module.exports = new AnimalService();
