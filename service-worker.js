// service-worker.js
self.addEventListener('install', function(e) {
  console.log('[ServiceWorker] Install');
});

self.addEventListener('activate', function(e) {
  console.log('[ServiceWorker] Activate');
});

// Œ»ó‚Å‚ÍA‚±‚Ìˆ—‚ğ‘‚©‚È‚¢‚ÆService Worker‚ª—LŒø‚Æ”»’è‚³‚ê‚È‚¢‚æ‚¤‚Å‚·
self.addEventListener('fetch', function(event) {});