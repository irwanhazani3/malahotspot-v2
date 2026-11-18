/// <reference path="../pb_data/types.d.ts" />

// Sinkron arsip DB → Google Sheets (upsert; baris lama tidak dihapus).
// Logika pengumpulan data dan pengiriman ada di lib/sheets.js dan
// di-require DI DALAM callback (batasan PocketBase JSVM).
// Waktu sinkron terakhir disimpan di koleksi `pengaturan`
// (kunci: sheets_last_sync) agar interval tetap berlaku antar eksekusi cron.

cronAdd('sheets-sync', '* * * * *', () => {
  try {
    const app = $app;

    // --- interval setting ---
    let intervalMin = 5;
    try {
      const r = app.findFirstRecordByFilter('pengaturan', 'kunci = "interval_sinkron_sheets"');
      const v = r.get('nilai');
      if (v !== null && v !== undefined && v !== '') intervalMin = Number(v) || 5;
    } catch (e) {}
    intervalMin = Math.max(1, Math.min(1440, intervalMin));

    // --- last sync (persisted) ---
    let lastSync = 0;
    try {
      const r = app.findFirstRecordByFilter('pengaturan', 'kunci = "sheets_last_sync"');
      lastSync = Number(r.get('nilai') || 0) || 0;
    } catch (e) {}

    const now = Date.now();
    if (now - lastSync < intervalMin * 60 * 1000) return;

    const url = $os.getenv('SHEETS_WEBHOOK_URL');
    const token = $os.getenv('SHEETS_WEBHOOK_TOKEN');
    if (!url || !token) {
      console.log('[sheets] URL/token belum diatur, sinkron dilewati');
      return;
    }

    const { send, saveLastSync, bodySnippet, responseJson } = require(__hooks + '/lib/sheets.js');
    const result = send(app, url, token);
    if (result.skipped) {
      saveLastSync(app, now);
      return;
    }

    const { res, modules } = result;
    const webhook = responseJson(res);

    if (res.statusCode >= 300) {
      console.log('[sheets] gagal status', res.statusCode, bodySnippet(res, 300));
      return;
    }
    if (!webhook || webhook.ok !== true) {
      console.log('[sheets] webhook menolak / respons tidak dikenali:', JSON.stringify(webhook).slice(0, 300), bodySnippet(res, 200));
      return;
    }
    if (Number(webhook.version || 0) < 2) {
      console.log('[sheets] peringatan: Apps Script masih versi lama; deploy versi baru agar baris lama tidak terhapus');
    }

    console.log('[sheets] sinkron sukses, modul:', modules.length, 'kosong:', result.skippedEmpty);
    saveLastSync(app, now);
  } catch (e) {
    console.log('[sheets cron]', String(e));
  }
});

// Endpoint sinkron manual: POST /api/sheets/sync (admin saja)
routerAdd('POST', '/api/sheets/sync', (e) => {
  try {
    if (!e.auth || e.auth.getString('role') !== 'admin') {
      return e.json(403, { message: 'Hanya admin' });
    }

    const app = e.app;
    const url = $os.getenv('SHEETS_WEBHOOK_URL');
    const token = $os.getenv('SHEETS_WEBHOOK_TOKEN');
    if (!url || !token) {
      return e.json(400, { ok: false, message: 'SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_TOKEN belum diatur di environment server' });
    }

    const { send, saveLastSync, bodySnippet, responseJson } = require(__hooks + '/lib/sheets.js');
    const result = send(app, url, token);
    if (result.skipped) {
      saveLastSync(app, Date.now());
      return e.json(200, {
        ok: true,
        skipped: true,
        modules: 0,
        emptyModules: result.skippedEmpty,
        message: 'Tidak ada data untuk dikirim. Sheets tidak diubah agar data lama tetap aman.'
      });
    }

    const { res, modules } = result;
    const webhook = responseJson(res);

    if (res.statusCode >= 300) {
      return e.json(502, {
        ok: false,
        status: res.statusCode,
        message: 'Webhook Google Sheets menolak request',
        detail: bodySnippet(res),
        webhook: webhook
      });
    }
    if (!webhook || webhook.ok !== true) {
      return e.json(502, {
        ok: false,
        status: res.statusCode,
        message: 'Respons webhook tidak dikenali. Pastikan Web App di-deploy dengan akses "Anyone", URL berakhiran /exec, Script Properties TOKEN/SPREADSHEET_ID terisi, dan token sama.',
        detail: bodySnippet(res),
        webhook: webhook
      });
    }

    saveLastSync(app, Date.now());
    const out = {
      ok: true,
      status: res.statusCode,
      modules: modules.length,
      emptyModules: result.skippedEmpty,
      updated: webhook.updated || 0,
      appended: webhook.appended || 0,
      retained: webhook.retained === true
    };
    if (Number(webhook.version || 0) < 2) {
      out.warning = 'Apps Script masih versi lama. Deploy versi baru agar baris yang dihapus di web tetap tersimpan di spreadsheet.';
    }
    return e.json(200, out);
  } catch (err) {
    console.log('[sheets manual]', String(err));
    return e.json(500, { message: 'Gagal sinkron', error: String(err) });
  }
});
