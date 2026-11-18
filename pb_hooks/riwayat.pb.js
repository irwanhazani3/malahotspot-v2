/// <reference path="../pb_data/types.d.ts" />

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

    const app = e.app;
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
    return e.json(200, { ok: true, deleted: deleted, range: range });
  } catch (err) {
    console.log('[riwayat clear]', String(err));
    return e.json(500, { message: 'Gagal menghapus riwayat' });
  }
});
