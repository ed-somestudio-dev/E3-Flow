// Service Worker mínimo do FluxoPro.
// Faz cache somente de assets estáticos (não de chamadas de API/Supabase).
// Network-first para navegação (sempre tenta rede e cai para cache se offline).

const CACHE = 'fluxopro-v1';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // NUNCA intercepta APIs (Supabase) ou rotas de auth — devem ir direto à rede
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/~oauth')) return;
  if (url.pathname.startsWith('/auth')) return;

  // Apenas GET
  if (req.method !== 'GET') return;

  // Network-first para HTML (navegação)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first para assets estáticos
  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached!);
      })
    );
  }
});