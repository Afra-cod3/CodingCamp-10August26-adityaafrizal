# Requirements: Todo Life Dashboard — Empat Fitur Tambahan

## Overview

Menambahkan empat fitur ke aplikasi Todo Life Dashboard (Vanilla JS, IIFE pattern, CSS custom properties, localStorage via StorageManager):

1. Toggle Mode Terang/Gelap
2. Pengaturan Durasi Pomodoro
3. Pencegahan Tugas Duplikat
4. Pengurutan Daftar Tugas

---

## Feature 1: Toggle Mode Terang/Gelap

### Requirements

1.1 Tombol toggle berposisi `fixed` di pojok kanan atas layar dengan z-index tinggi agar selalu terlihat.

1.2 Klik tombol mengubah atribut `data-theme` pada elemen `<html>` antara nilai `"light"` dan `"dark"`.

1.3 Semua warna antarmuka — latar, teks, border, widget — dikendalikan sepenuhnya oleh CSS custom properties yang di-override di dalam selector `[data-theme="dark"]`.

1.4 Preferensi tema dipersistensikan ke localStorage dengan key `tld_theme_v1` dan dipulihkan saat halaman dibuka kembali.

1.5 Tombol menampilkan ikon yang mencerminkan mode saat ini: 🌙 saat mode terang (artinya "ganti ke gelap"), ☀️ saat mode gelap (artinya "ganti ke terang").

1.6 Atribut `aria-label` tombol berubah sesuai aksi yang akan dilakukan: "Ganti ke mode gelap" atau "Ganti ke mode terang".

### Acceptance Criteria

- [ ] Saat halaman pertama kali dibuka, tema yang diterapkan sesuai dengan nilai tersimpan di `tld_theme_v1` (default `"light"` jika tidak ada).
- [ ] Klik tombol toggle membalik tema dan menyimpan nilai baru ke `tld_theme_v1`.
- [ ] Atribut `data-theme` pada `<html>` berubah sesuai tema yang aktif.
- [ ] Ikon tombol dan `aria-label` selalu konsisten dengan tema yang sedang aktif.
- [ ] Seluruh widget dan elemen UI bereaksi terhadap perubahan tema via CSS custom properties tanpa perlu JavaScript tambahan.

---

## Feature 2: Pengaturan Durasi Pomodoro

### Requirements

2.1 Widget Timer menampilkan sebuah `<input type="number">` bertipe angka dengan nilai minimum 1 dan maksimum 99.

2.2 Input nilai durasi (dalam menit) diperbarui saat pengguna mengubah nilainya, langsung memperbarui tampilan countdown dan status tombol.

2.3 Input durasi dinonaktifkan (`disabled`) selama timer sedang berjalan (`state === 'running'`), dan aktif kembali saat timer idle atau selesai.

2.4 Nilai durasi dipersistensikan ke localStorage dengan key `tld_pomodoro_duration_v1` setiap kali pengguna mengubahnya.

2.5 Saat halaman dibuka, durasi dipulihkan dari localStorage (default 25 menit jika tidak ada, di luar rentang 1–99, atau nilai tidak valid).

2.6 Nilai input divalidasi dan di-clamp ke rentang 1–99 sebelum diterapkan.

### Acceptance Criteria

- [ ] Nilai awal input mencerminkan nilai tersimpan di `tld_pomodoro_duration_v1` (atau 25 jika tidak ada).
- [ ] Mengubah input saat idle memperbarui tampilan countdown secara langsung.
- [ ] Input tidak dapat diubah saat timer sedang berjalan.
- [ ] Nilai di luar 1–99 di-clamp ke batas terdekat dan disimpan.
- [ ] Nilai baru tersimpan ke `tld_pomodoro_duration_v1` setelah diubah.

---

## Feature 3: Pencegahan Tugas Duplikat

### Requirements

3.1 Sebelum menambahkan tugas baru, sistem memeriksa apakah judul yang dimasukkan sudah ada di daftar tugas (perbandingan case-insensitive).

3.2 Jika duplikat terdeteksi saat penambahan, input tidak diproses dan pesan error inline ditampilkan: **"Tugas dengan nama ini sudah ada."**

3.3 Validasi duplikat juga berlaku saat mengedit tugas yang sudah ada. Item yang sedang diedit sendiri dikecualikan dari pemeriksaan duplikat.

3.4 Jika duplikat terdeteksi saat edit, perubahan tidak disimpan dan pesan error inline ditampilkan di dalam item yang diedit: **"Tugas dengan nama ini sudah ada."**

3.5 Fokus dikembalikan ke field input yang relevan setelah pesan error duplikat ditampilkan.

### Acceptance Criteria

- [ ] Menambah tugas dengan nama yang sama persis (case-sensitif maupun case-insensitif) menampilkan pesan "Tugas dengan nama ini sudah ada." tanpa menambah item.
- [ ] Mengedit tugas menjadi nama yang sudah dimiliki tugas lain menampilkan pesan error yang sama tanpa menyimpan perubahan.
- [ ] Mengedit tugas tanpa mengubah namanya (atau mengubah kapitalisasi saja) tidak dianggap duplikat.
- [ ] Setelah error duplikat, input tetap fokus agar pengguna dapat langsung memperbaiki.

---

## Feature 4: Pengurutan Daftar Tugas

### Requirements

4.1 Widget Todo menampilkan sebuah `<select>` dropdown di atas daftar tugas untuk memilih metode pengurutan.

4.2 Tiga opsi pengurutan tersedia:
  - `status` — Tugas belum selesai ditampilkan lebih dulu, diikuti tugas selesai. Urutan dalam masing-masing kelompok mengikuti urutan penambahan asli.
  - `name-asc` — Diurutkan berdasarkan nama secara alfabet A → Z (case-insensitive, locale `id`).
  - `name-desc` — Diurutkan berdasarkan nama secara alfabet Z → A (case-insensitive, locale `id`).

4.3 Pengurutan hanya mempengaruhi tampilan (render). Data `_items` tidak pernah dimutasi oleh pengurutan.

4.4 Perubahan pilihan dropdown langsung me-render ulang daftar sesuai urutan baru.

4.5 Opsi default yang dipilih adalah `status`.

### Acceptance Criteria

- [ ] Dropdown dengan tiga opsi tampil di atas daftar tugas.
- [ ] Memilih "Nama (A → Z)" menampilkan tugas dalam urutan alfabet ascending.
- [ ] Memilih "Nama (Z → A)" menampilkan tugas dalam urutan alfabet descending.
- [ ] Memilih "Status" menampilkan tugas belum selesai lebih dulu.
- [ ] Urutan tersimpan di `_items` (data asli) tidak berubah setelah pengurutan apapun.
- [ ] Dropdown default terpilih pada opsi "Status".
