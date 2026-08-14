# Requirements Document

## Introduction

"To-Do List Life Dashboard" adalah website single-page yang berfungsi sebagai dasbor produktivitas harian. Aplikasi ini dibangun menggunakan HTML, CSS, dan Vanilla JavaScript murni tanpa framework frontend, tanpa backend server, serta menyimpan seluruh data di sisi klien menggunakan Browser Local Storage API. Dasbor menggabungkan empat fitur utama dalam satu tampilan: Sapaan berbasis waktu, Focus Timer gaya Pomodoro, To-Do List, dan Quick Links ke website favorit.

## Glossary

- **Dashboard**: Halaman utama tunggal (single-page) yang menampilkan semua widget secara bersamaan.
- **Dashboard_App**: Sistem aplikasi To-Do List Life Dashboard secara keseluruhan.
- **Greeting_Widget**: Komponen yang menampilkan waktu, tanggal, dan sapaan berbasis waktu kepada pengguna.
- **Timer_Widget**: Komponen Focus Timer bergaya Pomodoro dengan durasi 25 menit.
- **Todo_Widget**: Komponen pengelolaan daftar tugas harian.
- **QuickLinks_Widget**: Komponen pengelolaan tautan cepat ke website favorit.
- **Storage_Manager**: Modul yang bertanggung jawab membaca dan menulis data ke Browser Local Storage.
- **Todo_Item**: Satu entitas tugas yang memiliki atribut: id, teks, dan status selesai (boolean).
- **Link_Item**: Satu entitas tautan cepat yang memiliki atribut: id, label, dan URL.
- **Session**: Satu sesi Focus Timer berdurasi 25 menit.
- **Local_Storage**: Browser Local Storage API yang digunakan sebagai satu-satunya media penyimpanan data.

---

## Requirements

### Requirement 1: Tampilan Waktu dan Tanggal Real-Time

**User Story:** Sebagai pengguna, saya ingin melihat waktu dan tanggal terkini di dasbor, sehingga saya dapat selalu mengetahui konteks waktu saat bekerja.

#### Acceptance Criteria

1. THE Greeting_Widget SHALL menampilkan waktu saat ini dalam format HH:MM (jam dan menit, 24 jam) yang diperbarui setiap 60 detik.
2. THE Greeting_Widget SHALL menampilkan tanggal saat ini dalam format nama hari, DD MMMM YYYY dalam bahasa Indonesia (contoh: Kamis, 14 Agustus 2026).
3. WHEN halaman pertama kali dimuat, THE Greeting_Widget SHALL menampilkan waktu dan tanggal yang akurat sesuai waktu lokal perangkat pengguna dalam waktu kurang dari 1 detik setelah halaman dimuat.
4. IF jam sistem perangkat tidak dapat diakses atau mengembalikan nilai tidak valid, THEN THE Greeting_Widget SHALL menampilkan tanda "--:--" untuk waktu dan "--" untuk tanggal sebagai nilai fallback.

### Requirement 2: Sapaan Berdasarkan Waktu

**User Story:** Sebagai pengguna, saya ingin menerima sapaan yang sesuai dengan waktu hari ini, sehingga dasbor terasa personal dan kontekstual.

#### Acceptance Criteria

1. WHEN jam sistem berada di antara 05:00 dan 11:59, THE Greeting_Widget SHALL menampilkan teks sapaan "Selamat Pagi".
2. WHEN jam sistem berada di antara 12:00 dan 14:59, THE Greeting_Widget SHALL menampilkan teks sapaan "Selamat Siang".
3. WHEN jam sistem berada di antara 15:00 dan 17:59, THE Greeting_Widget SHALL menampilkan teks sapaan "Selamat Sore".
4. WHEN jam sistem berada di antara 18:00 dan 23:59, ATAU berada di antara 00:00 dan 04:59, THE Greeting_Widget SHALL menampilkan teks sapaan "Selamat Malam".
5. WHEN waktu berganti melewati batas rentang sapaan, THE Greeting_Widget SHALL memperbarui teks sapaan secara otomatis dalam waktu tidak lebih dari 60 detik tanpa perlu reload halaman.
6. IF jam sistem tidak dapat diakses atau mengembalikan nilai tidak valid, THEN THE Greeting_Widget SHALL menampilkan teks sapaan "Halo" sebagai nilai fallback.

### Requirement 3: Focus Timer — Kontrol Sesi

**User Story:** Sebagai pengguna, saya ingin mengoperasikan Focus Timer dengan tombol Start, Stop, dan Reset, sehingga saya dapat mengelola sesi fokus kerja saya secara fleksibel.

#### Acceptance Criteria

1. THE Timer_Widget SHALL menampilkan hitungan mundur dalam format MM:SS, dimulai dari 25:00 (dua puluh lima menit nol detik).
2. WHEN pengguna menekan tombol Start, THE Timer_Widget SHALL memulai hitungan mundur dari waktu yang saat ini ditampilkan dalam rentang 00:01 hingga 99:59.
3. WHILE Timer_Widget sedang berjalan, THE Timer_Widget SHALL memperbarui tampilan hitungan mundur setiap satu detik dengan selisih tidak lebih dari 100 milidetik dari interval satu detik yang sebenarnya.
4. WHEN pengguna menekan tombol Stop, THE Timer_Widget SHALL menghentikan hitungan mundur dan mempertahankan sisa waktu yang ditampilkan.
5. WHEN pengguna menekan tombol Reset, THE Timer_Widget SHALL menghentikan hitungan mundur dan mengembalikan tampilan ke 25:00.
6. WHILE Timer_Widget sedang berjalan, THE Timer_Widget SHALL menonaktifkan tombol Start agar tidak dapat ditekan kembali.
7. WHILE Timer_Widget sedang berhenti atau di-reset, THE Timer_Widget SHALL menonaktifkan tombol Stop agar tidak dapat ditekan kembali.
8. WHEN hitungan mundur mencapai 00:00, THE Timer_Widget SHALL menghentikan hitungan mundur secara otomatis dan menampilkan notifikasi visual pada Timer_Widget bahwa sesi fokus telah selesai.
9. IF pengguna menekan tombol Start saat tampilan menunjukkan 00:00, THEN THE Timer_Widget SHALL tidak memulai hitungan mundur dan tombol Start tetap dalam kondisi dinonaktifkan.

### Requirement 4: Focus Timer — Notifikasi Selesai

**User Story:** Sebagai pengguna, saya ingin mendapat notifikasi ketika sesi fokus selesai, sehingga saya tahu kapan harus beristirahat.

#### Acceptance Criteria

1. WHEN hitungan mundur Timer_Widget mencapai 00:00, THE Timer_Widget SHALL menghentikan timer secara otomatis dan berhenti melakukan penghitungan mundur.
2. WHEN hitungan mundur Timer_Widget mencapai 00:00, THE Dashboard_App SHALL menampilkan notifikasi visual kepada pengguna yang berisi teks indikasi sesi fokus telah selesai, dan notifikasi tersebut tetap terlihat hingga pengguna mengakuinya atau menutupnya secara eksplisit.
3. WHEN pengguna menutup atau mengakui notifikasi sesi selesai, THE Timer_Widget SHALL mengembalikan tampilan hitungan mundur ke 25:00 dalam kondisi berhenti (tidak berjalan).
4. IF Dashboard_App tidak dapat menampilkan notifikasi visual, THEN THE Dashboard_App SHALL menampilkan indikator pada Timer_Widget yang menunjukkan sesi fokus telah selesai.

### Requirement 5: Penambahan dan Penyimpanan Tugas

**User Story:** Sebagai pengguna, saya ingin menambahkan tugas baru ke daftar dan menyimpannya secara permanen, sehingga tugas saya tidak hilang saat halaman di-refresh.

#### Acceptance Criteria

1. THE Todo_Widget SHALL menyediakan kolom input teks dengan batas maksimal 200 karakter dan tombol tambah untuk memasukkan tugas baru.
2. WHEN pengguna mengetikkan teks tugas dan menekan tombol tambah atau tombol Enter, THE Todo_Widget SHALL menambahkan Todo_Item baru ke daftar dengan status belum selesai dan mengosongkan kolom input.
3. IF kolom input kosong atau hanya berisi spasi saat pengguna menekan tombol tambah atau Enter, THEN THE Todo_Widget SHALL menolak penambahan, tidak membuat Todo_Item baru, dan mempertahankan fokus pada kolom input.
4. WHEN Todo_Item baru berhasil ditambahkan, THE Storage_Manager SHALL menyimpan seluruh daftar Todo_Item yang diperbarui ke Local_Storage dalam waktu kurang dari 500 milidetik.
5. WHEN halaman dimuat, THE Storage_Manager SHALL membaca daftar Todo_Item dari Local_Storage dan THE Todo_Widget SHALL menampilkan semua tugas yang tersimpan sesuai urutan penyimpanan.
6. IF Local_Storage tidak tersedia atau operasi penyimpanan gagal saat menambah tugas, THEN THE Todo_Widget SHALL menampilkan pesan kesalahan yang mengindikasikan kegagalan penyimpanan dan tetap menampilkan Todo_Item baru pada sesi aktif.
7. IF Local_Storage tidak tersedia atau kosong saat halaman dimuat, THEN THE Todo_Widget SHALL menampilkan daftar kosong tanpa crash dan tetap memungkinkan pengguna menambah tugas baru.

### Requirement 6: Pengeditan Tugas

**User Story:** Sebagai pengguna, saya ingin mengedit teks tugas yang sudah ada, sehingga saya dapat memperbarui informasi tugas tanpa harus menghapus dan membuat ulang.

#### Acceptance Criteria

1. THE Todo_Widget SHALL menampilkan tombol atau kontrol edit pada setiap Todo_Item dalam daftar.
2. WHEN pengguna mengaktifkan mode edit pada sebuah Todo_Item, THE Todo_Widget SHALL mengubah tampilan teks tugas menjadi kolom input yang dapat diedit, berisi teks tugas saat ini, dan memindahkan fokus kursor ke kolom input tersebut.
3. THE Todo_Widget SHALL membatasi panjang teks pada kolom input edit maksimal 500 karakter.
4. WHEN pengguna menyimpan hasil edit dengan menekan Enter atau tombol konfirmasi, THE Todo_Widget SHALL memperbarui teks Todo_Item dengan teks baru yang dimasukkan dan keluar dari mode edit.
5. IF teks baru kosong saat pengguna menyimpan hasil edit, THEN THE Todo_Widget SHALL menolak perubahan, tidak keluar dari mode edit, dan mempertahankan isi kolom input agar pengguna dapat memperbaikinya.
6. IF teks baru melebihi 500 karakter saat pengguna menyimpan hasil edit, THEN THE Todo_Widget SHALL menampilkan pesan kesalahan dan tidak menyimpan perubahan, serta mempertahankan isi kolom input.
7. WHEN teks Todo_Item berhasil diperbarui, THE Storage_Manager SHALL menyimpan seluruh daftar Todo_Item yang diperbarui ke Local_Storage.
8. WHEN pengguna menekan tombol Escape saat dalam mode edit, THE Todo_Widget SHALL membatalkan perubahan, mengembalikan teks tugas ke nilai sebelumnya, dan keluar dari mode edit.

### Requirement 7: Penyelesaian dan Penghapusan Tugas

**User Story:** Sebagai pengguna, saya ingin menandai tugas sebagai selesai dan menghapus tugas yang tidak diperlukan, sehingga daftar tugas saya tetap relevan dan terorganisir.

#### Acceptance Criteria

1. THE Todo_Widget SHALL menampilkan checkbox atau kontrol toggle pada setiap Todo_Item dalam daftar.
2. THE Todo_Widget SHALL menampilkan tombol hapus pada setiap Todo_Item dalam daftar.
3. WHEN pengguna mencentang checkbox sebuah Todo_Item, THE Todo_Widget SHALL mengubah status Todo_Item tersebut menjadi selesai dan menerapkan gaya visual berupa teks dicoret untuk membedakannya dari Todo_Item berstatus belum selesai.
4. WHEN pengguna menghilangkan centang checkbox sebuah Todo_Item yang berstatus selesai, THE Todo_Widget SHALL mengubah status Todo_Item tersebut menjadi belum selesai dan menghapus gaya visual teks dicoret.
5. WHEN status Todo_Item berubah menjadi selesai atau belum selesai, THE Storage_Manager SHALL menyimpan seluruh daftar Todo_Item yang diperbarui ke Local_Storage dalam waktu kurang dari 500 milidetik.
6. IF penyimpanan ke Local_Storage gagal saat status Todo_Item berubah, THEN THE Todo_Widget SHALL menampilkan pesan kesalahan yang mengindikasikan kegagalan penyimpanan dan mempertahankan perubahan status pada tampilan sesi aktif.
7. WHEN pengguna menekan tombol hapus sebuah Todo_Item, THE Todo_Widget SHALL menghapus Todo_Item tersebut dari daftar secara permanen dan memperbarui tampilan daftar tanpa memuat ulang halaman.
8. WHEN sebuah Todo_Item dihapus, THE Storage_Manager SHALL menyimpan seluruh daftar Todo_Item yang diperbarui ke Local_Storage dalam waktu kurang dari 500 milidetik.
9. IF penyimpanan ke Local_Storage gagal saat Todo_Item dihapus, THEN THE Todo_Widget SHALL menampilkan pesan kesalahan yang mengindikasikan kegagalan penyimpanan dan mempertahankan penghapusan Todo_Item pada tampilan sesi aktif.

### Requirement 8: Penambahan dan Penyimpanan Quick Links

**User Story:** Sebagai pengguna, saya ingin menambahkan tautan ke website favorit saya di dasbor, sehingga saya dapat mengaksesnya dengan cepat tanpa perlu mengetik URL secara manual.

#### Acceptance Criteria

1. THE QuickLinks_Widget SHALL menyediakan antarmuka untuk memasukkan label maksimal 50 karakter dan URL maksimal 2048 karakter untuk tautan baru.
2. WHEN pengguna memasukkan label dan URL yang valid kemudian mengonfirmasi penambahan, THE QuickLinks_Widget SHALL membuat Link_Item baru dan menampilkannya sebagai tombol atau kartu yang dapat diklik dalam daftar Quick Links.
3. IF label kosong atau URL kosong saat pengguna mengonfirmasi penambahan, THEN THE QuickLinks_Widget SHALL menolak penambahan, tidak membuat Link_Item baru, dan menampilkan pesan kesalahan yang mengindikasikan kolom mana yang belum diisi.
4. IF URL yang dimasukkan tidak diawali dengan http:// atau https://, THEN THE QuickLinks_Widget SHALL menolak penambahan dan menampilkan pesan kesalahan yang mengindikasikan format URL tidak valid.
5. WHEN Link_Item baru berhasil ditambahkan, THE Storage_Manager SHALL menyimpan seluruh daftar Link_Item yang diperbarui ke Local_Storage dalam waktu kurang dari 1 detik.
6. WHEN halaman dimuat, THE Storage_Manager SHALL membaca daftar Link_Item dari Local_Storage dan THE QuickLinks_Widget SHALL menampilkan semua tautan yang tersimpan dalam waktu kurang dari 2 detik.
7. IF Local_Storage tidak dapat diakses saat halaman dimuat, THEN THE QuickLinks_Widget SHALL menampilkan daftar Quick Links kosong dan menampilkan pesan kesalahan yang mengindikasikan data tautan tidak dapat dimuat.
8. IF jumlah Link_Item yang tersimpan telah mencapai 20 tautan, THEN THE QuickLinks_Widget SHALL menolak penambahan Link_Item baru dan menampilkan pesan yang mengindikasikan batas maksimum tautan telah tercapai.

### Requirement 9: Penggunaan dan Penghapusan Quick Links

**User Story:** Sebagai pengguna, saya ingin membuka website favorit dari dasbor dan dapat menghapus tautan yang tidak lagi saya butuhkan.

#### Acceptance Criteria

1. WHEN pengguna mengklik sebuah Link_Item, THE Dashboard_App SHALL membuka URL yang tersimpan di tab browser baru.
2. THE QuickLinks_Widget SHALL menampilkan kontrol hapus pada setiap Link_Item yang tersedia dalam daftar.
3. WHEN pengguna mengkonfirmasi penghapusan sebuah Link_Item, THE QuickLinks_Widget SHALL menghapus tautan tersebut dari tampilan dalam waktu kurang dari 500ms.
4. WHEN sebuah Link_Item dihapus, THE Storage_Manager SHALL menyimpan seluruh daftar Link_Item yang diperbarui ke Local_Storage.
5. IF Local_Storage tidak tersedia atau operasi penyimpanan gagal, THEN THE Storage_Manager SHALL menampilkan pesan kesalahan yang menginformasikan kegagalan penyimpanan dan mempertahankan tampilan daftar Link_Item yang sudah diperbarui di sesi saat ini.
6. IF daftar Link_Item kosong setelah penghapusan, THEN THE QuickLinks_Widget SHALL menampilkan pesan kosong sebagai pengganti daftar tautan.

### Requirement 10: Persistensi Data dan Ketahanan Storage

**User Story:** Sebagai pengguna, saya ingin semua data saya tersimpan secara andal, sehingga tidak ada data yang hilang akibat kondisi tidak terduga.

#### Acceptance Criteria

1. THE Storage_Manager SHALL menggunakan kunci (key) yang unik dan tetap untuk masing-masing jenis data: satu kunci untuk daftar Todo_Item dan satu kunci untuk daftar Link_Item.
2. WHEN Storage_Manager membaca data dari Local_Storage dan data tidak ditemukan untuk kunci tersebut, THE Storage_Manager SHALL mengembalikan daftar kosong sebagai nilai default.
3. IF terjadi kesalahan saat Storage_Manager mencoba membaca atau menulis ke Local_Storage (contoh: kuota penuh, akses ditolak), THEN THE Dashboard_App SHALL tetap dapat beroperasi, menampilkan data terakhir yang berhasil dimuat, dan menampilkan pesan peringatan kepada pengguna yang mengindikasikan bahwa penyimpanan gagal, tanpa crash.
4. THE Storage_Manager SHALL menyimpan data Todo_Item dan Link_Item dalam format JSON yang valid, di mana setiap Todo_Item sekurang-kurangnya memuat nilai id, title, dan status penyelesaiannya, serta setiap Link_Item sekurang-kurangnya memuat nilai id, title, dan url.
5. FOR ALL operasi tulis ke Local_Storage, setelah data ditulis dan kemudian dibaca kembali, THE Storage_Manager SHALL menghasilkan daftar yang ekuivalen dengan daftar yang ditulis (round-trip property).
6. IF Storage_Manager membaca data dari Local_Storage dan data yang tersimpan bukan merupakan JSON yang valid, THEN THE Storage_Manager SHALL mengabaikan data yang korup tersebut, mengembalikan daftar kosong sebagai nilai default, dan mencatat kejadian tersebut tanpa menyebabkan crash pada Dashboard_App.
7. WHEN Storage_Manager berhasil menyelesaikan operasi tulis ke Local_Storage, THE Storage_Manager SHALL menyelesaikan operasi tersebut dalam waktu tidak lebih dari 200 milidetik untuk daftar yang memuat hingga 500 item.

### Requirement 11: Struktur File dan Kode

**User Story:** Sebagai pengembang, saya ingin proyek memiliki struktur file yang bersih dan terorganisir, sehingga kode mudah dipelihara dan dikembangkan.

#### Acceptance Criteria

1. THE Dashboard_App SHALL memiliki tepat satu file CSS yang berada di dalam folder css/.
2. THE Dashboard_App SHALL memiliki tepat satu file JavaScript yang berada di dalam folder js/.
3. THE Dashboard_App SHALL dapat dijalankan sepenuhnya hanya dengan membuka file HTML di browser modern (Chrome, Firefox, Edge, Safari) tanpa memerlukan server backend atau proses build.
4. WHEN file HTML dibuka di browser modern, THE Dashboard_App SHALL tidak menghasilkan error di browser console yang disebabkan oleh file yang tidak ditemukan atau referensi yang tidak terdefinisi.
5. THE Dashboard_App SHALL mereferensikan file CSS dan JavaScript menggunakan path relatif sehingga dapat dijalankan dari lokasi file system manapun tanpa konfigurasi tambahan.

### Requirement 12: Tampilan dan Responsivitas Antarmuka

**User Story:** Sebagai pengguna, saya ingin antarmuka dasbor tampil rapi estetis dan responsif, sehingga pengalaman penggunaan terasa nyaman di berbagai ukuran layar.

#### Acceptance Criteria

1. THE Dashboard_App SHALL menampilkan semua widget (Greeting, Timer, To-Do, Quick Links) dalam satu halaman tanpa memerlukan navigasi ke halaman lain.
2. THE Dashboard_App SHALL merender tampilan pada resolusi layar desktop (lebar minimal 1024px) dan layar tablet (lebar minimal 768px) dengan kondisi: tidak ada widget yang saling tumpang tindih, tidak ada horizontal scroll, dan semua teks dapat dibaca tanpa zoom tambahan.
3. WHEN pengguna berinteraksi dengan elemen UI (tombol, input, checkbox), THE Dashboard_App SHALL memberikan setidaknya satu perubahan visual yang dapat diamati (hover, focus, atau active state) dalam waktu kurang dari 100ms.
4. THE Dashboard_App SHALL menerapkan setidaknya satu pemisah visual yang dapat diamati antara setiap pasang widget yang berdekatan, berupa border, perbedaan warna latar belakang, atau jarak minimal 8px.
