const cropInputApplicationRepository = require('../repositories/crop-input-application.repository');
const treatmentMedicationRepository = require('../repositories/treatment-medication.repository');
const { AuthorizationError, ConflictError } = require('../utils/errors');
const { toDateString } = require('../utils/dates');

/** Production type categories that a withdrawal period applies to */
const PRODUCT_BY_CATEGORY = { milk: 'milk', eggs: 'egg', meat: 'meat' };

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
   * Withdrawal holds on an animal's or a group's milk, meat or eggs
   * @param {Object} target - animal_id or animal_group_id
   * @param {string} product - 'milk', 'meat' or 'egg'
   * @param {string|Date} date - Date of the produce or sale
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>} { source, id, treatment_id, disease_name, product_name, applied_on, safe_from }
   */
  async animalHolds(target, product, date, t) {
    const rows = await treatmentMedicationRepository.findHolds(target, product, toDateString(date), t);
    return rows.map((row) => ({
      source: 'treatment_medication',
      id: row.id,
      treatment_id: row.treatment_id,
      disease_name: row.disease_name,
      product_name: row.product_name,
      applied_on: row.administered_date,
      safe_from: row.safe_from,
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
   * Refuse milk, eggs or meat produced inside a withdrawal period unless the
   * owner overrides it. Other production categories are never held.
   * @param {Object} record - animal_id or animal_group_id, and production_date
   * @param {string} category - The production type's category
   * @param {Object} options - user ({id, role}), override_reason
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} withdrawal_override_reason and withdrawal_override_by to store
   */
  async checkProduction(record, category, options, t) {
    const product = PRODUCT_BY_CATEGORY[category];
    const holds = product ? await this.animalHolds(record, product, record.production_date, t) : [];
    return this.enforce(holds, `${category} record`, options);
  }

  /**
   * Refuse selling an animal, or animals from a group, inside a meat
   * withdrawal period unless the owner overrides it (a sold animal may be
   * slaughtered; the owner can override for breeding stock)
   * @param {Object} sale - reference_type, reference_id, sale_date (only animal and animal_group sales are held)
   * @param {Object} options - user ({id, role}), override_reason
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Object>} withdrawal_override_reason and withdrawal_override_by to store
   */
  async checkSale(sale, options, t) {
    const targets = {
      animal: { animal_id: sale.reference_id },
      animal_group: { animal_group_id: sale.reference_id },
    };
    const target = targets[sale.reference_type];
    const holds = target ? await this.animalHolds(target, 'meat', sale.sale_date, t) : [];
    return this.enforce(holds, 'sale', options);
  }

  /**
   * Everything held on a date: crop batches that cannot be harvested, and
   * animals or groups whose milk, meat or eggs cannot be used
   * @param {string|Date} [date] - Defaults to today
   * @returns {Promise<Object>} { date, crops: [...], animals: [...] }, each entry with
   *   its latest safe_from and the holds behind it
   */
  async activeHolds(date = new Date()) {
    const day = toDateString(date);
    const [applications, doses] = await Promise.all([
      cropInputApplicationRepository.findAllPhiHolds(day),
      treatmentMedicationRepository.findAllHolds(day),
    ]);

    const crops = groupHolds(
      applications,
      (row) => row.batch_id,
      (row) => ({ batch_id: row.batch_id, batch_code: row.batch_code, product: 'harvest' }),
      (row) => ({
        source: 'crop_input_application',
        id: row.id,
        product_name: row.product_name,
        applied_on: row.application_date,
        safe_from: row.safe_harvest_date,
      })
    );
    const animals = groupHolds(
      doses,
      (row) => `${row.animal_id || ''}:${row.animal_group_id || ''}:${row.product}`,
      (row) => ({
        animal_id: row.animal_id,
        animal_tag: row.animal_tag,
        animal_name: row.animal_name,
        animal_group_id: row.animal_group_id,
        group_name: row.group_name,
        group_code: row.group_code,
        product: row.product,
      }),
      (row) => ({
        source: 'treatment_medication',
        id: row.id,
        treatment_id: row.treatment_id,
        disease_name: row.disease_name,
        product_name: row.product_name,
        applied_on: row.administered_date,
        safe_from: row.safe_from,
      })
    );

    return { date: day, crops, animals };
  }

  /**
   * Drop override columns from client data: only enforce() sets them
   * @param {Object} data - Request fields
   * @returns {Object} data without withdrawal_override_reason / _by
   */
  withoutOverride(data) {
    // eslint-disable-next-line no-unused-vars
    const { withdrawal_override_reason, withdrawal_override_by, ...rest } = data;
    return rest;
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

    const safeFrom = latest(holds);
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

/** The latest safe_from among holds ('YYYY-MM-DD' strings sort as dates) */
function latest(holds) {
  return holds.reduce((max, hold) => (hold.safe_from > max ? hold.safe_from : max), '');
}

/** Collect flat hold rows into one entry per subject, latest safe date first */
function groupHolds(rows, keyOf, subjectOf, holdOf) {
  const entries = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    if (!entries.has(key)) {
      entries.set(key, { ...subjectOf(row), holds: [] });
    }
    entries.get(key).holds.push(holdOf(row));
  }
  return [...entries.values()]
    .map((entry) => ({ ...entry, safe_from: latest(entry.holds) }))
    .sort((a, b) => (a.safe_from < b.safe_from ? 1 : a.safe_from > b.safe_from ? -1 : 0));
}

module.exports = new WithdrawalService();
module.exports.PRODUCT_BY_CATEGORY = PRODUCT_BY_CATEGORY;
