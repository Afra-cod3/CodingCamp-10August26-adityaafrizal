# Design Document — To-Do List Life Dashboard

## Overview

To-Do List Life Dashboard adalah aplikasi single-page berbasis browser yang menyatukan empat widget produktivitas dalam satu tampilan: sapaan berbasis waktu, focus timer bergaya Pomodoro, daftar tugas, dan quick links. Aplikasi dibangun sepenuhnya dengan HTML, CSS, dan Vanilla JavaScript — tanpa framework frontend, tanpa build step, dan tanpa server backend. Semua state persisten disimpan di Browser Local Storage.

Pendekatan desain mengutamakan:

- **Zero-dependency** — tidak ada library eksternal, tidak ada CDN runtime. Aplikasi dapat dijalankan langsung dengan membuka file HTML di browser modern.
- **Single-file JS** — seluruh logika aplikasi berada di `js/app.js`, diorganisasi dengan Module Pattern (IIFE) agar tidak mencemari global scope.
- **Graceful degradation** — setiap operasi LocalStorage dibungkus `try/catch`; kegagalan penyimpanan ditampilkan sebagai pesan peringatan tanpa menyebabkan crash.
- **Drift-corrected timer** — hitungan mundur menggunakan timestamp absolut (`Date.now()`) bukan counter dekremental, sehingga display tetap akurat meski `setInterval` terlambat.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 Dashboard Layout                  │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐  │   │
│  │  │  Greeting_Widget │  │    Timer_Widget       │  │   │
│  │  └──────────────────┘  └──────────────────────┘  │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐  │   │
│  │  │   Todo_Widget    │  │  QuickLinks_Widget    │  │   │
│  │  └──────────────────┘  └──────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ loads
                ┌────────▼────────┐
                │   js/app.js     │
                │  (IIFE Modules) │
                └────────┬────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│StorageManager│  │  EventBus    │  │  UIHelpers   │
└──────┬───────┘  └──────┬───────┘  └──────────────┘
       │                 │
       ▼                 ▼
┌─────────────────────────────────┐
│       Browser Local Storage     │
└─────────────────────────────────┘
```

### Module Dependency Graph

```
app.js
 ├── StorageManager       ← baca/tulis LocalStorage (todos, links)
 ├── EventBus             ← pub/sub sederhana antar modul
 ├── UIHelpers            ← utilitas DOM (createElement, sanitize)
 ├── GreetingWidget       ← depends on: EventBus, UIHelpers
 ├── TimerWidget          ← depends on: EventBus, UIHelpers
 ├── TodoWidget           ← depends on: StorageManager, EventBus, UIHelpers
 └── QuickLinksWidget     ← depends on: StorageManager, EventBus, UIHelpers
```

Tidak ada dependency antar widget — mereka hanya berkomunikasi melalui `EventBus`. Ini memastikan setiap widget dapat diuji secara terisolasi.

### File Structure

```
project-root/
├── index.html          ← entry point tunggal
├── css/
│   └── style.css       ← satu-satunya file CSS
└── js/
    └── app.js          ← satu-satunya file JavaScript
```

---

## Components and Interfaces

### StorageManager

Modul ini adalah satu-satunya komponen yang berinteraksi dengan `window.localStorage`. Semua operasi dibungkus `try/catch`.

```javascript
// Public Interface
StorageManager = {
  readTodos()   → Todo_Item[]   // returns [] on error/missing
  writeTodos(items: Todo_Item[]) → { ok: boolean, error?: string }
  readLinks()   → Link_Item[]   // returns [] on error/missing
  writeLinks(items: Link_Item[]) → { ok: boolean, error?: string }
}

// Internal constants
KEYS = {
  TODOS: 'tld_todos_v1',
  LINKS: 'tld_links_v1'
}
```

**Pola baca:**
1. `localStorage.getItem(key)` di dalam `try/catch`
2. Jika `null` → kembalikan `[]`
3. `JSON.parse(raw)` di dalam `try/catch` terpisah
4. Validasi bahwa hasilnya adalah array; jika tidak → kembalikan `[]` dan log warning
5. Kembalikan array yang tervalidasi

**Pola tulis:**
1. `JSON.stringify(items)` lalu `localStorage.setItem(key, json)` di dalam `try/catch`
2. Jika berhasil → kembalikan `{ ok: true }`
3. Jika `DOMException` (QuotaExceededError, SecurityError) → kembalikan `{ ok: false, error: e.message }`
4. Caller menampilkan pesan error kepada pengguna

### EventBus

Pub/sub ringan untuk decoupling antar widget.

```javascript
EventBus = {
  on(event: string, handler: Function) → void
  off(event: string, handler: Function) → void
  emit(event: string, data?: any) → void
}

// Events yang digunakan
Events = {
  TIMER_COMPLETE:    'timer:complete'
  NOTIFICATION_ACK:  'notification:ack'
  STORAGE_ERROR:     'storage:error'   // payload: { message: string }
}
```

### UIHelpers

```javascript
UIHelpers = {
  createElement(tag, attrs, ...children) → HTMLElement
  sanitizeText(str: string) → string   // escapes HTML entities
  showNotification(message: string) → void
  dismissNotification() → void
  showStorageError(message: string) → void
}
```

### GreetingWidget

Bertanggung jawab menampilkan waktu, tanggal, dan sapaan. Berjalan dengan satu `setInterval` 1000ms (untuk memperbarui detik secara internal) tetapi hanya memperbarui DOM untuk menit dan sapaan saat nilai berubah, untuk efisiensi.

```javascript
GreetingWidget = {
  init(containerEl: HTMLElement) → void
  // Internal
  _tick() → void           // dipanggil tiap 1 detik via setInterval
  _getGreeting(hour) → string
  _formatTime(date) → string    // HH:MM
  _formatDate(date) → string    // e.g. "Kamis, 14 Agustus 2026"
  _LOCALE_DAYS: string[]        // nama hari dalam Bahasa Indonesia
  _LOCALE_MONTHS: string[]      // nama bulan dalam Bahasa Indonesia
}
```

**Pemetaan sapaan:**

| Rentang Jam | Teks Sapaan    |
|-------------|----------------|
| 05:00–11:59 | Selamat Pagi   |
| 12:00–14:59 | Selamat Siang  |
| 15:00–17:59 | Selamat Sore   |
| 18:00–04:59 | Selamat Malam  |
| Error/invalid | Halo         |

### TimerWidget

Menggunakan teknik **timestamp-based countdown** untuk menghindari drift:

- Saat Start ditekan: simpan `endTime = Date.now() + remainingMs`
- Setiap tick `setInterval(1000)`: hitung `remaining = endTime - Date.now()`; jika `remaining <= 0` → selesai; tampilkan `Math.max(0, remaining)`
- Ini memastikan selisih display tidak pernah melebihi satu interval (≤100ms dari requirement 3.3)

```javascript
TimerWidget = {
  init(containerEl: HTMLElement) → void
  // Internal state
  _state: 'idle' | 'running' | 'paused' | 'done'
  _endTime: number | null       // timestamp ms kapan timer berakhir
  _remainingMs: number          // ms sisa saat di-pause
  _intervalId: number | null
  // Methods
  _start() → void
  _stop() → void
  _reset() → void
  _tick() → void
  _formatDisplay(ms: number) → string   // "MM:SS"
  _onComplete() → void                  // emit TIMER_COMPLETE, show visual
  _updateButtons() → void
}
```

**State machine tombol:**

```
idle/paused:  Start=enabled, Stop=disabled, Reset=enabled
running:      Start=disabled, Stop=enabled, Reset=enabled
done:         Start=disabled, Stop=disabled, Reset=enabled
```

### TodoWidget

```javascript
TodoWidget = {
  init(containerEl: HTMLElement) → void
  // Internal
  _items: Todo_Item[]
  _addTodo(text: string) → void
  _editTodo(id: string, newText: string) → { ok: boolean, error?: string }
  _toggleTodo(id: string) → void
  _deleteTodo(id: string) → void
  _renderList() → void
  _renderItem(item: Todo_Item) → HTMLElement
  _enterEditMode(id: string) → void
  _exitEditMode(id: string, save: boolean) → void
  _persist() → void
}
```

### QuickLinksWidget

```javascript
QuickLinksWidget = {
  init(containerEl: HTMLElement) → void
  // Internal
  _items: Link_Item[]
  _addLink(label: string, url: string) → { ok: boolean, error?: string }
  _deleteLink(id: string) → void
  _renderLinks() → void
  _renderLinkItem(item: Link_Item) → HTMLElement
  _validateUrl(url: string) → boolean   // cek http:// atau https://
  _persist() → void
}
```

---

## Data Models

### Todo_Item

```javascript
/**
 * @typedef {Object} Todo_Item
 * @property {string} id         - UUID v4 yang di-generate saat pembuatan (crypto.randomUUID() atau fallback)
 * @property {string} title      - Teks tugas, 1–200 karakter (input baru) atau 1–500 karakter (edit)
 * @property {boolean} completed - Status selesai; false = belum selesai, true = selesai
 */

// Contoh instance:
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Membaca buku desain sistem",
  "completed": false
}
```

**Constraint validasi:**
- `id`: string non-kosong, unik di dalam daftar
- `title` (tambah): panjang 1–200 karakter setelah trim; penolakan jika hanya whitespace
- `title` (edit): panjang 1–500 karakter setelah trim; penolakan jika kosong atau >500 karakter
- `completed`: boolean strict

**LocalStorage key:** `tld_todos_v1`

**Format simpan:** `JSON.stringify(Todo_Item[])`

### Link_Item

```javascript
/**
 * @typedef {Object} Link_Item
 * @property {string} id    - UUID v4
 * @property {string} label - Nama tampilan tautan, 1–50 karakter
 * @property {string} url   - URL lengkap, 1–2048 karakter, harus diawali http:// atau https://
 */

// Contoh instance:
{
  "id": "f1e2d3c4-b5a6-7890-fedc-ba9876543210",
  "label": "GitHub",
  "url": "https://github.com"
}
```

**Constraint validasi:**
- `label`: panjang 1–50 karakter setelah trim; tidak boleh kosong
- `url`: panjang 1–2048 karakter; harus diawali `http://` atau `https://` (case-insensitive)
- Maksimum 20 item dalam daftar (cek sebelum menambah)

**LocalStorage key:** `tld_links_v1`

**Format simpan:** `JSON.stringify(Link_Item[])`

### LocalStorage Schema

```
LocalStorage
├── "tld_todos_v1"  → JSON string of Todo_Item[]
└── "tld_links_v1"  → JSON string of Link_Item[]
```

Penggunaan prefix `tld_` dan suffix `_v1` untuk:
1. Menghindari collision dengan key dari aplikasi lain di domain yang sama
2. Memungkinkan migrasi data di versi mendatang tanpa konflik

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

<!-- PREWORK ANALYSIS -->
<!-- 
Acceptance Criteria Testing Prework:

Requirement 1: Tampilan Waktu dan Tanggal Real-Time
1.1 THE Greeting_Widget SHALL menampilkan waktu dalam format HH:MM
  Thoughts: Ini adalah aturan tentang semua nilai waktu yang mungkin. Kita bisa generate jam dan menit acak, panggil _formatTime, dan verifikasi hasilnya cocok regex /^\d{2}:\d{2}$/
  Classification: PROPERTY
  Test Strategy: For any Date object, _formatTime should return a string matching HH:MM format

1.2 THE Greeting_Widget SHALL menampilkan tanggal dalam format nama hari, DD MMMM YYYY Bahasa Indonesia
  Thoughts: Ini aturan tentang semua tanggal. Kita bisa generate tanggal acak, panggil _formatDate, dan verifikasi hasilnya mengandung nama hari Indonesia, angka, dan nama bulan Indonesia
  Classification: PROPERTY
  Test Strategy: For any valid Date, _formatDate should return string with Indonesian day name, day number, Indonesian month name, and year

1.3 WHEN halaman pertama kali dimuat, tampilkan waktu dan tanggal akurat
  Thoughts: Ini adalah test timing saat startup - apakah nilai yang ditampilkan cocok dengan Date.now() pada saat itu. Ini adalah contoh spesifik (smoke test), bukan sesuatu yang bervariasi secara berarti dengan input.
  Classification: SMOKE
  Test Strategy: Single test to verify widget displays current time on init

1.4 IF jam sistem tidak valid, tampilkan fallback "--:--" dan "--"
  Thoughts: Ini adalah test error handling untuk input invalid. Kita bisa menginjeksi invalid Date dan verifikasi fallback ditampilkan.
  Classification: EDGE_CASE
  Test Strategy: Test with invalid Date input, verify fallback values

Requirement 2: Sapaan Berdasarkan Waktu
2.1 WHEN jam 05:00–11:59, tampilkan "Selamat Pagi"
2.2 WHEN jam 12:00–14:59, tampilkan "Selamat Siang"
2.3 WHEN jam 15:00–17:59, tampilkan "Selamat Sore"
2.4 WHEN jam 18:00–04:59, tampilkan "Selamat Malam"
  Thoughts: Ini semua adalah aturan tentang semua jam (0-23). Kita bisa test _getGreeting dengan semua nilai jam 0-23 dan verifikasi mapping-nya konsisten. Ini bisa digabung menjadi satu property: fungsi sapaan memetakan setiap jam ke tepat satu greeting yang valid.
  Classification: PROPERTY
  Test Strategy: For any hour value 0-23, _getGreeting returns exactly one of the four valid greetings, with correct mapping per range

2.5 Sapaan diperbarui otomatis ketika waktu berganti rentang
  Thoughts: Ini adalah test timing/behavior yang tergantung pada wall clock. Bukan sesuatu yang kita bisa test secara property-based dengan mudah.
  Classification: INTEGRATION
  Test Strategy: Integration test with mocked time advancing past boundary

2.6 IF jam tidak valid, tampilkan "Halo"
  Thoughts: Edge case untuk input invalid.
  Classification: EDGE_CASE
  Test Strategy: Test with invalid/undefined hour, verify returns "Halo"

Requirement 3: Focus Timer — Kontrol Sesi
3.1 Tampilan hitungan mundur dalam format MM:SS
  Thoughts: Ini aturan tentang semua nilai waktu sisa (0–5999 detik). Kita bisa generate durasi acak dan verifikasi format output.
  Classification: PROPERTY
  Test Strategy: For any remaining time in valid range (0-5999 seconds), _formatDisplay returns string matching MM:SS format

3.2 Start memulai hitungan mundur dari waktu yang ditampilkan
  Thoughts: Ini test behavior state machine. Bisa digabung dengan test state machine lainnya.
  Classification: EXAMPLE
  Test Strategy: Example-based test: verify state transitions

3.3 Timer memperbarui display setiap detik dengan selisih ≤100ms
  Thoughts: Ini adalah timing accuracy requirement. Tidak bisa ditest dengan PBT tanpa mocking.
  Classification: INTEGRATION
  Test Strategy: Integration test with mocked setInterval

3.4–3.9 Stop, Reset, button disable states, completion, dan prevent start at 00:00
  Thoughts: Ini adalah aturan state machine yang bisa diuji sebagai properties. State machine transition yang sama berlaku untuk semua state: tombol Start hanya aktif saat idle/paused, Stop hanya saat running, dsb.
  Classification: PROPERTY (state machine invariants)
  Test Strategy: For any timer state, button enabled states must match the state machine spec

Requirement 4: Focus Timer — Notifikasi Selesai
4.1–4.4 Timer auto-stop, visual notification, dismiss resets to 25:00, fallback indicator
  Thoughts: Ini adalah test behavior spesifik saat mencapai 00:00. Notifikasi dan state reset adalah deterministik.
  Classification: EXAMPLE
  Test Strategy: Example-based: trigger completion, verify notification shown and state reset on dismiss

Requirement 5: Penambahan dan Penyimpanan Tugas
5.1 Input dengan max 200 karakter dan tombol tambah
  Thoughts: UI structure test.
  Classification: SMOKE
  Test Strategy: Verify DOM has input with maxlength=200 and add button

5.2 WHEN menambah tugas, tambahkan ke daftar dan kosongkan input
  Thoughts: Ini aturan yang berlaku untuk semua teks tugas yang valid. Kita bisa generate teks acak dan verifikasi daftar bertambah dan input dikosongkan.
  Classification: PROPERTY
  Test Strategy: For any valid task text, adding it increases list length by 1 and clears input

5.3 IF input kosong/spasi, tolak penambahan
  Thoughts: Ini aturan yang berlaku untuk semua string yang hanya mengandung whitespace.
  Classification: PROPERTY
  Test Strategy: For any string composed entirely of whitespace, addition should be rejected and list unchanged

5.4 WHEN tugas ditambahkan, simpan ke LocalStorage dalam <500ms
  Thoughts: Ini timing requirement untuk persistence. Bagian penting adalah bahwa penyimpanan terjadi — timing diverifikasi lewat integration test.
  Classification: INTEGRATION
  Test Strategy: Verify write is called on add; timing via integration test

5.5 WHEN halaman dimuat, tampilkan tugas tersimpan sesuai urutan
  Thoughts: Ini adalah round-trip property untuk storage. Simpan daftar, muat ulang, urutan harus sama.
  Classification: PROPERTY
  Test Strategy: For any list of todo items, writing then reading preserves order and content

5.6 IF LocalStorage gagal saat menambah, tampilkan error dan tetap tampilkan item
  Thoughts: Error handling edge case.
  Classification: EDGE_CASE
  Test Strategy: Mock localStorage write failure, verify error shown and item visible in session

5.7 IF LocalStorage tidak tersedia, tampilkan daftar kosong tanpa crash
  Thoughts: Error handling edge case.
  Classification: EDGE_CASE
  Test Strategy: Mock localStorage unavailable, verify empty list and no crash

Requirement 6: Pengeditan Tugas
6.1 Tombol edit pada setiap Todo_Item
  Thoughts: UI structure test.
  Classification: SMOKE

6.2 Mode edit mengubah tampilan ke input dengan teks saat ini
  Thoughts: Example-based behavior test.
  Classification: EXAMPLE

6.3 Batas 500 karakter pada input edit
  Thoughts: Ini adalah aturan validasi yang berlaku untuk semua teks edit yang melebihi batas.
  Classification: PROPERTY
  Test Strategy: For any text exceeding 500 chars, edit save should be rejected

6.4 Save edit dengan Enter/konfirmasi, perbarui teks
  Thoughts: State machine transition.
  Classification: EXAMPLE

6.5 IF teks edit kosong, tolak perubahan
  Thoughts: Ini aturan untuk semua string kosong.
  Classification: PROPERTY
  Test Strategy: For empty or whitespace-only strings, edit save should be rejected

6.6 IF teks edit >500 karakter, tampilkan error dan jangan simpan
  Thoughts: Digabung dengan 6.3.

6.7 WHEN teks berhasil diperbarui, simpan ke LocalStorage
  Thoughts: Persistence behavior — mirip dengan round-trip storage.
  Classification: INTEGRATION

6.8 Escape membatalkan edit dan mengembalikan teks lama
  Thoughts: Ini adalah round-trip property: masuk mode edit → edit teks → tekan Escape → teks harus sama dengan sebelum edit. Berlaku untuk semua todo item dan semua teks.
  Classification: PROPERTY
  Test Strategy: For any todo item and any edited text, pressing Escape restores original text

Requirement 7: Penyelesaian dan Penghapusan Tugas
7.1 Checkbox pada setiap Todo_Item
  Thoughts: UI structure.
  Classification: SMOKE

7.2 Tombol hapus pada setiap Todo_Item
  Thoughts: UI structure.
  Classification: SMOKE

7.3 WHEN centang, ubah status ke selesai dan tambahkan strikethrough
  Thoughts: Ini aturan yang berlaku untuk semua todo item.
  Classification: PROPERTY
  Test Strategy: For any todo item, toggling completed state should flip boolean and apply/remove visual styling

7.4 WHEN hilangkan centang, ubah status ke belum selesai dan hapus strikethrough
  Thoughts: Ini round-trip: toggle → toggle kembali = state awal. Dapat digabung dengan 7.3.
  Classification: PROPERTY (combined with 7.3)

7.5 WHEN status berubah, simpan ke LocalStorage dalam <500ms
  Thoughts: Persistence timing.
  Classification: INTEGRATION

7.6 IF penyimpanan gagal saat toggle, tampilkan error
  Thoughts: Error handling edge case.
  Classification: EDGE_CASE

7.7 WHEN hapus Todo_Item, hapus dari daftar tanpa reload
  Thoughts: Ini aturan untuk semua todo item.
  Classification: PROPERTY
  Test Strategy: For any todo item in the list, deleting it should remove exactly that item and no others

7.8 WHEN dihapus, simpan ke LocalStorage dalam <500ms
  Thoughts: Persistence.
  Classification: INTEGRATION

7.9 IF penyimpanan gagal saat hapus, tampilkan error
  Thoughts: Edge case.
  Classification: EDGE_CASE

Requirement 8: Penambahan Quick Links
8.1 Input label (max 50) dan URL (max 2048)
  Thoughts: UI structure.
  Classification: SMOKE

8.2 WHEN tambah link valid, buat Link_Item baru
  Thoughts: Berlaku untuk semua kombinasi label/URL yang valid.
  Classification: PROPERTY
  Test Strategy: For any valid label and URL, adding creates a Link_Item visible in the list

8.3 IF label/URL kosong, tolak penambahan
  Thoughts: Aturan yang berlaku untuk semua input dengan label atau URL kosong.
  Classification: PROPERTY
  Test Strategy: For any combination where label or URL is empty, addition is rejected

8.4 IF URL tidak diawali http:// atau https://, tolak
  Thoughts: Ini adalah aturan validasi URL yang berlaku untuk semua URL yang tidak valid.
  Classification: PROPERTY
  Test Strategy: For any URL not starting with http:// or https://, addition is rejected

8.5 WHEN link ditambahkan, simpan ke LocalStorage dalam <1 detik
  Thoughts: Persistence timing.
  Classification: INTEGRATION

8.6 WHEN halaman dimuat, tampilkan link tersimpan dalam <2 detik
  Thoughts: Load behavior — round-trip storage.
  Classification: PROPERTY (combined with round-trip)

8.7 IF LocalStorage tidak tersedia saat load, tampilkan error
  Thoughts: Error handling.
  Classification: EDGE_CASE

8.8 IF jumlah link sudah 20, tolak penambahan baru
  Thoughts: Ini adalah invariant: daftar link tidak boleh pernah memiliki lebih dari 20 item.
  Classification: PROPERTY
  Test Strategy: For any link list at capacity (20 items), attempting to add more is rejected

Requirement 9: Penggunaan dan Penghapusan Quick Links
9.1 WHEN klik Link_Item, buka di tab baru
  Thoughts: UI behavior.
  Classification: EXAMPLE

9.2 Kontrol hapus pada setiap Link_Item
  Thoughts: UI structure.
  Classification: SMOKE

9.3 WHEN hapus link, hilangkan dari tampilan dalam <500ms
  Thoughts: Aturan yang berlaku untuk semua link.
  Classification: PROPERTY
  Test Strategy: For any link in the list, deleting it removes exactly that item

9.4 WHEN dihapus, simpan ke LocalStorage
  Thoughts: Persistence.
  Classification: INTEGRATION

9.5 IF penyimpanan gagal, tampilkan error
  Thoughts: Error handling.
  Classification: EDGE_CASE

9.6 IF daftar kosong setelah hapus, tampilkan pesan kosong
  Thoughts: Edge case.
  Classification: EDGE_CASE

Requirement 10: Persistensi Data dan Ketahanan Storage
10.1 Gunakan kunci unik per jenis data
  Thoughts: Configuration/design constraint.
  Classification: SMOKE

10.2 IF kunci tidak ditemukan, kembalikan daftar kosong
  Thoughts: Edge case untuk missing data.
  Classification: EDGE_CASE

10.3 IF error baca/tulis, tetap beroperasi dan tampilkan peringatan
  Thoughts: Error handling.
  Classification: EDGE_CASE

10.4 Simpan dalam format JSON valid dengan field yang diperlukan
  Thoughts: Ini adalah invariant tentang format data. Kita bisa generate random items dan verifikasi JSON yang dihasilkan mengandung semua required fields.
  Classification: PROPERTY
  Test Strategy: For any list of items, the serialized form is valid JSON containing all required fields

10.5 Round-trip property untuk operasi tulis
  Thoughts: Ini secara eksplisit disebutkan di requirements sebagai round-trip property! Tulis data, baca kembali, harus ekuivalen.
  Classification: PROPERTY (explicitly stated in requirements)
  Test Strategy: For any array of valid items, write then read should produce equivalent array

10.6 IF data JSON tidak valid, abaikan dan kembalikan daftar kosong
  Thoughts: Error handling untuk corrupted data.
  Classification: EDGE_CASE

10.7 Operasi tulis selesai dalam <200ms untuk hingga 500 item
  Thoughts: Performance requirement.
  Classification: INTEGRATION

Requirement 11: Struktur File dan Kode
11.1–11.5 File structure, no console errors, relative paths
  Thoughts: Semua ini adalah structural/configuration tests.
  Classification: SMOKE

Requirement 12: Tampilan dan Responsivitas
12.1–12.4 All widgets visible, responsive layout, visual feedback, visual separators
  Thoughts: UI layout dan visual tests — tidak cocok untuk PBT.
  Classification: SMOKE / INTEGRATION

--- PROPERTY REFLECTION ---

Setelah mereview semua properties yang teridentifikasi, berikut adalah consolidasi:

Properties yang dapat digabung:
- 7.3 (toggle ke selesai) + 7.4 (toggle kembali) → gabungkan menjadi satu property "toggle is idempotent round-trip"
- 6.3 (reject >500 chars) + 6.5 (reject empty) → gabungkan menjadi satu property "edit validation rejects invalid text"
- 8.3 (reject empty) + 8.4 (reject invalid URL) → gabungkan menjadi satu property "link validation rejects invalid inputs"

Properties final setelah consolidation:
1. Greeting time format (1.1)
2. Greeting date format (1.2)
3. Greeting hour-to-greeting mapping (2.1-2.4)
4. Timer display format (3.1)
5. Timer button state machine (3.4-3.9)
6. Todo: adding valid task grows list + clears input (5.2)
7. Todo: whitespace input rejection (5.3)
8. Todo: storage round-trip — write then read preserves order/content (5.5, 10.5)
9. Todo: edit escape restores original text (6.8)
10. Todo: edit validation rejects invalid text (6.3+6.5)
11. Todo: toggle completion is a round-trip (7.3+7.4)
12. Todo: delete removes exactly one item (7.7)
13. Todo: JSON serialization contains required fields (10.4)
14. Link: URL validation rejects non-http(s) URLs (8.4)
15. Link: empty field validation (8.3)
16. Link: max 20 items invariant (8.8)
17. Link: delete removes exactly one item (9.3)
18. Storage: round-trip for both todos and links (10.5) — digabung dengan property 8
-->

### Property 1: Format Waktu HH:MM

*For any* objek `Date` yang valid, fungsi `_formatTime` harus mengembalikan string yang cocok dengan pola `/^\d{2}:\d{2}$/` — dua digit jam diikuti titik dua dan dua digit menit.

**Validates: Requirements 1.1**

---

### Property 2: Format Tanggal Bahasa Indonesia

*For any* objek `Date` yang valid, fungsi `_formatDate` harus mengembalikan string yang mengandung nama hari dalam Bahasa Indonesia (Senin–Minggu), angka tanggal dua digit, nama bulan dalam Bahasa Indonesia (Januari–Desember), dan angka tahun empat digit.

**Validates: Requirements 1.2**

---

### Property 3: Pemetaan Jam ke Sapaan

*For any* nilai jam dalam rentang 0–23, fungsi `_getGreeting` harus mengembalikan tepat salah satu dari `"Selamat Pagi"`, `"Selamat Siang"`, `"Selamat Sore"`, atau `"Selamat Malam"`, sesuai dengan rentang jam yang terdefinisi (05–11 → Pagi, 12–14 → Siang, 15–17 → Sore, 18–04 → Malam).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 4: Format Display Timer MM:SS

*For any* nilai waktu sisa dalam rentang valid 0–5999 detik, fungsi `_formatDisplay` harus mengembalikan string yang cocok dengan pola `/^\d{2}:\d{2}$/` di mana bagian menit adalah `Math.floor(seconds / 60)` dan bagian detik adalah `seconds % 60`, keduanya di-pad ke dua digit.

**Validates: Requirements 3.1**

---

### Property 5: Invariant State Machine Tombol Timer

*For any* state timer (`idle`, `running`, `done`), kondisi enabled/disabled tombol harus mematuhi invariant: tombol Start aktif jika dan hanya jika state adalah `idle` dan waktu sisa > 0; tombol Stop aktif jika dan hanya jika state adalah `running`; tombol Reset selalu aktif kecuali saat state `running` dan belum diselesaikan.

**Validates: Requirements 3.2, 3.4, 3.6, 3.7, 3.9**

---

### Property 6: Penambahan Tugas Memperbesar Daftar

*For any* daftar tugas dan teks tugas yang valid (non-kosong setelah trim, panjang ≤200 karakter), menambahkan teks tersebut harus menghasilkan daftar yang panjangnya bertambah satu, input dikosongkan, dan item baru memiliki status `completed = false`.

**Validates: Requirements 5.2**

---

### Property 7: Penolakan Teks Whitespace

*For any* string yang seluruhnya terdiri dari karakter whitespace (spasi, tab, newline), mencoba menambahkannya sebagai tugas harus ditolak, daftar tugas tidak berubah, dan input tetap terfokus.

**Validates: Requirements 5.3**

---

### Property 8: Round-Trip Storage Todos dan Links

*For any* array `Todo_Item[]` atau `Link_Item[]` yang valid, memanggil operasi tulis (`writeTodos`/`writeLinks`) kemudian operasi baca (`readTodos`/`readLinks`) harus menghasilkan array yang ekuivalen (sama panjang, setiap elemen memiliki `id`, `title`/`label`, dan status/`url` yang identik, dengan urutan yang dipertahankan).

**Validates: Requirements 5.5, 10.5**

---

### Property 9: Escape Mode Edit Mengembalikan Teks Asli

*For any* `Todo_Item` dengan teks tertentu, masuk ke mode edit, mengetikkan teks yang berbeda, kemudian menekan Escape, harus mengembalikan teks Todo_Item ke nilai sebelum mode edit dimulai — tidak ada perubahan yang tersimpan.

**Validates: Requirements 6.8**

---

### Property 10: Validasi Edit Menolak Teks Tidak Valid

*For any* Todo_Item dalam mode edit, menyimpan dengan teks yang kosong (setelah trim) atau teks yang panjangnya melebihi 500 karakter harus ditolak — mode edit tetap aktif, isi input dipertahankan, dan tidak ada perubahan yang disimpan ke state atau LocalStorage.

**Validates: Requirements 6.3, 6.5, 6.6**

---

### Property 11: Toggle Penyelesaian adalah Round-Trip

*For any* `Todo_Item`, men-toggle status `completed` dua kali harus mengembalikan item ke state semula — `completed` kembali ke nilai awal. Satu kali toggle harus membalik nilai `completed` dari `false` ke `true` atau sebaliknya.

**Validates: Requirements 7.3, 7.4**

---

### Property 12: Hapus Todo Menghapus Tepat Satu Item

*For any* daftar `Todo_Item[]` dengan panjang n ≥ 1, menghapus item dengan id tertentu harus menghasilkan daftar baru dengan panjang n-1 yang tidak mengandung item dengan id tersebut, sementara semua item lain tetap tidak berubah.

**Validates: Requirements 7.7**

---

### Property 13: Serialisasi JSON Mengandung Field yang Diperlukan

*For any* array `Todo_Item[]` yang ditulis ke storage, JSON yang dihasilkan harus dapat di-parse kembali sebagai array di mana setiap elemen mengandung field `id` (string), `title` (string), dan `completed` (boolean). *For any* array `Link_Item[]`, setiap elemen harus mengandung `id` (string), `label` (string), dan `url` (string).

**Validates: Requirements 10.4**

---

### Property 14: Validasi URL Menolak Skema Tidak Valid

*For any* URL yang tidak diawali dengan `http://` atau `https://` (case-insensitive), fungsi `_validateUrl` harus mengembalikan `false` dan penambahan link harus ditolak.

**Validates: Requirements 8.4**

---

### Property 15: Validasi Link Menolak Field Kosong

*For any* kombinasi input di mana label (setelah trim) kosong atau URL (setelah trim) kosong, penambahan Link_Item harus ditolak, daftar tidak berubah, dan pesan kesalahan menunjukkan field yang tidak diisi.

**Validates: Requirements 8.3**

---

### Property 16: Invariant Maksimum 20 Link

*For any* daftar `Link_Item[]` yang sudah berisi tepat 20 item, mencoba menambahkan Link_Item baru harus selalu ditolak — panjang daftar tetap 20.

**Validates: Requirements 8.8**

---

### Property 17: Hapus Link Menghapus Tepat Satu Item

*For any* daftar `Link_Item[]` dengan panjang n ≥ 1, menghapus item dengan id tertentu harus menghasilkan daftar baru dengan panjang n-1 yang tidak mengandung item dengan id tersebut, sementara semua item lain tetap tidak berubah.

**Validates: Requirements 9.3**

---

## Error Handling

### Kategori Error dan Penanganannya

| Kategori | Trigger | Handling | User Feedback |
|---|---|---|---|
| Storage unavailable | `localStorage` tidak ada atau private mode | `try/catch SecurityError`; app beroperasi hanya di-memory | Banner peringatan non-dismissible di atas semua widget |
| Storage quota exceeded | `setItem` lempar `QuotaExceededError` | Kembalikan `{ ok: false }`; data tetap di-memory sesi aktif | Toast error di bawah widget yang memicu |
| Corrupted JSON | `JSON.parse` gagal saat baca | `catch`; kembalikan `[]`; log ke `console.warn` | Tidak ada notifikasi kepada user (silent recovery) |
| Invalid date/time | `new Date()` menghasilkan `Invalid Date` | Cek `isNaN(date.getTime())`; tampilkan fallback | Fallback values (`--:--`, `--`, `Halo`) |
| Timer already done | Start ditekan saat display `00:00` | Tombol Start dinonaktifkan sebelum event handler | Tombol disabled (visual) |
| Todo validation error | Input kosong/hanya whitespace | Tolak; fokus kembali ke input | Inline error message dekat input |
| Link validation error | Label/URL kosong atau URL invalid | Tolak penambahan | Inline error message per field |
| Max links reached | 20 link sudah ada | Tolak penambahan | Inline message di QuickLinks_Widget |

### Toast Notification Architecture

```
┌────────────────────────────────────┐
│  [ikon] Teks pesan error      [×]  │
└────────────────────────────────────┘
   Auto-dismiss setelah 5 detik
   Atau dismiss manual dengan tombol ×
```

Notifikasi penyelesaian timer (Requirement 4.2) menggunakan modal overlay yang lebih menonjol dan **tidak** auto-dismiss — harus dikonfirmasi user.

### Error Hierarchy

```javascript
// Urutan prioritas penanganan error
1. Storage unavailable (SecurityError)   → app-level banner
2. Storage write failure (QuotaExceeded) → widget-level toast
3. Data validation failure              → inline field error
4. Corrupted data on read              → silent recovery, empty state
```

---

## Testing Strategy

### Pendekatan Pengujian Ganda

Pengujian menggunakan dua pendekatan komplementer:

1. **Unit tests berbasis contoh** — untuk perilaku spesifik, edge cases, dan error conditions
2. **Property-based tests** — untuk properti universal yang berlaku di semua input

### Library Property-Based Testing

Karena proyek ini adalah Vanilla JavaScript tanpa build system, property-based testing menggunakan **[fast-check](https://fast-check.dev/)** yang dapat di-load via CDN dalam test environment saja (tidak di-bundle ke production). Alternatif: **[jsverify](https://github.com/jsverify/jsverify)** atau implementasi sederhana berbasis `Math.random()` untuk test tanpa dependency.

Konfigurasi: minimum **100 iterasi** per property test.

### Unit Test Coverage

Setiap komponen diuji secara terisolasi dengan DOM virtual (jsdom) atau browser langsung:

**StorageManager:**
- Read dari storage kosong → `[]`
- Read data valid → array terparse
- Read JSON korup → `[]` tanpa crash
- Write berhasil → `{ ok: true }`
- Write gagal (mock QuotaExceededError) → `{ ok: false, error }`

**GreetingWidget:**
- `_getGreeting()` dengan jam tidak valid → `"Halo"`
- `_formatTime()` dengan Date tidak valid → `"--:--"`
- `_formatDate()` dengan Date tidak valid → `"--"`
- Pembaruan otomatis sapaan ketika jam berganti rentang

**TimerWidget:**
- Start dari 25:00 → state berubah ke `running`
- Stop saat running → state berubah ke `idle`, waktu dipertahankan
- Reset → state kembali ke `idle`, tampilan kembali ke `25:00`
- Selesai (mencapai 00:00) → state `done`, notifikasi ditampilkan
- Dismiss notifikasi → state kembali ke `idle`, tampilan `25:00`
- Start saat `done`/tampilan `00:00` → tidak ada efek

**TodoWidget:**
- Edit valid → teks diperbarui, mode edit ditutup
- Edit dengan Escape → teks tidak berubah
- Toggle → `completed` berubah, styling diterapkan

**QuickLinksWidget:**
- Klik link → buka di tab baru (`window.open` dengan `_blank`)
- Tambah link valid → muncul dalam daftar
- Hapus link → hilang dari daftar

### Property Test Tags

Setiap property test harus diberi tag komentar dengan format:

```javascript
// Feature: todo-life-dashboard, Property {number}: {property_text}
```

### Tabel Coverage Requirement → Test

| Requirement | Test Type | Property # |
|---|---|---|
| 1.1 Format waktu HH:MM | Property | #1 |
| 1.2 Format tanggal Indonesia | Property | #2 |
| 1.3 Tampil akurat saat load | Smoke | — |
| 1.4 Fallback jam invalid | Edge case | — |
| 2.1–2.4 Pemetaan sapaan | Property | #3 |
| 2.5 Pembaruan otomatis | Integration | — |
| 2.6 Fallback jam invalid | Edge case | — |
| 3.1 Format MM:SS | Property | #4 |
| 3.2–3.9 Kontrol timer | Property + Example | #5 |
| 4.1–4.4 Notifikasi selesai | Example | — |
| 5.2 Tambah tugas | Property | #6 |
| 5.3 Tolak whitespace | Property | #7 |
| 5.5, 10.5 Round-trip storage | Property | #8 |
| 6.3, 6.5, 6.6 Validasi edit | Property | #10 |
| 6.8 Escape mode edit | Property | #9 |
| 7.3, 7.4 Toggle selesai | Property | #11 |
| 7.7 Hapus todo | Property | #12 |
| 8.3 Validasi field kosong | Property | #15 |
| 8.4 Validasi URL | Property | #14 |
| 8.8 Max 20 links | Property | #16 |
| 9.3 Hapus link | Property | #17 |
| 10.4 JSON schema | Property | #13 |
| 10.5 Round-trip | Property | #8 |
| Semua storage errors | Edge case | — |
| 11.1–11.5 Struktur file | Smoke | — |
| 12.1–12.4 Layout responsif | Smoke/Visual | — |

### UI Layout Testing

Pengujian responsivitas dilakukan secara manual di:
- Chrome DevTools device emulation (1024px, 768px, 375px)
- Firefox Responsive Design Mode
- Edge DevTools

Verifikasi per checklist:
- [ ] Semua 4 widget terlihat tanpa scroll horizontal
- [ ] Tidak ada widget yang saling tumpang tindih
- [ ] Teks dapat dibaca tanpa zoom
- [ ] Pemisah visual antar widget terlihat
- [ ] Hover/focus state interaktif terlihat dalam <100ms

---

## UI Layout Structure

### Grid Layout

```
Desktop (≥1024px):
┌─────────────────┬─────────────────┐
│  Greeting_Widget│  Timer_Widget   │
│  (kiri atas)    │  (kanan atas)   │
├─────────────────┼─────────────────┤
│  Todo_Widget    │ QuickLinks_Widget│
│  (kiri bawah)   │  (kanan bawah)  │
└─────────────────┴─────────────────┘

Tablet (768px–1023px):
┌──────────────────────────────────┐
│         Greeting_Widget          │
├──────────────────────────────────┤
│         Timer_Widget             │
├──────────────────────────────────┤
│         Todo_Widget              │
├──────────────────────────────────┤
│        QuickLinks_Widget         │
└──────────────────────────────────┘
```

Implementasi menggunakan CSS Grid dengan `grid-template-columns: 1fr 1fr` pada desktop dan `grid-template-columns: 1fr` pada tablet menggunakan media query `@media (max-width: 1023px)`.

### HTML Skeleton

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>To-Do Life Dashboard</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="notification-modal" role="dialog" aria-modal="true" hidden>
    <!-- Modal notifikasi timer selesai -->
  </div>
  <div id="storage-banner" role="alert" hidden>
    <!-- Banner error storage level app -->
  </div>
  <main id="dashboard">
    <section id="greeting-widget" class="widget">
      <!-- Greeting_Widget -->
    </section>
    <section id="timer-widget" class="widget">
      <!-- Timer_Widget -->
    </section>
    <section id="todo-widget" class="widget">
      <!-- Todo_Widget -->
    </section>
    <section id="quicklinks-widget" class="widget">
      <!-- QuickLinks_Widget -->
    </section>
  </main>
  <script src="js/app.js"></script>
</body>
</html>
```

### CSS Architecture (style.css)

File CSS diorganisasi dalam urutan:
1. CSS Custom Properties (design tokens: warna, spacing, font)
2. Reset / base styles
3. Layout: `#dashboard` grid
4. Shared widget styles (`.widget`)
5. Greeting_Widget styles
6. Timer_Widget styles
7. Todo_Widget styles
8. QuickLinks_Widget styles
9. Notification modal styles
10. Toast error styles
11. Media queries (tablet breakpoint)

### JavaScript Architecture (app.js)

File JS diorganisasi sebagai single IIFE:

```javascript
(function() {
  'use strict';

  // ─── Utilities ───────────────────────────────────────────────
  const EventBus = { ... };
  const UIHelpers = { ... };

  // ─── Storage Manager ─────────────────────────────────────────
  const StorageManager = { ... };

  // ─── Widgets ─────────────────────────────────────────────────
  const GreetingWidget = { ... };
  const TimerWidget = { ... };
  const TodoWidget = { ... };
  const QuickLinksWidget = { ... };

  // ─── Bootstrap ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    GreetingWidget.init(document.getElementById('greeting-widget'));
    TimerWidget.init(document.getElementById('timer-widget'));
    TodoWidget.init(document.getElementById('todo-widget'));
    QuickLinksWidget.init(document.getElementById('quicklinks-widget'));
  });

})();
```

### Accessibility

- Setiap widget menggunakan elemen `<section>` dengan heading `<h2>`
- Tombol menggunakan elemen `<button>` native (bukan `<div>` yang di-click)
- Notifikasi modal menggunakan `role="dialog"` dan `aria-modal="true"`
- Error banner menggunakan `role="alert"` untuk screen reader
- Checkbox menggunakan `<input type="checkbox">` native dengan `<label>` terhubung
- Input teks memiliki `<label>` atau `aria-label`
- Focus management saat masuk/keluar mode edit (`.focus()`)
