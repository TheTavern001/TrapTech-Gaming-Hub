// Egg Roll - original egg-balancing hill drive (Hub build, shared hillcar.js) // @uses hillcar.js
HillCar({ id: 'gl-egg-roll', title: 'EGG ROLL', egg: true, flips: false, power: 380, help: 'Gas right side / Right, brake left / Left\nKeep the egg in the basket over the hills',
  theme: { sky1: '#7c2d12', sky2: '#fdba74', hill: '#a3e635', dirt: '#713f12', far: '#c2410c', sun: '#fde047' },
  body: (c) => { c.fillStyle = '#f97316'; Kit.rr(c, -44, -24, 88, 20, 6); c.fill(); c.strokeStyle = '#7c2d12'; c.lineWidth = 3; c.beginPath(); c.moveTo(-34, -24); c.lineTo(-30, -40); c.moveTo(34, -24); c.lineTo(30, -40); c.stroke(); c.fillStyle = '#0f172a'; c.fillRect(20, -38, 16, 14); } });
