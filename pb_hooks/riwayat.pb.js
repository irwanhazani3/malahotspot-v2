/// <reference path="../pb_data/types.d.ts" />

// Hapus seluruh riwayat (audit log). Hanya admin.
routerAdd('POST', '/api/riwayat/clear', (e) => {
  try {
    if (!e.auth || e.auth.getString('role') !== 'admin') {
      return e.json(403, { message: 'Hanya admin' });
    }
    const app = e.app;
    let deleted = 0;
    while (true) {
      let batch = [];
      try {
        batch = app.findRecordsByFilter('riwayat', 'id != ""', '', 200, 0) || [];
      } catch (err) {
        batch = [];
      }
      if (!batch.length) break;
      for (const r of batch) {
        try { app.delete(r); deleted++; } catch (err) { console.log('[riwayat clear delete]', String(err)); }
      }
    }
    return e.json(200, { ok: true, deleted: deleted });
  } catch (err) {
    console.log('[riwayat clear]', String(err));
    return e.json(500, { message: 'Gagal menghapus riwayat' });
  }
});
