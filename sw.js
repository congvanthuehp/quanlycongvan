// =====================================================================
// SERVICE WORKER - QUẢN LÝ CÔNG VĂN NỘI BỘ
// Chỉ cache "khung" giao diện (app shell) để mở nhanh + cài đặt được PWA.
// Dữ liệu công văn luôn lấy trực tiếp từ Firebase (online), KHÔNG cache
// để tránh hiển thị dữ liệu cũ/sai.
// =====================================================================
const CACHE_NAME = 'quanlycongvan-cache-v1';
const APP_SHELL = [
  './index.html',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Cài đặt: lưu trước các file khung giao diện
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Kích hoạt: dọn cache phiên bản cũ
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first cho mọi request — luôn ưu tiên lấy bản mới nhất từ
// mạng (đặc biệt quan trọng vì app.js hay được cập nhật); chỉ dùng cache
// làm phương án dự phòng khi mất mạng.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Chỉ cache lại các file thuộc app shell, bỏ qua Firebase/API
        const url = event.request.url;
        const isShellFile = APP_SHELL.some(f => url.includes(f.replace('./', '')));
        if (isShellFile && response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
