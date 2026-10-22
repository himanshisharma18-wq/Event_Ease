const CACHE_NAME = "eventease-shell-v3";
const SHELL = [
  "/",
  "/css/styles.css",
  "/css/components.css",
  "/css/responsive.css",
  "/js/app.js",
  "/js/api.js",
  "/js/utils.js",
  "/js/discovery.js",
  "/js/festival-calendar.js",
  "/js/planner.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/event-composer.js",
  "/js/venues.js",
  "/assets/diwali-lights.jpg",
  "/assets/eventease-mark.svg",
];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.destination !== "document")
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(
        async () => (await caches.match(event.request)) || caches.match("/"),
      ),
  );
});
