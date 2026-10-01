const BaseRepository = require('./base.repository');

const SAFE_FROM = { milk: 'milk_safe_from', meat: 'meat_safe_from', egg: 'egg_safe_from' };

/**
 * Repository for treatment_medications: each dose of a product given under a
 * disease/treatment record, with its withdrawal dates
 */
class TreatmentMedicationRepository extends BaseRepository {
  constructor() {
    super('treatment_medications');
  }

  /**
   * Doses given under a treatment, oldest first
   * @param {number} treatmentId - Treatment ID
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>}
   */
  async findByTreatmentId(treatmentId, t) {
    return this.conn(t).any(
      `SELECT tm.*, ii.item_code, u.first_name || ' ' || u.last_name AS recorded_by_name
         FROM treatment_medications tm
         LEFT JOIN inventory_items ii ON ii.id = tm.inventory_item_id
         LEFT JOIN users u ON u.id = tm.recorded_by
        WHERE tm.treatment_id = $1 AND tm.deleted_at IS NULL
        ORDER BY tm.administered_date, tm.id`,
      [treatmentId]
    );
  }

  /**
   * Doses whose withdrawal period for a product is still running on a date,
   * for one animal or one group
   * @param {Object} target - animal_id or animal_group_id
   * @param {string} product - 'milk', 'meat' or 'egg'
   * @param {string} date - 'YYYY-MM-DD'
   * @param {Object} [t] - Task/transaction
   * @returns {Promise<Array>} { id, treatment_id, disease_name, product_name, administered_date, safe_from }
   */
  async findHolds({ animal_id: animalId, animal_group_id: groupId }, product, date, t) {
    return this.conn(t).any(
      `SELECT tm.id, tm.treatment_id, adt.disease_name, tm.product_name, tm.administered_date,
              tm.$4:name AS safe_from
         FROM treatment_medications tm
         JOIN animal_diseases_treatments adt ON adt.id = tm.treatment_id AND adt.deleted_at IS NULL
        WHERE tm.deleted_at IS NULL
          AND (adt.animal_id = $1 OR adt.animal_group_id = $2)
          AND tm.administered_date <= $3 AND tm.$4:name > $3
        ORDER BY tm.$4:name DESC, tm.id`,
      [animalId || null, groupId || null, date, SAFE_FROM[product]]
    );
  }

  /**
   * Every withdrawal period running on a date, one row per dose and product
   * @param {string} date - 'YYYY-MM-DD'
   * @returns {Promise<Array>}
   */
  async findAllHolds(date) {
    const perProduct = Object.entries(SAFE_FROM).map(
      ([product, column]) => `
        SELECT '${product}' AS product, tm.id, tm.treatment_id, adt.disease_name, tm.product_name,
               tm.administered_date, tm.${column} AS safe_from,
               adt.animal_id, a.tag_number AS animal_tag, a.name AS animal_name,
               adt.animal_group_id, ag.name AS group_name, ag.group_code
          FROM treatment_medications tm
          JOIN animal_diseases_treatments adt ON adt.id = tm.treatment_id AND adt.deleted_at IS NULL
          LEFT JOIN animals a ON a.id = adt.animal_id
          LEFT JOIN animal_groups ag ON ag.id = adt.animal_group_id
         WHERE tm.deleted_at IS NULL AND tm.administered_date <= $1 AND tm.${column} > $1`
    );
    return this.db.any(`${perProduct.join(' UNION ALL ')} ORDER BY safe_from DESC, id`, [date]);
  }
}

module.exports = new TreatmentMedicationRepository();
