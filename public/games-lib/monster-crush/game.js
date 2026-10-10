// Monster Crush - original monster-truck car-crushing hill drive (Hub build, shared hillcar.js) // @uses hillcar.js
HillCar({ id: 'gl-monster-crush', title: 'MONSTER CRUSH', crush: true, wheelR: 26, base: 84, power: 600, fuel: true, headH: 52, help: 'Gas right side / Right, brake left / Left\nLand on cars to crush them - flips pay big',
  theme: { sky1: '#1e1b4b', sky2: '#7c3aed', hill: '#57534e', dirt: '#292524', far: '#312e81' },
  body: (c) => { c.fillStyle = '#16a34a'; Kit.rr(c, -50, -54, 100, 30, 8); c.fill(); c.fillStyle = '#15803d'; c.fillRect(-10, -76, 40, 24); c.fillStyle = '#bae6fd'; c.fillRect(-4, -72, 30, 14); c.fillStyle = '#facc15'; c.fillRect(-50, -42, 100, 6); c.fillStyle = '#374151'; c.fillRect(-36, -26, 8, 26); c.fillRect(28, -26, 8, 26); } });
