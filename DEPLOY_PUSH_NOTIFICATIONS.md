# Triển khai Push Notification (nhận thông báo kể cả khi không mở app)

Tính năng mới thêm 3 phần: client (`app.js`), service worker (`sw.js`), và
1 **Cloud Function** chạy trên server (`functions/`). Phần server là bắt
buộc — không có nó, bạn chỉ có toast trong app lúc đang mở, không có push
thật khi app đóng.

## 1. Nâng gói Firebase lên Blaze (bắt buộc)

Cloud Functions cần gói **Blaze (trả theo dùng)**. Vào Firebase Console →
chọn project `quanlycongvan-b89b3` → góc dưới trái "Upgrade" → chọn Blaze.
Blaze vẫn có hạn mức miễn phí hàng tháng rất rộng (2 triệu lượt gọi
function/tháng) — với quy mô nội bộ công ty gần như chắc chắn không tốn phí.

## 2. Tạo VAPID key (Web Push certificate)

Firebase Console → ⚙️ Project Settings → tab **Cloud Messaging** → mục
**Web configuration** → **Web Push certificates** → **Generate key pair**.
Copy chuỗi key vừa tạo, dán vào `app.js`:

```js
const VAPID_KEY_FCM = "DÁN_VAPID_KEY_CỦA_BẠN_VÀO_ĐÂY"; // ← thay bằng key thật
```

## 3. Cài Firebase CLI (nếu máy bạn chưa có)

```bash
npm install -g firebase-tools
firebase login
```

## 4. Cài dependency cho Cloud Function

```bash
cd functions
npm install
cd ..
```

## 5. Triển khai

```bash
firebase deploy --only functions,database
```

- `--only functions` deploy Cloud Function `guiPushKhiCoThongBaoMoi`.
- `--only database` đẩy `database.rules.json` (đã thêm phần `fcm_tokens`)
  lên Rules thật của project — cần thiết vì client giờ ghi thêm vào path đó.

Lần deploy function đầu tiên có thể mất 1–2 phút và CLI có thể hỏi bật thêm
API (Cloud Build, Artifact Registry, Eventarc...) — chọn "Yes"/"y" hết.

## 6. Upload lại các file client đã sửa

Upload `index.html`, `app.js`, `sw.js` lên hosting hiện tại của bạn (thay
thế 3 file cũ). `manifest.json` không đổi.

## 7. Kiểm tra

1. Mở app trên **2 trình duyệt/thiết bị khác nhau**, đăng nhập 2 tài khoản
   khác nhau (1 admin, 1 user thường).
2. Ở thiết bị user thường: khi trình duyệt hỏi quyền thông báo, chọn
   **Allow/Cho phép** — đây là bước bắt buộc, nếu từ chối sẽ không nhận
   được gì.
3. **Đóng hẳn tab/app** ở thiết bị user thường.
4. Ở thiết bị admin: gửi 1 thông báo mới (nút chuông → gửi thông báo).
5. Trong vài giây, thiết bị user thường sẽ hiện notification hệ điều hành
   dù app đang đóng. Bấm vào notification sẽ mở/focus lại app.

## Lưu ý quan trọng

- **Bắt buộc HTTPS** (hoặc `localhost` khi test local) — Web Push không
  hoạt động qua `http://` thường.
- **iOS Safari**: chỉ nhận được push nếu người dùng đã **"Thêm vào Màn hình
  chính"** (Add to Home Screen) và iOS ≥ 16.4. Mở trực tiếp bằng Safari
  (không cài ra màn hình chính) thì iOS sẽ không cho phép web push.
- Nếu 1 người dùng đăng nhập trên nhiều thiết bị, mỗi thiết bị có 1 token
  riêng dưới `fcm_tokens/{username}/` — tất cả đều nhận được push.
- Cloud Function tự dọn các token không còn hợp lệ (gỡ app, đổi trình
  duyệt...) sau mỗi lần gửi, không cần dọn tay.
