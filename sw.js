// MI MANHWA STUDIO — trabajador offline: guarda la app y sus librerías para abrir sin internet.
const VERSION = 'mms-v29';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png'];
const CDN = /^(https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com))\//;
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // nunca guardar datos de Supabase, Fal.ai, Claude ni Claude Code
  if (url.hostname.endsWith('supabase.co') || url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;
  if (url.origin === location.origin) {
    // la app: primero internet (para recibir actualizaciones), si no hay, la copia guardada
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  if (CDN.test(req.url)) {
    // librerías y fuentes: la copia guardada primero (no cambian)
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; })));
  }
});
