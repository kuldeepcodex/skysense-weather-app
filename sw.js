/**
 * sw.js — SkySense Service Worker
 *
 * Strategy:
 *   • INSTALL  → pre-cache the app shell (static assets)
 *   • ACTIVATE → clean up old caches
 *   • FETCH    →
 *       - App-shell requests: Cache-First (serve from cache, fall back to network)
 *       - API requests (/api/*): Network-First, fall back to a cached
 *         response; attach a `sw-timestamp` header so the UI can show
 *         "Last updated: <time>".
 */

const SHELL_CACHE  = 'skysense-shell-v3';
const API_CACHE    = 'skysense-api-v3';

// ── App-shell assets to pre-cache on install ──────────────────────────────
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/src/animations.js',
    '/src/api.js',
    '/src/cache.js',
    '/src/state.js',
    '/src/ui.js',
    '/src/utils.js',
];

// ── Install: cache the app shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) => {
            // Cache assets individually so one missing file doesn't brick the install.
            return Promise.allSettled(
                SHELL_ASSETS.map((url) =>
                    fetch(url)
                        .then((res) => {
                            if (res.ok) cache.put(url, res);
                        })
                        .catch(() => {})
                )
            );
        })
    );
    self.skipWaiting();
});

// ── Activate: remove stale caches ────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== SHELL_CACHE && k !== API_CACHE)
                    .map((k) => caches.delete(k))
            )
        )
    );
    // Take control of all clients immediately
    self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin and /api/* requests
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/')) {
        // Network-first for API calls
        event.respondWith(networkFirstAPI(request));
    } else {
        // Cache-first for app shell
        event.respondWith(cacheFirstShell(request));
    }
});

// ── Cache-first: app shell ────────────────────────────────────────────────
async function cacheFirstShell(request) {
    const cached = await caches.match(request, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        // If both cache and network fail, nothing we can do for shell assets
        return new Response('Offline', { status: 503 });
    }
}

// ── Network-first: API calls ──────────────────────────────────────────────
async function networkFirstAPI(request) {
    const cache = await caches.open(API_CACHE);
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            // Store with a timestamp custom header for the UI
            const cloned = networkResponse.clone();
            const body   = await cloned.json();
            const stamped = new Response(JSON.stringify(body), {
                status:  networkResponse.status,
                headers: {
                    'Content-Type': 'application/json',
                    'sw-timestamp': new Date().toISOString(),
                    'sw-from-cache': 'false',
                },
            });
            cache.put(request, stamped.clone());
            return stamped;
        }
        throw new Error('Network response not ok');
    } catch {
        // Network failed — try the cache
        const cached = await cache.match(request);
        if (cached) {
            // Re-attach offline flag so the page can display the banner
            const body      = await cached.json();
            const timestamp = cached.headers.get('sw-timestamp') || '';
            return new Response(JSON.stringify(body), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'sw-timestamp':   timestamp,
                    'sw-from-cache':  'true',
                },
            });
        }
        // Nothing cached either
        return new Response(
            JSON.stringify({ error: 'You are offline and no cached data is available.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
