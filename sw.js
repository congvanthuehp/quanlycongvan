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

// =====================================================================
// PUSH NOTIFICATION (FCM) — chạy được cả khi app/tab đang đóng.
// Dùng chung service worker này (thay vì 1 file firebase-messaging-sw.js
// riêng) vì trình duyệt chỉ cho 1 service worker hoạt động ở scope gốc "/"
// tại 1 thời điểm — đăng ký 2 file SW riêng ở cùng scope sẽ ghi đè nhau.
// =====================================================================
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyCi3UUhmd_D2GvzIPY-pHnPCx4fSVGxI68",
  authDomain: "quanlycongvan-b89b3.firebaseapp.com",
  databaseURL: "https://quanlycongvan-b89b3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "quanlycongvan-b89b3",
  storageBucket: "quanlycongvan-b89b3.firebasestorage.app",
  messagingSenderId: "914250159888",
  appId: "1:914250159888:web:f770882f6afa01e5b1f795"
});

const messaging = firebase.messaging();

// Cloud Function gửi message dạng "data-only" (không có key "notification")
// để ta tự kiểm soát nội dung/hành vi hiển thị thay vì để trình duyệt tự vẽ.
messaging.setBackgroundMessageHandler(payload => {
  let data = payload.data || {};
  let tieuDe = data.title || 'Công Văn Nội Bộ';
  let noiDung = data.body || 'Bạn có thông báo mới';

  return self.registration.showNotification(tieuDe, {
    body: noiDung,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'thong-bao-he-thong',
    data: { url: './index.html' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

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
