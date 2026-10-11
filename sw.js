// GymBook Service Worker – sorgt dafür, dass die App auch ohne Netz startet
// (schlechter Empfang im Gym).
//
// Strategie "Netz zuerst": Ist eine Verbindung da, kommt die Seite immer
// frisch vom Server – Updates sind also sofort aktiv und es kann keine alte
// Version "hängen bleiben" (das Problem des früheren Blob-Service-Workers).
// Nur wenn das Netz fehlt, wird die zuletzt geladene Kopie ausgeliefert.
//
// Behandelt werden ausschließlich GET-Anfragen an die eigene Adresse. Die
// Cloud (JSONBin) läuft nie über den Cache.

const CACHE = 'gymbook-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  // Caches älterer Versionen aufräumen und sofort übernehmen
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-store' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      // Offline: gespeicherte Kopie – bei Seitenaufrufen notfalls die
      // zuletzt geladene Seite, auch wenn die Adresse leicht abweicht
      // (z. B. mit/ohne "index.html" oder angehängtem "?…").
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const pages = (await cache.keys()).filter(k => k.destination === 'document' || /\.html?$|\/$/.test(new URL(k.url).pathname));
        if (pages.length) return cache.match(pages[pages.length - 1]);
      }
      throw e;
    }
  })());
});
