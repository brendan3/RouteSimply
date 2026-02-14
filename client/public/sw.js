const CACHE_NAME = "routesimply-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
];

// Install: cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache WebSocket connections
  if (url.pathname === "/ws") return;

  // Network-first for API requests
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache GET requests
          if (request.method === "GET" && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for offline support
          return caches.match(request);
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const title = data.title || "RouteSimply";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/",
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const client = clients.find((c) => c.url === event.notification.data);
      if (client) return client.focus();
      return self.clients.openWindow(event.notification.data);
    })
  );
});
