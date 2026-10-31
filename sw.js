const V = 'medrise-hq-v3';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/store.js', 'js/templates.js', 'js/i18n.js', 'js/config.js', 'js/sanitize-svg.js', 'js/validate.js', 'js/bundle.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const fresh = new URL(r.url).pathname.includes('/content/') || new URL(r.url).pathname.includes('/handoff/') || r.mode === 'navigate';
  e.respondWith(fresh
    ? fetch(r).then((x) => { const c = x.clone(); caches.open(V).then((ch) => ch.put(r, c)); return x; }).catch(() => caches.match(r).then((m) => m || caches.match('index.html')))
    : caches.match(r).then((m) => m || fetch(r).then((x) => { const c = x.clone(); caches.open(V).then((ch) => ch.put(r, c)); return x; })));
});
