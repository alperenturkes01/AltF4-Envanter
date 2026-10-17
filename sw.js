// ==========================================
// ALTF4 ENVANTER SİSTEMİ - SERVICE WORKER (SW.JS)
// ==========================================

const CACHE_NAME = "altf4-envanter-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/fuzzySearch.js",
  "./js/db.js",
  "./js/auth.js",
  "./js/scanner.js",
  "./js/app.js",
  "./manifest.json"
];

// Yükleme Aşaması
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Statik varlıklar önbelleğe alınıyor...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Etkinleştirme Aşaması (Eski önbellekleri temizleme)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("🧹 Eski önbellek siliniyor:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// İstek Yakalama (Network-First with Cache Fallback)
self.addEventListener("fetch", (event) => {
  // Yalnızca GET istekleri
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Ağ isteği başarılıysa önbelleği güncelle
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Çevrimdışı durumda önbellekten sun
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Sayfa isteğiyse ana sayfayı döndür
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});

