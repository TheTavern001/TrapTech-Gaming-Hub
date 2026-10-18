// Local-only presentation settings. Never modifies gameplay, score, RNG or hitboxes.
const KEY='gh_player_prefs_v1', PREFIX='gh_game_prefs_v1:',mem=new Map();
const def=Object.freeze({sound:true,reducedMotion:false,highContrast:false,quality:'auto',showFps:false});
const modes=['auto','sharp','battery'];
const read=k=>{try{return localStorage.getItem(k)??mem.get(k)??null}catch{return mem.get(k)??null}};
const write=(k,v)=>{mem.set(k,String(v));try{localStorage.setItem(k,String(v))}catch{}};
const raw=k=>{try{const o=JSON.parse(read(k)||'null');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}};
const bool=(v,d)=>typeof v==='boolean'?v:d;
export function normalize(o={},d=def){return {sound:bool(o.sound,d.sound),reducedMotion:bool(o.reducedMotion,d.reducedMotion),highContrast:bool(o.highContrast,d.highContrast),quality:modes.includes(o.quality)?o.quality:d.quality,showFps:bool(o.showFps,d.showFps)}}
export function globalPrefs(){return normalize(raw(KEY),{...def,sound:read('gl_mute')!=='1'&&read('jd_muted')!=='1',reducedMotion:read('gh_reduce_motion')==='1'})}
export function applyDocument(p=globalPrefs()){if(typeof document!=='undefined'){document.documentElement.classList.toggle('reduce-motion',p.reducedMotion);document.documentElement.classList.toggle('tt-high-contrast',p.highContrast)}return p}
export function saveGlobal(v){const before=globalPrefs(),changes={...v};if('quality' in changes&&!modes.includes(changes.quality))delete changes.quality;for(const k of ['sound','reducedMotion','highContrast','showFps'])if(k in changes&&typeof changes[k]!=='boolean')delete changes[k];const p=normalize({...before,...changes});write(KEY,JSON.stringify(p));write('gl_mute',p.sound?'0':'1');write('jd_muted',p.sound?'0':'1');write('gh_reduce_motion',p.reducedMotion?'1':'0');applyDocument(p);return p}
export function gameOverrides(id){const o=raw(PREFIX+encodeURIComponent(id)),p={};for(const k of ['sound','quality','showFps'])if(Object.prototype.hasOwnProperty.call(o,k)){if(k==='quality'&&modes.includes(o[k]))p[k]=o[k];if(k!=='quality'&&typeof o[k]==='boolean')p[k]=o[k]}return p}
export function saveGame(id,changes){const p=gameOverrides(id);for(const k of ['sound','quality','showFps'])if(k in changes){const v=changes[k];if(v==null||v==='default')delete p[k];else if(k==='quality'&&modes.includes(v))p[k]=v;else if(k!=='quality'&&typeof v==='boolean')p[k]=v}write(PREFIX+encodeURIComponent(id),JSON.stringify(p));return effective(id)}
export function effective(id){return {...globalPrefs(),...gameOverrides(id)}}
export function qualityCap(mode,dpr=1){const n=Math.max(1,Math.min(3,Number(dpr)||1));return mode==='battery'?1:mode==='sharp'?Math.min(2.5,n):Math.min(2,n)}
export function openGameSettings(opts){
 const {id,title,host=document.body,trigger,onOpen=()=>{},onClose=()=>{},onChange=()=>{},fps,supportsSound=true,supportsQuality=true}=opts;
 applyDocument();
 if(!document.querySelector('link[data-ttgs]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/css/player-prefs.css?v='+((document.querySelector('meta[name=build-id]')||{}).content||'0');l.dataset.ttgs='1';document.head.appendChild(l)}
 const root=document.createElement('div');root.className='ttgs-root';host.appendChild(root);
 const button=trigger||document.createElement('button');
 if(!trigger){button.type='button';button.className='ttgs-gear';button.textContent='⚙';button.setAttribute('aria-label','Game settings');root.appendChild(button)}
 const modal=document.createElement('div');modal.className='ttgs-modal';modal.hidden=true;
 modal.innerHTML='<div class="ttgs-box" role="dialog" aria-modal="true" aria-labelledby="ttgs-title"><h2 id="ttgs-title">Game settings</h2><p class="ttgs-game"></p>'+
 '<label>Sound <select data-key="sound"><option value="default">App default</option><option value="true">On</option><option value="false">Off</option></select></label>'+
 '<label>Visual quality <select data-key="quality"><option value="default">App default</option><option value="auto">Balanced</option><option value="sharp">Sharper</option><option value="battery">Battery saver</option></select></label>'+
 '<label>FPS display <select data-key="showFps"><option value="default">App default</option><option value="true">Show</option><option value="false">Hide</option></select></label>'+
 '<p class="ttgs-disclaimer">Device-local display/audio only. No gameplay, score, difficulty or prize advantages.</p>'+
 '<div class="ttgs-actions"><button type="button" data-action="reset">Reset game</button><button type="button" data-action="close">Resume</button></div></div>';
 root.appendChild(modal);modal.querySelector('.ttgs-game').textContent=title||'Current game';
 if(!supportsSound)modal.querySelector('[data-key="sound"]').closest('label').remove();
 if(!supportsQuality)modal.querySelector('[data-key="quality"]').closest('label').remove();
 let visible=false,prior=null,badge=null;
 function update(){
   const p=effective(id);onChange(p);
   if(p.showFps&&typeof fps==='function'){if(!badge){badge=document.createElement('span');badge.className='ttgs-fps';root.appendChild(badge)}}
   else{badge?.remove();badge=null}
 }
 function sync(){const v=gameOverrides(id);modal.querySelectorAll('select[data-key]').forEach(e=>e.value=Object.prototype.hasOwnProperty.call(v,e.dataset.key)?String(v[e.dataset.key]):'default')}
 function open(){if(visible)return;prior=document.activeElement;onOpen();sync();modal.hidden=false;visible=true;modal.querySelector('select')?.focus()}
 function close(){if(!visible)return;modal.hidden=true;visible=false;onClose();if(prior?.isConnected)prior.focus()}
 // Consume UI pointer/key presses after target handlers but before any game
 // bridge/window scoring telemetry. Keep native select behavior intact.
 button.addEventListener('pointerdown',e=>e.stopPropagation());
 button.addEventListener('keydown',e=>e.stopPropagation());
 modal.addEventListener('pointerdown',e=>e.stopPropagation());
 modal.addEventListener('touchstart',e=>e.stopPropagation());
 modal.addEventListener('keydown',e=>e.stopPropagation());
 button.addEventListener('click',open);
 modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('[data-action="close"]'))close();if(e.target.closest('[data-action="reset"]')){saveGame(id,{sound:null,quality:null,showFps:null});sync();update()}});
 modal.addEventListener('change',e=>{const c=e.target.closest('[data-key]');if(!c)return;const v=c.value;saveGame(id,{[c.dataset.key]:v==='default'?null:c.dataset.key==='quality'?v:v==='true'});update()});
 function keys(e){if(!visible)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}if(e.key==='Tab'){const a=[...modal.querySelectorAll('select,button')];if(e.shiftKey&&document.activeElement===a[0]){e.preventDefault();a.at(-1).focus()}else if(!e.shiftKey&&document.activeElement===a.at(-1)){e.preventDefault();a[0].focus()}}}
 document.addEventListener('keydown',keys,true);
 const timer=setInterval(()=>{if(!root.isConnected){clearInterval(timer);document.removeEventListener('keydown',keys,true);return}if(badge){const n=Number(fps());badge.textContent=Number.isFinite(n)?Math.round(n)+' FPS':'— FPS'}},1000);
 update();
 return {open,close,refresh:update,destroy:()=>{clearInterval(timer);document.removeEventListener('keydown',keys,true);close();root.remove()}};
}
