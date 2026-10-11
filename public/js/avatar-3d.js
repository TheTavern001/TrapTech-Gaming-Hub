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
  renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional avatar preview. Drag to rotate.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;outline:none';
  stage.replaceChildren(renderer.domElement);

  const backgrounds = {
    violet: ['#7c3aed', '#22d3ee'], night: ['#0f172a', '#4338ca'], kush: ['#14532d', '#84cc16'],
    sunset: ['#f97316', '#db2777'], ocean: ['#0369a1', '#22d3ee'], haze: ['#6b21a8', '#f0abfc'],
    mono: ['#27272a', '#71717a'], toxic: ['#166534', '#facc15'], 'gold-rays': ['#78350f', '#facc15'],
    'cash-rain': ['#052e16', '#22c55e']
  };
  const bg = backgrounds[cfg.bg] || backgrounds.violet;
  const css = 'linear-gradient(145deg,' + bg[0] + ',' + bg[1] + ')';
  stage.style.background = css;
  scene.background = null;
  const portrait = stage.clientWidth < 150;
  const camera = new THREE.PerspectiveCamera(portrait ? 30 : 32, stage.clientWidth / Math.max(1, stage.clientHeight), 0.1, 50);
  camera.position.set(0, portrait ? 2.45 : 1.9, portrait ? 4.8 : 7.5);
  camera.lookAt(0, portrait ? 2.2 : 1.55, 0);
  scene.add(new THREE.HemisphereLight(0xdce8ff, 0x202034, 2.0));
  const key = new THREE.DirectionalLight(0xfff0d8, 3.1); key.position.set(-3, 6, 5); key.castShadow = true; scene.add(key);
  const rim = new THREE.DirectionalLight(0x7dd3fc, 2.4); rim.position.set(4, 3, -4); scene.add(rim);
  const fill = new THREE.PointLight(0xa78bfa, 1.4, 10); fill.position.set(2, 1, 4); scene.add(fill);

  const root = new THREE.Group(); scene.add(root);
  const materials = new Set();
  function mat(color, roughness = 0.48, metalness = 0.02) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m;
  }
  const skinPalette = ['#f9d7b9','#f1c19b','#e0a679','#c98a5b','#a8693f','#8a5232','#6b3d22','#4a2915'];
  const hairPalette = ['#1b1b1f','#4a2f1d','#7b4a24','#c58b3c','#e8c46a','#d9d4cc','#c2410c','#7c3aed','#22d3ee','#16a34a'];
  const skin = skinPalette[Number(String(cfg.skin || 's2').slice(1))] || skinPalette[2];
  const hair = hairPalette[Number(String(cfg.hairc || 'c0').slice(1))] || hairPalette[0];
  const outfitColors = { tee:'#3b82f6', hoodie:'#334155', jersey:'#dc2626', tracksuit:'#111827', 'chain-tee':'#f8fafc', fur:'#d6d3d1' };
  const shirt = outfitColors[cfg.outfit] || '#3b82f6';
  const metal = mat('#d6a94f', 0.22, 0.86);
  function mesh(geometry, material, x, y, z, sx, sy, sz, target = root) {
    const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); m.scale.set(sx,sy,sz);
    m.castShadow = true; m.receiveShadow = true; target.add(m); return m;
  }
  function ball(x,y,z,sx,sy,sz,color,target=root,roughness=0.48,metalness=0.02) {
    return mesh(new THREE.SphereGeometry(1, 32, 24), mat(color,roughness,metalness), x,y,z,sx,sy,sz,target);
  }
  const floor = mesh(new THREE.CircleGeometry(2.3, 64), mat('#111827',0.8,0), 0,0.02,0,1,1,1,scene);
  floor.rotation.x = -Math.PI / 2;
  ball(-0.24,0.66,0,0.20,0.68,0.22,shirt); ball(0.24,0.66,0,0.20,0.68,0.22,shirt);
  ball(-0.24,0.16,0.02,0.19,0.14,0.25,'#111827'); ball(0.24,0.16,0.02,0.19,0.14,0.25,'#111827');
  const torso = ball(0,1.45,0,0.62,0.75,0.34,shirt);
  ball(0,2.05,0,0.19,0.26,0.18,skin);
  ball(-0.72,1.55,0,0.19,0.56,0.20,shirt).rotation.z = -0.14;
  ball(0.72,1.55,0,0.19,0.56,0.20,shirt).rotation.z = 0.14;
  ball(-0.75,0.98,0.02,0.15,0.16,0.16,skin); ball(0.75,0.98,0.02,0.15,0.16,0.16,skin);
  const head = new THREE.Group(); root.add(head); head.position.set(0,2.62,0);
  const faceScale = cfg.face === 'square' ? [0.56,0.60,0.48] : cfg.face === 'round' ? [0.54,0.53,0.46] : [0.49,0.63,0.43];
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
  if (cfg.acc === 'glasses' || cfg.acc === 'shades') {
    const lens = mat(cfg.acc === 'shades' ? '#111827' : '#93c5fd',0.22,0.25);
    for (const x of [-0.19,0.19]) { const g=mesh(new THREE.BoxGeometry(0.30,0.19,0.045),lens,x,0.06,0.45,1,1,1,head); g.material.transparent=cfg.acc==='glasses'; g.material.opacity=cfg.acc==='glasses'?0.62:1; const frame=mesh(new THREE.BoxGeometry(0.33,0.035,0.05),metal,x,0.16,0.45,1,1,1,head); }
    mesh(new THREE.BoxGeometry(0.10,0.035,0.045),metal,0,0.07,0.45,1,1,1,head);
  }
  if (cfg.acc === 'grill') for(let i=0;i<5;i++) ball(-0.08+i*0.04,-0.25,0.435,0.019,0.035,0.018,'#fef08a',head,0.18,0.7);
  if (cfg.outfit === 'chain-tee') { const chain=mesh(new THREE.TorusGeometry(0.23,0.025,8,32),metal,0,1.86,0.28,1,0.65,1); chain.rotation.x=0.2; }
  if (cfg.outfit === 'fur') { ball(-0.42,1.55,0.02,0.22,0.70,0.38,'#e5e7eb'); ball(0.42,1.55,0.02,0.22,0.70,0.38,'#e5e7eb'); }
  if (cfg.held === 'controller') {
    ball(0.73,0.87,0.12,0.20,0.10,0.08,'#111827');
    ball(0.67,0.87,0.20,0.045,0.045,0.02,'#ef4444'); ball(0.80,0.87,0.20,0.045,0.045,0.02,'#22c55e');
  }
  if (cfg.held === 'cane') { const cane=mesh(new THREE.CylinderGeometry(0.035,0.035,0.95,12),metal,0.90,0.52,0.08,1,1,1); ball(0.90,1.02,0.08,0.11,0.11,0.10,'#facc15'); }
  if (cfg.held === 'cash') { for(let i=0;i<4;i++) { const bill=mesh(new THREE.BoxGeometry(0.17,0.10,0.018),mat('#16a34a',0.6,0),0.84+i*0.025,0.94+i*0.018,0.08+i*0.018,1,1,1); bill.rotation.z=0.2; } }

  const pointer = { down:false, x:0, y:0, rot:0, tilt:0 };
  const down = (e) => { pointer.down=true; pointer.x=e.clientX; pointer.y=e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); };
  const move = (e) => { if(!pointer.down) return; pointer.rot += (e.clientX-pointer.x)*0.012; pointer.tilt = Math.max(-0.20,Math.min(0.20,pointer.tilt+(e.clientY-pointer.y)*0.003)); pointer.x=e.clientX; pointer.y=e.clientY; root.rotation.y=pointer.rot; root.rotation.x=pointer.tilt; };
  const up = () => { pointer.down=false; };
  renderer.domElement.addEventListener('pointerdown',down);
  renderer.domElement.addEventListener('pointermove',move);
  renderer.domElement.addEventListener('pointerup',up);
  renderer.domElement.addEventListener('pointercancel',up);
  const resize = () => { if(!stage.isConnected) return; const w=Math.max(180,stage.clientWidth), h=Math.max(220,stage.clientHeight); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if(observer) observer.observe(stage); else window.addEventListener('resize',resize);
  let frame=0, alive=true, cleanup=null;
  const animate = (t) => { if(!alive) return; if(!stage.isConnected && cleanup) { cleanup(); return; } frame=requestAnimationFrame(animate); if(!pointer.down && !reduced) root.rotation.y += 0.0012; torso.scale.y=0.75+(reduced?0:Math.sin(t*0.0015)*0.008); renderer.render(scene,camera); };
  frame=requestAnimationFrame(animate);
  cleanup = () => {
    if(!alive) return; alive=false; cancelAnimationFrame(frame); if(observer) observer.disconnect(); else window.removeEventListener('resize',resize);
    renderer.domElement.removeEventListener('pointerdown',down); renderer.domElement.removeEventListener('pointermove',move); renderer.domElement.removeEventListener('pointerup',up); renderer.domElement.removeEventListener('pointercancel',up);
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();}); materials.forEach(m=>m.dispose()); renderer.dispose(); renderer.domElement.remove();
  };
  return cleanup;
}
