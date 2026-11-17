/**
 * Malahotspot — penerima webhook Google Sheets (Apps Script).
 *
 * Konfigurasi TIDAK ditulis di dalam kode. Isi lewat:
 * Project Settings (ikon gerigi) → Script Properties → Add script property:
 *
 *   TOKEN           = nilai SHEETS_WEBHOOK_TOKEN dari file .env server
 *   SPREADSHEET_ID  = ID spreadsheet (bagian di antara /d/ dan /edit pada URL)
 *
 * Cara pasang:
 * 1. Buka spreadsheet → Extensions/Ekstensi → Apps Script.
 * 2. Salin seluruh isi file ini ke Code.gs.
 * 3. Isi kedua Script Properties di atas.
 * 4. Deploy → Manage deployments → Edit (ikon pensil) → Version: New version → Deploy.
 *    Jangan memakai "New deployment" karena URL /exec akan berubah.
 * 5. Pastikan akses deployment: "Anyone" dan execute as: "Me".
 *
 * Server mengirim body JSON:
 *   { token: "...", modules: [ { koleksi, nama, headers: [...], rows: [[...]] } ] }
 * Balasan yang diharapkan server: { "ok": true, ... }
 */

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty('TOKEN') || '').trim();
  const spreadsheetId = String(props.getProperty('SPREADSHEET_ID') || '').trim();

  if (!token) throw new Error('Script Property TOKEN belum diisi');
  if (!spreadsheetId) throw new Error('Script Property SPREADSHEET_ID belum diisi');

  return { token: token, spreadsheetId: spreadsheetId };
}

function doPost(e) {
  try {
    const cfg = getConfig_();

    if (!e || !e.postData || !e.postData.contents) {
      return json({ ok: false, error: 'Body kosong' });
    }

    const data = JSON.parse(e.postData.contents);
    if (!data || data.token !== cfg.token) {
      return json({ ok: false, error: 'Token tidak cocok' });
    }

    const ss = SpreadsheetApp.openById(cfg.spreadsheetId);
    const modules = Array.isArray(data.modules) ? data.modules : [];

    for (const mod of modules) {
      const name = String(mod.nama || mod.koleksi || 'Sheet').slice(0, 100);
      const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
      const headers = Array.isArray(mod.headers) ? mod.headers : [];
      const rows = Array.isArray(mod.rows) ? mod.rows : [];

      sheet.clearContents();
      if (headers.length) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        if (rows.length) {
          const normalized = rows.map(function (row) {
            return headers.map(function (_, i) {
              return row[i] === undefined || row[i] === null ? '' : row[i];
            });
          });
          sheet.getRange(2, 1, normalized.length, headers.length).setValues(normalized);
        }
      }
      sheet.setFrozenRows(1);
    }

    return json({ ok: true, modules: modules.length, at: new Date().toISOString() });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json({ ok: true, service: 'malahotspot-sheets' });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
