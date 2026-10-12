// Genuine WebGL avatar viewport. The saved avatar schema stays compatible with the server SVG fallback.
// Three.js is loaded lazily from a pinned public CDN; if WebGL/CDN is unavailable, the editor falls back to the SVG.
export async function mountAvatar3D(stage, cfg) {
  const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
  if (!stage || !stage.isConnected) return () => {};
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(Math.max(180, stage.clientWidth), Math.max(220, stage.clientHeight), false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional avatar preview. Drag to rotate. Focus the preview and use left/right arrows or A/D to rotate, plus or minus to zoom, and zero to reset.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;outline:none';
  stage.replaceChildren(renderer.domElement);

  const backgrounds = {
    violet: ['#7c3aed', '#22d3ee'], night: ['#0f172a', '#4338ca'], kush: ['#14532d', '#84cc16'],
    sunset: ['#f97316', '#db2777'], ocean: ['#0369a1', '#22d3ee'], haze: ['#6b21a8', '#f0abfc'],
    mono: ['#27272a', '#71717a'], toxic: ['#166534', '#facc15'], 'gold-rays': ['#78350f', '#facc15'],
    'cash-rain': ['#052e16', '#22c55e'], 'grow-room': ['#052e16','#15803d'], 'night-club': ['#1e1b4b','#db2777'],
    hospital: ['#e0f2fe','#38bdf8'], workshop: ['#292524','#f59e0b'], farm: ['#14532d','#a3e635'], studio: ['#111827','#7c3aed'], 'city-lights': ['#020617','#475569']
  };
  const bg = backgrounds[cfg.bg] || backgrounds.violet;
  const css = 'linear-gradient(145deg,' + bg[0] + ',' + bg[1] + ')';
  stage.style.background = css;
  scene.background = null;
  const portrait = stage.clientWidth < 150;
  const camera = new THREE.PerspectiveCamera(portrait ? 30 : 32, stage.clientWidth / Math.max(1, stage.clientHeight), 0.1, 50);
  const baseCamera = { y: portrait ? 2.45 : 1.9, z: portrait ? 4.8 : 7.5, targetY: portrait ? 2.2 : 1.55 };
  camera.position.set(0, baseCamera.y, baseCamera.z);
  camera.lookAt(0, baseCamera.targetY, 0);
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x202034, 2.0));
  const key = new THREE.DirectionalLight(0xfff0d8, 3.1); key.position.set(-3, 6, 5); key.castShadow = true; scene.add(key);
  const rim = new THREE.DirectionalLight(0x7dd3fc, 2.4); rim.position.set(4, 3, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xa78bfa, 1.4, 10); fill.position.set(2, 1, 4); scene.add(fill);

  const root = new THREE.Group(); scene.add(root);
  const builds = { average:[1,1,1], slim:[0.86,1.02,0.92], athletic:[1.06,1.04,1.02], stocky:[1.16,0.95,1.08], curvy:[1.08,1,1], tall:[0.96,1.14,0.96], short:[1.04,0.88,1.02] };
  root.scale.set(...(builds[cfg.build] || builds.average));
  const materials = new Set();
  function mat(color, roughness = 0.48, metalness = 0.02) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m;
  }
  const skinPalette = ['#f9d7b9','#f1c19b','#e0a679','#c98a5b','#a8693f','#8a5232','#6b3d22','#4a2915'];
  const hairPalette = ['#1b1b1f','#4a2f1d','#7b4a24','#c58b3c','#e8c46a','#d9d4cc','#c2410c','#7c3aed','#22d3ee','#16a34a'];
  const skin = skinPalette[Number(String(cfg.skin || 's2').slice(1))] || skinPalette[2];
  const hair = hairPalette[Number(String(cfg.hairc || 'c0').slice(1))] || hairPalette[0];
  const outfitColors = { tee:'#3b82f6', hoodie:'#334155', jersey:'#dc2626', tracksuit:'#111827', 'chain-tee':'#f8fafc', fur:'#d6d3d1', 'cannabis-hoodie':'#166534', dj:'#312e81', scrubs:'#0e7490', labcoat:'#f8fafc', mechanic:'#292524', hardhat:'#f59e0b', farmer:'#365314', suit:'#111827', tactical:'#374151', chef:'#f8fafc', firefighter:'#991b1b', varsity:'#7f1d1d', denim:'#1d4ed8', ranch:'#92400e', hype:'#db2777' };
  const shirt = outfitColors[cfg.outfit] || '#3b82f6';
  const presentation = ['male','female','other'].includes(cfg.gender) ? cfg.gender : 'other';
  const metal = mat('#d6a94f', 0.22, 0.86);
  function mesh(geometry, material, x, y, z, sx, sy, sz, target = root) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.scale.set(sx,sy,sz);
    m.castShadow = true; m.receiveShadow = true; target.add(m); return m;
  }
  function ball(x,y,z,sx,sy,sz,color,target=root,roughness=0.48,metalness=0.02) {
    return mesh(new THREE.SphereGeometry(1, 32, 24), mat(color,roughness,metalness), x,y,z,sx,sy,sz,target);
  }
  // Theme-specific 3D set dressing keeps backgrounds distinct without external art dependencies.
  const backdrop = new THREE.Group(); scene.add(backdrop);
  const neon = (x,y,z,r,color) => { const ring=mesh(new THREE.TorusGeometry(r,0.035,8,48),mat(color,0.25,0.55),x,y,z,1,1,1,backdrop); ring.rotation.y=0.12; return ring; };
  if (cfg.bg === 'night-club') { neon(0,2.05,-1.55,1.25,'#f472b6'); neon(0,2.05,-1.48,1.48,'#22d3ee'); neon(-1.05,1.0,-1.35,0.42,'#a78bfa'); neon(1.05,1.0,-1.35,0.42,'#facc15'); }
  if (cfg.bg === 'hospital') { mesh(new THREE.BoxGeometry(0.22,0.92,0.06),mat('#f8fafc',0.25,0),-1.08,2.0,-1.25,1,1,1,backdrop); mesh(new THREE.BoxGeometry(0.72,0.22,0.06),mat('#f8fafc',0.25,0),-1.08,2.0,-1.25,1,1,1,backdrop); }
  if (cfg.bg === 'workshop') { neon(-1.15,1.55,-1.2,0.48,'#f59e0b'); neon(1.12,2.4,-1.4,0.32,'#fb923c'); for(let i=0;i<5;i++) ball(-1.1+i*0.12,0.55+(i%2)*0.12,-1.1,0.025,0.10,0.025,'#fbbf24',backdrop); }
  if (cfg.bg === 'farm' || cfg.bg === 'grow-room') { for(let i=0;i<4;i++){ const x=-1.35+i*0.9; mesh(new THREE.CylinderGeometry(0.025,0.035,0.70,8),mat('#15803d'),x,0.55,-1.2,1,1,1,backdrop); ball(x-0.12,0.72,-1.2,0.15,0.06,0.035,cfg.bg==='farm'?'#a3e635':'#4ade80',backdrop); ball(x+0.12,0.84,-1.2,0.15,0.06,0.035,cfg.bg==='farm'?'#84cc16':'#22c55e',backdrop); } }
  if (cfg.bg === 'studio') { neon(-1.15,2.1,-1.4,0.42,'#a78bfa'); neon(1.15,2.1,-1.4,0.62,'#c4b5fd'); }
  if (cfg.bg === 'city-lights') { for(let i=0;i<18;i++){ const x=-1.7+(i%6)*0.68; const y=0.55+Math.floor(i/6)*0.72; ball(x,y,-1.4,0.035,0.035,0.035,i%3===0?'#facc15':i%3===1?'#38bdf8':'#f472b6',backdrop,0.25,0.4); } }
  if (cfg.bg === 'cash-rain') { for(let i=0;i<8;i++){ const bill=mesh(new THREE.BoxGeometry(0.15,0.075,0.025),mat('#16a34a',0.6,0),-1.45+(i%4)*0.9,0.65+Math.floor(i/4)*1.15,-1.1,1,1,1,backdrop); bill.rotation.z=(i%2?0.3:-0.3); } }
  if (cfg.bg === 'gold-rays') { neon(0,2.0,-1.55,1.48,'#facc15'); neon(0,2.0,-1.5,1.18,'#fef3c7'); }
  const floor = mesh(new THREE.CircleGeometry(2.3, 64), mat('#111827',0.8,0), 0,0.02,0,1,1,1,scene);
  floor.rotation.x = -Math.PI / 2;
  ball(-0.24,0.66,0,0.20,0.68,0.22,shirt); ball(0.24,0.66,0,0.20,0.68,0.22,shirt);
  ball(-0.24,0.16,0.02,0.19,0.14,0.25,'#111827'); ball(0.24,0.16,0.02,0.19,0.14,0.25,'#111827');
  const torso = ball(0,1.45,0,presentation === 'male' ? 0.66 : presentation === 'female' ? 0.54 : 0.60,0.75,0.34,shirt);
  ball(0,1.00,0,presentation === 'female' ? 0.43 : 0.36,0.30,0.29,shirt); // pelvis/waist silhouette
  if (presentation === 'female') { ball(-0.19,1.62,0.28,0.22,0.20,0.10,shirt); ball(0.19,1.62,0.28,0.22,0.20,0.10,shirt); }
  ball(0,2.05,0,0.19,0.26,0.18,skin);
  ball(-0.72,1.55,0,presentation === 'male' ? 0.21 : 0.17,0.56,0.20,shirt).rotation.z = -0.14;
  ball(0.72,1.55,0,presentation === 'male' ? 0.21 : 0.17,0.56,0.20,shirt).rotation.z = 0.14;
  ball(-0.75,0.98,0.02,0.15,0.16,0.16,skin); ball(0.75,0.98,0.02,0.15,0.16,0.16,skin);
  const head = new THREE.Group(); root.add(head); head.position.set(0,2.62,0);
  const faceScale = cfg.face === 'square' || (presentation === 'male' && cfg.face !== 'round') ? [0.56,0.60,0.48] : cfg.face === 'round' ? [0.54,0.53,0.46] : presentation === 'female' ? [0.48,0.62,0.42] : [0.50,0.61,0.44];
  ball(0,0,0,...faceScale,skin,head);
  ball(-0.51,-0.02,0,0.10,0.16,0.12,skin,head); ball(0.51,-0.02,0,0.10,0.16,0.12,skin,head);
  ball(0,-0.08,0.425,0.075,0.12,0.08,skin,head);
  const eyeWhite = mat('#f8fafc',0.25,0); const pupil = mat('#10131d',0.18,0);
  for (const x of [-0.19,0.19]) {
    ball(x,0.06,0.394,0.095,0.075,0.045,'#f8fafc',head,0.28);
    ball(x,-0.005,0.432,0.039,0.046,0.024,'#111827',head,0.2);
    ball(x-0.012,0.012,0.45,0.012,0.014,0.008,'#ffffff',head,0.2);
    ball(x,0.19,0.37,0.12,0.025,0.035,hair,head);
  }
  if (cfg.eyes === 'sleepy') { for (const x of [-0.19,0.19]) ball(x,0.055,0.44,0.09,0.018,0.012,hair,head); }
  if (cfg.eyes === 'wink') ball(0.19,0.06,0.44,0.09,0.018,0.012,hair,head);
  if (cfg.eyes === 'star') {
    const starMat = mat('#facc15',0.28,0.12);
    for (const x of [-0.19,0.19]) { const st = mesh(new THREE.OctahedronGeometry(0.07,0),starMat,x,0.06,0.445,1,1,0.35,head); st.rotation.z=Math.PI/4; }
  }
  const mouthMat = mat(cfg.mouth === 'flat' ? '#7f1d1d' : '#7c2430',0.45,0);
  if (cfg.mouth === 'flat') ball(0,-0.25,0.405,0.12,0.018,0.018,mouthMat.color,head);
  else if (cfg.mouth === 'open') ball(0,-0.24,0.412,0.09,0.10,0.025,'#501b27',head);
  else {
    const mouth = mesh(new THREE.TorusGeometry(cfg.mouth === 'grin' ? 0.13 : 0.09,0.018,8,24,Math.PI),mouthMat,0,-0.22,0.405,1,1,1,head);
    mouth.rotation.z = Math.PI;
  }
  const hairStyle = cfg.hair || 'short';
  if (hairStyle !== 'none') {
    if (['buzz','waves'].includes(hairStyle)) ball(0,0.34,0,0.51,0.24,0.44,hair,head);
    else if (hairStyle === 'afro') ball(0,0.38,0,0.62,0.40,0.55,hair,head);
    else if (hairStyle === 'mohawk') {
      ball(0,0.38,0,0.13,0.42,0.18,hair,head);
      for(let i=0;i<5;i++) ball(0,0.28+i*0.075,0.02,0.14,0.11,0.15,hair,head);
    } else if (hairStyle === 'long' || hairStyle === 'braids') {
      ball(0,0.30,-0.03,0.52,0.28,0.46,hair,head);
      ball(-0.46,-0.18,-0.02,0.13,0.43,0.14,hair,head); ball(0.46,-0.18,-0.02,0.13,0.43,0.14,hair,head);
      if (hairStyle === 'braids') for (const x of [-0.46,0.46]) for(let i=0;i<4;i++) ball(x,-0.22-i*0.09,0.07,0.10,0.06,0.11,hair,head);
    } else if (hairStyle === 'bun') {
      ball(0,0.32,0,0.50,0.22,0.42,hair,head); ball(0,0.56,-0.15,0.19,0.19,0.18,hair,head);
    } else if (hairStyle === 'spiky') {
      ball(0,0.31,0,0.48,0.20,0.42,hair,head);
      for(let i=0;i<7;i++){ const x=-0.38+i*0.125; const p=ball(x,0.48+(i%2)*0.08,0.02,0.10,0.22,0.10,hair,head); p.rotation.z=(i-3)*-0.16; }
    } else if (hairStyle === 'curly') {
      ball(0,0.30,0,0.48,0.22,0.42,hair,head);
      for(let i=0;i<11;i++){ const a=i/11*Math.PI*2; ball(Math.cos(a)*0.42,0.34+Math.sin(i*2.3)*0.06,Math.sin(a)*0.35,0.13,0.14,0.13,hair,head); }
    } else { ball(0,0.32,0,0.51,0.25,0.45,hair,head); }
  }
  const beard = cfg.beard || 'none';
  if (beard === 'mustache') { ball(-0.09,-0.17,0.43,0.12,0.05,0.035,hair,head); ball(0.09,-0.17,0.43,0.12,0.05,0.035,hair,head); }
  if (beard === 'goatee' || beard === 'beard') ball(0,-0.34,0.34,beard === 'beard' ? 0.40 : 0.16,0.16,0.14,hair,head);
  if (cfg.hat === 'beanie') { ball(0,0.47,0,0.52,0.20,0.46,'#b91c1c',head); ball(0,0.62,0,0.09,0.08,0.08,'#f8fafc',head); }
  if (cfg.hat === 'snapback' || cfg.hat === 'bucket') { ball(0,0.43,0,0.54,0.16,0.46,cfg.hat === 'bucket' ? '#d1d5db' : '#1d4ed8',head); ball(0,-0.01,0.39,0.42,0.045,0.22,cfg.hat === 'bucket' ? '#9ca3af' : '#1e40af',head); }
  if (cfg.hat === 'halo') { const halo=mesh(new THREE.TorusGeometry(0.37,0.045,10,40),mat('#facc15',0.22,0.72),0,0.78,0,1,1,1,head); halo.rotation.x=0.1; }
  if (cfg.hat === 'crown') { const crown=mesh(new THREE.CylinderGeometry(0.32,0.40,0.22,8,1),metal,0,0.54,0,1,1,1,head); for(let i=0;i<5;i++) ball(-0.27+i*0.135,0.70,0,0.045,0.12,0.045,'#facc15',head,0.2,0.7); }
  if (cfg.hat === 'hardhat') { mesh(new THREE.SphereGeometry(0.46,18,10,0,Math.PI*2,0,Math.PI/2),mat('#facc15',0.25,0.15),0,0.50,0,1,0.48,1,head); mesh(new THREE.CylinderGeometry(0.47,0.47,0.045,24),mat('#f59e0b'),0,0.43,0,1,1,1,head); }
  if (cfg.hat === 'cowboy') { mesh(new THREE.CylinderGeometry(0.68,0.68,0.06,24),mat('#92400e'),0,0.42,0,1,1,1,head); ball(0,0.53,0,0.42,0.20,0.39,'#a16207',head); }
  if (cfg.hat === 'chef-hat') { ball(0,0.55,0,0.42,0.28,0.39,'#f8fafc',head); mesh(new THREE.CylinderGeometry(0.43,0.43,0.08,20),mat('#e5e7eb'),0,0.42,0,1,1,1,head); }
  if (cfg.hat === 'scrub-cap') { ball(0,0.47,0,0.50,0.12,0.43,'#0e7490',head); ball(0,0.54,0,0.30,0.10,0.25,'#38bdf8',head); }
  if (cfg.hat === 'dj-cap') { ball(0,0.46,0,0.53,0.15,0.44,'#312e81',head); ball(0,0.38,0.37,0.38,0.045,0.16,'#4f46e5',head); }
  if (cfg.acc === 'glasses' || cfg.acc === 'shades') {
    const lens = mat(cfg.acc === 'shades' ? '#111827' : '#93c5fd',0.22,0.25);
    for (const x of [-0.19,0.19]) { const g=mesh(new THREE.BoxGeometry(0.30,0.19,0.045),lens,x,0.06,0.45,1,1,1,head); g.material.transparent=cfg.acc==='glasses'; g.material.opacity=cfg.acc==='glasses'?0.62:1; const frame=mesh(new THREE.BoxGeometry(0.33,0.035,0.05),metal,x,0.16,0.45,1,1,1,head); }
    mesh(new THREE.BoxGeometry(0.10,0.035,0.045),metal,0,0.07,0.45,1,1,1,head);
  }
  if (cfg.acc === 'grill') for(let i=0;i<5;i++) ball(-0.08+i*0.04,-0.25,0.435,0.019,0.035,0.018,'#fef08a',head,0.18,0.7);
  if (cfg.acc === 'bandana') { ball(0,0.25,0.43,0.46,0.13,0.055,'#dc2626',head); ball(0.28,0.20,0.42,0.07,0.13,0.035,'#b91c1c',head); }
  if (cfg.acc === 'mask') { ball(0,-0.19,0.44,0.33,0.16,0.06,'#e0f2fe',head); mesh(new THREE.BoxGeometry(0.72,0.025,0.025),mat('#bae6fd'),0,-0.12,0.40,1,1,1,head); }
  if (cfg.acc === 'earrings') { ball(-0.43,-0.14,0.39,0.07,0.10,0.06,'#facc15',head,0.2,0.7); ball(0.43,-0.14,0.39,0.07,0.10,0.06,'#facc15',head,0.2,0.7); }
  if (cfg.acc === 'leaf-chain') { const chain=mesh(new THREE.TorusGeometry(0.30,0.028,8,32),mat('#facc15',0.2,0.75),0,-0.24,0.36,1,0.85,1,head); chain.rotation.x=0.25; ball(0,-0.48,0.42,0.09,0.12,0.03,'#4ade80',head); ball(-0.06,-0.48,0.43,0.05,0.08,0.025,'#166534',head); }
  if (cfg.acc === 'stethoscope') { const st=mesh(new THREE.TorusGeometry(0.22,0.025,8,24),mat('#0f172a'),0,-0.20,0.36,1,0.8,1,head); st.rotation.x=0.4; ball(0.18,-0.42,0.42,0.05,0.06,0.035,metal,head); }
  if (cfg.outfit === 'chain-tee') { const chain=mesh(new THREE.TorusGeometry(0.23,0.025,8,32),metal,0,1.86,0.28,1,0.65,1); chain.rotation.x=0.2; }
  if (cfg.outfit === 'cannabis-hoodie') { ball(0,1.48,0.31,0.20,0.19,0.035,'#a3e635'); ball(0,1.48,0.35,0.10,0.12,0.018,'#14532d'); }
  if (cfg.outfit === 'dj') { const stripe=mat('#f472b6',0.25,0.2); ball(0,1.46,0.32,0.035,0.52,0.025,'#f472b6'); }
  if (cfg.outfit === 'scrubs' || cfg.outfit === 'labcoat' || cfg.outfit === 'chef') { ball(0.18,1.40,0.32,0.035,0.32,0.025,'#dbeafe'); ball(-0.18,1.40,0.32,0.035,0.32,0.025,'#dbeafe'); if(cfg.outfit==='labcoat') ball(0,1.32,0.35,0.08,0.09,0.025,'#0f766e'); }
  if (cfg.outfit === 'mechanic' || cfg.outfit === 'hardhat' || cfg.outfit === 'farmer' || cfg.outfit === 'firefighter' || cfg.outfit === 'ranch') { const trim = cfg.outfit === 'firefighter' ? '#fbbf24' : '#facc15'; ball(0,1.46,0.34,0.50,0.045,0.025,trim); ball(0,1.16,0.34,0.40,0.035,0.025,trim); }
  if (cfg.outfit === 'suit') { ball(0,1.53,0.32,0.10,0.40,0.035,'#f8fafc'); ball(0,1.30,0.37,0.045,0.20,0.02,'#dc2626'); }
  if (cfg.outfit === 'tactical') { ball(-0.22,1.50,0.33,0.11,0.15,0.04,'#111827'); ball(0.22,1.50,0.33,0.11,0.15,0.04,'#111827'); }
  if (cfg.outfit === 'varsity' || cfg.outfit === 'denim' || cfg.outfit === 'hype') { ball(0,1.48,0.34,0.035,0.52,0.025,cfg.outfit==='hype'?'#facc15':'#e5e7eb'); }
  if (cfg.outfit === 'fur') { ball(-0.42,1.55,0.02,0.22,0.70,0.38,'#e5e7eb'); ball(0.42,1.55,0.02,0.22,0.70,0.38,'#e5e7eb'); }
  if (cfg.held === 'controller') {
    ball(0.73,0.87,0.12,0.20,0.10,0.08,'#111827');
    ball(0.67,0.87,0.20,0.045,0.045,0.02,'#ef4444'); ball(0.80,0.87,0.20,0.045,0.045,0.02,'#22c55e');
  }
  if (cfg.held === 'cane') { const cane=mesh(new THREE.CylinderGeometry(0.035,0.035,0.95,12),metal,0.90,0.52,0.08,1,1,1); ball(0.90,1.02,0.08,0.11,0.11,0.10,'#facc15'); }
  if (cfg.held === 'cash') { for(let i=0;i<4;i++) { const bill=mesh(new THREE.BoxGeometry(0.17,0.10,0.018),mat('#16a34a',0.6,0),0.84+i*0.025,0.94+i*0.018,0.08+i*0.018,1,1,1); bill.rotation.z=0.2; } }
  if (cfg.held === 'microphone') { ball(0.84,0.96,0.08,0.07,0.09,0.07,'#111827'); mesh(new THREE.CylinderGeometry(0.025,0.025,0.38,12),metal,0.84,0.72,0.08,1,1,1); }
  if (cfg.held === 'wrench') { mesh(new THREE.CylinderGeometry(0.035,0.035,0.62,10),mat('#cbd5e1',0.24,0.85),0.86,0.76,0.08,1,1,1); ball(0.86,1.08,0.08,0.09,0.07,0.04,'#cbd5e1',root,0.24,0.85); }
  if (cfg.held === 'sprout') { mesh(new THREE.CylinderGeometry(0.018,0.03,0.35,8),mat('#16a34a'),0.84,0.80,0.08,1,1,1); ball(0.78,0.95,0.08,0.09,0.05,0.03,'#4ade80'); ball(0.91,0.95,0.08,0.09,0.05,0.03,'#86efac'); }
  if (cfg.held === 'stethoscope') { const st=mesh(new THREE.TorusGeometry(0.14,0.025,8,24),mat('#0f172a'),0.78,0.96,0.13,1,1,1); st.rotation.x=0.5; ball(0.91,0.83,0.16,0.06,0.06,0.04,metal); }
  if (cfg.held === 'pitchfork') { mesh(new THREE.CylinderGeometry(0.022,0.022,0.78,8),mat('#92400e'),0.86,0.78,0.08,1,1,1); for(let i=0;i<3;i++) mesh(new THREE.CylinderGeometry(0.012,0.012,0.28,6),metal,0.80+i*0.06,1.18,0.08,1,1,1); }
  if (cfg.held === 'syringe') { mesh(new THREE.CylinderGeometry(0.045,0.045,0.30,12),mat('#e0f2fe',0.2,0),0.86,0.80,0.08,1,1,1); mesh(new THREE.CylinderGeometry(0.01,0.01,0.18,6),metal,0.86,1.04,0.08,1,1,1); }
  if (cfg.held === 'headphones') { const hp=mesh(new THREE.TorusGeometry(0.34,0.045,10,32,Math.PI),mat('#111827'),0,2.92,0,1,1,1,head); hp.rotation.z=Math.PI; ball(-0.38,0.08,0.02,0.09,0.13,0.08,'#f472b6',head); ball(0.38,0.08,0.02,0.09,0.13,0.08,'#f472b6',head); }
  if (cfg.held === 'toolbox') { mesh(new THREE.BoxGeometry(0.38,0.25,0.22),mat('#dc2626'),0.82,0.88,0.10); mesh(new THREE.BoxGeometry(0.16,0.05,0.04),metal,0.82,1.04,0.22); }
  if (cfg.held === 'laptop') { mesh(new THREE.BoxGeometry(0.40,0.28,0.035),mat('#1f2937'),0.82,0.88,0.13); mesh(new THREE.BoxGeometry(0.46,0.035,0.28),mat('#94a3b8'),0.82,0.72,0.14); ball(0.82,0.88,0.155,0.13,0.07,0.012,'#7c3aed'); }
  if (cfg.held === 'briefcase' || cfg.held === 'medical-bag') { const color=cfg.held==='medical-bag'?'#f8fafc':'#92400e'; mesh(new THREE.BoxGeometry(0.38,0.30,0.20),mat(color),0.82,0.86,0.10); mesh(new THREE.BoxGeometry(0.16,0.06,0.035),metal,0.82,1.04,0.22); if(cfg.held==='medical-bag') ball(0.82,0.86,0.22,0.045,0.12,0.02,'#dc2626'); }
  if (cfg.held === 'camera') { mesh(new THREE.BoxGeometry(0.32,0.24,0.18),mat('#111827'),0.82,0.88,0.10); mesh(new THREE.CylinderGeometry(0.08,0.08,0.10,16),mat('#64748b'),0.82,0.88,0.23,1,1,1); }
  if (cfg.held === 'paintbrush') { mesh(new THREE.CylinderGeometry(0.025,0.025,0.42,8),mat('#92400e'),0.84,0.76,0.08,1,1,1); mesh(new THREE.ConeGeometry(0.07,0.16,8),mat('#f472b6'),0.84,1.03,0.08,1,1,1); }
  if (cfg.held === 'spray-can') { mesh(new THREE.CylinderGeometry(0.075,0.075,0.34,12),mat('#7c3aed'),0.84,0.82,0.08,1,1,1); mesh(new THREE.CylinderGeometry(0.03,0.03,0.06,8),metal,0.84,1.02,0.08,1,1,1); }
  if (cfg.held === 'cash-bag') { ball(0.84,0.84,0.08,0.20,0.22,0.16,'#16a34a'); ball(0.84,1.02,0.08,0.09,0.05,0.06,'#facc15'); }
  if (cfg.held === 'flower') { mesh(new THREE.CylinderGeometry(0.02,0.025,0.40,8),mat('#15803d'),0.84,0.76,0.08,1,1,1); for(let j=0;j<5;j++) ball(0.84+Math.cos(j*Math.PI*2/5)*0.07,1.02+Math.sin(j*Math.PI*2/5)*0.07,0.08,0.06,0.06,0.04,'#f472b6'); ball(0.84,1.02,0.09,0.035,0.035,0.025,'#facc15'); }

  const pointer = { down:false, x:0, y:0, rot:0, tilt:0 };
  const down = (e) => { pointer.down=true; pointer.rot=root.rotation.y; pointer.tilt=root.rotation.x; pointer.x=e.clientX; pointer.y=e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if(!pointer.down) return; pointer.rot += (e.clientX-pointer.x)*0.012; pointer.tilt = Math.max(-0.20,Math.min(0.20,pointer.tilt+(e.clientY-pointer.y)*0.003)); pointer.x=e.clientX; pointer.y=e.clientY; root.rotation.y=pointer.rot; root.rotation.x=pointer.tilt; };
  const up = () => { pointer.down=false; };
  const zoom = (delta) => { camera.position.z = Math.max(3.2, Math.min(11, camera.position.z + delta)); camera.lookAt(0, baseCamera.targetY, 0); };
  const resetView = () => { pointer.rot = 0; pointer.tilt = 0; root.rotation.set(0, 0, 0); camera.position.set(0, baseCamera.y, baseCamera.z); camera.lookAt(0, baseCamera.targetY, 0); };
  const keydown = (e) => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') { e.preventDefault(); root.rotation.y -= 0.16; pointer.rot = root.rotation.y; }
    else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') { e.preventDefault(); root.rotation.y += 0.16; pointer.rot = root.rotation.y; }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(-0.45); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoom(0.45); }
    else if (e.key === '0') { e.preventDefault(); resetView(); }
  };
  renderer.domElement.addEventListener('pointerdown',down);
  renderer.domElement.addEventListener('pointermove',move);
  renderer.domElement.addEventListener('pointerup',up);
  renderer.domElement.addEventListener('pointercancel',up);
  renderer.domElement.addEventListener('keydown',keydown);
  const resize = () => { if(!stage.isConnected) return; const w=Math.max(180,stage.clientWidth), h=Math.max(220,stage.clientHeight); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if(observer) observer.observe(stage); else window.addEventListener('resize',resize);
  let frame=0, alive=true, cleanup=null;
  const animate = (t) => { if(!alive) return; if(!stage.isConnected && cleanup) { cleanup(); return; } frame=requestAnimationFrame(animate); if(!pointer.down && !reduced) root.rotation.y += 0.0012; torso.scale.y=0.75+(reduced?0:Math.sin(t*0.0015)*0.008); renderer.render(scene,camera); };
  frame=requestAnimationFrame(animate);
  cleanup = () => {
    if(!alive) return; alive=false; cancelAnimationFrame(frame); if(observer) observer.disconnect(); else window.removeEventListener('resize',resize);
    renderer.domElement.removeEventListener('pointerdown',down); renderer.domElement.removeEventListener('pointermove',move); renderer.domElement.removeEventListener('pointerup',up); renderer.domElement.removeEventListener('pointercancel',up); renderer.domElement.removeEventListener('keydown',keydown);
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();}); materials.forEach(m=>m.dispose()); renderer.dispose(); renderer.domElement.remove();
  };
  cleanup.zoomIn = () => zoom(-0.45); cleanup.zoomOut = () => zoom(0.45); cleanup.resetView = resetView;
  return cleanup;
}
