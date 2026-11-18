/**
 * Malahotspot — penerima webhook Google Sheets (Apps Script) versi 2.
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
 * Perilaku versi 2:
 * - Setiap tab memiliki kolom `id` di paling kanan.
 * - Baris dicocokkan berdasarkan `id`: data yang berubah diperbarui, data baru
 *   ditambahkan. Baris lama TIDAK dihapus ketika data di PocketBase hilang,
 *   diarsipkan, atau sinkron mengirim snapshot kosong.
 * - Kolom tambahan yang sudah ada di spreadsheet tetap dipertahankan.
 *
 * Server mengirim body JSON:
 *   { token: "...", modules: [ { koleksi, nama, headers: [...], rows: [[...]] } ] }
 * Balasan yang diharapkan server: { "ok": true, "version": 2, ... }
 */

var SCRIPT_VERSION = 2;

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

    // Cegah dua eksekusi webhook menulis bersamaan.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      return json({ ok: false, error: 'Spreadsheet sedang diproses. Coba lagi.' });
    }

    let updated = 0;
    let appended = 0;
    let skipped = 0;
    try {
      for (const mod of modules) {
        const stat = upsertModule_(ss, mod);
        updated += stat.updated || 0;
        appended += stat.appended || 0;
        if (stat.skipped) skipped++;
      }
    } finally {
      lock.releaseLock();
    }

    return json({
      ok: true,
      version: SCRIPT_VERSION,
      modules: modules.length,
      updated: updated,
      appended: appended,
      skipped: skipped,
      retained: true,
      at: new Date().toISOString()
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * Menulis satu modul tanpa menghapus baris lama.
 * Baris dengan id yang sama diperbarui; id baru ditambahkan di bawah.
 */
function upsertModule_(ss, mod) {
  const name = String(mod.nama || mod.koleksi || 'Sheet').slice(0, 100);
  const headers = (Array.isArray(mod.headers) ? mod.headers : [])
    .map(function (h) { return String(h === null || h === undefined ? '' : h).trim(); });
  if (!headers.length) return { updated: 0, appended: 0, skipped: true };

  const rows = Array.isArray(mod.rows) ? mod.rows : [];
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  let lastRow = sheet.getLastRow();
  let lastCol = sheet.getLastColumn();
  let existingHeaders = [];
  let dataRows = [];

  if (lastRow >= 1 && lastCol >= 1) {
    const firstRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeCell_);
    // Baris pertama dianggap header hanya jika salah satu isinya cocok dengan
    // nama kolom dari payload. Dengan begitu sheet lama tanpa header tidak
    // kehilangan baris data pertamanya.
    const hasHeader = firstRow.some(function (h) {
      return h !== '' && headers.some(function (x) { return sameHeader_(x, h); });
    });

    if (hasHeader) {
      existingHeaders = firstRow;
      if (lastRow > 1) {
        const readWidth = Math.max(lastCol, headers.length);
        dataRows = sheet.getRange(2, 1, lastRow - 1, readWidth).getValues();
      }
    } else {
      // Baris pertama kosong. Kalau ada isi, anggap semua baris sebagai data
      // lalu sisipkan baris header agar data lama tidak tertimpa.
      const readWidth = Math.max(lastCol, headers.length);
      const allRows = sheet.getRange(1, 1, lastRow, readWidth).getValues();
      const hasData = allRows.some(function (row) {
        return row.some(function (v) { return normalizeCell_(v) !== ''; });
      });
      if (hasData) {
        sheet.insertRowBefore(1);
        dataRows = allRows;
        lastRow = sheet.getLastRow();
      }
      existingHeaders = [];
    }
  }

  // Pertahankan urutan kolom lama; tambahkan kolom baru (termasuk id) di kanan.
  let finalHeaders = existingHeaders.some(function (h) { return h !== ''; })
    ? existingHeaders.slice()
    : headers.slice();
  for (const h of headers) {
    if (!h) continue;
    if (!finalHeaders.some(function (x) { return sameHeader_(x, h); })) finalHeaders.push(h);
  }

  if (!sameHeaderArray_(existingHeaders, finalHeaders)) {
    sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  }

  const width = Math.max(
    finalHeaders.length,
    dataRows.reduce(function (max, row) { return Math.max(max, row.length); }, 0)
  );
  dataRows = dataRows.map(function (row) {
    const out = row.slice();
    while (out.length < width) out.push('');
    return out;
  });

  const idCol = finalHeaders.findIndex(function (h) { return sameHeader_(h, 'id'); });
  const payloadIdIdx = headers.findIndex(function (h) { return sameHeader_(h, 'id'); });

  const colIndex = {};
  for (const h of headers) {
    if (!h) continue;
    const idx = finalHeaders.findIndex(function (x) { return sameHeader_(x, h); });
    if (idx >= 0) colIndex[h] = idx;
  }

  const idToIndex = {};
  const fingerprintToIndex = {};
  if (idCol >= 0) {
    for (let i = 0; i < dataRows.length; i++) {
      const id = normalizeCell_(dataRows[i][idCol]);
      if (id) {
        idToIndex[id] = i;
        continue;
      }
      // Baris lama dari versi sebelum ada kolom id: cocokkan berdasarkan isi
      // kolom non-id supaya tidak menghasilkan duplikat saat upgrade.
      if (payloadIdIdx >= 0) {
        const fp = existingFingerprint_(headers, dataRows[i], colIndex);
        if (!isBlankFingerprint_(fp) && fingerprintToIndex[fp] === undefined) {
          fingerprintToIndex[fp] = i;
        }
      }
    }
  }

  const updates = {};
  const newRows = [];
  let appended = 0;

  for (const payload of rows) {
    if (!Array.isArray(payload)) continue;

    const id = payloadIdIdx >= 0 ? normalizeCell_(payload[payloadIdIdx]) : '';
    const values = new Array(finalHeaders.length).fill('');
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (!h || colIndex[h] === undefined) continue;
      const v = payload[j];
      values[colIndex[h]] = v === undefined || v === null ? '' : v;
    }

    let adopted = false;
    if (id && !Object.prototype.hasOwnProperty.call(idToIndex, id) && payloadIdIdx >= 0) {
      const fp = payloadFingerprint_(headers, payload);
      if (!isBlankFingerprint_(fp) && fingerprintToIndex[fp] !== undefined) {
        const idx = fingerprintToIndex[fp];
        idToIndex[id] = idx;
        dataRows[idx][idCol] = id;
        delete fingerprintToIndex[fp];
        adopted = true;
      }
    }

    if (id && Object.prototype.hasOwnProperty.call(idToIndex, id)) {
      const idx = idToIndex[id];
      const current = dataRows[idx] || [];
      const merged = current.slice();
      while (merged.length < finalHeaders.length) merged.push('');
      for (let j = 0; j < headers.length; j++) {
        const h = headers[j];
        if (!h || colIndex[h] === undefined) continue;
        const v = payload[j];
        merged[colIndex[h]] = v === undefined || v === null ? '' : v;
      }
      if (adopted || !sameRow_(current, merged)) updates[idx] = merged;
    } else {
      newRows.push(values);
      appended++;
    }
  }

  // Tulis baris yang berubah per blok berurutan supaya tidak boros panggilan.
  const updateIndices = Object.keys(updates).map(Number).sort(function (a, b) { return a - b; });
  let k = 0;
  while (k < updateIndices.length) {
    let end = k;
    while (end + 1 < updateIndices.length && updateIndices[end + 1] === updateIndices[end] + 1) end++;

    const block = [];
    for (let i = updateIndices[k]; i <= updateIndices[end]; i++) {
      block.push(updates[i] || dataRows[i]);
    }
    const blockWidth = Math.max.apply(null, [width].concat(block.map(function (r) { return r.length; })));
    const normalized = block.map(function (row) {
      const out = row.slice();
      while (out.length < blockWidth) out.push('');
      return out;
    });
    sheet.getRange(2 + updateIndices[k], 1, normalized.length, blockWidth).setValues(normalized);
    k = end + 1;
  }

  if (newRows.length) {
    const start = sheet.getLastRow() + 1;
    const normalized = newRows.map(function (row) {
      const out = row.slice();
      while (out.length < width) out.push('');
      return out;
    });
    sheet.getRange(start, 1, normalized.length, width).setValues(normalized);
  }

  sheet.setFrozenRows(1);
  return { updated: updateIndices.length, appended: appended, skipped: false };
}

function normalizeCell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function sameHeader_(a, b) {
  return normalizeCell_(a).trim().toLowerCase() === normalizeCell_(b).trim().toLowerCase();
}

function payloadFingerprint_(headers, payload) {
  const parts = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h || sameHeader_(h, 'id')) continue;
    parts.push(normalizeCell_(payload[i]));
  }
  return parts.join('\u001f');
}

function existingFingerprint_(headers, row, colIndex) {
  const parts = [];
  for (const h of headers) {
    if (!h || sameHeader_(h, 'id')) continue;
    const col = colIndex[h];
    parts.push(col === undefined ? '' : normalizeCell_(row[col]));
  }
  return parts.join('\u001f');
}

function isBlankFingerprint_(fp) {
  return String(fp || '').replace(/\u001f/g, '') === '';
}

function sameHeaderArray_(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameHeader_(a[i], b[i])) return false;
  }
  return true;
}

function sameRow_(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (normalizeCell_(a[i]) !== normalizeCell_(b[i])) return false;
  }
  return true;
}

function doGet() {
  return json({
    ok: true,
    service: 'malahotspot-sheets',
    version: SCRIPT_VERSION,
    retention: 'upsert'
  });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
