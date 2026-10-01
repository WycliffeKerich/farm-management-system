const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const { db, truncateAll } = require('../helpers/db');
const { loginAs } = require('../factories/user');
const { createActivity } = require('../factories/activity');
const { createBatch } = require('../factories/crop');

const UPLOAD_DIR = process.env.UPLOAD_DIR;
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('a tiny stand-in for a pest photo'),
]);
const PDF = Buffer.from('%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n');

let owner;
let manager;
let worker;
let activity;

beforeEach(async () => {
  await truncateAll();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  owner = await loginAs(app, 'owner');
  manager = await loginAs(app, 'manager');
  worker = await loginAs(app, 'worker');
  activity = await newActivity();
});

const newActivity = async () => createActivity({ crop_batch_id: (await createBatch()).id });

afterAll(() => fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }));

const upload = (fields, file = PNG, name = 'aphids.png', session = worker) => {
  const req = request(app).post('/api/v1/attachments').set(session.auth);
  for (const [key, value] of Object.entries(fields)) req.field(key, String(value));
  return file ? req.attach('file', file, name) : req;
};
const onActivity = (extra = {}) => ({ entity_type: 'activities', entity_id: activity.id, ...extra });
const get = (url, session = worker) => request(app).get(`/api/v1${url}`).set(session.auth);
const stored = async (id) => db.one('SELECT * FROM attachments WHERE id = $1', [id]);

describe('uploading', () => {
  it('stores the file under a random key, records who uploaded it, and serves it back', async () => {
    const res = await upload(onActivity({ caption: ' Aphids on the lower leaves ' }), PNG, '../../etc/aphids.png');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      entity_type: 'activities',
      entity_id: activity.id,
      file_name: 'aphids.png',
      mime_type: 'image/png',
      size_bytes: PNG.length,
      caption: 'Aphids on the lower leaves',
      uploaded_by: worker.user.id,
    });
    expect(res.body.data).not.toHaveProperty('storage_key');

    const row = await stored(res.body.data.id);
    expect(row.storage_key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(fs.readFileSync(path.join(UPLOAD_DIR, row.storage_key))).toEqual(PNG);

    // The audit log credits the uploader
    const audit = await db.one("SELECT changed_by FROM audit_log WHERE table_name = 'attachments' AND record_id = $1", [
      row.id,
    ]);
    expect(audit.changed_by).toBe(worker.user.id);

    const file = await get(`/attachments/${row.id}`).buffer(true);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');
    expect(file.headers['content-disposition']).toMatch(/^inline; filename="aphids.png"/);
    expect(file.body).toEqual(PNG);

    const saved = await get(`/attachments/${row.id}?download=true`);
    expect(saved.headers['content-disposition']).toMatch(/^attachment;/);
  });

  it('decides the type from the contents, not the name or the claimed type', async () => {
    const pdf = await upload(onActivity(), PDF, 'receipt.jpg');
    expect(pdf.status).toBe(201);
    expect(pdf.body.data.mime_type).toBe('application/pdf');
    expect((await stored(pdf.body.data.id)).storage_key).toMatch(/\.pdf$/);

    const script = Buffer.from('<script>alert(1)</script> pretending to be a picture');
    const refused = await upload(onActivity(), script, 'photo.png');
    expect(refused.status).toBe(400);
    expect(refused.body.error.message).toMatch(/image\/jpeg, image\/png, image\/webp, application\/pdf/);
  });

  it('refuses files over the size limit, missing files, and unknown or deleted records', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
    const tooBig = await upload(onActivity(), big);
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe('FILE_TOO_LARGE');

    expect((await upload(onActivity(), null)).status).toBe(400);
    expect((await upload({ entity_type: 'users', entity_id: 1 })).status).toBe(400);
    expect((await upload({ entity_type: 'activities', entity_id: 'x' })).status).toBe(400);
    expect((await upload({ entity_type: 'activities', entity_id: 999999 })).status).toBe(404);

    await db.none('UPDATE activities SET deleted_at = now() WHERE id = $1', [activity.id]);
    expect((await upload(onActivity())).status).toBe(404);

    // Nothing refused was left behind in storage
    expect(await db.one('SELECT COUNT(*)::int AS n FROM attachments')).toEqual({ n: 0 });
    const files = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR, { recursive: true }) : [];
    expect(files.filter((name) => name.includes('.'))).toEqual([]);
  });

  it('keeps finance attachments to owners and managers', async () => {
    const txn = await db.one(
      `INSERT INTO financial_transactions (transaction_date, type, amount) VALUES ('2026-03-01', 'expense', 1500)
       RETURNING id`
    );
    const receipt = { entity_type: 'financial_transactions', entity_id: txn.id };

    expect((await upload(receipt)).status).toBe(403);
    const res = await upload(receipt, PDF, 'receipt.pdf', manager);
    expect(res.status).toBe(201);

    expect((await get(`/attachments/${res.body.data.id}`)).status).toBe(403);
    expect((await get(`/attachments?entity_type=financial_transactions&entity_id=${txn.id}`)).status).toBe(403);
    expect((await get(`/attachments/${res.body.data.id}`, owner)).status).toBe(200);
  });

  it('needs a signed-in user', async () => {
    expect((await request(app).post('/api/v1/attachments').attach('file', PNG, 'a.png')).status).toBe(401);
    expect((await request(app).get('/api/v1/attachments/1')).status).toBe(401);
  });
});

describe('listing, captions and removal', () => {
  it('lists a record’s attachments newest first, paged', async () => {
    await upload(onActivity({ caption: 'first' }));
    await upload(onActivity({ caption: 'second' }), PDF, 'note.pdf', manager);
    await upload({ entity_type: 'activities', entity_id: (await newActivity()).id });

    const list = await get(`/attachments?entity_type=activities&entity_id=${activity.id}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((a) => a.caption)).toEqual(['second', 'first']);
    expect(list.body.data[0]).toMatchObject({
      uploaded_by_name: `${manager.user.first_name} ${manager.user.last_name}`,
    });
    expect(list.body.data[0]).not.toHaveProperty('storage_key');
    expect(list.body.pagination).toMatchObject({ total: 2 });

    const paged = await get(`/attachments?entity_type=activities&entity_id=${activity.id}&limit=1&page=2`);
    expect(paged.body.data.map((a) => a.caption)).toEqual(['first']);

    expect((await get('/attachments?entity_type=activities')).status).toBe(400);
    expect((await get(`/attachments?entity_type=users&entity_id=1`)).status).toBe(400);
  });

  it('the uploader, an owner or a manager can change or remove an attachment; others cannot', async () => {
    const mine = (await upload(onActivity())).body.data;
    const colleague = await loginAs(app, 'worker');

    const put = (id, body, session) => request(app).put(`/api/v1/attachments/${id}`).set(session.auth).send(body);
    const del = (id, session) => request(app).delete(`/api/v1/attachments/${id}`).set(session.auth);

    expect((await put(mine.id, { caption: 'not yours' }, colleague)).status).toBe(403);
    expect((await del(mine.id, colleague)).status).toBe(403);

    const captioned = await put(mine.id, { caption: 'Aphids, block B' }, worker);
    expect(captioned.status).toBe(200);
    expect(captioned.body.data.caption).toBe('Aphids, block B');

    expect((await del(mine.id, manager)).status).toBe(200);
    expect((await get(`/attachments/${mine.id}`)).status).toBe(404);
    expect((await del(mine.id, owner)).status).toBe(404);

    // The file is kept for the audit trail
    const row = await stored(mine.id);
    expect(row.deleted_at).not.toBeNull();
    expect(fs.existsSync(path.join(UPLOAD_DIR, row.storage_key))).toBe(true);
  });

  it('a file missing from storage is a 404, not a crash', async () => {
    const res = await upload(onActivity());
    const row = await stored(res.body.data.id);
    fs.rmSync(path.join(UPLOAD_DIR, row.storage_key));

    const missing = await get(`/attachments/${row.id}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('FILE_MISSING');
  });
});
