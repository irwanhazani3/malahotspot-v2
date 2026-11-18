// Test payload Sheets: semua baris membawa id dan modul kosong tidak dikirim.
// Run: node pb_tests/sheets_payload.test.js
const assert = require('assert');
const sheets = require('../pb_hooks/lib/sheets.js');

function rec(id, data) {
  return {
    id,
    getString(k) {
      return data[k] === null || data[k] === undefined ? '' : String(data[k]);
    },
    getFloat(k) {
      return Number(data[k] || 0);
    }
  };
}

const data = {
  users: [rec('u1', { nama: 'Admin' })],
  pelanggan: [rec('p1', {
    nama: 'Budi', nowa: '0812', sn_perangkat: 'SN1', koneksi: 'Koneksi',
    vlan: '10', teknisi: 'u1', keterangan_lokasi: 'Lokasi', link_maps: 'https://maps'
  })],
  layanan_gangguan: [rec('g1', { pelanggan: 'p1', keluhan: 'Internet putus', status: 'Baru', ditugaskan_ke: 'u1' })],
  absen_hadir: [rec('a1', { teknisi: 'u1', tanggal: '2026-11-18', jam_masuk: '2026-11-18 08:00:00', keterangan: 'Hadir', metode: 'Admin', alasan: '', dicatat_oleh: 'u1' })],
  perbaikan: [rec('r1', { pelanggan: 'p1', gangguan: 'g1', tanggal: '2026-11-18', teknisi: 'u1', tindakan: 'Perbaikan', status: 'Selesai' })],
  inventaris_perangkat: [rec('d1', { nama: 'Router', tipe: 'ZTE', sn_serial: 'SN2', kondisi: 'Baik', lokasi_pemegang: 'Gudang', keterangan: '' })],
  inventaris_non_perangkat: [rec('b1', { nama_barang: 'Kabel', satuan: 'meter', stok: 10, stok_minimum: 2, keterangan: '' })],
  pemasangan: [rec('m1', { pelanggan: 'p1', tanggal: '2026-11-18', status: 'Selesai', ditugaskan_ke: 'u1' })],
  mutasi_inventaris: [rec('t1', { barang: 'b1', jenis: 'Pengadaan', jumlah: 5, stok_sebelum: 5, stok_sesudah: 10, tanggal: '2026-11-18', referensi_modul: '', referensi_id: '', keterangan: '', dicatat_oleh: 'u1' })]
};

function appMock(source) {
  return {
    findRecordsByFilter(name) {
      return source[name] || [];
    },
    findRecordById(name, id) {
      return (source[name] || []).find(r => r.id === id);
    }
  };
}

(function () {
  const origLog = console.log;
  console.log = () => {};

  const expectedIds = {
    pelanggan: 'p1', layanan_gangguan: 'g1', absen_hadir: 'a1', perbaikan: 'r1',
    inventaris_perangkat: 'd1', inventaris_non_perangkat: 'b1', pemasangan: 'm1',
    mutasi_inventaris: 't1'
  };
  const app = appMock(data);
  const modules = sheets.collectModules(app);
  assert.strictEqual(modules.length, 8);
  for (const m of modules) {
    assert.strictEqual(m.headers[m.headers.length - 1], 'id', m.nama + ' harus punya kolom id');
    assert.strictEqual(m.rows.length, 1, m.nama + ' harus punya 1 baris');
    assert.strictEqual(m.rows[0][m.rows[0].length - 1], expectedIds[m.koleksi], m.nama + ' id salah');
  }

  let captured = null;
  let calls = 0;
  global.$http = {
    send(req) {
      calls++;
      captured = JSON.parse(req.body);
      return { statusCode: 200, body: JSON.stringify({ ok: true, version: 2, updated: 1, appended: 0, retained: true }) };
    }
  };

  const result = sheets.send(app, 'https://example.test/exec', 'tok');
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(calls, 1);
  assert.strictEqual(captured.retention, true);
  assert.strictEqual(captured.modules.length, 8);
  assert.strictEqual(captured.modules[0].headers[captured.modules[0].headers.length - 1], 'id');
  assert.strictEqual(captured.modules[0].rows[0][captured.modules[0].rows[0].length - 1], 'p1');

  const emptyApp = appMock({});
  const empty = sheets.send(emptyApp, 'https://example.test/exec', 'tok');
  assert.strictEqual(empty.skipped, true);
  assert.strictEqual(empty.modules.length, 0);
  assert.strictEqual(empty.skippedEmpty, 8);
  assert.strictEqual(calls, 1, 'modul kosong tidak boleh memanggil webhook');

  console.log = origLog;
  console.log('sheets_payload.test.js OK');
})();
