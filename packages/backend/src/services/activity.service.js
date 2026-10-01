const activityRepository = require('../repositories/activity.repository');
const { AppError, NotFoundError } = require('../utils/errors');

const TITLE_LENGTH = 255;
const HEALTH_RECORD_TYPES = { checkup: 'health_check' };
const HEALTH_RECORD_TITLES = { checkup: 'Health check' };

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const amount = (quantity, unit) => `${Number(quantity)} ${unit}`;
// Old rows may name both an animal and a group; the animal is the more specific subject
const animalSubject = (row) => ({
  animal_id: row.animal_id || null,
  animal_group_id: row.animal_id ? null : row.animal_group_id || null,
});

/**
 * How each detail table's row becomes its activity's fields: type, title,
 * date, subject and cost. Kept in step with backfill_activities() (017).
 */
const DETAILS = {
  crop_input_applications: async (row) => ({
    activity_type: 'input_application',
    title: `${row.product_name} ${amount(row.quantity, row.unit)}`,
    occurred_on: row.application_date,
    crop_batch_id: row.batch_id,
    input_cost: row.total_cost,
  }),
  growth_observations: async (row) => ({
    activity_type: 'observation',
    title: row.growth_stage ? `Observation: ${row.growth_stage}` : 'Observation',
    occurred_on: row.observation_date,
    crop_batch_id: row.batch_id,
  }),
  harvests: async (row) => ({
    activity_type: 'harvest',
    title: `Harvest ${amount(row.quantity, row.unit)}`,
    occurred_on: row.harvest_date,
    crop_batch_id: row.batch_id,
  }),
  crop_pests_diseases: async (row) => ({
    activity_type: 'pest_incident',
    title: `${capitalise(row.type)}: ${row.name}`,
    occurred_on: row.incident_date,
    crop_batch_id: row.batch_id,
  }),
  animal_feed_records: async (row) => ({
    activity_type: 'feeding',
    title: `${row.feed_name || row.feed_type || 'Feed'} ${amount(row.quantity, row.unit)}`,
    occurred_on: row.feed_date,
    ...animalSubject(row),
    input_cost: row.total_cost,
  }),
  animal_health_records: async (row) => ({
    activity_type: HEALTH_RECORD_TYPES[row.record_type] || row.record_type,
    title:
      (HEALTH_RECORD_TITLES[row.record_type] || capitalise(row.record_type)) +
      (row.medication ? `: ${row.medication}` : ''),
    occurred_on: row.record_date,
    ...animalSubject(row),
    other_cost: row.cost,
  }),
  // Medicines are the input cost; the treatment's own cost (vet fees and the like) is other cost
  animal_diseases_treatments: async (row, t) => ({
    activity_type: 'treatment',
    title: `Treatment: ${row.disease_name}`,
    occurred_on: row.diagnosis_date,
    ...animalSubject(row),
    // A new treatment has no doses yet
    input_cost: row.id ? await activityRepository.treatmentMedicationCost(row.id, t) : null,
    other_cost: row.cost,
  }),
  animal_production_records: async (row, t) => {
    const type = await activityRepository.productionType(row.production_type_id, t);
    return {
      activity_type: 'production',
      title: `${type ? type.name : 'Production'} ${amount(row.quantity, type ? type.unit : '')}`.trim(),
      occurred_on: row.production_date,
      ...animalSubject(row),
    };
  },
};

/**
 * Fields of the activity that mirrors a detail row
 * @private
 */
async function fieldsFor(table, row, t) {
  const toActivity = DETAILS[table];
  if (!toActivity) {
    throw new AppError(`No activity mapping for ${table}`, 500, 'SERVER_ERROR');
  }
  const fields = await toActivity(row, t);
  return {
    input_cost: null,
    other_cost: null,
    ...fields,
    title: fields.title.slice(0, TITLE_LENGTH),
    notes: row.notes ?? null,
  };
}

/**
 * Activities: the farm-wide record of what was done (ADR-001). Every service
 * that writes a detail row records, syncs and removes its activity here,
 * inside the same transaction.
 */
class ActivityService {
  /**
   * Record an activity. A crop batch's location is copied onto it, and the
   * person who did the work defaults to the recording user's employee record.
   * @param {Object} t - Transaction
   * @param {Object} fields - Activity columns (see activity.repository)
   * @returns {Promise<Object>} The activity
   */
  async record(t, fields) {
    const values = { status: 'done', ...fields };
    if (values.crop_batch_id && values.location_id === undefined) {
      values.location_id = await activityRepository.batchLocationId(values.crop_batch_id, t);
    }
    if (values.performed_by === undefined && values.recorded_by) {
      values.performed_by = await activityRepository.employeeIdForUser(values.recorded_by, t);
    }
    return activityRepository.create(values, t);
  }

  /**
   * Write a detail row with its activity: the activity first, then the row
   * pointing at it. A cost settled after the insert (a stock draw, a dose)
   * reaches the activity through syncDetail.
   * @param {Object} t - Transaction
   * @param {string} table - Detail table, e.g. 'harvests'
   * @param {Object} repository - The detail table's repository
   * @param {Object} data - The detail row's columns
   * @param {Object} [extra] - More activity columns, e.g. client_request_id
   * @returns {Promise<Object>} The saved row, with its activity_id
   */
  async createDetail(t, table, repository, data, extra = {}) {
    const activity = await this.record(t, {
      ...(await fieldsFor(table, data, t)),
      recorded_by: data.recorded_by ?? null,
      ...extra,
    });
    return repository.createLinked(data, activity.id, t);
  }

  /**
   * Bring a detail row's activity in step after the row, or a cost under
   * it, changed
   * @param {Object} t - Transaction
   * @param {string} table - Detail table
   * @param {Object} row - The detail row as saved
   * @returns {Promise<Object>} The row
   */
  async syncDetail(t, table, row) {
    await activityRepository.update(row.activity_id, await fieldsFor(table, row, t), t);
    return row;
  }

  /**
   * Remove the activity of a soft-deleted detail row
   * @param {Object} t - Transaction
   * @param {Object} row - The detail row
   */
  async removeDetail(t, row) {
    if (row.activity_id) {
      await activityRepository.softDelete(row.activity_id, t);
    }
  }

  /**
   * The farm timeline
   * @param {number} page - Page number
   * @param {number} limit - Page size
   * @param {Object} filters - See activityRepository.paginateTimeline
   * @param {Object} sort - { field, order }
   * @returns {Promise<{data: Array, pagination: Object}>}
   */
  async getTimeline(page, limit, filters, sort) {
    return activityRepository.paginateTimeline(page, limit, filters, sort);
  }

  /**
   * One activity
   * @param {number} id - Activity ID
   * @returns {Promise<Object>}
   */
  async getActivity(id) {
    const activity = await activityRepository.findById(id);
    if (!activity) {
      throw new NotFoundError('Activity not found');
    }
    return activity;
  }
}

module.exports = new ActivityService();
