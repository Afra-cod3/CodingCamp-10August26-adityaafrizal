# Implementation Plan: To-Do List Life Dashboard

## Overview

Implementasi dilakukan secara incremental dalam urutan bottom-up: scaffolding proyek → modul shared (StorageManager, EventBus, UIHelpers) → widget satu per satu (GreetingWidget, TimerWidget, TodoWidget, QuickLinksWidget) → pengujian property-based → polish aksesibilitas dan responsivitas. Setiap langkah langsung terintegrasi ke `app.js` sehingga tidak ada kode yang menggantung.

Bahasa implementasi: **Vanilla JavaScript** (HTML, CSS, JS murni — tanpa framework, tanpa build step).

---

## Tasks

- [x] 1. Scaffolding proyek dan HTML skeleton
  - [x] 1.1 Buat file `index.html` dengan struktur HTML lengkap
    - Tulis DOCTYPE, `<html lang="id">`, meta charset, viewport, dan title
    - Tambahkan `<link rel="stylesheet" href="css/style.css">` dan `<script src="js/app.js" defer></script>` dengan path relatif
    - Buat `<div id="notification-modal" role="dialog" aria-modal="true" hidden>` untuk modal timer
    - Buat `<div id="storage-banner" role="alert" hidden>` untuk banner error storage
    - Buat `<main id="dashboard">` berisi empat `<section class="widget">` dengan id `greeting-widget`, `timer-widget`, `todo-widget`, `quicklinks-widget`
    - Setiap section memiliki heading `<h2>` yang deskriptif
    - _Requirements: 11.1, 11.3, 11.4, 11.5, 12.1_

  - [x] 1.2 Buat file `css/style.css` dengan CSS base, design tokens, dan layout grid
    - Definisikan CSS custom properties (`:root`) untuk warna, spacing, font-size, border-radius, shadow
    - Tulis CSS reset/base (box-sizing, margin, padding, font-family)
    - Implementasi `#dashboard` dengan `display: grid; grid-template-columns: 1fr 1fr; gap: ...` untuk desktop
    - Tulis shared `.widget` styles: padding, background, border-radius, box-shadow — pastikan ada pemisah visual antar widget (border atau perbedaan background)
    - Tambahkan media query `@media (max-width: 1023px)` yang mengubah grid ke `grid-template-columns: 1fr` untuk tablet
    - _Requirements: 11.1, 11.5, 12.2, 12.4_

  - [x] 1.3 Buat file `js/app.js` dengan IIFE wrapper dan bootstrap
    - Buat kerangka IIFE: `(function() { 'use strict'; /* modules */ document.addEventListener('DOMContentLoaded', ...) })();`
    - Tambahkan placeholder kosong untuk setiap modul: `const StorageManager = {};`, `const EventBus = {};`, `const UIHelpers = {};`, `const GreetingWidget = {};`, `const TimerWidget = {};`, `const TodoWidget = {};`, `const QuickLinksWidget = {};`
    - Tulis fungsi bootstrap di `DOMContentLoaded` yang memanggil `.init()` pada setiap widget
    - _Requirements: 11.2, 11.3, 11.4_

- [x] 2. Implementasi modul shared: EventBus dan UIHelpers
  - [x] 2.1 Implementasi `EventBus` di `app.js`
    - Tulis `on(event, handler)` yang mendaftarkan handler ke map internal
    - Tulis `off(event, handler)` yang menghapus handler dari map
    - Tulis `emit(event, data)` yang memanggil semua handler terdaftar untuk event tersebut
    - Definisikan konstanta `Events`: `TIMER_COMPLETE`, `NOTIFICATION_ACK`, `STORAGE_ERROR`
    - _Requirements: 11.2_

  - [x] 2.2 Implementasi `UIHelpers` di `app.js`
    - Tulis `createElement(tag, attrs, ...children)` yang membuat `HTMLElement` dengan atribut dan children
    - Tulis `sanitizeText(str)` yang meng-escape HTML entities (`&`, `<`, `>`, `"`, `'`)
    - Tulis `showNotification(message)` yang menampilkan `#notification-modal` dengan teks pesan, tombol dismiss, dan trap focus ke modal
    - Tulis `dismissNotification()` yang menyembunyikan modal dan emit `Events.NOTIFICATION_ACK`
    - Tulis `showStorageError(message)` yang menampilkan toast error yang auto-dismiss setelah 5 detik atau bisa ditutup manual
    - _Requirements: 4.2, 4.3, 4.4, 10.3_

- [x] 3. Implementasi `StorageManager` di `app.js`
  - [x] 3.1 Implementasi metode baca dan tulis StorageManager
    - Definisikan konstanta `KEYS = { TODOS: 'tld_todos_v1', LINKS: 'tld_links_v1' }`
    - Tulis `readTodos()`: `localStorage.getItem` dalam `try/catch` → jika `null` return `[]` → `JSON.parse` dalam `try/catch` terpisah → validasi array → return array atau `[]`
    - Tulis `writeTodos(items)`: `JSON.stringify` lalu `localStorage.setItem` dalam `try/catch` → return `{ ok: true }` atau `{ ok: false, error: e.message }`
    - Tulis `readLinks()` dan `writeLinks(items)` dengan pola yang sama
    - Pastikan data JSON korup (bukan array) menghasilkan `console.warn` dan return `[]` tanpa crash
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

  - [ ]* 3.2 Tulis property test untuk Property 8: Round-Trip Storage
    - **Property 8: Round-Trip Storage Todos dan Links**
    - **Validates: Requirements 5.5, 10.5**
    - Buat file `js/tests/storage.test.js` (atau inline dalam test runner HTML)
    - Gunakan `fast-check` via CDN dalam test environment
    - Generate array `Todo_Item[]` acak (id uuid, title string valid, completed boolean) — minimal 100 iterasi
    - Verifikasi: `writeTodos(arr)` lalu `readTodos()` menghasilkan array yang identik (panjang, id, title, completed, urutan sama)
    - Ulangi untuk `Link_Item[]` dengan `writeLinks`/`readLinks`
    - Tag komentar: `// Feature: todo-life-dashboard, Property 8: Round-trip storage todos dan links`

  - [ ]* 3.3 Tulis property test untuk Property 13: Serialisasi JSON
    - **Property 13: Serialisasi JSON Mengandung Field yang Diperlukan**
    - **Validates: Requirements 10.4**
    - Generate random `Todo_Item[]` dan verifikasi JSON yang di-`stringify` mengandung `id` (string), `title` (string), `completed` (boolean) pada setiap elemen
    - Generate random `Link_Item[]` dan verifikasi setiap elemen mengandung `id` (string), `label` (string), `url` (string)
    - Tag komentar: `// Feature: todo-life-dashboard, Property 13: Serialisasi JSON mengandung field yang diperlukan`

- [x] 4. Implementasi `GreetingWidget` di `app.js`
  - [x] 4.1 Implementasi `GreetingWidget.init()` dan rendering awal
    - Tulis `init(containerEl)` yang membuat struktur DOM: elemen untuk waktu, tanggal, dan sapaan
    - Panggil `_tick()` segera saat init untuk memastikan nilai tampil dalam <1 detik setelah halaman dimuat
    - Mulai `setInterval(_tick, 1000)` untuk pembaruan per detik
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Implementasi metode internal GreetingWidget
    - Tulis `_tick()`: ambil `new Date()`, validasi dengan `isNaN(date.getTime())`, update DOM hanya jika menit atau sapaan berubah (bandingkan dengan nilai sebelumnya)
    - Tulis `_formatTime(date)`: return `HH:MM` dari `date.getHours()` dan `date.getMinutes()` dengan padding dua digit; return `"--:--"` jika date invalid
    - Tulis `_formatDate(date)`: return `"NamaHari, DD NamaBulan YYYY"` menggunakan array `_LOCALE_DAYS` dan `_LOCALE_MONTHS` dalam Bahasa Indonesia; return `"--"` jika date invalid
    - Tulis `_getGreeting(hour)`: mapping 5–11→"Selamat Pagi", 12–14→"Selamat Siang", 15–17→"Selamat Sore", 18–23 dan 0–4→"Selamat Malam"; return `"Halo"` jika hour bukan angka valid
    - Definisikan `_LOCALE_DAYS` dan `_LOCALE_MONTHS` sebagai array string Bahasa Indonesia
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Tambahkan style CSS untuk GreetingWidget
    - Tulis styles untuk `#greeting-widget`: tampilan waktu besar, tanggal lebih kecil, teks sapaan
    - Tambahkan hover/focus state pada elemen interaktif (jika ada)
    - _Requirements: 12.3_

  - [ ]* 4.4 Tulis property test untuk Property 1: Format Waktu HH:MM
    - **Property 1: Format Waktu HH:MM**
    - **Validates: Requirements 1.1**
    - Generate objek `Date` acak dengan jam dan menit arbitrary (0–23, 0–59)
    - Verifikasi `_formatTime(date)` mengembalikan string yang cocok dengan `/^\d{2}:\d{2}$/`
    - Tag komentar: `// Feature: todo-life-dashboard, Property 1: Format waktu HH:MM`

  - [ ]* 4.5 Tulis property test untuk Property 2: Format Tanggal Bahasa Indonesia
    - **Property 2: Format Tanggal Bahasa Indonesia**
    - **Validates: Requirements 1.2**
    - Generate objek `Date` acak untuk semua 365 hari dalam setahun
    - Verifikasi `_formatDate(date)` mengandung nama hari Indonesia yang valid, angka tanggal, nama bulan Indonesia yang valid, dan tahun 4 digit
    - Tag komentar: `// Feature: todo-life-dashboard, Property 2: Format tanggal Bahasa Indonesia`

  - [ ]* 4.6 Tulis property test untuk Property 3: Pemetaan Jam ke Sapaan
    - **Property 3: Pemetaan Jam ke Sapaan**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Untuk setiap nilai integer jam 0–23 (enumerate semua), verifikasi `_getGreeting(hour)` mengembalikan tepat satu dari empat sapaan yang benar sesuai rentang
    - Verifikasi 5–11→"Selamat Pagi", 12–14→"Selamat Siang", 15–17→"Selamat Sore", {0–4, 18–23}→"Selamat Malam"
    - Tag komentar: `// Feature: todo-life-dashboard, Property 3: Pemetaan jam ke sapaan`

- [ ] 5. Checkpoint — Verifikasi Greeting dan Storage
  - Pastikan halaman terbuka di browser tanpa console error
  - Pastikan waktu, tanggal, dan sapaan tampil dengan benar
  - Pastikan storage read/write berfungsi lewat DevTools Console
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [x] 6. Implementasi `TimerWidget` di `app.js`
  - [ ] 6.1 Implementasi `TimerWidget.init()`, state, dan rendering tombol
    - Tulis `init(containerEl)` yang membuat DOM: display `<time>` untuk countdown, tombol Start, Stop, Reset
    - Inisialisasi state: `_state = 'idle'`, `_remainingMs = 25 * 60 * 1000`, `_endTime = null`, `_intervalId = null`
    - Pasang event listener pada setiap tombol yang memanggil `_start()`, `_stop()`, `_reset()`
    - Tampilkan "25:00" sebagai nilai awal
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 6.2 Implementasi logika countdown timestamp-based
    - Tulis `_start()`: set `_endTime = Date.now() + _remainingMs`, set `_state = 'running'`, mulai `setInterval(_tick, 1000)`, panggil `_updateButtons()`
    - Tulis `_tick()`: hitung `remaining = _endTime - Date.now()`, jika `remaining <= 0` panggil `_onComplete()`, jika tidak update display dengan `Math.max(0, remaining)` dan panggil `_formatDisplay(remaining)`
    - Tulis `_stop()`: `clearInterval`, simpan `_remainingMs = _endTime - Date.now()`, set `_state = 'idle'`, panggil `_updateButtons()`
    - Tulis `_reset()`: `clearInterval`, set `_remainingMs = 25 * 60 * 1000`, set `_state = 'idle'`, update display ke "25:00", panggil `_updateButtons()`
    - Tulis `_formatDisplay(ms)`: konversi ms ke MM:SS dengan padding dua digit
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 6.3 Implementasi state machine tombol dan notifikasi selesai
    - Tulis `_updateButtons()`: aktifkan/nonaktifkan Start, Stop, Reset sesuai state machine: `idle/paused`→Start=on,Stop=off,Reset=on; `running`→Start=off,Stop=on,Reset=on; `done`→Start=off,Stop=off,Reset=on
    - Tulis `_onComplete()`: `clearInterval`, set `_state = 'done'`, panggil `_updateButtons()`, tampilkan notifikasi visual via `UIHelpers.showNotification()`
    - Pasang listener pada `Events.NOTIFICATION_ACK` via `EventBus.on` untuk memanggil `_reset()` saat notifikasi dikonfirmasi
    - Pastikan saat `_state = 'done'` dan display "00:00", menekan Start tidak melakukan apa-apa (tombol disabled)
    - _Requirements: 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4_

  - [x] 6.4 Tambahkan style CSS untuk TimerWidget
    - Tulis styles untuk `#timer-widget`: display countdown besar di tengah, tiga tombol berjajar
    - Tambahkan visual state untuk tombol disabled (`opacity`, `cursor: not-allowed`)
    - Tambahkan hover/focus/active state pada tombol yang enabled (perubahan visual dalam <100ms)
    - _Requirements: 12.3_

  - [ ]* 6.5 Tulis property test untuk Property 4: Format Display Timer MM:SS
    - **Property 4: Format Display Timer MM:SS**
    - **Validates: Requirements 3.1**
    - Generate nilai `ms` acak dalam rentang 0–5.999.000 ms (0–5999 detik)
    - Verifikasi `_formatDisplay(ms)` mengembalikan string cocok `/^\d{2}:\d{2}$/` dengan menit = `Math.floor(seconds / 60)` dan detik = `seconds % 60` di-pad dua digit
    - Tag komentar: `// Feature: todo-life-dashboard, Property 4: Format display timer MM:SS`

  - [ ]* 6.6 Tulis property test untuk Property 5: Invariant State Machine Tombol Timer
    - **Property 5: Invariant State Machine Tombol Timer**
    - **Validates: Requirements 3.2, 3.4, 3.6, 3.7, 3.9**
    - Untuk setiap state `'idle'`, `'running'`, `'done'`, verifikasi kondisi enabled/disabled tombol mematuhi spec state machine
    - Verifikasi: di state `done` dengan `remainingMs = 0`, Start tetap disabled
    - Tag komentar: `// Feature: todo-life-dashboard, Property 5: Invariant state machine tombol timer`

- [ ] 7. Checkpoint — Verifikasi Timer
  - Buka halaman di browser, uji Start/Stop/Reset secara manual
  - Pastikan countdown berjalan dan state tombol berubah dengan benar
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [x] 8. Implementasi `TodoWidget` di `app.js`
  - [x] 8.1 Implementasi `TodoWidget.init()`, load dari storage, dan rendering list
    - Tulis `init(containerEl)` yang membuat DOM: input teks (maxlength=200) dengan label, tombol tambah, dan `<ul>` untuk daftar
    - Panggil `StorageManager.readTodos()` dan simpan ke `_items`; jika storage unavailable tampilkan daftar kosong tanpa crash
    - Panggil `_renderList()` untuk menampilkan semua item yang tersimpan sesuai urutan penyimpanan
    - Pasang event listener pada input (keydown Enter) dan tombol tambah untuk memanggil `_addTodo()`
    - _Requirements: 5.1, 5.5, 5.7_

  - [ ] 8.2 Implementasi `_addTodo()`, validasi, dan persistence
    - Tulis `_addTodo(text)`: trim input, tolak jika kosong/hanya whitespace (tampilkan inline error, pertahankan fokus input)
    - Buat `Todo_Item` baru: `{ id: crypto.randomUUID(), title: trimmedText, completed: false }`
    - Tambahkan ke `_items`, panggil `_renderList()`, kosongkan input
    - Panggil `_persist()`: jika `writeTodos` return `{ ok: false }`, tampilkan error via `UIHelpers.showStorageError()` tapi item tetap di `_items`
    - _Requirements: 5.2, 5.3, 5.4, 5.6_

  - [x] 8.3 Implementasi `_renderItem()` dan action handlers (toggle, delete)
    - Tulis `_renderItem(item)` yang membuat `<li>` berisi: `<input type="checkbox">` dengan label terhubung, `<span>` teks tugas (strikethrough jika completed), tombol edit, tombol hapus
    - Tulis `_toggleTodo(id)`: flip `item.completed`, perbarui styling, panggil `_persist()`, tampilkan error jika gagal
    - Tulis `_deleteTodo(id)`: hapus item dari `_items`, re-render list, panggil `_persist()`, tampilkan error jika gagal
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 8.4 Implementasi mode edit inline (`_enterEditMode`, `_exitEditMode`)
    - Tulis `_enterEditMode(id)`: ganti `<span>` teks dengan `<input>` edit (maxlength tidak dibatasi di HTML, validasi di JS), isi dengan teks saat ini, pindahkan fokus ke input
    - Tulis `_exitEditMode(id, save)`:
      - Jika `save = true`: validasi teks baru (tolak jika kosong setelah trim; tolak jika >500 karakter, tampilkan inline error); jika valid, perbarui `item.title`, panggil `_persist()`
      - Jika `save = false` (Escape): kembalikan teks ke nilai sebelum edit tanpa perubahan
    - Pasang listener keydown: Enter → `_exitEditMode(id, true)`, Escape → `_exitEditMode(id, false)`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 8.5 Tambahkan style CSS untuk TodoWidget
    - Tulis styles untuk `#todo-widget`: input + tombol tambah di atas, list item dengan checkbox, teks, tombol edit, tombol hapus
    - Style untuk teks strikethrough pada item completed
    - Style untuk mode edit inline (input menggantikan span)
    - Hover/focus/active state pada semua tombol dan checkbox
    - _Requirements: 7.3, 12.3_

  - [ ]* 8.6 Tulis property test untuk Property 6: Penambahan Tugas Memperbesar Daftar
    - **Property 6: Penambahan Tugas Memperbesar Daftar**
    - **Validates: Requirements 5.2**
    - Generate teks tugas valid acak (non-kosong setelah trim, panjang 1–200)
    - Verifikasi: setelah `_addTodo(text)`, `_items.length` bertambah 1, item baru memiliki `completed = false`, input dikosongkan
    - Tag komentar: `// Feature: todo-life-dashboard, Property 6: Penambahan tugas memperbesar daftar`

  - [ ]* 8.7 Tulis property test untuk Property 7: Penolakan Teks Whitespace
    - **Property 7: Penolakan Teks Whitespace**
    - **Validates: Requirements 5.3**
    - Generate string yang seluruhnya terdiri dari spasi, tab, atau newline
    - Verifikasi: `_addTodo(whitespaceStr)` tidak menambah item (`_items.length` tidak berubah)
    - Tag komentar: `// Feature: todo-life-dashboard, Property 7: Penolakan teks whitespace`

  - [ ]* 8.8 Tulis property test untuk Property 9: Escape Mode Edit Mengembalikan Teks Asli
    - **Property 9: Escape Mode Edit Mengembalikan Teks Asli**
    - **Validates: Requirements 6.8**
    - Generate `Todo_Item` dengan teks tertentu dan teks edit yang berbeda
    - Verifikasi: setelah `_enterEditMode(id)` → ubah teks input → `_exitEditMode(id, false)`, `item.title` tetap sama dengan sebelum edit
    - Tag komentar: `// Feature: todo-life-dashboard, Property 9: Escape mode edit mengembalikan teks asli`

  - [ ]* 8.9 Tulis property test untuk Property 10: Validasi Edit Menolak Teks Tidak Valid
    - **Property 10: Validasi Edit Menolak Teks Tidak Valid**
    - **Validates: Requirements 6.3, 6.5, 6.6**
    - Untuk string kosong setelah trim: verifikasi `_exitEditMode(id, true)` ditolak dan `item.title` tidak berubah
    - Untuk string dengan panjang > 500 karakter: verifikasi penolakan yang sama
    - Tag komentar: `// Feature: todo-life-dashboard, Property 10: Validasi edit menolak teks tidak valid`

  - [ ]* 8.10 Tulis property test untuk Property 11: Toggle Penyelesaian adalah Round-Trip
    - **Property 11: Toggle Penyelesaian adalah Round-Trip**
    - **Validates: Requirements 7.3, 7.4**
    - Generate `Todo_Item` dengan `completed` awal acak (true/false)
    - Verifikasi: satu kali `_toggleTodo(id)` membalik `completed`; dua kali toggle mengembalikan ke nilai semula
    - Tag komentar: `// Feature: todo-life-dashboard, Property 11: Toggle penyelesaian adalah round-trip`

  - [ ]* 8.11 Tulis property test untuk Property 12: Hapus Todo Menghapus Tepat Satu Item
    - **Property 12: Hapus Todo Menghapus Tepat Satu Item**
    - **Validates: Requirements 7.7**
    - Generate `Todo_Item[]` dengan panjang n ≥ 1, pilih id acak dari daftar
    - Verifikasi: setelah `_deleteTodo(id)`, `_items.length` = n - 1, tidak ada item dengan id tersebut, semua item lain tetap ada dan tidak berubah
    - Tag komentar: `// Feature: todo-life-dashboard, Property 12: Hapus todo menghapus tepat satu item`

- [ ] 9. Checkpoint — Verifikasi TodoWidget
  - Uji tambah, edit, toggle, hapus secara manual di browser
  - Reload halaman dan verifikasi data tersimpan di LocalStorage
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [x] 10. Implementasi `QuickLinksWidget` di `app.js`
  - [ ] 10.1 Implementasi `QuickLinksWidget.init()`, load dari storage, dan rendering links
    - Tulis `init(containerEl)` yang membuat DOM: input label (maxlength=50), input URL (maxlength=2048), tombol tambah, dan container grid/list untuk link cards
    - Panggil `StorageManager.readLinks()` dan simpan ke `_items`; jika storage unavailable tampilkan pesan error dan daftar kosong
    - Panggil `_renderLinks()` untuk menampilkan semua link tersimpan dalam waktu <2 detik
    - _Requirements: 8.1, 8.6, 8.7_

  - [x] 10.2 Implementasi `_addLink()` dengan validasi lengkap
    - Tulis `_addLink(label, url)`:
      - Trim label dan url
      - Tolak jika label kosong: tampilkan inline error pada field label
      - Tolak jika url kosong: tampilkan inline error pada field url
      - Tolak jika url tidak diawali `http://` atau `https://` (case-insensitive via `_validateUrl`): tampilkan inline error
      - Tolak jika `_items.length >= 20`: tampilkan pesan batas maksimum
      - Jika valid: buat `Link_Item` baru `{ id: crypto.randomUUID(), label, url }`, tambahkan ke `_items`, panggil `_renderLinks()`, kosongkan form input
    - Panggil `_persist()` dan tampilkan error jika gagal
    - Tulis `_validateUrl(url)`: return `true` jika url diawali `http://` atau `https://` (case-insensitive), `false` jika tidak
    - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.8_

  - [x] 10.3 Implementasi `_renderLinkItem()`, klik link, dan hapus link
    - Tulis `_renderLinkItem(item)` yang membuat kartu/tombol: label yang dapat diklik, URL kecil, tombol hapus
    - Pasang event listener klik pada kartu/label: `window.open(item.url, '_blank', 'noopener,noreferrer')`
    - Tulis `_deleteLink(id)`: hapus dari `_items`, re-render, panggil `_persist()`, tampilkan error jika gagal
    - Jika `_items` kosong setelah delete, tampilkan pesan kosong sebagai placeholder
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 10.4 Tambahkan style CSS untuk QuickLinksWidget
    - Tulis styles untuk `#quicklinks-widget`: grid kartu link, hover state yang jelas pada kartu, tombol hapus
    - Tambahkan styles untuk pesan kosong (empty state)
    - Tambahkan hover/focus/active state pada kartu dan tombol (perubahan visual dalam <100ms)
    - _Requirements: 12.3_

  - [ ]* 10.5 Tulis property test untuk Property 14: Validasi URL Menolak Skema Tidak Valid
    - **Property 14: Validasi URL Menolak Skema Tidak Valid**
    - **Validates: Requirements 8.4**
    - Generate URL acak yang tidak diawali `http://` atau `https://` (contoh: `ftp://`, `//`, teks bebas)
    - Verifikasi `_validateUrl(url)` mengembalikan `false` untuk semua URL tersebut
    - Verifikasi URL yang valid (`http://...`, `https://...`) mengembalikan `true`
    - Tag komentar: `// Feature: todo-life-dashboard, Property 14: Validasi URL menolak skema tidak valid`

  - [ ]* 10.6 Tulis property test untuk Property 15: Validasi Link Menolak Field Kosong
    - **Property 15: Validasi Link Menolak Field Kosong**
    - **Validates: Requirements 8.3**
    - Generate kombinasi (label kosong, url valid), (label valid, url kosong), (keduanya kosong)
    - Verifikasi: `_addLink()` ditolak dan `_items.length` tidak berubah
    - Tag komentar: `// Feature: todo-life-dashboard, Property 15: Validasi link menolak field kosong`

  - [ ]* 10.7 Tulis property test untuk Property 16: Invariant Maksimum 20 Link
    - **Property 16: Invariant Maksimum 20 Link**
    - **Validates: Requirements 8.8**
    - Isi `_items` dengan tepat 20 item valid, lalu coba tambahkan satu lagi
    - Verifikasi: penambahan ditolak, `_items.length` tetap 20
    - Tag komentar: `// Feature: todo-life-dashboard, Property 16: Invariant maksimum 20 link`

  - [ ]* 10.8 Tulis property test untuk Property 17: Hapus Link Menghapus Tepat Satu Item
    - **Property 17: Hapus Link Menghapus Tepat Satu Item**
    - **Validates: Requirements 9.3**
    - Generate `Link_Item[]` dengan panjang n ≥ 1, pilih id acak dari daftar
    - Verifikasi: setelah `_deleteLink(id)`, `_items.length` = n - 1, tidak ada item dengan id tersebut, semua item lain tidak berubah
    - Tag komentar: `// Feature: todo-life-dashboard, Property 17: Hapus link menghapus tepat satu item`

- [ ] 11. Checkpoint — Verifikasi QuickLinksWidget
  - Uji tambah link valid dan invalid, hapus link, klik untuk buka tab baru secara manual
  - Verifikasi data persisten setelah reload halaman
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan

- [x] 12. Integrasi akhir, polish aksesibilitas, dan responsivitas
  - [x] 12.1 Verifikasi dan lengkapi struktur aksesibilitas di `index.html` dan `app.js`
    - Pastikan semua `<button>` memiliki teks atau `aria-label` yang deskriptif
    - Pastikan semua `<input>` memiliki `<label>` terhubung via `for`/`id` atau `aria-label`
    - Pastikan `#notification-modal` memiliki `role="dialog"`, `aria-modal="true"`, dan focus di-trap ke dalam modal saat ditampilkan
    - Pastikan `#storage-banner` menggunakan `role="alert"` agar screen reader mengumumkannya
    - Pastikan setiap `<section>` widget memiliki `<h2>` yang deskriptif
    - _Requirements: 11.4, 12.1_

  - [x] 12.2 Verifikasi layout responsif dan pemisah visual di `style.css`
    - Verifikasi grid desktop (≥1024px): empat widget dalam 2×2, tidak ada overlap, tidak ada horizontal scroll
    - Verifikasi grid tablet (768px–1023px): empat widget dalam satu kolom, tidak ada horizontal scroll
    - Verifikasi semua pemisah visual antar widget (border, perbedaan background, atau gap ≥8px)
    - Tambahkan atau perbaiki media query jika diperlukan
    - _Requirements: 12.2, 12.4_

  - [~] 12.3 Audit console dan pastikan tidak ada error saat halaman dimuat
    - Buka `index.html` di browser modern (Chrome/Firefox/Edge)
    - Verifikasi tidak ada error "file not found", "undefined reference", atau TypeError di console
    - Pastikan semua path CSS dan JS menggunakan path relatif
    - _Requirements: 11.3, 11.4, 11.5_

- [ ] 13. Checkpoint akhir — Semua tests pass, verifikasi final
  - Jalankan semua property tests dan pastikan semua pass (minimal 100 iterasi per property)
  - Lakukan pengujian manual end-to-end di browser: semua empat widget berfungsi, data persisten
  - Tanyakan kepada user jika ada pertanyaan sebelum dianggap selesai

---

## Notes

- Tasks bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap task mereferensikan requirements spesifik untuk keterlacakan
- Property tests menggunakan `fast-check` via CDN — hanya di test environment, tidak di-bundle ke production
- `crypto.randomUUID()` digunakan untuk generate id; jika tidak tersedia (browser sangat lama), gunakan fallback: `Date.now().toString(36) + Math.random().toString(36).slice(2)`
- Semua operasi LocalStorage dibungkus `try/catch` — kegagalan tidak menyebabkan crash
- Timer menggunakan timestamp absolut (`Date.now()`) bukan counter dekremental untuk menghindari drift

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.5", "4.6"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2"] },
    { "id": 8, "tasks": ["6.3", "6.4", "6.5", "6.6"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2"] },
    { "id": 11, "tasks": ["8.3"] },
    { "id": 12, "tasks": ["8.4"] },
    { "id": 13, "tasks": ["8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11"] },
    { "id": 14, "tasks": ["10.1"] },
    { "id": 15, "tasks": ["10.2"] },
    { "id": 16, "tasks": ["10.3"] },
    { "id": 17, "tasks": ["10.4", "10.5", "10.6", "10.7", "10.8"] },
    { "id": 18, "tasks": ["12.1", "12.2", "12.3"] }
  ]
}
```
