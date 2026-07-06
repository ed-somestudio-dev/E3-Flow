// Service Worker do FluxoPro.
// Network-first para navegação/HTML (nunca serve HTML em cache se a rede responder),
// cache-first para assets estáticos com hash. Não intercepta APIs/Supabase.
//
// IMPORTANTE: bump CACHE quando mudar a estratégia. A versão antiga é deletada
// na ativação e os clients abertos são recarregados (essencial para iOS Safari,
// que costuma ficar preso em uma versão antiga apontando para assets removidos).

const CACHE = 'fluxopro-v10';
const ASSETS = [
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/auth') || url.pathname.includes('supabase')) return;

  // Navegação (HTML)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then(cached => cached || caches.match('/')))
    );
    return;
  }

  // Assets estáticos (Vite dev server serve .ts, .tsx, .css, etc)
  const isStaticAsset = 
    ['style', 'script', 'image', 'font'].includes(req.destination) ||
    url.pathname.match(/\.(ts|tsx|js|jsx|css|png|jpg|jpeg|svg|webp|woff2)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached); // Retorna o que tiver no cache se a rede falhar
      })
    );
  }
});