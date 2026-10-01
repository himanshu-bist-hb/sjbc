'use strict';
// Vercel serverless entry: every /api, /auth and /healthz request is rewritten here (see vercel.json).
const { app, ready } = require('../server');

module.exports = async (req, res) => {
  try { await ready; } catch (e) { console.error('Startup failed:', e.message); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); return res.end('{"error":"Database unavailable"}'); }
  return app(req, res);
};
