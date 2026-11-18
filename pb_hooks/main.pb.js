/// <reference path="../pb_data/types.d.ts" />

// Generic history for non-riwayat collections (best-effort)
onRecordAfterCreateSuccess((e) => {
  const col = e.record.collection().name;
  const skipHistory = col === 'riwayat' || String(col).startsWith('_') ||
    (col === 'pengaturan' && e.record.getString('kunci') === 'sheets_last_sync');
  if (!skipHistory) {
    try {
      let nv = null; try { nv = JSON.parse(JSON.stringify(e.record)); } catch (_) { nv = {}; }
      try {
        const hcol = e.app.findCollectionByNameOrId('riwayat');
        const r = new Record(hcol);
        r.set('waktu', new Date().toISOString());
        r.set('aktor', e.auth ? e.auth.id : '');
        r.set('aksi', 'tambah');
        r.set('modul', col);
        r.set('record_id', e.record.id || '');
        r.set('nilai_lama', null);
        r.set('nilai_baru', nv);
        r.set('catatan', '');
        e.app.save(r);
      } catch (err) { console.log('[riwayat] gagal create', col, String(err)); }
    } catch (err) { console.log('[hook create]', String(err)); }
  }
  e.next();
});

onRecordAfterUpdateSuccess((e) => {
  const col = e.record.collection().name;
  const skipHistory = col === 'riwayat' || String(col).startsWith('_') ||
    (col === 'pengaturan' && e.record.getString('kunci') === 'sheets_last_sync');
  if (!skipHistory) {
    try {
      let aksi = 'ubah';
      try {
        const oldA = !!e.record.original().getBool('diarsipkan');
        const newA = !!e.record.getBool('diarsipkan');
        if (oldA !== newA) aksi = newA ? 'arsip' : 'pulihkan';
      } catch (_) {}
      let ov = null, nv = null;
      try { ov = JSON.parse(JSON.stringify(e.record.original())); } catch (_) {}
      try { nv = JSON.parse(JSON.stringify(e.record)); } catch (_) { nv = {}; }
      try {
        const hcol = e.app.findCollectionByNameOrId('riwayat');
        const r = new Record(hcol);
        r.set('waktu', new Date().toISOString());
        r.set('aktor', e.auth ? e.auth.id : '');
        r.set('aksi', aksi);
        r.set('modul', col);
        r.set('record_id', e.record.id || '');
        r.set('nilai_lama', ov);
        r.set('nilai_baru', nv);
        r.set('catatan', '');
        e.app.save(r);
      } catch (err) { console.log('[riwayat] gagal update', col, String(err)); }
    } catch (err) { console.log('[hook update]', String(err)); }
  }
  e.next();
});

// Inventory mutation: apply stock changes on create (and validate)
onRecordCreateRequest((e) => {
  try {
    if (e.collection && e.collection.name === 'mutasi_inventaris') {
      const jenis = e.record.getString('jenis');
      const jumlah = Number(e.record.getFloat('jumlah') || 0);
      if (!(jumlah > 0)) throw new BadRequestError('Jumlah mutasi harus > 0');
      if (['Pengadaan', 'Pemakaian', 'Penyesuaian'].indexOf(jenis) === -1) {
        throw new BadRequestError('Jenis mutasi tidak dikenal');
      }
      const role = e.auth ? e.auth.getString('role') : '';
      if (jenis === 'Penyesuaian' && role !== 'admin') throw new ForbiddenError('Penyesuaian stok hanya oleh admin');
      if (jenis === 'Penyesuaian' && !String(e.record.getString('keterangan') || '').trim()) throw new BadRequestError('Keterangan wajib untuk penyesuaian');
      if (jenis === 'Penyesuaian') {
        const arah = String(e.record.getString('arah_penyesuaian') || '').trim();
        if (arah !== 'Tambah' && arah !== 'Kurang') throw new BadRequestError('Arah penyesuaian wajib dipilih (Tambah/Kurang)');
      } else {
        e.record.set('arah_penyesuaian', '');
      }
      const barangId = e.record.getString('barang');
      if (!barangId) throw new BadRequestError('Barang wajib dipilih');
      const barang = e.app.findRecordById('inventaris_non_perangkat', barangId);
      if (barang.getBool('diarsipkan')) throw new BadRequestError('Barang nonaktif tidak dapat dimutasi');
      if (e.auth) e.record.set('dicatat_oleh', e.auth.id);

      // Simulasikan seluruh riwayat (termasuk tanggal mundur). Jika ada
      // langkah yang membuat stok negatif, mutasi ditolak sebelum disimpan.
      const { validateMutationSave } = require(__hooks + '/lib/mutasi.js');
      const hasil = validateMutationSave(e.app, e.record, null, 'create');
      if (hasil && hasil.candidate) {
        e.record.set('stok_sebelum', hasil.candidate.before);
        e.record.set('stok_sesudah', hasil.candidate.after);
      }
    }
    if (e.collection && e.collection.name === 'inventaris_perangkat') {
      const { validateDeviceSN } = require(__hooks + '/lib/inventory.js');
      validateDeviceSN(e.app, e.record);
    }
    if (e.collection && e.collection.name === 'inventaris_non_perangkat') {
      const { validateOpeningStock, validateStockItem, validateStockItemName } = require(__hooks + '/lib/inventory.js');
      validateOpeningStock(e.record);
      validateStockItem(e.record);
      validateStockItemName(e.app, e.record);
    }
    if (e.collection && e.collection.name === 'perbaikan') {
      if (e.auth && e.auth.getString('role') === 'teknisi' && !e.record.getString('teknisi')) {
        e.record.set('teknisi', e.auth.id);
      }
    }
  } catch (err) {
    if (err && (err instanceof BadRequestError || err instanceof ForbiddenError)) throw err;
    console.log('[create hook]', String(err));
  }
  e.next();
});

onRecordAfterCreateSuccess((e) => {
  try {
    if (e.record.collection().name === 'mutasi_inventaris') {
      const barangId = e.record.getString('barang');
      const { recomputeStock } = require(__hooks + '/lib/mutasi.js');
      recomputeStock(e.app, barangId);
    }
  } catch (err) {
    console.log('[mutasi after create]', String(err));
    // Cadangan: setidaknya stok akhir tetap sesuai mutasi yang baru dibuat.
    try {
      const barangId = e.record.getString('barang');
      const barang = e.app.findRecordById('inventaris_non_perangkat', barangId);
      const sesudah = Number(e.record.getFloat('stok_sesudah') || 0);
      if (Number(barang.getFloat('stok') || 0) !== sesudah) {
        barang.set('stok', sesudah);
        e.app.save(barang);
      }
    } catch (e2) { console.log('[mutasi after create fallback]', String(e2)); }
  }
  e.next();
});

onRecordUpdateRequest((e) => {
  try {
    if (e.collection && e.collection.name === 'inventaris_non_perangkat') {
      const oldStok = e.record.original().getFloat('stok');
      const newStok = e.record.getFloat('stok');
      if (oldStok !== newStok) {
        throw new BadRequestError('Stok hanya berubah melalui Mutasi Inventaris');
      }
      const { validateStockItem, validateStockItemName } = require(__hooks + '/lib/inventory.js');
      validateStockItem(e.record);
      validateStockItemName(e.app, e.record);
    }
    if (e.collection && e.collection.name === 'inventaris_perangkat') {
      const { validateDeviceSN } = require(__hooks + '/lib/inventory.js');
      validateDeviceSN(e.app, e.record);
    }
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[update hook]', String(err));
  }
  e.next();
});

// Auto attendance on task status progress (best-effort)
onRecordAfterUpdateSuccess((e) => {
  try {
    const col = e.record.collection().name;
    const auth = e.auth;
    const progressed = { layanan_gangguan: ['Diproses', 'Selesai'], pemasangan: ['Dikerjakan', 'Selesai'], perbaikan: ['Diproses', 'Selesai'] };
    if (auth && progressed[col]) {
      const oldS = e.record.original().getString('status');
      const newS = e.record.getString('status');
      if (oldS !== newS && progressed[col].indexOf(newS) !== -1) {
        let eligible = false;
        if (col === 'perbaikan') eligible = e.record.getString('teknisi') === auth.id;
        else eligible = e.record.getString('ditugaskan_ke') === auth.id;
        if (eligible) {
          const wita = new Date(Date.now() + 8 * 3600 * 1000);
          const y = wita.getUTCFullYear(), m = String(wita.getUTCMonth() + 1).padStart(2, '0'), d = String(wita.getUTCDate()).padStart(2, '0');
          const day = `${y}-${m}-${d}`;
          const existing = e.app.findRecordsByFilter('absen_hadir', `teknisi = "${auth.id}" && tanggal >= "${day} 00:00:00" && tanggal <= "${day} 23:59:59"`, '', 1, 0);
          if (!(existing && existing.length)) {
            const ac = e.app.findCollectionByNameOrId('absen_hadir');
            const r = new Record(ac);
            r.set('teknisi', auth.id); r.set('tanggal', day + ' 00:00:00'); r.set('jam_masuk', new Date().toISOString());
            r.set('keterangan', 'Hadir'); r.set('metode', 'Tugas'); r.set('dicatat_oleh', auth.id);
            e.app.save(r);
          }
        }
      }
    }
  } catch (err) { console.log('[auto absen]', String(err)); }
  e.next();
});

routerAdd('GET', '/api/app/ping', (e) => e.json(200, { ok: true, time: new Date().toISOString() }));
