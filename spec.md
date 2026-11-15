# Spesifikasi RT/RW Net Admin

## Tujuan
Web admin yang sangat ringan untuk mengelola layanan RT/RW Net: pelanggan,
gangguan, absen teknisi, perbaikan, inventaris, pemasangan, dan komunikasi
internal (komentar tugas, pesan langsung, pengumuman).

## Pengguna dan peran
- admin: akses penuh, mengelola akun teknisi, penugasan, persetujuan usulan,
  arsip/nonaktif, pengaturan, dan melihat riwayat.
- teknisi: login, menambah data baru, mengerjakan tugas yang ditugaskan
  kepadanya, mengusulkan perubahan data master, mencatat absen sendiri, dan
  mencatat mutasi stok (pengadaan/pemakaian).
- Hak lihat data: admin dan teknisi dapat melihat semua data di semua modul.
  Pembatasan teknisi hanya berlaku pada aksi tambah/ubah/arsip sesuai aturan
  modul.
- Pendaftaran publik dimatikan. Akun dibuat oleh admin.
- Akun memiliki field: nama (wajib), peran (admin/teknisi), telepon (opsional),
  dan aktif. Akun dapat dinonaktifkan.
- Petugas nonaktif tidak dapat login. Sebelum atau saat menonaktifkan, admin
  harus menyelesaikan penugasan aktif milik teknisi tersebut: memindahkan
  "ditugaskan ke" (Layanan Gangguan/Pemasangan) dan "teknisi" (Perbaikan) ke
  teknisi aktif lain, atau mengosongkannya (sehingga hanya admin yang dapat
  mengubah sampai ditugaskan ulang).
- Data dan riwayat atas nama teknisi nonaktif tetap tersimpan. Usulan Menunggu
  milik teknisi nonaktif tetap dapat diputuskan admin.
- Kata sandi minimal 5 karakter.

## Aturan perubahan data
- Data master: Pelanggan, Inventaris Perangkat, Inventaris Non Perangkat.
- Data kerja harian: Layanan Gangguan, Perbaikan, Pemasangan, Mutasi Inventaris.
- Data komunikasi: Komentar Tugas, Pesan Langsung, Pengumuman.
- Tambah data baru: teknisi bebas di semua modul sesuai hak modul. Absen
  mengikuti Aturan absen. Penyesuaian stok (Mutasi Inventaris) hanya dapat
  ditambah oleh admin.
- Ubah data master: teknisi mengirim usulan perubahan. Data asli tidak berubah
  sampai admin memutuskan. Admin dapat: Setuju, Tolak, atau Ubah lalu setujui.
  Satu usulan Menunggu per data. Petugas hanya boleh menarik usulannya sendiri
  selama statusnya masih Menunggu.
- Penugasan: hanya admin yang menetapkan atau memindahkan field "ditugaskan ke"
  pada Layanan Gangguan dan Pemasangan. Tidak ada penugasan otomatis.
  Petugas melihat daftar "Tugas saya".
- Ubah data kerja harian: teknisi langsung menyimpan tanpa persetujuan, hanya
  untuk Layanan Gangguan/Pemasangan yang ditugaskan kepadanya, atau Perbaikan
  yang teknisinya dia. Jika "ditugaskan ke" belum diisi, hanya admin yang dapat
  mengubah Layanan Gangguan/Pemasangan. Admin dapat mengubah semuanya.
- Petugas tidak boleh mengubah field penugasan atau teknisi. Hanya admin yang
  boleh menetapkan atau memindahkannya.
- Perbaikan: teknisi otomatis diisi pembuat jika dibuat oleh teknisi. Admin
  dapat menetapkan atau memindahkan teknisi.
- Hapus: hanya admin, dan berupa arsip/nonaktif (data disembunyikan dari daftar
  aktif, tidak hilang, bisa dipulihkan admin).
- Setiap perubahan tercatat di riwayat: siapa, kapan, nilai lama, nilai baru.
  Absen mengikuti Aturan absen, dan semua aksinya (tambah, ubah, arsip,
  pulihkan) tetap tercatat di Riwayat.
- Mutasi Inventaris: teknisi dan admin dapat menambah mutasi Pengadaan dan
  Pemakaian; hanya admin yang dapat menambah Penyesuaian serta mengubah,
  mengarsipkan, atau memulihkan mutasi.

## Aturan hak ubah
| Modul | Tambah | Ubah | Arsip/Pulihkan/Hapus |
| --- | --- | --- | --- |
| Pelanggan | teknisi, admin | teknisi lewat usulan; admin langsung | admin (arsip/pulihkan) |
| Inventaris Perangkat | teknisi, admin | teknisi lewat usulan; admin langsung | admin (arsip/pulihkan) |
| Inventaris Non Perangkat | teknisi, admin | teknisi lewat usulan; admin langsung | admin (arsip/pulihkan) |
| Layanan Gangguan | teknisi, admin | admin; teknisi hanya jika ditugaskan kepadanya (jika belum ditugaskan, hanya admin) | admin (arsip/pulihkan) |
| Perbaikan | teknisi, admin | admin; teknisi jika teknisinya dia | admin (arsip/pulihkan) |
| Pemasangan | teknisi, admin | admin; teknisi hanya jika ditugaskan kepadanya (jika belum ditugaskan, hanya admin) | admin (arsip/pulihkan) |
| Absen Hadir | teknisi (QR/Tugas/Mandiri), admin | admin | admin (arsip/pulihkan) |
| Mutasi Inventaris | teknisi, admin (Pengadaan/Pemakaian); admin (Penyesuaian) | admin | admin (arsip/pulihkan) |
| Komentar Tugas | admin dan teknisi terkait tugas | pengirim (maks. 10 menit sejak dikirim) | pengirim (hapus, maks. 10 menit sejak dikirim) |
| Pesan Langsung | partisipan percakapan (admin/teknisi, 1-lawan-1) | pengirim (maks. 10 menit sejak dikirim) | pengirim (hapus, maks. 10 menit sejak dikirim) |
| Pengumuman | admin | pengirim/admin (maks. 10 menit sejak dikirim) | pengirim/admin (hapus, maks. 10 menit sejak dikirim); admin (arsip/pulihkan) |

## Field umum
Semua koleksi bisnis memiliki:
- diarsipkan (bool, default false) — status nonaktif
- diarsipkan oleh (relasi akun)
- diarsipkan pada (tanggal dan waktu)
- dibuat pada dan diubah pada (bawaan sistem)

Arsip berarti menonaktifkan data (bukan hapus permanen). Data nonaktif
disembunyikan dari daftar aktif dan masuk ke tampilan "Data nonaktif" per
modul; admin dapat memulihkan.

Aturan relasi saat nonaktif:
- Pelanggan nonaktif: tidak dapat dipilih saat membuat Layanan Gangguan,
  Perbaikan, atau Pemasangan baru, dan ditandai "Nonaktif" pada data terkait
  yang sudah ada. Data kerja terkait tetap tersimpan, dapat dilihat, dan tetap
  dapat diproses sesuai hak ubah yang berlaku.
- Inventaris Perangkat/Non Perangkat nonaktif: tidak dapat dipilih untuk
  mutasi, pemasangan, atau pemakaian baru.
- Jika data sasaran Usulan Perubahan dinonaktifkan, usulan berstatus Menunggu
  otomatis menjadi Ditarik.

## Modul dan field
1. Pelanggan
   - nama dan No/WA (wajib)
   - SN perangkat, koneksi, VLAN, teknisi (akun teknisi), dan link Google Maps
     (opsional)
   - keterangan lokasi (misalnya "Gang ketiga") dan foto rumah (opsional).
     Petugas dapat menambahkan atau memperbarui keduanya langsung.
   - Pelanggan nonaktif masuk ke tampilan Data nonaktif.

2. Layanan Gangguan
   - pelanggan (dipilih dari daftar Pelanggan aktif), keluhan
   - status (Baru / Diproses / Selesai)
   - ditugaskan ke (teknisi, diisi admin; boleh kosong)

3. Absen Hadir
   - teknisi, tanggal, jam masuk
   - keterangan (Hadir / Izin / Sakit)
   - alasan (teks; wajib untuk Izin/Sakit, kosong untuk Hadir)
   - metode (QR / Tugas / Admin / Mandiri, otomatis), dicatat oleh (otomatis)

4. Perbaikan
   - gangguan (tautan ke laporan gangguan, opsional), pelanggan
   - jika gangguan dipilih, pelanggan otomatis dari gangguan dan harus sama;
     jika tidak, pelanggan dipilih manual dari Pelanggan aktif
   - tanggal
   - teknisi (otomatis dari akun login jika dibuat teknisi; admin dapat
     menetapkan atau memindahkan)
   - tindakan (deskripsi)
   - status (Belum ditindak / Diproses / Selesai)
   - foto sebelum (opsional), foto sesudah (opsional)

5. Inventaris Perangkat (aset per unit)
   - nama (wajib), tipe (opsional)
   - SN/serial number (opsional, unik jika diisi)
   - kondisi (Baik / Terpasang / Rusak / Nonaktif)
   - lokasi/pemegang (opsional, teks; mis. gudang, nama pelanggan/teknisi)
   - foto perangkat (opsional)
   - keterangan (opsional)
   - Dikelola per unit (satu record per unit). Field `jumlah` tidak diinput
     manual; jumlah per nama/tipe/kondisi ditampilkan sebagai rekap/hasil
     hitungan dari data unit.
   - Pengadaan perangkat = menambah record unit baru (kondisi awal umumnya
     Baik). Pemakaian/pemasangan = mengubah kondisi/lokasi unit. Perangkat
     rusak/dicabut/diperbaiki = mengubah kondisi/lokasi.
   - Barang massal/sejenis tanpa pelacakan individu (mis. adaptor, konektor,
     patch cord yang tidak perlu dilacak satu-satu) dikelola di Inventaris Non
     Perangkat sebagai stok.

6. Inventaris Non Perangkat (stok barang habis pakai/massal)
   - nama barang (wajib)
   - satuan (wajib, mis. meter, pcs, roll)
   - stok (angka, default 0) — jumlah tersedia saat ini, tidak diedit langsung
   - stok minimum (angka, opsional) — batas peringatan stok menipis
   - keterangan (opsional)
   - Stok berubah hanya melalui Mutasi Inventaris dan tidak boleh bernilai
     negatif.

7. Pemasangan
   - pelanggan (dipilih dari daftar Pelanggan aktif), tanggal
   - status (Menunggu / Dikerjakan / Selesai)
   - ditugaskan ke (teknisi, diisi admin; boleh kosong)

8. Mutasi Inventaris (khusus Inventaris Non Perangkat)
   - barang (relasi ke Inventaris Non Perangkat aktif, wajib)
   - jenis (Pengadaan / Pemakaian / Penyesuaian, wajib)
   - jumlah (angka > 0, wajib)
   - stok sebelum (angka, otomatis)
   - stok sesudah (angka, otomatis)
   - tanggal (wajib)
   - referensi modul (opsional: Perbaikan / Pemasangan / -)
   - referensi id (opsional, id record terkait)
   - keterangan (wajib untuk Penyesuaian; opsional untuk Pengadaan/Pemakaian)
   - dicatat oleh (akun, otomatis)

9. Komentar Tugas
   - modul referensi (Layanan Gangguan / Perbaikan / Pemasangan, wajib)
   - referensi id (id tugas terkait, wajib)
   - isi (teks, wajib)
   - foto (opsional)
   - pengirim (akun, otomatis)
   - dibuat pada, diubah pada (bawaan sistem)
   - Komentar menempel pada detail tugas untuk koordinasi (progres, kendala,
     info tambahan).

10. Pesan Langsung
    - percakapan (identitas percakapan 1-lawan-1, wajib)
    - pengirim (akun, otomatis)
    - penerima (akun, wajib)
    - isi (teks, wajib)
    - foto (opsional)
    - dibaca pada (tanggal dan waktu, opsional/kosong jika belum dibaca)
    - dibuat pada, diubah pada (bawaan sistem)
    - Hanya untuk percakapan 1-lawan-1 (admin ↔ teknisi, teknisi ↔ teknisi).

11. Pengumuman
    - judul (wajib)
    - isi (teks, wajib)
    - foto (opsional)
    - pembuat (akun admin, otomatis)
    - diarsipkan/nonaktif (bool, mengikuti field umum) — untuk menyembunyikan
      pengumuman dari daftar aktif
    - dibuat pada, diubah pada (bawaan sistem)

## Koleksi internal
### Usulan Perubahan
- modul, record id
- nilai usulan (hanya field yang berubah)
- status (Menunggu / Disetujui / Ditolak / Ditarik)
- pemohon, peninjau (diisi saat diputuskan)
- alasan tolak (wajib saat Ditolak)
- dibuat, diputuskan (tanggal dan waktu)
- Satu usulan Menunggu per data.
- Hanya pemohon yang boleh menarik usulannya sendiri.
- Admin dapat menyetujui, menolak, atau mengubah nilai usulan lalu menyetujui.
- Jika data sasaran dinonaktifkan, usulan otomatis menjadi Ditarik.
- Jika pemohon dinonaktifkan, admin tetap dapat memutuskan usulan.

### Riwayat
- waktu, aktor, aksi, modul, record id, nilai lama, nilai baru, catatan.
- Aksi: tambah, ubah, arsip, pulihkan, setujui, tolak, tarik.
- Mencakup semua modul, termasuk Absen Hadir dan Mutasi Inventaris. Koreksi
  stok akibat ubah/arsip/pulihkan mutasi juga tercatat.
- Tidak dapat diubah atau dihapus. Hanya admin yang dapat melihat.

### Pengaturan
- kunci, nilai.
- Kunci awal: interval QR (default 30 detik), jam tutup absen (default 23:59
  WITA), interval sinkron Sheets (default 5 menit).
- Hanya admin yang dapat mengubah. Interval QR dan jam tutup absen diatur dari
  halaman QR Absen; interval sinkron Sheets diatur dari halaman Pengaturan.

## Aturan komunikasi

### Komentar Tugas
- Berlaku pada Layanan Gangguan, Perbaikan, dan Pemasangan.
- Hanya **admin** dan **teknisi yang terkait** dengan tugas tersebut yang dapat
  melihat dan mengirim komentar.
  - Layanan Gangguan/Pemasangan: admin dan teknisi pada field "ditugaskan ke".
  - Perbaikan: admin dan teknisi pada field "teknisi".
- Pengirim dapat **mengedit atau menghapus** komentarnya sendiri dalam **10
  menit** sejak dikirim. Setelah batas waktu, komentar tidak dapat diubah atau
  dihapus oleh pengirim.
- Komentar baru memicu notifikasi dalam aplikasi ke pihak terkait lain pada
  tugas yang sama (kecuali pengirim sendiri pada tab yang sama).

### Pesan Langsung
- Komunikasi **1-lawan-1** antara pengguna (admin ↔ teknisi, teknisi ↔ teknisi).
- Pengguna hanya dapat melihat dan mengakses percakapan yang **melibatkannya
  sendiri** (termasuk admin; tidak ada akses audit ke percakapan orang lain).
- Pengirim dapat **mengedit atau menghapus** pesannya sendiri dalam **10 menit**
  sejak dikirim. Setelah batas waktu, pesan tidak dapat diubah atau dihapus oleh
  pengirim.
- Pesan baru memicu notifikasi dalam aplikasi ke penerima.
- Status baca: penerima menandai pesan/percakapan terbaca (field `dibaca pada`)
  secara sederhana; tidak ada indikator "sedang mengetik" atau read-receipt
  detail.

### Pengumuman
- Hanya **admin** yang dapat membuat pengumuman. Semua admin dan teknisi dapat
  membaca pengumuman aktif.
- Pembuat/admin dapat **mengedit atau menghapus** pengumuman dalam **10 menit**
  sejak dibuat. Setelah batas waktu, pengumuman tidak dapat diedit/dihapus,
  tetapi admin dapat **mengarsipkan/memulihkan** (nonaktif) untuk
  menyembunyikan atau menampilkan kembali.
- Pengumuman baru memicu notifikasi dalam aplikasi ke semua teknisi.

### Aturan umum komunikasi
- Isi pesan dapat berupa teks dan **foto opsional** (mengikuti Aturan foto:
  JPG/PNG/WebP, maks. 2 MB, divalidasi di server, tidak disalin ke Sheets).
- Edit/hapus dalam batas waktu dan pengarsipan pengumuman tercatat di Riwayat
  sebagai **metadata saja** (aksi/modul/id/waktu/aktor), tanpa menyimpan isi
  pesan.
- Data Komentar Tugas, Pesan Langsung, dan Pengumuman **tidak** disinkronkan ke
  Google Sheets.
- Daftar komentar, percakapan/pesan, dan pengumuman menggunakan paginasi
  (default 50) dan dimuat bertahap (pesan lama dimuat saat dibutuhkan) agar
  tetap ringan.

## Aturan absen
- Status Hadir dapat tercatat lewat tiga cara: memindai QR kantor, menjalankan
  tugas, atau dicatat admin.
- Izin dan Sakit dapat diinput teknisi sendiri dari mana saja dengan alasan,
  tanpa QR.
- QR: ditampilkan di layar kantor, hanya bisa dibuka admin yang sedang login.
  Token QR ditandatangani server dan hanya berlaku untuk satu absen. QR berganti
  tiap 30 detik (dapat diatur admin), dan layar membuat QR baru setelah ada scan
  berhasil atau interval habis. QR lama tidak berlaku. Petugas harus login, lalu
  memindai QR dengan HP.
- Di bawah QR, admin melihat semua catatan absen aktif pada tanggal hari ini
  menurut WITA, termasuk Hadir, Izin, dan Sakit, beserta jam masuk dan metode.
  Absen terbaru tampil paling atas dan daftar diperbarui otomatis setiap 10
  detik.
- Petugas juga dapat memindai QR dari dalam aplikasi melalui tombol Pindai QR di
  halaman Absen. Fitur ini memerlukan browser yang mendukung BarcodeDetector dan
  konteks aman (HTTPS atau localhost). Bila tidak tersedia, teknisi memindai QR
  dengan kamera HP.
- Tugas: saat teknisi mengubah status Layanan Gangguan atau Pemasangan yang
  ditugaskan kepadanya menjadi Diproses, Dikerjakan, atau Selesai, atau mengubah
  status Perbaikan yang teknisinya dia menjadi Diproses atau Selesai, dan belum
  punya absen pada tanggal itu, sistem mencatat Hadir otomatis. Absen yang sudah
  ada tidak ditimpa.
- Admin dapat mencatat absen atas nama teknisi (misalnya HP teknisi bermasalah):
  pilih teknisi, tanggal, jam masuk, keterangan, dan alasan bila perlu. Dari
  mana saja, tanpa QR.
- Tidak ada pembatasan jaringan atau IP.
- Jam masuk dari server untuk QR, Tugas, dan Mandiri. Admin dapat mengisi atau
  menimpa jam masuk saat mencatat absen.
- Metode: QR, Tugas, Mandiri (Izin/Sakit oleh teknisi), atau Admin.
  Hadir tidak dapat memakai metode Mandiri.
- Dicatat oleh: teknisi sendiri untuk QR, Tugas, dan Mandiri; admin untuk absen
  yang dicatat admin.
- Absen otomatis dan absen admin ditandai lewat field metode dan masuk riwayat.
- Satu absen per teknisi per tanggal untuk semua keterangan, termasuk data yang
  dinonaktifkan. Koreksi oleh admin dilakukan dengan mengubah atau memulihkan
  data, bukan membuat baris baru pada tanggal yang sama.
- Admin dapat mengatur jam tutup absen. Setelah lewat, QR, Tugas, dan Mandiri
  ditolak; admin tetap dapat mencatat atau mengoreksi.
- Semua tanggal dan jam absen memakai Waktu Indonesia Tengah (WITA).

## Aturan mutasi inventaris
- Berlaku untuk Inventaris Non Perangkat. Stok berubah hanya melalui Mutasi
  Inventaris.
- Jenis mutasi:
  - Pengadaan: `stok sesudah = stok sebelum + jumlah`.
  - Pemakaian: `stok sesudah = stok sebelum - jumlah`; ditolak jika jumlah
    melebihi stok tersedia (stok tidak boleh negatif).
  - Penyesuaian: koreksi selisih/opname (tambah atau kurang) dengan keterangan
    wajib, contoh "selisih opname gudang".
- Hak mutasi: teknisi dan admin dapat menambah Pengadaan/Pemakaian; hanya admin
  dapat menambah Penyesuaian serta mengubah, mengarsipkan, atau memulihkan
  mutasi.
- Referensi ke Perbaikan/Pemasangan bersifat opsional. Untuk Pemakaian yang
  terkait pekerjaan, dianjurkan mengisi referensi; jika referensi kosong,
  keterangan sebaiknya diisi (mis. "pemakaian umum", "cadangan teknisi").
- Mutasi disimpan sebagai catatan perubahan stok: jika mutasi diubah,
  diarsipkan, atau dipulihkan oleh admin, stok barang harus diperbarui secara
  konsisten dan aksi tersebut tercatat di Riwayat.
- Barang nonaktif tidak dapat dipilih untuk mutasi baru.

## Aturan foto
- Format JPG, PNG, atau WebP. Maksimal 2 MB per foto.
- Disimpan lewat penyimpanan file bawaan PocketBase.
- Tidak disalin ke Google Sheets.
- Format dan ukuran divalidasi di server.

## Aturan lokasi
- Lokasi pelanggan disimpan sebagai tautan HTTPS Google Maps dan ditampilkan
  sebagai tautan "Buka di Google Maps". Tidak ada peta tertanam.
- Data alamat dan koordinat pelanggan lama dihapus melalui migrasi.

## Sinkron ke Google Sheets
- Satu arah: database ke Sheets. Sheets hanya untuk dilihat dan disalin ke Excel.
- Tahap awal: PocketBase mengirim snapshot penuh terjadwal ke webhook Apps
  Script, default tiap 5 menit. Apps Script menimpa isi tiap tab.
- Admin dapat mengubah interval sinkron antara 1 dan 1440 menit. Perubahan
  berlaku tanpa perlu memulai ulang server.
- URL dan token webhook hanya dari environment: SHEETS_WEBHOOK_URL dan
  SHEETS_WEBHOOK_TOKEN, dikirim sebagai header Authorization Bearer.
- Satu tab per modul bisnis: pelanggan, layanan_gangguan, absen_hadir,
  perbaikan, inventaris_perangkat, inventaris_non_perangkat, pemasangan, dan
  mutasi_inventaris. Koleksi internal (selain data yang relevan), foto, data
  nonaktif, serta data komunikasi (Komentar Tugas, Pesan Langsung, Pengumuman)
  tidak ikut disalin.
- Relasi dikirim sebagai nama yang ditampilkan, bukan id.
- Payload webhook: `{"modules":[{"koleksi","nama","headers","rows"}]}`. `rows`
  berisi array nilai sesuai urutan `headers`. Apps Script menimpa tab bernama
  `nama` dengan `headers` dan `rows`.
- Tanggal dikirim sebagai `YYYY-MM-DD` dan tanggal-jam sebagai
  `YYYY-MM-DD HH:mm` dalam WITA.
- Webhook per record ditunda ke tahap berikutnya.
- Sheets dibagikan hanya ke email tertentu sebagai Viewer, bukan lewat tautan
  umum.
- Kegagalan sinkron dicatat di log tanpa data pribadi pelanggan. Bila URL atau
  token belum diatur, sinkron dilewati dan peringatan dicatat sekali.

## Fitur umum
- Pencarian dan filter di setiap modul:
  - Pelanggan: nama, No/WA, SN, koneksi, VLAN, teknisi, keterangan lokasi
  - Layanan Gangguan: pelanggan, keluhan, status, teknisi
  - Absen Hadir: teknisi, tanggal, keterangan, metode
  - Perbaikan: pelanggan, tindakan, status, teknisi, tanggal
  - Inventaris Perangkat: nama, tipe, SN/serial number, kondisi, lokasi/pemegang
  - Inventaris Non Perangkat: nama barang, keterangan, satuan (tampilkan
    indikator "stok menipis" jika stok <= stok minimum)
  - Pemasangan: pelanggan, status, teknisi, tanggal
  - Mutasi Inventaris: barang, jenis, tanggal, referensi, dicatat oleh
  - Komentar Tugas: isi, pengirim, tanggal (dalam konteks tugas terkait)
  - Pesan Langsung: nama partisipan/lawan bicara, isi, tanggal
  - Pengumuman: judul, isi, tanggal, status aktif/nonaktif
- Daftar "Tugas saya" untuk teknisi: Gangguan/Pemasangan yang ditugaskan
  kepadanya dan Perbaikan yang teknisinya dia.
- Tampilan nyaman di HP.
- Paginasi default 50 baris.
- Backup rutin database dan foto: harian, retensi 7 harian dan 4 mingguan,
  disimpan juga di luar server.
- Keamanan: HTTPS, kata sandi minimum 5 karakter, pendaftaran publik
  dimatikan.

## Notifikasi dalam aplikasi
- Notifikasi hanya tampilan frontend; tidak ada koleksi, tabel, atau field baru.
- Dikirim real-time saat data berubah:
  - Petugas: tugas baru yang ditugaskan kepadanya, tugas yang dialihkan
    kepadanya, dan perubahan status tugasnya.
  - Admin: semua penambahan dan perubahan pada Layanan Gangguan, Pemasangan,
    Perbaikan, dan Usulan Perubahan.
  - Komentar Tugas: komentar baru ke pihak terkait lain pada tugas tersebut
    (admin dan teknisi ditugaskan/teknisi), kecuali pengirim.
  - Pesan Langsung: pesan baru ke penerima.
  - Pengumuman: pengumuman baru ke semua teknisi.
- Absen dan tambah/ubah data master (Pelanggan, Inventaris Perangkat, Inventaris
  Non Perangkat, Mutasi Inventaris) sengaja tidak memicu notifikasi.
- Bentuk: pesan singkat (toast) di dalam aplikasi, serta notifikasi browser
  opsional yang diaktifkan pengguna lewat tombol di topbar.
- Notifikasi browser hanya muncul saat tab tidak aktif dan dapat diklik untuk
  membuka detail data.
- Isi notifikasi tidak memuat data pribadi pelanggan dan tidak memuat isi pesan;
  hanya konteks singkat (modul/sumber, pengirim/judul singkat, atau "komentar
  baru"/"pesan baru"/"pengumuman baru").
- Perubahan yang dilakukan pengguna sendiri di tab yang sama tidak
  dinotifikasikan.
- Bila real-time tidak tersedia, pemeriksaan berkala 30 detik menjadi cadangan.

## Catatan teknis
- Backend PocketBase, logika server di pb_hooks/, skema lewat pb_migrations/.
- Frontend HTML/CSS/JS biasa.
- Waktu disimpan dalam UTC dan ditampilkan dalam WITA.
- Rahasia hanya dari environment: SHEETS_WEBHOOK_URL, SHEETS_WEBHOOK_TOKEN,
  dan QR_SECRET. Sediakan .env.example tanpa nilai asli.
- Logika penting wajib punya test otomatis dan memakai try/catch dengan log
  informatif tanpa data pribadi pelanggan.
