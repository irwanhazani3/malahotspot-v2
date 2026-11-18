// Test aturan inventaris dengan fungsi produksi (bukan salinan rumus).
// Run: node pb_tests/inventory_logic.test.js
const assert = require('assert');

global.BadRequestError = class BadRequestError extends Error {};
global.__hooks = require('path').join(__dirname, '../pb_hooks');

const { validateMutationSave, recomputeStock, deltaOfValues } = require('../pb_hooks/lib/mutasi.js');
const { validateMaterials } = require('../pb_hooks/lib/task_material.js');
const { validateDeviceSN, validateStockItem, validateOpeningStock } = require('../pb_hooks/lib/inventory.js');
const { validateDeviceAssignment } = require('../pb_hooks/lib/task_device.js');

function rec(id, data, collection) {
  return {
    id: id,
    _d: data || {},
    getString(k) {
      return data[k] === null || data[k] === undefined ? '' : String(data[k]);
    },
    getFloat(k) {
      return Number(data[k] || 0);
    },
    getBool(k) {
      return !!data[k];
    },
    get(k) {
      return data[k];
    },
    set(k, v) {
      data[k] = v;
    },
    collection() {
      return { name: collection || data._collection || '' };
    }
  };
}

function appMock(source) {
  return {
    findRecordsByFilter(name, filter) {
      let list = (source[name] || []).slice();
      const m = /barang = "([^"]+)"/.exec(filter || '');
      if (m) list = list.filter(r => r.getString('barang') === m[1]);
      return list;
    },
    findRecordById(name, id) {
      const found = (source[name] || []).find(r => r.id === id);
      if (!found) throw new Error('not found: ' + name + '/' + id);
      return found;
    },
    save(r) {
      const arr = source[r.collection().name] || (source[r.collection().name] = []);
      const idx = arr.findIndex(x => x.id === r.id);
      if (idx === -1) arr.push(r);
      else arr[idx] = r;
    }
  };
}

function expectError(fn, pattern) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  assert(err, 'seharusnya ditolak');
  if (pattern) assert(pattern.test(err.message), 'pesan salah: ' + err.message);
  return err;
}

(function () {
  // 1) Rumus delta.
  assert.strictEqual(deltaOfValues('Pengadaan', 5), 5);
  assert.strictEqual(deltaOfValues('Pemakaian', 3), -3);
  assert.strictEqual(deltaOfValues('Penyesuaian', 2, 'Tambah'), 2);
  assert.strictEqual(deltaOfValues('Penyesuaian', 2, 'Kurang'), -2);
  assert.strictEqual(deltaOfValues('Penyesuaian', 2, '', 'kurang selisih opname'), -2);
  assert.strictEqual(deltaOfValues('Pemakaian', 0), 0);

  // 2) Dua baris material dengan barang sama harus dijumlahkan.
  const item = rec('b1', { nama_barang: 'Kabel', stok: 10, diarsipkan: false }, 'inventaris_non_perangkat');
  const app = appMock({ inventaris_non_perangkat: [item] });
  const task = rec('t1', {
    material_pemakaian: [
      { barang: 'b1', jumlah: 6 },
      { barang: 'b1', jumlah: 6 }
    ]
  }, 'perbaikan');
  expectError(() => validateMaterials(app, task), /diminta: 12/);

  const taskOk = rec('t2', {
    tanggal: '2026-01-12',
    material_pemakaian: [
      { barang: 'b1', jumlah: 6 },
      { barang: 'b1', jumlah: 4 }
    ]
  }, 'perbaikan');
  const opening = rec('m0', {
    barang: 'b1', jenis: 'Pengadaan', jumlah: 10,
    tanggal: '2026-01-10', dibuat_pada: '2026-01-10T08:00:00Z', diarsipkan: false
  }, 'mutasi_inventaris');
  const appWithStock = appMock({ inventaris_non_perangkat: [item], mutasi_inventaris: [opening] });
  validateMaterials(appWithStock, taskOk);

  // 3) Mutasi bertanggal mundur dihitung pada urutan yang benar.
  const buy = rec('m1', {
    barang: 'b1', jenis: 'Pengadaan', jumlah: 10,
    tanggal: '2026-01-10', dibuat_pada: '2026-01-10T08:00:00Z', diarsipkan: false
  }, 'mutasi_inventaris');
  item.set('stok', 10);
  const app2 = appMock({ inventaris_non_perangkat: [item], mutasi_inventaris: [buy] });
  const backdate = rec('m2', {
    barang: 'b1', jenis: 'Pengadaan', jumlah: 5,
    tanggal: '2026-01-01', dibuat_pada: '2026-01-11T08:00:00Z', diarsipkan: false
  }, 'mutasi_inventaris');
  const hasil = validateMutationSave(app2, backdate, null, 'create');
  assert.strictEqual(hasil.candidate.before, 0);
  assert.strictEqual(hasil.candidate.after, 5);
  assert.strictEqual(hasil.stocks.b1, 15);

  const tooMuch = rec('m3', {
    barang: 'b1', jenis: 'Pemakaian', jumlah: 20,
    tanggal: '2026-01-12', dibuat_pada: '2026-01-12T08:00:00Z', diarsipkan: false
  }, 'mutasi_inventaris');
  expectError(() => validateMutationSave(app2, tooMuch, null, 'create'), /negatif/);

  // Material tugas bertanggal mundur juga harus mengikuti urutan kronologis:
  // stok belum ada pada tanggal tugas -> ditolak, bukan dipotong dari stok kini.
  const taskBackdate = rec('t3', {
    tanggal: '2026-01-05',
    material_pemakaian: [{ barang: 'b1', jumlah: 5 }]
  }, 'perbaikan');
  expectError(() => validateMaterials(app2, taskBackdate), /negatif/);
  const taskAfterBuy = rec('t4', {
    tanggal: '2026-01-12',
    material_pemakaian: [{ barang: 'b1', jumlah: 5 }]
  }, 'perbaikan');
  validateMaterials(app2, taskAfterBuy);

  // 4) Arsip pengadaan yang sudah dipakai harus ditolak, bukan dibulatkan ke 0.
  const used = rec('m4', {
    barang: 'b1', jenis: 'Pemakaian', jumlah: 8,
    stok_sebelum: 10, stok_sesudah: 2,
    tanggal: '2026-01-15', dibuat_pada: '2026-01-15T08:00:00Z', diarsipkan: false
  }, 'mutasi_inventaris');
  item.set('stok', 2);
  const app3 = appMock({ inventaris_non_perangkat: [item], mutasi_inventaris: [buy, used] });
  const archivedBuy = rec('m1', {
    barang: 'b1', jenis: 'Pengadaan', jumlah: 10,
    tanggal: '2026-01-10', dibuat_pada: '2026-01-10T08:00:00Z', diarsipkan: true
  }, 'mutasi_inventaris');
  expectError(() => validateMutationSave(app3, archivedBuy, buy, 'update'), /negatif/);

  // Recompute juga harus menolak, dan tidak menulis ulang baris lama.
  const archivedSource = appMock({
    inventaris_non_perangkat: [item],
    mutasi_inventaris: [archivedBuy, used]
  });
  expectError(() => recomputeStock(archivedSource, 'b1'), /negatif/);
  assert.strictEqual(used.getString('stok_sebelum'), '10');
  assert.strictEqual(used.getString('stok_sesudah'), '2');

  // 5) Recompute normal menulis ulang rantai stok dengan benar.
  const normal = appMock({ inventaris_non_perangkat: [item], mutasi_inventaris: [buy, used] });
  item.set('stok', 0);
  recomputeStock(normal, 'b1');
  assert.strictEqual(Number(buy.getFloat('stok_sebelum')), 0);
  assert.strictEqual(Number(buy.getFloat('stok_sesudah')), 10);
  assert.strictEqual(Number(used.getFloat('stok_sebelum')), 10);
  assert.strictEqual(Number(used.getFloat('stok_sesudah')), 2);
  assert.strictEqual(Number(item.getFloat('stok')), 2);

  // 6) Stok awal dan stok minimum.
  const newItem = rec('b2', { nama_barang: 'Konektor', stok: 5, stok_minimum: 0 }, 'inventaris_non_perangkat');
  expectError(() => validateOpeningStock(newItem), /Stok awal harus 0/);
  newItem.set('stok', 0);
  validateOpeningStock(newItem);
  newItem.set('stok_minimum', -1);
  expectError(() => validateStockItem(newItem), /tidak boleh negatif/);

  // 7) SN unik, tidak membedakan huruf besar/kecil dan spasi.
  const dev1 = rec('d1', { nama: 'Router A', sn_serial: 'SN-ABC', kondisi: 'Baik' }, 'inventaris_perangkat');
  const dev2 = rec('d2', { nama: 'Router B', sn_serial: ' sn-abc ', kondisi: 'Baik' }, 'inventaris_perangkat');
  const app4 = appMock({ inventaris_perangkat: [dev1] });
  expectError(() => validateDeviceSN(app4, dev2), /sudah dipakai/);
  dev2.set('sn_serial', 'SN-XYZ');
  validateDeviceSN(app4, dev2);
  dev2.set('sn_serial', '');
  validateDeviceSN(app4, dev2);
  validateDeviceSN(app4, dev1);

  // 8) Perangkat yang sudah terpasang di pelanggan lain harus ditolak.
  const c1 = rec('c1', { nama: 'Pelanggan A' }, 'pelanggan');
  const c2 = rec('c2', { nama: 'Pelanggan B' }, 'pelanggan');
  const installed = rec('d3', {
    nama: 'ONT', sn_serial: 'ONT-1', kondisi: 'Terpasang', lokasi_pemegang: 'Pelanggan A'
  }, 'inventaris_perangkat');
  const rusak = rec('d4', { nama: 'AP Rusak', kondisi: 'Rusak', lokasi_pemegang: 'Gudang' }, 'inventaris_perangkat');
  const app5 = appMock({
    pelanggan: [c1, c2],
    inventaris_perangkat: [installed, rusak],
    layanan_gangguan: []
  });

  const pindah = rec('p1', { pelanggan: 'c2', status: 'Selesai', perangkat: ['d3'] }, 'pemasangan');
  expectError(() => validateDeviceAssignment(app5, pindah), /sudah terpasang di Pelanggan A/);

  const sama = rec('p2', { pelanggan: 'c1', status: 'Selesai', perangkat: ['d3'] }, 'pemasangan');
  validateDeviceAssignment(app5, sama);

  const pasangRusak = rec('p3', { pelanggan: 'c2', status: 'Selesai', perangkat: ['d4'] }, 'pemasangan');
  expectError(() => validateDeviceAssignment(app5, pasangRusak), /kondisi Rusak/);

  console.log('inventory_logic.test.js OK');
})();
