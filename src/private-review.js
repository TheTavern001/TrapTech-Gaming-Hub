'use strict';
// Opt-in access control for owner review on the existing Deplexo URL.
// ENV: HUB_PRIVATE_REVIEW=1, HUB_PREVIEW_USERNAMES=existing,player,usernames
// Never default ON or infer permission from a claimed client header.
// Static client JS is not a security boundary: gate server-side API actions.
function makeGate({enabled=false,users='',currentUser=()=>null,isOwnerAdmin=()=>false,adminBase=()=>null}={}){
  const names=new Set(String(users).split(',').map(x=>x.trim().toLowerCase()).filter(x=>/^[a-z0-9_.-]{3,20}$/.test(x)));
  // Admin session cookie is deliberately scoped to the secret /<ADMIN_PATH>.
  // Browsers do not attach it to the public / route, so it cannot serve as
  // the sole access method for the owner-facing Hub review URL.
  if(enabled && names.size===0) {
    throw Error('HUB_PRIVATE_REVIEW requires at least one valid HUB_PREVIEW_USERNAMES account to prevent owner lockout.');
  }
  const publicGet=new Set(['/healthz','/api/build','/signin','/manifest.webmanifest','/sw.js','/robots.txt','/favicon.ico']);
  const guestAuth=new Set(['/api/auth/signin','/api/auth/signout','/api/me']);
  const assets=/^\/(?:assets|css|js|fonts|i18n|og)\//;
  return (req,res,next)=>{
    if(!enabled)return next();
    res.setHeader('Cache-Control','no-store');
    const pathname=String(req.path||'/');
    const method=String(req.method||'GET').toUpperCase();
    const base=adminBase();
    // The secret admin route has its own session/2FA authorization. Do not
    // disclose its path to guests or grant access to anything else.
    if(base && (pathname===base || pathname.startsWith(base+'/')))return next();
    if((method==='GET'||method==='HEAD') &&
       (publicGet.has(pathname)||assets.test(pathname)||pathname==='/cosmetics.css'))return next();
    if(guestAuth.has(pathname)&&(['GET','HEAD','POST'].includes(method)))return next();
    let allowed=false;
    try {
      const user=currentUser(req);
      allowed=!!user && names.has(String(user.username||'').toLowerCase());
      if(!allowed)allowed=isOwnerAdmin(req)===true;
    }catch(err){ allowed=false; }
    if(allowed)return next();
    res.setHeader('Retry-After','3600');
    if(pathname.startsWith('/api/')){
      return res.status(503).json({ok:false,private_review:true,
        error:'The Gaming Hub is undergoing an owner-only review. Public access resumes after approval.'});
    }
    return res.status(503).type('html').send('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Gaming Hub — Owner Review</title></head><body style="background:#050714;color:#f5f6fa;font:16px system-ui;margin:12vh auto;max-width:35rem;padding:1.5rem"><h1>Gaming Hub — Private Review</h1><p>The Hub is being upgraded and reviewed. Public access resumes after approval.</p><p>Authorized reviewers may <a href="/signin" style="color:#e7ba6d">sign in</a>.</p></body></html>');
  };
}
module.exports={makeGate};
