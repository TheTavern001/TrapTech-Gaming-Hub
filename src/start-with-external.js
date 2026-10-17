'use strict';
const express = require('express');
const path = require('path');
const { register } = require('./external-routes');

const app = express();

// Serve static files from public/ if present (favicon, assets, etc.)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { maxAge: '1h' }));

// Register external games routes (API + play pages)
register(app);

// Root serves the games catalog directly so the normal URL works
app.get('/', async (req, res) => {
  const { loadGames } = require('./external-games');
  const games = await loadGames();
  const cards = games.slice(0, 200).map(g => `
    <a href="/external/play/${encodeURIComponent(g.id)}" style="display:block;border:1px solid #333;border-radius:12px;overflow:hidden;text-decoration:none;color:inherit;background:#111;">
      <img src="${g.thumbnail}" alt="" style="width:100%;height:140px;object-fit:cover;background:#222;">
      <div style="padding:10px;">
        <strong>${g.title}</strong><br>
        <small style="color:#aaa;">${g.source} · ${(g.categories||[]).slice(0,2).join(', ')}</small>
      </div>
    </a>`).join('');
  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trap Tech Gaming Hub</title>
<style>body{margin:0;background:#0a0a0a;color:#eee;font-family:system-ui,sans-serif}header{padding:16px;background:#111;border-bottom:1px solid #333} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:16px}</style>
</head><body>
<header><h1 style="margin:0;font-size:1.4rem;">Trap Tech Gaming Hub</h1><p style="margin:4px 0 0;color:#aaa;">${games.length} free games from GameArter + GameDistribution</p></header>
<div class="grid">${cards}</div>
</body></html>`);
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log('Gaming Hub ready at http://localhost:' + PORT);
});
