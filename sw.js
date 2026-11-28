'use strict';
// Service worker: l'app si apre anche senza rete.
// - guscio dell'app (pagina, stile, script, icone, archivio): salvato subito alla prima visita, aggiornato in sottofondo;
// - archivio delle ricerche: prima la rete (dati freschi), se manca la rete l'ultima copia salvata.
// Cambiare VERSIONE quando si modificano i file del guscio, per forzare l'aggiornamento.
const VERSIONE = 'v1';
const CACHE = 'ricerca-' + VERSIONE;
const GUSCIO = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icone/icona-192.png', 'icone/icona-512.png', 'icone/icona-maschera-512.png', 'icone/icona.svg',
  'icone/apple-touch-icon.png', 'icone/favicon-32.png', 'data/archivio.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((nomi) => Promise.all(nomi.filter((n) => n.startsWith('ricerca-') && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // i link alle fonti esterne non passano di qui

  if (url.pathname.endsWith('/data/archivio.json')) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req)));
    return;
  }

  // stale-while-revalidate per il guscio
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((inCache) => {
    const rete = fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => inCache);
    return inCache || rete;
  }));
});
