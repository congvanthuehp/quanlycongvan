// =====================================================================
// SERVICE WORKER - QUẢN LÝ CÔNG VĂN NỘI BỘ
// Chỉ cache "khung" giao diện (app shell) để mở nhanh + cài đặt được PWA.
// Dữ liệu công văn luôn lấy trực tiếp từ Firebase (online), KHÔNG cache
// để tránh hiển thị dữ liệu cũ/sai.
// =====================================================================
const CACHE_NAME = 'quanlycongvan-cache-v2';
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

// Cài đặt: lưu trước các file khung giao diện.
// LƯU Ý QUAN TRỌNG: KHÔNG dùng cache.addAll() ở đây. addAll() có tính "tất cả
// hoặc không" — chỉ cần 1 file trong APP_SHELL trả về 404 là cả promise bị
// reject, khiến install thất bại, skipWaiting() không chạy và service worker
// MỚI KHÔNG BAO GIỜ ĐƯỢC KÍCH HOẠT. Khi đó service worker cũ vẫn tiếp tục điều
// khiển trang và phục vụ bản index.html/app.js cũ — mọi thay đổi code đều như
// không có tác dụng. Cache từng file riêng lẻ để 1 file thiếu không giết cả SW.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        APP_SHELL.map(file =>
          cache.add(file).catch(err =>
            console.warn('[SW] Bỏ qua file không cache được:', file, err)
          )
        )
      ))
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

// Fetch: Network-first cho file cùng origin — luôn ưu tiên lấy bản mới nhất từ
// mạng (đặc biệt quan trọng vì app.js hay được cập nhật); chỉ dùng cache
// làm phương án dự phòng khi mất mạng.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return; // URL lạ - để trình duyệt tự xử lý
  }

  // TUYỆT ĐỐI KHÔNG đụng vào request cross-origin (SDK Firebase, FullCalendar,
  // SheetJS trên CDN, kết nối realtime của Firebase Database, Google Fonts...).
  // Nếu ta gọi respondWith() cho chúng mà mạng trục trặc, caches.match() trả về
  // undefined -> respondWith(undefined) làm request HỎNG HẲN. Khi đó SDK Firebase
  // không tải được, app.js ném lỗi ngay tại firebase.initializeApp() và TOÀN BỘ
  // code phía sau ngừng chạy (biến `calendar` không được tạo -> lịch họp trắng
  // và onchange của ô lọc báo "calendar is not defined").
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(response => {
        // Chỉ cache lại các file thuộc app shell
        const isShellFile = APP_SHELL.some(f => url.pathname.endsWith(f.replace('./', '')));
        if (isShellFile && response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      })
      // Mất mạng: dùng cache nếu có. LUÔN phải trả về một Response hợp lệ -
      // không bao giờ để undefined lọt vào respondWith().
      .catch(() => caches.match(req).then(hit => hit || new Response(
        'Ngoại tuyến - không có bản lưu trong bộ nhớ đệm.',
        { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )))
  );
});
