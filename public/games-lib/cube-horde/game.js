// Cube Horde - original blocky zombie-wave arena (Hub build, shared arena.js) // @uses arena.js
Arena({ id: 'gl-cube-horde', title: 'CUBE HORDE', aim: 'auto', lives: 5, fireRate: 0.22, bulletSpeed: 560, world: { w: 1000, h: 1000 }, hpScale: 0.12, waveBonus: w => 100 * w,
  help: 'Move: WASD / drag anywhere - you auto-fire\nBlocky zombies come in waves - pick up power crates',
  theme: { bg: '#1a2e05', grid: 'rgba(132,204,22,.15)', edge: '#84cc16', player: '#38bdf8', bullet: '#fde047' },
  types: { walker: { hp: 2, sp: 70, r: 13, c: '#65a30d', v: 10, shape: 'box' }, runner: { hp: 1, sp: 140, r: 10, c: '#a3e635', v: 15, shape: 'box' }, brute: { hp: 10, sp: 50, r: 22, c: '#3f6212', v: 50, shape: 'box' }, spitter: { hp: 3, sp: 55, r: 13, c: '#16a34a', v: 25, shape: 'box', shoot: 2.5 } },
  wave: (g) => { const w = g.wave; const o = [['walker', 5 + w * 2]]; if (w > 1) o.push(['runner', w]); if (w > 3) o.push(['brute', Math.floor(w / 3)]); if (w > 4) o.push(['spitter', Math.floor(w / 3)]); return o; },
  drawPlayer: (c, p, g) => { c.save(); c.translate(p.x, p.y); c.rotate(p.aim || 0); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-12, -8, 26, 20); c.fillStyle = '#38bdf8'; c.fillRect(-11, -11, 22, 22); c.fillStyle = '#fcd9b6'; c.fillRect(-6, -6, 12, 12); c.fillStyle = '#334155'; c.fillRect(8, -3, 14, 6); c.restore(); } });
