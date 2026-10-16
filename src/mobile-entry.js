'use strict';
// Product availability, NOT an anti-cheat device attestation. User agents can
// be changed. All authorization and prize validation remain server-side.
const PHONE=/(?:iPhone|iPod|Windows Phone|IEMobile|Android[^)]*Mobile|Android.*\bMobile\b|BlackBerry|BB10|webOS|Opera Mini|Mobile Safari)/i;
const DESKTOP=/(?:Windows NT|Macintosh|\bX11\b|\bCrOS\b|Linux x86_64)/i;
const PREVIEW=/(?:Googlebot|Bingbot|Twitterbot|facebookexternalhit|Slackbot|Discordbot|TelegramBot|WhatsApp|LinkedInBot|Pinterest)/i;
function isPhone(ua){
 const value=String(ua||'');
 // Desktop OS tokens should not be treated as phones merely because a
 // marketing extension includes the word "Mobile".
 if(DESKTOP.test(value))return false;
 return PHONE.test(value);
}
function shouldShowMobilePage(req){
 if(req.method!=='GET'&&req.method!=='HEAD')return false;
 const headers=req.headers||{},ua=String(headers['user-agent']||'');
 // Crawlers need the original OG metadata for shareable URLs.
 if(PREVIEW.test(ua))return false;
 if(isPhone(ua) || (!DESKTOP.test(ua) && !/(?:Android|iPad|Tablet)/i.test(ua)))return false;
 const accept=String(headers.accept||'');
 if(!accept.includes('text/html'))return false;
 const route=String(req.path||'').toLowerCase();
 if(route.startsWith('/api/')||route.startsWith('/og/')||route.startsWith('/.well-known/') ||
    route==='/healthz'||route==='/api/build'||route==='/mobile-only.html')
   return false;
 // Navigation routes and static HTML game entrypoints, not scripts/assets.
 return route==='/'||route.endsWith('/')||route.endsWith('.html')||
   !/\.[a-z0-9]{1,8}$/.test(route);
}
function gate(req,res,next){
 if(!shouldShowMobilePage(req))return next();
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('Vary','User-Agent, Accept');
 // Keep the requested URL in the browser for sharing directly to phones.
 // A separate /mobile-only.html route bypasses this check intentionally.
 return res.status(200).sendFile(require('node:path').join(__dirname,'../public/mobile-only.html'));
}
module.exports={isPhone,shouldShowMobilePage,gate};
