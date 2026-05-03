// ÖNEMLİ NOT: Cache versiyonu değiştiğinde sadece uygulama dosyaları güncellenir.
// Kullanıcı verileri localStorage'da saklanır ve cache güncellemeleri bu veriyi HİÇBİR ZAMAN SİLMEZ.
var CACHE_NAME = 'saat-takip-v5';
var ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Yeni versiyon yuklenince eski cache silinir (localStorage'a dokunulmaz)
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
});

// Eski cache versiyonlarini temizle (localStorage'a dokunulmaz)
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(name) {
                    return name !== CACHE_NAME;
                }).map(function(name) {
                    return caches.delete(name);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Network-first: Once internetten al, internet yoksa cache'den goster
self.addEventListener('fetch', function(event) {
    // Sadece GET isteklerini cache'le
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request).then(function(response) {
            // Basarili cevabi cache'e de kaydet
            if (response && response.status === 200) {
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        }).catch(function() {
            // Internet yoksa cache'den goster
            return caches.match(event.request);
        })
    );
});
