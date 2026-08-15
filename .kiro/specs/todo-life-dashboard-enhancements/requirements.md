# Requirements Document

## Introduction

Dokumen ini mendefinisikan empat fitur tambahan untuk aplikasi **Todo Life Dashboard** yang sudah berjalan (`index.html`, `css/style.css`, `js/app.js`). Aplikasi dibangun dengan Vanilla JS menggunakan pola IIFE, EventBus, StorageManager, dan empat widget: Greeting, Timer, Todo, QuickLinks. CSS menggunakan CSS custom properties di `:root`. Tidak ada build tool.

Fitur yang ditambahkan:
1. **Toggle Mode Terang / Gelap** — tombol fixed di pojok kanan atas, preferensi disimpan di localStorage.
2. **Pengaturan Durasi Pomodoro** — input untuk mengubah durasi sesi fokus, disimpan permanen di localStorage.
3. **Pencegahan Tugas Duplikat** — validasi case-insensitive saat menambah atau mengedit tugas.
4. **Pengurutan Daftar Tugas** — dropdown dengan tiga pilihan urutan yang diterapkan pada tampilan daftar.

---

## Glossary

- **Dashboard**: Halaman utama aplikasi (`index.html`) yang menampung keempat widget.
- **ThemeToggle**: Tombol fixed di pojok kanan atas untuk beralih antara mode terang dan mode gelap.
- **Dark_Mode**: Tema tampilan dengan latar belakang gelap dan teks terang, diaktifkan dengan atribut `data-theme="dark"` pada elemen `<html>`.
- **Light_Mode**: Tema tampilan default dengan latar belakang terang dan teks gelap, diaktifkan tanpa atribut `data-theme` (atau `data-theme="light"`).
- **StorageManager**: Modul IIFE yang sudah ada, bertanggung jawab membaca dan menulis data ke `localStorage`.
- **TimerWidget**: Widget Pomodoro yang sudah ada, menampilkan countdown dan tombol kontrol.
- **Pomodoro_Duration**: Durasi sesi fokus Pomodoro dalam satuan menit (nilai bulat antara 1–99).
- **TodoWidget**: Widget daftar tugas yang sudah ada, mengelola penambahan, pengeditan, penghapusan, dan penyelesaian tugas.
- **Todo_Item**: Objek tugas dengan properti `id` (string), `title` (string), dan `completed` (boolean).
- **SortDropdown**: Elemen `<select>` di atas daftar tugas untuk memilih urutan tampilan.
- **Sort_Order**: Nilai urutan aktif; salah satu dari `"name-asc"`, `"name-desc"`, atau `"status"`.
- **tld_theme_v1**: Kunci localStorage untuk menyimpan preferensi tema (`"light"` atau `"dark"`).
- **tld_pomodoro_duration_v1**: Kunci localStorage untuk menyimpan durasi Pomodoro dalam menit.

---

## Requirements

### Requirement 1 — Toggle Mode Terang / Gelap

**User Story:** Sebagai pengguna Dashboard, saya ingin beralih antara mode terang dan mode gelap dengan satu klik, agar saya dapat menyesuaikan tampilan dengan kondisi pencahayaan lingkungan saya.

#### Acceptance Criteria

1. THE Dashboard SHALL menampilkan ThemeToggle sebagai tombol `<button>` dengan posisi `fixed` di pojok kanan atas halaman, selalu terlihat tanpa terganggu konten di bawahnya.

2. WHEN pengguna mengklik ThemeToggle, THE Dashboard SHALL mengganti nilai atribut `data-theme` pada elemen `<html>` antara `"dark"` dan `"light"` (toggle).

3. WHEN `data-theme="dark"` diaktifkan, THE Dashboard SHALL menerapkan warna latar belakang gelap dan warna teks terang melalui CSS custom properties yang didefinisikan ulang di selektor `[data-theme="dark"]`.

4. WHEN `data-theme="light"` diaktifkan, THE Dashboard SHALL mengembalikan semua CSS custom properties ke nilai default (Light_Mode) yang didefinisikan di `:root`.

5. WHEN pengguna mengklik ThemeToggle, THE StorageManager SHALL menyimpan nilai tema aktif (`"light"` atau `"dark"`) ke localStorage dengan kunci `tld_theme_v1`.

6. WHEN halaman dimuat ulang (page reload), THE Dashboard SHALL membaca nilai dari localStorage dengan kunci `tld_theme_v1` dan menerapkan tema yang tersimpan sebelum konten ditampilkan, sehingga tidak ada kedipan tema (flash of wrong theme).

7. IF kunci `tld_theme_v1` tidak ditemukan di localStorage atau nilainya tidak valid, THEN THE Dashboard SHALL menerapkan Light_Mode sebagai tema default.

8. THE ThemeToggle SHALL memiliki `aria-label` yang mencerminkan tindakan yang akan dilakukan: `"Aktifkan mode gelap"` saat tema saat ini adalah Light_Mode, dan `"Aktifkan mode terang"` saat tema saat ini adalah Dark_Mode.

9. THE ThemeToggle SHALL menampilkan ikon atau teks yang berbeda untuk setiap mode (contoh: ikon matahari untuk Light_Mode, ikon bulan untuk Dark_Mode) agar pengguna dapat mengidentifikasi tema aktif secara visual.

---

### Requirement 2 — Pengaturan Durasi Pomodoro

**User Story:** Sebagai pengguna Dashboard, saya ingin mengubah durasi sesi Pomodoro menjadi nilai menit yang saya pilih, agar saya dapat menyesuaikan panjang sesi fokus dengan kebutuhan produktivitas saya.

#### Acceptance Criteria

1. THE TimerWidget SHALL menampilkan sebuah elemen input (`<input type="number">`) dengan label yang jelas untuk mengubah Pomodoro_Duration, di dalam area widget Timer.

2. THE TimerWidget SHALL membatasi nilai input Pomodoro_Duration pada rentang bilangan bulat antara 1 menit hingga 99 menit (inklusif).

3. IF pengguna memasukkan nilai di luar rentang 1–99, THEN THE TimerWidget SHALL menampilkan pesan error inline yang memberitahukan batas yang valid, dan menolak nilai tersebut.

4. WHEN pengguna mengonfirmasi nilai Pomodoro_Duration yang valid (menekan Enter atau tombol konfirmasi), THE TimerWidget SHALL memperbarui tampilan countdown ke nilai baru dalam format `MM:00`.

5. WHEN pengguna mengonfirmasi nilai Pomodoro_Duration yang valid, THE StorageManager SHALL menyimpan nilai tersebut ke localStorage dengan kunci `tld_pomodoro_duration_v1`.

6. WHEN halaman dimuat ulang, THE TimerWidget SHALL membaca nilai dari localStorage dengan kunci `tld_pomodoro_duration_v1` dan menggunakannya sebagai durasi awal countdown, sehingga pengaturan bersifat permanen.

7. IF kunci `tld_pomodoro_duration_v1` tidak ditemukan di localStorage atau nilainya tidak valid (bukan bilangan bulat dalam rentang 1–99), THEN THE TimerWidget SHALL menggunakan durasi default 25 menit.

8. WHILE timer sedang berjalan (`_state === 'running'`), THE TimerWidget SHALL menonaktifkan input Pomodoro_Duration sehingga durasi tidak dapat diubah di tengah sesi.

9. WHEN timer direset, THE TimerWidget SHALL memperbarui tampilan countdown ke nilai Pomodoro_Duration yang tersimpan saat itu (bukan kembali ke 25 menit hardcoded).

---

### Requirement 3 — Pencegahan Tugas Duplikat

**User Story:** Sebagai pengguna Dashboard, saya ingin dicegah dari menambahkan atau mengedit tugas dengan nama yang sudah ada, agar daftar tugas saya tetap bersih dan tidak redundan.

#### Acceptance Criteria

1. WHEN pengguna mencoba menambahkan Todo_Item baru melalui input tambah tugas, THE TodoWidget SHALL membandingkan teks yang diinputkan (setelah `trim()`) dengan judul seluruh Todo_Item yang ada menggunakan perbandingan case-insensitive.

2. IF teks yang diinputkan sama (case-insensitive) dengan judul Todo_Item yang sudah ada, THEN THE TodoWidget SHALL menampilkan pesan error inline di bawah input tambah tugas dan menolak penambahan item baru tersebut.

3. THE TodoWidget SHALL menggunakan pesan error `"Tugas dengan nama ini sudah ada."` untuk notifikasi duplikat saat penambahan.

4. WHEN pengguna mencoba menyimpan hasil edit Todo_Item (menekan Enter di dalam `todo-item__edit-input`), THE TodoWidget SHALL membandingkan teks baru (setelah `trim()`) dengan judul seluruh Todo_Item lain yang ada (selain item yang sedang diedit) menggunakan perbandingan case-insensitive.

5. IF teks edit sama (case-insensitive) dengan judul Todo_Item lain yang sudah ada, THEN THE TodoWidget SHALL menampilkan pesan error inline di dalam mode edit dan menolak penyimpanan perubahan tersebut.

6. THE TodoWidget SHALL menggunakan pesan error `"Tugas dengan nama ini sudah ada."` untuk notifikasi duplikat saat pengeditan.

7. WHERE teks yang diinputkan identik dengan judul item yang sedang diedit itu sendiri (pengguna menekan Enter tanpa mengubah apapun), THE TodoWidget SHALL menerima input tersebut sebagai valid dan menutup mode edit tanpa error.

---

### Requirement 4 — Pengurutan Daftar Tugas

**User Story:** Sebagai pengguna Dashboard, saya ingin mengurutkan daftar tugas berdasarkan kriteria yang saya pilih, agar saya dapat melihat tugas-tugas saya dalam urutan yang paling berguna bagi saya saat itu.

#### Acceptance Criteria

1. THE TodoWidget SHALL menampilkan SortDropdown berupa elemen `<select>` dengan label yang jelas, ditempatkan di antara area input tambah tugas dan daftar tugas.

2. THE SortDropdown SHALL menyediakan tepat tiga pilihan (option): `"Nama A–Z"` (value: `"name-asc"`), `"Nama Z–A"` (value: `"name-desc"`), dan `"Status (Selesai/Belum)"` (value: `"status"`).

3. WHEN pengguna memilih Sort_Order `"name-asc"`, THE TodoWidget SHALL menampilkan Todo_Item yang ada dalam urutan abjad A ke Z berdasarkan properti `title` (case-insensitive), tanpa mengubah urutan penyimpanan di `_items` atau di localStorage.

4. WHEN pengguna memilih Sort_Order `"name-desc"`, THE TodoWidget SHALL menampilkan Todo_Item dalam urutan abjad Z ke A berdasarkan properti `title` (case-insensitive), tanpa mengubah urutan penyimpanan di `_items` atau di localStorage.

5. WHEN pengguna memilih Sort_Order `"status"`, THE TodoWidget SHALL menampilkan Todo_Item yang belum selesai (`completed: false`) terlebih dahulu, diikuti oleh Todo_Item yang sudah selesai (`completed: true`), tanpa mengubah urutan penyimpanan di `_items` atau di localStorage.

6. THE TodoWidget SHALL menerapkan Sort_Order yang aktif setiap kali `_renderList()` dipanggil, sehingga item baru yang ditambahkan, diedit, atau dihapus selalu ditampilkan dalam urutan yang sesuai Sort_Order yang sedang dipilih.

7. WHEN halaman dimuat ulang, THE SortDropdown SHALL kembali ke pilihan default `"name-asc"` (Sort_Order tidak perlu dipersisten ke localStorage).

8. THE SortDropdown SHALL memiliki `aria-label` atau `<label>` terhubung dengan teks `"Urutkan tugas"` agar dapat diakses oleh pengguna screen reader.
