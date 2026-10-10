// Alien Rows - original marching-invader shooter (Hub build). Art: Kenney Space Shooter Remastered (CC0), see LICENSE-Kenney-CC0.txt
const AR = {}; let arN = 0; ['enemyRed1', 'enemyBlue2', 'enemyGreen3', 'enemyBlack4', 'playerShip2_green', 'ufoYellow', 'laserGreen10', 'laserRed06', 'fire08', 'fire09', 'star2', 'darkPurple'].forEach(n => { const im = new Image(); im.onload = () => arN++; im.src = 'img/' + n + '.webp'; AR[n] = im; });
function spr(c, im, x, y, w, rot) { const h = w * im.height / im.width; if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); } else c.drawImage(im, x - w / 2, y - h / 2, w, h); }
Kit.run({ id: 'gl-alien-rows', title: 'ALIEN ROWS', help: 'Move: arrows / drag   Fire: auto on touch, Space\nShields crumble - clear every wave', bg: '#03041a',
  init(g) { g.p = { x: 200, cd: 0 }; g.wave = 0; g.shots = []; g.bombs = []; g.lives = 3; g.ufo = null; g.inv = 0; newWave(g); g.sh = []; for (let s = 0; s < 4; s++) for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) g.sh.push({ x: 50 + s * 95 + i * 7, y: 560 + j * 7, hp: 2 }); },
  update(g, dt) {
    const p = g.p; p.x = Kit.clamp(p.x + g.ax() * 260 * dt, 20, g.W - 20); if (g.ptr.down) p.x += Kit.clamp(g.ptr.x - p.x, -340 * dt, 340 * dt);
    p.cd -= dt; if ((g.keys[' '] || g.ptr.down) && p.cd <= 0 && g.shots.length < 2) { g.shots.push({ x: p.x, y: 620 }); p.cd = 0.32; g.sfx('shoot'); }
    g.inv = Math.max(0, g.inv - dt);
    for (const s of g.shots) s.y -= 520 * dt; g.shots = g.shots.filter(s => s.y > 40 && !s.dead);
    // march
    const alive = g.al.filter(a => !a.dead); if (!alive.length) { g.add(100 * g.wave, 'c'); g.float(200, 300, 'WAVE CLEAR', '#34d399', 26); g.sfx('line'); newWave(g); return; }
    g.mt -= dt; const iv = Math.max(0.05, 0.75 * alive.length / g.al.length + 0.02 - g.wave * 0.02);
    if (g.mt <= 0) { g.mt = iv; g.step = !g.step; Kit.tone(g.step ? 90 : 70, 0.06, 'square', 0.05); let edge = false; for (const a of alive) if ((g.dir > 0 && a.x > g.W - 30) || (g.dir < 0 && a.x < 30)) edge = true; if (edge) { g.dir *= -1; for (const a of alive) a.y += 18; } else for (const a of alive) a.x += 10 * g.dir; }
    for (const a of alive) { if (a.y > 545) return g.end('They landed'); for (const s of g.shots) if (!s.dead && Math.abs(s.x - a.x) < 14 && Math.abs(s.y - a.y) < 11) { s.dead = a.dead = true; g.add(a.v, 'k'); g.burst(a.x, a.y, a.c, 14, 180); g.sfx('pop'); g.float(a.x, a.y, a.v, a.c, 13); } }
    if (g.rnd() < dt * (0.7 + g.wave * 0.25)) { const sh = g.pick(alive); g.bombs.push({ x: sh.x, y: sh.y + 10, v: 170 + g.wave * 12 }); }
    for (const b of g.bombs) { b.y += b.v * dt; for (const s of g.sh) if (s.hp > 0 && Math.abs(b.x - s.x - 3) < 5 && Math.abs(b.y - s.y - 3) < 6) { s.hp--; b.dead = true; break; }
      if (!b.dead && g.inv <= 0 && Math.abs(b.x - p.x) < 16 && Math.abs(b.y - 630) < 12) { b.dead = true; g.lives--; g.inv = 1.5; g.shake(10); g.flash('#ef4444'); g.burst(p.x, 630, '#22d3ee', 30, 240); g.sfx('boom'); if (g.lives <= 0) return g.end('Ship destroyed'); } }
    g.bombs = g.bombs.filter(b => b.y < g.H && !b.dead);
    for (const s of g.shots) for (const q of g.sh) if (!s.dead && q.hp > 0 && Math.abs(s.x - q.x - 3) < 5 && Math.abs(s.y - q.y - 3) < 6) { q.hp--; s.dead = true; }
    if (!g.ufo && g.rnd() < dt * 0.08) g.ufo = { x: -30, d: 1 }; if (g.ufo) { g.ufo.x += 110 * dt; for (const s of g.shots) if (!s.dead && Math.abs(s.x - g.ufo.x) < 20 && Math.abs(s.y - 80) < 10) { s.dead = true; const v = 100 * g.RI(1, 3); g.add(v, 'u'); g.float(g.ufo.x, 80, v, '#f472b6', 20); g.burst(g.ufo.x, 80, '#f472b6', 30, 250); g.sfx('boom'); g.ufo = null; break; } if (g.ufo && g.ufo.x > g.W + 30) g.ufo = null; }
    g.hud = 'WAVE ' + g.wave + '  ' + '\u2665'.repeat(g.lives);
  },
  draw(g, c) {
    if (arN < 12) { Kit.stars(c, g.W, g.H, g.t, 6); return; }
    const bg = AR.darkPurple; const oy = (g.t * 18) % 256; for (let y = -256 + oy; y < g.H; y += 256) for (let x = 0; x < g.W; x += 256) c.drawImage(bg, x, y, 256, 256);
    const neb = c.createRadialGradient(g.W * 0.7, 180, 10, g.W * 0.7, 180, 320); neb.addColorStop(0, 'rgba(90,255,170,.16)'); neb.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = neb; c.fillRect(0, 0, g.W, g.H);
    Kit.stars(c, g.W, g.H, g.t, 3);
    const ROWIM = { 30: AR.enemyRed1, 20: AR.enemyBlue2, 10: AR.enemyGreen3 };
    for (const a of g.al) if (!a.dead) { const im = ROWIM[a.v] || AR.enemyBlack4; spr(c, im, a.x, a.y + (g.step ? 1.5 : -1.5), 26, g.step ? 0.06 : -0.06); }
    for (const s of g.sh) if (s.hp > 0) { const gr = c.createLinearGradient(s.x, s.y, s.x, s.y + 7); gr.addColorStop(0, s.hp > 1 ? '#8dffc0' : '#3a8a5a'); gr.addColorStop(1, s.hp > 1 ? '#2fb36f' : '#1d4d33'); c.fillStyle = gr; c.fillRect(s.x, s.y, 7, 7); }
    c.save(); c.shadowColor = '#7dff9a'; c.shadowBlur = 10; for (const s of g.shots) spr(c, AR.laserGreen10, s.x, s.y, 6); c.shadowColor = '#ff5a5a'; for (const b of g.bombs) spr(c, AR.laserRed06, b.x, b.y, 7, Math.PI); c.restore();
    if (g.ufo) { spr(c, AR.ufoYellow, g.ufo.x, 80, 44, g.t * 3); }
    if (!(g.inv > 0 && Math.sin(g.t * 30) > 0)) { const x = g.p.x; spr(c, Math.floor(g.t * 20) % 2 ? AR.fire08 : AR.fire09, x, 652, 10); spr(c, AR.playerShip2_green, x, 630, 40); }
    const gl = c.createLinearGradient(0, 662, 0, 668); gl.addColorStop(0, 'rgba(125,255,190,.8)'); gl.addColorStop(1, 'rgba(125,255,190,0)'); c.fillStyle = gl; c.fillRect(0, 662, g.W, 6);
  } });
function newWave(g) { g.wave++; g.mark('w', g.wave); g.al = []; g.dir = 1; g.mt = 0.5; const C = ['#f472b6', '#a855f7', '#a855f7', '#3b82f6', '#3b82f6'], V = [30, 20, 20, 10, 10]; const top = 120 + Math.min(5, g.wave - 1) * 14; for (let r = 0; r < 5; r++) for (let i = 0; i < 9; i++) g.al.push({ x: 50 + i * 34, y: top + r * 32, c: C[r], v: V[r], dead: false }); }
