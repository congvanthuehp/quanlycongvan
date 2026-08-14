// =====================================================================
// CLOUD FUNCTION: guiPushKhiCoThongBaoMoi
// Kích hoạt khi có bản ghi mới ở 'thong_bao_he_thong_danh_sach/{tbId}'
// (tức là khi admin bấm "Gửi thông báo" trong app — xem thucHienGuiThongBao
// trong app.js). Đọc toàn bộ token thiết bị đã đăng ký ở 'fcm_tokens/*',
// LOẠI TRỪ token của chính người gửi (nguoigui), rồi đẩy push tới các
// thiết bị còn lại — kể cả khi app đang đóng, vì đây chạy trên server,
// không phụ thuộc trình duyệt của ai đang mở.
//
// Cần deploy: `firebase deploy --only functions` (yêu cầu gói Blaze).
// =====================================================================

const { onValueCreated } = require("firebase-functions/v2/database");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const DATABASE_URL =
  "https://quanlycongvan-b89b3-default-rtdb.asia-southeast1.firebasedatabase.app";

exports.guiPushKhiCoThongBaoMoi = onValueCreated(
  {
    ref: "/thong_bao_he_thong_danh_sach/{tbId}",
    instance: "quanlycongvan-b89b3-default-rtdb",
    region: "asia-southeast1",
  },
  async (event) => {
    const thongBao = event.data.val();
    if (!thongBao) return;

    const nguoiGui = thongBao.nguoigui || "";
    const noiDung = (thongBao.noidung || "").slice(0, 200);

    const db = admin.database(admin.app(), DATABASE_URL);

    // 1. Lấy toàn bộ token đã đăng ký, gộp theo username để biết token nào
    //    thuộc về chính người gửi (để loại trừ) và để dọn token hỏng sau này.
    const tokensSnap = await db.ref("fcm_tokens").once("value");
    if (!tokensSnap.exists()) {
      logger.log("Không có thiết bị nào đăng ký nhận push.");
      return;
    }

    const danhSachToken = []; // [{ username, token }]
    tokensSnap.forEach((userSnap) => {
      const username = userSnap.key;
      if (username === nguoiGui) return; // Không gửi lại cho chính người gửi
      userSnap.forEach((tokenSnap) => {
        danhSachToken.push({ username, token: tokenSnap.key });
      });
    });

    if (danhSachToken.length === 0) {
      logger.log("Không có thiết bị nào (ngoài người gửi) để gửi push.");
      return;
    }

    // 2. Gửi dạng "data-only" (không kèm 'notification') để sw.js tự kiểm
    //    soát việc hiển thị (xem setBackgroundMessageHandler trong sw.js).
    const message = {
      data: {
        title: "Công Văn Nội Bộ - Thông báo mới",
        body: `${nguoiGui}: ${noiDung}`,
      },
      tokens: danhSachToken.map((t) => t.token),
    };

    // FCM giới hạn tối đa 500 token / lần gọi sendEachForMulticast.
    const KICH_THUOC_LO = 500;
    const tokenBiHong = [];

    for (let i = 0; i < danhSachToken.length; i += KICH_THUOC_LO) {
      const lo = danhSachToken.slice(i, i + KICH_THUOC_LO);
      const ketQua = await admin.messaging().sendEachForMulticast({
        data: message.data,
        tokens: lo.map((t) => t.token),
      });

      ketQua.responses.forEach((res, idx) => {
        if (!res.success) {
          const maLoi = res.error && res.error.code;
          // Token không còn hợp lệ (gỡ cài đặt, hết hạn, đổi trình duyệt...)
          if (
            maLoi === "messaging/registration-token-not-registered" ||
            maLoi === "messaging/invalid-registration-token"
          ) {
            tokenBiHong.push(lo[idx]);
          } else {
            logger.warn("Gửi push thất bại:", lo[idx].username, maLoi);
          }
        }
      });
    }

    // 3. Dọn dẹp các token không còn hợp lệ khỏi Realtime Database.
    if (tokenBiHong.length > 0) {
      const capNhat = {};
      tokenBiHong.forEach((t) => {
        capNhat[`fcm_tokens/${t.username}/${t.token}`] = null;
      });
      await db.ref().update(capNhat);
      logger.log(`Đã dọn ${tokenBiHong.length} token hết hạn.`);
    }

    logger.log(`Đã gửi push tới ${danhSachToken.length - tokenBiHong.length} thiết bị.`);
  }
);
