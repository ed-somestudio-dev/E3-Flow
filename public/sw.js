// Service Worker do FluxoPro.
// Network-first para navegação/HTML (nunca serve HTML em cache se a rede responder),
// cache-first para assets estáticos com hash. Não intercepta APIs/Supabase.
//
// IMPORTANTE: bump CACHE quando mudar a estratégia. A versão antiga é deletada
// na ativação e os clients abertos são recarregados (essencial para iOS Safari,
// que costuma ficar preso em uma versão antiga apontando para assets removidos).

const CACHE = 'fluxopro-v4';
// Apenas assets estáveis (sem hash) entram no precache. NÃO incluímos
// '/' nem '/index.html' aqui — eles devem ser sempre buscados via network-first
// para que o HTML referencie as URLs de bundle atuais.
const ASSETS = ['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()).then(async () => {
      // Recarrega abas abertas quando a versão muda, para que clientes iOS
      // que estavam presos numa versão antiga voltem a funcionar.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (_) { /* noop */ }
      }
    })
  );
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

  // Network-first para HTML (navegação). Em caso de falha de rede, tenta o
  // cache; senão, retorna o index.html cacheado. NUNCA serve HTML antigo
  // se a rede responder, evitando "tela branca" por assets ausentes.
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

  // Cache-first para assets estáticos (com hash do Vite — imutáveis)
  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            // Só cacheia respostas OK
            if (!res || res.status !== 200) return res;
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached!);
      })
    );
  }
});