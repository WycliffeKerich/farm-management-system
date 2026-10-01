const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const settingsService = require('../../src/services/settings.service');

const DEFAULTS = { farm_name: 'My Farm', currency: 'KES', timezone: 'Africa/Nairobi', farm_location: null };

let owner;

beforeEach(async () => {
  await truncateAll();
  owner = await loginAs(app, 'owner');
});

const getSettings = (session = owner) => request(app).get('/api/v1/settings').set(session.auth);
const putSettings = (body, session = owner) => request(app).put('/api/v1/settings').set(session.auth).send(body);

describe('GET /settings', () => {
  it('returns the defaults before anything is saved, to any signed-in user', async () => {
    const worker = await loginAs(app, 'worker');
    const res = await getSettings(worker);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(DEFAULTS);
  });

  it('needs a login', async () => {
    expect((await request(app).get('/api/v1/settings')).status).toBe(401);
  });
});

describe('PUT /settings', () => {
  it('saves the settings given and leaves the rest alone', async () => {
    const res = await putSettings({
      farm_name: '  Kerich Farm ',
      currency: 'ugx',
      farm_location: { latitude: 0.5142757, longitude: 35.2697802 },
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      farm_name: 'Kerich Farm',
      currency: 'UGX',
      timezone: 'Africa/Nairobi',
      farm_location: { latitude: 0.514276, longitude: 35.26978 },
    });

    const again = await putSettings({ timezone: 'Africa/Kampala', farm_location: null });
    expect(again.body.data).toEqual({
      farm_name: 'Kerich Farm',
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      farm_location: null,
    });
    expect((await getSettings()).body.data).toEqual(again.body.data);
  });

  it('refuses bad values, naming each, and saves none of the batch', async () => {
    const res = await putSettings({
      farm_name: 'Fine',
      currency: 'XYZ1',
      timezone: 'Mars/Olympus',
      farm_location: { latitude: 91, longitude: 0 },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((detail) => detail.field)).toEqual(['currency', 'timezone', 'farm_location']);
    expect((await getSettings()).body.data).toEqual(DEFAULTS);
  });

  it.each([
    [{ farm_name: '' }, /farm_name/],
    [{ farm_name: 'x'.repeat(101) }, /farm_name/],
    [{ currency: 42 }, /currency/],
    [{ farm_location: { latitude: '1', longitude: 2 } }, /farm_location/],
    [{ farm_location: 'Eldoret' }, /farm_location/],
    [{ acreage: 10 }, /Unknown setting: acreage/],
    [{}, /No settings given/],
    [[{ currency: 'KES' }], /No settings given/],
  ])('refuses %j', async (body, message) => {
    const res = await putSettings(body);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(message);
  });

  it('is for the owner only', async () => {
    const manager = await loginAs(app, 'manager');
    const worker = await loginAs(app, 'worker');
    expect((await putSettings({ currency: 'USD' }, manager)).status).toBe(403);
    expect((await putSettings({ currency: 'USD' }, worker)).status).toBe(403);
    expect((await request(app).put('/api/v1/settings').send({ currency: 'USD' })).status).toBe(401);
    expect((await getSettings()).body.data.currency).toBe('KES');
  });

  it('is audited and credited to the owner', async () => {
    await putSettings({ currency: 'USD' });
    await putSettings({ currency: 'EUR' });

    const rows = await db.any("SELECT * FROM audit_log WHERE table_name = 'farm_settings' ORDER BY id");
    expect(rows.map((row) => row.action)).toEqual(['insert', 'update']);
    expect(rows.every((row) => row.changed_by === owner.user.id)).toBe(true);
    expect(rows[1].before.value).toBe('USD');
    expect(rows[1].after.value).toBe('EUR');
  });
});

describe('settings service', () => {
  it('has typed accessors', async () => {
    await putSettings({ farm_name: 'Shamba', currency: 'TZS', farm_location: { latitude: -6.8, longitude: 39.28 } });
    expect(await settingsService.getFarmName()).toBe('Shamba');
    expect(await settingsService.getCurrency()).toBe('TZS');
    expect(await settingsService.getTimezone()).toBe('Africa/Nairobi');
    expect(await settingsService.getFarmLocation()).toEqual({ latitude: -6.8, longitude: 39.28 });
  });

  it('reads the value in force on a date when a setting has dated values', async () => {
    await db.none(
      `INSERT INTO farm_settings (key, value, effective_from)
       VALUES ('currency', '"KES"', '-infinity'), ('currency', '"USD"', '2026-07-01')`
    );
    expect((await settingsService.getAll('2026-06-30')).currency).toBe('KES');
    expect((await settingsService.getAll('2026-07-01')).currency).toBe('USD');
  });
});
