// Neon Circuit — original endless arcade racer for The Gaming Hub.
// Controls: left/right arrows or A/D; touch the left/right sides on mobile.
Kit.run({
  id: 'gl-neon-circuit', title: 'NEON CIRCUIT', help: 'DODGE TRAFFIC · COLLECT ENERGY · SURVIVE THE CIRCUIT',
  orient: 'l', bg: '#050816',
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
      else {c.save();c.translate(x,y);c.scale(s,s);c.shadowColor='hsl('+o.hue+' 100% 60%)';c.shadowBlur=16;c.fillStyle='#17172c';c.strokeStyle='hsl('+o.hue+' 100% 65%)';c.lineWidth=2;c.beginPath();c.moveTo(-18,-24);c.lineTo(18,-24);c.lineTo(24,18);c.lineTo(-24,18);c.closePath();c.fill();c.stroke();c.fillStyle='hsl('+o.hue+' 100% 65%)';c.fillRect(-17,-18,34,4);c.fillStyle='#e8fbff';c.fillRect(-17,12,8,3);c.fillRect(9,12,8,3);c.restore();}
    }
    // player hover racer
    const x=W*(.25+g.player.lane*.25),y=H*.78;
    c.save();c.translate(x,y);c.rotate(g.player.tilt*.08);c.shadowColor='#36f7ff';c.shadowBlur=28;
    c.fillStyle='rgba(54,247,255,.16)';c.beginPath();c.ellipse(0,22,32,12,0,0,Math.PI*2);c.fill();
    const body=c.createLinearGradient(-20,-28,20,25);body.addColorStop(0,'#f6fbff');body.addColorStop(.35,'#36f7ff');body.addColorStop(1,'#6d28d9');
    c.fillStyle=body;c.strokeStyle='#e9ffff';c.lineWidth=2;c.beginPath();c.moveTo(0,-34);c.lineTo(19,-7);c.lineTo(24,19);c.lineTo(0,11);c.lineTo(-24,19);c.lineTo(-19,-7);c.closePath();c.fill();c.stroke();
    c.fillStyle='#fff';c.fillRect(-14,4,7,4);c.fillRect(7,4,7,4);c.fillStyle='#ff37e1';c.fillRect(-9,20,18,4);c.restore();
    c.fillStyle='rgba(4,7,25,.7)';c.fillRect(14,14,160,6);c.fillStyle='#b6ff42';c.fillRect(14,14,160*Math.min(1,g.energy/10),6);
    c.fillStyle='#c9faff';c.font='bold 12px sans-serif';c.fillText('ENERGY CELLS',14,10);
    c.fillStyle='rgba(255,255,255,.65)';c.font='11px sans-serif';c.fillText('← / A',W*.08,H-18);c.fillText('D / →',W*.82,H-18);
  }
});
