/* Painel PKS como aplicativo: guarda só a tela (nunca os dados).
   Busca sempre a versão mais nova; sem internet, abre a última tela guardada.
   Não intercepta o Supabase (login e dados) nem outros sites. */
'use strict';
const CACHE = 'painel-pks-v7';
const BASE = ['./', 'app.js', 'pcp-regra.js', 'manifest.webmanifest', 'icons/icon-192-v2.png', '../config.js', '../supa.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).catch(() => null).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('painel-pks-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('.json')) return;
  e.respondWith(fetch(req).then((r) => {
    if (r.ok && !r.redirected) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(req, c)); }
    return r;
  }).catch(() => caches.match(req).then((r) => r || caches.match('./'))));
});
