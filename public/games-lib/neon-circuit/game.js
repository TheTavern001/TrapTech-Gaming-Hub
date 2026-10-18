// Neon Circuit — original endless arcade racer for The Gaming Hub.
// Controls: left/right arrows or A/D; touch the left/right sides on mobile.
// original rear-view synthwave car art (code-drawn)
function rearCar(c, hue, t, me) { const H = (l, a) => 'hsla(' + hue + ',100%,' + l + '%,' + (a == null ? 1 : a) + ')';
  c.save(); c.globalCompositeOperation = 'lighter'; const ug = c.createRadialGradient(0, 20, 4, 0, 20, 44); ug.addColorStop(0, H(60, .55)); ug.addColorStop(1, H(60, 0)); c.fillStyle = ug; c.beginPath(); c.ellipse(0, 20, 44, 18, 0, 0, 7); c.fill(); c.restore();
  c.fillStyle = '#05060f'; for (const sx of [-1, 1]) { c.beginPath(); c.roundRect(sx * 22 - 5, 2, 10, 20, 3); c.fill(); }
  c.shadowColor = H(60); c.shadowBlur = 14; const bg = c.createLinearGradient(0, -24, 0, 20); bg.addColorStop(0, '#2b2d52'); bg.addColorStop(.5, '#14152b'); bg.addColorStop(1, '#0a0a18'); c.fillStyle = bg; c.strokeStyle = H(65); c.lineWidth = 2;
  c.beginPath(); c.moveTo(-26, 16); c.lineTo(-24, 0); c.lineTo(-15, -10); c.lineTo(-11, -22); c.lineTo(11, -22); c.lineTo(15, -10); c.lineTo(24, 0); c.lineTo(26, 16); c.closePath(); c.fill(); c.stroke(); c.shadowBlur = 0;
  const gl = c.createLinearGradient(0, -20, 0, -6); gl.addColorStop(0, H(75, .9)); gl.addColorStop(1, H(30, .9)); c.fillStyle = gl; c.beginPath(); c.moveTo(-9, -19); c.lineTo(9, -19); c.lineTo(12, -8); c.lineTo(-12, -8); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(-7, -18); c.lineTo(-2, -18); c.lineTo(-6, -9); c.lineTo(-10, -9); c.closePath(); c.fill();
  c.fillStyle = '#ff2a4d'; c.shadowColor = '#ff2a4d'; c.shadowBlur = me ? 16 : 10; c.fillRect(-23, 1, 15, 4); c.fillRect(8, 1, 15, 4); c.fillRect(-8, 2, 16, 2); c.shadowBlur = 0;
  c.fillStyle = H(60); c.fillRect(-22, 8, 44, 2); c.fillStyle = '#e8fbff'; c.fillRect(-9, 11, 18, 5); c.fillStyle = '#111'; c.fillRect(-7, 12, 14, 3);
  if (me) { c.fillStyle = H(65); c.beginPath(); c.moveTo(-20, -2); c.lineTo(-30, -9); c.lineTo(-27, 4); c.closePath(); c.fill(); c.beginPath(); c.moveTo(20, -2); c.lineTo(30, -9); c.lineTo(27, 4); c.closePath(); c.fill(); c.save(); c.globalCompositeOperation = 'lighter'; for (const sx of [-7, 7]) { const fl = 10 + Math.sin(t * 40 + sx) * 4; const fg = c.createLinearGradient(0, 16, 0, 16 + fl); fg.addColorStop(0, 'rgba(255,200,80,.9)'); fg.addColorStop(1, 'rgba(255,60,200,0)'); c.fillStyle = fg; c.fillRect(sx - 3, 16, 6, fl); } c.restore(); } }
Kit.run({
  id: 'gl-neon-circuit', title: 'NEON CIRCUIT', help: 'DODGE TRAFFIC · COLLECT ENERGY · SURVIVE THE CIRCUIT',
  fill: true, minH: 560, maxH: 900, bg: '#050816',
  init(g) {
    g.player = { lane: 1, x: 0, y: 0, tilt: 0 };
    g.speed = 0.38; g.distance = 0; g.energy = 0; g.combo = 0;
    g.traffic = []; g.pulses = []; g.spawn = 0; g.lanes = [-1, 0, 1];
    g.stars = Array.from({length: 90}, () => ({x:g.R(0,g.W),y:g.R(0,g.H),z:g.R(.2,1)}));
    g.lastLane = 1; g.nearMiss = 0;
  },
  update(g, dt) {
    const p = g.player; g.distance += dt * g.speed * 100;
    g.speed = Math.min(.95, .38 + g.distance / 18000);
    if (g.kd('ArrowLeft') || g.kd('a') || (g.ptr.pressed && g.ptr.x < g.W * .36)) { p.lane = Math.max(0, p.lane - 1); p.tilt = -1; }
    if (g.kd('ArrowRight') || g.kd('d') || (g.ptr.pressed && g.ptr.x > g.W * .64)) { p.lane = Math.min(2, p.lane + 1); p.tilt = 1; }
    if (p.lane !== g.lastLane) { g.lastLane = p.lane; g.sfx('click'); g.burst(g.W * (.25 + p.lane * .25), g.H * .78, '#36f7ff', 8); }
    g.spawn += dt * (0.7 + g.speed * 1.5);
    while (g.spawn > 1) {
      g.spawn--;
      const lane = Math.floor(g.R(0,3));
      g.traffic.push({lane, z:0, kind:g.rnd()<.23?'energy':'car', hue:Math.floor(g.R(0,360)), passed:false});
    }
    const px = g.W * (.25 + p.lane * .25), py = g.H * .77;
    for (const o of g.traffic) {
      o.z += dt * (.3 + g.speed * .45);
      const y = g.H * (.15 + o.z * .75);
      if (!o.passed && o.z > .78) {
        o.passed = true;
        if (o.lane === p.lane) {
          if (o.kind === 'energy') { g.energy++; g.combo++; const pts=25+Math.min(100,g.combo*5); g.add(pts,'e'); g.sfx('coin'); g.burst(px,py,'#b6ff42',18); }
          else { g.shake(8, .35); g.sfx('bad'); return g.end('CIRCUIT CRASH'); }
        } else if (Math.abs(o.lane-p.lane)===1 && o.kind==='car') { g.nearMiss++; g.combo++; g.add(5,'n'); }
        else g.combo=0;
      }
    }
    g.traffic = g.traffic.filter(o=>o.z<1.15);
    for (const s of g.stars) { s.y += dt*(15+s.z*60)*g.speed; if(s.y>g.H){s.y=0;s.x=g.R(0,g.W);} }
    g.hud = 'DIST ' + Math.floor(g.distance) + ' m   ENERGY ' + g.energy + '   COMBO x' + Math.min(10,1+Math.floor(g.combo/3));
  },
  draw(g,c) {
    const W=g.W,H=g.H;
    const bg=c.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#050816');bg.addColorStop(.6,'#10153a');bg.addColorStop(1,'#210c38');c.fillStyle=bg;c.fillRect(0,0,W,H);
    for(const s of g.stars){c.globalAlpha=.25+s.z*.65;c.fillStyle='#a9f8ff';c.fillRect(s.x,s.y,s.z*2,s.z*2);}c.globalAlpha=1;
    // Futuristic skyline and horizon glow
    c.save(); c.shadowBlur=22;c.shadowColor='#6d28d9';c.fillStyle='#120e31';
    for(let i=0;i<18;i++){const x=i*W/17, bh=25+(i*37%65);c.fillRect(x,H*.28-bh, W/24,bh);for(let j=0;j<3;j++){c.fillStyle='rgba(54,247,255,.35)';c.fillRect(x+5,H*.28-bh+8+j*10,3,4);c.fillStyle='#120e31';}}
    c.restore();
    c.strokeStyle='rgba(54,247,255,.18)';c.lineWidth=1;
    for(let i=0;i<=12;i++){const t=i/12,y=H*.3+t*t*H*.7;c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    for(let i=-5;i<=5;i++){c.strokeStyle=i%2?'rgba(54,247,255,.18)':'rgba(255,55,225,.28)';c.beginPath();c.moveTo(W/2+i*8,H*.3);c.lineTo(W/2+i*W*.14,H);c.stroke();}
    // road shoulders and lane dividers
    c.strokeStyle='#36f7ff';c.lineWidth=3;c.shadowBlur=15;c.shadowColor='#36f7ff';
    for(const side of [-1,1]){c.beginPath();c.moveTo(W/2+side*W*.06,H*.3);c.lineTo(W/2+side*W*.43,H);c.stroke();}
    for(const lane of [1,2]){c.strokeStyle='rgba(255,55,225,.6)';c.lineWidth=2;c.beginPath();c.moveTo(W/2+(lane-1.5)*W*.04,H*.3);c.lineTo(W/2+(lane-1.5)*W*.25,H);c.stroke();}
    c.shadowBlur=0;
    // traffic objects scale toward the player
    for(const o of g.traffic){const z=o.z,x=W*(.25+o.lane*.25),y=H*(.15+z*.75),s=.2+z*.95;
      if(o.kind==='energy'){c.save();c.translate(x,y);c.rotate(g.t*2);c.shadowColor='#b6ff42';c.shadowBlur=18;c.strokeStyle='#b6ff42';c.lineWidth=3*s;c.beginPath();c.moveTo(0,-15*s);c.lineTo(12*s,0);c.lineTo(0,15*s);c.lineTo(-12*s,0);c.closePath();c.stroke();c.restore();}
      else { c.save(); c.translate(x, y); c.scale(s, s); rearCar(c, o.hue, g.t, false); c.restore(); }
    }
    // player hover racer
    const x=W*(.25+g.player.lane*.25),y=H*.78;
    c.save(); c.translate(x, y); c.rotate(g.player.tilt * .08); c.scale(1.25, 1.25); rearCar(c, 185, g.t, true); c.restore();
    c.fillStyle='rgba(4,7,25,.7)';c.fillRect(14,14,160,6);c.fillStyle='#b6ff42';c.fillRect(14,14,160*Math.min(1,g.energy/10),6);
    c.fillStyle='#c9faff';c.font='bold 12px sans-serif';c.fillText('ENERGY CELLS',14,10);
    c.fillStyle='rgba(255,255,255,.65)';c.font='11px sans-serif';c.fillText('← / A',W*.08,H-18);c.fillText('D / →',W*.82,H-18);
  }
});
