const CACHE = 'gameflow-v1'
self.addEventListener('install', (event) => {
  const root = new URL('./', self.registration.scope)
  const manifest = new URL('./manifest.webmanifest', self.registration.scope)
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([root.href, manifest.href])))
})
self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
