const CACHE_NAME = 'empleos-ya-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './empleos.js',
  './codigos.js',
  './manifest.json'
];

// Instalación: Cachear activos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activación: Limpiar caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Stale-While-Revalidate (Servir de cache mientras se actualiza)
self.addEventListener('fetch', (event) => {
  // Solo manejar peticiones GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Actualizar el cache con la nueva respuesta
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Si falla la red, ya devolvimos la respuesta del cache si existía
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Notificaciones Push (Simuladas/Base para implementación futura)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Nueva Vacante', body: 'Hay nuevas ofertas en Empleos Ya' };
  const options = {
    body: data.body,
    icon: 'https://via.placeholder.com/192x192/2563eb/ffffff?text=EY',
    badge: 'https://via.placeholder.com/96x96/2563eb/ffffff?text=EY',
    vibrate: [100, 50, 100],
    data: { url: './index.html#vacantes' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
