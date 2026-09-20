/**
 * Bihar Samachar Hub — Progressive Web App Service Worker (v3.0)
 * Intelligent Caching: Network-First for News, Cache-First for Static Assets
 * Full Offline Mode + Push Notification Support
 */

const CACHE_VERSION = 'bsh-v6.3.0';
const STATIC_CACHE = `bsh-static-${CACHE_VERSION}`;
const DATA_CACHE = `bsh-data-${CACHE_VERSION}`;
const OFFLINE_URL = 'offline.html';
const NETWORK_TIMEOUT_MS = 6000; // 6s timeout for HTML navigation
const API_TIMEOUT_MS = 4000;     // 4s timeout for dynamic APIs

// ─── Network Fetch Timeout Helper (Prevents Infinite Hangs) ─────────────────
function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`[BSH ServiceWorker] Network timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

// Core Application Shell Assets to Precache
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'districts.html',
  'news.html',
  'live-blog.html',
  'admin.html',
  'about.html',
  'contact.html',
  'offline.html',
  'manifest.json',
  'assets/css/style.css',
  'assets/css/district.css',
  'assets/js/security.js',
  'assets/js/main.js',
  'assets/js/ab-testing.js',
  'assets/js/districts.js',
  'assets/js/news.js',
  'assets/js/jobs-tracker.js',
  'assets/js/district-page.js',
  'assets/vendor/leaflet/leaflet.js',
  'assets/vendor/leaflet/leaflet.css',
  'assets/images/sources/aajtak.svg',
  'assets/images/sources/abp.svg',
  'assets/images/sources/bhaskar.svg',
  'assets/images/sources/jagran.svg',
  'assets/images/sources/hindustan.svg',
  'assets/images/sources/prabhat.svg',
  'assets/images/sources/ndtv.svg',
  'assets/images/sources/news18.svg',
  'assets/images/sources/bihar.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-192.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'data/districts.json',
  'data/i18n.json',
  'data/jobs-results.json',
  'data/emergency-helplines.json',
  'data/live-blog.json',
  'data/latest-news.json'
];

// ─── 1. Installation: Precache Core App Shell ───────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[BSH ServiceWorker] Precaching App Shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[BSH ServiceWorker] Precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── 2. Activation: Clean Up Old Caches & Claim Clients ─────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== STATIC_CACHE && name !== DATA_CACHE) {
            console.log('[BSH ServiceWorker] Removing old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[BSH ServiceWorker] Claiming clients for immediate control');
      return self.clients.claim();
    })
  );
});

// ─── 3. Fetch Routing Strategy ──────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and chrome-extension / unsupported schemes
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Strategy A: Navigation / HTML Pages -> Network First with Timeout Fallback to Cache / Offline
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetchWithTimeout(req, NETWORK_TIMEOUT_MS)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async (err) => {
          console.warn('[BSH ServiceWorker] Navigation fetch failed/timed out, falling back to cache:', err.message);
          const cachedRes = await caches.match(req);
          if (cachedRes) return cachedRes;
          // Fallback to index.html if navigating root or offline page
          const rootRes = await caches.match('index.html') || await caches.match('./');
          if (rootRes) return rootRes;
          const offlineRes = await caches.match(OFFLINE_URL);
          return offlineRes || new Response('<h1>Offline</h1><p>कृपया इंटरनेट कनेक्ट करें।</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Strategy B: News Data & Dynamic APIs -> Network First with Timeout & Data Cache Fallback
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('latest-news.json') ||
    url.pathname.includes('districts.json')
  ) {
    event.respondWith(
      fetchWithTimeout(req, API_TIMEOUT_MS)
        .then((networkRes) => {
          if (networkRes && networkRes.ok) {
            const resClone = networkRes.clone();
            caches.open(DATA_CACHE).then((cache) => {
              try {
                if (req.method === 'GET') {
                  cache.put(req.url, resClone).catch(() => {});
                  if (url.pathname.includes('news')) {
                    cache.put('/api/news', resClone.clone()).catch(() => {});
                  }
                }
              } catch (_) {}
            });
          }
          return networkRes;
        })
        .catch(async (err) => {
          console.warn('[BSH ServiceWorker] API network fetch failed, using fallback:', req.url, err?.message);
          // 1. Exact URL match in caches
          const cached = await caches.match(req);
          if (cached) return cached;
          // 2. Clean URL match without query parameters
          const cleanUrl = url.origin + url.pathname;
          const cachedClean = await caches.match(cleanUrl);
          if (cachedClean) return cachedClean;
          // 3. Fallback for news requests to /api/news or data/latest-news.json
          if (url.pathname.includes('news')) {
            const apiNews = await caches.match('/api/news');
            if (apiNews) return apiNews;
            const staticNews = await caches.match('data/latest-news.json') || await caches.match('/data/latest-news.json');
            if (staticNews) return staticNews;
          }
          // 4. Safe fallback for districts.json
          if (url.pathname.includes('districts.json')) {
            const dist = await caches.match('data/districts.json') || await caches.match('/data/districts.json');
            if (dist) return dist;
          }
          // 5. Always return a valid JSON Response instead of letting fetch fail
          return new Response(JSON.stringify({ status: 'offline', total: 0, news: [] }), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Strategy C: Static Assets (CSS, JS, Fonts, Icons) -> Stale While Revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.json'))
  ) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
            }
            return networkRes;
          })
          .catch(() => null);

        // Return cached immediately if found, else wait for network
        return cachedRes || fetchPromise;
      })
    );
    return;
  }

  // Strategy D: Images & Third-Party Assets -> Cache First with Network Fallback
  if (req.destination === 'image' || url.hostname.includes('unsplash.com') || url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(req).then((cachedRes) => {
        if (cachedRes) return cachedRes;
        return fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, resClone));
            }
            return networkRes;
          })
          .catch(() => {
            // Return placeholder or fallback icon if offline
            return caches.match('assets/icons/icon-192.png');
          });
      })
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// ─── 4. Message Handling: Instant Activation on Update ──────────────────────
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
    console.log('[BSH ServiceWorker] skipWaiting triggered via postMessage');
    self.skipWaiting();
  }
});

// ─── 5. Push Notification Support ───────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ बिहार ब्रेकिंग न्यूज़',
    body: 'बिहार की ताज़ा बड़ी खबर अभी-अभी जारी हुई है। विस्तार से पढ़ें।',
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/icon-192.png',
    url: './news.html'
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = Object.assign(data, json);
    } catch (_) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: { url: data.url },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'read', title: 'खबर पढ़ें →' },
      { action: 'close', title: 'बंद करें' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
