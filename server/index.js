'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const DB = require('./db');
const V = require('./validate');

/* ------------------------------------------------------------------ config */
const PORT = +process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
// Serverless (Vercel) functions can't hold open streams, so live updates switch to client polling there.
const SERVERLESS = !!process.env.VERCEL;
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const GOOGLE_ON = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const PUBLIC_URL = (process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
// Passwordless dev login exists only outside production and only when Google isn't configured.
const DEV_LOGIN = !PROD && (process.env.DEV_LOGIN === '1' || !GOOGLE_ON);
const SESSION_DAYS = 30;
const COOKIE = 'sjbc_sid';
const ROLES = ['pending', 'editor', 'admin', 'blocked'];

/* ---------------------------------------------------------------- database */
const q = {
  userByEmail: email => DB.one('SELECT * FROM users WHERE email = $1', [email]),
  userById: id => DB.one('SELECT * FROM users WHERE id = $1', [id]),
  allUsers: () => DB.many("SELECT * FROM users ORDER BY (role = 'pending') DESC, created_at DESC"),
  insUser: (email, name, picture, sub, role, created, last) => DB.one('INSERT INTO users (email, name, picture, google_sub, role, created_at, last_login) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [email, name, picture, sub, role, created, last]),
  updLogin: (name, picture, sub, role, last, id) => DB.query('UPDATE users SET name = $1, picture = $2, google_sub = COALESCE(google_sub, $3), role = $4, last_login = $5 WHERE id = $6', [name, picture, sub, role, last, id]),
  setRole: (role, id) => DB.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]),
  delUser: id => DB.query('DELETE FROM users WHERE id = $1', [id]),
  countAdmins: async () => (await DB.one("SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin'")).c,
  insSess: (id, uid, exp) => DB.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)', [id, uid, exp]),
  sess: id => DB.one('SELECT s.id AS sid, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1', [id]),
  delSess: id => DB.query('DELETE FROM sessions WHERE id = $1', [id]),
  delUserSess: uid => DB.query('DELETE FROM sessions WHERE user_id = $1', [uid]),
  purge: now => DB.query('DELETE FROM sessions WHERE expires_at < $1', [now]),
  tAll: () => DB.many('SELECT * FROM tournaments ORDER BY created_at DESC'),
  tOne: id => DB.one('SELECT * FROM tournaments WHERE id = $1', [id]),
  tIns: (id, data, version, by, created, updated, c = DB) => c.query('INSERT INTO tournaments (id, data, version, created_by, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)', [id, JSON.stringify(data), version, by, created, updated]),
  tDel: id => DB.query('DELETE FROM tournaments WHERE id = $1', [id]),
};
// Locked read inside a transaction: serialises concurrent writers on the same tournament.
const tLock = (c, id) => c.query('SELECT * FROM tournaments WHERE id = $1 FOR UPDATE', [id]).then(r => r.rows[0] || null);
const tRead = (c, id) => c.query('SELECT * FROM tournaments WHERE id = $1', [id]).then(r => r.rows[0]);
const tSave = (c, id, doc, version) => c.query('UPDATE tournaments SET data = $1, version = $2, updated_at = $3 WHERE id = $4', [JSON.stringify(doc), version, Date.now(), id]);
const toDoc = row => ({ ...row.data, id: row.id, version: row.version, createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at });
const newId = () => crypto.randomBytes(5).toString('hex');
const publicUser = u => u && ({ id: u.id, email: u.email, name: u.name, picture: u.picture, role: u.role });
setInterval(() => q.purge(Date.now()).catch(e => console.error('[db] purge failed:', e.message)), 3600e3).unref();

/* ------------------------------------------------------------ live updates */
// Events go through Postgres LISTEN/NOTIFY so every server instance relays them to its own SSE clients.
const clients = new Set();
const CHANNEL = 'sjbc_events';
const deliver = (event, data) => {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
};
let listening = false, listener = null, stopping = false;
function broadcast(event, data) {
  if (!listening) return deliver(event, data);
  DB.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify({ event, data })]).catch(e => { console.error('[db] notify failed:', e.message); deliver(event, data); });
}
async function startListener(attempt = 0) {
  if (stopping) return;
  try {
    const c = await DB.listenerClient();
    listener = c;
    c.on('notification', n => { try { const { event, data } = JSON.parse(n.payload); deliver(event, data); } catch { /* ignore malformed */ } });
    const lost = () => {
      if (listener !== c) return;
      listener = null; listening = false;
      if (stopping) return;
      console.error('[db] event listener lost — reconnecting');
      setTimeout(() => startListener(1), 2000).unref();
    };
    c.on('error', lost); c.on('end', lost);
    await c.query(`LISTEN ${CHANNEL}`);
    listening = true;
    if (attempt) deliver('reload', {}); // clients may have missed events while we were disconnected
  } catch (e) {
    listening = false;
    console.error('[db] event listener failed:', e.message);
    setTimeout(() => startListener(attempt + 1), Math.min(30e3, 1000 * 2 ** attempt)).unref();
  }
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25e3).unref();

/* -------------------------------------------------------------------- app */
const app = express();
app.disable('x-powered-by');
if (SERVERLESS && !process.env.TRUST_PROXY) process.env.TRUST_PROXY = 'true';
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'",
    ].join('; '),
  });
  if (PROD) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});
app.use(express.json({ limit: '2mb' }));

const parseCookies = h => Object.fromEntries((h || '').split(';').map(c => c.trim().split(/=(.*)/s)).filter(p => p[0]).map(p => [p[0], decodeURIComponent(p[1] || '')]));
app.use(async (req, res, next) => {
  const sid = parseCookies(req.headers.cookie)[COOKIE];
  req.user = null;
  if (sid) {
    const row = await q.sess(sid);
    if (row && row.expires_at > Date.now() && row.role !== 'blocked') req.user = row;
  }
  next();
});
// CSRF defence in depth on top of SameSite=Lax: mutating requests must be same-origin JSON.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin request blocked' }); } catch { return res.status(403).json({ error: 'Bad origin' }); } }
  if (req.headers['content-length'] !== '0' && req.headers['content-length'] !== undefined && !req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
  next();
});

const role = r => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  if (!r.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to do that' });
  next();
};
const EDITOR = role(['editor', 'admin']);
const ADMIN = role(['admin']);

const hits = new Map();
const limit = (max, windowMs) => (req, res, next) => {
  const k = req.ip + req.path, now = Date.now();
  const h = (hits.get(k) || []).filter(t => now - t < windowMs);
  if (h.length >= max) return res.status(429).json({ error: 'Too many attempts — try again in a minute' });
  h.push(now); hits.set(k, h); next();
};
setInterval(() => hits.clear(), 600e3).unref();

async function startSession(req, res, user) {
  const sid = crypto.randomBytes(32).toString('base64url');
  await q.insSess(sid, user.id, Date.now() + SESSION_DAYS * 864e5);
  const secure = PROD || req.secure;
  res.append('Set-Cookie', `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}
async function upsertUser({ email, name, picture, sub }, devBootstrap = false) {
  email = email.toLowerCase();
  const now = Date.now();
  const existing = await q.userByEmail(email);
  const isAdminEmail = ADMIN_EMAILS.includes(email);
  if (existing) {
    let r = existing.role;
    if (isAdminEmail && r !== 'blocked') r = 'admin';
    await q.updLogin(name || existing.name, picture || existing.picture, sub || null, r, now, existing.id);
    return q.userById(existing.id);
  }
  let r = isAdminEmail ? 'admin' : 'pending';
  if (devBootstrap && (await q.countAdmins()) === 0) r = 'admin';
  try {
    const ins = await q.insUser(email, name || email.split('@')[0], picture || '', sub || null, r, now, now);
    return await q.userById(ins.id);
  } catch (e) {
    if (e.code === '23505') return q.userByEmail(email); // lost a race with a concurrent first login
    throw e;
  }
}

/* ---------------------------------------------------------------- auth API */
const gClient = GOOGLE_ON ? new OAuth2Client({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }) : null;
app.get('/api/config', (req, res) => res.json({ google: GOOGLE_ON, devLogin: DEV_LOGIN, live: SERVERLESS ? 'poll' : 'sse' }));
app.get('/api/me', (req, res) => res.json({ user: publicUser(req.user) }));

// Google OAuth 2.0 authorization-code flow (server side, uses the client secret).
const redirectUri = req => (PUBLIC_URL || `${req.protocol}://${req.get('host')}`) + '/auth/google/callback';
const OAUTH_COOKIE = 'sjbc_oauth';
const fail = (res, msg) => res.redirect('/?auth_error=' + encodeURIComponent(msg) + '#/login');
app.get('/auth/google', limit(30, 60e3), (req, res) => {
  if (!gClient) return fail(res, 'Google sign-in is not configured on this server');
  const state = crypto.randomBytes(24).toString('base64url');
  res.append('Set-Cookie', `${OAUTH_COOKIE}=${state}; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=600${PROD || req.secure ? '; Secure' : ''}`);
  res.redirect(gClient.generateAuthUrl({ redirect_uri: redirectUri(req), scope: ['openid', 'email', 'profile'], state, prompt: 'select_account', access_type: 'online' }));
});
app.get('/auth/google/callback', limit(30, 60e3), async (req, res) => {
  res.append('Set-Cookie', `${OAUTH_COOKIE}=; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=0`);
  if (!gClient) return fail(res, 'Google sign-in is not configured on this server');
  const saved = parseCookies(req.headers.cookie)[OAUTH_COOKIE];
  if (req.query.error) return fail(res, req.query.error === 'access_denied' ? 'Sign-in was cancelled' : 'Google sign-in failed');
  if (!saved || !req.query.state || saved !== req.query.state || !req.query.code) return fail(res, 'Sign-in session expired — please try again');
  try {
    const { tokens } = await gClient.getToken({ code: String(req.query.code), redirect_uri: redirectUri(req) });
    const ticket = await gClient.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p.email || !p.email_verified) return fail(res, 'Your Google email is not verified');
    const user = await upsertUser({ email: p.email, name: p.name, picture: p.picture, sub: p.sub });
    if (user.role === 'blocked') return fail(res, 'This account has been blocked');
    await startSession(req, res, user);
    broadcast('users', {});
    res.redirect('/?signed_in=1#/');
  } catch (e) { console.error('Google sign-in error:', e.message); fail(res, 'Google sign-in failed — please try again'); }
});
app.post('/api/auth/dev', limit(20, 60e3), async (req, res) => {
  if (!DEV_LOGIN) return res.status(404).json({ error: 'Not found' });
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  const user = await upsertUser({ email, name: String(req.body.name || '').slice(0, 60) }, true);
  if (user.role === 'blocked') return res.status(403).json({ error: 'This account has been blocked' });
  await startSession(req, res, user);
  broadcast('users', {});
  res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', async (req, res) => {
  const sid = parseCookies(req.headers.cookie)[COOKIE];
  if (sid) await q.delSess(sid);
  res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

/* --------------------------------------------------------------- users API */
app.get('/api/users', ADMIN, async (req, res) => res.json({ users: (await q.allUsers()).map(u => ({ ...publicUser(u), createdAt: u.created_at, lastLogin: u.last_login, joined: !!u.google_sub || u.last_login != null })) }));
app.post('/api/users', ADMIN, async (req, res) => { // pre-approve ("invite") by email
  const email = String(req.body.email || '').trim().toLowerCase();
  const r = req.body.role || 'editor';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  if (!['editor', 'admin'].includes(r)) return res.status(400).json({ error: 'Invalid role' });
  const ex = await q.userByEmail(email);
  if (ex) { await q.setRole(r, ex.id); }
  else await q.insUser(email, email.split('@')[0], '', null, r, Date.now(), null);
  broadcast('users', {});
  res.json({ ok: true });
});
app.patch('/api/users/:id', ADMIN, async (req, res) => {
  const u = Number.isSafeInteger(+req.params.id) ? await q.userById(+req.params.id) : null;
  const r = req.body.role;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (!ROLES.includes(r)) return res.status(400).json({ error: 'Invalid role' });
  if (u.role === 'admin' && r !== 'admin' && (await q.countAdmins()) <= 1) return res.status(409).json({ error: 'There must always be at least one admin' });
  if (ADMIN_EMAILS.includes(u.email) && r !== 'admin') return res.status(409).json({ error: 'This email is a permanent admin (set in ADMIN_EMAILS)' });
  await q.setRole(r, u.id);
  if (r === 'blocked') await q.delUserSess(u.id);
  broadcast('users', {});
  res.json({ ok: true });
});
app.delete('/api/users/:id', ADMIN, async (req, res) => {
  const u = Number.isSafeInteger(+req.params.id) ? await q.userById(+req.params.id) : null;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(409).json({ error: 'You cannot remove yourself' });
  if (ADMIN_EMAILS.includes(u.email)) return res.status(409).json({ error: 'This email is a permanent admin (set in ADMIN_EMAILS)' });
  await q.delUser(u.id);
  broadcast('users', {});
  res.json({ ok: true });
});

/* ------------------------------------------------------------ polling sync */
// Cheap change feed for hosts without streaming: versions of every tournament + who I am (+ a users stamp for admins).
app.get('/api/sync', async (req, res) => {
  const [ts, users] = await Promise.all([
    DB.many('SELECT id, version FROM tournaments'),
    req.user && req.user.role === 'admin' ? DB.one("SELECT md5(COALESCE(string_agg(id || ':' || role || ':' || COALESCE(last_login, 0), ',' ORDER BY id), '')) AS stamp FROM users") : null,
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ tournaments: ts, user: publicUser(req.user), users: users && users.stamp });
});

/* ---------------------------------------------------------- tournaments API */
app.get('/api/tournaments', async (req, res) => res.json({ tournaments: (await q.tAll()).map(toDoc) }));
app.get('/api/tournaments/:id', async (req, res) => {
  const row = await q.tOne(req.params.id);
  if (!row) return res.status(404).json({ error: 'Tournament not found' });
  res.json({ tournament: toDoc(row) });
});
app.post('/api/tournaments', EDITOR, async (req, res) => {
  const { doc, error } = V.cleanNew(req.body);
  if (error) return res.status(400).json({ error });
  const id = newId(), now = Date.now();
  await q.tIns(id, doc, 1, req.user.id, now, now);
  broadcast('t', { id, version: 1 });
  res.status(201).json({ tournament: toDoc(await q.tOne(id)) });
});
// Partial update. Structural keys need the client's last-seen version (optimistic concurrency).
app.put('/api/tournaments/:id', EDITOR, async (req, res) => {
  const { version, set } = req.body || {};
  if (!V.isObj(set) || !Object.keys(set).length) return res.status(400).json({ error: 'Nothing to update' });
  const keys = Object.keys(set);
  const bad = keys.find(k => !V.EDITABLE.includes(k));
  if (bad) return res.status(400).json({ error: `"${bad}" cannot be changed` });
  const err = V.validateKeys(set, keys);
  if (err) return res.status(400).json({ error: err });
  try {
    const out = await DB.tx(async c => {
      const row = await tLock(c, req.params.id);
      if (!row) return { code: 404, body: { error: 'Tournament not found' } };
      if (keys.some(k => V.STRUCTURAL.includes(k)) && version !== row.version)
        return { code: 409, body: { error: 'Someone else changed this tournament — the latest version has been loaded. Please try again.', tournament: toDoc(row) } };
      const doc = row.data;
      Object.assign(doc, set);
      await tSave(c, row.id, doc, row.version + 1);
      return { code: 200, body: { tournament: toDoc(await tRead(c, row.id)) } };
    });
    if (out.code === 200) broadcast('t', { id: req.params.id, version: out.body.tournament.version });
    res.status(out.code).json(out.body);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});
// Scoring is its own endpoint so two scorers on different matches never collide.
app.patch('/api/tournaments/:id/matches/:mid', EDITOR, async (req, res) => {
  const { stage, games, status, court, pa, pb, tournamentStage } = req.body || {};
  if (!['group', 'ko'].includes(stage) || !V.STATUSES.includes(status) || !V.games(games) || (court != null && !V.isStr(court, 12)))
    return res.status(400).json({ error: 'Invalid score data' });
  if ((pa != null && !V.isStr(pa, 40)) || (pb != null && !V.isStr(pb, 40))) return res.status(400).json({ error: 'Invalid score data' });
  if (tournamentStage != null && !V.STAGES.includes(tournamentStage)) return res.status(400).json({ error: 'Invalid stage' });
  try {
    const out = await DB.tx(async c => {
      const row = await tLock(c, req.params.id);
      if (!row) return { code: 404, body: { error: 'Tournament not found' } };
      const doc = row.data;
      if (doc.stage === 'setup') return { code: 409, body: { error: 'The group stage has not started' } };
      const list = stage === 'ko' ? doc.ko && doc.ko.matches : doc.matches;
      const m = list && list.find(x => x.id === req.params.mid);
      if (!m) return { code: 404, body: { error: 'Match not found — refresh and try again' } };
      m.games = games; m.status = status; m.court = court || '';
      if (status === 'done') { if (!m.seq) m.seq = doc.seq = (doc.seq || 0) + 1; m.doneAt = Date.now(); }
      else { m.seq = 0; m.doneAt = 0; }
      if (stage === 'ko') { if (status === 'done') { m.pa = pa ?? null; m.pb = pb ?? null; } else { delete m.pa; delete m.pb; } }
      if (tournamentStage) doc.stage = tournamentStage;
      await tSave(c, row.id, doc, row.version + 1);
      return { code: 200, body: { tournament: toDoc(await tRead(c, row.id)) } };
    });
    if (out.code === 200) broadcast('t', { id: req.params.id, version: out.body.tournament.version });
    res.status(out.code).json(out.body);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});
app.delete('/api/tournaments/:id', EDITOR, async (req, res) => {
  const row = await q.tOne(req.params.id);
  if (!row) return res.status(404).json({ error: 'Tournament not found' });
  if (req.user.role !== 'admin' && row.created_by !== req.user.id) return res.status(403).json({ error: 'Only an admin or the creator can delete a tournament' });
  await q.tDel(row.id);
  broadcast('del', { id: row.id });
  res.json({ ok: true });
});

/* ------------------------------------------------------------- admin tools */
app.get('/api/admin/export', ADMIN, async (req, res) => {
  res.set('Content-Disposition', `attachment; filename="sjbc-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ app: 'sjbc', v: 2, exportedAt: Date.now(), tournaments: (await q.tAll()).map(toDoc) });
});
app.post('/api/admin/import', ADMIN, async (req, res) => {
  const list = req.body && req.body.tournaments;
  if (!Array.isArray(list) || list.length > 200) return res.status(400).json({ error: 'Not a valid SJBC backup' });
  const clean = [];
  for (const t of list) {
    const { doc, error } = V.cleanNew(t);
    if (error) return res.status(400).json({ error: `Backup rejected: ${error}` });
    for (const k of ['startDate', 'endDate', 'venue']) if (k in t) doc[k] = t[k];
    clean.push(doc);
  }
  await DB.tx(async c => { await c.query('DELETE FROM tournaments'); const now = Date.now(); for (const d of clean) await q.tIns(newId(), d, 1, req.user.id, now, now, c); });
  broadcast('reload', {});
  res.json({ ok: true, count: clean.length });
});
app.delete('/api/admin/tournaments', ADMIN, async (req, res) => { await DB.query('DELETE FROM tournaments'); broadcast('reload', {}); res.json({ ok: true }); });

/* -------------------------------------------------------------------- SSE */
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/healthz', async (req, res) => {
  try { await DB.query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
});
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

/* ----------------------------------------------------------------- static */
const PUB = path.join(__dirname, '..', 'public');
app.use(express.static(PUB, {
  extensions: ['html'],
  setHeaders: (res, p) => { if (/\.(html|js|css|json)$/.test(p)) res.set('Cache-Control', 'no-cache'); },
}));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
  console.error(err); res.status(500).json({ error: 'Server error' });
});

const ready = DB.migrate().then(() => { if (!SERVERLESS) return startListener(); });
let server = null;
async function shutdown() {
  stopping = true;
  for (const res of clients) res.end();
  if (server) await new Promise(r => { server.close(r); server.closeAllConnections?.(); });
  if (listener) { const l = listener; listener = null; await l.end().catch(() => {}); }
  await DB.pool.end().catch(() => {});
}
if (require.main === module) {
  ready.then(() => {
    server = app.listen(PORT, () => {
      console.log(`\n  SJBC Tournament Manager  →  http://localhost:${PORT}`);
      console.log(`  Database: PostgreSQL${DB.SCHEMA ? ' (schema ' + DB.SCHEMA + ')' : ''}`);
      console.log(`  Google sign-in: ${GOOGLE_ON ? 'enabled — redirect URI: ' + (PUBLIC_URL || 'http://localhost:' + PORT) + '/auth/google/callback' : 'NOT configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'}`);
      console.log(`  Dev login: ${DEV_LOGIN ? 'ON (local development only)' : 'off'}`);
      console.log(`  Permanent admins: ${ADMIN_EMAILS.join(', ') || '(none — first dev-login user becomes admin)'}\n`);
    });
  }).catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => shutdown().finally(() => process.exit(0)));
}
module.exports = { app, ready, shutdown, pool: DB.pool };
