const CACHE_NAME = 'empleos-ya-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './empleos.js',
  './codigos.js',
  './manifest.json',
  './sitemap.xml'
];

// Instalación: Cachear activos estáticos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación: Limpiar versiones antiguas del caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Network First con Fallback a Cache (ideal para contenido dinámico como empleos)
// Si la red falla o es lenta, servimos del caché.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la respuesta es válida, la clonamos y guardamos en caché
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si falla la red (offline), intentamos servir desde el caché
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si no hay nada en caché y es una navegación de página, podríamos devolver una página offline genérica
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// Gestión de Notificaciones Push
self.addEventListener('push', (event) => {
  let data = { title: 'Empleos Ya', body: 'Nuevas vacantes disponibles.' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: 'https://via.placeholder.com/192x192/2563eb/ffffff?text=EY',
    badge: 'https://via.placeholder.com/96x96/2563eb/ffffff?text=EY',
    vibrate: [200, 100, 200],
    tag: 'new-job-notification',
    renotify: true,
    data: { url: './index.html#vacantes' },
    actions: [
      { action: 'view', title: 'Ver Vacantes' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action !== 'close') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});
