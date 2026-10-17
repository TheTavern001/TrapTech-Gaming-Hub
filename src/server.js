'use strict';
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cfg = require('./config');
const db = require('./db');
const boards = require('./boards');
const ach = require('./achievements');
const AC = require('./anticheat');
const COS = require('./cosmetics');
const PK = require('./packages');
const { gameBoard, globalBoard, ranked, giveawayEntrants, giveawayStatus, activeGiveawaysFor, giveawayGameIds } = boards;

const libraryGames = () => require('./games-lib').games;
const resolveGame = (id) => cfg.GAME_MAP[id] || libraryGames().find(g => g.id === id) || null;
const HUB_VERSION = 'V1';
const { buildFingerprint } = require('./build-info');
const BUILD_FINGERPRINT = buildFingerprint(path.resolve(__dirname, '..'));

const app = express();
require('./external-routes').register(app);
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || (process.env.NODE_ENV === 'production' ? 1 : 0));
app.set('trust proxy', Number.isInteger(proxyHops) && proxyHops >= 1 && proxyHops <= 3 ? proxyHops : false);
const PU = require('./public-url'); app.use(PU.redirect());
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(require('./static-gz')(path.join(cfg.ROOT, 'public')));
app.use(require('compression')({ threshold: 1024 }));
app.use(express.json({ limit: '32kb' }));

app.get('/healthz', (req, res) => { try { db.prepare('SELECT 1').get(); res.json({ ok: true, product: 'The Gaming Hub', version: HUB_VERSION }); } catch (e) { res.status(500).json({ ok: false }); } });
app.get('/api/build', (req, res) => { res.json({ ok: true, product: 'The Gaming Hub', version: HUB_VERSION, games_library: libraryGames().length }); });

const now = () => Date.now();
function bad(res, code, error) { return res.status(code).json({ ok: false, error }); }

app.get('/api/games', (req, res) => {
  const games = cfg.GAMES.map(g => ({ ...g }));
  res.json({ ok: true, games });
});

app.get('/api/leaderboard', (req, res) => {
  const game = String(req.query.game || 'global');
  const period = ['weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'all';
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 500);
  let rows = game === 'global' ? ranked(globalBoard(0)) : (resolveGame(game) ? ranked(gameBoard(game, 0)) : []);
  res.json({ ok: true, rows: rows.slice(0, limit), period, game });
});

app.get('/api/me', (req, res) => {
  res.json({ ok: true, user: null, now: now(), version: HUB_VERSION });
});

// Serve static public files and SPA fallback
app.use(express.static(path.join(cfg.ROOT, 'public')));
app.get('*', (req, res) => {
  const index = path.join(cfg.ROOT, 'public', 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(200).send('<h1>Trap Tech Gaming Hub</h1><p>Full hub loading. <a href="/api/games">Games API</a></p>');
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log('Gaming Hub ready at http://localhost:' + PORT);
});
