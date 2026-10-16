'use strict';
const { loadGames } = require('./external-games');

function register(app) {
  app.get('/api/external-games', async (req, res) => {
    try {
      const games = await loadGames();
      const q = String(req.query.q || '').toLowerCase();
      const cat = String(req.query.cat || '').toLowerCase();
      const filtered = games.filter(g => {
        if (q && !g.title.toLowerCase().includes(q)) return false;
        if (cat && !(g.categories || []).some(c => String(c).toLowerCase().includes(cat))) return false;
        return true;
      });
      res.json({ ok: true, total: filtered.length, games: filtered.slice(0, 500) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/external', async (req, res) => {
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
<title>External Games — Trap Tech Hub</title>
<style>body{margin:0;background:#0a0a0a;color:#eee;font-family:system-ui,sans-serif}header{padding:16px;background:#111;border-bottom:1px solid #333} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:16px}</style>
</head><body>
<header><h1 style="margin:0;font-size:1.4rem;">External Games Catalog</h1><p style="margin:4px 0 0;color:#aaa;">${games.length} titles from GameArter + GameDistribution</p></header>
<div class="grid">${cards}</div>
</body></html>`);
  });

  app.get('/external/play/:id', async (req, res) => {
    const games = await loadGames();
    const g = games.find(x => x.id === req.params.id);
    if (!g) return res.status(404).send('Game not found');
    res.send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${g.title} — Trap Tech Hub</title>
<style>body{margin:0;background:#000;color:#eee;font-family:system-ui}iframe{width:100%;height:100vh;border:0}</style>
</head><body>
<iframe src="${g.embedUrl}" allowfullscreen allow="autoplay; fullscreen"></iframe>
</body></html>`);
  });
}

module.exports = { register };
