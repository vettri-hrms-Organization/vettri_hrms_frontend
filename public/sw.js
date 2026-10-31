/* Vettri HRMS service worker (hand-written, no build plugin).
 *
 * - App shell (index.html, offline page, manifest, icons) is precached on install.
 * - Hashed Vite bundles under /assets/ are cached on first fetch (cache-first; names are content-hashed).
 * - Navigations are network-first; when offline the cached shell is NOT used for data, the
 *   offline page is shown instead.
 * - NEVER caches /api/**, any request carrying an Authorization header, non-GET requests,
 *   cross-origin requests, or non-OK responses.
 * - A new version waits until the page posts {type: 'SKIP_WAITING'} (the in-app
 *   "Update available - reload" prompt), then old caches are deleted on activate.
 *
 * Bump VERSION whenever this file's caching rules change.
 */
// v2: never cache an HTML page answered for a missing /assets bundle (old builds after a deploy).
// v3: manifest shortcuts for payslips, approvals and the helpdesk.
const VERSION = 'v3';
const SHELL_CACHE = `vettri-shell-${VERSION}`;
const ASSET_CACHE = `vettri-assets-${VERSION}`;
const STATIC_CACHE = `vettri-static-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, ASSET_CACHE, STATIC_CACHE];
const OFFLINE_URL = '/offline.html';
const MAX_ASSET_ENTRIES = 120;

const SHELL_URLS = [
  '/index.html',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/vettri-192.png',
  '/icons/vettri-512.png',
  '/icons/vettri-apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('vettri-') && !KNOWN_CACHES.includes(key))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return false;
  if (request.headers.has('Authorization')) return false;
  if (url.pathname === '/sw.js') return false;
  return true;
}

function okToStore(response) {
  return response && response.ok && response.type === 'basic'
    && !(response.headers.get('Cache-Control') || '').includes('no-store');
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (okToStore(response) && (response.headers.get('Content-Type') || '').includes('text/html')) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(OFFLINE_URL)) || new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const isHtml = (response.headers.get('Content-Type') || '').includes('text/html');
  if (okToStore(response) && !isHtml) {
    cache.put(request, response.clone()).then(() => trimCache(cacheName, MAX_ASSET_ENTRIES));
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (okToStore(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isCacheable(request, url)) return; // let the browser handle it untouched

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  if (/\.(png|svg|ico|webmanifest|woff2?|jpg|jpeg|webp)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
