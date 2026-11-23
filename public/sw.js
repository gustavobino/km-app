/* Km+ service worker — keeps the app shell available offline.
 *
 * Strategy:
 * - Hashed build assets (/_next/static/*), fonts and icons: cache-first (immutable).
 * - Page navigations: network-first, falling back to the cached page, then to
 *   the cached /registrar shell (the driver can always log a day offline).
 * - Everything else (API, Supabase, payments): network only, never cached.
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const STATIC_CACHE = `kmplus-static-${VERSION}`;
const PAGE_CACHE = `kmplus-pages-${VERSION}`;
const APP_ROUTES = ["/registrar", "/painel", "/painel/lucro", "/simulador", "/insights"];
const OFFLINE_FALLBACK = "/registrar";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => Promise.allSettled(APP_ROUTES.map((route) => cache.add(route))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kmplus-") && ![STATIC_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = (await cache.match(request, { ignoreSearch: true })) || (await cache.match(OFFLINE_FALLBACK));
    if (cached) return cached;
    return new Response("Sem conexão. Abra o Km+ de novo quando tiver sinal.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
