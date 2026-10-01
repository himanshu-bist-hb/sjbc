'use strict';
/* Shape validation for tournament documents. The server does not re-implement
   badminton rules (the client owns those); it guarantees stored data is well-formed
   and bounded so a bad client can never corrupt the database or other viewers. */

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const isStr = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
const STAGES = ['setup', 'group', 'knockout', 'done'];
const STATUSES = ['scheduled', 'live', 'done'];

function games(g) {
  return Array.isArray(g) && g.length <= 3 && g.every(x => Array.isArray(x) && x.length === 2 && isInt(x[0], 0, 99) && isInt(x[1], 0, 99));
}
function match(m, ko) {
  if (!isObj(m) || !isStr(m.id, 40, 1)) return false;
  if (!STATUSES.includes(m.status) || !games(m.games)) return false;
  if (m.court != null && !isStr(m.court, 12)) return false;
  if (m.seq != null && !isInt(m.seq, 0, 1e7)) return false;
  if (m.doneAt != null && !(Number.isFinite(m.doneAt) && m.doneAt >= 0)) return false;
  if (!isInt(m.round, 1, 64)) return false;
  if (ko) return isInt(m.idx, 0, 63) && (m.pa == null || isStr(m.pa, 40)) && (m.pb == null || isStr(m.pb, 40));
  return isInt(m.group, 0, 7) && isStr(m.a, 40, 1) && isStr(m.b, 40, 1);
}
function teams(list) {
  if (!Array.isArray(list) || list.length > 256) return false;
  const ids = new Set();
  return list.every(t => {
    if (!isObj(t) || !isStr(t.id, 40, 1) || ids.has(t.id)) return false;
    ids.add(t.id);
    if (!(t.group === null || isInt(t.group, 0, 7))) return false;
    if (t.name !== undefined && !isStr(t.name, 40, 1)) return false;
    return Array.isArray(t.players) && t.players.length >= 1 && t.players.length <= 2 &&
      t.players.every(p => isObj(p) && isStr(p.name, 40, 1) && Number.isFinite(p.elo) && p.elo >= 100 && p.elo <= 4000);
  });
}
function ko(k) {
  if (k === null) return true;
  return isObj(k) && isInt(k.size, 2, 64) && (k.size & (k.size - 1)) === 0 &&
    Array.isArray(k.qual) && k.qual.length <= 64 && Array.isArray(k.slots) && k.slots.length === k.size &&
    isObj(k.info) && Array.isArray(k.matches) && k.matches.length <= 70 && k.matches.every(m => match(m, true));
}

/** Validators per top-level document key. */
const KEYS = {
  name: v => isStr(v, 60, 1),
  venue: v => isStr(v, 60),
  startDate: v => v === '' || v == null || /^\d{4}-\d{2}-\d{2}$/.test(v),
  endDate: v => v === '' || v == null || /^\d{4}-\d{2}-\d{2}$/.test(v),
  type: v => v === 'singles' || v === 'doubles',
  groups: v => isInt(v, 1, 8),
  matchesPerTeam: v => isInt(v, 1, 10),
  bestOf: v => v === 1 || v === 3,
  koBestOf: v => v === 1 || v === 3,
  points: v => v === 11 || v === 15 || v === 21,
  knockout: v => ['top1', 'top2', 'top4'].includes(v),
  thirdPlace: v => typeof v === 'boolean',
  stage: v => STAGES.includes(v),
  teams,
  matches: v => Array.isArray(v) && v.length <= 2000 && v.every(m => match(m, false)),
  ko,
};
/** Keys the client may change after creation (format keys are immutable). */
const EDITABLE = ['name', 'venue', 'startDate', 'endDate', 'teams', 'matches', 'ko', 'stage'];
/** Keys that change the structure other clients' edits depend on → require a fresh version. */
const STRUCTURAL = ['teams', 'matches', 'ko', 'stage'];
const REQUIRED_ON_CREATE = ['name', 'type', 'groups', 'matchesPerTeam', 'bestOf', 'koBestOf', 'points', 'knockout', 'thirdPlace', 'stage', 'teams', 'matches', 'ko'];

function validateKeys(obj, keys) {
  for (const k of keys) {
    if (!(k in obj)) return `Missing "${k}"`;
    if (!KEYS[k](obj[k])) return `Invalid "${k}"`;
  }
  return null;
}
/** Returns {doc} (sanitised copy) or {error}. */
function cleanNew(body) {
  if (!isObj(body)) return { error: 'Body must be an object' };
  const err = validateKeys(body, REQUIRED_ON_CREATE);
  if (err) return { error: err };
  const doc = {};
  for (const k of REQUIRED_ON_CREATE) doc[k] = body[k];
  for (const k of ['venue', 'startDate', 'endDate']) { if (k in body) { if (!KEYS[k](body[k])) return { error: `Invalid "${k}"` }; doc[k] = body[k]; } }
  doc.seq = Number.isInteger(body.seq) && body.seq >= 0 ? body.seq : 0;
  return { doc };
}

module.exports = { isObj, isInt, isStr, KEYS, EDITABLE, STRUCTURAL, validateKeys, cleanNew, games, STATUSES, STAGES };
