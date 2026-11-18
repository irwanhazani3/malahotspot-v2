/// <reference path="../pb_data/types.d.ts" />

function _getRiwayatSetting(app, key, defVal){
  try {
    const r = app.findFirstRecordByFilter('pengaturan', 'kunci = "' + key + '"');
    const v = r.get('nilai');
    return (v === null || v === undefined || v === '') ? defVal : v;
  } catch (e) { return defVal; }
}

function _clearRiwayatByFilter(app, filter){
  let deleted = 0;
  while (true) {
    let batch = [];
    try {
      batch = app.findRecordsByFilter('riwayat', filter, '', 200, 0) || [];
    } catch (err) {
      console.log('[riwayat clear filter]', String(err), filter);
      batch = [];
    }
    if (!batch.length) break;
    for (const r of batch) {
      try { app.delete(r); deleted++; } catch (err) { console.log('[riwayat clear delete]', String(err)); }
    }
  }
  return deleted;
}

function _clearRiwayatOlderThanDays(app, days){
  const n = Number(days);
  if (!(n > 0)) return 0;
  const cutoff = new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');
  return _clearRiwayatByFilter(app, 'waktu < "' + cutoff + '"');
}

// Hapus otomatis riwayat yang lebih lama dari retensi (hari). 0/nonaktif = tidak dihapus.
cronAdd('riwayat-retention', '20 3 * * *', () => {
  try {
    const days = _getRiwayatSetting($app, 'retensi_riwayat_hari', 0);
    if (Number(days) > 0) {
      const n = _clearRiwayatOlderThanDays($app, days);
      if (n > 0) console.log('[riwayat retention] terhapus', n, 'data, retensi', days, 'hari');
    }
  } catch (e) {
    console.log('[riwayat retention]', String(e));
  }
});

// Hapus riwayat (audit log) berdasarkan rentang waktu. Hanya admin.
// Body: { range: "1h"|"24h"|"7d"|"4w"|"30d"|"all" }
routerAdd('POST', '/api/riwayat/clear', (e) => {
  try {
    if (!e.auth || e.auth.getString('role') !== 'admin') {
      return e.json(403, { message: 'Hapus riwayat hanya untuk admin' });
    }
    const info = e.requestInfo() || {};
    const body = info.body || {};
    const range = String(body.range || 'all');

    const now = Date.now();
    const ranges = {
      '1h': 1 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '4w': 28 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    let filter = 'id != ""';
    if (range !== 'all') {
      const ms = ranges[range];
      if (!ms) return e.json(400, { message: 'Rentang waktu tidak valid' });
      const cutoff = new Date(now - ms).toISOString().replace('T', ' ').replace('Z', '');
      filter = 'waktu >= "' + cutoff + '"';
    }

    const deleted = _clearRiwayatByFilter(e.app, filter);
    return e.json(200, { ok: true, deleted: deleted, range: range });
  } catch (err) {
    console.log('[riwayat clear]', String(err));
    return e.json(500, { message: 'Gagal menghapus riwayat' });
  }
});
