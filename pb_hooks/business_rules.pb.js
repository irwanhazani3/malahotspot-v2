/// <reference path="../pb_data/types.d.ts" />

// Auto-withdraw pending usulan when target record becomes archived/nonaktif
onRecordAfterUpdateSuccess((e) => {
  try{
    const col = e.record.collection().name;
    const master = ['pelanggan','inventaris_perangkat','inventaris_non_perangkat'];
    if(master.indexOf(col) === -1) return e.next();
    const oldA = !!e.record.original().getBool('diarsipkan');
    const newA = !!e.record.getBool('diarsipkan');
    if(oldA === newA || !newA) return e.next();
    const pending = $app.findRecordsByFilter('usulan_perubahan', `modul = "${col}" && record_id = "${e.record.id}" && status = "Menunggu"`, '', 200, 0);
    for(const u of pending){ u.set('status','Ditarik'); u.set('diputuskan', new Date().toISOString()); $app.save(u); }
  }catch(err){ console.log('[usulan auto-withdraw]', err); }
  e.next();
});

// Prevent selecting archived pelanggan for new/updated work records (basic)
onRecordCreateRequest((e)=>{ try{ enforceActiveRefs(e, true); }catch(err){ if(err instanceof BadRequestError) throw err; } e.next(); });
onRecordUpdateRequest((e)=>{ try{ enforceActiveRefs(e, false); }catch(err){ if(err instanceof BadRequestError) throw err; } e.next(); });

function enforceActiveRefs(e, isCreate){
  const name = e.collection && e.collection.name;
  if(['layanan_gangguan','pemasangan','perbaikan'].includes(name)){
    const pid = e.record.getString('pelanggan');
    if(pid){
      try{ const p = e.app.findRecordById('pelanggan', pid); if(p.getBool('diarsipkan')) throw new BadRequestError('Pelanggan nonaktif tidak dapat dipilih'); }catch(err){ if(err instanceof BadRequestError) throw err; }
    }
  }
  if(name === 'mutasi_inventaris'){
    const bid = e.record.getString('barang');
    if(bid){ try{ const b=e.app.findRecordById('inventaris_non_perangkat', bid); if(b.getBool('diarsipkan')) throw new BadRequestError('Barang nonaktif tidak dapat dimutasi'); }catch(err){ if(err instanceof BadRequestError) throw err; } }
  }
}
