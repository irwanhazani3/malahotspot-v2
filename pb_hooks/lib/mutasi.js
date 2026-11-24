// Modul stok & mutasi — di-require DI DALAM callback hook.
//
// Aturan utama:
// - Stok barang dihitung dari 0 dan hanya berasal dari mutasi aktif.
// - Setiap perubahan (tambah/ubah/arsip/pulihkan/hapus) disimulasikan dulu.
//   Jika ada langkah yang membuat stok negatif, perubahan DITOLAK.
// - Recompute tidak pernah membulatkan stok negatif menjadi 0.

const _recomputing = {};

function toNumber(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function deltaOfValues(jenis, jumlah, arah, keterangan) {
  const n = toNumber(jumlah);
  if (!(n > 0)) return 0;
  if (jenis === 'Pengadaan') return n;
  if (jenis === 'Pemakaian') return -n;
  if (jenis === 'Penyesuaian') {
    const a = String(arah || '').trim();
    if (a === 'Kurang') return -n;
    if (a === 'Tambah') return n;
    // Kompatibilitas data lama sebelum field arah_penyesuaian ada.
    const k = String(keterangan || '').toLowerCase();
    if (k.includes('kurang') || k.includes('minus') || k.includes('turun') || k.trim().startsWith('-')) return -n;
    return n;
  }
  return 0;
}

function deltaOf(rec) {
  return deltaOfValues(
    rec.getString('jenis'),
    rec.getFloat('jumlah'),
    rec.getString('arah_penyesuaian'),
    rec.getString('keterangan')
  );
}

function viewOf(rec, fallbackCreated) {
  return {
    ref: rec,
    id: rec.id || '__baru__',
    barang: rec.getString('barang') || '',
    jenis: rec.getString('jenis') || '',
    jumlah: toNumber(rec.getFloat('jumlah')),
    arah: rec.getString('arah_penyesuaian') || '',
    keterangan: rec.getString('keterangan') || '',
    tanggal: String(rec.getString('tanggal') || ''),
    dibuat: String(rec.getString('dibuat_pada') || rec.getString('created') || fallbackCreated || ''),
    diarsipkan: !!rec.getBool('diarsipkan')
  };
}

function sortViews(list) {
  return list.slice().sort(function (a, b) {
    if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
    if (a.dibuat !== b.dibuat) return a.dibuat < b.dibuat ? -1 : 1;
    return String(a.id).localeCompare(String(b.id));
  });
}

function activeViews(app, barangId) {
  let recs = [];
  try {
    recs = app.findRecordsByFilter(
      'mutasi_inventaris',
      'barang = "' + String(barangId).replace(/"/g, '\\"') + '"',
      '',
      5000,
      0
    );
  } catch (e) {
    console.log('[mutasi] gagal membaca riwayat', String(e));
    throw e;
  }
  return (recs || []).map(function (r) { return viewOf(r); })
    .filter(function (v) { return !v.diarsipkan; });
}

function itemName(app, barangId) {
  try {
    const b = app.findRecordById('inventaris_non_perangkat', barangId);
    return b.getString('nama_barang') || b.id || barangId;
  } catch (e) {
    return barangId;
  }
}

function simulate(views, nama) {
  let stok = 0;
  const pairs = {};
  for (const v of views) {
    const before = stok;
    stok += deltaOfValues(v.jenis, v.jumlah, v.arah, v.keterangan);
    if (stok < 0) {
      const tgl = String(v.tanggal || '').slice(0, 10);
      const tglInfo = tgl ? (' tanggal ' + tgl) : '';
      const idInfo = (v.id && v.id !== '__baru__' && v.id !== '__rencana__') ? (' [id:' + v.id + ']') : '';
      throw new BadRequestError(
        'Stok ' + (nama || 'barang') + ' akan negatif pada mutasi ' +
        (v.jenis || '-') + ' ' + v.jumlah + tglInfo + idInfo + '. Periksa tanggal dan riwayat mutasi.'
      );
    }
    pairs[v.id] = { before: before, after: stok };
  }
  return { stok: stok, pairs: pairs };
}

/**
 * Validasi calon mutasi tanpa menulis apa pun.
 * mode: create | update | delete
 * Return { candidate: {before, after}, stocks: {barangId: stok} }.
 */
function validateMutationSave(app, record, original, mode) {
  const candidate = viewOf(record, new Date().toISOString());
  const old = original ? viewOf(original) : null;
  const ids = [];

  function add(id) {
    if (id && ids.indexOf(id) === -1) ids.push(id);
  }
  add(candidate.barang);
  if (old) add(old.barang);

  const result = { candidate: null, stocks: {} };
  for (const barangId of ids) {
    let list = activeViews(app, barangId);

    // Buang record lama dari daftarnya sebelum menerapkan bentuk baru.
    if (old && old.barang === barangId && mode !== 'create') {
      list = list.filter(function (v) { return v.id !== old.id; });
    }

    // Hapus tidak menambah apa pun. Arsip juga tidak ikut dihitung.
    if (mode !== 'delete' && candidate.barang === barangId && !candidate.diarsipkan) {
      list = list.filter(function (v) { return v.id !== candidate.id; });
      list.push(candidate);
    }

    const sim = simulate(sortViews(list), itemName(app, barangId));
    result.stocks[barangId] = sim.stok;
    if (mode !== 'delete' && candidate.barang === barangId && sim.pairs[candidate.id]) {
      result.candidate = sim.pairs[candidate.id];
    }
  }
  return result;
}

/**
 * Validasi rencana pemakaian (mis. material tugas) pada tanggal tertentu
 * terhadap seluruh riwayat aktif. Tidak menulis apa pun.
 */
function validatePlannedUsage(app, barangId, jumlah, tanggal) {
  const n = toNumber(jumlah);
  if (!(n > 0)) return null;
  const list = activeViews(app, barangId);
  list.push({
    ref: null,
    id: '__rencana__',
    barang: barangId,
    jenis: 'Pemakaian',
    jumlah: n,
    arah: '',
    keterangan: '',
    tanggal: String(tanggal || new Date().toISOString()),
    dibuat: new Date().toISOString(),
    diarsipkan: false
  });
  return simulate(sortViews(list), itemName(app, barangId));
}

function recomputeStock(app, barangId) {
  if (!barangId || _recomputing[barangId]) return;
  _recomputing[barangId] = true;

  try {
    const run = function (tx) {
      const views = activeViews(tx, barangId);
      const sim = simulate(sortViews(views), itemName(tx, barangId));

      for (const v of views) {
        const pair = sim.pairs[v.id];
        if (!pair) continue;
        const rec = v.ref;
        const oldBefore = toNumber(rec.getFloat('stok_sebelum'));
        const oldAfter = toNumber(rec.getFloat('stok_sesudah'));
        if (oldBefore !== pair.before || oldAfter !== pair.after) {
          rec.set('stok_sebelum', pair.before);
          rec.set('stok_sesudah', pair.after);
          tx.save(rec);
        }
      }

      const barang = tx.findRecordById('inventaris_non_perangkat', barangId);
      if (toNumber(barang.getFloat('stok')) !== sim.stok) {
        barang.set('stok', sim.stok);
        tx.save(barang);
      }
    };

    if (typeof app.runInTransaction === 'function') {
      app.runInTransaction(run);
    } else {
      run(app);
    }
  } finally {
    delete _recomputing[barangId];
  }
}

function needsRecompute(e) {
  try {
    const o = e.record.original();
    const n = e.record;
    return o.getString('barang') !== n.getString('barang') ||
      o.getString('jenis') !== n.getString('jenis') ||
      toNumber(o.getFloat('jumlah')) !== toNumber(n.getFloat('jumlah')) ||
      String(o.getString('keterangan') || '') !== String(n.getString('keterangan') || '') ||
      String(o.getString('arah_penyesuaian') || '') !== String(n.getString('arah_penyesuaian') || '') ||
      String(o.getString('tanggal') || '') !== String(n.getString('tanggal') || '') ||
      !!o.getBool('diarsipkan') !== !!n.getBool('diarsipkan');
  } catch (e) {
    return true;
  }
}

module.exports = {
  recomputeStock,
  needsRecompute,
  validateMutationSave,
  validatePlannedUsage,
  deltaOf,
  deltaOfValues,
  sortViews,
  viewOf
};
