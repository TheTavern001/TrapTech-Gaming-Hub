// CC0 Quaternius Ultimate Modular Adventurers. Local Three.js loader and self-hosted glTF.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';

const sources = { male:'/assets/avatars/rigged/male-adventurer.gltf', female:'/assets/avatars/rigged/female-adventurer.gltf' };
const cache = new Map();
const SKIN = ['#f9d7b9','#f1c19b','#e0a679','#c98a5b','#a8693f','#8a5232','#6b3d22','#4a2915'];
const HAIR = ['#1b1b1f','#4a2f1d','#7b4a24','#c58b3c','#e8c46a','#d9d4cc','#c2410c','#7c3aed','#22d3ee','#16a34a'];
const BG = { night:['#0c152b','#4338ca'],violet:['#1a1040','#7c3aed'],ocean:['#09253f','#0e7490'],
  sunset:['#412040','#e87054'],haze:['#190d35','#7e22ce'],studio:['#111827','#7c3aed'] };
function load(presentation) {
  const file = sources[presentation === 'female' ? 'female' : 'male'];
  if (!cache.has(file)) cache.set(file, new GLTFLoader().loadAsync(file).catch(e=>{cache.delete(file);throw e;}));
  return cache.get(file);
}
export async function mountRiggedAvatar(stage,cfg) {
  if (!stage || !stage.isConnected) return () => {};
  const gltf = await load(cfg.gender);
  if (!stage.isConnected) return () => {};
  const reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const scene = new THREE.Scene();
  const bg = BG[cfg.bg] || BG.night;
  stage.style.background = 'radial-gradient(circle at 48% 40%,rgba(155,143,255,.26),transparent 50%),linear-gradient(145deg,' + bg.join(',') + ')';
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.16;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  let dpr=Math.min(1.5,window.devicePixelRatio||1),raf=0,alive=true,previous=0,slow=0;
  renderer.setPixelRatio(dpr);
  renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:pan-y;outline:none';
  renderer.domElement.setAttribute('role','img');
  renderer.domElement.setAttribute('aria-label','Animated three-dimensional character. Drag to rotate.');
  stage.replaceChildren(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xeaf1ff,0x34415d,2.1));
  const key=new THREE.DirectionalLight(0xffead6,3.3);key.position.set(-3,7,6);scene.add(key);
  const rim=new THREE.DirectionalLight(0x90daff,2.35);rim.position.set(3,4,-5);scene.add(rim);
  const root=new THREE.Group();scene.add(root);
  const character=cloneRig(gltf.scene);root.add(character);
  const ownedMaterials=new Set();
  character.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=true;
    o.frustumCulled=false;
    const colorize=material=>{
      const m=material.clone();ownedMaterials.add(m);
      const name=String(m.name||'').toLowerCase();
      const skin=SKIN[Number(String(cfg.skin||'s2').slice(1))]||SKIN[2];
      const hair=HAIR[Number(String(cfg.hairc||'c1').slice(1))]||HAIR[1];
      if(name==='skin')m.color.set(skin);
      if(name==='hair'||name==='hair_brown'||name==='eyebrows')m.color.set(hair);
      return m;
    };
    o.material=Array.isArray(o.material)?o.material.map(colorize):colorize(o.material);
  });
  const bounds=new THREE.Box3().setFromObject(character);
  const size=new THREE.Vector3(),center=new THREE.Vector3();bounds.getSize(size);bounds.getCenter(center);
  if(!Number.isFinite(size.y)||size.y<.01)throw new Error('Invalid rig bounds');
  const scale=3.2/size.y;
  character.scale.multiplyScalar(scale);
  character.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  const builds={average:[1,1,1],slim:[.9,1.02,.92],athletic:[1.08,1.04,1.05],
    stocky:[1.12,.96,1.08],curvy:[1.06,1,1.02],tall:[.95,1.12,.95],short:[1.05,.88,1.05]};
  root.scale.set(...(builds[cfg.build]||builds.average));
  const ground=new THREE.Mesh(new THREE.CircleGeometry(1.35,64),
    new THREE.MeshStandardMaterial({color:0x192447,roughness:.45,metalness:.22}));
  ground.rotation.x=-Math.PI/2;ground.position.set(0,-.025,0);
  ground.receiveShadow=true;scene.add(ground);
  // Use a face-forward portrait on the profile, full body in the wardrobe editor.
  const isPortrait=stage.classList.contains('avatar-profile-stage');
  const camera=new THREE.PerspectiveCamera(isPortrait?38:35,1,.1,50);
  if(isPortrait){camera.position.set(0,2.62,3.65);camera.lookAt(0,2.52,0);}
  else {camera.position.set(0,2.0,6.7);camera.lookAt(0,1.5,0);}
  const mixer=new THREE.AnimationMixer(character);
  const idle=THREE.AnimationClip.findByName(gltf.animations,'Idle')||
    THREE.AnimationClip.findByName(gltf.animations,'Idle_Neutral')||gltf.animations[0];
  if(idle&&!reduced)mixer.clipAction(idle).play();
  const resize=()=>{
    if(!stage.isConnected)return;
    const w=Math.max(180,stage.clientWidth),h=Math.max(220,stage.clientHeight);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  };
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  if(observer)observer.observe(stage);else window.addEventListener('resize',resize);
  resize();
  const pointer={down:false,x:0};
  const down=e=>{pointer.down=true;pointer.x=e.clientX;renderer.domElement.setPointerCapture?.(e.pointerId);};
  const move=e=>{if(!pointer.down)return;root.rotation.y+=(e.clientX-pointer.x)*.011;pointer.x=e.clientX;};
  const up=()=>{pointer.down=false;};
  if(!isPortrait) renderer.domElement.addEventListener('pointerdown',down);
  if(!isPortrait) renderer.domElement.addEventListener('pointermove',move);
  if(!isPortrait) renderer.domElement.addEventListener('pointerup',up);
  if(!isPortrait) renderer.domElement.addEventListener('pointercancel',up);
  const cleanup=()=>{
    if(!alive)return;
    alive=false;cancelAnimationFrame(raf);
    if(observer)observer.disconnect();else window.removeEventListener('resize',resize);
    renderer.domElement.removeEventListener('pointerdown',down);
    renderer.domElement.removeEventListener('pointermove',move);
    renderer.domElement.removeEventListener('pointerup',up);
    renderer.domElement.removeEventListener('pointercancel',up);
    mixer.stopAllAction();mixer.uncacheRoot(character);
    ownedMaterials.forEach(m=>m.dispose());
    ground.geometry.dispose();ground.material.dispose();
    renderer.dispose();renderer.domElement.remove();
  };
  const animate=t=>{
    if(!alive)return;
    if(!stage.isConnected){cleanup();return;}
    raf=requestAnimationFrame(animate);
    if(document.hidden){previous=0;return;}
    const dt=previous?Math.min(.05,(t-previous)/1000):0;
    if(previous&&t-previous>24)slow++;else slow=0;
    previous=t;
    if(slow>=45&&dpr>1){dpr=Math.max(1,Math.round((dpr-.25)*100)/100);renderer.setPixelRatio(dpr);resize();slow=0;}
    if(!reduced)mixer.update(dt);
    renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(animate);
  return cleanup;
}
