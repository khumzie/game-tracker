const CACHE = 'gameflow-v2'
const IMAGE_CACHE = 'gameflow-artwork-v1'
self.addEventListener('install', (event) => {
  const root = new URL('./', self.registration.scope)
  const manifest = new URL('./manifest.webmanifest', self.registration.scope)
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([root.href, manifest.href])))
})
self.addEventListener('fetch', (event) => {
  if (event.request.destination === 'image') {
    event.respondWith(caches.open(IMAGE_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      try {
        const response = await fetch(event.request)
        if (response.ok || response.type === 'opaque') await cache.put(event.request, response.clone())
        return response
      } catch {
        return new Response('', { status: 504, statusText: 'Artwork unavailable offline' })
      }
    }))
    return
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
