/* 목포 일정 페이지 오프라인 캐시 — 항상 네트워크 먼저, 끊겼을 때만 캐시 */
const CACHE = 'mokpo-v23';
const PRE = ['mokpo.html', 'mokpo.webmanifest', 'mokpo-icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mokpo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (font) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  /* 네트워크 먼저. 단, 신호가 약해 4초 넘게 걸리면 저장본을 먼저 보여 줍니다 */
  e.respondWith(new Promise(resolve => {
    let done = false;
    const cached = () => caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    });
    net.then(r => { if (!done) { done = true; resolve(r); } })
       .catch(() => cached().then(hit => { if (!done) { done = true; resolve(hit || Response.error()); } }));
    setTimeout(() => cached().then(hit => { if (hit && !done) { done = true; resolve(hit); } }), 4000);
  }));
});
