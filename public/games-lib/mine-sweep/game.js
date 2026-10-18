// @uses art.js
// Mine Sweep - original timed minefield (Hub v8 rebuild). Every board is generated so it can be fully solved by logic:
// no forced guesses, so rank is reading speed and accuracy, never luck. Clear boards back to back; endless and uncapped.
(function () {
  const SZ = [[9, 9, 10], [9, 12, 16], [10, 14, 24], [10, 16, 30], [10, 16, 34]];
  const NC = ['', '#5aa9ff', '#4cd08a', '#ff6b6b', '#a98bff', '#ffb04a', '#3fd0d0', '#e8e8e8', '#9aa0b8'];
function around(w,h,r,c){const o=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const a=r+dr,b=c+dc;if((dr||dc)&&a>=0&&b>=0&&a<h&&b<w)o.push(a*w+b);}return o;}
function gen(w,h,m,sr,sc,rnd){const mine=new Uint8Array(w*h);const ban=new Set([sr*w+sc,...around(w,h,sr,sc)]);let n=0;while(n<m){const i=Math.floor(rnd()*w*h);if(mine[i]||ban.has(i))continue;mine[i]=1;n++;}return mine;}
function solvable(w,h,mine,sr,sc){const N=w*h,nb=[];for(let i=0;i<N;i++)nb.push(around(w,h,Math.floor(i/w),i%w));const cnt=i=>{let k=0;for(const j of nb[i])k+=mine[j];return k};
 const st=new Int8Array(N);// 0 unknown,1 open,2 known mine
 const q=[sr*w+sc];const open=(s)=>{const st2=[s];while(st2.length){const i=st2.pop();if(st[i]!==0)continue;st[i]=1;if(cnt(i)===0)for(const j of nb[i])if(st[j]===0)st2.push(j);}};open(sr*w+sc);
 let prog=true;while(prog){prog=false;const cons=[];for(let i=0;i<N;i++){if(st[i]!==1)continue;const n=cnt(i);let m=0;const u=[];for(const j of nb[i]){if(st[j]===2)m++;else if(st[j]===0)u.push(j);}if(!u.length)continue;const need=n-m;if(need===0){for(const j of u)open(j);prog=true;}else if(need===u.length){for(const j of u)st[j]=2;prog=true;}else cons.push({u,need});}
  if(prog)continue;
  for(const A of cons)for(const B of cons){if(A===B||A.u.length>=B.u.length)continue;if(!A.u.every(x=>B.u.includes(x)))continue;const d=B.u.filter(x=>!A.u.includes(x)),dn=B.need-A.need;if(dn===0){for(const j of d)if(st[j]===0){open(j);prog=true;}}else if(dn===d.length){for(const j of d)if(st[j]===0){st[j]=2;prog=true;}}}}
 for(let i=0;i<N;i++)if(!mine[i]&&st[i]!==1)return false;return true;}

  Kit.run({ id: 'gl-mine-sweep', title: 'MINE SWEEP', fill: true, minH: 640, maxH: 900, bg: '#0c1426',
    help: 'Tap to dig, long-press to flag (or use the mode button)\nTap a number with enough flags to chord\nEvery board is solvable by logic - no guessing',
    init(g) { g.board = 0; g.lives = 3; g.mode = 0; g.shown = 0; newBoard(g); },
    onResize(g) { layout(g); },
    update(g, dt) {
      const P = g.ptr; g.bt += dt; g.shown += (g.score - g.shown) * Math.min(1, dt * 8);
      const at = (x, y) => { const c = Math.floor((x - g.ox) / g.cs), r = Math.floor((y - g.oy) / g.cs); return c >= 0 && r >= 0 && c < g.bw && r < g.bh ? [r, c] : null; };
      const btn = (x, y) => x > g.W / 2 - 80 && x < g.W / 2 + 80 && y > g.by0 && y < g.by0 + 50;
      if (P.pressed) { if (btn(P.x, P.y)) { g.mode ^= 1; g.sfx('click'); g.pc = null; g.btnHit = true; } else { g.btnHit = false; g.pt = g.t; g.pc = at(P.x, P.y); g.flagged = false; } }
      if (P.down && g.pc && !g.flagged && g.t - g.pt > 0.35) { act(g, g.pc[0], g.pc[1], true); g.flagged = true; }
      if (P.released && g.pc && !g.flagged && !g.btnHit) { const p = at(P.x, P.y); if (p && p[0] === g.pc[0] && p[1] === g.pc[1]) act(g, p[0], p[1], false); }
      if (P.released) g.pc = null;
      g.cur = g.cur || [0, 0]; const k = (n) => { const d = g.kd(n), e = d && !g.pk[n]; g.pk[n] = d; return e; }; g.pk = g.pk || {};
      if (k('ArrowUp')) g.cur[0] = Math.max(0, g.cur[0] - 1); if (k('ArrowDown')) g.cur[0] = Math.min(g.bh - 1, g.cur[0] + 1); if (k('ArrowLeft')) g.cur[1] = Math.max(0, g.cur[1] - 1); if (k('ArrowRight')) g.cur[1] = Math.min(g.bw - 1, g.cur[1] + 1);
      if (k(' ') || k('Enter')) act(g, g.cur[0], g.cur[1], false); if (k('f') || k('F')) act(g, g.cur[0], g.cur[1], true);
      g.hud = 'BOARD ' + g.board + '   ' + '\u2665'.repeat(g.lives) + '   ' + Math.floor(g.bt) + 's';
    },
    draw(g, c) {
      Art.bg(c, g.W, g.H, g.t, '#14223d', '#070c18', 'rgba(90,140,255,.07)');
      const cs = g.cs; const tc = Art.sprite('ms-c' + cs, cs, cs, (x, w, h) => Art.tile(x, 1, 1, w - 2, h - 2, '#4a63d8', cs * 0.2));
      const to = Art.sprite('ms-o' + cs, cs, cs, (x, w, h) => { Art.rr(x, 1, 1, w - 2, h - 2, cs * 0.16); x.fillStyle = '#16213a'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.05)'; x.stroke(); });
      for (let r = 0; r < g.bh; r++) for (let q = 0; q < g.bw; q++) { const x = g.ox + q * cs, y = g.oy + r * cs, k = g.cell[r][q];
        if (k.open) { c.drawImage(to, x, y, cs, cs); if (k.mine) mineArt(c, x + cs / 2, y + cs / 2, cs * 0.3); else if (k.n) { c.font = '800 ' + Math.round(cs * 0.56) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = NC[k.n]; c.fillText(k.n, x + cs / 2, y + cs / 2 + 1); } }
        else { c.drawImage(tc, x, y, cs, cs); if (k.flag) flagArt(c, x + cs / 2, y + cs / 2, cs * 0.34); } }
      if (g.cur && g.state === 'play' && g.kbd) { c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.strokeRect(g.ox + g.cur[1] * cs, g.oy + g.cur[0] * cs, cs, cs); }
      g.txt('Mines ' + (g.mines - g.flags) + '     Opened ' + g.opened + '/' + (g.bw * g.bh - g.mines), g.W / 2, g.oy - 18, 13, '#9db0e0');
      const bx = g.W / 2 - 80; Art.tile(c, bx, g.by0, 160, 50, g.mode ? '#e0a53a' : '#3a78e0', 16); if (g.mode) flagArt(c, bx + 36, g.by0 + 26, 14); else { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(bx + 30, g.by0 + 34); c.lineTo(bx + 42, g.by0 + 14); c.lineTo(bx + 46, g.by0 + 17); c.lineTo(bx + 36, g.by0 + 37); c.fill(); }
      g.txt(g.mode ? 'FLAG MODE' : 'DIG MODE', bx + 108, g.by0 + 27, 14, '#fff');
    } });
  function layout(g) { g.cs = Math.floor(Math.min((g.W - 24) / g.bw, (g.H - 250) / g.bh)); g.ox = Math.round((g.W - g.cs * g.bw) / 2); g.oy = 118 + Math.max(0, Math.round((g.H - 250 - g.cs * g.bh) / 2)); g.by0 = Math.min(g.H - 70, g.oy + g.cs * g.bh + 22); }
  function newBoard(g) { const [w, h, m] = SZ[Math.min(SZ.length - 1, g.board)]; g.board++; g.mark('w', g.board); g.bw = w; g.bh = h; g.mines = m + Math.max(0, g.board - SZ.length) * 2; g.mines = Math.min(g.mines, Math.floor(w * h * 0.24)); g.cell = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ open: false, flag: false, mine: false, n: 0 }))); g.first = true; g.opened = 0; g.flags = 0; g.bt = 0; layout(g); }
  function place(g, sr, sc) { const w = g.bw, h = g.bh; let mine = null; for (let t = 0; t < 400; t++) { mine = gen(w, h, g.mines, sr, sc, g.rnd); if (solvable(w, h, mine, sr, sc)) break; }
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) g.cell[r][c].mine = !!mine[r * w + c];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) g.cell[r][c].n = around(w, h, r, c).reduce((s, i) => s + mine[i], 0); }
  function nbs(g, r, c) { return around(g.bw, g.bh, r, c).map(i => [Math.floor(i / g.bw), i % g.bw]); }
  function act(g, r, c, alt) { const k = g.cell[r][c]; const flagging = alt !== (g.mode === 1); if (flagging) { if (k.open) return; k.flag = !k.flag; g.flags += k.flag ? 1 : -1; g.sfx('click'); return; } reveal(g, r, c); }
  function reveal(g, r, c) {
    if (g.first) { place(g, r, c); g.first = false; } const k = g.cell[r][c]; if (k.flag) return;
    if (k.open) { const nb = nbs(g, r, c); const f = nb.filter(([a, b]) => g.cell[a][b].flag).length; if (k.n && f === k.n) for (const [a, b] of nb) if (!g.cell[a][b].open && !g.cell[a][b].flag) { reveal(g, a, b); if (g.state !== 'play') return; } return; }
    if (k.mine) { k.open = true; k.flag = false; g.lives--; g.sfx('boom'); g.shake(10); g.flash('#ef4444'); g.burst(g.ox + c * g.cs + g.cs / 2, g.oy + r * g.cs + g.cs / 2, ['#ef4444', '#fbbf24'], 26, 240); g.flags++; if (g.lives <= 0) return g.end('Boom'); return; }
    const q = [[r, c]]; let n = 0; while (q.length) { const [a, b] = q.pop(); const z = g.cell[a][b]; if (z.open || z.flag) continue; z.open = true; n++; if (!z.n) for (const p of nbs(g, a, b)) if (!g.cell[p[0]][p[1]].open) q.push(p); }
    g.opened += n; g.add(n, 'p'); g.sfx('pop');
    if (g.opened >= g.bw * g.bh - g.mines) { const b = Math.max(50, Math.round(500 * g.board - g.bt * 5)); g.add(b, 'c'); g.float(g.W / 2, g.oy + 40, 'BOARD CLEAR +' + b, '#34d399', 24); g.sfx('line'); newBoard(g); }
  }
  function mineArt(c, x, y, r) { c.save(); c.translate(x, y); c.strokeStyle = '#2a2f45'; c.lineWidth = r * 0.28; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-r * 1.25, 0); c.lineTo(r * 1.25, 0); c.stroke(); } c.restore(); Art.orb(c, x, y, r, '#ff4d5e'); }
  function flagArt(c, x, y, s) { c.fillStyle = '#2a2f45'; c.fillRect(x - s * 0.5, y - s, s * 0.14, s * 1.9); c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(x - s * 0.36, y - s); c.lineTo(x + s * 0.8, y - s * 0.4); c.lineTo(x - s * 0.36, y + s * 0.1); c.fill(); c.fillStyle = '#2a2f45'; Art.rr(c, x - s * 0.8, y + s * 0.82, s * 1.3, s * 0.2, s * 0.1); c.fill(); }
})();
