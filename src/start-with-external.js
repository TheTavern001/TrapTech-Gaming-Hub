'use strict';
const express = require('express');
const path = require('path');
const { register } = require('./external-routes');

const app = express();
app.disable('x-powered-by');

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { maxAge: '1h' }));

register(app);

app.get('/', async (req, res) => {
  try {
    const { loadGames } = require('./external-games');
    const games = await loadGames();
    if (!games || !games.length) {
      return res.send('<!doctype html><html><head><meta charset="utf-8"><title>Trap Tech Gaming Hub</title></head><body style="background:#0a0a0a;color:#eee;font-family:system-ui;padding:20px;"><h1>Trap Tech Gaming Hub</h1><p>Catalog is loading or feeds are temporarily unavailable. <a href="/api/external-games" style="color:#22d3ee;">Check API</a> or refresh in a minute.</p></body></html>');
    }
    const cards = games.slice(0, 200).map(g => `
      <a href="/external/play/${encodeURIComponent(g.id)}" style="display:block;border:1px solid #333;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;background:#111;">
        <img src="${g.thumbnail || ''}" alt="" style="width:100%;height:120px;object-fit:cover;background:#222;" loading="lazy">
        <div style="padding:8px;font-size:0.9rem;">
          <strong>${g.title || 'Game'}</strong><br>
          <small style="color:#aaa;">${g.source || ''}</small>
        </div>
      </a>`).join('');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trap Tech Gaming Hub</title>
<style>body{margin:0;background:#0a0a0a;color:#eee;font-family:system-ui,sans-serif}header{padding:12px 16px;background:#111;border-bottom:1px solid #333} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;padding:12px}</style>
</head><body>
<header><h1 style="margin:0;font-size:1.3rem;">Trap Tech Gaming Hub</h1><p style="margin:4px 0 0;color:#aaa;">${games.length} free HTML5 games</p></header>
<div class="grid">${cards}</div>
</body></html>`);
  } catch (e) {
    res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><title>Trap Tech Gaming Hub</title></head><body style="background:#0a0a0a;color:#eee;font-family:system-ui;padding:20px;"><h1>Trap Tech Gaming Hub</h1><p>Error loading catalog: ${e.message}. <a href="/api/external-games" style="color:#22d3ee;">API status</a></p></body></html>`);
  }
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log('Gaming Hub ready at http://localhost:' + PORT);
});
