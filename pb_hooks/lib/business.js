// Modul aturan bisnis — di-require DI DALAM callback hook.

function enforceActiveRefs(e, isCreate){
  const name = e.collection && e.collection.name;
  if(['layanan_gangguan','pemasangan','perbaikan'].includes(name)){
    const pid = e.record.getString('pelanggan');
    if(pid){
      try{
        const p = e.app.findRecordById('pelanggan', pid);
        if(p.getBool('diarsipkan')) throw new BadRequestError('Pelanggan nonaktif tidak dapat dipilih');
      }catch(err){ if(err instanceof BadRequestError) throw err; }
    }
  }
  if(name === 'mutasi_inventaris'){
    const bid = e.record.getString('barang');
    if(bid){
      try{
        const b = e.app.findRecordById('inventaris_non_perangkat', bid);
        if(b.getBool('diarsipkan')) throw new BadRequestError('Barang nonaktif tidak dapat dimutasi');
      }catch(err){ if(err instanceof BadRequestError) throw err; }
    }
  }
}

module.exports = { enforceActiveRefs };
