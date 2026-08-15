# Design: Todo Life Dashboard — Empat Fitur Tambahan

## Arsitektur Umum

Aplikasi menggunakan pola **IIFE (Immediately Invoked Function Expression)** tunggal di `js/app.js`. Semua modul (EventBus, UIHelpers, StorageManager, ThemeManager, dan setiap Widget) adalah objek literal yang dikembalikan dari IIFE bersarang — tidak ada modul ES6, tidak ada framework.

Dependensi antar-modul bersifat implisit (closure scope), bukan injeksi. Urutan deklarasi dalam file menentukan urutan inisialisasi.

```
IIFE (app.js)
├── EventBus            — pub/sub antar modul
├── UIHelpers           — DOM helpers, modal, storage banner
├── StorageManager      — baca/tulis localStorage (semua key terpusat)
├── ThemeManager        — toggle tema + persistensi
├── GreetingWidget      — jam & sapaan
├── TimerWidget         — pomodoro countdown + durasi input
├── TodoWidget          — daftar tugas + duplikat + pengurutan
├── QuickLinksWidget    — tautan cepat
└── Bootstrap (DOMContentLoaded)
```

---

## Feature 1: Toggle Mode Terang/Gelap

### HTML (`index.html`)

Tombol sudah ada di markup statis:

```html
<button id="theme-toggle" type="button" aria-label="Ganti ke mode gelap">
  <span id="theme-toggle-icon" aria-hidden="true">🌙</span>
</button>
```

Atribut `data-theme="light"` ada di `<html lang="id" data-theme="light">`.

### CSS (`css/style.css`)

Dua lapisan design tokens:

```css
/* Mode terang (default) */
:root {
  --color-bg-page: #f0f2f5;
  --color-bg-widget: #ffffff;
  --color-text-primary: #1e293b;
  /* … */
}

/* Override mode gelap */
[data-theme="dark"] {
  --color-bg-page: #0f172a;
  --color-bg-widget: #1e293b;
  --color-text-primary: #f1f5f9;
  /* … */
}
```

Posisi tombol:

```css
#theme-toggle {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: 990;
  /* … */
}
```

### JavaScript — `ThemeManager`

```
ThemeManager
  _currentTheme : 'light' | 'dark'
  _toggleBtn    : HTMLButtonElement | null
  _iconEl       : HTMLElement | null

  init()
    → StorageManager.readTheme()          // baca preferensi tersimpan
    → _applyTheme(saved)                  // terapkan ke DOM
    → _toggleBtn.addEventListener('click') // pasang listener
      → _applyTheme(next)
      → StorageManager.writeTheme(next)   // simpan preferensi

  _applyTheme(theme)
    → document.documentElement.setAttribute('data-theme', theme)
    → _iconEl.textContent = tema === 'dark' ? '☀️' : '🌙'
    → _toggleBtn.setAttribute('aria-label', …)
```

### StorageManager — key `tld_theme_v1`

```
readTheme()  → 'dark' jika tersimpan 'dark', else 'light'
writeTheme(theme) → localStorage.setItem('tld_theme_v1', theme)
```

---

## Feature 2: Pengaturan Durasi Pomodoro

### DOM (dibuat oleh `TimerWidget.init`)

```
div.timer-content
  div.timer-duration
    label[for="pomodoro-duration"]  "Durasi:"
    input#pomodoro-duration[type="number", min="1", max="99"]
    span.timer-duration__unit       "menit"
  time.timer-display                "25:00"
  div.timer-controls
    button.timer-btn--start
    button.timer-btn--stop
    button.timer-btn--reset
```

### CSS (`.timer-duration`, `.timer-duration__input`)

Input lebar 64px, center-aligned, disabled state (opacity 0.45, cursor not-allowed).

### JavaScript — `TimerWidget`

State relevan:

```
_durationMin    : number   — durasi aktif (1–99)
_durationInputEl: HTMLInputElement
```

Alur saat init:

```
_durationMin ← StorageManager.readPomodoroDuration()  // default 25
_remainingMs ← _durationMin * 60 * 1000
_durationInputEl.value ← String(_durationMin)
```

Listener `change` pada input:

```
val ← parseInt(input.value, 10)
clamp val ke [1, 99]
input.value ← String(val)     // sync tampilan input
_durationMin ← val
_remainingMs ← val * 60 * 1000
_displayEl.textContent ← _formatDisplay(_remainingMs)
StorageManager.writePomodoroDuration(val)
_updateButtons()
```

Fungsi `_updateButtons` menonaktifkan input saat `_state === 'running'`.

### StorageManager — key `tld_pomodoro_duration_v1`

```
readPomodoroDuration()
  raw ← localStorage.getItem('tld_pomodoro_duration_v1')
  parsed ← parseInt(raw, 10)
  jika NaN atau < 1 atau > 99 → return 25
  return parsed

writePomodoroDuration(minutes)
  localStorage.setItem('tld_pomodoro_duration_v1', String(minutes))
```

---

## Feature 3: Pencegahan Tugas Duplikat

### Titik validasi: `_addTodo` dan `_exitEditMode`

**Fungsi `_addTodo` (tambah tugas baru):**

```
trimmedLower ← trimmed.toLowerCase()
isDuplicate  ← _items.some(i → i.title.toLowerCase() === trimmedLower)

if isDuplicate:
  _errorEl.textContent ← 'Tugas dengan nama ini sudah ada.'
  _errorEl.hidden ← false
  _inputEl.focus()
  return   // batalkan penambahan
```

`_errorEl` adalah `<p class="todo-input__error" role="alert" aria-live="polite">` yang dibuat sekali dan di-reuse.

**Fungsi `_exitEditMode` (simpan edit):**

```
newTextLower ← newText.toLowerCase()
isDuplicate  ← _items.some(i → i.id !== id && i.title.toLowerCase() === newTextLower)

if isDuplicate:
  editError.textContent ← 'Tugas dengan nama ini sudah ada.'
  editError.hidden ← false
  editInput.focus()
  return   // batalkan simpan — tetap di mode edit
```

`editError` adalah `<span class="todo-item__edit-error" role="alert">` yang dibuat per-item saat masuk mode edit.

### Alur validasi lengkap `_addTodo`

```
1. Kosong?          → error "Tugas tidak boleh kosong."
2. Duplikat?        → error "Tugas dengan nama ini sudah ada."
3. Valid            → buat item, push ke _items, render, persist, clear input
```

### Alur validasi lengkap `_exitEditMode` (save=true)

```
1. Kosong?          → error "Teks tugas tidak boleh kosong."
2. > 500 karakter?  → error "Teks tugas tidak boleh melebihi 500 karakter."
3. Duplikat?        → error "Tugas dengan nama ini sudah ada."
4. Valid            → update item.title, update titleSpan, persist, exit edit mode
```

---

## Feature 4: Pengurutan Daftar Tugas

### DOM (dibuat oleh `TodoWidget.init`)

```
div.todo-sort
  label[for="todo-sort"]  "Urutkan:"
  select#todo-sort.todo-sort__select
    option[value="status"]    "Status (belum selesai dulu)"  [selected]
    option[value="name-asc"]  "Nama (A → Z)"
    option[value="name-desc"] "Nama (Z → A)"
```

Ditempatkan di antara `inputAreaEl` dan `_emptyEl` di dalam `#todo-widget`.

### JavaScript — `_sortOrder` dan `_getSortedItems`

State:

```
_sortOrder : 'status' | 'name-asc' | 'name-desc'   // default 'status'
```

Listener `change` pada select:

```
_sortOrder ← _sortSelectEl.value
_renderList()
```

Fungsi `_getSortedItems`:

```
copy ← _items.slice()     // salin, jangan mutasi _items

if 'name-asc':
  copy.sort((a, b) → a.title.toLowerCase().localeCompare(b.title.toLowerCase(), 'id'))

else if 'name-desc':
  copy.sort((a, b) → b.title.toLowerCase().localeCompare(a.title.toLowerCase(), 'id'))

else ('status'):
  copy.sort((a, b) → a.completed === b.completed ? 0 : (a.completed ? 1 : -1))
  // false (belum selesai) → -1, true (selesai) → 1
  // urutan asli dipertahankan dalam kelompok (sort stabil di semua browser modern)

return copy
```

Fungsi `_renderList` memanggil `_getSortedItems()` dan merender setiap item dari hasil copy tersebut.

**Invariant:** `_items` tidak pernah dimodifikasi oleh operasi pengurutan. Hanya `copy` yang diurutkan.

---

## Interaksi Antar-Modul

```
StorageManager ←── ThemeManager      (readTheme / writeTheme)
StorageManager ←── TimerWidget       (readPomodoroDuration / writePomodoroDuration)
StorageManager ←── TodoWidget        (readTodos / writeTodos)
UIHelpers      ←── TodoWidget        (createElement, sanitizeText, showStorageError)
EventBus       ←── TimerWidget       (emit TIMER_COMPLETE → _onComplete)
EventBus       ←── UIHelpers         (on NOTIFICATION_ACK → _reset)
```

---

## CSS Architecture

Semua warna yang berubah antar tema didefinisikan sebagai CSS custom properties di `:root` dan di-override di `[data-theme="dark"]`. Tidak ada class tambahan yang perlu ditambahkan ke elemen individual — perubahan `data-theme` pada `<html>` secara otomatis mengubah semua custom properties yang diturunkan ke seluruh pohon DOM.

Elemen-elemen baru yang ditambahkan:
- `#theme-toggle`, `#theme-toggle-icon` — tombol toggle (statis di HTML)
- `.timer-duration`, `.timer-duration__input`, `.timer-duration__label`, `.timer-duration__unit`
- `.todo-sort`, `.todo-sort__select`, `.todo-sort__label`
- `.todo-input__error` — error inline tambah tugas
- `.todo-item__edit-error` — error inline edit tugas
