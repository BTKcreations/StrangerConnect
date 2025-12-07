const CACHE_NAME = 'stranger-connect-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './icon.png',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
