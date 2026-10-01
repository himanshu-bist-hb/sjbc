/* SJBC — Tournament Manager
   Vanilla JS front-end. Data lives on the server (SQLite); this file talks to /api and
   listens to /api/events for live updates. */
'use strict';

/* ============================================================
   Constants & tiny helpers
   ============================================================ */
const K_FACTOR = 32;
const BASE_ELO = 1500;
const CAPS = { 11: 15, 15: 21, 21: 30 };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const GL = i => String.fromCharCode(65 + i);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n));

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a1 1 0 0 0-1 1 4 4 0 0 0 4 4"/><path d="M17 5h3a1 1 0 0 1 1 1 4 4 0 0 1-4 4"/><path d="M12 14v3"/><path d="M9 20h6"/><path d="M9.5 17h5l.5 3h-6l.5-3Z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.4"/><path d="M14.8 14a4.6 4.6 0 0 1 5.7 4.5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  chart: '<path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/><path d="M3 20h18"/>',
  bracket: '<rect x="3" y="4" width="6" height="4" rx="1"/><rect x="3" y="16" width="6" height="4" rx="1"/><rect x="15" y="10" width="6" height="4" rx="1"/><path d="M9 6h3a2 2 0 0 1 2 2v2"/><path d="M9 18h3a2 2 0 0 0 2-2v-2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.4 2.1a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9c.5.4 1.1.8 1.7 1L9 21h6l.4-2.1c.6-.2 1.2-.6 1.7-1l2.3.9 2-3.4-2-1.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/><path d="M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  shuffle: '<path d="M3 7h4l10 10h4"/><path d="M3 17h4l3-3"/><path d="M14 10l3-3h4"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/>',
  play: '<path d="M7 4l13 8-13 8V4Z"/>',
  download: '<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 16V5"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
  pin: '<path d="M12 21s7-7.1 7-12a7 7 0 1 0-14 0c0 4.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="m8.5 3 3.5 7 3.5-7"/>',
};
const ic = (n, s = 18, sw = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const LOGO = (s = 26) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2 4 20h16L12 2Z" fill="#C3F53C"/><circle cx="12" cy="20.3" r="1.7" fill="#0A0C10" stroke="#C3F53C" stroke-width="1.2"/></svg>`;

/* ============================================================
   State, API & persistence
   ============================================================ */
let S = { tournaments: [] };       // mirror of the server's tournaments
let ME = null;                     // signed-in user or null
let CFG = { google: false, devLogin: false };
let READY = false, LOADERR = null, LIVE = false, USERS = null;

const canEdit = () => !!ME && (ME.role === 'editor' || ME.role === 'admin');
const isAdmin = () => !!ME && ME.role === 'admin';

async function api(method, url, body) {
  let r;
  try {
    r = await fetch(url, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { const err = new Error('Cannot reach the server — check your connection'); err.status = 0; throw err; }
  let data = null; try { data = await r.json(); } catch (e) { /* no body */ }
  if (!r.ok) { const err = new Error((data && data.error) || `Request failed (${r.status})`); err.status = r.status; err.data = data; throw err; }
  return data;
}
function upsertLocal(doc) {
  const i = S.tournaments.findIndex(x => x.id === doc.id);
  if (i >= 0) S.tournaments[i] = doc; else S.tournaments.push(doc);
}
async function loadAll() { S.tournaments = (await api('GET', '/api/tournaments')).tournaments; }
async function refreshOne(id) {
  try { upsertLocal((await api('GET', '/api/tournaments/' + id)).tournament); }
  catch (e) { if (e.status === 404) S.tournaments = S.tournaments.filter(x => x.id !== id); }
}

/* All writes go through one queue so versions stay in order and optimistic local
   edits are never overwritten by an earlier response. */
let queue = Promise.resolve(), pending = 0, resync = new Set();
function enqueue(job, failId) {
  pending++;
  queue = queue.then(async () => {
    try { await job(); }
    catch (e) {
      if (e.status === 401) { ME = null; toast('Your session expired — please sign in again', 'err'); }
      else toast(e.message, 'err');
      if (e.data && e.data.tournament) upsertLocal(e.data.tournament);
      else if (failId) await refreshOne(failId);
      render();
    } finally {
      pending--;
      if (!pending && resync.size) { const ids = [...resync]; resync.clear(); await Promise.all(ids.map(refreshOne)); render(); }
    }
  });
  return queue;
}
function finishWrite(doc) { // keep local optimistic state if more writes are waiting
  const loc = T(doc.id);
  if (loc && pending > 1) { loc.version = doc.version; loc.updatedAt = doc.updatedAt; } else upsertLocal(doc);
  render();
}
/** Optimistic local change → render now, persist the listed keys in the background. */
function commit(t, keys) {
  t.updatedAt = Date.now(); render();
  if (!keys || !keys.length) return;
  enqueue(async () => {
    const cur = T(t.id); if (!cur) return;
    const set = {}; keys.forEach(k => { set[k] = cur[k]; });
    finishWrite((await api('PUT', '/api/tournaments/' + t.id, { version: cur.version, set })).tournament);
  }, t.id);
}
const PAYLOAD_KEYS = ['name', 'venue', 'startDate', 'endDate', 'type', 'groups', 'matchesPerTeam', 'bestOf', 'koBestOf', 'points', 'knockout', 'thirdPlace', 'stage', 'teams', 'matches', 'ko', 'seq'];
async function createOnServer(t) {
  const body = {}; PAYLOAD_KEYS.forEach(k => { body[k] = t[k]; });
  const doc = (await api('POST', '/api/tournaments', body)).tournament;
  upsertLocal(doc); return doc;
}

const T = id => S.tournaments.find(x => x.id === id);
const teamOf = (t, id) => t.teams.find(x => x.id === id);
const tname = tm => (tm ? tm.name || tm.players.map(p => p.name).join(' & ') : 'TBD');
// players listed under a team that has its own name (a name-only team stores its name as a stand-in player)
const tmembers = tm => (tm && tm.name && !(tm.players.length === 1 && tm.players[0].name === tm.name) ? tm.players.map(p => p.name).join(' & ') : '');
const initials = n => {
  const w = String(n).trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '?') + (w.length > 1 ? w[1][0] : (w[0]?.[1] || ''))).toUpperCase();
};
const pidOf = (tm, i) => tm.id + '.' + i;

/* ============================================================
   Scoring rules
   ============================================================ */
const capFor = P => CAPS[P] || P + 9;
function gameValid(x, y, P) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return 'Enter whole numbers';
  if (x === y) return 'A game cannot end in a tie';
  const hi = Math.max(x, y), lo = Math.min(x, y), cap = capFor(P);
  if (hi < P) return `Winner needs at least ${P} points`;
  if (hi === P) return lo <= P - 2 ? null : `At ${P} the winner must lead by 2`;
  if (hi < cap) return hi - lo === 2 ? null : `Past ${P} the winning margin must be exactly 2`;
  if (hi === cap) return lo >= cap - 2 ? null : `At the ${cap}-point cap the loser has ${cap - 2} or ${cap - 1}`;
  return `Highest possible score is ${cap}`;
}
/** raw = [[ '21','15' ], ...] strings from the form */
function evalGames(raw, P, bo) {
  const need = Math.ceil(bo / 2);
  let wa = 0, wb = 0, pa = 0, pb = 0, err = null;
  const played = [];
  const blank = g => !g || (g[0] === '' && g[1] === '');
  let stop = -1;
  for (let i = 0; i < bo; i++) {
    const g = raw[i] || ['', ''];
    if (wa === need || wb === need) { if (!blank(g)) err = `Game ${i + 1} isn't needed — the match is already decided`; stop = i; break; }
    if (blank(g)) { stop = i; break; }
    if (g[0] === '' || g[1] === '') { err = `Enter both scores for game ${i + 1}`; stop = i; break; }
    const x = +g[0], y = +g[1], e = gameValid(x, y, P);
    if (e) { err = `Game ${i + 1}: ${e}`; stop = i; break; }
    played.push([x, y]); pa += x; pb += y; x > y ? wa++ : wb++;
  }
  if (!err && stop >= 0) for (let j = stop + 1; j < bo; j++) if (!blank(raw[j])) { err = 'Fill the games in order'; break; }
  const done = !err && (wa === need || wb === need);
  return { done, err, wa, wb, pa, pb, played, winner: done ? (wa > wb ? 'a' : 'b') : null, need };
}
function gstats(m) {
  const g = m.games || [];
  let wa = 0, wb = 0, pa = 0, pb = 0;
  g.forEach(([x, y]) => { x > y ? wa++ : y > x && wb++; pa += x; pb += y; });
  return { wa, wb, pa, pb, winner: m.status === 'done' ? (wa > wb ? 'a' : 'b') : null };
}

/* ============================================================
   Knockout structure
   ============================================================ */
function seedOrder(size) {
  let o = [1, 2];
  while (o.length < size) { const n = o.length * 2 + 1; o = o.flatMap(x => [x, n - x]); }
  return o;
}
const roundName = (r, R) => (r === R ? 'Final' : r === R - 1 ? 'Semifinals' : r === R - 2 ? 'Quarterfinals' : `Round of ${2 ** (R - r + 1)}`);
const matchLabel = (r, R, i, cnt) => (r === R ? 'Final' : `${r === R - 1 ? 'Semifinal' : r === R - 2 ? 'Quarterfinal' : 'Round of ' + 2 ** (R - r + 1)}${cnt > 1 ? ' · ' + (i + 1) : ''}`);

function koResolve(t) {
  if (!t.ko) return [];
  const R = Math.log2(t.ko.size);
  const byId = {};
  const out = [];
  const resolve = m => {
    let a = null, b = null, bye = false;
    if (m.third) {
      const s1 = byId[`R${R - 1}M1`], s2 = byId[`R${R - 1}M2`];
      a = s1?.lose || null; b = s2?.lose || null;
    } else if (m.round === 1) {
      a = t.ko.slots[m.idx * 2]; b = t.ko.slots[m.idx * 2 + 1];
      bye = !a || !b;
    } else {
      a = byId[`R${m.round - 1}M${m.idx * 2 + 1}`]?.win || null;
      b = byId[`R${m.round - 1}M${m.idx * 2 + 2}`]?.win || null;
    }
    if (m.status === 'done' && (m.pa !== a || m.pb !== b)) { // participants changed → result is stale
      m.games = []; m.status = 'scheduled'; m.seq = 0; m.doneAt = 0; delete m.pa; delete m.pb;
    }
    const r = { ...m, a, b, bye, round: m.round, final: !m.third && m.round === R };
    if (bye) { r.win = a || b || null; r.lose = null; r.status = 'bye'; }
    else if (m.status === 'done' && a && b) { const w = gstats(m).winner; r.win = w === 'a' ? a : b; r.lose = w === 'a' ? b : a; }
    else { r.win = null; r.lose = null; }
    byId[m.id] = r; out.push(r);
  };
  [...t.ko.matches].sort((x, y) => (x.third ? 1 : 0) - (y.third ? 1 : 0) || x.round - y.round || x.idx - y.idx).forEach(resolve);
  return out;
}
// Knockout fixtures shown before the group stage has decided who qualifies: slots are named by group position.
function koPreview(t) {
  const per = qualPerGroup(t), ids = [], info = {};
  for (let r = 1; r <= per; r++) for (let g = 0; g < t.groups; g++) { const id = `ph${g}_${r}`; ids.push(id); info[id] = { g, rank: r }; }
  const list = t.knockout === 'top4' ? ids.slice(0, 4) : ids;
  if (list.length < 2) return [];
  const ko = buildKo(t, list, info), R = Math.log2(ko.size);
  const lab = id => (t.knockout === 'top4' && t.groups > 2 && info[id].rank === 2 ? 'Best runner-up' : `${ordinal(info[id].rank)} team of Group ${GL(info[id].g)}`);
  return koResolve({ ...t, ko }).filter(m => m.status !== 'bye').map(m => {
    const from = (id, i) => id ? lab(id) : m.third ? `Loser of ${matchLabel(R - 1, R, i, 2)}` : `Winner of ${matchLabel(m.round - 1, R, m.idx * 2 + i, ko.size / 2 ** (m.round - 1))}`;
    return { ...m, a: null, b: null, preview: true, R, ph: { a: from(m.a, 0), b: from(m.b, 1) } };
  });
}
const koVisible = ms => ms.filter(m => !(m.third && (!m.a || !m.b) && m.status !== 'done'));

function buildKo(t, qual, info) {
  const N = qual.length;
  const size = Math.max(2, 2 ** Math.ceil(Math.log2(N)));
  const R = Math.log2(size);
  const slots = seedOrder(size).map(s => qual[s - 1] || null);
  const g = id => info[id]?.g;
  // avoid first-round clashes between teams of the same group where possible
  for (let p = 0; p < size / 2; p++) {
    const a = slots[p * 2], b = slots[p * 2 + 1];
    if (a && b && g(a) === g(b)) {
      for (let q = 0; q < size / 2; q++) {
        if (q === p) continue;
        const c = slots[q * 2], d = slots[q * 2 + 1];
        if (c && d && g(a) !== g(d) && g(c) !== g(b) && g(c) !== g(d)) { slots[p * 2 + 1] = d; slots[q * 2 + 1] = b; break; }
      }
    }
  }
  const matches = [];
  for (let r = 1; r <= R; r++) for (let i = 0; i < size / 2 ** r; i++)
    matches.push({ id: `R${r}M${i + 1}`, round: r, idx: i, stage: 'ko', games: [], status: 'scheduled', court: '', seq: 0 });
  if (t.thirdPlace && R >= 2) matches.push({ id: 'TP', round: R, idx: 0, third: true, stage: 'ko', games: [], status: 'scheduled', court: '', seq: 0 });
  return { size, qual, slots, info, matches };
}

/* ============================================================
   ELO
   ============================================================ */
function allMatches(t) { return [...t.matches, ...koResolve(t)]; }

function computeElo(t) {
  const r = {}, start = {};
  t.teams.forEach(tm => tm.players.forEach((p, i) => { r[pidOf(tm, i)] = p.elo; start[pidOf(tm, i)] = p.elo; }));
  const avg = tm => tm.players.reduce((s, _, i) => s + r[pidOf(tm, i)], 0) / tm.players.length;
  const deltas = {};
  allMatches(t).filter(m => m.status === 'done' && m.a && m.b).sort((x, y) => x.seq - y.seq).forEach(m => {
    const ta = teamOf(t, m.a), tb = teamOf(t, m.b);
    if (!ta || !tb) return;
    const ra = avg(ta), rb = avg(tb);
    const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
    const sa = gstats(m).winner === 'a' ? 1 : 0;
    const d = K_FACTOR * (sa - ea);
    ta.players.forEach((_, i) => { r[pidOf(ta, i)] += d; });
    tb.players.forEach((_, i) => { r[pidOf(tb, i)] -= d; });
    deltas[m.id] = { a: d, b: -d };
  });
  const teamNow = tm => avg(tm);
  const teamStart = tm => tm.players.reduce((s, _, i) => s + start[pidOf(tm, i)], 0) / tm.players.length;
  return { r, start, deltas, teamNow, teamStart };
}

function globalPlayers() {
  const map = new Map();
  [...S.tournaments].sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0)).forEach(t => {
    const e = computeElo(t);
    t.teams.forEach(tm => tm.players.forEach((p, i) => {
      const k = p.name.trim().toLowerCase();
      const cur = map.get(k) || { name: p.name, elo: p.elo, w: 0, l: 0, ev: 0 };
      cur.elo = e.r[pidOf(tm, i)]; cur.name = p.name; cur.ev++;
      map.set(k, cur);
    }));
    allMatches(t).filter(m => m.status === 'done' && m.a && m.b).forEach(m => {
      const w = gstats(m).winner === 'a' ? m.a : m.b, l = w === m.a ? m.b : m.a;
      teamOf(t, w)?.players.forEach(p => { const c = map.get(p.name.trim().toLowerCase()); if (c) c.w++; });
      teamOf(t, l)?.players.forEach(p => { const c = map.get(p.name.trim().toLowerCase()); if (c) c.l++; });
    });
  });
  return [...map.values()].sort((a, b) => b.elo - a.elo);
}
function lookupElo(name) {
  const k = name.trim().toLowerCase();
  const p = globalPlayers().find(x => x.name.trim().toLowerCase() === k);
  return p ? Math.round(p.elo) : BASE_ELO;
}

/* ============================================================
   Standings & fixtures
   ============================================================ */
function standings(t, g, e) {
  e = e || computeElo(t);
  const rows = t.teams.filter(x => x.group === g).map(tm => ({ team: tm, p: 0, w: 0, l: 0, gw: 0, gl: 0, pf: 0, pa: 0, form: [], elo: e.teamNow(tm), d: e.teamNow(tm) - e.teamStart(tm) }));
  const by = Object.fromEntries(rows.map(r => [r.team.id, r]));
  t.matches.filter(m => m.group === g && m.status === 'done').sort((a, b) => a.seq - b.seq).forEach(m => {
    const s = gstats(m), A = by[m.a], B = by[m.b];
    if (!A || !B) return;
    A.p++; B.p++; A.gw += s.wa; A.gl += s.wb; B.gw += s.wb; B.gl += s.wa;
    A.pf += s.pa; A.pa += s.pb; B.pf += s.pb; B.pa += s.pa;
    if (s.winner === 'a') { A.w++; B.l++; A.form.push('W'); B.form.push('L'); } else { B.w++; A.l++; A.form.push('L'); B.form.push('W'); }
  });
  rows.forEach(r => { r.gd = r.gw - r.gl; r.pd = r.pf - r.pa; });
  rows.sort((a, b) => b.w - a.w || b.elo - a.elo || b.pd - a.pd || tname(a.team).localeCompare(tname(b.team)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
const qualPerGroup = t => (t.knockout === 'top2' || t.knockout === 'top4' ? 2 : 1);

// Every entry plays exactly M different opponents (no rematches). If n*M is odd that is
// impossible, so one entry plays M-1 instead (short = 1).
function planGroup(n, M) {
  if (n < 2) return { edges: [], M: 0, short: 0 };
  const m = Math.min(M, n - 1);
  const edges = [], seen = new Set();
  const key = (i, j) => (i < j ? i + '-' + j : j + '-' + i);
  const add = (i, j) => { const k = key(i, j); if (!seen.has(k)) { seen.add(k); edges.push([i, j]); return true; } return false; };
  const base = (n * m) % 2 ? m - 1 : m;
  for (let d = 1; d <= Math.floor(base / 2); d++) for (let i = 0; i < n; i++) add(i, (i + d) % n);
  if (base % 2 === 1) for (let i = 0; i < n / 2; i++) add(i, i + n / 2); // n even here
  let short = 0;
  if (base < m) { // n odd, m odd: pair up all but one entry with a fresh opponent
    short = 1;
    const pair = (free) => {
      if (!free.length) return [];
      const [x, ...rest] = free;
      for (const y of rest) {
        if (seen.has(key(x, y))) continue;
        const sub = pair(rest.filter(z => z !== y));
        if (sub) return [[x, y], ...sub];
      }
      return null;
    };
    for (let skip = n - 1; skip >= 0; skip--) {
      const res = pair([...Array(n).keys()].filter(i => i !== skip));
      if (res) { res.forEach(([i, j]) => add(i, j)); break; }
    }
  }
  return { edges, M: m, short };
}
function generateFixtures(t) {
  const out = [];
  let reduced = false;
  for (let g = 0; g < t.groups; g++) {
    const ids = t.teams.filter(x => x.group === g).map(x => x.id);
    const { edges, M, short } = planGroup(ids.length, t.matchesPerTeam);
    if (M < t.matchesPerTeam || short) reduced = true;
    const used = [];
    edges.forEach(([i, j]) => {
      let r = 0;
      while (used[r] && (used[r].has(i) || used[r].has(j))) r++;
      (used[r] = used[r] || new Set()).add(i).add(j);
      out.push({ id: uid(), stage: 'group', group: g, round: r + 1, a: ids[i], b: ids[j], games: [], status: 'scheduled', court: '', seq: 0 });
    });
  }
  // play order: round by round, alternating groups (A, B, A, B …) inside each round
  const ordered = [];
  const maxRound = Math.max(0, ...out.map(m => m.round));
  for (let r = 1; r <= maxRound; r++) {
    const queues = Array.from({ length: t.groups }, (_, g) => out.filter(m => m.round === r && m.group === g));
    while (queues.some(q => q.length)) queues.forEach(q => { if (q.length) ordered.push(q.shift()); });
  }
  return { matches: ordered, reduced };
}
function progress(t) {
  const gm = t.matches, ko = koResolve(t).filter(m => !m.bye && !(m.third && !m.a));
  const all = [...gm, ...ko];
  return { done: all.filter(m => m.status === 'done').length, total: all.length, gdone: gm.filter(m => m.status === 'done').length, gtotal: gm.length, live: all.filter(m => m.status === 'live').length };
}
const groupsDone = t => t.matches.length > 0 && t.matches.every(m => m.status === 'done');

function qualifiers(t) {
  const e = computeElo(t);
  const per = [];
  for (let g = 0; g < t.groups; g++) per.push(standings(t, g, e));
  const cmp = (a, b) => b.w - a.w || b.elo - a.elo || b.pd - a.pd;
  const winners = per.map(s => s[0]).filter(Boolean).sort(cmp);
  const runners = per.map(s => s[1]).filter(Boolean).sort(cmp);
  let list = t.knockout === 'top1' ? winners : t.knockout === 'top4' ? [...winners, ...runners].slice(0, 4) : [...winners, ...runners];
  const info = {};
  list.forEach((r, i) => { info[r.team.id] = { g: r.team.group, rank: r.rank, seed: i + 1 }; });
  return { list: list.map(r => r.team.id), info };
}
function syncStage(t) {
  if (t.stage === 'setup') return;
  if (t.ko) { const f = koResolve(t).find(m => m.final); t.stage = f && f.status === 'done' ? 'done' : 'knockout'; }
  else t.stage = 'group';
}
const ordinal = r => (r === 1 ? 'First' : r === 2 ? 'Second' : r + 'th');
// placeholder qualifier names used before any group result exists
function genericQualifiers(t) {
  const per = qualPerGroup(t), out = [];
  for (let r = 1; r <= per; r++) for (let g = 0; g < t.groups; g++) out.push(`${ordinal(r)} team of Group ${GL(g)}`);
  return t.knockout === 'top4' ? out.slice(0, 4) : out;
}
const KO_TEXT = {
  top2: ['Top 2 per group, cross-bracket', 'Group winners and runners-up qualify. Seeds are cross-paired so group-mates meet as late as possible.'],
  top1: ['Group winners only', 'Only the top team of each group advances (needs 2+ groups).'],
  top4: ['Top 4 overall', 'Four semifinalists: group winners first, then the best runners-up.'],
};

/* ============================================================
   UI state
   ============================================================ */
const UI = { sbGroup: {}, mFilter: {}, mStatus: {}, rankQ: '', drag: null };
let W = null; // wizard state
function newWizard() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  const iso = x => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  const e = new Date(d.getTime() + 86400000);
  return { step: 1, name: '', venue: '', start: iso(d), end: iso(e), type: 'doubles', groups: 2, mpt: 3, bestOf: 3, points: 21, knockout: 'top2', third: false, koBestOf: 3 };
}

/* ============================================================
   Formatting helpers
   ============================================================ */
const fmtDate = s => { if (!s) return ''; const d = new Date(s + 'T00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
const fmtRange = (a, b) => (a && b && a !== b ? `${fmtDate(a)} – ${fmtDate(b)}` : fmtDate(a || b));
const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
const isToday = ts => ts && new Date(ts).toDateString() === new Date().toDateString();
const STAGE = {
  setup: ['Setup', ''], group: ['Group stage', 'live'], knockout: ['Knockout', 'orange'], done: ['Completed', 'lime'],
};
const stageBadge = t => {
  const [l, c] = STAGE[t.stage] || STAGE.setup;
  return `<span class="badge ${c}">${c === 'live' ? '<i class="dot"></i>' : c === 'lime' ? ic('check', 11, 3) : ''}${l}</span>`;
};
const avatar = (n, cls = '') => `<span class="av ${cls}">${esc(initials(n))}</span>`;
const teamAv = (tm, cls = '') => tm ? `<span class="avs">${tm.players.map(p => avatar(p.name, cls)).join('')}</span>` : '<span class="avs"><span class="av tbd">?</span></span>';
const typeLabel = t => (t.type === 'singles' ? 'Singles' : 'Doubles');
const unitLabel = t => (t.type === 'singles' ? 'players' : 'teams');

/* ============================================================
   Router & shell
   ============================================================ */
const route = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
const go = h => { if (location.hash === h) render(); else location.hash = h; };
window.addEventListener('hashchange', () => { closeModal(); render(true); });

const ROLE_LABEL = { admin: 'Admin', editor: 'Scorer', pending: 'Awaiting approval', blocked: 'Blocked' };
const NAV = [
  ['', 'Dashboard', 'home'], ['tournaments', 'Tournaments', 'trophy'], ['ranking', 'Ranking', 'chart'], ['settings', 'Settings', 'settings'],
];
const userAv = (u, cls = '') => u && u.picture
  ? `<img class="av ${cls}" src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer" style="object-fit:cover">`
  : avatar(u ? (u.name || u.email) : '?', cls || 'lime');
function renderShell(p) {
  const key = p[0] || '';
  const active = key === 't' || key === 'new' ? 'tournaments' : key === 'login' ? 'settings' : key;
  const nPending = isAdmin() && USERS ? USERS.filter(u => u.role === 'pending' && u.joined).length : 0;
  const nav = NAV.map(([h, l, i]) => [h, h === 'settings' && !ME ? 'Sign in' : l, i]);
  $('#sidebar').innerHTML = `
    <div class="brand">${LOGO()}<div><span class="num">Sanjay Jheel Badminton Club</span></div></div>
    <div class="nav-label">Menu</div>
    <nav class="nav">
      ${nav.map(([h, l, i]) => `<a href="#/${h}" class="${active === h ? 'on' : ''}">${ic(i, 19)}${l}${h === 'tournaments' && S.tournaments.length ? `<span class="cnt">${S.tournaments.length}</span>` : ''}</a>`).join('')}
      ${isAdmin() ? `<a href="#/admin" class="${key === 'admin' ? 'on' : ''}">${ic('shield', 19)}Admin${nPending ? `<span class="cnt" style="background:var(--lime);color:var(--bg)">${nPending}</span>` : ''}</a>` : ''}
    </nav>
    ${canEdit() ? `<div style="margin-top:18px"><a href="#/new" class="btn btn-primary" style="width:100%">${ic('plus', 16, 2.4)}New tournament</a></div>` : ''}
    <div class="live-pill ${LIVE ? 'on' : ''}" title="${LIVE ? 'Scores update instantly' : 'Reconnecting…'}"><i></i>${LIVE ? 'Live updates on' : 'Connecting…'}</div>
    ${ME ? `<a href="#/settings" class="side-foot">${userAv(ME)}<span style="min-width:0"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${esc(ME.name || ME.email)}</b><small>${ROLE_LABEL[ME.role]}</small></span></a>`
      : `<a href="#/login" class="side-foot"><div class="me num">?</div><span><b>Viewing as guest</b><small>Sign in to score matches</small></span></a>`}`;
  const item = ([h, l, i]) => `<a href="#/${h}" class="${active === h ? 'on' : ''}">${ic(i, 22)}<span>${l === 'Tournaments' ? 'Events' : l === 'Settings' ? 'Account' : l}</span></a>`;
  $('#bottomnav').innerHTML = item(nav[0]) + item(nav[1]) +
    (canEdit() ? `<a href="#/new" class="fab" aria-label="New tournament"><span class="fb">${ic('plus', 24, 2.6)}</span></a>` : '') + item(nav[2]) +
    (isAdmin() ? `<a href="#/admin" class="${key === 'admin' ? 'on' : ''}">${ic('shield', 22)}<span>Admin${nPending ? ` (${nPending})` : ''}</span></a>` : '') + item(nav[3]);
}

let lastKey = '';
function splash(msg, retry) {
  return `<div class="page"><div class="empty-big">${LOGO(54)}<h2 class="num">${msg}</h2>${retry ? '<p>The server could not be reached.</p><button class="btn btn-primary" data-act="retry">Try again</button>' : '<p>Loading…</p>'}</div></div>`;
}
function approvalBanner() {
  if (ME && ME.role === 'pending') return `<div class="note warn" style="max-width:1280px;margin:0 auto 20px">${ic('info', 16)}<span><b>You're signed in as ${esc(ME.email)}.</b> An admin needs to approve your account before you can create tournaments or enter scores. You can view everything in the meantime.</span></div>`;
  return '';
}
function render(fresh) {
  const p = route();
  const main = $('#main');
  const key = location.hash;
  const keepScroll = !fresh && key === lastKey;
  const sy = main.scrollTop, wy = window.scrollY;
  document.body.classList.toggle('ro', !canEdit());
  renderShell(p);
  let html;
  const k = p[0] || '';
  try {
    if (!READY) html = splash('Getting things ready…');
    else if (LOADERR) html = splash('Can’t connect', true);
    else if (k === '') html = pageDashboard();
    else if (k === 'tournaments') html = pageTournaments();
    else if (k === 'new') html = canEdit() ? pageWizard() : gate('create tournaments');
    else if (k === 't') html = pageTournament(p[1], p[2] || 'overview');
    else if (k === 'ranking') html = pageRanking();
    else if (k === 'settings') html = pageSettings();
    else if (k === 'login') html = pageLogin();
    else if (k === 'admin') html = isAdmin() ? pageAdmin() : gate('manage users');
    else html = pageDashboard();
  } catch (err) {
    console.error(err);
    html = `<div class="page"><div class="note bad">${ic('info')}<span>Something went wrong rendering this page: ${esc(err.message)}</span></div></div>`;
  }
  main.innerHTML = (READY ? approvalBanner() : '') + html;
  lastKey = key;
  if (keepScroll) { main.scrollTop = sy; window.scrollTo(0, wy); }
  else { main.scrollTop = 0; window.scrollTo(0, 0); }
  document.title = (k === 't' && T(p[1]) ? T(p[1]).name + ' · ' : '') + 'Sanjay Jheel Badminton Club';
  if (k === 'login' && READY && !ME) setupLogin();
}
function gate(what) {
  return `<div class="page"><div class="empty-big">${ic('shield', 48, 1.4)}<h2 class="num">${ME ? 'Not allowed' : 'Sign in required'}</h2><p>${ME ? `Your account can't ${what}. Ask an admin for access.` : `You need to sign in to ${what}.`}</p>${ME ? '' : '<a class="btn btn-primary" href="#/login">Sign in</a>'}</div></div>`;
}

/* ---------- auth ---------- */
async function afterLogin(user) {
  ME = user; USERS = null;
  await loadAll().catch(() => {});
  toast(user.role === 'pending' ? 'Signed in — waiting for admin approval' : 'Welcome, ' + (user.name || user.email));
  go('#/'); render(true);
  if (isAdmin()) loadUsers();
}
function setupLogin() {}
const G_LOGO = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4.1 7-10.1 7-17.5z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
function pageLogin() {
  if (ME) { setTimeout(() => go('#/'), 0); return splash('Signed in'); }
  const noAuth = !CFG.google && !CFG.devLogin;
  return `<div class="page" style="max-width:460px;padding-top:4vh">
    <div style="text-align:center;margin-bottom:26px">${LOGO(56)}<h1 class="num" style="font-size:30px;margin-top:14px">Sign in to Sanjay Jheel Badminton Club</h1><p class="muted" style="margin-top:6px">Anyone can watch scores without signing in. Sign in to create tournaments and enter results.</p></div>
    <div class="card">
      ${CFG.google ? `<a class="gbtn" href="/auth/google">${G_LOGO}Continue with Google</a>` : ''}
      ${noAuth ? `<div class="note warn" style="margin:0">${ic('info', 16)}<span>Google sign-in isn't configured on this server yet. Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the server environment.</span></div>` : ''}
      ${CFG.devLogin ? `<form data-form="devlogin" style="${CFG.google ? 'margin-top:20px;padding-top:20px;border-top:1px solid var(--line)' : ''}">
        <div class="eyebrow" style="color:var(--orange)">Local development login</div>
        <div class="field"><label for="dl-e">Email</label><input id="dl-e" class="input" name="email" type="email" placeholder="you@example.com" required autocomplete="email"></div>
        <div class="field"><label for="dl-n">Name</label><input id="dl-n" class="input" name="name" placeholder="Your name" maxlength="60"></div>
        <button class="btn btn-primary" style="width:100%" type="submit">Continue</button>
        <p class="fine" style="margin-top:10px">Only available when running locally. The very first person to sign in becomes admin.</p></form>` : ''}
    </div>
    <p class="fine" style="text-align:center;margin-top:18px"><a href="#/" class="link">← Continue as a guest</a></p></div>`;
}

/* ---------- admin ---------- */
async function loadUsers() {
  try { USERS = (await api('GET', '/api/users')).users; } catch (e) { USERS = USERS || []; toast(e.message, 'err'); }
  render();
}
const ago = ts => { if (!ts) return 'never'; const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; };
function pageAdmin() {
  if (!USERS) { loadUsers(); return splash('Loading users…'); }
  const pend = USERS.filter(u => u.role === 'pending' && u.joined);
  const urow = u => `<div class="urow">${userAv(u)}<div class="uinfo"><b>${esc(u.name || u.email)}${ME && u.id === ME.id ? ' <span class="dim">(you)</span>' : ''}</b><small>${esc(u.email)} · ${u.joined ? 'last seen ' + ago(u.lastLogin) : 'invited — hasn\'t signed in yet'}</small></div>
    <select class="input urole" data-chg="urole" data-u="${u.id}" aria-label="Role for ${esc(u.email)}">
      ${['pending', 'editor', 'admin', 'blocked'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>
    <button class="iconbtn del" data-act="user-del" data-u="${u.id}" aria-label="Remove user" ${ME && u.id === ME.id ? 'disabled style="opacity:.3;pointer-events:none"' : ''}>${ic('trash', 16)}</button></div>`;
  return `<div class="page" style="max-width:900px">${head('Administration', 'Users & access')}
    ${pend.length ? `<section class="card mb24" style="border-color:rgba(195,245,60,.35)"><div class="sec-head"><h2 class="sec num">Waiting for approval <span class="badge lime" style="margin-left:8px">${pend.length}</span></h2></div>
      ${pend.map(u => `<div class="urow">${userAv(u)}<div class="uinfo"><b>${esc(u.name || u.email)}</b><small>${esc(u.email)} · joined ${ago(u.createdAt)}</small></div>
      <button class="btn btn-primary btn-sm" data-act="user-approve" data-u="${u.id}">${ic('check', 14, 2.6)}Approve</button>
      <button class="btn btn-ghost btn-sm" data-act="user-block" data-u="${u.id}">Block</button></div>`).join('')}</section>` : ''}
    <section class="card mb24"><h2 class="sec num" style="font-size:16px;margin-bottom:6px">Invite someone</h2><p class="muted" style="margin-bottom:14px">Pre-approve a Google account by email. They get access the first time they sign in.</p>
      <form data-form="invite" class="row wrap" style="gap:10px"><input class="input" name="email" type="email" placeholder="name@gmail.com" required style="flex:1;min-width:220px" aria-label="Email to invite">
      <select class="input" name="role" style="width:150px" aria-label="Role"><option value="editor">Scorer</option><option value="admin">Admin</option></select><button class="btn btn-primary" type="submit">${ic('plus', 15, 2.4)}Invite</button></form></section>
    <section class="card"><div class="sec-head"><h2 class="sec num" style="font-size:16px">All users · ${USERS.length}</h2></div>${USERS.map(urow).join('') || '<div class="empty">No users yet</div>'}
      <div class="legend" style="margin-top:16px"><span><b>Scorer</b> can create tournaments and enter scores</span><span><b>Admin</b> can also manage users and data</span><span>Everyone else can still view live scores</span></div></section></div>`;
}

/* ---------- live updates ---------- */
let es = null, esOpenedOnce = false, pollTimer = null, usersStamp = null;
// Polling mode (serverless hosts): compare tournament versions every few seconds while the tab is visible.
function connectPoll() {
  if (pollTimer) return;
  const soft = () => { const a = document.activeElement; return !(a && a.matches && a.matches('#main input,#main textarea,#main select')); };
  const tick = async () => {
    if (document.hidden || pending) return;
    try {
      const d = await api('GET', '/api/sync');
      if (!LIVE) { LIVE = true; renderShell(route()); }
      let changed = false;
      const remote = new Map(d.tournaments.map(x => [x.id, x.version]));
      const gone = S.tournaments.filter(x => !remote.has(x.id));
      if (gone.length) { S.tournaments = S.tournaments.filter(x => remote.has(x.id)); changed = true; if (gone.some(x => route()[1] === x.id)) { go('#/tournaments'); return; } }
      const stale = d.tournaments.filter(x => { const l = T(x.id); return !l || x.version > l.version; });
      if (stale.length) { await Promise.all(stale.map(x => refreshOne(x.id))); changed = true; }
      const was = ME && ME.role;
      if ((d.user && d.user.role) !== was && (d.user || ME)) { ME = d.user; if (ME && was) toast('Your access changed: ' + ROLE_LABEL[ME.role]); changed = true; }
      if (d.users != null && d.users !== usersStamp) { const first = usersStamp === null; usersStamp = d.users; if (!first && isAdmin()) loadUsers(); }
      if (changed && soft()) render();
    } catch { if (LIVE) { LIVE = false; renderShell(route()); } }
  };
  pollTimer = setInterval(tick, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
}
function connectLive() {
  if (CFG && CFG.live === 'poll') return connectPoll();
  if (es || !window.EventSource) return;
  es = new EventSource('/api/events');
  es.onopen = () => {
    LIVE = true; renderShell(route());
    if (esOpenedOnce) loadAll().then(() => render()).catch(() => {}); // catch up after a dropped connection
    esOpenedOnce = true;
  };
  es.onerror = () => { LIVE = false; renderShell(route()); };
  const soft = () => { const a = document.activeElement; return !(a && a.matches && a.matches('#main input,#main textarea,#main select')); };
  es.addEventListener('t', ev => {
    const { id, version } = JSON.parse(ev.data), loc = T(id);
    if (loc && version <= loc.version) return;           // our own write echoing back
    if (pending) { resync.add(id); return; }
    refreshOne(id).then(() => { if (soft()) render(); });
  });
  es.addEventListener('del', ev => { const { id } = JSON.parse(ev.data); S.tournaments = S.tournaments.filter(x => x.id !== id); if (route()[1] === id) go('#/tournaments'); else render(); });
  es.addEventListener('reload', () => loadAll().then(() => render()));
  es.addEventListener('users', () => {
    api('GET', '/api/me').then(d => { const was = ME && ME.role; ME = d.user; if (ME && was && was !== ME.role) toast('Your access changed: ' + ROLE_LABEL[ME.role]); render(); }).catch(() => {});
    if (isAdmin()) loadUsers();
  });
}

/* ---------- boot ---------- */
async function boot() {
  READY = false; LOADERR = null; render(true);
  try {
    const [cfg, me] = await Promise.all([api('GET', '/api/config'), api('GET', '/api/me')]);
    CFG = cfg; ME = me.user;
    await loadAll();
    if (isAdmin()) api('GET', '/api/users').then(d => { USERS = d.users; render(); }).catch(() => {});
  } catch (e) { LOADERR = e; }
  READY = true; render(true);
  connectLive();
  const q = new URLSearchParams(location.search);
  if (q.get('auth_error')) toast(q.get('auth_error'), 'err');
  else if (q.get('signed_in') && ME) toast(ME.role === 'pending' ? 'Signed in — waiting for admin approval' : 'Welcome, ' + (ME.name || ME.email));
  if (q.has('auth_error') || q.has('signed_in')) history.replaceState(null, '', location.pathname + location.hash);
}

/* ============================================================
   Pages
   ============================================================ */
const head = (eyebrow, title, acts = '') => `<header class="phead"><div><div class="eyebrow">${eyebrow}</div><h1 class="num">${esc(title)}</h1></div><div class="pacts">${acts}</div></header>`;

function tournamentCard(t) {
  const pr = progress(t);
  const pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
  const stageLbl = t.stage === 'setup' ? 'Setting up' : t.stage === 'group' ? 'Group stage' : t.stage === 'knockout' ? 'Knockout' : 'Finished';
  const champ = t.stage === 'done' ? koResolve(t).find(m => m.final)?.win : null;
  const live = pr.live > 0;
  return `<a href="#/t/${t.id}" class="card">
    <div class="row between" style="align-items:flex-start;gap:16px;margin-bottom:6px">
      <div style="min-width:0">
        <div class="tcard-title">${esc(t.name)}</div>
        <div class="meta">
          ${t.venue ? `<span class="i">${ic('pin', 13)}${esc(t.venue)}</span><span>·</span>` : ''}
          <span>${t.groups} group${t.groups > 1 ? 's' : ''}</span><span>·</span><span>${t.teams.length} ${unitLabel(t)}</span>
        </div>
      </div>
      ${live ? '<span class="badge live"><i class="dot"></i>Live</span>' : stageBadge(t)}
    </div>
    <div class="progress"><span class="l">${stageLbl}</span><div class="bar ${t.stage === 'setup' ? 'blue' : ''}"><i style="width:${t.stage === 'setup' ? Math.min(100, t.teams.length * 4) : pct}%"></i></div><span class="num p">${t.stage === 'done' ? 'Done' : t.stage === 'setup' ? t.teams.length + ' added' : pct + '%'}</span></div>
    <div class="fine">${typeLabel(t)} · Best of ${t.bestOf} · ${t.matchesPerTeam} matches per ${t.type === 'singles' ? 'player' : 'team'}${champ ? ` · 🏆 ${esc(tname(teamOf(t, champ)))}` : ''}</div>
  </a>`;
}
function lbRows(list, n = 5) {
  return `<div class="lb">${list.slice(0, n).map((p, i) => `
    <div class="lb-row ${i === 0 ? 'top' : ''}"><span class="rk num">${i + 1}</span>${avatar(p.name)}<span class="nm">${esc(p.name)}</span><span class="elo num">${Math.round(p.elo)}</span></div>`).join('')}</div>`;
}

function pageDashboard() {
  const ts = S.tournaments;
  const players = globalPlayers();
  const teams = ts.reduce((s, t) => s + t.teams.length, 0);
  const active = ts.filter(t => t.stage !== 'done').length;
  const today = ts.reduce((s, t) => s + allMatches(t).filter(m => m.status === 'done' && isToday(m.doneAt)).length, 0);
  const live = ts.reduce((s, t) => s + progress(t).live, 0);
  if (!ts.length) return `<div class="page">${head('Welcome to Sanjay Jheel Badminton Club', 'Your tournaments', `<a href="#/new" class="btn btn-primary">${ic('plus', 16, 2.4)}New tournament</a>`)}
    <div class="empty-big">${LOGO(54)}<h2 class="num">${canEdit() ? 'Let’s get the first tournament going' : 'No tournaments yet'}</h2>
    <p>${canEdit() ? 'Create groups, add singles or doubles teams, track every score and let the ELO ratings update themselves — all the way to the final.' : 'Check back soon — live scores will appear here as soon as a tournament is created.'}</p>
    <div class="row wrap" style="justify-content:center;gap:12px"><a href="#/new" class="btn btn-primary">${ic('plus', 16, 2.4)}Create tournament</a>
    <button class="btn btn-ghost" data-act="demo">${ic('play', 15)}Load demo data</button></div></div></div>`;
  const stat = (l, v, icn, col, sub = '') => `<div class="card stat"><div class="lbl"><span>${l}</span><span style="color:${col}">${icn}</span></div><div class="val num">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
  const sorted = [...ts].sort((a, b) => (a.stage === 'done') - (b.stage === 'done') || (b.updatedAt || 0) - (a.updatedAt || 0));
  return `<div class="page">
    ${head('Welcome back', 'Your tournaments', `<a href="#/new" class="btn btn-primary">${ic('plus', 16, 2.4)}New tournament</a>`)}
    <div class="grid g4 mb32">
      ${stat('Active tournaments', active, ic('trophy', 17), '#8FB82B')}
      ${stat('Players', players.length, ic('users', 17), '#4C8DFF', `${teams} ${teams === 1 ? 'entry' : 'entries'} across events`)}
      ${stat('Matches today', today, ic('chart', 17), '#FFA94D')}
      ${stat('Live right now', live, `<span style="display:block;width:8px;height:8px;border-radius:50%;background:#4C8DFF"></span>`, '#4C8DFF')}
    </div>
    <div class="split">
      <section>
        <div class="sec-head"><h2 class="sec num">Ongoing &amp; upcoming</h2><a href="#/tournaments" class="link">View all</a></div>
        <div class="stack">${sorted.slice(0, 5).map(tournamentCard).join('')}</div>
      </section>
      <section class="card">
        <div class="sec-head" style="margin-bottom:18px"><h2 class="sec num" style="font-size:16px">Top ELO</h2><span class="dim" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">All events</span></div>
        ${players.some(p => p.w + p.l > 0) ? lbRows(players.filter(p => p.w + p.l > 0)) : '<div class="empty"><b>No rated matches yet</b>Ratings appear after the first result is recorded.</div>'}
        <a href="#/ranking" class="link" style="display:block;margin-top:14px">Full ranking →</a>
      </section>
    </div></div>`;
}

function pageTournaments() {
  const ts = [...S.tournaments].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return `<div class="page">${head('All events', 'Tournaments', `<a href="#/new" class="btn btn-primary">${ic('plus', 16, 2.4)}New tournament</a>`)}
    ${ts.length ? `<div class="grid g2">${ts.map(tournamentCard).join('')}</div>` :
      `<div class="empty-big">${ic('trophy', 48, 1.4)}<h2 class="num">No tournaments yet</h2><p>Create your first one — it takes about a minute.</p><a href="#/new" class="btn btn-primary">${ic('plus', 16, 2.4)}Create tournament</a></div>`}
  </div>`;
}

/* ---------- wizard ---------- */
function stepper(key, val, min, max) {
  return `<div class="stepper"><button type="button" data-act="wstep" data-k="${key}" data-d="-1" ${val <= min ? 'disabled style="opacity:.35"' : ''} aria-label="Decrease">−</button><b class="num">${val}</b><button type="button" data-act="wstep" data-k="${key}" data-d="1" ${val >= max ? 'disabled style="opacity:.35"' : ''} aria-label="Increase">+</button></div>`;
}
function wopt(key, val, cur, title, desc = '', icon = '', compact = false) {
  return `<button type="button" class="opt ${compact ? 'compact' : ''} ${cur === val ? 'on' : ''}" data-act="wset" data-k="${key}" data-v="${val}">${icon ? `<span class="ic">${ic(icon, 20)}</span>` : ''}<span><b>${title}</b>${desc ? `<span class="d">${desc}</span>` : ''}</span></button>`;
}
function pageWizard() {
  if (!W) W = newWizard();
  const steps = ['Basics', 'Format', 'Review'];
  const bar = `<div class="steps">${steps.map((s, i) => `<div class="step ${W.step === i + 1 ? 'on' : W.step > i + 1 ? 'done' : ''}"><i>${W.step > i + 1 ? ic('check', 12, 3) : i + 1}</i>${s}</div>`).join('')}</div>`;
  let body = '';
  if (W.step === 1) {
    body = `<div class="card" style="max-width:720px">
      <div class="field"><label for="w-name">Tournament name</label><input id="w-name" class="input" data-w="name" value="${esc(W.name)}" placeholder="e.g. Diwali Open Doubles 2026" maxlength="60" autocomplete="off"></div>
      <div class="field"><label for="w-venue">Venue <span class="dim" style="text-transform:none;letter-spacing:0">(optional)</span></label><input id="w-venue" class="input" data-w="venue" value="${esc(W.venue)}" placeholder="e.g. Sunder JB Courts" maxlength="60"></div>
      <div class="two"><div class="field"><label for="w-s">Start date</label><input id="w-s" type="date" class="input" data-w="start" value="${W.start}"></div>
      <div class="field"><label for="w-e">End date</label><input id="w-e" type="date" class="input" data-w="end" value="${W.end}"></div></div>
      <div class="field" style="margin-bottom:0"><label>Event type</label><div class="opts c2" style="margin-top:2px">
        ${wopt('type', 'singles', W.type, 'Singles', 'One player per entry', 'user')}${wopt('type', 'doubles', W.type, 'Doubles', 'Two players per team', 'users')}</div></div>
    </div>`;
  } else if (W.step === 2) {
    body = `<div class="grid g2" style="align-items:start"><div class="card">
      <div class="field"><label>Number of groups</label>${stepper('groups', W.groups, 1, 8)}<small>Entries are split across groups — seeded or random draw on the next screen.</small></div>
      <div class="field"><label>Matches per ${W.type === 'singles' ? 'player' : 'team'}</label>${stepper('mpt', W.mpt, 1, 10)}<small>Played inside the group stage. A full round-robin is one match against every group-mate.</small></div>
      <div class="field"><label>Group-stage match format</label><div class="opts c2">${wopt('bestOf', 1, W.bestOf, 'Best of 1', 'One game', '', true)}${wopt('bestOf', 3, W.bestOf, 'Best of 3', 'First to 2 games', '', true)}</div></div>
      <div class="field" style="margin-bottom:0"><label>Points per game</label><div class="opts c3">${[11, 15, 21].map(p => wopt('points', p, W.points, p, '', '', true)).join('')}</div><small>Win by 2, capped at ${capFor(W.points)} — standard BWF rules.</small></div>
    </div><div class="card">
      <div class="field"><label>Knockout stage</label><div class="opts">
        ${Object.entries(KO_TEXT).map(([k, [t, d]]) => wopt('knockout', k, W.knockout, t, d, 'bracket')).join('')}</div></div>
      <div class="field"><label>Knockout match format</label><div class="opts c2">${wopt('koBestOf', 1, W.koBestOf, 'Best of 1', '', '', true)}${wopt('koBestOf', 3, W.koBestOf, 'Best of 3', '', '', true)}</div></div>
      <div class="field" style="margin-bottom:0"><label>Third-place playoff</label><button type="button" class="switch ${W.third ? 'on' : ''}" data-act="wtoggle" data-k="third"><span><b style="display:block;font-size:14px">Bronze match</b><span class="muted" style="font-size:12.5px">Semifinal losers play for 3rd place</span></span><span class="t"></span></button></div>
    </div></div>`;
  } else {
    const ko = KO_TEXT[W.knockout][0];
    body = `<div class="card summary" style="max-width:720px"><div class="eyebrow" style="margin-bottom:6px">Tournament summary</div>
      <h2 class="num" style="font-size:24px;overflow-wrap:anywhere">${esc(W.name || 'Untitled tournament')}</h2>
      <div class="muted" style="margin-top:4px">${[fmtRange(W.start, W.end), W.venue].filter(Boolean).map(esc).join(' · ')}</div>
      <dl>
        <dt>Event</dt><dd>${W.type === 'singles' ? 'Singles' : 'Doubles'}</dd>
        <dt>Groups</dt><dd>${W.groups}</dd>
        <dt>Matches per ${W.type === 'singles' ? 'player' : 'team'}</dt><dd>${W.mpt}</dd>
        <dt>Group matches</dt><dd>Best of ${W.bestOf}, to ${W.points}</dd>
        <dt>Knockout</dt><dd>${ko}</dd>
        <dt>Knockout matches</dt><dd>Best of ${W.koBestOf}${W.third ? ' · with bronze match' : ''}</dd>
      </dl>
      <div class="note">${ic('info', 16)}<span>Next you'll add ${W.type === 'singles' ? 'players' : 'teams'} and draw them into groups. ELO ratings (K=${K_FACTOR}) update automatically after every recorded result.</span></div></div>`;
  }
  const last = W.step === 3;
  return `<div class="page"><a href="#/tournaments" class="back" data-act="wcancel">${ic('back', 16)}Cancel</a>${head('New tournament', W.step === 1 ? 'Basics' : W.step === 2 ? 'Format & structure' : 'Review & create')}
    ${bar}${body}
    <div class="row" style="margin-top:24px;gap:12px;max-width:720px;justify-content:space-between">
      ${W.step > 1 ? `<button class="btn btn-ghost" data-act="wprev">${ic('back', 16)}Back</button>` : '<span></span>'}
      <button class="btn btn-primary" data-act="${last ? 'wcreate' : 'wnext'}">${last ? 'Create tournament' : 'Continue'}${last ? ic('check', 16, 2.6) : ''}</button>
    </div></div>`;
}

/* ---------- tournament shell ---------- */
function pageTournament(id, tab) {
  const t = T(id);
  if (!t) return `<div class="page"><div class="empty-big">${ic('info', 44, 1.4)}<h2 class="num">Tournament not found</h2><p>It may have been deleted.</p><a href="#/tournaments" class="btn btn-primary">Back to tournaments</a></div></div>`;
  const pr = progress(t);
  const tabs = [['overview', 'Overview', 'home'], ['teams', t.type === 'singles' ? 'Players' : 'Teams', 'users'], ['matches', 'Matches', 'list'], ['scoreboard', 'Scoreboard', 'chart'], ['bracket', 'Bracket', 'bracket']];
  let body;
  if (tab === 'teams') body = tabTeams(t);
  else if (tab === 'matches') body = tabMatches(t);
  else if (tab === 'scoreboard') body = tabScoreboard(t);
  else if (tab === 'bracket') body = tabBracket(t);
  else { tab = 'overview'; body = tabOverview(t); }
  return `<div class="page"><a href="#/tournaments" class="back">${ic('back', 16)}All tournaments</a>
    <header class="phead"><div style="min-width:0"><div class="eyebrow">${typeLabel(t)} · ${t.groups} group${t.groups > 1 ? 's' : ''}${t.venue ? ' · ' + esc(t.venue) : ''}</div><h1 class="num">${esc(t.name)}</h1></div>
    <div class="pacts">${pr.live ? '<span class="badge live"><i class="dot"></i>Live</span>' : ''}${stageBadge(t)}<button class="btn btn-ghost btn-sm" data-act="share" data-t="${t.id}">${ic('share', 15)}Share</button></div></header>
    <nav class="tabs" aria-label="Tournament sections">${tabs.map(([k, l, i]) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/t/${t.id}/${k}">${ic(i, 16)}${l}</a>`).join('')}</nav>
    ${body}</div>`;
}

/* ---------- overview ---------- */
function tabOverview(t) {
  const pr = progress(t);
  const e = computeElo(t);
  const ms = allMatches(t);
  const live = ms.filter(m => m.status === 'live');
  const next = ms.filter(m => m.status === 'scheduled' && m.a && m.b).sort((a, b) => (a.round - b.round)).slice(0, 4);
  const champ = t.stage === 'done' ? koResolve(t).find(m => m.final)?.win : null;
  const top = t.teams.map(tm => ({ tm, elo: e.teamNow(tm), d: e.teamNow(tm) - e.teamStart(tm) })).sort((a, b) => b.elo - a.elo).slice(0, 5);
  const pct = pr.total ? Math.round(pr.done / pr.total * 100) : 0;
  let cta = '';
  if (t.stage === 'setup') cta = `<div class="card" style="border-color:rgba(195,245,60,.3);background:linear-gradient(135deg,rgba(195,245,60,.08),transparent)"><div class="row between wrap" style="gap:16px"><div><h3 class="num" style="font-size:18px">${t.teams.length ? 'Next: draw groups & start' : `Add your ${unitLabel(t)}`}</h3><div class="muted" style="margin-top:4px">${t.teams.length} ${unitLabel(t)} added so far.</div></div><a href="#/t/${t.id}/teams" class="btn btn-primary">${ic('users', 16)}Open ${t.type === 'singles' ? 'players' : 'teams'}</a></div></div>`;
  else if (t.stage === 'group' && groupsDone(t)) cta = `<div class="card" style="border-color:rgba(195,245,60,.3);background:linear-gradient(135deg,rgba(195,245,60,.08),transparent)"><div class="row between wrap" style="gap:16px"><div><h3 class="num" style="font-size:18px">Group stage complete</h3><div class="muted" style="margin-top:4px">Time to set up the knockout bracket.</div></div><a href="#/t/${t.id}/bracket" class="btn btn-primary">${ic('bracket', 16)}Go to bracket</a></div></div>`;
  else if (champ) cta = `<div class="champ"><div class="tr">${ic('trophy', 28)}</div><div class="eyebrow" style="margin:0">Champion</div><div class="who num">${esc(tname(teamOf(t, champ)))}</div><div class="muted">${esc(t.name)}</div></div>`;
  return `<div class="stack" style="gap:20px">${cta}
    <div class="grid g4">
      <div class="card stat"><div class="lbl"><span>${unitLabel(t)}</span></div><div class="val num">${t.teams.length}</div></div>
      <div class="card stat"><div class="lbl"><span>Matches played</span></div><div class="val num">${pr.done}<span class="dim" style="font-size:16px"> / ${pr.total}</span></div></div>
      <div class="card stat"><div class="lbl"><span>Progress</span></div><div class="val num">${pct}%</div><div class="progress" style="margin:12px 0 0"><div class="bar"><i style="width:${pct}%"></i></div></div></div>
      <div class="card stat"><div class="lbl"><span>Live now</span></div><div class="val num">${pr.live}</div></div>
    </div>
    <div class="split">
      <div class="stack" style="gap:20px">
        ${live.length ? `<section><div class="sec-head"><h2 class="sec num">Live now</h2></div><div class="mgrid">${live.map(m => matchCard(t, m, e)).join('')}</div></section>` : ''}
        <section><div class="sec-head"><h2 class="sec num">${next.length ? 'Up next' : 'Fixtures'}</h2><a href="#/t/${t.id}/matches" class="link">All matches</a></div>
          ${next.length ? `<div class="mgrid">${next.map(m => matchCard(t, m, e)).join('')}</div>` : `<div class="empty"><b>${t.stage === 'setup' ? 'Fixtures not generated yet' : 'Nothing scheduled'}</b>${t.stage === 'setup' ? 'Add entries, draw the groups, then start the group stage.' : 'All current matches have been played.'}</div>`}
        </section>
      </div>
      <div class="stack">
        <section class="card"><div class="sec-head" style="margin-bottom:14px"><h2 class="sec num" style="font-size:16px">Top ELO</h2><span class="dim" style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">This event</span></div>
          ${top.length ? `<div class="lb">${top.map((r, i) => `<div class="lb-row ${i === 0 ? 'top' : ''}"><span class="rk num">${i + 1}</span>${teamAv(r.tm)}<span class="nm">${esc(tname(r.tm))}</span><span class="elo num">${Math.round(r.elo)}</span></div>`).join('')}</div>` : '<div class="empty">Nobody yet</div>'}</section>
        <section class="card"><h2 class="sec num" style="font-size:16px;margin-bottom:14px">Format</h2><dl class="kv">
          <dt>Event</dt><dd>${typeLabel(t)}</dd><dt>Groups</dt><dd>${t.groups}</dd><dt>Matches / ${t.type === 'singles' ? 'player' : 'team'}</dt><dd>${t.matchesPerTeam}</dd>
          <dt>Group matches</dt><dd>Best of ${t.bestOf}, to ${t.points}</dd><dt>Knockout</dt><dd>${KO_TEXT[t.knockout][0]}</dd><dt>KO matches</dt><dd>Best of ${t.koBestOf}${t.thirdPlace ? ' + bronze' : ''}</dd>
          ${t.startDate ? `<dt>Dates</dt><dd>${fmtRange(t.startDate, t.endDate)}</dd>` : ''}</dl></section>
        ${!canEdit() ? '' : `<section class="card danger-zone"><h2 class="sec num" style="font-size:16px;margin-bottom:14px">Manage</h2><div class="stack" style="gap:10px">
          <button class="btn btn-ghost" data-act="edit-t" data-t="${t.id}">${ic('edit', 16)}Edit details</button>
          ${t.stage !== 'setup' ? `<button class="btn btn-ghost" data-act="reset-fx" data-t="${t.id}">${ic('reset', 16)}Reset fixtures &amp; scores</button>` : ''}
          <button class="btn btn-danger" data-act="del-t" data-t="${t.id}">${ic('trash', 16)}Delete tournament</button></div></section>`}
      </div>
    </div></div>`;
}

/* ---------- teams tab ---------- */
function teamRow(t, tm, e, locked) {
  const seed = [...t.teams].sort((a, b) => e.teamStart(b) - e.teamStart(a)).findIndex(x => x.id === tm.id) + 1;
  return `<div class="trow" ${locked ? '' : 'draggable="true"'} data-team="${tm.id}">
    ${teamAv(tm)}<div class="nm">${esc(tname(tm))}<small>${tmembers(tm) ? esc(tmembers(tm)) + ' · ' : ''}#${seed} seed · ${Math.round(e.teamNow(tm))} ELO</small></div>
    ${locked ? '' : `<select data-chg="move" data-team="${tm.id}" aria-label="Move to group"><option value="">No group</option>${Array.from({ length: t.groups }, (_, g) => `<option value="${g}" ${tm.group === g ? 'selected' : ''}>Group ${GL(g)}</option>`).join('')}</select>
    <button class="iconbtn" data-act="edit-team" data-t="${t.id}" data-team="${tm.id}" aria-label="Edit">${ic('edit', 16)}</button>
    <button class="iconbtn del" data-act="del-team" data-t="${t.id}" data-team="${tm.id}" aria-label="Remove">${ic('trash', 16)}</button>`}
  </div>`;
}
function startChecks(t) {
  const un = t.teams.filter(x => x.group == null).length;
  const sizes = Array.from({ length: t.groups }, (_, g) => t.teams.filter(x => x.group === g).length);
  const small = sizes.filter(n => n < 2).length;
  const checks = [
    [t.teams.length >= 2 * t.groups, `At least ${2 * t.groups} ${unitLabel(t)} (2 per group) — you have ${t.teams.length}`],
    [t.teams.length > 0 && un === 0, un ? `${un} ${unitLabel(t)} still not in a group` : 'Everyone is in a group'],
    [t.teams.length > 0 && small === 0, small ? `${small} group${small > 1 ? 's have' : ' has'} fewer than 2 ${unitLabel(t)}` : 'Every group has 2+ entries'],
  ];
  const plan = sizes.map(n => planGroup(n, t.matchesPerTeam));
  const total = plan.reduce((s, p) => s + p.edges.length, 0);
  const reduced = plan.some((p, i) => sizes[i] >= 2 && (p.M < t.matchesPerTeam || p.short));
  return { ok: checks.every(c => c[0]), checks, total, reduced };
}
function tabTeams(t) {
  const ro = !canEdit();
  const locked = t.stage !== 'setup' || ro;
  const e = computeElo(t);
  const un = t.teams.filter(x => x.group == null);
  const sc = startChecks(t);
  const word = t.type === 'singles' ? 'player' : 'team';
  const tools = locked ? '' : `<div class="row wrap mb24" style="gap:10px">
      <button class="btn btn-primary" data-act="add-team" data-t="${t.id}">${ic('plus', 16, 2.4)}Add ${word}</button>
      <button class="btn btn-ghost" data-act="bulk" data-t="${t.id}">${ic('list', 16)}Bulk add</button>
      <button class="btn btn-ghost" data-act="draw" data-mode="seeded" data-t="${t.id}" ${t.teams.length < 2 ? 'disabled' : ''}>${ic('chart', 16)}Seeded draw</button>
      <button class="btn btn-ghost" data-act="draw" data-mode="random" data-t="${t.id}" ${t.teams.length < 2 ? 'disabled' : ''}>${ic('shuffle', 16)}Random draw</button>
      ${t.teams.some(x => x.group != null) ? `<button class="btn btn-ghost" data-act="draw" data-mode="clear" data-t="${t.id}">${ic('x', 16)}Clear groups</button>` : ''}</div>`;
  const groups = Array.from({ length: t.groups }, (_, g) => {
    const ms = t.teams.filter(x => x.group === g);
    return `<div class="card dropzone" data-drop="${g}"><div class="gh"><h3 class="num">Group ${GL(g)}</h3><span class="ct">${ms.length} ${ms.length === 1 ? word : word + 's'}</span></div>
      ${ms.length ? [...ms].sort((a, b) => e.teamNow(b) - e.teamNow(a)).map(tm => teamRow(t, tm, e, locked)).join('') : `<div class="empty"><b>Empty</b>${locked ? '' : 'Drag here or use the group menu'}</div>`}</div>`;
  }).join('');
  return `${t.stage !== 'setup' && !ro ? `<div class="note" style="margin:0 0 20px">${ic('info', 16)}<span>The draw is locked while the tournament is running. To change it, use “Reset fixtures &amp; scores” on the Overview tab.</span></div>` : ''}
    ${tools}
    ${t.teams.length === 0 ? `<div class="empty-big">${ic('users', 48, 1.4)}<h2 class="num">No ${word}s yet</h2><p>${ro ? 'The organizer hasn’t added anyone yet.' : (t.type === 'singles' ? 'Add each player' : 'Add each pair') + ' one by one, or paste a whole list at once.'}</p><div class="row wrap" style="justify-content:center;gap:12px"><button class="btn btn-primary" data-act="add-team" data-t="${t.id}">${ic('plus', 16, 2.4)}Add ${word}</button><button class="btn btn-ghost" data-act="bulk" data-t="${t.id}">${ic('list', 16)}Bulk add</button></div></div>` : `
    <div class="teams-layout">
      <div class="card dropzone" data-drop="none"><div class="gh"><h3 class="num">Unassigned</h3><span class="ct">${un.length}</span></div>
        ${un.length ? [...un].sort((a, b) => e.teamNow(b) - e.teamNow(a)).map(tm => teamRow(t, tm, e, locked)).join('') : `<div class="empty"><b>All placed</b>Everyone has a group.</div>`}</div>
      <div class="gcards">${groups}</div></div>
    ${locked ? '' : `<div class="card mb24" style="margin-top:24px;max-width:640px"><h3 class="num" style="font-size:18px">Ready to start?</h3>
      <div class="checklist">${sc.checks.map(([ok, txt]) => `<div class="${ok ? 'ok' : 'no'}">${ic(ok ? 'check' : 'info', 16, 2.4)}${txt}</div>`).join('')}</div>
      ${sc.ok ? `<div class="muted" style="font-size:13px;margin-bottom:16px">This will create <b style="color:var(--text)">${sc.total}</b> group matches.${sc.reduced ? ' Where a group is too small, or the numbers can’t pair up evenly (e.g. 7 teams × 3 matches), one entry in that group plays one match fewer.' : ''}</div>` : ''}
      <button class="btn btn-primary" data-act="start" data-t="${t.id}" ${sc.ok ? '' : 'disabled'}>${ic('play', 15)}Generate fixtures &amp; start</button></div>`}`}`;
}

/* ---------- matches ---------- */
function matchTag(t, m) {
  if (m.stage === 'ko') {
    const R = m.R || Math.log2(t.ko.size);
    return m.third ? 'Bronze match' : matchLabel(m.round, R, m.idx, 2 ** (R - m.round));
  }
  return `Group ${GL(m.group)} · Round ${m.round}`;
}
function matchCard(t, m, e) {
  const A = teamOf(t, m.a), B = teamOf(t, m.b);
  const ready = A && B;
  const s = gstats(m);
  const done = m.status === 'done', live = m.status === 'live';
  const rowT = (tm, side) => {
    const cls = done ? (s.winner === side ? 'w' : 'l') : '';
    const gw = side === 'a' ? s.wa : s.wb;
    const pts = (m.games || []).map(g => g[side === 'a' ? 0 : 1]);
    return `<div class="mt ${cls}">${teamAv(tm)}<span class="nm">${esc(!tm && m.ph ? m.ph[side] : tname(tm))}</span><span class="gs">${pts.map(p => `<span class="gp num">${p}</span>`).join('')}${(done || live) ? `<span class="big num">${gw}</span>` : ''}</span></div>`;
  };
  const d = e?.deltas[m.id];
  return `<button class="match ${live ? 'live' : ''} ${ready ? '' : 'tbd'}" ${m.preview ? 'disabled style="cursor:default"' : ''} data-act="score" data-t="${t.id}" data-m="${m.id}" data-s="${m.stage}">
    <div class="mh"><span>${matchTag(t, m)}${m.court ? ' · Court ' + esc(m.court) : ''}</span>${live ? '<span class="badge live" style="padding:3px 9px"><i class="dot"></i>Live</span>' : done ? `<span style="color:var(--lime-d)">Final</span>` : '<span>Upcoming</span>'}</div>
    ${rowT(A, 'a')}${rowT(B, 'b')}
    <div class="mfoot"><span>${done ? (d ? `ELO ${sgn(d.a)} / ${sgn(d.b)}` : 'Completed') : ready ? (!canEdit() ? (live ? 'In progress' : 'Not started') : live ? 'Tap to update score' : 'Tap to enter score') : 'Awaiting teams'}</span><span>${done && m.doneAt ? fmtTime(m.doneAt) : ''}</span></div>
  </button>`;
}
function tabMatches(t) {
  if (!t.matches.length) return `<div class="empty-big">${ic('list', 48, 1.4)}<h2 class="num">No fixtures yet</h2><p>Fixtures are generated when you start the group stage.</p><a class="btn btn-primary" href="#/t/${t.id}/teams">Go to ${t.type === 'singles' ? 'players' : 'teams'}</a></div>`;
  const e = computeElo(t);
  const f = UI.mFilter[t.id] ?? 'all', st = UI.mStatus[t.id] ?? 'all';
  const ko = !t.ko || !groupsDone(t) ? koPreview(t) : koVisible(koResolve(t));
  let list = f === 'ko' ? ko : f === 'all' ? [...t.matches, ...ko] : t.matches.filter(m => m.group === +f);
  if (st !== 'all') list = list.filter(m => (st === 'upcoming' ? m.status === 'scheduled' : st === 'live' ? m.status === 'live' : m.status === 'done'));
  list = list.filter(m => m.status !== 'bye');
  const groupsOf = new Map();
  list.forEach(m => {
    const k = m.stage === 'ko' ? `ko-${m.third ? 99 : m.round}` : `g-${m.round}`;
    const lbl = m.stage === 'ko' ? (m.third ? 'Bronze match' : roundName(m.round, m.R || Math.log2(t.ko.size))) : `Group round ${m.round}`;
    if (!groupsOf.has(k)) groupsOf.set(k, { lbl, ms: [], o: m.stage === 'ko' ? 1000 + (m.third ? 99 : m.round) : m.round });
    groupsOf.get(k).ms.push(m);
  });
  const chip = (k, l, cur, act) => `<button class="chip ${String(cur) === String(k) ? 'on' : ''}" data-act="${act}" data-t="${t.id}" data-v="${k}">${l}</button>`;
  return `<div class="stack" style="gap:14px;margin-bottom:22px">
    <div class="chips">${chip('all', 'All', f, 'mfilter')}${Array.from({ length: t.groups }, (_, g) => chip(g, 'Group ' + GL(g), f, 'mfilter')).join('')}${ko.length ? chip('ko', 'Knockout', f, 'mfilter') : ''}</div>
    <div class="chips">${[['all', 'Any status'], ['live', 'Live'], ['upcoming', 'Upcoming'], ['done', 'Completed']].map(([k, l]) => chip(k, l, st, 'mstatus')).join('')}</div></div>
    ${[...groupsOf.values()].sort((a, b) => a.o - b.o).map(g => `<div class="rhead">${g.lbl}</div><div class="mgrid">${g.ms.map(m => matchCard(t, m, e)).join('')}</div>`).join('') || '<div class="empty"><b>No matches here</b>Try a different filter.</div>'}`;
}

/* ---------- scoreboard ---------- */
function tabScoreboard(t) {
  if (!t.matches.length) return `<div class="empty-big">${ic('chart', 48, 1.4)}<h2 class="num">Scoreboard is waiting</h2><p>Once the group stage starts, standings, game differences and live ELO show up here.</p><a class="btn btn-primary" href="#/t/${t.id}/teams">Go to ${t.type === 'singles' ? 'players' : 'teams'}</a></div>`;
  const e = computeElo(t);
  const groupBlock = g => {
  const rows = standings(t, g, e);
  const nq = rows.some(r => r.p > 0) ? qualPerGroup(t) : 0; // no highlight until a result exists
  const gm = t.matches.filter(m => m.group === g);
  const recent = gm.filter(m => m.status === 'done').sort((a, b) => b.seq - a.seq).slice(0, 5);
  const live = gm.filter(m => m.status === 'live');
  const done = gm.filter(m => m.status === 'done').length;
  const row = r => `<div class="sb-row ${r.rank <= nq ? 'q' : ''}">
    <span class="rank num">${r.rank}</span>
    <div class="tm">${teamAv(r.team)}<div class="nm"><span class="t">${esc(tname(r.team))}</span>${r.rank <= nq ? `<span class="tag">${groupsDone(t) ? 'Qualifies' : 'In qualifying spot'}</span>` : ''}<span class="subm">W${r.w} L${r.l} · ${r.gw}–${r.gl}</span></div></div>
    <span class="c num hm">${r.p}</span><span class="c num hm">${r.w}</span><span class="c num hm">${r.l}</span>
    <span class="c num hm">${r.gw}–${r.gl}</span>
    <span class="c num" style="font-weight:800">${Math.round(r.elo)}</span>
    <span class="c num ${r.d >= 0 ? 'up' : 'dn'}">${r.p ? sgn(r.d) : '–'}</span>
    <span class="form hm">${r.form.slice(-5).map(x => `<i class="${x}">${x}</i>`).join('') || '<span class="dim">–</span>'}</span></div>`;
  const rec = m => { const s = gstats(m); const wi = s.winner === 'a' ? m.a : m.b, lo = wi === m.a ? m.b : m.a;
    return `<div class="it"><div><b>${esc(tname(teamOf(t, wi)))}</b> <span class="muted">def.</span> ${esc(tname(teamOf(t, lo)))}<div class="sc num">${m.games.map(x => x[0] > x[1] ? x[0] + '–' + x[1] : x[1] + '–' + x[0]).join(', ')}</div></div><time>${fmtTime(m.doneAt)}</time></div>`; };
  return `<section style="margin-bottom:36px"><h2 class="sec num" style="margin-bottom:14px">Group ${GL(g)}</h2>
  <div class="split"><div>
    <div class="card sb"><div class="sb-row h"><span>#</span><span>${t.type === 'singles' ? 'Player' : 'Team'}</span><span class="c hm">P</span><span class="c hm">W</span><span class="c hm">L</span><span class="c hm">Games</span><span class="c">ELO</span><span class="c">Δ</span><span class="c hm">Form</span></div>
    ${rows.map(row).join('') || '<div class="empty" style="margin:16px">No entries in this group</div>'}</div>
    <div class="legend">${nq ? `<span><i></i>Qualifying position${nq > 1 ? 's' : ''}</span>` : ''}<span>Ranked by wins → ELO → point difference</span><span>${done}/${gm.length} matches played</span></div>
  </div>
  <div class="stack">
    ${live.length ? `<section class="card"><div class="sec-head" style="margin-bottom:14px"><h2 class="sec num" style="font-size:16px">Live now</h2><span class="badge live"><i class="dot"></i>Live</span></div><div class="stack" style="gap:10px">${live.map(m => matchCard(t, m, e)).join('')}</div></section>` : ''}
    <section class="card"><h2 class="sec num" style="font-size:16px;margin-bottom:14px">Recent results</h2><div class="result-list">${recent.map(rec).join('') || '<div class="empty"><b>No results yet</b>Scores appear here as matches finish.</div>'}</div></section>
  </div></div></section>`;
  };
  return Array.from({ length: t.groups }, (_, g) => groupBlock(g)).join('') +
    (t.stage === 'group' ? `<div class="row"><a class="btn ${groupsDone(t) ? 'btn-primary' : 'btn-ghost'}" href="#/t/${t.id}/bracket">${ic('bracket', 16)}${groupsDone(t) ? 'Set up knockout bracket' : 'Knockout bracket'}</a></div>` : '');
}

/* ---------- bracket ---------- */
function bmTeam(t, id, side, m, bm) {
  const tm = teamOf(t, id);
  const inf = id && t.ko.info[id];
  const s = gstats(m);
  const generic = tm && inf && m.round === 1 && !groupsDone(t);
  if (generic) return `<div class="bt tbd"><span class="av tbd">?</span><div class="nm"><span>${ordinal(inf.rank)} team of Group ${GL(inf.g)}</span></div></div>`;
  const isW = m.status === 'done' && s.winner === side;
  const isL = m.status === 'done' && s.winner && s.winner !== side;
  const gw = side === 'a' ? s.wa : s.wb;
  return `<div class="bt ${isW ? 'w' : isL ? 'l' : ''} ${tm ? '' : 'tbd'}">${tm ? teamAv(tm) : '<span class="av tbd">?</span>'}
    <div class="nm"><span>${tm ? esc(tname(tm)) : (m.round === 1 ? 'Bye' : 'To be decided')}</span>${tm && inf && m.round === 1 ? `<small>Group ${GL(inf.g)} · ${inf.rank === 1 ? '1st' : inf.rank === 2 ? '2nd' : inf.rank + 'th'}${inf.seed ? ' · Seed ' + inf.seed : ''}</small>` : ''}</div>
    ${(m.status === 'done' || m.status === 'live') ? `<span class="sc num">${gw}</span>` : ''}</div>`;
}
function bmCard(t, m, label) {
  const ready = m.a && m.b && !m.bye;
  const tag = m.bye ? 'span' : 'button';
  return `<${tag} class="bm ${m.status === 'live' ? 'live' : ''}" ${tag === 'button' && ready ? `data-act="score" data-t="${t.id}" data-m="${m.id}" data-s="ko"` : tag === 'button' ? 'disabled style="cursor:default"' : ''}>
    <div class="bh"><span>${label}</span><span>${m.status === 'live' ? 'Live' : m.court ? 'Court ' + esc(m.court) : m.status === 'done' ? 'Final score' : m.bye ? 'Bye' : ''}</span></div>
    ${bmTeam(t, m.a, 'a', m)}${bmTeam(t, m.b, 'b', m)}</${tag}>`;
}
function tabBracket(t) {
  if (t.stage === 'setup') return `<div class="empty-big">${ic('bracket', 48, 1.4)}<h2 class="num">Bracket comes later</h2><p>The knockout bracket is built once the group stage is underway. Format: <b>${KO_TEXT[t.knockout][0]}</b>.</p><a class="btn btn-primary" href="#/t/${t.id}/teams">Go to ${t.type === 'singles' ? 'players' : 'teams'}</a></div>`;
  const q = qualifiers(t);
  if (!t.ko) {
    const done = groupsDone(t);
    const pr = progress(t);
    return `<div class="card" style="max-width:760px"><div class="eyebrow">${KO_TEXT[t.knockout][0]}</div><h2 class="num" style="font-size:24px;margin-bottom:6px">${done ? 'Groups complete — build the bracket' : 'Projected qualifiers'}</h2>
      <p class="muted" style="margin-bottom:18px">${done ? 'Seeds are taken from the final group standings.' : `${pr.gtotal - pr.gdone} group match${pr.gtotal - pr.gdone === 1 ? '' : 'es'} still to play. This is how it looks right now.`}</p>
      ${!done ? `<div class="lb" style="margin-bottom:18px">${genericQualifiers(t).map((s, i) => `<div class="lb-row"><span class="rk num">${i + 1}</span><span class="av tbd">?</span><span class="nm">${s}</span><span class="dim" style="font-size:12px;font-weight:700">Awaiting results</span></div>`).join('')}</div>`
      : q.list.length ? `<div class="lb" style="margin-bottom:18px">${q.list.map((id, i) => { const tm = teamOf(t, id), inf = q.info[id]; return `<div class="lb-row"><span class="rk num">${i + 1}</span>${teamAv(tm)}<span class="nm">${esc(tname(tm))}</span><span class="dim" style="font-size:12px;font-weight:700">Grp ${GL(inf.g)} · ${inf.rank === 1 ? '1st' : '2nd'}</span></div>`; }).join('')}</div>` : ''}
      ${q.list.length < 2 ? `<div class="note warn">${ic('info', 16)}<span>At least 2 qualifiers are needed. ${t.knockout === 'top1' ? 'With “group winners only” you need 2 or more groups.' : ''}</span></div>` : ''}
      <button class="btn ${done ? 'btn-primary' : 'btn-ghost'}" data-act="gen-ko" data-t="${t.id}" ${q.list.length < 2 ? 'disabled' : ''}>${ic('bracket', 16)}${done ? 'Generate bracket' : 'Generate anyway'}</button></div>`;
  }
  const R = Math.log2(t.ko.size);
  const ms = koResolve(t);
  const cols = [];
  for (let r = 1; r <= R; r++) {
    const cm = ms.filter(m => m.round === r && !m.third);
    const cards = cm.map(m => `<div class="mw">${bmCard(t, m, matchLabel(r, R, m.idx, cm.length))}</div>`);
    let inner;
    if (r < R) { inner = ''; for (let i = 0; i < cards.length; i += 2) inner += `<div class="pair">${cards[i]}${cards[i + 1] || ''}</div>`; }
    else inner = cards.join('');
    cols.push(`<div class="bcol ${r > 1 ? 'has-prev' : ''}" style="--n:${t.ko.size / 2 ** r}"><h4>${roundName(r, R)}</h4><div class="body">${inner}</div></div>`);
  }
  const fin = ms.find(m => m.final);
  const champ = fin?.win ? teamOf(t, fin.win) : null;
  const tp = ms.find(m => m.third);
  cols.push(`<div class="bcol has-prev" style="--n:1"><h4>Champion</h4><div class="body"><div class="mw"><div class="champ ${champ ? '' : 'empty-c'}"><div class="tr">${ic('trophy', 26)}</div>${champ ? `<div class="eyebrow" style="margin:0">Champions</div><div class="who num">${esc(tname(champ))}</div><div class="row" style="justify-content:center">${teamAv(champ, 'lime')}</div>` : '<div class="muted" style="font-weight:700">To be decided</div>'}</div></div></div></div>`);
  const cur = q.list.join(), old = t.ko.qual.join();
  const stale = cur !== old;
  return `${stale ? `<div class="note warn" style="margin:0 0 20px">${ic('info', 16)}<span>The group standings have changed since this bracket was seeded. <button class="link" data-act="gen-ko" data-t="${t.id}" data-re="1" style="text-decoration:underline">Re-seed bracket</button> (clears knockout scores).</span></div>` : ''}
    <div class="row between wrap mb24" style="gap:12px"><div><div class="eyebrow" style="margin-bottom:4px">${KO_TEXT[t.knockout][0]}</div><div class="muted" style="font-size:13px">Best of ${t.koBestOf} · tap a match to enter or edit its score</div></div>
      <button class="btn btn-ghost btn-sm" data-act="gen-ko" data-t="${t.id}" data-re="1">${ic('reset', 14)}Re-seed</button></div>
    <div class="bracket">${cols.join('')}</div>
    ${tp ? `<div class="rhead" style="margin-top:8px">Bronze match</div><div style="max-width:340px">${bmCard(t, tp, 'Third place')}</div>` : ''}`;
}

/* ---------- ranking & settings ---------- */
function pageRanking() {
  const q = UI.rankQ.trim().toLowerCase();
  const all = globalPlayers();
  const list = all.map((p, i) => ({ ...p, pos: i + 1 })).filter(p => !q || p.name.toLowerCase().includes(q));
  return `<div class="page">${head('All events', 'Player ranking')}
    <div class="search mb24">${ic('search', 17)}<input class="input" data-in="rankq" placeholder="Search players…" value="${esc(UI.rankQ)}" aria-label="Search players"></div>
    ${all.length ? `<div class="card sb"><div class="rank-row h"><span>#</span><span>Player</span><span class="c hm">Played</span><span class="c hm">W–L</span><span class="c hm">Win %</span><span class="c">ELO</span></div>
      ${list.map(p => `<div class="rank-row ${p.pos <= 3 ? 'top3' : ''}"><span class="rank num" style="font-weight:800;color:${p.pos <= 3 ? 'var(--lime)' : 'var(--muted)'}">${p.pos}</span><div class="row" style="min-width:0;gap:12px">${avatar(p.name, p.pos === 1 ? 'lime' : '')}<div style="min-width:0"><div style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div><div class="fine" style="font-size:11.5px">${p.ev} event${p.ev > 1 ? 's' : ''} · ${p.w + p.l ? `${p.w}W ${p.l}L` : 'unrated'}</div></div></div>
      <span class="c num hm">${p.w + p.l}</span><span class="c num hm">${p.w}–${p.l}</span><span class="c num hm">${p.w + p.l ? Math.round(p.w / (p.w + p.l) * 100) + '%' : '–'}</span><span class="c num" style="font-weight:800;color:${p.pos === 1 ? 'var(--lime)' : 'var(--text)'}">${Math.round(p.elo)}</span></div>`).join('') || '<div class="empty" style="margin:16px"><b>No matches</b>No player matches that search.</div>'}</div>
      <div class="legend"><span>Everyone starts at ${BASE_ELO}. K-factor ${K_FACTOR}. In doubles each team is rated by the average of its two players.</span></div>`
      : `<div class="empty-big">${ic('chart', 48, 1.4)}<h2 class="num">No players yet</h2><p>Add teams to a tournament and the ranking will build itself.</p><a href="#/new" class="btn btn-primary">New tournament</a></div>`}</div>`;
}
function pageSettings() {
  const account = ME ? `<section class="card"><div class="row" style="gap:14px;margin-bottom:16px">${userAv(ME)}<div style="min-width:0"><div style="font-weight:700;overflow:hidden;text-overflow:ellipsis">${esc(ME.name || ME.email)}</div><div class="muted" style="font-size:13px;overflow:hidden;text-overflow:ellipsis">${esc(ME.email)}</div></div><span class="badge ${ME.role === 'pending' ? 'orange' : ME.role === 'blocked' ? '' : 'lime'}" style="margin-left:auto">${ROLE_LABEL[ME.role]}</span></div>
      <p class="muted" style="margin-bottom:16px">${ME.role === 'admin' ? 'You can create tournaments, enter scores, approve people and manage data.' : ME.role === 'editor' ? 'You can create tournaments and enter scores.' : 'You can watch everything live. An admin must approve you before you can edit.'}</p>
      <div class="row wrap" style="gap:10px">${isAdmin() ? `<a href="#/admin" class="btn btn-primary">${ic('shield', 16)}Manage users</a>` : ''}<button class="btn btn-ghost" data-act="logout">Sign out</button></div></section>`
    : `<section class="card"><h2 class="sec num" style="font-size:16px;margin-bottom:6px">You're viewing as a guest</h2><p class="muted" style="margin-bottom:16px">Guests can follow every tournament live. Sign in with Google to create tournaments and enter scores.</p><a href="#/login" class="btn btn-primary">Sign in</a></section>`;
  const data = isAdmin() ? `
      <section class="card"><h2 class="sec num" style="font-size:16px;margin-bottom:6px">Backup &amp; restore</h2><p class="muted" style="margin-bottom:16px">Download every tournament as a JSON file, or restore from one. Restoring replaces all current tournaments.</p>
        <div class="row wrap" style="gap:10px"><button class="btn btn-ghost" data-act="export">${ic('download', 16)}Export backup</button>
        <label class="btn btn-ghost" style="cursor:pointer">${ic('upload', 16)}Import backup<input type="file" accept="application/json,.json" data-in="import" hidden></label></div></section>
      <section class="card"><h2 class="sec num" style="font-size:16px;margin-bottom:6px">Demo data</h2><p class="muted" style="margin-bottom:16px">Adds a doubles event mid-way through its group stage and a singles event in setup, so you can explore every screen.</p>
        <button class="btn btn-ghost" data-act="demo">${ic('play', 15)}Load demo tournaments</button></section>
      <section class="card danger-zone"><h2 class="sec num" style="font-size:16px;margin-bottom:6px">Danger zone</h2><p class="muted" style="margin-bottom:16px">Permanently delete every tournament and rating on the server. User accounts are kept.</p>
        <button class="btn btn-danger" data-act="wipe">${ic('trash', 16)}Delete all tournaments</button></section>` : '';
  return `<div class="page" style="max-width:760px">${head('Preferences', ME ? 'Account' : 'Sign in')}
    <div class="stack" style="gap:18px">${account}${data}
      <section class="card"><h2 class="sec num" style="font-size:16px;margin-bottom:10px">How rankings work</h2>
        <p class="muted">Every recorded match updates ELO. Expected score = 1 / (1 + 10<sup>(opponent − you)/400</sup>) and ratings move by ${K_FACTOR} × (result − expected). Doubles teams use the average rating of both players, and both players gain or lose the same amount. Editing a result replays the whole tournament so ratings are always consistent.</p></section>
    </div></div>`;
}

/* ============================================================
   Modals, toast, confirm
   ============================================================ */
let lastFocus = null, confirmCb = null;
function openModal(html, wide = false) {
  lastFocus = document.activeElement;
  $('#modal-root').innerHTML = `<div class="backdrop" data-act="backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const f = $('#modal-root input:not([type=hidden]),#modal-root textarea');
  if (f && !matchMedia('(max-width:900px)').matches) f.focus();
}
function closeModal() { $('#modal-root').innerHTML = ''; confirmCb = null; if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
function confirmBox(title, msg, okLabel, cb, danger = true) {
  confirmCb = cb;
  openModal(`<h3 class="num">${esc(title)}</h3><p class="sub" style="margin-bottom:22px">${msg}</p>
    <div class="mfoot2"><button class="btn btn-ghost" data-act="close">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="confirm-ok">${esc(okLabel)}</button></div>`);
  confirmCb = cb;
}
function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = ic(kind === 'err' ? 'info' : 'check', 16, 2.4) + `<span>${esc(msg)}</span>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- team form ---------- */
function teamForm(t, tm) {
  const single = t.type === 'singles';
  const n = single ? 1 : 2;
  const stub = tm && tm.name && tm.players.length === 1 && tm.players[0].name === tm.name;
  const pl = tm && !stub ? tm.players : [];
  const g = tm ? tm.group : null;
  const eloOf = i => (pl[i] ? Math.round(pl[i].elo) : stub && i === 0 ? Math.round(tm.players[0].elo) : '');
  const fld = i => '<div class="two" style="grid-template-columns:1fr 110px"><div class="field"><label for="tf-n' + i + '">' + (single ? 'Player name' : 'Player ' + (i + 1) + ' <span class="muted">(optional)</span>') + '</label><input id="tf-n' + i + '" class="input" name="n' + i + '" value="' + esc(pl[i]?.name || '') + '" placeholder="' + (i ? 'Partner name' : 'Full name') + '" maxlength="40" autocomplete="off"' + (single ? ' required' : '') + '></div>' +
    '<div class="field"><label for="tf-e' + i + '">ELO</label><input id="tf-e' + i + '" class="input" name="e' + i + '" inputmode="numeric" value="' + eloOf(i) + '" placeholder="auto"></div></div>';
  const teamName = single ? '' : '<div class="field"><label for="tf-tn">Team name <span class="muted">(optional)</span></label><input id="tf-tn" class="input" name="tn" value="' + esc(tm?.name || '') + '" placeholder="e.g. Smash Brothers" maxlength="40" autocomplete="off"></div>';
  return '<h3 class="num">' + (tm ? 'Edit' : 'Add') + ' ' + (single ? 'player' : 'team') + '</h3><p class="sub">' + (single ? '' : 'Enter a team name, one or both player names, or all three. ') + (tm ? 'Changing ELO here only changes the starting rating.' : 'Leave ELO blank to use the player’s existing rating, or ' + BASE_ELO + ' for new players.') + '</p>' +
    '<form data-form="team" data-t="' + t.id + '" data-team="' + (tm?.id || '') + '" novalidate>' + teamName +
    Array.from({ length: n }, (_, i) => fld(i)).join('') +
    '<div class="field"><label for="tf-g">Group</label><select id="tf-g" class="input" name="g"><option value="">Decide later</option>' + Array.from({ length: t.groups }, (_, i) => '<option value="' + i + '" ' + (g === i ? 'selected' : '') + '>Group ' + GL(i) + '</option>').join('') + '</select></div>' +
    '<div class="note bad" id="tf-err" style="display:none;margin:0 0 14px"></div>' +
    '<div class="mfoot2"><button type="button" class="btn btn-ghost" data-act="close">Cancel</button>' + (tm ? '' : '<button class="btn btn-ghost" type="submit" data-more="1">Save &amp; add another</button>') + '<button class="btn btn-primary" type="submit">' + (tm ? 'Save changes' : 'Add ' + (single ? 'player' : 'team')) + '</button></div></form>';
}
function handleTeamForm(form, more) {
  const t = T(form.dataset.t); if (!t) return;
  const single = t.type === 'singles';
  const n = single ? 1 : 2;
  const fd = new FormData(form);
  const err = $('#tf-err', form);
  const fail = msg => { err.textContent = msg; err.style.display = 'flex'; };
  const clean = v => String(v || '').trim().replace(/\s+/g, ' ');
  const eloOf = i => {
    const raw = clean(fd.get('e' + i));
    if (raw === '') return null;
    const v = parseInt(raw, 10);
    return Number.isFinite(v) && v >= 100 && v <= 4000 ? v : NaN;
  };
  const teamName = single ? '' : clean(fd.get('tn'));
  let players = [];
  for (let i = 0; i < n; i++) {
    const name = clean(fd.get('n' + i));
    const elo = eloOf(i);
    if (Number.isNaN(elo)) return fail('ELO must be a number between 100 and 4000.');
    if (name) players.push({ name, elo });
    else if (single) return fail('Please enter the player’s name.');
  }
  if (!players.length) {
    if (!teamName) return fail('Enter a team name or at least one player name.');
    const elo = eloOf(0);
    players = [{ name: teamName, elo: Number.isNaN(elo) ? null : elo }]; // team stands in as one rated entry
  }
  const lower = players.map(p => p.name.toLowerCase());
  if (new Set(lower).size !== lower.length) return fail('The two players need different names.');
  const editing = form.dataset.team;
  const names = [...lower, ...(teamName ? [teamName.toLowerCase()] : [])];
  const clash = t.teams.find(x => x.id !== editing && (x.players.some(p => names.includes(p.name.toLowerCase())) || (x.name && names.includes(x.name.toLowerCase()))));
  if (clash) {
    const hit = clash.players.find(p => names.includes(p.name.toLowerCase()))?.name || clash.name;
    return fail(hit + ' is already entered in this tournament.');
  }
  const gv = fd.get('g');
  const group = gv === '' ? null : +gv;
  const prev = editing ? teamOf(t, editing) : null;
  players.forEach((p, i) => { if (p.elo == null) p.elo = prev?.players[i]?.name === p.name ? prev.players[i].elo : lookupElo(p.name); });
  if (prev) { prev.players = players; prev.group = group; if (teamName) prev.name = teamName; else delete prev.name; }
  else t.teams.push({ id: uid(), players, group, ...(teamName ? { name: teamName } : {}) });
  const label = teamName || players.map(p => p.name).join(' & ');
  if (more && !prev) { commit(t, ['teams']); toast(label + ' added'); openModal(teamForm(t)); }
  else { closeModal(); commit(t, ['teams']); toast(prev ? 'Changes saved' : 'Added'); }
}

function bulkForm(t) {
  const s = t.type === 'singles';
  return `<h3 class="num">Bulk add ${s ? 'players' : 'teams'}</h3><p class="sub">One ${s ? 'player' : 'team'} per line.${s ? '' : ' Separate partners with “/” or “&”, or just write a team name. Use “Team name: Player 1 / Player 2” for both.'} Optionally add a starting ELO after a comma.</p>
    <form data-form="bulk" data-t="${t.id}"><div class="field"><textarea class="input" name="list" placeholder="${s ? 'Rohan Kadam, 1850\nAnanya Pillai\nVikram Shetty' : 'Rohan Kadam / Ananya Pillai, 1850\nSmash Brothers\nNet Ninjas: Karan Joshi / Divya Menon'}"></textarea></div>
    <div class="note bad" id="tf-err" style="display:none;margin:0 0 14px"></div>
    <div class="mfoot2"><button type="button" class="btn btn-ghost" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Add all</button></div></form>`;
}
function handleBulk(form) {
  const t = T(form.dataset.t); if (!t) return;
  const err = $('#tf-err', form);
  const lines = String(new FormData(form).get('list') || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) { err.textContent = 'Paste at least one line.'; err.style.display = 'flex'; return; }
  const used = new Set(t.teams.flatMap(x => [...x.players.map(p => p.name.toLowerCase()), ...(x.name ? [x.name.toLowerCase()] : [])]));
  const add = [], bad = [];
  lines.forEach((ln, i) => {
    let elo = null;
    const m = ln.match(/^(.*?)[,;\t]\s*(\d{3,4})\s*$/);
    if (m) { ln = m[1]; elo = +m[2]; }
    const single = t.type === 'singles';
    let teamName = '';
    const named = !single && ln.match(/^([^:\/&]+):\s*(.+)$/);
    if (named) { teamName = named[1].trim().replace(/\s+/g, ' '); ln = named[2]; }
    let names = ln.split(/\s*(?:\/|&|\band\b)\s*/i).map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean);
    if (!single && !teamName && names.length === 1 && !/\band\b|[\/&]/i.test(ln)) { teamName = names[0]; } // lone name = team name
    const low = names.map(x => x.toLowerCase());
    const keys = [...low, ...(teamName ? [teamName.toLowerCase()] : [])];
    if (!names.length || names.length > (single ? 1 : 2) || new Set(keys).size !== keys.length && !(teamName && names.length === 1 && names[0] === teamName) || keys.some(x => used.has(x))) { bad.push(`line ${i + 1}`); return; }
    keys.forEach(x => used.add(x));
    if (teamName && names.length === 1 && names[0] === teamName) { /* name-only team */ }
    add.push({ id: uid(), group: null, ...(teamName ? { name: teamName } : {}), players: names.map(name => ({ name, elo: elo ?? lookupElo(name) })) });
  });
  if (bad.length) { err.textContent = `Couldn't read ${bad.join(', ')} (wrong number of names or a duplicate). Nothing was added.`; err.style.display = 'flex'; return; }
  t.teams.push(...add);
  closeModal(); commit(t, ['teams']); toast(`${add.length} added`);
}

/* ---------- score modal ---------- */
function scoreModal(tid, mid, stage) {
  const t = T(tid); if (!t) return;
  const m = stage === 'ko' ? koResolve(t).find(x => x.id === mid) : t.matches.find(x => x.id === mid);
  if (!m) return;
  const A = teamOf(t, m.a), B = teamOf(t, m.b);
  if (!A || !B) return;
  const bo = stage === 'ko' ? t.koBestOf : t.bestOf;
  const g = m.games || [];
  const val = (i, s) => (g[i] ? g[i][s] : '');
  openModal(`<h3 class="num">${esc(matchTag(t, m))}</h3><p class="sub">First to ${Math.ceil(bo / 2)} game${bo > 1 ? 's' : ''} · games to ${t.points}, win by 2 (cap ${capFor(t.points)})</p>
    <form data-form="score" data-t="${t.id}" data-m="${m.id}" data-s="${stage}" data-bo="${bo}" novalidate>
      <div class="sc-teams"><span></span><div class="n">${esc(tname(A))}</div><div class="n">${esc(tname(B))}</div></div>
      ${Array.from({ length: bo }, (_, i) => `<div class="sc-game"><span>GAME ${i + 1}</span><input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="2" name="a${i}" value="${val(i, 0)}" aria-label="Game ${i + 1} ${esc(tname(A))}"><input class="input" inputmode="numeric" pattern="[0-9]*" maxlength="2" name="b${i}" value="${val(i, 1)}" aria-label="Game ${i + 1} ${esc(tname(B))}"></div>`).join('')}
      <div class="hint" id="sc-hint">Enter the score of each game played.</div>
      <div class="field"><label for="sc-court">Court <span class="dim" style="text-transform:none;letter-spacing:0">(optional)</span></label><input id="sc-court" class="input" name="court" value="${esc(m.court || '')}" placeholder="e.g. 3" maxlength="12"></div>
      <div class="mfoot2">
        ${m.status !== 'scheduled' ? `<button type="button" class="btn btn-danger" data-act="sc-clear" style="margin-right:auto">Clear</button>` : ''}
        ${m.status !== 'done' ? `<button type="button" class="btn btn-ghost" data-act="sc-live">${ic('bolt', 15)}${m.status === 'live' ? 'Update live' : 'Set live'}</button>` : ''}
        <button type="submit" class="btn btn-primary">${ic('check', 16, 2.6)}Save result</button></div></form>`);
  updateHint(true);
}
function readScore(form) {
  const bo = +form.dataset.bo, fd = new FormData(form);
  return Array.from({ length: bo }, (_, i) => [String(fd.get('a' + i) || '').trim(), String(fd.get('b' + i) || '').trim()]);
}
function updateHint(quiet) {
  const form = $('form[data-form=score]'); if (!form) return;
  const t = T(form.dataset.t); const raw = readScore(form);
  const ev = evalGames(raw, t.points, +form.dataset.bo);
  const h = $('#sc-hint');
  const empty = raw.every(g => g[0] === '' && g[1] === '');
  if (ev.err && quiet) { h.className = 'hint'; h.textContent = 'Match in progress — update the scores, or enter the final result and save.'; }
  else if (ev.err) { h.className = 'hint bad'; h.textContent = ev.err; }
  else if (ev.done) { h.className = 'hint ok'; h.textContent = `Match complete — ${ev.wa > ev.wb ? 'left' : 'right'} side wins ${Math.max(ev.wa, ev.wb)}–${Math.min(ev.wa, ev.wb)} in games.`; }
  else { h.className = 'hint'; h.textContent = empty ? 'Enter the score of each game played.' : ev.played.length ? `Games so far: ${ev.wa}–${ev.wb}. Add the next game or save as live.` : 'Enter both scores.'; }
}
function saveScore(form, mode) {
  const t = T(form.dataset.t); if (!t) return;
  const stage = form.dataset.s, mid = form.dataset.m, bo = +form.dataset.bo;
  const m = stage === 'ko' ? t.ko.matches.find(x => x.id === mid) : t.matches.find(x => x.id === mid);
  if (!m) return;
  const raw = readScore(form);
  const court = String(new FormData(form).get('court') || '').trim();
  const res = stage === 'ko' ? koResolve(t).find(x => x.id === mid) : m;
  let msg = 'Saved';
  if (mode === 'save') {
    const ev = evalGames(raw, t.points, bo);
    if (!ev.done) { const h = $('#sc-hint'); h.className = 'hint bad'; h.textContent = ev.err || `A match needs ${ev.need} game wins — enter the remaining games or use “Set live”.`; return; }
    m.games = ev.played; m.status = 'done'; m.doneAt = Date.now();
    if (!m.seq) m.seq = t.seq = (t.seq || 0) + 1;
    msg = 'Result saved';
  } else if (mode === 'live') {
    const pairs = raw.filter(g => g[0] !== '' || g[1] !== '').map(g => [parseInt(g[0], 10) || 0, parseInt(g[1], 10) || 0]);
    m.games = pairs; m.status = 'live'; m.seq = 0; m.doneAt = 0; msg = 'Match is live';
  } else {
    m.games = []; m.status = 'scheduled'; m.seq = 0; m.doneAt = 0; msg = 'Result cleared';
  }
  m.court = court;
  if (stage === 'ko') { if (m.status === 'done') { m.pa = res.a; m.pb = res.b; } else { delete m.pa; delete m.pb; } }
  syncStage(t);
  closeModal();
  t.updatedAt = Date.now(); render();
  const payload = { stage, games: m.games, status: m.status, court: m.court, pa: m.pa ?? null, pb: m.pb ?? null, tournamentStage: t.stage };
  enqueue(async () => finishWrite((await api('PATCH', `/api/tournaments/${t.id}/matches/${mid}`, payload)).tournament), t.id);
  const d = computeElo(t).deltas[mid];
  toast(m.status === 'done' && d ? `${msg} · ELO ${sgn(d.a)} / ${sgn(d.b)}` : msg);
}

/* ============================================================
   Actions
   ============================================================ */
function drawGroups(t, mode) {
  if (mode === 'clear') { t.teams.forEach(x => { x.group = null; }); return; }
  const e = computeElo(t);
  let order = [...t.teams];
  if (mode === 'random') order.sort(() => Math.random() - .5);
  else order.sort((a, b) => e.teamStart(b) - e.teamStart(a));
  const G = t.groups;
  order.forEach((tm, i) => { const r = Math.floor(i / G), p = i % G; tm.group = mode === 'random' ? p : (r % 2 === 0 ? p : G - 1 - p); });
}

const OPEN_ACTS = new Set(['close', 'backdrop', 'confirm-ok', 'retry', 'share', 'logout', 'mfilter', 'mstatus', 'sbgroup']);
const ACT = {
  close: () => closeModal(),
  retry: () => boot(),
  share: el => {
    const url = location.origin + location.pathname + '#/t/' + el.dataset.t;
    if (navigator.share && matchMedia('(max-width:900px)').matches) navigator.share({ title: (T(el.dataset.t) || {}).name || 'Sanjay Jheel Badminton Club', url }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied — anyone can open it to watch live'), () => toast(url));
    else toast(url);
  },
  logout: () => { api('POST', '/api/auth/logout', {}).finally(() => { ME = null; USERS = null; toast('Signed out'); go('#/'); render(true); }); },
  'user-approve': el => api('PATCH', '/api/users/' + el.dataset.u, { role: 'editor' }).then(loadUsers).then(() => toast('Approved')).catch(e => toast(e.message, 'err')),
  'user-block': el => api('PATCH', '/api/users/' + el.dataset.u, { role: 'blocked' }).then(loadUsers).then(() => toast('Blocked')).catch(e => toast(e.message, 'err')),
  'user-del': el => {
    const u = USERS.find(x => x.id === +el.dataset.u);
    confirmBox('Remove user?', '<b>' + esc(u.email) + '</b> will lose access. They can sign in again and request approval.', 'Remove', () => api('DELETE', '/api/users/' + u.id).then(loadUsers).then(() => toast('User removed')).catch(e => toast(e.message, 'err')));
  },
  backdrop: (el, ev) => { if (ev.target === el) closeModal(); },
  'confirm-ok': () => { const cb = confirmCb; closeModal(); cb && cb(); },
  /* wizard */
  wset: el => { W[el.dataset.k] = isNaN(el.dataset.v) ? el.dataset.v : +el.dataset.v; render(); },
  wstep: el => { const k = el.dataset.k, lim = { groups: [1, 8], mpt: [1, 10] }[k]; W[k] = clamp(W[k] + +el.dataset.d, lim[0], lim[1]); render(); },
  wtoggle: el => { W[el.dataset.k] = !W[el.dataset.k]; render(); },
  wnext: () => {
    if (W.step === 1) {
      if (!W.name.trim()) { toast('Give your tournament a name', 'err'); $('#w-name')?.focus(); return; }
      if (W.start && W.end && W.end < W.start) { toast('End date is before the start date', 'err'); return; }
    }
    W.step++; render(true);
  },
  wprev: () => { W.step--; render(true); },
  wcancel: () => { W = null; },
  wcreate: () => {
    const t = { id: uid(), name: W.name.trim(), venue: W.venue.trim(), startDate: W.start, endDate: W.end, type: W.type, groups: W.groups, matchesPerTeam: W.mpt, bestOf: W.bestOf, points: W.points, knockout: W.knockout, thirdPlace: W.third, koBestOf: W.koBestOf, stage: 'setup', teams: [], matches: [], ko: null, createdAt: Date.now(), updatedAt: Date.now() };
    W = null;
    createOnServer(t).then(doc => { toast('Tournament created — now add your ' + unitLabel(doc)); go(`#/t/${doc.id}/teams`); }).catch(e => { toast(e.message, 'err'); W = null; });
  },
  /* teams */
  'add-team': el => { const t = T(el.dataset.t); openModal(teamForm(t)); },
  'edit-team': el => { const t = T(el.dataset.t); openModal(teamForm(t, teamOf(t, el.dataset.team))); },
  'del-team': el => { const t = T(el.dataset.t), tm = teamOf(t, el.dataset.team); confirmBox('Remove ' + (t.type === 'singles' ? 'player' : 'team') + '?', `<b>${esc(tname(tm))}</b> will be removed from this tournament.`, 'Remove', () => { t.teams = t.teams.filter(x => x.id !== tm.id); commit(t, ['teams']); toast('Removed'); }); },
  bulk: el => openModal(bulkForm(T(el.dataset.t))),
  draw: el => { const t = T(el.dataset.t); drawGroups(t, el.dataset.mode); commit(t, ['teams']); toast(el.dataset.mode === 'clear' ? 'Groups cleared' : el.dataset.mode === 'random' ? 'Random draw done' : 'Seeded draw done — strongest entries are spread across groups'); },
  start: el => {
    const t = T(el.dataset.t), sc = startChecks(t);
    if (!sc.ok) return;
    const { matches, reduced } = generateFixtures(t);
    t.matches = matches; t.ko = null; t.stage = 'group';
    commit(t, ['matches', 'ko', 'stage']);
    toast(`${matches.length} matches created${reduced ? ' (in some groups one entry plays one fewer)' : ''}`);
    go(`#/t/${t.id}/matches`);
  },
  'reset-fx': el => { const t = T(el.dataset.t); confirmBox('Reset fixtures & scores?', 'All matches, scores and the knockout bracket will be deleted. Teams stay, and you can redraw the groups.', 'Reset', () => { t.matches = []; t.ko = null; t.stage = 'setup'; commit(t, ['matches', 'ko', 'stage']); toast('Tournament reset'); go(`#/t/${t.id}/teams`); }); },
  'del-t': el => { const t = T(el.dataset.t); confirmBox('Delete tournament?', `<b>${esc(t.name)}</b> and all its results will be permanently deleted.`, 'Delete', () => { api('DELETE', '/api/tournaments/' + t.id).then(() => { S.tournaments = S.tournaments.filter(x => x.id !== t.id); toast('Tournament deleted'); go('#/tournaments'); render(); }).catch(e => toast(e.message, 'err')); }); },
  'edit-t': el => {
    const t = T(el.dataset.t);
    openModal(`<h3 class="num">Edit details</h3><p class="sub">Format settings are fixed once a tournament is created.</p>
      <form data-form="edit-t" data-t="${t.id}"><div class="field"><label>Name</label><input class="input" name="name" value="${esc(t.name)}" maxlength="60" required></div>
      <div class="field"><label>Venue</label><input class="input" name="venue" value="${esc(t.venue || '')}" maxlength="60"></div>
      <div class="two"><div class="field"><label>Start</label><input type="date" class="input" name="s" value="${t.startDate || ''}"></div><div class="field"><label>End</label><input type="date" class="input" name="e" value="${t.endDate || ''}"></div></div>
      <div class="mfoot2"><button type="button" class="btn btn-ghost" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`);
  },
  /* matches */
  mfilter: el => { UI.mFilter[el.dataset.t] = el.dataset.v; render(); },
  mstatus: el => { UI.mStatus[el.dataset.t] = el.dataset.v; render(); },
  sbgroup: el => { UI.sbGroup[el.dataset.t] = +el.dataset.v; render(); },
  score: el => scoreModal(el.dataset.t, el.dataset.m, el.dataset.s),
  'sc-live': () => saveScore($('form[data-form=score]'), 'live'),
  'sc-clear': () => saveScore($('form[data-form=score]'), 'clear'),
  'gen-ko': el => {
    const t = T(el.dataset.t);
    const run = () => {
      const q = qualifiers(t);
      if (q.list.length < 2) { toast('Need at least 2 qualifiers', 'err'); return; }
      t.ko = buildKo(t, q.list, q.info); syncStage(t); commit(t, ['ko', 'stage']); toast('Bracket generated');
    };
    if (t.ko) confirmBox('Re-seed the bracket?', 'Seeds are rebuilt from the current group standings and all knockout scores are cleared.', 'Re-seed', run);
    else if (!groupsDone(t)) confirmBox('Group stage not finished', 'Some group matches are still unplayed. Seeds will use the standings as they are right now.', 'Generate anyway', run, false);
    else run();
  },
  /* data */
  export: () => { window.location.href = '/api/admin/export'; },
  wipe: () => confirmBox('Delete all tournaments?', 'Every tournament, team, score and rating on the server will be erased for everyone. This cannot be undone — export a backup first if unsure. User accounts are kept.', 'Delete everything', () => { api('DELETE', '/api/admin/tournaments').then(() => { S.tournaments = []; toast('All tournaments deleted'); go('#/'); render(true); }).catch(e => toast(e.message, 'err')); }),
  demo: () => { seedDemo().then(() => { toast('Demo tournaments added'); go('#/'); render(); }).catch(e => toast(e.message, 'err')); },
};

/* ============================================================
   Demo data
   ============================================================ */
function simScore(P, aWin) {
  const close = Math.random() < .28;
  let hi, lo;
  if (close) { hi = P + rand(1, 4); lo = hi - 2; if (hi >= capFor(P)) { hi = capFor(P); lo = hi - rand(1, 2); } }
  else { hi = P; lo = rand(Math.max(3, P - 17), P - 3); }
  return aWin ? [hi, lo] : [lo, hi];
}
async function seedDemo() {
  const mk = (a, b, e1, e2) => ({ id: uid(), group: null, players: b ? [{ name: a, elo: e1 }, { name: b, elo: e2 }] : [{ name: a, elo: e1 }] });
  const pairs = [['Rohan Kadam', 'Ananya Pillai', 2184, 2129], ['Vikram Shetty', 'Priya Nair', 2096, 1902], ['Meera Iyer', 'Siddharth Kulkarni', 2071, 1960], ['Karan Joshi', 'Divya Menon', 2043, 1844], ['Rahul Tiwari', 'Ishaani Jain', 1918, 1890], ['Nikhil Chavan', 'Himanshu Bist', 1990, 1950], ['Gauri Sathe', 'Rhea Mehta', 1897, 1860], ['Aditya Sharma', 'Pooja Kulkarni', 2019, 1880]];
  const t = { id: uid(), name: 'Diwali Open Doubles 2026', venue: 'Sunder JB Courts', startDate: '2026-10-12', endDate: '2026-10-19', seq: 0, type: 'doubles', groups: 2, matchesPerTeam: 3, bestOf: 3, points: 21, knockout: 'top2', thirdPlace: true, koBestOf: 3, stage: 'group', teams: pairs.map(p => mk(...p)), matches: [], ko: null, createdAt: Date.now(), updatedAt: Date.now() };
  drawGroups(t, 'seeded');
  t.matches = generateFixtures(t).matches;
  const e0 = computeElo(t);
  const rating = id => e0.teamStart(teamOf(t, id));
  const toPlay = t.matches.length - 3;
  t.matches.forEach((m, i) => {
    if (i >= toPlay) { if (i === toPlay) { m.status = 'live'; m.games = [[21, 17], [14, 11]]; m.court = '3'; } return; }
    const p = 1 / (1 + 10 ** ((rating(m.b) - rating(m.a)) / 400));
    let ga = 0, gb = 0; const games = [];
    while (ga < 2 && gb < 2) { const aw = Math.random() < p; games.push(simScore(21, aw)); aw ? ga++ : gb++; }
    m.games = games; m.status = 'done'; m.seq = ++t.seq; m.doneAt = Date.now() - (toPlay - i) * 600000; m.court = String(1 + (i % 4));
  });
  const names = ['Arjun Mehta', 'Sanya Kapoor', 'Dev Malhotra', 'Kiran Bhat', 'Aarav Nair', 'Ishita Rao', 'Yusuf Khan', 'Riya Desai', 'Tanvi Mehra', 'Omkar Patil'];
  const t2 = { id: uid(), name: "Sanjay Jheel Members' Singles Ladder", venue: 'Indoor Hall 2', startDate: '2026-10-24', endDate: '2026-10-25', seq: 0, type: 'singles', groups: 2, matchesPerTeam: 3, bestOf: 3, points: 21, knockout: 'top2', thirdPlace: false, koBestOf: 3, stage: 'setup', teams: names.map((n, i) => mk(n, null, 1700 - i * 35)), matches: [], ko: null, createdAt: Date.now() - 1000, updatedAt: Date.now() - 1000 };
  await createOnServer(t2); await createOnServer(t);
}

/* ============================================================
   Event wiring
   ============================================================ */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const f = ACT[el.dataset.act];
  if (f && !OPEN_ACTS.has(el.dataset.act) && !canEdit() && !(isAdmin())) {
    ev.preventDefault();
    if (el.dataset.act === 'wcancel') return;
    toast(ME ? 'Your account is waiting for admin approval' : 'Sign in to make changes', 'err');
    if (!ME) go('#/login');
    return;
  }
  if (f) { if (el.tagName === 'A' && el.dataset.act !== 'wcancel') ev.preventDefault(); f(el, ev); }
});
document.addEventListener('submit', ev => {
  const form = ev.target.closest('form[data-form]'); if (!form) return;
  ev.preventDefault();
  const k = form.dataset.form;
  if (k === 'team') handleTeamForm(form, ev.submitter && ev.submitter.dataset.more === '1');
  else if (k === 'bulk') handleBulk(form);
  else if (k === 'score') saveScore(form, 'save');
  else if (k === 'devlogin') {
    const fd = new FormData(form);
    api('POST', '/api/auth/dev', { email: String(fd.get('email')), name: String(fd.get('name')) }).then(d => afterLogin(d.user)).catch(e => toast(e.message, 'err'));
  } else if (k === 'invite') {
    const fd = new FormData(form);
    api('POST', '/api/users', { email: String(fd.get('email')), role: String(fd.get('role')) }).then(loadUsers).then(() => toast('Invitation saved')).catch(e => toast(e.message, 'err'));
  } else if (k === 'edit-t') {
    const t = T(form.dataset.t), fd = new FormData(form), name = String(fd.get('name')).trim();
    if (!name) return;
    Object.assign(t, { name, venue: String(fd.get('venue')).trim(), startDate: fd.get('s'), endDate: fd.get('e') });
    closeModal(); commit(t, ['name', 'venue', 'startDate', 'endDate']); toast('Details saved');
  }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset.w) { W[el.dataset.w] = el.value; return; }
  if (el.dataset.in === 'rankq') { UI.rankQ = el.value; const pos = el.selectionStart; render(); const n = $('[data-in=rankq]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (el.closest('form[data-form=score]')) {
    if (/^(a|b)\d$/.test(el.name)) {
      el.value = el.value.replace(/\D/g, '').slice(0, 2);
      // jump to next field when a plausible score is typed
      updateHint();
    } else updateHint();
  }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset.chg === 'urole') {
    api('PATCH', '/api/users/' + el.dataset.u, { role: el.value }).then(loadUsers).then(() => toast('Role updated')).catch(e => { toast(e.message, 'err'); loadUsers(); });
  } else if (el.dataset.chg === 'move') {
    const t = T(location.hash.split('/')[2]), tm = t && teamOf(t, el.dataset.team);
    if (tm && canEdit()) { tm.group = el.value === '' ? null : +el.value; commit(t, ['teams']); }
  } else if (el.dataset.in === 'import') {
    const file = el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.tournaments)) throw new Error('bad');
        confirmBox('Replace current data?', `This backup has ${d.tournaments.length} tournament${d.tournaments.length === 1 ? '' : 's'}. Everything currently on the server will be replaced, for everyone.`, 'Import', () => { api('POST', '/api/admin/import', d).then(async () => { await loadAll(); toast('Backup imported'); go('#/'); render(true); }).catch(e => toast(e.message, 'err')); });
      } catch (e) { toast('That file is not a valid Sanjay Jheel Badminton Club backup', 'err'); }
    };
    rd.readAsText(file); el.value = '';
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#modal-root .backdrop')) closeModal(); });

/* drag & drop team → group (desktop) */
document.addEventListener('dragstart', ev => { const r = ev.target.closest && ev.target.closest('.trow'); if (!r) return; UI.drag = r.dataset.team; r.classList.add('dragging'); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', UI.drag); } catch (e) { /* noop */ } });
document.addEventListener('dragend', () => { UI.drag = null; $$('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); });
document.addEventListener('dragover', ev => { const z = ev.target.closest && ev.target.closest('[data-drop]'); if (z && UI.drag) { ev.preventDefault(); $$('.over').forEach(x => x !== z && x.classList.remove('over')); z.classList.add('over'); } });
document.addEventListener('drop', ev => {
  const z = ev.target.closest && ev.target.closest('[data-drop]'); if (!z || !UI.drag) return;
  ev.preventDefault();
  const t = T(location.hash.split('/')[2]), tm = t && teamOf(t, UI.drag); UI.drag = null;
  if (tm && canEdit() && t.stage === 'setup') { tm.group = z.dataset.drop === 'none' ? null : +z.dataset.drop; commit(t, ['teams']); }
});

boot();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
