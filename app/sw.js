// Offline support. The build fills in VERSION and SHELL; bible texts are cached the first time they load.
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const CACHE = 'scriptura-' + VERSION;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('scriptura-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  // Cache first; a new build gets a new cache, so files never go stale across versions.
  event.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    const response = await fetch(event.request);
    if (response.ok && !url.pathname.endsWith('Scriptura.html')) cache.put(event.request, response.clone());
    return response;
  }));
});
