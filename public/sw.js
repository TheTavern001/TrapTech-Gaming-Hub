// The Gaming Hub service worker (built by Trap Tech Solutions).
// Network-first for everything (always fresh when online); cached app shell + assets as the offline fallback.
// API calls and share images are never cached.
const CACHE = 'gh-shell-v5-art';
const SHELL = ['/', '/css/app.css', '/cosmetics.css', '/js/app.js', '/js/icons.js', '/manifest.webmanifest',
  '/js/store.js', '/assets/brand/hub-logo.svg', '/assets/brand/hub-stacked.svg', '/assets/brand/traptech-wordmark.svg', '/assets/brand/traptech-stacked.svg', '/assets/brand/favicon.svg',
  '/assets/icons/icon-192.png', '/fonts/orbitron-latin-800-normal.woff2', '/fonts/exo-2-latin-600-normal.woff2'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/og/') || url.pathname.startsWith('/admin')) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (req.mode === 'navigate' || /\.(css|js|woff2|webp|png|svg|webmanifest)$/.test(url.pathname))) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? '/' : req, copy)); }
    return res;
  }).catch(() => caches.match(req.mode === 'navigate' ? '/' : req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
