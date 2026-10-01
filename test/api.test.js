'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// Tests run in their own throwaway schema so they can never touch real data.
const SCHEMA = 'test_' + require('crypto').randomBytes(4).toString('hex');
process.env.DB_SCHEMA = SCHEMA;
process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLIENT_ID = '';
process.env.ADMIN_EMAILS = 'boss@example.com';
const { app, ready, shutdown, pool } = require('../server');

let base, server;
test.before(async () => { await ready; await new Promise(r => { server = app.listen(0, r); }); base = 'http://127.0.0.1:' + server.address().port; });
test.after(async () => { server.closeAllConnections?.(); server.close(); await pool.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {}); await shutdown(); });

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, headers = {}) {
    const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = r.headers.get('set-cookie'); if (sc && /sjbc_sid=[^;]+/.test(sc)) this.cookie = sc.match(/sjbc_sid=[^;]*/)[0];
    let data = null; try { data = await r.json(); } catch { /* none */ }
    return { status: r.status, data };
  }
  login(email, name) { return this.req('POST', '/api/auth/dev', { email, name }); }
}
const doc = (over = {}) => ({
  name: 'Test Open', venue: 'Hall', startDate: '2026-10-01', endDate: '2026-10-02', type: 'singles', groups: 1, matchesPerTeam: 1,
  bestOf: 3, koBestOf: 3, points: 21, knockout: 'top2', thirdPlace: false, stage: 'setup',
  teams: [{ id: 'a', group: null, players: [{ name: 'Ann', elo: 1500 }] }, { id: 'b', group: null, players: [{ name: 'Bo', elo: 1500 }] }],
  matches: [], ko: null, seq: 0, ...over,
});

const admin = new Client(), scorer = new Client(), guest = new Client();
let tid, version;

test('config exposes dev login locally, and guests are anonymous', async () => {
  const c = await guest.req('GET', '/api/config');
  assert.equal(c.data.devLogin, true);
  assert.equal((await guest.req('GET', '/api/me')).data.user, null);
});
test('first dev-login user becomes admin; later users are pending', async () => {
  const a = await admin.login('first@example.com', 'First');
  assert.equal(a.data.user.role, 'admin');
  const s = await scorer.login('scorer@example.com', 'Scorer');
  assert.equal(s.data.user.role, 'pending');
});
test('ADMIN_EMAILS grants permanent admin', async () => {
  const b = await new Client().login('boss@example.com', 'Boss');
  assert.equal(b.data.user.role, 'admin');
});
test('guests can read but not write', async () => {
  assert.equal((await guest.req('GET', '/api/tournaments')).status, 200);
  assert.equal((await guest.req('POST', '/api/tournaments', doc())).status, 401);
});
test('pending users cannot write; approval enables it', async () => {
  assert.equal((await scorer.req('POST', '/api/tournaments', doc())).status, 403);
  const users = (await admin.req('GET', '/api/users')).data.users;
  const u = users.find(x => x.email === 'scorer@example.com');
  assert.equal((await scorer.req('GET', '/api/users')).status, 403);
  assert.equal((await admin.req('PATCH', '/api/users/' + u.id, { role: 'editor' })).status, 200);
  const r = await scorer.req('POST', '/api/tournaments', doc());
  assert.equal(r.status, 201);
  tid = r.data.tournament.id; version = r.data.tournament.version;
  assert.equal(version, 1);
});
test('invalid documents are rejected', async () => {
  assert.equal((await admin.req('POST', '/api/tournaments', doc({ groups: 99 }))).status, 400);
  assert.equal((await admin.req('POST', '/api/tournaments', doc({ name: '' }))).status, 400);
  assert.equal((await admin.req('POST', '/api/tournaments', { name: 'x' })).status, 400);
  assert.equal((await admin.req('PUT', '/api/tournaments/' + tid, { version, set: { type: 'doubles' } })).status, 400, 'format keys are immutable');
});
test('structural updates need the current version (optimistic concurrency)', async () => {
  const teams = doc().teams.concat([{ id: 'c', group: 0, players: [{ name: 'Cy', elo: 1600 }] }]);
  const stale = await admin.req('PUT', '/api/tournaments/' + tid, { version: 99, set: { teams } });
  assert.equal(stale.status, 409);
  assert.ok(stale.data.tournament, 'conflict returns the latest document');
  const ok = await admin.req('PUT', '/api/tournaments/' + tid, { version, set: { teams } });
  assert.equal(ok.status, 200); version = ok.data.tournament.version;
  assert.equal(ok.data.tournament.teams.length, 3);
});
test('meta edits do not conflict with scoring', async () => {
  const r = await admin.req('PUT', '/api/tournaments/' + tid, { version: 1, set: { name: 'Renamed Open' } });
  assert.equal(r.status, 200); version = r.data.tournament.version;
  assert.equal(r.data.tournament.name, 'Renamed Open');
});
test('scoring is refused before the tournament starts, then assigns sequence numbers', async () => {
  const m = { stage: 'group', games: [[21, 10], [21, 15]], status: 'done', court: '2' };
  assert.equal((await scorer.req('PATCH', `/api/tournaments/${tid}/matches/m1`, m)).status, 409);
  const matches = [{ id: 'm1', stage: 'group', group: 0, round: 1, a: 'a', b: 'b', games: [], status: 'scheduled', court: '', seq: 0 }];
  const start = await admin.req('PUT', '/api/tournaments/' + tid, { version, set: { matches, stage: 'group' } });
  assert.equal(start.status, 200); version = start.data.tournament.version;
  const done = await scorer.req('PATCH', `/api/tournaments/${tid}/matches/m1`, m);
  assert.equal(done.status, 200);
  const mm = done.data.tournament.matches[0];
  assert.equal(mm.status, 'done'); assert.equal(mm.seq, 1); assert.equal(done.data.tournament.seq, 1);
  assert.equal((await scorer.req('PATCH', `/api/tournaments/${tid}/matches/m1`, { ...m, games: [[300, 1]] })).status, 400);
  assert.equal((await scorer.req('PATCH', `/api/tournaments/${tid}/matches/nope`, m)).status, 404);
  const re = await scorer.req('PATCH', `/api/tournaments/${tid}/matches/m1`, { ...m, games: [[21, 5], [21, 5]] });
  assert.equal(re.data.tournament.matches[0].seq, 1, 'editing keeps completion order');
  const clr = await scorer.req('PATCH', `/api/tournaments/${tid}/matches/m1`, { stage: 'group', games: [], status: 'scheduled', court: '' });
  assert.equal(clr.data.tournament.matches[0].seq, 0);
});
test('cross-origin writes are blocked', async () => {
  const r = await admin.req('POST', '/api/tournaments', doc(), { Origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});
test('security headers are present', async () => {
  const r = await fetch(base + '/');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
});
test('live events reach viewers', async () => {
  const ctrl = new AbortController();
  const res = await fetch(base + '/api/events', { signal: ctrl.signal });
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = ''; await reader.read(); // retry line
  const wait = (async () => { while (!/event: t/.test(buf)) { const { value } = await reader.read(); buf += dec.decode(value); } return buf; })();
  await admin.req('PUT', '/api/tournaments/' + tid, { version: 1, set: { venue: 'Court 9' } });
  const got = await Promise.race([wait, new Promise((_, rej) => setTimeout(() => rej(new Error('no event')), 3000))]);
  ctrl.abort();
  assert.match(got, new RegExp(tid));
});
test('delete: creator or admin only', async () => {
  const other = new Client(); await other.login('other@example.com', 'Other');
  const u = (await admin.req('GET', '/api/users')).data.users.find(x => x.email === 'other@example.com');
  await admin.req('PATCH', '/api/users/' + u.id, { role: 'editor' });
  assert.equal((await other.req('DELETE', '/api/tournaments/' + tid)).status, 403);
  assert.equal((await scorer.req('DELETE', '/api/tournaments/' + tid)).status, 200);
  assert.equal((await guest.req('GET', '/api/tournaments/' + tid)).status, 404);
});
test('user management guards', async () => {
  const users = (await admin.req('GET', '/api/users')).data.users;
  const me = users.find(x => x.email === 'first@example.com');
  assert.equal((await admin.req('DELETE', '/api/users/' + me.id)).status, 409, 'cannot remove yourself');
  const boss = users.find(x => x.email === 'boss@example.com');
  assert.equal((await admin.req('PATCH', '/api/users/' + boss.id, { role: 'editor' })).status, 409, 'ADMIN_EMAILS is permanent');
  assert.equal((await admin.req('PATCH', '/api/users/' + me.id, { role: 'nonsense' })).status, 400);
  const inv = await admin.req('POST', '/api/users', { email: 'Invitee@Example.com', role: 'editor' });
  assert.equal(inv.status, 200);
  const invited = (await admin.req('GET', '/api/users')).data.users.find(x => x.email === 'invitee@example.com');
  assert.equal(invited.role, 'editor'); assert.equal(invited.joined, false);
  const c = new Client(); const l = await c.login('invitee@example.com', 'Invited');
  assert.equal(l.data.user.role, 'editor', 'invited users get their role on first sign-in');
});
test('blocking a user ends their session', async () => {
  const c = new Client(); await c.login('troll@example.com', 'Troll');
  const u = (await admin.req('GET', '/api/users')).data.users.find(x => x.email === 'troll@example.com');
  await admin.req('PATCH', '/api/users/' + u.id, { role: 'blocked' });
  assert.equal((await c.req('GET', '/api/me')).data.user, null);
  assert.equal((await new Client().login('troll@example.com', 'Troll')).status, 403);
});
test('admin export / import round-trip', async () => {
  const mk = await admin.req('POST', '/api/tournaments', doc({ name: 'Keep me' }));
  assert.equal(mk.status, 201);
  const exp = await admin.req('GET', '/api/admin/export');
  assert.ok(exp.data.tournaments.some(t => t.name === 'Keep me'));
  assert.equal((await scorer.req('GET', '/api/admin/export')).status, 403);
  assert.equal((await admin.req('DELETE', '/api/admin/tournaments')).status, 200);
  assert.equal((await guest.req('GET', '/api/tournaments')).data.tournaments.length, 0);
  assert.equal((await admin.req('POST', '/api/admin/import', exp.data)).status, 200);
  assert.ok((await guest.req('GET', '/api/tournaments')).data.tournaments.some(t => t.name === 'Keep me'));
  assert.equal((await admin.req('POST', '/api/admin/import', { tournaments: [{ name: 'bad' }] })).status, 400);
});
test('logout clears the session', async () => {
  await admin.req('POST', '/api/auth/logout', {});
  admin.cookie = '';
  assert.equal((await admin.req('GET', '/api/me')).data.user, null);
});
