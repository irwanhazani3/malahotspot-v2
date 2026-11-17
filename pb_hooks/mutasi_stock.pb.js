/// <reference path="../pb_data/types.d.ts" />

onRecordAfterUpdateSuccess((e) => {
  try{
    if(e.record.collection().name === 'mutasi_inventaris'){
      const { recomputeStock, needsRecompute } = require(__hooks + '/lib/mutasi.js');
      if(needsRecompute(e)){
        const barangId = e.record.getString('barang');
        const oldBarang = e.record.original().getString('barang');
        recomputeStock(e.app, barangId);
        if(oldBarang && oldBarang !== barangId) recomputeStock(e.app, oldBarang);
      }
    }
  }catch(err){ console.log('[mutasi update recompute]', String(err)); }
  e.next();
});

onRecordAfterDeleteSuccess((e) => {
  try{
    if(e.record.collection().name === 'mutasi_inventaris'){
      const { recomputeStock } = require(__hooks + '/lib/mutasi.js');
      recomputeStock(e.app, e.record.getString('barang'));
    }
  }catch(err){ console.log('[mutasi delete recompute]', String(err)); }
  e.next();
});
