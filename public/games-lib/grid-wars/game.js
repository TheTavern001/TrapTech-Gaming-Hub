// Grid Wars - original neon twin-stick survival (Hub build, shared arena.js) // @uses arena.js
Arena({ id: 'gl-grid-wars', title: 'GRID WARS', aim: 'mouse', mult: true, lives: 3, bombs: 3, fireRate: 0.09, shots: 2, spread: 0.08, clearOnHit: true, world: { w: 1100, h: 900 },
  help: 'Move: WASD / drag   Aim: mouse (auto-aim on touch)\nB = smart bomb. Chain kills to raise the multiplier',
  theme: { bg: '#010208', grid: 'rgba(56,189,248,.16)', edge: '#38bdf8', player: '#f8fafc', bullet: '#fde68a' },
  types: { wand: { hp: 1, sp: 90, r: 11, c: '#a855f7', v: 25, ai: 'wander', shape: 'square', spin: 3 }, dia: { hp: 1, sp: 130, r: 12, c: '#22d3ee', v: 50, shape: 'diamond' }, dodger: { hp: 2, sp: 150, r: 12, c: '#34d399', v: 100, ai: 'dodge', shape: 'square' },
    split: { hp: 2, sp: 110, r: 14, c: '#f472b6', v: 100, shape: 'square', split: 'mini', spin: 2 }, mini: { hp: 1, sp: 200, r: 7, c: '#f9a8d4', v: 50, ai: 'dodge', shape: 'square', spin: 6 }, dash: { hp: 3, sp: 120, r: 13, c: '#f97316', v: 150, ai: 'dash', shape: 'tri' } },
  wave: (g) => { const w = g.wave; const out = [['wand', 4 + w], ['dia', 2 + Math.floor(w * 1.2)]]; if (w > 2) out.push(['dodger', Math.floor(w / 2)]); if (w > 3) out.push(['split', Math.floor(w / 3)]); if (w > 5) out.push(['dash', Math.floor(w / 4)]); return out; } });
