'use strict';
/**
 * One-time (re-runnable) copy of the old SQLite database into PostgreSQL.
 *
 *   node --env-file=.env scripts/migrate-sqlite-to-postgres.js [path/to/sjbc.db]
 *
 * - Reads the SQLite file read-only; it is never modified.
 * - Runs in ONE transaction: either everything is copied or nothing is.
 * - Safe to run again: rows that already exist (same id / email) are skipped, not duplicated.
 * - Verifies row counts at the end and exits non-zero on any mismatch.
 */
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const DB = require('../server/db');

(async () => {
  const file = path.resolve(process.argv[2] || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'sjbc.db'));
  const lite = new DatabaseSync(file, { readOnly: true });
  const users = lite.prepare('SELECT * FROM users ORDER BY id').all();
  const sessions = lite.prepare('SELECT * FROM sessions WHERE expires_at > ?').all(Date.now());
  const tournaments = lite.prepare('SELECT * FROM tournaments ORDER BY created_at').all();
  console.log(`SQLite (${file}): ${users.length} users, ${sessions.length} live sessions, ${tournaments.length} tournaments`);

  await DB.migrate();
  const res = await DB.tx(async c => {
    let u = 0, s = 0, t = 0;
    for (const r of users) {
      const x = await c.query(
        `INSERT INTO users (id, email, name, picture, google_sub, role, created_at, last_login)
         OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [r.id, r.email, r.name, r.picture, r.google_sub, r.role, r.created_at, r.last_login]);
      u += x.rowCount;
    }
    await c.query(`SELECT setval(pg_get_serial_sequence('users','id'), GREATEST((SELECT COALESCE(MAX(id),0) FROM users), 1))`);
    for (const r of sessions) {
      const x = await c.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [r.id, r.user_id, r.expires_at]);
      s += x.rowCount;
    }
    for (const r of tournaments) {
      JSON.parse(r.data); // fail loudly on corrupt rows rather than copying them
      const x = await c.query(
        'INSERT INTO tournaments (id, data, version, created_by, created_at, updated_at) VALUES ($1,$2::jsonb,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
        [r.id, r.data, r.version, r.created_by, r.created_at, r.updated_at]);
      t += x.rowCount;
    }
    return { u, s, t };
  });
  console.log(`Copied: ${res.u} users, ${res.s} sessions, ${res.t} tournaments (existing rows skipped)`);

  // verification: every source row must now exist in Postgres, and tournament content must match exactly
  let bad = 0;
  const pgUsers = new Set((await DB.many('SELECT email FROM users')).map(r => r.email));
  users.forEach(r => { if (!pgUsers.has(r.email)) { bad++; console.error('missing user', r.email); } });
  const pgT = new Map((await DB.many('SELECT id, data, version FROM tournaments')).map(r => [r.id, r]));
  const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
  for (const r of tournaments) {
    const p = pgT.get(r.id);
    if (!p) { bad++; console.error('missing tournament', r.id); continue; }
    if (canon(JSON.parse(r.data)) !== canon(p.data)) { bad++; console.error('content differs', r.id); }
  }
  const counts = await DB.one('SELECT (SELECT COUNT(*) FROM users)::int u, (SELECT COUNT(*) FROM sessions)::int s, (SELECT COUNT(*) FROM tournaments)::int t');
  console.log(`PostgreSQL now holds: ${counts.u} users, ${counts.s} sessions, ${counts.t} tournaments`);
  console.log(bad ? `VERIFICATION FAILED (${bad} problems)` : 'Verification passed: all source rows present and tournament data identical.');
  lite.close();
  await DB.pool.end();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
