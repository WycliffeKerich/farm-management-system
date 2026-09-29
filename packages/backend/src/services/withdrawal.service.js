const cropInputApplicationRepository = require('../repositories/crop-input-application.repository');
const { AuthorizationError, ConflictError } = require('../utils/errors');
const { toDateString } = require('../utils/dates');

/**
 * Withdrawal periods and pre-harvest intervals.
 *
 * Nothing is stored on the crop or animal: every application or dose keeps
 * its own safe date, and a product is held on a date while any record made
 * on or before that date has a safe date after it. Holds are worked out when
 * a harvest, production record or sale is written.
 */
class WithdrawalService {
  /**
   * Pre-harvest interval holds on a crop batch
   * @param {number} batchId - Crop batch ID
   * @param {string|Date} date - Harvest date
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>} { source, id, product_name, applied_on, safe_from }
   */
  async cropHolds(batchId, date, t) {
    const rows = await cropInputApplicationRepository.findPhiHolds(batchId, toDateString(date), t);
    return rows.map((row) => ({
      source: 'crop_input_application',
      id: row.id,
      product_name: row.product_name,
      applied_on: row.application_date,
      safe_from: row.safe_harvest_date,
    }));
  }

  /**
   * Refuse a harvest inside a pre-harvest interval unless the owner overrides it
   * @param {number} batchId - Crop batch ID
   * @param {string|Date} date - Harvest date
   * @param {Object} options - user ({id, role}), override_reason
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} withdrawal_override_reason and withdrawal_override_by to store
   */
  async checkHarvest(batchId, date, options, t) {
    const holds = await this.cropHolds(batchId, date, t);
    return this.enforce(holds, 'harvest', options);
  }

  /**
   * Turn holds into a refusal or a recorded override
   * @param {Array} holds - From cropHolds / animalHolds
   * @param {string} what - What is being recorded, for the message
   * @param {Object} options - user ({id, role}), override_reason
   * @returns {Object} withdrawal_override_reason and withdrawal_override_by to store
   * @throws {ConflictError} WITHDRAWAL_ACTIVE when held and no override is given
   * @throws {AuthorizationError} when someone other than the owner overrides
   */
  enforce(holds, what, { user, override_reason: overrideReason } = {}) {
    const none = { withdrawal_override_reason: null, withdrawal_override_by: null };
    if (holds.length === 0) {
      return none;
    }

    const safeFrom = holds
      .map((hold) => hold.safe_from)
      .sort()
      .pop();
    const reason = typeof overrideReason === 'string' ? overrideReason.trim() : '';
    if (!reason) {
      const products = [...new Set(holds.map((hold) => hold.product_name))].join(', ');
      throw new ConflictError(
        `This ${what} falls within the withdrawal period of ${products}; it is safe from ${safeFrom}`,
        'WITHDRAWAL_ACTIVE',
        { safe_from: safeFrom, holds }
      );
    }
    if (!user || user.role !== 'owner') {
      throw new AuthorizationError('Only the owner can override a withdrawal period');
    }
    return { withdrawal_override_reason: reason, withdrawal_override_by: user.id };
  }
}

module.exports = new WithdrawalService();
