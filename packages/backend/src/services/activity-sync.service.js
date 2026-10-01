const { validationResult } = require('express-validator');
const { db } = require('../config/database');
const activityRepository = require('../repositories/activity.repository');
const cropService = require('./crop.service');
const animalFeedService = require('./animal-feed.service');
const animalHealthService = require('./animal-health.service');
const animalProductionService = require('./animal-production.service');
const cropValidators = require('../validators/crop.validator');
const animalValidators = require('../validators/animal.validator');
const { AppError, ValidationError } = require('../utils/errors');
const { mapDatabaseError } = require('../middleware/error.middleware');

const CLIENT_REQUEST_KEY = 'activities_client_request_id_key';

/**
 * What an offline client can send, each with the validators and service call
 * of its own endpoint. Crop kinds name their batch in the entry's batch_id.
 */
const KINDS = {
  observation: {
    validators: cropValidators.addObservation,
    create: (entry, user, t) => cropService.addObservation(entry.batch_id, entry.data, user.id, t),
  },
  harvest: {
    validators: cropValidators.recordHarvest,
    create: (entry, user, t) => cropService.recordHarvest(entry.batch_id, entry.data, user, t),
  },
  input_application: {
    validators: cropValidators.recordInputApplication,
    create: (entry, user, t) => cropService.recordInputApplication(entry.batch_id, entry.data, user.id, t),
  },
  pest_incident: {
    validators: cropValidators.reportPestDisease,
    create: (entry, user, t) => cropService.reportPestDisease(entry.batch_id, entry.data, user.id, t),
  },
  feeding: {
    validators: animalValidators.createFeedRecord,
    create: (entry, user, t) => animalFeedService.createFeedRecord({ ...entry.data, recorded_by: user.id }, t),
  },
  health_record: {
    validators: animalValidators.createHealthRecord,
    create: (entry, user, t) => animalHealthService.createHealthRecord({ ...entry.data, recorded_by: user.id }, t),
  },
  treatment: {
    validators: animalValidators.createDiseaseTreatment,
    create: (entry, user, t) => animalHealthService.createDiseaseTreatment({ ...entry.data, recorded_by: user.id }, t),
  },
  production: {
    validators: animalValidators.createProductionRecord,
    create: (entry, user, t) => animalProductionService.createProductionRecord(entry.data, user, t),
  },
};

/**
 * Run an endpoint's validators over one entry, as if it had been posted there
 * @private
 * @returns {Promise<Object>} The entry's data, sanitised
 * @throws {ValidationError}
 */
async function validateEntry(entry) {
  const req = { params: { batchId: String(entry.batch_id ?? '') }, body: { ...entry.data }, query: {} };
  for (const chain of KINDS[entry.kind].validators) {
    await chain.run(req);
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((err) => ({ field: err.path, message: err.msg }));
    throw new ValidationError(details.map((d) => d.message).join(', '), details);
  }
  return req.body;
}

/**
 * Offline sync: replays a client's outbox of records (ADR-001, rule 5)
 */
class ActivitySyncService {
  /**
   * Record a batch of entries, in order, each in its own transaction. An
   * entry whose client_request_id was seen before is not recorded again. One
   * entry failing does not stop the others.
   * @param {Array<Object>} entries - { client_request_id, kind, batch_id?, data }
   * @param {Object} user - The signed-in user ({id, role})
   * @returns {Promise<Array<Object>>} Per entry: { client_request_id, status:
   *   'created' | 'duplicate' | 'failed', activity_id?, record?, error? }
   */
  async recordBulk(entries, user) {
    const results = [];
    for (const entry of entries) {
      results.push(await this.recordEntry(entry, user));
    }
    return results;
  }

  /**
   * Record one entry of a bulk request
   * @private
   */
  async recordEntry(entry, user) {
    const key = entry.client_request_id;
    const duplicate = async () => {
      const existing = await activityRepository.findByClientRequestId(key);
      return { client_request_id: key, status: 'duplicate', activity_id: existing.id };
    };

    if (await activityRepository.findByClientRequestId(key)) {
      return duplicate();
    }

    try {
      const data = await validateEntry(entry);
      const record = await db.tx(async (tx) => {
        const saved = await KINDS[entry.kind].create({ ...entry, data }, user, tx);
        await activityRepository.update(saved.activity_id, { client_request_id: key }, tx);
        return saved;
      });
      return { client_request_id: key, status: 'created', activity_id: record.activity_id, record };
    } catch (error) {
      // The same entry sent twice at once: the other request recorded it
      if (error.code === '23505' && error.constraint === CLIENT_REQUEST_KEY) {
        return duplicate();
      }
      const failure = error instanceof AppError ? error : mapDatabaseError(error);
      if (!failure) {
        throw error;
      }
      return {
        client_request_id: key,
        status: 'failed',
        error: { code: failure.code, message: failure.message, details: failure.details },
      };
    }
  }
}

module.exports = new ActivitySyncService();
module.exports.KINDS = Object.keys(KINDS);
