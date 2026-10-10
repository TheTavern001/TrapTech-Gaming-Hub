// Pop Defense - original balloon-popping path defense (Hub build, shared td.js) // @uses td.js
(function () {
  const LC = ['#000', '#ef4444', '#3b82f6', '#22c55e', '#fbbf24', '#f472b6', '#111827', '#f8fafc', '#a855f7'];
  TD({ id: 'gl-pop-defense', title: 'POP DEFENSE', startCash: 160, lives: 40, theme: { bg: '#14532d', ground: '#4d7c0f', road: '#d6b88a', base: '#ef4444' },
    help: 'Tap a tower card, then a grass tile to build\nEvery balloon layer popped = 1 point. Tap towers to upgrade',
    path: [[0, 2], [6, 2], [6, 7], [11, 7], [11, 1], [16, 1], [16, 8], [19, 8]],
    towers: [{ n: 'Dart Monkey', cost: 60, range: 2.6, rate: 0.7, dmg: 1, c: '#a16207', speed: 520 }, { n: 'Tack Ring', cost: 120, range: 1.7, rate: 1.0, dmg: 1, c: '#f472b6', kind: 'pulse' }, { n: 'Bomb Tower', cost: 180, range: 3, rate: 1.4, dmg: 2, c: '#111827', kind: 'splash', radius: 1.3 }, { n: 'Frost Fan', cost: 140, range: 2, rate: 1.6, dmg: 0.5, c: '#7dd3fc', kind: 'pulse', slow: 2 }, { n: 'Laser Eye', cost: 300, range: 4.5, rate: 0.25, dmg: 2, c: '#a855f7', kind: 'laser' }],
    perWave: (w) => 8 + Math.floor(w * 2.2),
    enemy: (w, i, g) => { const top = Math.min(8, 1 + Math.floor(w / 2.5)); const L = Math.max(1, top - (g.rnd() < 0.5 ? g.RI(0, 2) : 0)); return { hp: L * 1, lhp: 1, layers: L, sp: 1.6 + L * 0.25 + Math.min(1.5, w * 0.03), c: LC[L], r: 10 + L * 0.6, v: 0 }; },
    layerColor: (L) => LC[Math.max(1, L)], bonus: (w) => 25 * w,
    drawEnemy: (c, e, g) => { c.fillStyle = e.c; c.beginPath(); c.ellipse(e.x, e.y, e.r * 0.85, e.r, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(e.x - 3, e.y - 4, 3, 5, 0.4, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(e.x, e.y + e.r); c.lineTo(e.x, e.y + e.r + 6); c.stroke(); } });
})();
