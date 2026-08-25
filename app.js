    // =====================================================================
    // CHẾ ĐỘ SÁNG/TỐI (Dark mode) — áp dụng ngay khi script chạy để tránh
    // nháy sáng trước khi CSS override kịp đọc lựa chọn đã lưu của người dùng.
    // =====================================================================
    (function initTheme() {
        let daLuu = localStorage.getItem('cv_theme');
        if (daLuu === 'dark' || daLuu === 'light') {
            document.documentElement.setAttribute('data-theme', daLuu);
        }
    })();

    function dangODangToi() {
        let daLuu = localStorage.getItem('cv_theme');
        if (daLuu === 'dark') return true;
        if (daLuu === 'light') return false;
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    function capNhatIconTheme() {
        let icon = dangODangToi() ? '☀️' : '🌙';
        document.querySelectorAll('.btn-theme-toggle').forEach(btn => btn.innerText = icon);
    }

    function toggleDarkMode() {
        let toiMoi = !dangODangToi();
        document.documentElement.setAttribute('data-theme', toiMoi ? 'dark' : 'light');
        localStorage.setItem('cv_theme', toiMoi ? 'dark' : 'light');
        capNhatIconTheme();
    }

    document.addEventListener('DOMContentLoaded', capNhatIconTheme);

    const firebaseConfig = {
      apiKey: "AIzaSyCi3UUhmd_D2GvzIPY-pHnPCx4fSVGxI68",
      authDomain: "quanlycongvan-b89b3.firebaseapp.com",
      databaseURL: "https://quanlycongvan-b89b3-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "quanlycongvan-b89b3",
      storageBucket: "quanlycongvan-b89b3.firebasestorage.app",
      messagingSenderId: "914250159888",
      appId: "1:914250159888:web:f770882f6afa01e5b1f795",
      measurementId: "G-XWZHVF4RYM"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    // Khóa VAPID (Web Push certificate) lấy tại:
    // Firebase Console → Project Settings → Cloud Messaging → Web configuration → Web Push certificates
    // Phải điền khóa thật vào đây thì xin quyền + lấy token FCM mới hoạt động.
    const VAPID_KEY_FCM = "BNbpU-Ux3HTIY2qjk1wz7-SryQx-8sNwoxuNeJd9NHgi-gQWDAHnIQC8qxNrC1DX3QGWCLV4E9OvjcJJ07NpJrE";

    let danhSachCongVan = [];
    let isAdmin = false; 
    let boLocHienTai = "Tất cả"; 

    // Danh sách tài khoản người dùng thông thường
    const danhSachUserThuong = ["NVDTPC", "KT1", "KT2", "QLDN", "HKD1", "HKD2", "HKD3", "HC", "Thukhac", "truongtcs", "photruongtcs"];

    // =====================================================================
    // TIỆN ÍCH BẢO MẬT & GIAO DIỆN DÙNG CHUNG
    // =====================================================================

    // Chống XSS: mọi dữ liệu do người dùng nhập (kể cả từ Excel import) đều
    // phải đi qua hàm này trước khi gắn vào innerHTML, vì nội dung công văn/
    // lịch họp/thông báo được hiển thị lại cho MỌI người dùng khác.
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Toast hiện đại thay thế alert() mặc định của trình duyệt
    function showToast(message, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        let icon = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }[type] || 'ℹ️';
        let toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-msg">${escapeHtml(message)}</div>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }

    // Hộp thoại xác nhận hiện đại thay thế confirm() mặc định (bất đồng bộ - dùng await/then)
    function showConfirm(message, opts = {}) {
        return new Promise(resolve => {
            let overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-box">
                    <div class="confirm-icon">${opts.danger ? '⚠️' : '❓'}</div>
                    <div class="confirm-msg">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
                    <div class="confirm-actions">
                        <button type="button" class="btn-huy confirm-cancel">Hủy bỏ</button>
                        <button type="button" class="${opts.danger ? 'btn-confirm-danger' : 'btn-luu'} confirm-ok">${escapeHtml(opts.okText || 'Đồng ý')}</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('show'));
            function dong(ketQua) {
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 180);
                resolve(ketQua);
            }
            overlay.querySelector('.confirm-cancel').addEventListener('click', () => dong(false));
            overlay.querySelector('.confirm-ok').addEventListener('click', () => dong(true));
            overlay.addEventListener('click', e => { if (e.target === overlay) dong(false); });
        });
    }

    // Giới hạn số lần đăng nhập sai (chống dò mật khẩu tự động - defense in depth,
    // KHÔNG thay thế cho việc kiểm tra mật khẩu ở phía server)
    const SO_LAN_SAI_TOI_DA = 5;
    const THOI_GIAN_KHOA_MS = 60 * 1000;

    function laySoLanSai() {
        return parseInt(localStorage.getItem('cv_login_fail_count') || '0', 10);
    }
    function layThoiDiemKhoa() {
        return parseInt(localStorage.getItem('cv_login_lock_until') || '0', 10);
    }
    function ghiNhanDangNhapSai() {
        let soLan = laySoLanSai() + 1;
        localStorage.setItem('cv_login_fail_count', String(soLan));
        if (soLan >= SO_LAN_SAI_TOI_DA) {
            localStorage.setItem('cv_login_lock_until', String(Date.now() + THOI_GIAN_KHOA_MS));
            localStorage.setItem('cv_login_fail_count', '0');
        }
    }
    function xoaDemDangNhapSai() {
        localStorage.removeItem('cv_login_fail_count');
        localStorage.removeItem('cv_login_lock_until');
    }

    function dangNhap() {
        let khoaDenLuc = layThoiDiemKhoa();
        if (khoaDenLuc > Date.now()) {
            let giaySau = Math.ceil((khoaDenLuc - Date.now()) / 1000);
            document.getElementById('loginError').innerText = `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${giaySau} giây.`;
            document.getElementById('loginError').style.display = "block";
            return;
        }

        let u = document.getElementById('username').value.trim();
        let p = document.getElementById('password').value.trim();

        let loginErrorEl = document.getElementById('loginError');
        loginErrorEl.innerText = "Sai tài khoản hoặc mật khẩu!";

        if (p === '123' && (u === 'admin' || danhSachUserThuong.includes(u))) {
            auth.signInAnonymously()
                .then(() => {
                    localStorage.setItem('cv_user', u);
                    localStorage.setItem('cv_role', u === 'admin' ? 'admin' : 'user');
                    xoaDemDangNhapSai();
                    loginErrorEl.style.display = "none";
                })
                .catch(err => showToast("Lỗi Firebase: " + err.message, 'error'));
        } else {
            ghiNhanDangNhapSai();
            loginErrorEl.style.display = "block";
        }
    }

    async function dangXuat() {
        let username = localStorage.getItem('cv_user');
        await xoaPushTokenHienTai(username);
        auth.signOut().then(() => {
            localStorage.removeItem('cv_user');
            localStorage.removeItem('cv_role');
        });
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            let role = localStorage.getItem('cv_role');
            let username = localStorage.getItem('cv_user');
            if (!role) { dangXuat(); return; }

            document.getElementById('loginScreen').style.display = "none";
            document.getElementById('mainApp').style.display = "block";
            document.getElementById('userInfo').innerText = "Xin chào: " + username;

            // Xử lý Phân quyền hiển thị giao diện
            if(role === 'admin') {
                isAdmin = true;
                document.getElementById('btnAdd').style.display = "block";
                document.getElementById('btnExcel').style.display = "block"; 
                
                // SỬA Ở ĐÂY:
                if(document.getElementById('btnGuiThongBaoAdmin')) {
                    document.getElementById('btnGuiThongBaoAdmin').style.display = "inline-block";
                }
            } else {
                isAdmin = false;
                document.getElementById('btnAdd').style.display = "none";
                document.getElementById('btnExcel').style.display = "none";
                
                // SỬA Ở ĐÂY:
                if(document.getElementById('btnGuiThongBaoAdmin')) {
                    document.getElementById('btnGuiThongBaoAdmin').style.display = "none";
                }
            }
            
            document.getElementById('cotHanhDong').style.display = "table-cell";
            taiDuLieuTuFirebase();
            // Chỉ đăng ký các listener này SAU khi đã có session Firebase, vì
            // Rules yêu cầu auth != null (xem chú thích ở khoiTaoLangNgheThongBao).
            khoiTaoLangNgheThongBao();
            khoiTaoLangNgheLichHop();
            khoiTaoPushNotification(username);
        } else {
            document.getElementById('loginScreen').style.display = "block";
            document.getElementById('mainApp').style.display = "none";
        }
    });

    function taiDuLieuTuFirebase() {
        db.ref('cong_van').on('value', snapshot => {
            danhSachCongVan = [];
            snapshot.forEach(child => {
                danhSachCongVan.push({ key: child.key, ...child.val() });
            });
            hienThiBang();
        });
    }

    function luuCongVan() {
        let cvId = document.getElementById('cvId').value;
        let usernameHienTai = localStorage.getItem('cv_user') || 'Ẩn danh';
        let trangThaiMoi = document.getElementById('trangThai').value;
        let ngayHoanThanhMoi = document.getElementById('ngayHoanThanh').value;

        if (isAdmin) {
            let cv = {
                ngayDen: document.getElementById('ngayDen').value || '',
                soDen: document.getElementById('soDen').value || '',
                coQuanGui: document.getElementById('coQuanGui').value || '',
                soKyHieu: document.getElementById('soKyHieu').value || '',
                ngayVB: document.getElementById('ngayVB').value || '',
                trichYeu: document.getElementById('trichYeu').value || '',
                bpChuTri: document.getElementById('bpChuTri').value || '',
                bpPhoiHop: document.getElementById('bpPhoiHop').value || '',
                hanXuLy: document.getElementById('hanXuLy').value || '',
                soNgayCon: document.getElementById('soNgayCon').value || '',
                lapLai: document.getElementById('lapLai').value || '',
                trangThai: trangThaiMoi || '',
                ngayHoanThanh: ngayHoanThanhMoi || '',
                tuanBC: document.getElementById('tuanBC').value || '',
                canhBao: document.getElementById('canhBao').value || ''
            };

            if(!cv.trichYeu) { showToast("Vui lòng nhập Trích yếu nội dung!", 'warning'); return; }

            if(cvId) {
                let cvHienTai = danhSachCongVan.find(item => item.key === cvId);
                if(cvHienTai && cvHienTai.lichSuSua) {
                    cv.lichSuSua = cvHienTai.lichSuSua;
                }
                db.ref('cong_van/' + cvId).update(cv).then(() => dongForm());
            } else {
                db.ref('cong_van').push(cv).then(() => dongForm());
            }
        } else {
            if(!cvId) { showToast("Bạn không có quyền thêm mới công văn!", 'warning'); return; }

            let cvHienTai = danhSachCongVan.find(item => item.key === cvId);
            if(!cvHienTai) return;

            let mangLichSu = cvHienTai.lichSuSua || [];
            let thoiGianHienTai = new Date().toLocaleString('vi-VN');
            
            mangLichSu.push({
                user: usernameHienTai,
                trangThai: trangThaiMoi,
                ngayHoanThanh: ngayHoanThanhMoi,
                thoiGian: thoiGianHienTai
            });

            let duLieuCapNhatCuaUser = {
                trangThai: trangThaiMoi,
                ngayHoanThanh: ngayHoanThanhMoi,
                lichSuSua: mangLichSu
            };

            db.ref('cong_van/' + cvId).update(duLieuCapNhatCuaUser)
                .then(() => {
                    showToast("Cập nhật trạng thái công văn thành công!", 'success');
                    dongForm();
                })
                .catch(err => showToast("Lỗi khi cập nhật dữ liệu: " + err.message, 'error'));
        }
    }

    async function xoaCongVan(key) {
        if(!isAdmin) return;
        let dongY = await showConfirm("Bạn có chắc chắn muốn XÓA công văn này không?", { danger: true, okText: 'Xóa' });
        if(dongY) {
            db.ref('cong_van/' + key).remove();
        }
    }

    function tinhToanThoiHan() {
        let hanStr = document.getElementById('hanXuLy').value;
        if(!hanStr) return;
        let homNay = new Date(); homNay.setHours(0,0,0,0);
        let hanXuLy = new Date(hanStr); hanXuLy.setHours(0,0,0,0);
        let soNgay = Math.ceil((hanXuLy.getTime() - homNay.getTime()) / (1000 * 3600 * 24));
        document.getElementById('soNgayCon').value = soNgay;

        let txt = "Trong hạn";
        if(soNgay < 0) { txt = "Quá hạn"; document.getElementById('trangThai').value = "Quá hạn"; }
        else if(soNgay === 0) txt = "Hạn cuối cùng";
        else if(soNgay <= 3) txt = "Sắp hết hạn";
        document.getElementById('canhBao').value = txt;
    }

    function tinhTuanBC() {
        let ngayDenVal = document.getElementById('ngayDen').value;
        if (ngayDenVal) {
            let d = new Date(ngayDenVal);
            let day = d.getDate();
            let month = d.getMonth() + 1;
            let year = d.getFullYear();
            let week = Math.ceil(day / 7);
            document.getElementById('tuanBC').value = `Tuần ${week} - T${month}/${year}`;
        } else {
            document.getElementById('tuanBC').value = '';
        }
    }

    /* ========================================= */
    /* HÀM JS: ẨN/HIỆN BỘ LỌC THÔNG MINH (CLICK) */
    /* ========================================= */
    function toggleBoLoc() {
        let khuVuc = document.getElementById("khuVucBoLoc");
        let btn = document.getElementById("btnToggleFilter");
        
        if (khuVuc.style.display === "none") {
            khuVuc.style.display = "flex"; // Khôi phục lại flex layout ban đầu của lớp css advanced-filters
            btn.innerHTML = "🔼 Ẩn Bộ Lọc Thông Minh";
            btn.style.background = "#007bff";
        } else {
            khuVuc.style.display = "none";
            btn.innerHTML = "🔽 Hiện Bộ Lọc Thông Minh";
            btn.style.background = "#28a745";
        }
    }

    /* ========================================================= */
    /* HOÀN THIỆN HÀM IMPORT EXCEL VÀ CÁC HÀM PHÍA DƯỚI CỦA BẠN */
    /* ========================================================= */
    async function importExcel(element) {
        if (!isAdmin) { showToast("Bạn không có quyền thao tác!", 'warning'); return; }
        let file = element.files[0];
        if (!file) return;

        let reader = new FileReader();
        reader.onload = async function (e) {
            try {
                let data = new Uint8Array(e.target.result);
                let workbook = XLSX.read(data, { type: 'array' });
                let firstSheetName = workbook.SheetNames[0];
                let worksheet = workbook.Sheets[firstSheetName];

                let jsonData = XLSX.utils.sheet_to_json(worksheet);
                if (jsonData.length === 0) { showToast("File Excel trống hoặc lỗi định dạng!", 'warning'); element.value = ''; return; }

                let dongY = await showConfirm("Tìm thấy " + jsonData.length + " hàng dữ liệu. Tiến hành import vào hệ thống?", { okText: 'Import' });
                if (dongY) {
                    let currentDataMap = {};
                    danhSachCongVan.forEach(cv => {
                        if (cv.soDen) {
                            let keySoDen = String(cv.soDen).toLowerCase().trim();
                            currentDataMap[keySoDen] = cv.key;
                        }
                    });

                    let successAddCount = 0;
                    let successUpdateCount = 0;
                    
                    let parseDate = (val) => {
                        if (!val) return '';
                        if (typeof val === 'number') { 
                            let d = new Date((val - 25569) * 86400 * 1000);
                            return d.toISOString().split('T')[0];
                        }
                        if (typeof val === 'string') {
                            if (val.includes('/')) {
                                let parts = val.split('/');
                                if(parts[2] && parts[2].length === 4) return parts[2] + "-" + parts[1].padStart(2,'0') + "-" + parts[0].padStart(2,'0');
                            }
                            return val.trim();
                        }
                        return '';
                    };

                    jsonData.forEach(row => {
                        let hanXL = parseDate(row['Hạn xử lý'] || row['hanXuLy']);
                        let ngayDenParsed = parseDate(row['Ngày đến'] || row['ngayDen']);
                        
                        let soNgayCon = '';
                        let canhBao = '';
                        if (hanXL) {
                            let homNay = new Date(); homNay.setHours(0,0,0,0);
                            let targetDate = new Date(hanXL); targetDate.setHours(0,0,0,0);
                            soNgayCon = Math.ceil((targetDate.getTime() - homNay.getTime()) / (1000 * 3600 * 24));
                            
                            canhBao = "Trong hạn";
                            if(soNgayCon < 0) canhBao = "Quá hạn";
                            else if(soNgayCon === 0) canhBao = "Hạn cuối cùng";
                            else if(soNgayCon <= 3) canhBao = "Sắp hết hạn";
                        }

                        let defaultTuanBC = '';
                        if (ngayDenParsed) {
                            let d = new Date(ngayDenParsed);
                            if (!isNaN(d)) {
                                let day = d.getDate();
                                let month = d.getMonth() + 1;
                                let year = d.getFullYear();
                                let week = Math.ceil(day / 7);
                                defaultTuanBC = "Tuần " + week + " - T" + month + "/" + year;
                            }
                        }

                        let cv = {
                            ngayDen: ngayDenParsed,
                            soDen: String(row['Số đến'] || row['soDen'] || '').trim(),
                            coQuanGui: row['Cơ quan gửi'] || row['coQuanGui'] || '',
                            soKyHieu: row['Số ký hiệu VB'] || row['soKyHieu'] || '',
                            ngayVB: parseDate(row['Ngày VB'] || row['ngayVB']),
                            trichYeu: row['Trích yếu nội dung'] || row['trichYeu'] || '',
                            bpChuTri: row['BP Chủ trì'] || row['bpChuTri'] || '',
                            bpPhoiHop: row['BP Phối hợp'] || row['bpPhoiHop'] || '',
                            hanXuLy: hanXL,
                            soNgayCon: soNgayCon,
                            canhBao: canhBao,
                            tuanBC: row['Tuần BC'] || row['tuanBC'] || defaultTuanBC,
                            lapLai: row['Lặp lại'] || row['lapLai'] || 'Một lần',
                            trangThai: row['Trạng thái'] || row['trangThai'] || 'Chưa xử lý',
                            ngayHoanThanh: parseDate(row['Ngày hoàn thành'] || row['ngayHoanThanh'])
                        };

                        if (!cv.trichYeu) return;

                        let cleanSoDen = String(cv.soDen).toLowerCase().trim();
                        if (cleanSoDen && currentDataMap[cleanSoDen]) {
                            let existingKey = currentDataMap[cleanSoDen];
                            db.ref('cong_van/' + existingKey).update(cv);
                            successUpdateCount++;
                        } else {
                            db.ref('cong_van').push(cv);
                            successAddCount++;
                        }
                    });
                    showToast("Import hoàn thành! Thêm mới: " + successAddCount + ", Cập nhật: " + successUpdateCount, 'success');
                }
            } catch (error) {
                showToast("Lỗi import file: " + error.message, 'error');
            }
            element.value = '';
        };
        reader.readAsArrayBuffer(file);
    }

    function thayDoiBoLoc(status) {
        boLocHienTai = status;
        document.querySelectorAll('.counter-card').forEach(card => card.classList.remove('active'));
        if(status === 'Tất cả') document.getElementById('card-All').classList.add('active');
        else if(status === 'Chưa xử lý') document.getElementById('card-ChuaXuLy').classList.add('active');
        else if(status === 'Đang xử lý') document.getElementById('card-DangXuLy').classList.add('active');
        else if(status === 'Hoàn thành') document.getElementById('card-HoanThanh').classList.add('active');
        else if(status === 'Quá hạn') document.getElementById('card-QuaHan').classList.add('active');
        else if(status === 'Chuyển kỳ sau') document.getElementById('card-ChuyenKySau').classList.add('active');
        else if(status === 'Thông báo / tham khảo') { 
            let el = document.getElementById('card-ThongBao'); 
            if(el) el.classList.add('active'); 
        }
        else if(status === 'Gấp') { 
            let el = document.getElementById('card-Gap'); 
            if(el) el.classList.add('active'); 
        }

        hienThiBang();
    }

    function locTheoCard(status) { 
        thayDoiBoLoc(status); 
    }

   function hienThiBang() {
        let tbody = document.getElementById('bangCongVan');
        tbody.innerHTML = ''; 

        let locNgay = document.getElementById('filterNgay') ? document.getElementById('filterNgay').value : '';
        let tuNgay = document.getElementById('tuNgay') ? document.getElementById('tuNgay').value : '';
        let denNgay = document.getElementById('denNgay') ? document.getElementById('denNgay').value : '';
        let locTuan = document.getElementById('filterTuan') ? document.getElementById('filterTuan').value.toLowerCase().trim() : '';
        let locTo = document.getElementById('filterTo') ? document.getElementById('filterTo').value.toLowerCase().trim() : '';
        let tuKhoa = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';

        let today = new Date();
        let todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

        // Lọc danh sách chính
        let danhSachDaLoc = danhSachCongVan.filter(item => {
            if (locNgay === 'Hôm nay' && item.ngayDen !== todayStr) return false;
            if (tuNgay !== '' && (!item.ngayDen || item.ngayDen < tuNgay)) return false;
            if (denNgay !== '' && (!item.ngayDen || item.ngayDen > denNgay)) return false;
            if (locTuan !== '' && !(item.tuanBC || '').toLowerCase().includes(locTuan)) return false;
            
            if (locTo !== '') {
                let chuoiTo = `${item.bpChuTri} ${item.bpPhoiHop}`.toLowerCase();
                if (!chuoiTo.includes(locTo)) return false;
            }

            // BỔ SUNG: Tìm kiếm theo Trạng thái ở đây
            if (tuKhoa !== '') {
    let chuoiChung = Object.values(item)
        .join(' ')
        .toLowerCase();

    if (!chuoiChung.includes(tuKhoa)) return false;
}
            return true;
        });

        // Tính toán các thẻ đếm
        let cAll = 0, cChuaXuLy = 0, cDangXuLy = 0, cHoanThanh = 0, cQuaHan = 0, cChuyenKySau = 0, cThongBao = 0, cGap = 0;
        danhSachDaLoc.forEach(cv => {
            cAll++;
            if(cv.trangThai === 'Chưa xử lý') cChuaXuLy++;
            else if(cv.trangThai === 'Đang xử lý') cDangXuLy++;
            else if(cv.trangThai === 'Hoàn thành') cHoanThanh++;
            else if(cv.trangThai === 'Quá hạn') cQuaHan++;
            else if(cv.trangThai === 'Chuyển kỳ sau') cChuyenKySau++;
            else if(cv.trangThai === 'Thông báo / tham khảo') cThongBao++;
            else if(cv.trangThai === 'Gấp') cGap++;
        });

        if(document.getElementById('countAll')) document.getElementById('countAll').innerText = cAll;
        if(document.getElementById('countChuaXuLy')) document.getElementById('countChuaXuLy').innerText = cChuaXuLy;
        if(document.getElementById('countDangXuLy')) document.getElementById('countDangXuLy').innerText = cDangXuLy;
        if(document.getElementById('countHoanThanh')) document.getElementById('countHoanThanh').innerText = cHoanThanh;
        if(document.getElementById('countQuaHan')) document.getElementById('countQuaHan').innerText = cQuaHan;
        if(document.getElementById('countChuyenKySau')) document.getElementById('countChuyenKySau').innerText = cChuyenKySau;
        if(document.getElementById('countThongBao')) document.getElementById('countThongBao').innerText = cThongBao;
        if(document.getElementById('countGap')) document.getElementById('countGap').innerText = cGap;

        // Lọc hiển thị theo Tab đang chọn
        let danhSachHienThi = danhSachDaLoc.filter(item => {
            return (boLocHienTai === 'Tất cả') || (item.trangThai === boLocHienTai);
        });

        // Vẽ bảng (gom HTML vào 1 biến, chỉ gán 1 lần để tránh giật lag khi danh sách dài)
        let htmlBang = '';
        danhSachHienThi.forEach((cv, i) => {
            let mt = 'bg-info';
            let badgeStyle = ''; 

            if(cv.trangThai === 'Chưa xử lý') mt = 'bg-warning';
            if(cv.trangThai === 'Hoàn thành') mt = 'bg-success';
            if(cv.trangThai === 'Quá hạn') mt = 'bg-danger';
            if(cv.trangThai === 'Chuyển kỳ sau') mt = 'bg-purple';
            if(cv.trangThai === 'Gấp') mt = 'bg-danger';
            
            // Ép chữ màu đen cho "Thông báo / tham khảo"
            if(cv.trangThai === 'Thông báo / tham khảo') {
                mt = 'bg-secondary';
                badgeStyle = 'color: black !important;'; 
            }

            let cb = 'text-antoan';
            if(cv.canhBao === 'Quá hạn') cb = 'text-quahan';
            if(cv.canhBao === 'Hạn cuối cùng') cb = 'text-hancuoi';
            if(cv.canhBao === 'Sắp hết hạn') cb = 'text-saphet';
            
            let rowStyle = '';
            if(cv.trangThai === 'Gấp') {
                rowStyle = 'background-color: #ffe6e6; color: #cc0000; font-weight: 500;';
            }
            
            let cotHanhDongHTML = "";
            if(isAdmin) {
                cotHanhDongHTML = `
                <td>
                    <button style="background: #ffc107; border: none; padding: 6px 10px; cursor: pointer; border-radius: 3px; font-weight:bold;" onclick="moFormSua('${cv.key}')">✏️ Sửa</button>
                    <button style="background: #dc3545; color: white; border: none; padding: 6px 10px; cursor: pointer; border-radius: 3px; margin-top:4px; font-weight:bold;" onclick="xoaCongVan('${cv.key}')">🗑️ Xóa</button>
                </td>`;
            } else {
                cotHanhDongHTML = `
                <td>
                    <button style="background: #17a2b8; color: white; border: none; padding: 6px 10px; cursor: pointer; border-radius: 3px; font-weight:bold;" onclick="moFormSua('${cv.key}')">📝 Cập nhật</button>
                </td>`;
            }

            htmlBang += `
                <tr onclick="xuLyClick('${cv.key}')" style="${rowStyle}">
                    <td>${i + 1}</td>
                    <td>${escapeHtml(cv.ngayDen)}</td>
                    <td>${escapeHtml(cv.soDen)}</td>
                    <td>${escapeHtml(cv.coQuanGui)}</td>
                    <td>${escapeHtml(cv.soKyHieu || '')}</td>
                    <td>${escapeHtml(cv.ngayVB)}</td>
                    <td>${escapeHtml(cv.trichYeu)}</td>
                    <td>${escapeHtml(cv.bpChuTri)}</td>
                    <td>${escapeHtml(cv.bpPhoiHop)}</td>
                    <td>${escapeHtml(cv.hanXuLy)}</td>
                    <td>${escapeHtml(cv.soNgayCon)}</td>
                    <td><span class="status-badge ${mt}" style="${badgeStyle}">${escapeHtml(cv.trangThai)}</span></td>
                    <td class="${cb}">${escapeHtml(cv.canhBao)}</td>
                    <td><strong>${escapeHtml(cv.tuanBC || '')}</strong></td>
                    ${cotHanhDongHTML}
                </tr>
            `;
        });

        htmlBang += `<tr><td colspan="15" style="height: 300px; border:none; background:transparent; pointer-events:none;"></td></tr>`;
        tbody.innerHTML = htmlBang;
    }

    let clickCount = 0;
    let clickTimer = null;

    function xuLyClick(key) {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);

        clickTimer = setTimeout(() => {
            if (clickCount === 2) {
                moFormSua(key);
            } else if (clickCount >= 3) {
                if (isAdmin) {
                    xoaCongVan(key);
                } else {
                    showToast("Bạn không có quyền xóa!", 'warning');
                }
            }
            clickCount = 0;
        }, 300);
    }

    function moFormThemMoi() {
        document.getElementById("formTitle").innerText = "NHẬP CÔNG VĂN MỚI";
        document.getElementById("cvId").value = "";
        
        document.querySelectorAll('.form-grid input, .form-grid textarea').forEach(el => el.value = '');
        
        let homNay = new Date();
        homNay.setMinutes(homNay.getMinutes() - homNay.getTimezoneOffset()); 
        let ngayHienTai = homNay.toISOString().split('T')[0]; 
        
        document.getElementById("ngayDen").value = ngayHienTai;
        document.getElementById("trangThai").value = "Chưa xử lý";
        document.getElementById("lapLai").value = "Một lần";

        let maxSoDen = 0;
        if (danhSachCongVan && danhSachCongVan.length > 0) {
            danhSachCongVan.forEach(cv => {
                let soHienTai = parseInt(cv.soDen, 10);
                if (!isNaN(soHienTai) && soHienTai > maxSoDen) {
                    maxSoDen = soHienTai;
                }
            });
        }
        document.getElementById("soDen").value = maxSoDen + 1;
        document.getElementById("modalForm").style.display = "block";
        tinhTuanBC();
    }

    // Chống "CSV/Excel Formula Injection": nếu 1 ô bắt đầu bằng =, +, -, @
    // (hoặc tab/carriage-return) thì Excel có thể diễn giải thành công thức khi
    // mở file, cho phép dữ liệu nhập vào (VD: từ Trích yếu) thực thi lệnh trên
    // máy người mở báo cáo. Thêm dấu ' ở đầu để ép Excel hiểu là văn bản thuần.
    function sanitizeForExcel(value) {
        if (value === null || value === undefined) return value;
        let s = String(value);
        if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
        return value;
    }

    function exportExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                showToast("Hệ thống chưa nhận thư viện Excel! Hãy kiểm tra thẻ script trong head.", 'error');
                return;
            }
            if (!danhSachCongVan || danhSachCongVan.length === 0) {
                showToast("Không có dữ liệu để xuất!", 'warning');
                return;
            }

            let filter = (typeof boLocHienTai !== 'undefined') ? boLocHienTai : "Tất cả";
            let danhSachXuat = filter === 'Tất cả'
                ? danhSachCongVan
                : danhSachCongVan.filter(item => item.trangThai === filter);

            if (danhSachXuat.length === 0) {
                showToast("Không có công văn nào phù hợp để xuất!", 'warning');
                return;
            }

            let excelRows = danhSachXuat.map((cv, index) => {
                return {
                    'STT': index + 1,
                    'Ngày đến': sanitizeForExcel(cv.ngayDen || ''),
                    'Số đến': sanitizeForExcel(cv.soDen || ''),
                    'Cơ quan gửi': sanitizeForExcel(cv.coQuanGui || ''),
                    'Số ký hiệu VB': sanitizeForExcel(cv.soKyHieu || ''),
                    'Ngày VB': sanitizeForExcel(cv.ngayVB || ''),
                    'Trích yếu nội dung': sanitizeForExcel(cv.trichYeu || ''),
                    'BP Chủ trì': sanitizeForExcel(cv.bpChuTri || ''),
                    'BP Phối hợp': sanitizeForExcel(cv.bpPhoiHop || ''),
                    'Hạn xử lý': sanitizeForExcel(cv.hanXuLy || ''),
                    'Số ngày còn': (cv.soNgayCon !== undefined && cv.soNgayCon !== null) ? cv.soNgayCon : '',
                    'Lặp lại': sanitizeForExcel(cv.lapLai || 'Một lần'),
                    'Trạng thái': sanitizeForExcel(cv.trangThai || ''),
                    'Ngày hoàn thành': sanitizeForExcel(cv.ngayHoanThanh || ''),
                    'Tuần BC': sanitizeForExcel(cv.tuanBC || ''),
                    'Cảnh báo': sanitizeForExcel(cv.canhBao || '')
                };
            });

            let worksheet = XLSX.utils.json_to_sheet(excelRows);
            let workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "CongVanNoiBo");

            let formattedDate = new Date().toISOString().split('T')[0];
            let tenFileClean = filter.replace(/\s+/g, '_');
            let filename = "Bao_Cao_Cong_Van_" + tenFileClean + "_" + formattedDate + ".xlsx";

            XLSX.writeFile(workbook, filename);
        } catch (error) {
            showToast("Lỗi xuất Excel: " + error.message, 'error');
        }
    }

    function moFormSua(key) {
        let cv = danhSachCongVan.find(item => item.key === key);
        if(cv) {
            document.getElementById("formTitle").innerText = isAdmin ? "✏️ CẬP NHẬT CÔNG VĂN" : "📝 CẬP NHẬT TRẠNG THÁI";
            document.getElementById("cvId").value = cv.key;
            document.getElementById('ngayDen').value = cv.ngayDen || '';
            document.getElementById('soDen').value = cv.soDen || '';
            document.getElementById('coQuanGui').value = cv.coQuanGui || '';
            document.getElementById('soKyHieu').value = cv.soKyHieu || '';
            document.getElementById('ngayVB').value = cv.ngayVB || '';
            document.getElementById('trichYeu').value = cv.trichYeu || '';
            document.getElementById('bpChuTri').value = cv.bpChuTri || '';
            document.getElementById('bpPhoiHop').value = cv.bpPhoiHop || '';
            document.getElementById('hanXuLy').value = cv.hanXuLy || '';
            document.getElementById('soNgayCon').value = cv.soNgayCon || '';
            document.getElementById('canhBao').value = cv.canhBao || '';
            document.getElementById('tuanBC').value = cv.tuanBC || '';
            document.getElementById('lapLai').value = cv.lapLai || 'Một lần';
            document.getElementById('trangThai').value = cv.trangThai || 'Chưa xử lý';
            document.getElementById('ngayHoanThanh').value = cv.ngayHoanThanh || '';
            
            const mangIdTruong = ['ngayDen', 'soDen', 'coQuanGui', 'soKyHieu', 'ngayVB', 'trichYeu', 'bpChuTri', 'bpPhoiHop', 'hanXuLy', 'lapLai', 'tuanBC'];
            mangIdTruong.forEach(id => {
                let el = document.getElementById(id);
                if(el) el.disabled = !isAdmin;
            });

            let phanLichSu = document.getElementById('phanLichSu');
            let danhSachLichSu = document.getElementById('danhSachLichSu');
            
            if (phanLichSu && danhSachLichSu) {
                if (isAdmin) {
                    phanLichSu.style.display = "block";
                    danhSachLichSu.innerHTML = "";
                    if (cv.lichSuSua && cv.lichSuSua.length > 0) {
                        cv.lichSuSua.forEach(log => {
                            danhSachLichSu.innerHTML += `<div style="margin-bottom:6px; border-bottom:1px solid #eee; padding-bottom:4px;">
                                👤 <strong>User:</strong> <span style="color:#0056b3;">${escapeHtml(log.user)}</span> |
                                📌 <strong>Trạng thái:</strong> [${escapeHtml(log.trangThai)}] |
                                📆 <strong>Ngày HT:</strong> [${escapeHtml(log.ngayHoanThanh || 'Trống')}]
                                <br><small style="color:#888;">⏱️ Lúc: ${escapeHtml(log.thoiGian)}</small>
                            </div>`;
                        });
                    } else {
                        danhSachLichSu.innerHTML = "<span style='color:#999; font-style:italic;'>Chưa có lịch sử cập nhật trạng thái từ các User.</span>";
                    }
                } else {
                    phanLichSu.style.display = "none";
                }
            }
            
            document.getElementById("modalForm").style.display = "block";
        }
    }

    function dongForm() {
        let modal = document.getElementById("modalForm");
        if(modal) modal.style.display = "none";
    }

    // Dùng addEventListener thay vì gán window.onclick =, vì 2 lý do:
    // 1. Phía cuối file còn một chỗ gán window.onclick nữa - gán trực tiếp thì
    //    cái sau GHI ĐÈ cái trước, làm form công văn mất khả năng bấm ra nền
    //    đen để đóng.
    // 2. Kết thúc bằng "});" loại bỏ hẳn cái bẫy thiếu dấu chấm phẩy: trước
    //    đây khối này kết thúc bằng "}" trần và đứng ngay trước một IIFE mở
    //    bằng "(", nên JavaScript nối liền thành MỘT câu lệnh gọi hàm ->
    //    "TypeError: (intermediate value)(...) is not a function" và làm CHẾT
    //    toàn bộ phần còn lại của file (mọi let/const sau đó kẹt trong TDZ:
    //    fcmMessagingInstance, danhSachThongBaoToanHeThong, ...).
    window.addEventListener('click', function(event) {
        let modal = document.getElementById("modalForm");
        if (event.target === modal) {
            dongForm();
        }
    });

    // ==========================================
    // VUỐT NGANG (TRÁI/PHẢI) ĐỂ ĐÓNG FORM NHẬP CÔNG VĂN MỚI (hỗ trợ thao tác trên iPhone)
    // Dùng vuốt ngang thay vì vuốt dọc để không xung đột với thao tác cuộn (scroll) form
    // ==========================================
    (function khoiTaoVuotDeDongForm() {
        let noiDung = document.getElementById("modalFormContent");
        if (!noiDung) return;

        let xBatDau = 0, yBatDau = 0;
        let xHienTai = 0;
        let dangKeoNgang = false; // true khi đã xác định đây là cử chỉ vuốt ngang
        let daXacDinhHuong = false; // đã xác định hướng vuốt (ngang hay dọc) hay chưa

        noiDung.addEventListener("touchstart", function (e) {
            xBatDau = e.touches[0].clientX;
            yBatDau = e.touches[0].clientY;
            xHienTai = xBatDau;
            dangKeoNgang = false;
            daXacDinhHuong = false;
            noiDung.style.transition = "none";
        }, { passive: true });

        noiDung.addEventListener("touchmove", function (e) {
            let xNow = e.touches[0].clientX;
            let yNow = e.touches[0].clientY;
            let dx = xNow - xBatDau;
            let dy = yNow - yBatDau;

            if (!daXacDinhHuong) {
                // Chỉ xác định hướng khi đã di chuyển đủ xa để tránh nhầm với chạm nhẹ
                if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
                daXacDinhHuong = true;
                // Chỉ coi là vuốt ngang nếu độ lệch ngang lớn hơn rõ rệt so với dọc
                dangKeoNgang = Math.abs(dx) > Math.abs(dy) * 1.5;
            }

            if (dangKeoNgang) {
                xHienTai = xNow;
                noiDung.style.transform = "translateX(" + dx + "px)";
            }
        }, { passive: true });

        noiDung.addEventListener("touchend", function () {
            if (!dangKeoNgang) {
                daXacDinhHuong = false;
                return;
            }
            let dx = xHienTai - xBatDau;
            noiDung.style.transition = "transform 0.2s ease";

            if (Math.abs(dx) > 100) {
                // Vuốt ngang đủ xa -> đóng form, trượt tiếp theo hướng đang vuốt
                noiDung.style.transform = "translateX(" + (dx > 0 ? "100%" : "-100%") + ")";
                setTimeout(function () {
                    dongForm();
                    noiDung.style.transition = "none";
                    noiDung.style.transform = "";
                }, 200);
            } else {
                // Vuốt chưa đủ -> trả về vị trí cũ
                noiDung.style.transform = "translateX(0)";
            }
            dangKeoNgang = false;
            daXacDinhHuong = false;
        });
    })();


// ==========================================
// PUSH NOTIFICATION (FCM) - NHẬN THÔNG BÁO NGAY CẢ KHI KHÔNG MỞ APP
// ==========================================
// Cách hoạt động:
// 1. Sau khi đăng nhập thành công, xin quyền thông báo trình duyệt và lấy
//    "token" thiết bị từ Firebase Cloud Messaging (FCM), lưu vào
//    fcm_tokens/{username}/{token} trên Realtime Database.
// 2. Khi admin gửi thông báo mới (thucHienGuiThongBao ở dưới ghi vào
//    'thong_bao_he_thong_danh_sach'), một Cloud Function (xem thư mục
//    functions/) tự động chạy phía server, đọc toàn bộ fcm_tokens (trừ
//    của chính admin gửi) và đẩy push notification tới từng thiết bị -
//    kể cả khi trình duyệt/app đang đóng. Việc đẩy push BẮT BUỘC phải làm
//    ở phía server (Cloud Function), vì trình duyệt của người gửi không
//    còn "chạy" JS nào để tự gửi cho người khác khi họ đã tắt app.
// 3. sw.js (service worker) nhận push lúc app đóng và hiển thị notification
//    hệ điều hành; nếu app đang mở, onMessage() bên dưới hiển thị toast
//    thay vì notification hệ điều hành (tránh gây phiền/trùng lặp).

let fcmMessagingInstance = null;

async function khoiTaoPushNotification(username) {
    try {
        if (!('serviceWorker' in navigator) || typeof firebase === 'undefined' || !firebase.messaging) {
            return; // Trình duyệt không hỗ trợ
        }
        if (!(await firebase.messaging.isSupported())) return;

        if (VAPID_KEY_FCM === "DÁN_VAPID_KEY_CỦA_BẠN_VÀO_ĐÂY" || !VAPID_KEY_FCM) {
            console.warn("Chưa cấu hình VAPID_KEY_FCM - push notification sẽ không hoạt động.");
            return;
        }

        if (Notification.permission === 'denied') return;

        // Dùng chung service worker đã đăng ký cho PWA (sw.js) làm SW cho FCM
        let swReg = await navigator.serviceWorker.ready;

        let quyen = Notification.permission;
        if (quyen === 'default') {
            quyen = await Notification.requestPermission();
        }
        if (quyen !== 'granted') return;

        fcmMessagingInstance = firebase.messaging();
        let token = await fcmMessagingInstance.getToken({
            vapidKey: VAPID_KEY_FCM,
            serviceWorkerRegistration: swReg
        });

        if (token) {
            await db.ref('fcm_tokens/' + username + '/' + token).set({
                thoigian: Date.now(),
                thietBi: (navigator.userAgent || '').slice(0, 200)
            });
        }

        // Khi app đang mở (foreground), tự hiển thị toast thay vì để trình
        // duyệt bắn native notification (tránh trùng lặp / gây giật mình).
        fcmMessagingInstance.onMessage(payload => {
            let noiDung = (payload.data && payload.data.body) || (payload.notification && payload.notification.body) || 'Bạn có thông báo mới';
            showToast(noiDung, 'info');
        });
    } catch (err) {
        console.error('Lỗi khởi tạo push notification:', err);
    }
}

async function xoaPushTokenHienTai(username) {
    try {
        if (!fcmMessagingInstance || !username) return;
        let token = await fcmMessagingInstance.getToken().catch(() => null);
        if (token) {
            await db.ref('fcm_tokens/' + username + '/' + token).remove().catch(() => {});
            await fcmMessagingInstance.deleteToken().catch(() => {});
        }
    } catch (err) {
        console.error('Lỗi xóa push token:', err);
    }
}

// ==========================================
// TÍNH NĂNG GỬI THÔNG BÁO THỜI GIAN THỰC
// ==========================================

// 1. Mở/Đóng Form Gửi Thông Báo (Dành cho Admin)
    function moFormThongBao() {
        document.getElementById('noiDungThongBao').value = '';
        document.getElementById('modalThongBao').style.display = 'block';
    }

    function dongFormThongBao() {
        document.getElementById('modalThongBao').style.display = 'none';
    }

    // 2. Admin Gửi thông báo (Lưu thành mảng bằng .push)
    function thucHienGuiThongBao() {
        if(!isAdmin) return;
        let msg = document.getElementById('noiDungThongBao').value.trim();
        if(!msg) { showToast('Vui lòng nhập nội dung thông báo!', 'warning'); return; }

        // Đẩy dữ liệu vào nhánh mới là 'thong_bao_he_thong_danh_sach'
        db.ref('thong_bao_he_thong_danh_sach').push({
            noidung: msg,
            nguoigui: localStorage.getItem('cv_user') || 'Admin',
            thoigian: Date.now()
        }).then(() => {
            showToast("Đã gửi thông báo thành công!", 'success');
            dongFormThongBao();
        }).catch(err => {
            showToast("Lỗi khi gửi: " + err.message, 'error');
        });
    }

    // (Đã gộp việc lắng nghe 'thong_bao_he_thong_danh_sach' vào 1 listener duy nhất bên dưới,
    //  tránh việc tải dữ liệu và render 2 lần mỗi khi có thay đổi - nguyên nhân gây lag)

  let danhSachThongBaoToanHeThong = [];
    let thoiGianXemThongBao = localStorage.getItem('thoiGianXemThongBao') || 0;

   // 2. Mở/Đóng Bảng Lịch Sử Thông Báo (User)
// Cập nhật hàm mở lịch sử thông báo - Ghi nhận User đã đọc lên Firebase
function moLichSuThongBao() {
    document.getElementById('modalLichSuThongBao').style.display = 'block';
    
    let currentUser = localStorage.getItem('cv_user') || 'Anonym';
    
    // Tắt số đỏ, tắt chuông rung, tắt chữ ngay lập tức trên máy này
    let badge = document.getElementById('badgeThongBao');
    if(badge) badge.style.display = 'none';
    let iconChuong = document.getElementById('iconChuong');
    if(iconChuong) iconChuong.classList.remove('ringing');
    let textCoThongBaoMoi = document.getElementById('textCoThongBaoMoi');
    if(textCoThongBaoMoi) textCoThongBaoMoi.style.display = 'none';

    // Đánh dấu tất cả thông báo hiện tại là "Đã xem" cho User này trên Firebase
    if (danhSachThongBaoToanHeThong.length > 0) {
        danhSachThongBaoToanHeThong.forEach(tb => {
            // Lưu đường dẫn: thong_bao_da_doc/{Mã_Thông_Báo}/{Tên_User} = Thời gian xem
            db.ref('thong_bao_da_doc/' + tb.key + '/' + currentUser).set(Date.now());
        });
    }

    renderBangThongBao();
}
    function dongLichSuThongBao() {
    document.getElementById('modalLichSuThongBao').style.display = 'none';
}
// 4. Lắng nghe dữ liệu Danh sách Thông báo
//
// QUAN TRỌNG - PHẢI đăng ký listener SAU KHI ĐĂNG NHẬP, tuyệt đối không đặt ở
// cấp cao nhất của file. Rules của Realtime Database yêu cầu auth != null. Nếu
// gọi .on() ngay lúc tải trang (lúc đó chưa đăng nhập, chưa có session ẩn danh)
// thì Firebase trả về PERMISSION_DENIED và HỦY LUÔN listener đó - nó KHÔNG tự
// gắn lại sau khi đăng nhập xong. Hậu quả: chuông không kêu, badge không lên số,
// bảng thông báo luôn trống suốt cả phiên làm việc, mà không hề có lỗi nào hiện
// ra màn hình. Đây đúng là mô hình mà taiDuLieuTuFirebase() (nhánh cong_van) đã
// làm đúng: chỉ gọi từ trong onAuthStateChanged.
let daDangKyLangNgheThongBao = false;

function khoiTaoLangNgheThongBao() {
    if (daDangKyLangNgheThongBao) return; // tránh đăng ký trùng khi auth đổi trạng thái
    daDangKyLangNgheThongBao = true;

db.ref('thong_bao_he_thong_danh_sach').on('value', snap => {
    danhSachThongBaoToanHeThong = [];
    let currentUser = localStorage.getItem('cv_user') || 'Anonym';

    if(snap.exists()) {
        // Lấy thêm bảng danh sách những người đã đọc từ Firebase
        db.ref('thong_bao_da_doc').once('value', docSnap => {
            let dataDaDoc = docSnap.val() || {};

            let soLuongChuaDoc = 0;

            snap.forEach(child => {
                let tb = child.val();
                tb.key = child.key;
                
                // Lấy danh sách các user đã đọc của thông báo này
                let danhSachUserDaXem = dataDaDoc[tb.key] ? Object.keys(dataDaDoc[tb.key]) : [];
                tb.daXemList = danhSachUserDaXem; // Lưu vào mảng để hiển thị công khai

                // Kiểm tra xem chính User đang đăng nhập này đã đọc chưa
                if (!danhSachUserDaXem.includes(currentUser)) {
                    soLuongChuaDoc++;
                }
                
                danhSachThongBaoToanHeThong.push(tb);
            });

            // Sắp xếp thông báo mới lên đầu
            danhSachThongBaoToanHeThong.sort((a, b) => b.thoigian - a.thoigian);

            // Xử lý giao diện Chuông Rung và Chữ báo
            let badge = document.getElementById('badgeThongBao');
            let iconChuong = document.getElementById('iconChuong');
            let textCoThongBaoMoi = document.getElementById('textCoThongBaoMoi');

            if(soLuongChuaDoc > 0) {
                if(badge) { badge.innerText = soLuongChuaDoc; badge.style.display = 'inline-block'; }
                if(iconChuong) iconChuong.classList.add('ringing');
                if(textCoThongBaoMoi) textCoThongBaoMoi.style.display = 'inline-block';
            } else {
                if(badge) badge.style.display = 'none';
                if(iconChuong) iconChuong.classList.remove('ringing');
                if(textCoThongBaoMoi) textCoThongBaoMoi.style.display = 'none';
            }

            renderBangThongBao();
        });
    } else {
        renderBangThongBao();
    }
}, err => {
    // Trước đây .on() không truyền callback lỗi nên mọi thất bại đều im lặng.
    // Ghi rõ ra console, và mở cờ để lần đăng nhập kế tiếp được đăng ký lại.
    daDangKyLangNgheThongBao = false;
    console.error('Không đọc được danh sách thông báo (kiểm tra Rules / trạng thái đăng nhập):', err);
});
}
    // 6. Hàm hiển thị danh sách thông báo vào Modal (Có thêm nút Xóa cho Admin)
// Hàm hiển thị danh sách thông báo vào Modal (Hiển thị thêm danh sách người đã đọc cho Admin)
function renderBangThongBao() {
    let container = document.getElementById('danhSachThongBaoList');
    if(!container) return;
    
    container.innerHTML = '';
    
    if(danhSachThongBaoToanHeThong.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Chưa có thông báo nào.</div>';
        return;
    }

    let currentUser = localStorage.getItem('cv_user') || 'Anonym';
    let htmlThongBao = '';

    danhSachThongBaoToanHeThong.forEach(tb => {
        // Kiểm tra trạng thái unread dựa trên mảng Firebase thay vì localStorage cũ
let isUnread = !(tb.daXemList && tb.daXemList.includes(currentUser)) ? 'unread' : '';        
        let dateObj = new Date(tb.thoigian);
        let timeString = dateObj.toLocaleDateString('vi-VN') + " " + dateObj.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});

        let nutXoaHTMl = isAdmin ? `<button class="btn-xoa-tb" onclick="xoaThongBao('${tb.key}')">🗑️ Xóa</button>` : ``;

        // Tạo dòng danh sách người đã xem (Chỉ Admin nhìn thấy)
        let dongNguoiDaXemHTML = "";
        if (isAdmin) {
            if (tb.daXemList && tb.daXemList.length > 0) {
                dongNguoiDaXemHTML = `<div style="margin-top: 8px; font-size: 12px; color: #28a745; background: #e8f5e9; padding: 4px 8px; border-radius: 4px;">
                    👁️ <strong>Đã xem:</strong> ${escapeHtml(tb.daXemList.join(', '))}
                </div>`;
            } else {
                dongNguoiDaXemHTML = `<div style="margin-top: 8px; font-size: 12px; color: #666; background: #eee; padding: 4px 8px; border-radius: 4px;">
                    👁️ <strong>Đã xem:</strong> Chưa có ai xem
                </div>`;
            }
        }

        htmlThongBao += `
            <div class="tb-item ${isUnread}" style="border-bottom: 1px solid #ddd; padding: 12px; background: ${isUnread ? '#e6f7ff' : '#fff'}">
                <div class="tb-time" style="font-size: 12px; color: #888;">🕒 ${timeString} ${nutXoaHTMl}</div>
                <div class="tb-sender" style="font-weight: bold; color: #333;">👤 ${escapeHtml(tb.nguoigui)}</div>
                <p class="tb-msg" style="margin: 5px 0; white-space: pre-wrap;">${escapeHtml(tb.noidung)}</p>
                ${dongNguoiDaXemHTML}
            </div>
        `;
    });

    container.innerHTML = htmlThongBao;
}
// ==========================================================================
// 1. QUẢN LÝ THÔNG BÀO HỆ THỐNG (CHỈ ADMIN)
// ==========================================================================
async function xoaThongBao(key) {
    if(!isAdmin) return;
    let dongY = await showConfirm("Bạn có chắc chắn muốn XÓA thông báo này khỏi hệ thống không?", { danger: true, okText: 'Xóa' });
    if(dongY) {
        db.ref('thong_bao_he_thong_danh_sach/' + key).remove()
        .then(() => {
            db.ref('thong_bao_da_doc/' + key).remove();
        })
        .catch(err => {
            showToast("Lỗi khi xóa: " + err.message, 'error');
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if(typeof isAdmin !== 'undefined' && isAdmin) {
        let btnAdmin = document.getElementById('btnGuiThongBaoAdmin');
        if(btnAdmin) btnAdmin.style.display = "inline-block";
    }
});

// ==========================================================================
// 2. ĐIỀU KHIỂN CHUYỂN ĐỔI GIAO DIỆN (TOGGLE CHỨC NĂNG)
// ==========================================================================
// Dùng `var` (KHÔNG dùng `let`) cho biến này: index.html có handler nội tuyến
// tham chiếu tới lịch (ô lọc "Chỉ hiển thị lịch họp của Trưởng / Phó TCS").
// Khai báo bằng `let` chỉ nằm trong global declarative record, KHÔNG gắn lên
// window, nên nếu app.js ném lỗi ở trên (VD: SDK Firebase tải hỏng) thì biến
// không bao giờ được tạo và handler nội tuyến báo "calendar is not defined" -
// che mất lỗi thật. `var` luôn gắn lên window và không có vùng chết (TDZ).
var calendar;
var isCalendarInit = false;

// Ô lọc lịch lãnh đạo gọi hàm này thay vì gọi thẳng calendar.refetchEvents():
// khai báo hàm luôn được hoisted lên window nên handler nội tuyến luôn tìm thấy,
// và có kiểm tra null để không ném lỗi khi lịch chưa khởi tạo xong.
function locLichLanhDaoThayDoi() {
    if (calendar) calendar.refetchEvents();
}

function toggleChucNang(chucNang) {
    if (chucNang === 'LICH') {
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('calendarApp').style.display = 'block';
        document.getElementById('btnChuyenLich').style.display = 'none';
        document.getElementById('btnChuyenCongVan').style.display = 'inline-block';
        
        if (!isCalendarInit) {
            initCalendar();
            renderCheckboxPhongBan();
            isCalendarInit = true;
        }
        
        // Sửa lỗi vỡ cấu trúc hiển thị grid của thư viện FullCalendar khi bật/tắt container
        setTimeout(() => { calendar.updateSize(); }, 50);
        
        document.getElementById('nguoiChuTri').value = localStorage.getItem('cv_user') || 'Admin';
        
        // KIỂM TRA PHÂN QUYỀN: Nếu không phải Admin thì ẩn toàn bộ các nút kích hoạt mở Form đặt lịch
        let btnMeeting = document.getElementById('btnMeetingAdmin');
        let btnFloating = document.getElementById('btnMoFormMobile');
        if(!isAdmin) {
            if(btnMeeting) btnMeeting.style.display = 'none';
            if(btnFloating) btnFloating.style.display = 'none';
        } else {
            if(btnMeeting) btnMeeting.style.display = 'inline-block';
            if(btnFloating) btnFloating.style.display = 'flex';
        }
    } else {
        document.getElementById('calendarApp').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('btnChuyenLich').style.display = 'inline-block';
        document.getElementById('btnChuyenCongVan').style.display = 'none';
    }
}

// ==========================================================================
// 3. VẬN HÀNH THƯ VIỆN LỊCH (FULLCALENDAR & FIREBASE REALTIME)
// ==========================================================================
function initCalendar() {
    let calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    let isMobile = window.innerWidth < 768;

    calendar = new FullCalendar.Calendar(calendarEl, {
        // Tối ưu PWA: Mobile dùng dạng List (Danh sách) dọc, PC dùng dạng Grid (Lưới)
        initialView: isMobile ? 'listMonth' : 'dayGridMonth', 
        
        // Cân đối chiều cao
        contentHeight: isMobile ? 'auto' : 650, 
        aspectRatio: isMobile ? 1 : 1.35,      
        
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            // Rút gọn nút bấm trên mobile để không bị đè chữ
            right: isMobile ? 'listMonth,dayGridMonth' : 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
        },
        views: {
            listMonth: { buttonText: 'Danh sách' },
            dayGridMonth: { buttonText: 'Tháng' },
            timeGridWeek: { buttonText: 'Tuần' },
            timeGridDay: { buttonText: 'Ngày' }
        },
        locale: 'vi',
        events: function(info, successCallback, failureCallback) {
            db.ref('lich_hop').once('value').then((snapshot) => {
                let events = [];
                
                // Đọc trạng thái nút lọc từ giao diện HTML (nếu có check vào nút thì dangLoc = true)
                let btnLoc = document.getElementById('btnLocLanhDao');
                let dangLoc = btnLoc ? btnLoc.checked : false; 
                
                // 💡 LƯU Ý: Nếu bạn muốn LÚC NÀO CŨNG CHỈ HIỆN lịch Lãnh đạo (không cần nút bấm), 
                // hãy xóa 2 dòng trên và đổi thành: let dangLoc = true;

                // Danh sách từ khóa nhận diện Lãnh đạo TCS (viết thường để so sánh chính xác)
                let tuKhoaLanhDao = [
                    "d/c hồng trưởng tcs",
                    "d/c tuyến phó trưởng tcs",
                    "d/c hiệp phó trưởng tcs",
                    "trưởng tcs", // từ khóa dự phòng
                    "phó trưởng tcs" // từ khóa dự phòng
                ];

                snapshot.forEach(child => {
                    let data = child.val();
                    
                    // Chuẩn hóa dữ liệu về chữ thường để tránh lỗi viết Hoa/thường
                    let nguoiChuTri = String(data.nguoiChuTri || '').toLowerCase();
                    let thanhPhan = Array.isArray(data.thanhPhan) 
                        ? data.thanhPhan.map(val => String(val).toLowerCase()) 
                        : [];

                    // KIỂM TRA XEM CUỘC HỌP CÓ SỰ THAM GIA CỦA 1 TRONG 3 LÃNH ĐẠO KHÔNG?
                    let coLanhDaoThamGia = false;
                    
                    // 1. Kiểm tra người chủ trì có phải Lãnh đạo không?
                    if (tuKhoaLanhDao.some(tuKhoa => nguoiChuTri.includes(tuKhoa))) {
                        coLanhDaoThamGia = true;
                    }
                    
                    // 2. Kiểm tra thành phần tham dự có chứa Lãnh đạo không?
                    if (!coLanhDaoThamGia && thanhPhan.some(nguoi => tuKhoaLanhDao.some(tuKhoa => nguoi.includes(tuKhoa)))) {
                        coLanhDaoThamGia = true;
                    }

                    // Lọc dữ liệu: Nếu KHÔNG bật lọc, HOẶC (có bật lọc VÀ thỏa mãn điều kiện có Lãnh đạo)
                    if (!dangLoc || coLanhDaoThamGia) {
                        events.push({
                            id: child.key,
                            title: data.tenCuocHop + " (" + data.phongHop + ")",
                            start: data.ngayHop + 'T' + data.gioBatDau,
                            end: data.ngayHop + 'T' + data.gioKetThuc,
                            backgroundColor: data.loaiCuocHop || '#007bff',
                            extendedProps: data
                        });
                    }
                });
                successCallback(events);
            }).catch(error => {
                console.error("Lỗi tải dữ liệu lịch:", error);
                failureCallback(error);
            });
        },

        // HIỂN THỊ NỘI DUNG CHI TIẾT & NÚT XÓA Ở BẢN MOBILE (LIST VIEW)
 // HIỂN THỊ NỘI DUNG CHI TIẾT & NÚT XÓA Ở BẢN MOBILE (LIST VIEW)
        eventDidMount: function(info) {
            if (info.view.type === 'listMonth') {
                let titleEl = info.el.querySelector('.fc-list-event-title');
                if (titleEl) {
                    if (!titleEl.querySelector('.custom-event-details')) {
                        let p = info.event.extendedProps;
                        let dsThamDu = (p.thanhPhan && p.thanhPhan.length > 0) ? p.thanhPhan.join(', ') : 'Không có';
                        
                        // LẤY TÊN USER ĐANG ĐĂNG NHẬP
                        let currentUser = localStorage.getItem('cv_user') || '';
                        let nutXoaHtml = '';
                        
                        // KIỂM TRA ĐIỀU KIỆN: Chỉ người tạo ra lịch này mới thấy nút xóa
                        if (p.nguoiTao === currentUser) {
                            nutXoaHtml = `
                                <button onclick="event.stopPropagation(); xoaCuocHop('${info.event.id}')" 
                                    style="margin-top: 10px; background-color: #dc3545; color: white; border: none; padding: 10px 12px; border-radius: 6px; width: 100%; font-weight: bold; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(220, 53, 69, 0.15);">
                                    🗑️ Xóa lịch do tôi tạo
                                </button>
                            `;
                        }
                        
                        let detailsDiv = document.createElement('div');
                        detailsDiv.className = 'custom-event-details';
                        detailsDiv.style.fontSize = '12.5px';
                        detailsDiv.style.color = '#495057';
                        detailsDiv.style.marginTop = '8px';
                        detailsDiv.style.padding = '8px 12px';
                        detailsDiv.style.background = '#f8f9fa';
                        detailsDiv.style.borderRadius = '6px';
                        detailsDiv.style.borderLeft = `3px solid ${info.event.backgroundColor || '#007bff'}`;
                        detailsDiv.style.lineHeight = '1.5';
                        
                        detailsDiv.innerHTML = `
                            <div style="margin-bottom: 4px;">👤 <b>Chủ trì:</b> ${escapeHtml(p.nguoiChuTri || 'Chưa rõ')}</div>
                            <div style="margin-bottom: 4px;">👥 <b>Phòng ban:</b> ${escapeHtml(dsThamDu)}</div>
                            <div style="white-space: pre-wrap; word-break: break-word; margin-bottom: 4px;">📝 <b>Nội dung:</b> ${escapeHtml(p.noiDung || 'Không có')}</div>
                            ${nutXoaHtml}
                        `;
                        titleEl.appendChild(detailsDiv);
                    }
                }
            }
        },

        // KHI CLICK VÀO CUỘC HỌP (TRÊN PC/GRID VIEW HOẶC CÁC CHẾ ĐỘ XEM KHÁC)
        eventClick: function(info) {
            let p = info.event.extendedProps;
            let dsThamDu = (p.thanhPhan && p.thanhPhan.length > 0) ? p.thanhPhan.join(', ') : 'Không có';
            
            // Xử lý bôi màu nổi bật cho các Lãnh đạo (escape trước, highlight sau vì
            // highlightLanhDao tự chèn thêm HTML tin cậy đè lên phần văn bản đã escape)
            let chuTriHienThi = highlightLanhDao(escapeHtml(p.nguoiChuTri));
            let thanhPhanHienThi = highlightLanhDao(escapeHtml(dsThamDu));

            // Đẩy dữ liệu vào Modal HTML
            document.getElementById('ct_tenCuocHop').innerHTML = `📌 ${escapeHtml(p.tenCuocHop)}`;
            document.getElementById('ct_phongHop').innerHTML = escapeHtml(p.phongHop);
            document.getElementById('ct_thoiGian').innerHTML = `${escapeHtml(p.gioBatDau)} - ${escapeHtml(p.gioKetThuc)} (Ngày ${escapeHtml(p.ngayHop)})`;
            document.getElementById('ct_chuTri').innerHTML = chuTriHienThi;
            document.getElementById('ct_thanhPhan').innerHTML = thanhPhanHienThi;
            document.getElementById('ct_noiDung').innerText = p.noiDung || 'Không có';

            // Xử lý logic hiển thị nút Xóa
            let currentUser = localStorage.getItem('cv_user') || '';
            let khuVucXoa = document.getElementById('khuVucXoaLich');
            let btnXoa = document.getElementById('btnXacNhanXoaModal');

            if (p.nguoiTao === currentUser) {
                // Là người tạo -> Hiện khu vực hỏi xóa
                khuVucXoa.style.display = 'block';
                btnXoa.onclick = function() {
                    // Gọi hàm xóa firebase cũ của bạn
                    xoaCuocHop(info.event.id); 
                    dongModalChiTiet(); // Đóng bảng sau khi xóa
                };
            } else {
                // Không phải người tạo -> Ẩn khu vực xóa, chỉ cho xem chi tiết
                khuVucXoa.style.display = 'none';
                btnXoa.onclick = null;
            }

            // Mở Modal lên màn hình
            document.getElementById('modalChiTietHop').style.display = 'block';
        },
        dateClick: function(info) {
            // Đã bỏ điều kiện check Admin. Ai bấm vào ngày cũng mở được form đặt lịch.
            moModalDatLich(info.dateStr); 
        },
        windowResize: function(arg) {
            // Tự động điều chỉnh khi xoay ngang/dọc điện thoại.
            // PHẢI cập nhật cả contentHeight chứ không chỉ đổi view: contentHeight
            // vốn được chốt một lần lúc khởi tạo theo bề rộng màn hình lúc đó. Nếu
            // mở ở màn hình rộng (contentHeight = 650) rồi thu nhỏ xuống cỡ điện
            // thoại, FullCalendar vẫn ở chế độ "liquid" (chiều cao cố định, view
            // bên trong position:absolute) khiến chế độ xem "Danh sách" hiển thị
            // sai. Đồng bộ lại để mobile luôn dùng 'auto' - danh sách tự giãn theo
            // số cuộc họp và hiện đủ khối chi tiết.
            let mobile = window.innerWidth < 768;
            calendar.setOption('contentHeight', mobile ? 'auto' : 650);
            calendar.changeView(mobile ? 'listMonth' : 'dayGridMonth');
        }
    });
    
    calendar.render();

    // Buộc FullCalendar đo lại đúng chiều rộng thật của khung chứa và tính lại
    // độ rộng từng cột ngày - nếu không gọi lại, lưới tháng có thể giữ độ rộng
    // cột tính từ lần đo đầu tiên và bị tràn ra ngoài màn hình di động.
    setTimeout(() => { if (calendar) calendar.updateSize(); }, 50);

    // Cập nhật lại lịch khi có dữ liệu mới từ Firebase
    db.ref('lich_hop').on('value', () => { 
        if(calendar) calendar.refetchEvents(); 
    });
}

// Cờ đánh dấu để tránh việc load lại toàn bộ dữ liệu cũ lúc ban đầu rồi hiển thị thông báo dồn dập
let daLoadXongDuLieuBanDau = false;
let daDangKyLangNgheLichHop = false;

// Cùng lý do với khoiTaoLangNgheThongBao() ở trên: hai listener dưới đây cũng
// đọc dữ liệu cần auth != null, nên phải đăng ký sau khi đăng nhập chứ không
// chạy thẳng lúc tải file, nếu không sẽ bị PERMISSION_DENIED rồi hủy im lặng.
function khoiTaoLangNgheLichHop() {
    if (daDangKyLangNgheLichHop) return;
    daDangKyLangNgheLichHop = true;

// 1. Chờ lấy toàn bộ dữ liệu cũ lần đầu tiên xong xuôi
db.ref('lich_hop').once('value').then(() => {
    daLoadXongDuLieuBanDau = true;
}).catch(err => {
    daDangKyLangNgheLichHop = false;
    console.error('Không đọc được lịch họp:', err);
});

// 2. Lắng nghe sự kiện THÊM MỚI cuộc họp trong thời gian thực
db.ref('lich_hop').on('child_added', (snapshot) => {
    // Chỉ kích hoạt thông báo khi dữ liệu cũ đã tải xong (tức là có cuộc họp phát sinh MỚI THỰC SỰ)
    if (daLoadXongDuLieuBanDau) {
        let cuocHopMoi = snapshot.val();
        
        // Gọi hàm hiển thị thông báo Toast lên màn hình
        hienThiThongBaoMoi(cuocHopMoi);
        
        // Đồng thời refetch lại để cập nhật hiển thị ngay trên lịch
        if (typeof calendar !== 'undefined' && calendar) {
            calendar.refetchEvents();
        }

        // Cộng dồn thêm 1 thông báo mới vào localStorage cho badge nút chuyển lịch
        let currentCounts = parseInt(localStorage.getItem('so_lich_moi_chua_xem') || '0');
        localStorage.setItem('so_lich_moi_chua_xem', currentCounts + 1);
        if (typeof capNhatBadgeGiaoDien === 'function') capNhatBadgeGiaoDien();
    }
}, err => {
    daDangKyLangNgheLichHop = false;
    console.error('Không lắng nghe được lịch họp mới:', err);
});
}

// ==========================================================================
// 4. QUẢN LÝ BIỂU MẪU ĐẶT LỊCH (MODAL ACTIONS & LOGIC VALIDATE)
// ==========================================================================

function renderCheckboxPhongBan() {
    let grid = document.getElementById('danhSachThamDuGrid');
    if(!grid) return;
    grid.innerHTML = '';
    
    // 1. CHÈN 3 NGƯỜI CỐ ĐỊNH (LÃNH ĐẠO TCS)
    let danhSachLanhDaoTCS = [
        "D/C Hồng Trưởng TCS",
        "D/C Tuyến Phó Trưởng TCS",
        "D/C Hiệp Phó Trưởng TCS"
    ];

    // Render danh sách lãnh đạo với style nổi bật
    danhSachLanhDaoTCS.forEach(ld => {
        grid.innerHTML += `
        <label class="cb-label-item" style="background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; font-weight: bold; color: #856404;">
            <input type="checkbox" class="cb-thanhphan" value="${ld}"> 
            <span>${ld}</span>
        </label>`;
    });
    
    // 2. CHÈN DANH SÁCH USER/PHÒNG BAN BÌNH THƯỜNG
    if(typeof danhSachUserThuong !== 'undefined' && danhSachUserThuong.length > 0) {
        danhSachUserThuong.forEach(pb => {
            grid.innerHTML += `
            <label class="cb-label-item">
                <input type="checkbox" class="cb-thanhphan" value="${pb}"> 
                <span>${pb}</span>
            </label>`;
        });
    }
}
function chonTatCaThamDu(checkboxAll) {
    let cbs = document.querySelectorAll('.cb-thanhphan');
    cbs.forEach(cb => cb.checked = checkboxAll.checked);
}

// Hàm mở Modal Đặt lịch mới (Dành cho tất cả mọi người)
function moModalDatLich(ngayDuocChon = null) {
    let modal = document.getElementById('modalDatLichHop');
    if(modal) {
        modal.style.display = 'block';
        
        let oNgayHop = document.getElementById('ngayHop');
        if(oNgayHop) {
            oNgayHop.value = ngayDuocChon ? ngayDuocChon : new Date().toISOString().split('T')[0];
        }
        
        // Tự động điền tên User đang đăng nhập vào trường người chủ trì
        let oNguoiChuTri = document.getElementById('nguoiChuTri');
        if(oNguoiChuTri && !oNguoiChuTri.value) {
            oNguoiChuTri.value = localStorage.getItem('cv_user') || 'Chưa rõ tên'; 
        }
    }
}

// Hàm đóng Modal Đặt lịch
function dongModalDatLich() {
    let modal = document.getElementById('modalDatLichHop');
    if(modal) {
        modal.style.display = 'none';
        resetFormLichHop();
    }
}

// Đóng modal khi click ra vùng nền đen
function dongModalDatLichNgoai(event) {
    if (event.target.id === 'modalDatLichHop') {
        dongModalDatLich();
    }
}

// Làm sạch form dữ liệu
function resetFormLichHop() {
    document.getElementById('tenCuocHop').value = '';
    document.getElementById('loaiCuocHop').selectedIndex = 0;
    document.getElementById('phongHop').selectedIndex = 0;
    document.getElementById('ngayHop').value = '';
    document.getElementById('gioBatDau').value = '';
    document.getElementById('gioKetThuc').value = '';
    document.getElementById('noiDungHop').value = '';
    
    let chkAll = document.getElementById('checkAllThamDu');
    if(chkAll) chkAll.checked = false;
    
    document.querySelectorAll('.cb-thanhphan').forEach(cb => cb.checked = false);
}

// Lưu thông tin lịch họp lên Firebase (Dành cho tất cả mọi người)
// Lưu thông tin lịch họp lên Firebase (Dành cho tất cả mọi người)
function luuLichHop() {
    let tenCuocHop = document.getElementById('tenCuocHop').value.trim();
    let loaiCuocHop = document.getElementById('loaiCuocHop').value;
    let phongHop = document.getElementById('phongHop').value;
    let ngayHop = document.getElementById('ngayHop').value;
    let gioBatDau = document.getElementById('gioBatDau').value;
    let gioKetThuc = document.getElementById('gioKetThuc').value;
    let noiDung = document.getElementById('noiDungHop').value.trim();
    
    // Người chủ trì (có thể sửa trong form)
    let nguoiChuTri = document.getElementById('nguoiChuTri').value.trim() || localStorage.getItem('cv_user') || 'Chưa rõ';
    
    // NGƯỜI TẠO LỊCH (Lấy mặc định ẩn danh trong background, để quản lý quyền xóa)
    let currentUser = localStorage.getItem('cv_user') || 'Người dùng ẩn danh';

    let thanhPhan = [];
    document.querySelectorAll('.cb-thanhphan:checked').forEach(cb => thanhPhan.push(cb.value));

    // Validate dữ liệu
    if(!tenCuocHop || !ngayHop || !gioBatDau || !gioKetThuc) {
        showToast("Vui lòng điền đầy đủ các thông tin bắt buộc (*)", 'warning');
        return;
    }

    if (gioBatDau >= gioKetThuc) {
        showToast("Giờ bắt đầu phải nhỏ hơn Giờ kết thúc!", 'warning');
        return;
    }

    let lichData = {
        tenCuocHop: tenCuocHop, 
        loaiCuocHop: loaiCuocHop,
        nguoiChuTri: nguoiChuTri,
        phongHop: phongHop, 
        ngayHop: ngayHop,
        gioBatDau: gioBatDau, 
        gioKetThuc: gioKetThuc,
        thanhPhan: thanhPhan, 
        noiDung: noiDung,
        ngayTao: Date.now(),
        nguoiTao: currentUser // <-- LƯU VÀO FIREBASE TẠI ĐÂY
    };

    let btnSubmit = document.querySelector('#modalDatLichHop .btn-primary');
    if(btnSubmit) btnSubmit.disabled = true;

    db.ref('lich_hop').push(lichData).then(() => {
        showToast("Đã đặt lịch họp thành công!", 'success');
        dongModalDatLich();
    }).catch(err => {
        showToast("Lỗi: " + err.message, 'error');
    }).finally(() => {
        if(btnSubmit) btnSubmit.disabled = false;
    });
}

// HÀM XỬ LÝ XÓA CUỘC HỌP TRÊN FIREBASE (Dành cho tất cả mọi người)
window.xoaCuocHop = async function(eventId) {
    // Hiện hộp thoại cảnh báo trước khi xóa (Bắt buộc để tránh xóa nhầm)
    let xacNhan = await showConfirm("Bạn có chắc chắn muốn XÓA cuộc họp này không?\nHành động này sẽ xóa vĩnh viễn trên toàn hệ thống!", { danger: true, okText: 'Xóa' });

    if (xacNhan) {
        db.ref('lich_hop').child(eventId).remove()
        .then(() => {
            showToast("Đã xóa cuộc họp thành công!", 'success');
            // Làm mới lại lịch hiển thị ngay lập tức
            if (typeof calendar !== 'undefined' && calendar) {
                calendar.refetchEvents();
            }
        })
        .catch((error) => {
            showToast("Lỗi khi xóa: " + error.message, 'error');
            console.error("Lỗi xóa Firebase:", error);
        });
    }
}

// Hàm tạo và hiển thị thông báo dạng Toast rực rỡ
function hienThiThongBaoMoi(data) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    let toast = document.createElement('div');
    toast.className = 'toast-notification';
    
    toast.innerHTML = `
        <span style="font-size: 20px;">📅</span>
        <div style="flex-grow: 1;">
            <strong style="color: #28a745; display: block; margin-bottom: 2px;">Lịch họp mới vừa được đặt!</strong>
            <span style="font-weight: 500;">${escapeHtml(data.tenCuocHop)}</span> <br>
            <small style="color: #adb5bd;">📍 Phòng: ${escapeHtml(data.phongHop)} | 🕒 ${escapeHtml(data.gioBatDau)} - ${escapeHtml(data.ngayHop)}</small>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// 1. THÊM HÀM NÀY VÀO TRONG THẺ SCRIPT CỦA BẠN (Để riêng lẻ ở ngoài)
function highlightLanhDao(text) {
    if (!text) return 'Không có';
    
    // Danh sách các Lãnh đạo cần làm nổi bật
    let leaders = ["D/C Hồng Trưởng TCS", "D/C Tuyến Phó Trưởng TCS", "D/C Hiệp Phó Trưởng TCS"];
    let result = text;
    
    leaders.forEach(ld => {
        // Thay thế tên Lãnh đạo bằng một thẻ span có màu vàng/đỏ nổi bật
        let regex = new RegExp(ld, "gi"); // 'gi' để không phân biệt hoa thường
        result = result.replace(regex, `<span style="background-color: #fff3cd; color: #856404; font-weight: bold; padding: 2px 6px; border-radius: 4px; border: 1px solid #ffeeba; display: inline-block; margin: 2px 0;">${ld}</span>`);
    });
    
    return result;
}

// Hàm đóng Modal chi tiết
function dongModalChiTiet() {
    document.getElementById('modalChiTietHop').style.display = 'none';
}

// Xử lý đóng modal khi click ra ngoài nền đen.
// Dùng addEventListener chứ KHÔNG gán window.onclick =: phía trên file đã có
// một handler click khác (đóng form công văn); gán trực tiếp sẽ ghi đè mất nó.
window.addEventListener('click', function(event) {
    let modalDatLich = document.getElementById('modalDatLichHop');
    let modalChiTiet = document.getElementById('modalChiTietHop');
    if (event.target === modalDatLich) dongModalDatLich();
    if (event.target === modalChiTiet) dongModalChiTiet();
});


// 1. Cập nhật giao diện hiển thị Badge dựa trên số lượng lưu trữ
// (Đưa ra phạm vi toàn cục để listener child_added của 'lich_hop' phía trên có thể gọi trực tiếp,
//  không cần đăng ký thêm 1 listener 'lich_hop' riêng nữa - tránh tải dữ liệu 2 lần lúc mở app)
function capNhatBadgeGiaoDien() {
    let btn = document.getElementById('btnChuyenLich');
    if (!btn) return;

    let counts = parseInt(localStorage.getItem('so_lich_moi_chua_xem') || '0');
    let currentBadge = document.getElementById('badgeLichHop');

    if (counts > 0) {
        // Nếu chưa có badge thì tạo mới
        if (!currentBadge) {
            currentBadge = document.createElement('span');
            currentBadge.id = 'badgeLichHop';
            currentBadge.className = 'badge-thong-bao';
            btn.appendChild(currentBadge);
        }
        // Gán số lượng cuộc họp mới chưa xem vào badge
        currentBadge.innerText = counts;
    } else {
        // Nếu bằng 0 thì ẩn/xóa đi
        if (currentBadge) currentBadge.remove();
    }
}

document.addEventListener("DOMContentLoaded", function() {
    // 2. Click vào nút -> Reset số thông báo về 0
    let btnXemLich = document.getElementById('btnChuyenLich');
    if (btnXemLich) {
        btnXemLich.addEventListener('click', function() {
            localStorage.setItem('so_lich_moi_chua_xem', '0'); // Reset về 0
            capNhatBadgeGiaoDien();
        });
    }

    // Khởi chạy kiểm tra badge ngay khi vừa load trang
    capNhatBadgeGiaoDien();
});
















// =====================================================================
// ĐĂNG KÝ SERVICE WORKER CHO PWA (cho phép cài đặt app lên màn hình chính)
// =====================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('PWA Service Worker đã hoạt động:', reg.scope))
      .catch((err) => console.error('Lỗi đăng ký Service Worker:', err));
  });
}
