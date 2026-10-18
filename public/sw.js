// The Gaming Hub service worker (built by Trap Tech Solutions).
// Network-first static assets; HTML always requires a fresh authorized response.
// API calls, share images and anything sent with Cache-Control: no-store are never cached.
const VER = '__BUILD__'; // replaced with the build id when the server renders this file
const CACHE = 'gh-shell-' + VER;
const V = (u) => (/\.(css|js)$/.test(u) ? u + '?v=' + VER : u); // precache the same versioned URLs the HTML requests
const SHELL = ['/offline.html', '/css/app.css', '/cosmetics.css', '/js/app.js', '/js/icons.js', '/manifest.webmanifest',
  '/js/store.js', '/js/player-prefs.js', '/css/player-prefs.css', '/assets/brand/hub-logo.svg', '/assets/brand/hub-stacked.svg', '/assets/brand/tt-mono.svg', '/assets/brand/tt-horizontal.svg', '/assets/brand/favicon.svg', '/css/v7.css', '/css/v8.css', '/js/v8.js', '/js/v7.js',
  '/assets/brand/traptech-app-icon.svg', '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/maskable-512.png', '/assets/icons/apple-touch-icon.png', '/fonts/orbitron-latin-800-normal.woff2', '/fonts/exo-2-latin-600-normal.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(V))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/og/')) return;
  // Never persist account/private-review HTML or substitute one route for another.
  // Offline play cannot create a server-authorized competition run.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html').then(r => r || new Response('You are offline. Reconnect to open the Gaming Hub.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    }))));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res.ok && !res.redirected && !/no-store|private/i.test(res.headers.get('cache-control') || '') && /\.(css|js|woff2|webp|png|svg|webmanifest)$/.test(url.pathname)) {
      const copy = res.clone();
      e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}));
    }
    return res;
  }).catch(() => caches.match(req).then(r => r || Response.error())));
});

