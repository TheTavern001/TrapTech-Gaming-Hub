// Shared options for three independently licensed browser engines.
// No score submissions, gameplay mutations, unlocks or ability changes.
import {openGameSettings,effective,applyDocument} from '../js/player-prefs.js';
const key=location.pathname.split('/').filter(Boolean).at(-1)==='index.html'
  ? location.pathname.split('/').filter(Boolean).at(-2)
  : location.pathname.split('/').filter(Boolean).at(-1);
const ID={ 'bud-merge':'gl-bud-merge','hex-stack':'gl-hex-stack','dino-dash':'gl-dino-dash' }[key];
if(ID){
  applyDocument();
  let running=false,previous=false;
  if(key==='dino-dash'&&window.Runner?.prototype?.playSound){
    const originalPlay=Runner.prototype.playSound;
    Runner.prototype.playSound=function(...args){
      if(!effective(ID).sound)return;
      return originalPlay.apply(this,args);
    };
  }
  openGameSettings({id:ID,title:document.title,host:document.body,
    supportsSound:key==='dino-dash',supportsQuality:false,
    onOpen:()=>{
      if(key==='bud-merge'){previous=!!window.__ttVendorSettingsPaused;window.__ttVendorSettingsPaused=true;}
      if(key==='hex-stack'){
        const g=window.__GL?.g;
        // An earlier quick close may still be waiting on native pause animation.
        // Reopening must not confuse that pending resume with a user-initiated pause.
        previous=!!g?.paused&&!g?.resumePending;
        if(window.settings?.speedUpKeyHeld){window.rush/=4;window.settings.speedUpKeyHeld=false;}
        if(g)g.paused=true;
      }
      if(key==='dino-dash'){const r=window.Runner?.instance_;running=!!r?.isRunning?.();
        if(running)r.stop();}
    },
    onClose:()=>{
      if(key==='bud-merge')window.__ttVendorSettingsPaused=previous;
      if(key==='hex-stack'&&window.__GL?.g)window.__GL.g.paused=previous;
      if(key==='dino-dash'&&running){const r=window.Runner?.instance_;if(r&&!r.crashed)r.play();running=false;}
    },
    onChange:()=>{},
    fps:()=>window.__GL?.fps
  });
}
