const { db } = require('../helpers/db');

describe('pg type parsers', () => {
  it('returns NUMERIC as a number', async () => {
    const { v } = await db.one('SELECT 12.50::numeric(14,2) AS v');
    expect(v).toBe(12.5);
  });

  it('returns BIGINT / COUNT(*) as a number', async () => {
    const { v } = await db.one('SELECT COUNT(*) AS v FROM generate_series(1, 3)');
    expect(v).toBe(3);
  });

  it('returns DATE as a YYYY-MM-DD string regardless of server time zone', async () => {
    const { v } = await db.one("SELECT '2026-05-30'::date AS v");
    expect(v).toBe('2026-05-30');
  });

  it('keeps nulls as null', async () => {
    const row = await db.one('SELECT NULL::numeric AS n, NULL::bigint AS b, NULL::date AS d');
    expect(row).toEqual({ n: null, b: null, d: null });
  });
});
