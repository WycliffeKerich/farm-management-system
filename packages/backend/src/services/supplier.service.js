const supplierRepository = require('../repositories/supplier.repository');
const { NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Service for suppliers
 */
class SupplierService {
  /**
   * List suppliers
   * @param {Object} [filters] - search, include_inactive
   * @returns {Promise<Array>} Suppliers with item_count and batch_count
   */
  async getAll(filters = {}) {
    return supplierRepository.findAllWithCounts(filters);
  }

  /**
   * Get a supplier
   * @param {number} id - Supplier ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} Supplier
   * @throws {NotFoundError}
   */
  async getById(id, t) {
    const supplier = await supplierRepository.findById(id, t);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }
    return supplier;
  }

  /**
   * Create a supplier
   * @param {Object} data - Supplier fields
   * @returns {Promise<Object>} Created supplier
   * @throws {ConflictError} DUPLICATE when the name is taken
   */
  async create(data) {
    await this.assertNameFree(data.name);
    return supplierRepository.create({ ...data, name: data.name.trim() });
  }

  /**
   * Update a supplier
   * @param {number} id - Supplier ID
   * @param {Object} data - Changed fields
   * @returns {Promise<Object>} Updated supplier
   * @throws {NotFoundError|ConflictError}
   */
  async update(id, data) {
    const supplier = await this.getById(id);
    if (data.name) {
      await this.assertNameFree(data.name, supplier.id);
      data = { ...data, name: data.name.trim() };
    }
    return supplierRepository.update(supplier.id, data);
  }

  /**
   * Delete a supplier no item or batch refers to (deactivate it otherwise)
   * @param {number} id - Supplier ID
   * @throws {NotFoundError|ConflictError} IN_USE
   */
  async delete(id) {
    const supplier = await this.getById(id);
    if (await supplierRepository.isInUse(supplier.id)) {
      throw new ConflictError('Items or batches still refer to this supplier; deactivate it instead', 'IN_USE');
    }
    await supplierRepository.softDelete(supplier.id);
  }

  /**
   * @private
   */
  async assertNameFree(name, exceptId) {
    const existing = await supplierRepository.findByName(name);
    if (existing && existing.id !== exceptId) {
      throw new ConflictError('A supplier with this name already exists', 'DUPLICATE');
    }
  }
}

module.exports = new SupplierService();
