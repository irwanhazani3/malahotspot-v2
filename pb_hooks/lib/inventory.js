// Validasi data master inventaris — di-require DI DALAM callback hook.

function validateDeviceSN(app, rec) {
  const sn = String(rec.getString('sn_serial') || '').trim();
  rec.set('sn_serial', sn);
  if (!sn) return;

  let recs = [];
  try {
    recs = app.findRecordsByFilter('inventaris_perangkat', 'sn_serial != ""', '', 5000, 0);
  } catch (e) {
    console.log('[inventaris] gagal cek SN', String(e));
    return;
  }

  const key = sn.toLowerCase();
  for (const r of recs) {
    if (r.id === rec.id) continue;
    if (String(r.getString('sn_serial') || '').trim().toLowerCase() === key) {
      throw new BadRequestError('SN/Serial sudah dipakai perangkat lain: ' + sn);
    }
  }
}

function validateStockItemName(app, rec) {
  const name = String(rec.getString('nama_barang') || '').trim().replace(/\s+/g, ' ');
  rec.set('nama_barang', name);
  if (!name) return;

  let recs = [];
  try {
    recs = app.findRecordsByFilter('inventaris_non_perangkat', 'id != ""', '', 5000, 0);
  } catch (e) {
    console.log('[inventaris] gagal cek nama barang', String(e));
    return;
  }

  const key = name.toLowerCase();
  for (const r of recs) {
    if (r.id === rec.id) continue;
    if (String(r.getString('nama_barang') || '').trim().replace(/\s+/g, ' ').toLowerCase() === key) {
      throw new BadRequestError('Nama barang sudah ada. Gunakan nama lain atau kelola barang yang sudah ada (tambah stok lewat Mutasi Inventaris).');
    }
  }
}

function validateStockItem(rec) {
  const min = Number(rec.getFloat('stok_minimum') || 0);
  if (min < 0) throw new BadRequestError('Stok minimum tidak boleh negatif');
}

function validateOpeningStock(rec) {
  const stok = Number(rec.getFloat('stok') || 0);
  if (stok !== 0) {
    throw new BadRequestError('Stok awal harus 0. Gunakan Mutasi Inventaris jenis Pengadaan untuk menambah stok.');
  }
  rec.set('stok', 0);
}

function composeDeviceInvNumber(rec) {
  // Format: INV.ST {BULAN}/{TAHUN}/{NO_SERI} (bulan & tahun otomatis WITA, no seri manual)
  let noSeri = '';
  let noInv = '';
  try { noSeri = String(rec.getString('no_seri_inv') || '').trim(); } catch (_) {}
  try { noInv = String(rec.getString('no_inv') || '').trim(); } catch (_) {}
  rec.set('no_seri_inv', noSeri);
  if (!noSeri) {
    // jika user mengosongkan seri manual, kosongkan no_inv juga
    if (!noInv || /^INV\.?\s*ST\b/i.test(noInv)) rec.set('no_inv', '');
    return;
  }
  // Gunakan bulan/tahun dari no_inv yang sudah ada bila valid, agar tidak berubah saat edit.
  let month = '';
  let year = '';
  const m = noInv.match(/INV\.?\s*ST\s*(\d{1,2})\s*\/\s*(\d{4})\s*\/\s*(.+)$/i);
  if (m) { month = String(m[1]).padStart(1, '0'); year = m[2]; }
  if (!month || !year) {
    const now = new Date(Date.now() + 8 * 3600000); // WITA
    month = String(now.getUTCMonth() + 1);
    year = String(now.getUTCFullYear());
  }
  const composed = `INV.ST ${month}/${year}/${noSeri}`;
  rec.set('no_inv', composed);
}

module.exports = { validateDeviceSN, validateStockItemName, validateStockItem, validateOpeningStock, composeDeviceInvNumber };
