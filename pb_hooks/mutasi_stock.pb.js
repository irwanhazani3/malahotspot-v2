/// <reference path="../pb_data/types.d.ts" />

// Validasi sebelum perubahan mutasi disimpan. Jika arsip/ubah/hapus akan
// membuat stok negatif di titik mana pun, request ditolak.
onRecordUpdateRequest((e) => {
  try {
    if (e.collection && e.collection.name === 'mutasi_inventaris') {
      const { validateMutationSave } = require(__hooks + '/lib/mutasi.js');
      validateMutationSave(e.app, e.record, e.record.original(), 'update');
    }
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[mutasi update validate]', String(err));
  }
  e.next();
});

onRecordDeleteRequest((e) => {
  try {
    if (e.collection && e.collection.name === 'mutasi_inventaris') {
      const { validateMutationSave } = require(__hooks + '/lib/mutasi.js');
      const rec = e.record || e.app.findRecordById('mutasi_inventaris', e.request.pathValue('id'));
      validateMutationSave(e.app, rec, rec, 'delete');
    }
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[mutasi delete validate]', String(err));
  }
  e.next();
});

onRecordAfterUpdateSuccess((e) => {
  try {
    if (e.record.collection().name === 'mutasi_inventaris') {
      const { recomputeStock } = require(__hooks + '/lib/mutasi.js');
      const barangId = e.record.getString('barang');
      const oldBarang = e.record.original().getString('barang');
      recomputeStock(e.app, barangId);
      if (oldBarang && oldBarang !== barangId) recomputeStock(e.app, oldBarang);
    }
  } catch (err) { console.log('[mutasi update recompute]', String(err)); }
  e.next();
});

onRecordAfterDeleteSuccess((e) => {
  try {
    if (e.record.collection().name === 'mutasi_inventaris') {
      const { recomputeStock } = require(__hooks + '/lib/mutasi.js');
      recomputeStock(e.app, e.record.getString('barang'));
    }
  } catch (err) { console.log('[mutasi delete recompute]', String(err)); }
  e.next();
});
