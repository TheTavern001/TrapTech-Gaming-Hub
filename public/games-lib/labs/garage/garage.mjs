import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const $=id=>document.getElementById(id),stage=$('stage'),status=$('status');
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),cache=new Map();
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}
catch(error){status.textContent='WebGL not available on this device.';throw error;}
renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
stage.insertBefore(renderer.domElement,status);
const scene=new THREE.Scene();scene.background=new THREE.Color('#14233b');
const camera=new THREE.PerspectiveCamera(40,1,.1,100);
scene.add(new THREE.HemisphereLight('#e5f3ff','#243046',2.5));
const key=new THREE.DirectionalLight('#fff6e4',4);key.position.set(5,9,7);scene.add(key);
const edge=new THREE.DirectionalLight('#85afff',2);edge.position.set(-7,5,-4);scene.add(edge);
const ground=new THREE.Mesh(new THREE.CircleGeometry(5.2,64),new THREE.MeshStandardMaterial({color:'#1e3149',metalness:.12,roughness:.73}));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;scene.add(ground);
const root=new THREE.Group();scene.add(root);
const paint=new THREE.MeshPhysicalMaterial({color:'#d94946',metalness:.45,roughness:.27,clearcoat:1});
const material={
 glass:new THREE.MeshPhysicalMaterial({color:'#183553',metalness:.3,roughness:.1,clearcoat:1}),
 chrome:new THREE.MeshStandardMaterial({color:'#d1deed',metalness:1,roughness:.17}),
 rim:new THREE.MeshStandardMaterial({color:'#afbaca',metalness:.8,roughness:.33}),
 tire:new THREE.MeshStandardMaterial({color:'#171923',roughness:.95}),
 trim:new THREE.MeshStandardMaterial({color:'#222836',roughness:.59}),
 light_f:new THREE.MeshStandardMaterial({color:'#fff1cc',emissive:'#f4c55e',emissiveIntensity:1}),
 light_r:new THREE.MeshStandardMaterial({color:'#ea2634',emissive:'#bf0a25',emissiveIntensity:.75}),
 box:new THREE.MeshStandardMaterial({color:'#e1e4e6',roughness:.48})};
let current,seq=0,theta=.52,zoom=8.5,down=false,last=0;
const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
new ResizeObserver(resize).observe(stage);resize();
const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Drag to rotate three-dimensional vehicle');
canvas.addEventListener('pointerdown',e=>{down=true;last=e.clientX;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(down){theta+=(e.clientX-last)*.009;last=e.clientX;}});
canvas.addEventListener('pointerup',()=>down=false);canvas.addEventListener('pointercancel',()=>down=false);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom+Math.sign(e.deltaY)*.5,5,13);},{passive:false});
canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();theta+=e.key==='ArrowLeft'?.15:-.15;}});
function tick(){requestAnimationFrame(tick);if(document.hidden)return;if(current)current.rotation.y=theta;camera.position.set(zoom*.52,zoom*.38,zoom*.75);camera.lookAt(0,1.1,0);renderer.render(scene,camera);}tick();
async function select(car){
 const id=++seq;status.textContent='Loading '+car.label+' GLB…';$('model-name').textContent=car.label;
 document.querySelectorAll('#choices button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.car===car.id)));
 try{
  if(!cache.has(car.id))cache.set(car.id,loader.loadAsync(new URL(car.path,import.meta.url).href).catch(e=>{cache.delete(car.id);throw e;}));
  const gltf=await cache.get(car.id);if(id!==seq)return;
  if(current)root.remove(current);
  const model=gltf.scene.clone(true);
  model.traverse(o=>{if(!o.isMesh)return;const name=(o.material?.name||'').replace(/\.\d+$/,'').toLowerCase();o.material=name==='paint'?paint:material[name]||material.trim;});
  model.rotation.y=-Math.PI/2;
  const b=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();b.getSize(size);
  if(!Number.isFinite(size.length())||size.length()===0)throw Error('Empty mesh');
  model.scale.multiplyScalar(4.6/Math.max(size.x,size.z));
  b.setFromObject(model);const center=b.getCenter(new THREE.Vector3());model.position.set(-center.x,-b.min.y,-center.z);
  root.add(model);current=model;status.textContent='REAL 3D MODEL • CC0 • QA ONLY';
 }catch(error){if(id===seq){status.textContent='Failed to load '+car.label+'; asset not approved.';console.error(error);}}
}
for(const [color,name] of [['#d94946','Carmine'],['#347dbd','Ocean'],['#e5e1d8','Ivory'],['#3d4250','Graphite'],['#dfad51','Gold']]){
 const b=document.createElement('button');b.type='button';b.title=name;b.style.background=color;b.setAttribute('aria-label',name+' paint preview');b.setAttribute('aria-pressed',String(name==='Carmine'));
 b.onclick=()=>{paint.color.set(color);$('paints').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};$('paints').append(b);
}
try{
 const res=await fetch(new URL('./vehicles.json',import.meta.url),{cache:'no-store'});if(!res.ok)throw Error('Manifest HTTP '+res.status);
 const manifest=await res.json();if(manifest.schema!==1||manifest.previewOnly!==true||manifest.models.length!==6)throw Error('Manifest invalid');
 for(const car of manifest.models){const b=document.createElement('button');b.type='button';b.textContent=car.label;b.dataset.car=car.id;b.setAttribute('aria-pressed','false');b.onclick=()=>select(car);$('choices').append(b);}
 await select(manifest.models[0]);
}catch(error){status.textContent='Verified vehicle manifest unavailable.';console.error(error);}
