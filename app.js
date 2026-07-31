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

    let danhSachCongVan = [];
    let isAdmin = false; 
    let boLocHienTai = "Tất cả"; 

    // Danh sách tài khoản người dùng thông thường
    const danhSachUserThuong = ["NVDTPC", "KT1", "KT2", "QLDN", "HKD1", "HKD2", "HKD3", "HC", "Thukhac", "truongtcs", "photruongtcs"];

    function dangNhap() {
        let u = document.getElementById('username').value.trim();
        let p = document.getElementById('password').value.trim();
        
        if (p === '123') {
            if (u === 'admin') {
                auth.signInAnonymously() 
                    .then(() => {
                        localStorage.setItem('cv_user', u);
                        localStorage.setItem('cv_role', 'admin');
                        document.getElementById('loginError').style.display = "none";
                    })
                    .catch(err => alert("Lỗi Firebase: " + err.message));
            } else if (danhSachUserThuong.includes(u)) {
                auth.signInAnonymously() 
                    .then(() => {
                        localStorage.setItem('cv_user', u);
                        localStorage.setItem('cv_role', 'user');
                        document.getElementById('loginError').style.display = "none";
                    })
                    .catch(err => alert("Lỗi Firebase: " + err.message));
            } else {
                document.getElementById('loginError').style.display = "block";
            }
        } else {
            document.getElementById('loginError').style.display = "block";
        }
    }

    function dangXuat() {
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

            if(!cv.trichYeu) { alert("Vui lòng nhập Trích yếu nội dung!"); return; }

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
            if(!cvId) { alert("Bạn không có quyền thêm mới công văn!"); return; }

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
                    alert("Cập nhật trạng thái công văn thành công!");
                    dongForm();
                })
                .catch(err => alert("Lỗi khi cập nhật dữ liệu: " + err.message));
        }
    }

    function xoaCongVan(key) {
        if(!isAdmin) return;
        if(confirm("Bạn có chắc chắn muốn XÓA công văn này không?")) {
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
    function importExcel(element) {
        if (!isAdmin) { alert("Bạn không có quyền thao tác!"); return; }
        let file = element.files[0];
        if (!file) return;

        let reader = new FileReader();
        reader.onload = function (e) {
            try {
                let data = new Uint8Array(e.target.result);
                let workbook = XLSX.read(data, { type: 'array' });
                let firstSheetName = workbook.SheetNames[0];
                let worksheet = workbook.Sheets[firstSheetName];
                
                let jsonData = XLSX.utils.sheet_to_json(worksheet);
                if (jsonData.length === 0) { alert("File Excel trống hoặc lỗi định dạng!"); return; }

                if (confirm("Tìm thấy " + jsonData.length + " hàng dữ liệu. Tiến hành import vào hệ thống?")) {
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
                    alert("Import hoàn thành! Thêm mới: " + successAddCount + ", Cập nhật: " + successUpdateCount);
                }
            } catch (error) {
                alert("Lỗi import file: " + error.message);
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
                    <td>${cv.ngayDen}</td>
                    <td>${cv.soDen}</td>
                    <td>${cv.coQuanGui}</td>
                    <td>${cv.soKyHieu || ''}</td>
                    <td>${cv.ngayVB}</td>
                    <td>${cv.trichYeu}</td>
                    <td>${cv.bpChuTri}</td>
                    <td>${cv.bpPhoiHop}</td> 
                    <td>${cv.hanXuLy}</td>
                    <td>${cv.soNgayCon}</td>
                    <td><span class="status-badge ${mt}" style="${badgeStyle}">${cv.trangThai}</span></td>
                    <td class="${cb}">${cv.canhBao}</td>
                    <td><strong>${cv.tuanBC || ''}</strong></td>
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
                    alert("Bạn không có quyền xóa!");
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

    function exportExcel() {
        try {
            if (typeof XLSX === 'undefined') {
                alert("Hệ thống chưa nhận thư viện Excel! Hãy kiểm tra thẻ script trong head.");
                return;
            }
            if (!danhSachCongVan || danhSachCongVan.length === 0) {
                alert("Không có dữ liệu để xuất!");
                return;
            }

            let filter = (typeof boLocHienTai !== 'undefined') ? boLocHienTai : "Tất cả";
            let danhSachXuat = filter === 'Tất cả' 
                ? danhSachCongVan 
                : danhSachCongVan.filter(item => item.trangThai === filter);

            if (danhSachXuat.length === 0) {
                alert("Không có công văn nào phù hợp để xuất!");
                return;
            }

            let excelRows = danhSachXuat.map((cv, index) => {
                return {
                    'STT': index + 1,
                    'Ngày đến': cv.ngayDen || '',
                    'Số đến': cv.soDen || '',
                    'Cơ quan gửi': cv.coQuanGui || '',
                    'Số ký hiệu VB': cv.soKyHieu || '',
                    'Ngày VB': cv.ngayVB || '',
                    'Trích yếu nội dung': cv.trichYeu || '',
                    'BP Chủ trì': cv.bpChuTri || '',
                    'BP Phối hợp': cv.bpPhoiHop || '',
                    'Hạn xử lý': cv.hanXuLy || '',
                    'Số ngày còn': (cv.soNgayCon !== undefined && cv.soNgayCon !== null) ? cv.soNgayCon : '',
                    'Lặp lại': cv.lapLai || 'Một lần',
                    'Trạng thái': cv.trangThai || '',
                    'Ngày hoàn thành': cv.ngayHoanThanh || '',
                    'Tuần BC': cv.tuanBC || '',
                    'Cảnh báo': cv.canhBao || ''
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
            alert("Lỗi xuất Excel: " + error.message);
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
                                👤 <strong>User:</strong> <span style="color:#0056b3;">${log.user}</span> | 
                                📌 <strong>Trạng thái:</strong> [${log.trangThai}] | 
                                📆 <strong>Ngày HT:</strong> [${log.ngayHoanThanh || 'Trống'}] 
                                <br><small style="color:#888;">⏱️ Lúc: ${log.thoiGian}</small>
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

    window.onclick = function(event) {
        let modal = document.getElementById("modalForm");
        if (event.target === modal) {
            dongForm();
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
        if(!msg) { alert('Vui lòng nhập nội dung thông báo!'); return; }
        
        // Đẩy dữ liệu vào nhánh mới là 'thong_bao_he_thong_danh_sach'
        db.ref('thong_bao_he_thong_danh_sach').push({
            noidung: msg,
            nguoigui: localStorage.getItem('cv_user') || 'Admin',
            thoigian: Date.now()
        }).then(() => {
            alert("Đã gửi thông báo thành công!");
            dongFormThongBao();
        }).catch(err => {
            alert("Lỗi khi gửi: " + err.message);
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
// Lắng nghe dữ liệu Thông báo và trạng thái Đã đọc từ Firebase
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
                let danhSachUserDaXem = dataDaDoc[tb.key] ? Object.keys(dataDoc = dataDaDoc[tb.key]) : [];
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
});
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
                    👁️ <strong>Đã xem:</strong> ${tb.daXemList.join(', ')}
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
                <div class="tb-sender" style="font-weight: bold; color: #333;">👤 ${tb.nguoigui}</div>
                <p class="tb-msg" style="margin: 5px 0; white-space: pre-wrap;">${tb.noidung}</p>
                ${dongNguoiDaXemHTML}
            </div>
        `;
    });

    container.innerHTML = htmlThongBao;
}
// ==========================================================================
// 1. QUẢN LÝ THÔNG BÀO HỆ THỐNG (CHỈ ADMIN)
// ==========================================================================
function xoaThongBao(key) {
    if(!isAdmin) return;
    if(confirm("Bạn có chắc chắn muốn XÓA thông báo này khỏi hệ thống không?")) {
        db.ref('thong_bao_he_thong_danh_sach/' + key).remove()
        .then(() => {
            db.ref('thong_bao_da_doc/' + key).remove();
        })
        .catch(err => {
            alert("Lỗi khi xóa: " + err.message);
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
let calendar;
let isCalendarInit = false;

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
                            <div style="margin-bottom: 4px;">👤 <b>Chủ trì:</b> ${p.nguoiChuTri || 'Chưa rõ'}</div>
                            <div style="margin-bottom: 4px;">👥 <b>Phòng ban:</b> ${dsThamDu}</div>
                            <div style="white-space: pre-wrap; word-break: break-word; margin-bottom: 4px;">📝 <b>Nội dung:</b> ${p.noiDung || 'Không có'}</div>
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
            
            // Xử lý bôi màu nổi bật cho các Lãnh đạo
            let chuTriHienThi = highlightLanhDao(p.nguoiChuTri);
            let thanhPhanHienThi = highlightLanhDao(dsThamDu);

            // Đẩy dữ liệu vào Modal HTML
            document.getElementById('ct_tenCuocHop').innerHTML = `📌 ${p.tenCuocHop}`;
            document.getElementById('ct_phongHop').innerHTML = p.phongHop;
            document.getElementById('ct_thoiGian').innerHTML = `${p.gioBatDau} - ${p.gioKetThuc} (Ngày ${p.ngayHop})`;
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
            // Tự động điều chỉnh khi xoay ngang/dọc điện thoại
            if (window.innerWidth < 768) {
                calendar.changeView('listMonth');
            } else {
                calendar.changeView('dayGridMonth');
            }
        }
    });
    
    calendar.render();
    
    // Cập nhật lại lịch khi có dữ liệu mới từ Firebase
    db.ref('lich_hop').on('value', () => { 
        if(calendar) calendar.refetchEvents(); 
    });
}

// Cờ đánh dấu để tránh việc load lại toàn bộ dữ liệu cũ lúc ban đầu rồi hiển thị thông báo dồn dập
let daLoadXongDuLieuBanDau = false;

// 1. Chờ lấy toàn bộ dữ liệu cũ lần đầu tiên xong xuôi
db.ref('lich_hop').once('value').then(() => {
    daLoadXongDuLieuBanDau = true;
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
});

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
        alert("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
        return;
    }
    
    if (gioBatDau >= gioKetThuc) {
        alert("Giờ bắt đầu phải nhỏ hơn Giờ kết thúc!");
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
        alert("Đã đặt lịch họp thành công!");
        dongModalDatLich();
    }).catch(err => {
        alert("Lỗi: " + err.message);
    }).finally(() => {
        if(btnSubmit) btnSubmit.disabled = false;
    });
}

// HÀM XỬ LÝ XÓA CUỘC HỌP TRÊN FIREBASE (Dành cho tất cả mọi người)
window.xoaCuocHop = function(eventId) {
    // Hiện hộp thoại cảnh báo trước khi xóa (Bắt buộc để tránh xóa nhầm)
    let xacNhan = confirm("⚠️ CẢNH BÁO:\nBạn có chắc chắn muốn XÓA cuộc họp này không?\nHành động này sẽ xóa vĩnh viễn trên toàn hệ thống!");
    
    if (xacNhan) {
        db.ref('lich_hop').child(eventId).remove()
        .then(() => {
            alert("✅ Đã xóa cuộc họp thành công!");
            // Làm mới lại lịch hiển thị ngay lập tức
            if (typeof calendar !== 'undefined' && calendar) {
                calendar.refetchEvents();
            }
        })
        .catch((error) => {
            alert("❌ Lỗi khi xóa: " + error.message);
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
            <span style="font-weight: 500;">${data.tenCuocHop}</span> <br>
            <small style="color: #adb5bd;">📍 Phòng: ${data.phongHop} | 🕒 ${data.gioBatDau} - ${data.ngayHop}</small>
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

// Xử lý đóng modal khi click ra ngoài nền đen (Bổ sung vào event có sẵn nếu bạn đã có hàm window.onclick)
window.onclick = function(event) {
    let modalDatLich = document.getElementById('modalDatLichHop');
    let modalChiTiet = document.getElementById('modalChiTietHop');
    if (event.target === modalDatLich) dongModalDatLich();
    if (event.target === modalChiTiet) dongModalChiTiet();
}


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















