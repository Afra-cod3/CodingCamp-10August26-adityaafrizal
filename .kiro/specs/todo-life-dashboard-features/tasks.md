# Tasks: Todo Life Dashboard — Empat Fitur Tambahan

## Task 1: Toggle Mode Terang/Gelap

### 1.1 Tambahkan tombol toggle ke `index.html`
Pastikan elemen berikut ada di `<body>` sebelum `<main>`:
```html
<button id="theme-toggle" type="button" aria-label="Ganti ke mode gelap" title="Toggle mode terang/gelap">
  <span id="theme-toggle-icon" aria-hidden="true">🌙</span>
</button>
```
Tambahkan `data-theme="light"` ke elemen `<html>`.

### 1.2 Tambahkan CSS custom properties untuk mode gelap ke `css/style.css`
Di bawah blok `:root`, tambahkan selector `[data-theme="dark"]` yang meng-override token warna:
- `--color-bg-page`, `--color-bg-widget`, `--color-bg-widget-alt`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`
- `--color-border`, `--color-border-focus`, `--color-overlay`
- `--color-primary`, `--color-primary-hover`, `--color-primary-active`

### 1.3 Tambahkan CSS untuk tombol `#theme-toggle` ke `css/style.css`
Style: `position: fixed; top: var(--space-4); right: var(--space-4); z-index: 990;` — bulat 44×44px, `background-color: var(--color-bg-widget)`, border, shadow, hover/active/focus-visible states.

### 1.4 Tambahkan `StorageManager.readTheme` dan `StorageManager.writeTheme` ke `js/app.js`
- `readTheme()`: baca `tld_theme_v1`, return `'dark'` jika tersimpan `'dark'`, else `'light'`
- `writeTheme(theme)`: tulis ke `tld_theme_v1`

### 1.5 Implementasikan `ThemeManager` di `js/app.js`
Modul IIFE dengan:
- `_currentTheme`, `_toggleBtn`, `_iconEl` sebagai state privat
- `_applyTheme(theme)`: set `data-theme` pada `<html>`, update ikon dan `aria-label`
- `init()`: baca preferensi tersimpan, terapkan, pasang click listener yang toggle dan persist

### 1.6 Panggil `ThemeManager.init()` di bootstrap `DOMContentLoaded`
Pastikan dipanggil sebelum widget lainnya agar tema aktif sebelum render widget.

---

## Task 2: Pengaturan Durasi Pomodoro

### 2.1 Tambahkan `StorageManager.readPomodoroDuration` dan `StorageManager.writePomodoroDuration` ke `js/app.js`
- `readPomodoroDuration()`: baca `tld_pomodoro_duration_v1`, return 25 jika tidak ada/tidak valid/di luar 1–99
- `writePomodoroDuration(minutes)`: tulis ke `tld_pomodoro_duration_v1`

### 2.2 Tambahkan CSS untuk `.timer-duration` dan `.timer-duration__input` ke `css/style.css`
Row `display: flex; align-items: center; gap: var(--space-2)`. Input lebar 64px, center-aligned, disabled state (opacity 0.45).

### 2.3 Tambahkan row input durasi ke DOM `TimerWidget.init` di `js/app.js`
Buat elemen:
```
div.timer-duration
  label[for="pomodoro-duration"].timer-duration__label  "Durasi:"
  input#pomodoro-duration[type="number", min="1", max="99", class="timer-duration__input"]
  span.timer-duration__unit  "menit"
```
Simpan referensi ke `_durationInputEl`.

### 2.4 Load durasi dari storage saat `TimerWidget.init`
```js
_durationMin = StorageManager.readPomodoroDuration();
_remainingMs = _durationMin * 60 * 1000;
_durationInputEl.value = String(_durationMin);
```

### 2.5 Pasang listener `change` pada `_durationInputEl`
- Parse dan clamp ke [1, 99]
- Update `_durationMin`, `_remainingMs`, `_displayEl`
- Panggil `StorageManager.writePomodoroDuration(_durationMin)`
- Panggil `_updateButtons()`

### 2.6 Nonaktifkan input di `_updateButtons` saat `_state === 'running'`
```js
if (_durationInputEl) {
  _durationInputEl.disabled = (_state === 'running');
}
```

---

## Task 3: Pencegahan Tugas Duplikat

### 3.1 Tambahkan CSS untuk `.todo-input__error` ke `css/style.css`
```css
.todo-input__error {
  width: 100%;
  margin: var(--space-1) 0 0;
  font-size: var(--font-sm);
  color: var(--color-danger, #dc2626);
  font-weight: var(--font-weight-medium);
}
```

### 3.2 Tambahkan CSS untuk `.todo-item__edit-error` ke `css/style.css`
```css
.todo-item__edit-error {
  display: block;
  width: 100%;
  font-size: var(--font-xs);
  color: var(--color-danger, #dc2626);
  font-weight: var(--font-weight-medium);
  margin-top: var(--space-1);
  order: 10;
}
```

### 3.3 Tambahkan validasi duplikat di `_addTodo` (TodoWidget) di `js/app.js`
Setelah validasi kosong, tambahkan:
```js
var trimmedLower = trimmed.toLowerCase();
var isDuplicate = _items.some(function (i) {
  return i.title.toLowerCase() === trimmedLower;
});
if (isDuplicate) {
  // tampilkan _errorEl dengan pesan "Tugas dengan nama ini sudah ada."
  // kembalikan fokus ke _inputEl
  return;
}
```

### 3.4 Tambahkan validasi duplikat di `_exitEditMode` (TodoWidget) di `js/app.js`
Setelah validasi panjang, tambahkan:
```js
var newTextLower = newText.toLowerCase();
var isDuplicate = _items.some(function (i) {
  return i.id !== id && i.title.toLowerCase() === newTextLower;
});
if (isDuplicate) {
  editError.textContent = 'Tugas dengan nama ini sudah ada.';
  editError.hidden = false;
  editInput.focus();
  return;
}
```

---

## Task 4: Pengurutan Daftar Tugas

### 4.1 Tambahkan CSS untuk `.todo-sort` dan `.todo-sort__select` ke `css/style.css`
Row `display: flex; align-items: center; gap: var(--space-2)`. Select dengan border, border-radius, padding, focus ring.

### 4.2 Tambahkan state `_sortOrder` dan referensi `_sortSelectEl` ke `TodoWidget` di `js/app.js`
```js
var _sortOrder = 'status';
var _sortSelectEl = null;
```

### 4.3 Buat DOM sort dropdown di `TodoWidget.init`
```
div.todo-sort
  label[for="todo-sort"].todo-sort__label  "Urutkan:"
  select#todo-sort.todo-sort__select
    option[value="status"]    "Status (belum selesai dulu)"   [selected]
    option[value="name-asc"]  "Nama (A → Z)"
    option[value="name-desc"] "Nama (Z → A)"
```
Masukkan ke `containerEl` di antara `inputAreaEl` dan `_emptyEl`.

### 4.4 Implementasikan `_getSortedItems` di `TodoWidget`
```js
function _getSortedItems() {
  var copy = _items.slice();
  if (_sortOrder === 'name-asc') {
    copy.sort(function (a, b) {
      return a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'id');
    });
  } else if (_sortOrder === 'name-desc') {
    copy.sort(function (a, b) {
      return b.title.toLowerCase().localeCompare(a.title.toLowerCase(), 'id');
    });
  } else {
    copy.sort(function (a, b) {
      return (a.completed === b.completed) ? 0 : (a.completed ? 1 : -1);
    });
  }
  return copy;
}
```
Pastikan `_items` tidak pernah dimodifikasi.

### 4.5 Gunakan `_getSortedItems` di `_renderList`
Ganti iterasi langsung `_items` dengan:
```js
_getSortedItems().forEach(function (item) {
  _listEl.appendChild(_renderItem(item));
});
```

### 4.6 Pasang listener `change` pada `_sortSelectEl`
```js
_sortSelectEl.addEventListener('change', function () {
  _sortOrder = _sortSelectEl.value;
  _renderList();
});
```

---

## Task 5: Verifikasi & Testing Manual

### 5.1 Verifikasi Toggle Mode Terang/Gelap
- [ ] Buka aplikasi → tema sesuai nilai tersimpan (default terang)
- [ ] Klik toggle → tema berubah, ikon dan aria-label update
- [ ] Refresh halaman → tema tetap sesuai yang terakhir dipilih
- [ ] Semua widget (Greeting, Timer, Todo, QuickLinks) bereaksi terhadap perubahan tema

### 5.2 Verifikasi Pengaturan Durasi Pomodoro
- [ ] Input durasi menampilkan 25 secara default (atau nilai tersimpan)
- [ ] Ubah nilai → countdown display diperbarui
- [ ] Start timer → input dinonaktifkan
- [ ] Stop/Reset → input aktif kembali
- [ ] Input nilai di luar 1–99 → di-clamp ke batas terdekat
- [ ] Refresh halaman → durasi tersimpan dipulihkan

### 5.3 Verifikasi Pencegahan Duplikat
- [ ] Tambah tugas "Belajar" → berhasil
- [ ] Tambah tugas "belajar" (huruf kecil) → error "Tugas dengan nama ini sudah ada."
- [ ] Tambah tugas "BELAJAR" (huruf besar) → error yang sama
- [ ] Edit tugas menjadi nama yang sama dengan tugas lain → error di inline edit
- [ ] Edit tugas tanpa mengubah nama → berhasil (tidak dianggap duplikat)

### 5.4 Verifikasi Pengurutan Daftar Tugas
- [ ] Default dropdown → "Status" terpilih, tugas belum selesai muncul lebih dulu
- [ ] Pilih "Nama (A → Z)" → urutan alfabet ascending
- [ ] Pilih "Nama (Z → A)" → urutan alfabet descending
- [ ] Centang/uncentang tugas → posisi render berubah sesuai sort aktif
- [ ] Data `_items` tetap dalam urutan asli (verifikasi via DevTools console: `TodoWidget._items`)
