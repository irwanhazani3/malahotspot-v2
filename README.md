# RT/RW Net Admin (PocketBase)

Implementasi awal aplikasi admin RT/RW Net berdasarkan `spec.md`, menggunakan **PocketBase** (backend + auth + database + realtime) dan frontend **HTML/CSS/JS** biasa.

## Struktur
- `pb_migrations/` — skema koleksi dan field (migrasi PocketBase JS).
- `pb_hooks/` — logika server: riwayat, mutasi stok inventaris, auto-absen dari progres tugas, endpoint utilitas.
- `pb_public/` — frontend web (dimuat sebagai public dir PocketBase).
  - `index.html`, `css/app.css`, `js/pb.js` (mini client), `js/app.js`.
- `spec.md` — spesifikasi aplikasi.
- `.env.example` — contoh variabel rahasia.

## Prasyarat
- [PocketBase](https://pocketbase.io/) binary (disarankan versi terbaru yang mendukung JS migrations/hooks).
- Browser modern.

## Menjalankan (pengembangan)
1. Salin env contoh dan isi rahasia seperlunya:
   ```bash
   cp .env.example .env
   # isi QR_SECRET, dan opsional SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_TOKEN
   ```
   Muat env ke shell Anda, atau ekspor variabel sebelum menjalankan PocketBase.

2. Jalankan PocketBase dengan direktori project ini:
   ```bash
   ./pocketbase serve --dir ./pb_data --publicDir ./pb_public --migrationsDir ./pb_migrations --hooksDir ./pb_hooks
   ```
   PocketBase akan menjalankan migrasi di `pb_migrations/` saat start.

3. Buka Admin UI PocketBase (mis. `http://127.0.0.1:8090/_/`) untuk:
   - membuat akun admin PocketBase (superuser) jika pertama kali,
   - mengatur field auth `users` jika perlu dan membuat user aplikasi dengan field: `nama`, `role` (`admin`/`teknisi`), `telepon`, `aktif`, email & password (min 5 karakter),
   - menyesuaikan API rules lanjutan sesuai kebutuhan operasional.

4. Akses aplikasi: `http://127.0.0.1:8090/` dan login dengan user aplikasi (koleksi `users`).

## Yang sudah diimplementasikan (fondasi)
- Migrasi koleksi utama: `users` (field tambahan), pelanggan, gangguan, perbaikan, pemasangan, absen, inventaris perangkat/non-perangkat, mutasi inventaris, usulan perubahan, riwayat, pengaturan, komentar tugas, pesan langsung, pengumuman.
- Hook: pencatatan **riwayat** (tambah/ubah/arsip/pulihkan) best-effort, validasi & penerapan **mutasi inventaris** (stok sebelum/sesudah, tolak stok negatif, penyesuaian admin-only), cegah edit stok langsung, auto-isi teknisi perbaikan (teknisi), **auto-absen Hadir (Tugas)** saat progres status tugas terkait.
- Frontend: login, dashboard, daftar tugas saya, daftar/detail/tambah/ubah dasar per modul, arsip/pulihkan (admin), tampilan indikator stok menipis.
- Aturan komunikasi, QR absen, sinkron Google Sheets, usulan perubahan end-to-end, validasi hak akses rinci, dan notifikasi realtime penuh masih perlu penyelesaian/pengujian lebih lanjut sesuai `spec.md`.

## Catatan penting
- Spec: waktu simpan UTC, tampilkan WITA; rahasia hanya dari environment.
- Sebelum produksi: lengkapi API rules/hook enforcement per peran & modul, validasi foto (format/ukuran), alur QR bertanda tangan + jam tutup, alur usulan, sinkron Sheets terjadwal, backup, HTTPS, dan test otomatis.
- `server.js` dan `index.html` di root adalah sisa prototipe lama (tidak dipakai oleh setup PocketBase).

## Update implementasi lanjutan
- Hook tambahan: `pb_hooks/qr.pb.js` (generate/verify token QR, scan absen, absen hari ini), `pb_hooks/sheets.pb.js` (sinkron snapshot terjadwal/manual ke webhook Sheets), `pb_hooks/communication.pb.js` (aturan dasar komentar/pesan/pengumuman, batas edit/hapus 10 menit, riwayat metadata), `pb_hooks/proposal.pb.js` (buat usulan, endpoint setujui/tolak/ubah-setujui/tarik), `pb_hooks/business_rules.pb.js` (usulan ditarik otomatis saat data master diarsipkan, tolak referensi pelanggan/barang nonaktif).
- Frontend diperluas: halaman QR Absen (admin: generate token & daftar absen hari ini; teknisi: scan QR via BarcodeDetector & input Izin/Sakit), Pengumuman (buat/arsip), Pesan Langsung 1-lawan-1, detail tugas dengan komentar, tampilan waktu WITA, form modul yang lebih lengkap.
- Test dasar: `pb_tests/inventory_logic.test.js`, `pb_tests/wita_format.test.js` (jalankan dengan `node`).

## Backup
- Script: `./backup.sh [backup_dir]` (default `./backups`), membuat arsip `pb_data` harian/mingguan.
- Retensi bawaan: 7 backup harian, 4 mingguan. Simpan juga salinan di luar server sesuai kebutuhan.
- Contoh cron harian: `0 2 * * * /path/to/inv-malahotspot/backup.sh /mnt/backup/inv-malahotspot`

## Catatan penyelesaian
Beberapa bagian spec masih memerlukan penyempurnaan sesuai lingkungan PocketBase/produksi: enforcement permission penuh setara matriks di semua edge case, UI relasi (pilihan nama bukan ID), upload & validasi foto di form, QR sebagai gambar + rotasi/realtime penuh, penandaan dibaca pesan, deduplikasi token QR sekali-pakai persisten, tampilan "Data nonaktif" konsisten semua modul, sinkron Sheets (nama relasi ter-resolve), notifikasi realtime browser + fallback polling 30 detik, dan hardening/backup/HTTPS. Fondasi kode dan alur utama sudah tersedia untuk dilanjutkan.
