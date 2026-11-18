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

module.exports = { validateDeviceSN, validateStockItem, validateOpeningStock };
