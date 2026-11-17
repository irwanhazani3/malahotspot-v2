/// <reference path="../pb_data/types.d.ts" />

// Auto-withdraw pending usulan when target record becomes archived/nonaktif
onRecordAfterUpdateSuccess((e) => {
  try{
    const col = e.record.collection().name;
    const master = ['pelanggan','inventaris_perangkat','inventaris_non_perangkat'];
    if(master.indexOf(col) !== -1){
      const oldA = !!e.record.original().getBool('diarsipkan');
      const newA = !!e.record.getBool('diarsipkan');
      if(oldA !== newA && newA){
        const pending = $app.findRecordsByFilter('usulan_perubahan', `modul = "${col}" && record_id = "${e.record.id}" && status = "Menunggu"`, '', 200, 0);
        for(const u of pending){ u.set('status','Ditarik'); u.set('diputuskan', new Date().toISOString()); $app.save(u); }
      }
    }
  }catch(err){ console.log('[usulan auto-withdraw]', err); }
  e.next();
});

// Prevent selecting archived pelanggan/barang for new/updated work records
onRecordCreateRequest((e) => {
  try{
    const { enforceActiveRefs } = require(__hooks + '/lib/business.js');
    enforceActiveRefs(e, true);
  }catch(err){ if(err instanceof BadRequestError) throw err; console.log('[business create]', String(err)); }
  e.next();
});

onRecordUpdateRequest((e) => {
  try{
    const { enforceActiveRefs } = require(__hooks + '/lib/business.js');
    enforceActiveRefs(e, false);
  }catch(err){ if(err instanceof BadRequestError) throw err; console.log('[business update]', String(err)); }
  e.next();
});
