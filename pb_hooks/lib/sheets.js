// Helper sinkron Google Sheets — di-require DI DALAM callback hook.
// PocketBase JSVM tidak membagikan variabel top-level antar handler.

function witaString(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const w = new Date(d.getTime() + 8 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const hasTime = String(v).includes(':') || String(v).includes('T');
  if (!hasTime) return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())} ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

function nameOf(app, collection, id, field) {
  if (!id) return '';
  try {
    const r = app.findRecordById(collection, id);
    return r.getString(field || 'nama') || r.getString('nama_barang') || r.getString('email') || r.getString('keluhan') || String(id);
  } catch (e) {
    return String(id);
  }
}

function collectModule(app, name, headers, mapFn) {
  const rows = [];
  try {
    const recs = app.findRecordsByFilter(name, 'diarsipkan = false', '', 5000, 0);
    for (const r of recs) rows.push(mapFn(r));
  } catch (e) {
    console.log('[sheets] skip', name, String(e));
  }
  return { koleksi: name, nama: name, headers, rows };
}

function collectModules(app) {
  return [
    collectModule(app, 'pelanggan',
      ['nama', 'nowa', 'sn_perangkat', 'koneksi', 'vlan', 'teknisi', 'keterangan_lokasi', 'link_maps'],
      r => [r.getString('nama'), r.getString('nowa'), r.getString('sn_perangkat'), r.getString('koneksi'), r.getString('vlan'), nameOf(app, 'users', r.getString('teknisi')), r.getString('keterangan_lokasi'), r.getString('link_maps')]),
    collectModule(app, 'layanan_gangguan',
      ['pelanggan', 'keluhan', 'status', 'ditugaskan_ke'],
      r => [nameOf(app, 'pelanggan', r.getString('pelanggan')), r.getString('keluhan'), r.getString('status'), nameOf(app, 'users', r.getString('ditugaskan_ke'))]),
    collectModule(app, 'absen_hadir',
      ['teknisi', 'tanggal', 'jam_masuk', 'keterangan', 'metode', 'alasan', 'dicatat_oleh'],
      r => [nameOf(app, 'users', r.getString('teknisi')), witaString(r.getString('tanggal')), witaString(r.getString('jam_masuk')), r.getString('keterangan'), r.getString('metode'), r.getString('alasan'), nameOf(app, 'users', r.getString('dicatat_oleh'))]),
    collectModule(app, 'perbaikan',
      ['pelanggan', 'gangguan', 'tanggal', 'teknisi', 'tindakan', 'status'],
      r => [nameOf(app, 'pelanggan', r.getString('pelanggan')), r.getString('gangguan'), witaString(r.getString('tanggal')), nameOf(app, 'users', r.getString('teknisi')), r.getString('tindakan'), r.getString('status')]),
    collectModule(app, 'inventaris_perangkat',
      ['nama', 'tipe', 'sn_serial', 'kondisi', 'lokasi_pemegang', 'keterangan'],
      r => [r.getString('nama'), r.getString('tipe'), r.getString('sn_serial'), r.getString('kondisi'), r.getString('lokasi_pemegang'), r.getString('keterangan')]),
    collectModule(app, 'inventaris_non_perangkat',
      ['nama_barang', 'satuan', 'stok', 'stok_minimum', 'keterangan'],
      r => [r.getString('nama_barang'), r.getString('satuan'), r.getFloat('stok'), r.getFloat('stok_minimum'), r.getString('keterangan')]),
    collectModule(app, 'pemasangan',
      ['pelanggan', 'tanggal', 'status', 'ditugaskan_ke'],
      r => [nameOf(app, 'pelanggan', r.getString('pelanggan')), witaString(r.getString('tanggal')), r.getString('status'), nameOf(app, 'users', r.getString('ditugaskan_ke'))]),
    collectModule(app, 'mutasi_inventaris',
      ['barang', 'jenis', 'jumlah', 'stok_sebelum', 'stok_sesudah', 'tanggal', 'referensi_modul', 'referensi_id', 'keterangan', 'dicatat_oleh'],
      r => [nameOf(app, 'inventaris_non_perangkat', r.getString('barang'), 'nama_barang'), r.getString('jenis'), r.getFloat('jumlah'), r.getFloat('stok_sebelum'), r.getFloat('stok_sesudah'), witaString(r.getString('tanggal')), r.getString('referensi_modul'), r.getString('referensi_id'), r.getString('keterangan'), nameOf(app, 'users', r.getString('dicatat_oleh'))]),
  ];
}

// PocketBase JSVM mengembalikan res.body sebagai []byte (array angka),
// bukan string, sehingga perlu di-decode sebelum dipotong/dibaca.
function decodeBytes(raw) {
  if (typeof raw === 'string') return raw;
  if (!raw || typeof raw.length !== 'number') return String(raw || '');
  const bytes = [];
  for (let i = 0; i < raw.length; i++) bytes.push(raw[i] & 255);

  // Decode UTF-8 minimal (cukup untuk pesan error/JSON dari webhook).
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b >= 0xc0 && b < 0xe0 && i + 1 < bytes.length) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else if (b >= 0xe0 && b < 0xf0 && i + 2 < bytes.length) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f));
    } else if (b >= 0xf0 && b < 0xf8 && i + 3 < bytes.length) {
      let cp = ((b & 0x07) << 18) | ((bytes[++i] & 0x3f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f);
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += '\ufffd';
    }
  }
  return out;
}

function bodySnippet(res, max) {
  try {
    let s = decodeBytes(res && res.body ? res.body : '');
    s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s.slice(0, max || 300);
  } catch (e) {
    return '';
  }
}

// res.json bisa null walau body berisi JSON (content-type tidak standar),
// jadi fallback ke body yang sudah di-decode.
function responseJson(res) {
  try {
    if (res && res.json) return res.json;
    const text = decodeBytes(res && res.body ? res.body : '').trim();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    return null;
  }
}

function saveLastSync(app, value) {
  try {
    let r;
    try {
      r = app.findFirstRecordByFilter('pengaturan', 'kunci = "sheets_last_sync"');
    } catch (_) {
      r = new Record(app.findCollectionByNameOrId('pengaturan'));
      r.set('kunci', 'sheets_last_sync');
    }
    r.set('nilai', value);
    app.save(r);
  } catch (e) {
    console.log('[sheets] gagal simpan last sync', String(e));
  }
}

function postWebhook(url, token, body) {
  return $http.send({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body,
    timeout: 45
  });
}

function send(app, url, token) {
  const modules = collectModules(app);
  let totalRows = 0;
  for (const m of modules) totalRows += (m.rows || []).length;
  console.log('[sheets] kirim', modules.length, 'modul,', totalRows, 'baris');

  const body = JSON.stringify({ token, modules });
  let res;
  try {
    res = postWebhook(url, token, body);
  } catch (e) {
    // Jaringan ke Google kadang gagal sesaat (TLS handshake timeout).
    // Kirim ulang sekali; operasi tulis Sheets bersifat idempoten.
    console.log('[sheets] percobaan pertama gagal, ulangi:', String(e));
    res = postWebhook(url, token, body);
  }
  return { res, modules };
}

module.exports = {
  witaString,
  nameOf,
  collectModule,
  collectModules,
  decodeBytes,
  bodySnippet,
  responseJson,
  saveLastSync,
  send
};
