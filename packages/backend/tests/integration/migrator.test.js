const fs = require('fs');
const os = require('os');
const path = require('path');
const { db } = require('../helpers/db');
const { migrate, checksum, readMigrations, DEFAULT_MIGRATIONS_DIR } = require('../../src/database/migrator');

const silent = { info() {}, warn() {} };

describe('migrator', () => {
  let dir;
  // Dedicated connection whose search_path isolates it from the real schema_migrations table
  const scoped = db.$config.pgp({ ...db.$cn, options: '-c search_path=migrator_test', max: 1 });

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
    await db.none('DROP SCHEMA IF EXISTS migrator_test CASCADE; CREATE SCHEMA migrator_test');
  });

  afterEach(async () => {
    fs.rmSync(dir, { recursive: true, force: true });
    await db.none('DROP SCHEMA IF EXISTS migrator_test CASCADE');
  });

  it('records every real migration as applied on the test database', async () => {
    const files = readMigrations(DEFAULT_MIGRATIONS_DIR).map((f) => f.filename);
    const rows = await db.map('SELECT filename FROM schema_migrations ORDER BY filename', [], (r) => r.filename);
    expect(rows).toEqual(files);
  });

  it('applies pending files once, in order, and is idempotent', async () => {
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE a (id int);');
    fs.writeFileSync(path.join(dir, '002_b.sql'), 'CREATE TABLE b (id int);');

    const first = await migrate({ db: scoped, dir, logger: silent });
    expect(first.applied).toEqual(['001_a.sql', '002_b.sql']);

    const second = await migrate({ db: scoped, dir, logger: silent });
    expect(second.applied).toEqual([]);
  });

  it('rolls back a failing migration and does not record it', async () => {
    fs.writeFileSync(path.join(dir, '001_bad.sql'), 'CREATE TABLE ok (id int); SELECT * FROM missing_table;');

    await expect(migrate({ db: scoped, dir, logger: silent })).rejects.toThrow(/missing_table/);

    const tables = await scoped.any("SELECT 1 FROM pg_tables WHERE schemaname = 'migrator_test' AND tablename = 'ok'");
    expect(tables).toHaveLength(0);
    const recorded = await scoped.any('SELECT filename FROM schema_migrations');
    expect(recorded).toHaveLength(0);
  });

  it('refuses to run when an applied migration was edited', async () => {
    const file = path.join(dir, '001_a.sql');
    fs.writeFileSync(file, 'CREATE TABLE a (id int);');
    await migrate({ db: scoped, dir, logger: silent });

    fs.writeFileSync(file, 'CREATE TABLE a (id bigint);');
    await expect(migrate({ db: scoped, dir, logger: silent })).rejects.toThrow(/have been modified: 001_a.sql/);
  });

  it('baseline and markApplied record files without running them', async () => {
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'SELECT * FROM would_fail;');
    fs.writeFileSync(path.join(dir, '002_b.sql'), 'SELECT * FROM would_fail_too;');
    fs.writeFileSync(path.join(dir, '003_c.sql'), 'CREATE TABLE c (id int);');

    const marked = await migrate({ db: scoped, dir, markApplied: ['001_a.sql'], logger: silent }).catch((e) => e);
    // 002 is not marked, so it runs and fails
    expect(marked).toBeInstanceOf(Error);

    const result = await migrate({ db: scoped, dir, baseline: true, logger: silent });
    expect(result.baselined).toEqual(['002_b.sql', '003_c.sql']);
    const c = await scoped.any("SELECT 1 FROM pg_tables WHERE schemaname = 'migrator_test' AND tablename = 'c'");
    expect(c).toHaveLength(0);
  });

  it('checksum ignores CRLF vs LF', () => {
    expect(checksum('a\r\nb')).toBe(checksum('a\nb'));
  });
});
