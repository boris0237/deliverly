self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open('delivoo-static-v1').then((cache) =>
      cache.addAll(['/', '/manifest.webmanifest', '/img/icon.svg'])
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((response) => response || caches.match('/')))
  );
});
