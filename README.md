# Malahotspot

Aplikasi admin layanan RT/RW Net Malahotspot: pelanggan, gangguan, pemasangan,
perbaikan, absen teknisi, inventaris, mutasi stok, komunikasi internal, serta
sinkron satu arah ke Google Sheets.

Backend dan database memakai **PocketBase**; frontend berupa HTML/CSS/JS biasa
tanpa build step.

## Status fitur

Sudah berjalan dan diuji:

- Login admin/teknisi, akun nonaktif tidak bisa login, password minimal 8
  (batas minimum PocketBase 0.40+).
- Admin aplikasi dapat mengubah nama, email, telepon, peran, status aktif, dan
  password akun dari menu **Akun**, tanpa login sebagai superuser PocketBase.
- Peran dan hak akses per modul, arsip/pulihkan, serta Riwayat audit.
- Tugas saya, penugasan admin, komentar tugas, pesan langsung, pengumuman.
- Mutasi inventaris (Pengadaan/Pemakaian/Penyesuaian) dengan stok konsisten:
  stok awal 0, hanya berubah lewat mutasi, dan perubahan yang membuat stok
  negatif di titik mana pun ditolak. Penyesuaian memakai **selisih**, bukan
  stok akhir.
- Material tugas otomatis mengurangi stok saat tugas Selesai, sekali saja;
  baris material duplikat dijumlahkan lebih dulu.
- Perangkat tugas otomatis menjadi `Terpasang` beserta lokasi pelanggan; SN
  perangkat unik dan perangkat yang sudah terpasang di pelanggan lain ditolak.
- Absen lewat QR, tugas, dan mandiri; waktu ditampilkan dalam WITA.
- Validasi foto (JPG/PNG/WebP, maks. 2 MB) di server.
- Sinkron arsip database ke Google Sheets secara terjadwal/manual; baris lama
  di spreadsheet tidak dihapus saat data web hilang.

## Struktur

- `pb_migrations/` — skema koleksi, perbaikan skema, dan seed admin awal.
- `pb_hooks/` — aturan bisnis, riwayat, mutasi stok, QR, komunikasi, sinkron
  Sheets.
  - `pb_hooks/lib/` — helper yang di-`require` di dalam callback hook.
- `pb_public/` — frontend web (`index.html`, `css/app.css`, `js/app.js`).
- `docs/apps-script-sheets.gs` — kode Google Apps Script penerima webhook.
- `pb_tests/` — test logika yang dijalankan dengan Node.js.
- `spec.md` — spesifikasi aplikasi.
- `.env.example` — contoh variabel rahasia (jangan commit `.env`).

## Prasyarat

- Binary [PocketBase](https://pocketbase.io/) yang mendukung JS migrations dan
  hooks.
- Node.js (hanya untuk menjalankan test).
- Browser modern.

## Menjalankan

1. Siapkan environment:

   ```bash
   cp .env.example .env
   ```

   Isi minimal `QR_SECRET` dengan nilai acak. `SHEETS_WEBHOOK_URL` dan
   `SHEETS_WEBHOOK_TOKEN` diisi bila ingin mengaktifkan sinkron Sheets.

2. Muat environment lalu jalankan PocketBase:

   ```bash
   set -a
   source .env
   set +a
   ./pocketbase serve --dir ./pb_data --publicDir ./pb_public \
     --migrationsDir ./pb_migrations --hooksDir ./pb_hooks
   ```

   Migrasi dijalankan otomatis saat start.

3. Buat superuser PocketBase untuk membuka dashboard `/_/`:

   ```bash
   ./pocketbase superuser upsert admin@example.com 'password-kuat'
   ```

4. Buka `http://127.0.0.1:8090/` dan login dengan akun aplikasi.

   Migrasi seed membuat akun pengembangan:

   ```text
   admin@local.test / admin123
   ```

   **Ganti atau nonaktifkan akun ini sebelum produksi.**

## Sinkron ke Google Sheets

Sinkron bersifat **satu arah: PocketBase → Google Sheets**. Sheets hanya untuk
dilihat/disalin ke Excel; perubahan di Sheets tidak dikirim balik.

Spreadsheet berfungsi sebagai **salinan arsip**. Baris yang sudah pernah masuk
tidak dihapus ketika data di web dihapus, diarsipkan, atau database web
bermasalah. Sinkron mencocokkan baris berdasarkan kolom `id`: data berubah
diperbarui, data baru ditambahkan, dan data lama tetap disimpan.

### 1. Siapkan Apps Script

1. Buka spreadsheet tujuan, lalu **Ekstensi → Apps Script**.
2. Salin seluruh isi `docs/apps-script-sheets.gs` ke `Code.gs`.
3. Buka **Project Settings → Script Properties**, tambahkan:

   | Property | Nilai |
   | --- | --- |
   | `TOKEN` | sama dengan `SHEETS_WEBHOOK_TOKEN` di `.env` |
   | `SPREADSHEET_ID` | ID spreadsheet, bagian antara `/d/` dan `/edit` pada URL |

4. **Deploy → Manage deployments → Edit (pensil) → Version: New version →
   Deploy**. Jangan memakai “New deployment” bila URL `/exec` sudah dipakai,
   karena URL-nya akan berubah. Versi baru ini wajib dipakai agar baris lama
   tidak terhapus saat data web kosong.
5. Pastikan deployment memakai **Execute as: Me** dan **Who has access:
   Anyone**.

Setelah deploy, tab lama akan otomatis mendapat kolom `id` di paling kanan.
Jangan menghapus atau mengubah kolom `id`; kolom itu dipakai untuk mencocokkan
baris. Kolom tambahan buatan Anda tetap dipertahankan.

### 2. Arahkan server ke deployment

Isi `.env`:

```bash
SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
SHEETS_WEBHOOK_TOKEN=token-yang-sama-dengan-Script-Property-TOKEN
```

Muat ulang environment dan restart PocketBase. Server mengirim body:

```json
{"token":"...","retention":true,"modules":[{"koleksi":"...","nama":"...","headers":[],"rows":[]}]}
```

Token juga dikirim di header `Authorization: Bearer ...`. Kolom terakhir setiap
`headers` adalah `id`.

### 3. Tes dan jadwal

- Manual (admin): `POST /api/sheets/sync`.
- Balasan sukses saat ada data:
  `{"ok":true,"status":200,"modules":8,"updated":...,"appended":...,"retained":true}`.
- Balasan saat semua modul kosong:
  `{"ok":true,"skipped":true,"message":"Tidak ada data untuk dikirim..."}`.
  Spreadsheet tidak diubah.
- Tab yang ditulis: `pelanggan`, `layanan_gangguan`, `absen_hadir`,
  `perbaikan`, `inventaris_perangkat`, `inventaris_non_perangkat`,
  `pemasangan`, `mutasi_inventaris`. Tab baru dibuat saat modulnya memiliki
  data.
- Sinkron tidak menimpa seluruh tab. Baris dicocokkan berdasarkan `id`, data
  yang berubah diperbarui, data baru ditambahkan, dan baris lama tidak dihapus.
- Modul yang kosong tidak dikirim. Jika seluruh data web hilang, spreadsheet
  tetap berisi data terakhir.
- Interval diatur di koleksi `pengaturan` dengan kunci
  `interval_sinkron_sheets` (1–1440 menit, default 5). Perubahan langsung
  berlaku tanpa restart.
- Waktu sinkron terakhir disimpan di `pengaturan` dengan kunci
  `sheets_last_sync`.
- Relasi dikirim sebagai nama, tanggal dalam format WITA.

Jika balasan manual berisi `warning` bahwa Apps Script masih versi lama,
segera lakukan **Deploy → Manage deployments → Edit → New version** pada
Apps Script. Tanpa redeploy, baris yang dihapus di web masih bisa hilang dari
spreadsheet.

Jika balasan bukan JSON atau berisi `Token tidak cocok`, periksa kembali
Script Properties, versi deployment, akses “Anyone”, dan URL yang berakhiran
`/exec`.

## Aturan inventaris

**Stok barang non perangkat**

1. Buat barang dengan stok **0**. Stok awal tidak boleh diisi langsung.
2. Tambah stok lewat **Mutasi Inventaris → Pengadaan**.
3. Kurangi stok lewat **Pemakaian**. Sistem menolak jika stok tidak cukup.
4. Untuk koreksi opname, pilih **Penyesuaian** dan isi **selisih**, bukan stok
   akhir. Contoh: stok sistem 10, hasil hitung 8 → pilih `Kurang` dan isi `2`.
5. Stok sebelum/sesudah dihitung otomatis secara kronologis. Jika menghapus
   atau mengarsipkan Pengadaan membuat Pemakaian setelahnya negatif, aksi
   ditolak. Batalkan/ubah Pemakaian terlebih dahulu, baru Pengadaan.

Stok tidak bisa diubah dari form data master. Perubahan langsung ditolak agar
tidak terjadi selisih antara stok dan riwayat mutasi.

**Material tugas**

- Material pada Perbaikan/Pemasangan divalidasi sebagai total per barang. Dua
  baris 6 + 6 dengan stok 10 ditolak karena totalnya 12.
- Pemakaian dicatat otomatis saat status menjadi **Selesai**, sekali saja.
  Edit tugas setelahnya tidak mengurangi stok lagi.
- Tugas Selesai tanpa material tidak dikunci. Material bisa ditambahkan
  kemudian dan akan dicatat saat disimpan.
- Tanggal tugas ikut urutan stok. Material bertanggal mundur yang memakai stok
  yang belum ada pada tanggal itu ditolak.
- Jika pencatatan material gagal, seluruh mutasi material dibatalkan dan tanda
  `material_tercatat` tidak diset.

**Perangkat tugas**

- SN perangkat opsional, tetapi jika diisi harus unik (spasi dirapikan dan
  huruf besar/kecil dianggap sama).
- Saat tugas Selesai, perangkat terpilih menjadi `Terpasang` di lokasi
  pelanggan. Perangkat yang sudah terpasang di pelanggan lain ditolak.
- Perangkat `Nonaktif`/diarsipkan tidak dapat dipilih; perangkat `Rusak` tidak
  dapat dipilih untuk Pemasangan.
- Jika data lama sudah memiliki SN duplikat, migrasi index unik dilewati agar
  server tetap bisa start. Rapikan SN duplikat lewat menu Inventaris Perangkat;
  hook tetap mencegah duplikat baru.

## Test

Jalankan semua test logika:

```bash
for f in pb_tests/*.js; do node "$f" || exit 1; done
```

Uji migrasi dari database kosong:

```bash
rm -rf /tmp/pb_fresh && mkdir -p /tmp/pb_fresh
./pocketbase migrate up --dir /tmp/pb_fresh --migrationsDir ./pb_migrations
./pocketbase serve --dir /tmp/pb_fresh --publicDir ./pb_public \
  --migrationsDir ./pb_migrations --hooksDir ./pb_hooks --http 127.0.0.1:8091
```

Login `admin@local.test / admin123` harus berhasil pada database baru.

## Backup

```bash
./backup.sh [direktori-backup]
```

Default menyimpan ke `./backups` dengan retensi 7 backup harian dan 4
mingguan. Simpan juga salinan di luar server, misalnya:

```cron
0 2 * * * /path/to/inv-malahotspot/backup.sh /mnt/backup/inv-malahotspot
```

## Catatan produksi

- Ganti password admin bawaan dan buat superuser PocketBase yang kuat.
- Pakai HTTPS (reverse proxy) dan batasi akses dashboard `/_/`.
- Jaga `.env` tetap privat; token Sheets hanya ada di environment server dan
  Script Properties.
- Bagikan spreadsheet hanya ke email tertentu sebagai Viewer.
- Uji restore backup sebelum go-live.
