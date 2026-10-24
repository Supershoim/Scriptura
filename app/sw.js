// Offline support. The build fills in VERSION, SHELL and STUDIES; bible texts are cached the first time they load.
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const STUDIES = __STUDIES__;
const CACHE = 'scriptura-' + VERSION;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('scriptura-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
  // The studies are many small files: fetched in the background so the app is usable meanwhile.
  caches.open(CACHE).then(async cache => {
    for (const file of STUDIES) if (!await cache.match(file)) await cache.add(file).catch(() => {});
  });
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
