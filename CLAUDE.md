# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A single-page Vietnamese-language PWA for internal document/dispatch tracking ("Quản Lý Công Văn Nội Bộ") with a secondary built-in meeting-scheduling view ("Lịch Họp"). There is no build system, no package manager, and no test suite — it's plain HTML/CSS/JS loaded directly by the browser, backed by Firebase Realtime Database.

## Files

- `index.html` — the entire UI: all screens (login, công văn table, calendar, all modals) and all CSS live in this one file.
- `app.js` — all application logic (Firebase init, auth, CRUD, filtering/rendering, Excel import/export, calendar, notifications).
- `sw.js` — service worker for PWA installability (app-shell caching only).
- `manifest.json` — PWA manifest.
- `icons/` — app icons referenced by the manifest/service worker.
- `database.rules.json` — Firebase Realtime Database security rules **template**. This is a reference file only; it is not auto-deployed. Apply it via the Firebase Console (Realtime Database → Rules) or `firebase deploy --only database` if the Firebase CLI is ever added to this project. See the Security section below for what it does and does not protect against.

There is no `package.json`, bundler, linter, or test framework in this repo.

## Running / testing changes

There are no build, lint, or test commands. To manually verify a change:
- Serve the folder over HTTP (service workers and Firebase won't reliably work from a `file://` URL) — e.g. `npx serve .` or `python -m http.server` — and open the served URL in a browser.
- Log in with a username from the hardcoded list below and password `123`, then exercise the feature by hand in the browser.
- Since `sw.js` does network-first fetching for app-shell files, hard-refresh (or unregister the service worker in devtools) when testing local edits to `index.html`/`app.js`, otherwise a stale cached copy may be served offline.

## Architecture

### Auth is a client-side allowlist, not real authorization
`dangNhap()` in [app.js](app.js) checks the typed username against a hardcoded password (`'123'` for everyone) and two hardcoded lists: `'admin'` and `danhSachUserThuong` (array of user codes like `NVDTPC`, `KT1`, `HKD1`, ...). On success it calls `auth.signInAnonymously()` purely to get *a* Firebase Auth session (so Realtime Database rules can require `auth != null`), then stores the actual identity/role in `localStorage` (`cv_user`, `cv_role`). `isAdmin` is a JS variable derived from that localStorage value, not from any Firebase custom claim. This means:
- All admin-vs-user gating (`isAdmin` checks throughout `app.js`, and the show/hide of `btnAdd`/`btnExcel`/etc.) is UI-only and trivially bypassable client-side.
- Real server-side enforcement of admin-vs-user (not just "is someone signed in") is **not achievable** with this architecture, because Anonymous Auth UIDs aren't tied to a real per-person identity — anyone can call `signInAnonymously()` themselves. `database.rules.json` in this repo only requires `auth != null`, which stops raw/unauthenticated REST access but does not stop someone who reads the client JS and signs in anonymously on their own. If real role separation is ever needed, it requires migrating off the shared-password + anonymous-auth scheme to real per-user Firebase Authentication (see the Security section).
- Adding a new user means adding their code to `danhSachUserThuong` in `app.js`.
- Login attempts are throttled client-side (`SO_LAN_SAI_TOI_DA` / `THOI_GIAN_KHOA_MS` in `app.js`, backed by `localStorage`) as defense-in-depth against automated password guessing. This is easily bypassed by clearing localStorage or calling `dangNhap()`'s underlying Firebase calls directly — it raises the bar, it doesn't close the hole.

### Firebase Realtime Database schema
Firebase (compat SDK v8.10.1, loaded via CDN in `index.html`) is the only backend. Config/keys are in `app.js` (a Firebase client config is not a secret by itself; don't treat it as one, but also don't assume it grants any protection — see auth note above). Top-level RTDB paths:
- `cong_van/{key}` — one công văn (dispatch) record: `ngayDen, soDen, coQuanGui, soKyHieu, ngayVB, trichYeu, bpChuTri, bpPhoiHop, hanXuLy, soNgayCon, canhBao, tuanBC, lapLai, trangThai, ngayHoanThanh`, plus `lichSuSua` (array of `{user, trangThai, ngayHoanThanh, thoiGian}` — an audit trail of non-admin status updates, appended to in `luuCongVan()`).
- `thong_bao_he_thong_danh_sach/{key}` — system-wide admin broadcast notifications: `{noidung, nguoigui, thoigian}`.
- `thong_bao_da_doc/{tbKey}/{username}` — read receipts: presence of a `username` key under a notification means that user has seen it.
- `lich_hop/{key}` — one meeting record: `{tenCuocHop, loaiCuocHop, nguoiChuTri, phongHop, ngayHop, gioBatDau, gioKetThuc, thanhPhan[], noiDung, ngayTao, nguoiTao}`. `nguoiTao` (creator) is compared against the logged-in user to decide who can see the delete button for that meeting.

All reads are live (`db.ref(...).on('value', ...)`) rather than one-shot, so UI state generally reacts to Firebase changes automatically instead of needing manual refresh calls.

### Two views toggled in one DOM, not routed pages
`toggleChucNang('LICH' | 'CONGVAN')` in `app.js` just flips `display` between `#mainApp` (công văn table) and `#calendarApp` (FullCalendar-based meeting view) — there is no router. The calendar (`initCalendar()`) is lazily constructed once on first switch (`isCalendarInit` flag) because FullCalendar sizes itself incorrectly if built while hidden; switching back in triggers `calendar.updateSize()` on a short timeout as a workaround.

### Table rendering is manual string-building, not reactive
`hienThiBang()` is the single function that: reads all active filter inputs, filters `danhSachCongVan` (the in-memory mirror of `cong_van`, kept in sync by the `on('value')` listener), recomputes the status counter cards, then rebuilds the `<tbody>` HTML as one big string and assigns it once (deliberately batched to avoid layout thrash on large lists). Any new filter or column needs to be wired into this one function. Row action buttons differ by `isAdmin` (edit+delete vs. update-status-only), and a click-count timer (`xuLyClick`) distinguishes single/double/triple click on a row (double = open edit form, triple = delete for admins).

### Non-admin edits are merged, not overwritten
In `luuCongVan()`, admins write the full record via `db.ref('cong_van/'+cvId).update(cv)`. Non-admins can only update `trangThai`/`ngayHoanThanh` on an *existing* record, and that update also appends an entry to `lichSuSua` client-side before pushing — so history is accumulated in the payload the client sends, not via a server-side trigger.

### Push notifications (FCM) — new admin notifications reach closed apps too
Real push (delivered even when no tab/app is open) can only originate server-side, so this is split across three pieces:
- **Client (`app.js`)**: `khoiTaoPushNotification()` runs after login, requests Notification permission, calls `firebase.messaging().getToken({vapidKey, serviceWorkerRegistration})`, and stores the token at `fcm_tokens/{username}/{token}`. `dangXuat()` removes that user's token on logout via `xoaPushTokenHienTai()`. Requires a real VAPID key pasted into the `VAPID_KEY_FCM` constant (Firebase Console → Project Settings → Cloud Messaging → Web Push certificates) — without it, push silently no-ops.
- **Service worker (`sw.js`)**: reuses the *same* SW registration as the PWA app-shell cache (rather than a separate `firebase-messaging-sw.js`) because a browser only runs one active service worker per scope, and this app already registers one at `/`. It `importScripts`s the Firebase compat SDK, calls `messaging.setBackgroundMessageHandler()` to show a native OS notification when the app is closed/backgrounded, and a `notificationclick` handler to focus/open the app.
- **Server (`functions/index.js`, deployed separately)**: `guiPushKhiCoThongBaoMoi` is an `onValueCreated` Realtime Database trigger on `thong_bao_he_thong_danh_sach/{tbId}` — the same path `thucHienGuiThongBao()` in `app.js` pushes to when an admin sends a notification. It reads all of `fcm_tokens`, excludes the sender's own tokens, sends via `admin.messaging().sendEachForMulticast()` in batches of 500, and prunes tokens FCM reports as no-longer-registered. **This requires the Firebase project to be on the Blaze plan** and `firebase deploy --only functions,database` to have been run at least once — it is not automatically live just because this code exists in the repo (see `DEPLOY_PUSH_NOTIFICATIONS.md`).
- **Rules**: `database.rules.json` has a matching `fcm_tokens/$username/$token` section (auth != null, same pattern as everything else).

### Notifications: single Firebase listener drives both bell and toast
There is one `db.ref('thong_bao_he_thong_danh_sach').on('value', ...)` listener (see `app.js`) that computes unread count (via `thong_bao_da_doc`) and re-renders the notification list — this was deliberately consolidated (per the comment in `app.js`) to avoid double-listening/double-rendering. Meeting-added toasts use a separate `lich_hop` `child_added` listener guarded by a `daLoadXongDuLieuBanDau` flag so the initial bulk load of existing meetings doesn't fire a toast per row — only genuinely new meetings do.

### Leadership highlighting in the calendar
`initCalendar()`'s `events` function and `highlightLanhDao()` both hardcode the same three leadership name strings (e.g. `"d/c hồng trưởng tcs"`) to (a) optionally filter the calendar to only leadership meetings via the `#btnLocLanhDao` toggle, and (b) visually highlight those names in meeting detail views. If leadership members change, both lists need updating together.

### Excel import/export (SheetJS, admin-only)
`importExcel()` and `exportExcel()` use `XLSX` (loaded from CDN). Import matches incoming rows against existing `cong_van` records by normalized `soDen` (số đến) to decide update-vs-insert, and accepts both Vietnamese-labeled and camelCase column headers (e.g. `'Ngày đến'` or `'ngayDen'`) for flexibility with hand-edited spreadsheets. Date parsing (`parseDate`) handles both Excel serial-date numbers and `dd/mm/yyyy` strings. `exportExcel()` runs every string cell through `sanitizeForExcel()` first, which prefixes a leading `'` when a value starts with `= + - @` or a tab/CR — this neutralizes Excel/CSV formula injection (a cell like `=HYPERLINK(...)` typed into "Trích yếu" by any admin would otherwise execute as a formula for whoever opens the exported report).

## Security

This app was hardened for production within the constraints of the existing shared-password/anonymous-auth login (see the Auth note above) — it was **not** migrated to real per-user Firebase Authentication. Keep this in mind when adding features that touch untrusted input or Firebase data:

- **XSS**: `escapeHtml()` in `app.js` must be used on every piece of user-controlled data (công văn fields, meeting fields, notification text, history log entries — including anything that came in through Excel import, since spreadsheet cells are just as untrusted as form input) before it's placed into `innerHTML`. This is already applied throughout `hienThiBang()`, `renderBangThongBao()`, `moFormSua()`'s history panel, the calendar's `eventDidMount`/`eventClick`, and the meeting-added toast. If you add a new place that builds HTML via template literals + `innerHTML` from Firebase data, escape it the same way. `highlightLanhDao()` is the one place that deliberately inserts *trusted* markup on top of already-escaped text (it wraps leader names in a `<span>`) — always escape first, then call `highlightLanhDao()`, never the other way around.
- **No native `alert()`/`confirm()`**: use `showToast(message, type)` (`type` is `'success' | 'error' | 'warning' | 'info'`) and `await showConfirm(message, { danger, okText })` (both defined near the top of `app.js`). `showConfirm` is async (returns a Promise), so callers must be `async function`s — see `xoaCongVan`, `xoaThongBao`, `xoaCuocHop`, `importExcel` for the pattern. Both helpers escape the message text internally, so callers don't need to pre-escape.
- **Firebase Realtime Database rules**: `database.rules.json` requires `auth != null` for every path and validates field types/lengths (e.g. `trichYeu` must be a string ≤ 3000 chars, `lich_hop` entries must have the 4 required fields). It does **not** and cannot distinguish admin vs. regular user server-side — see the Auth note above for why. Push this file to the actual Firebase project's Rules tab before/при going to production; an unset Rules tab defaults to Firebase's own sample rules, which are typically wide open.
- **Firebase API key**: the key in `app.js` is a public client identifier, not a secret — this is normal for Firebase web apps and rotating it buys nothing by itself. The actual production hardening step is restricting that key's allowed HTTP referrers in Google Cloud Console → Credentials, so it can't be reused wholesale from another site, plus the Database Rules above.
- **Login throttling** (`SO_LAN_SAI_TOI_DA`, `THOI_GIAN_KHOA_MS`) is client-side defense-in-depth only, not a real rate limit — see the Auth note above.

## UI / design system

`index.html`'s single `<style>` block defines CSS custom properties on `:root` (`--bg`, `--surface`, `--ink`, `--brand`, `--radius-*`, `--shadow*`, etc.) — reuse these instead of hardcoding new hex colors so new UI stays visually consistent and theme-aware. Two things to know before touching styles:

- **Dark mode** is implemented via `@media (prefers-color-scheme: dark)` (system default) plus a `data-theme="dark"|"light"` attribute on `<html>` that overrides it (set by `toggleDarkMode()` in `app.js`, persisted to `localStorage['cv_theme']`, applied on load before first paint by the IIFE at the top of `app.js`). When adding new UI, prefer the CSS variables so it adapts automatically; if you must hardcode a color (e.g. inline `style="color:#dc3545"` on a one-off element), it won't adapt to dark mode — check whether an existing `--danger`/`--warn`/`--success`/`--brand` variable already covers it first.
- Toasts and the confirm dialog are plain DOM components appended to `<body>` at call time (`.toast-container`/`.toast-notification` and `.confirm-overlay`/`.confirm-box`) — their CSS lives near the end of the `<style>` block. There is no toast/dialog markup permanently in the HTML to keep in sync.
