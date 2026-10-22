const CACHE = 'gameflow-app-v4'
const IMAGE_CACHE = 'gameflow-artwork-v1'

self.addEventListener('install', (event) => {
  const root = new URL('./', self.registration.scope)
  const manifest = new URL('./manifest.webmanifest', self.registration.scope)
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([root.href, manifest.href]))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('gameflow-') && key !== CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
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

  const requestUrl = new URL(event.request.url)
  const isFreshRequest = event.request.mode === 'navigate'
    || requestUrl.pathname.endsWith('/manifest.webmanifest')
    || requestUrl.pathname.includes('/catalog/')
  if (isFreshRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === 'GET') {
            const responseCopy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, responseCopy))
          }
          return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(new URL('./', self.registration.scope).href))),
    )
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
