// Sinkronisasi perangkat saat tugas Selesai — di-require DI DALAM callback hook.

function syncDevices(e, fromCreate){
  const col = e.record.collection().name;
  if(col !== 'pemasangan' && col !== 'perbaikan') return;
  const oldStatus = fromCreate ? '' : e.record.original().getString('status');
  const newStatus = e.record.getString('status');
  if(newStatus !== 'Selesai' || (!fromCreate && oldStatus === 'Selesai')) return;

  const ids = e.record.get('perangkat');
  const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
  if(!list.length) return;

  let lokasi = '';
  try{
    let pid = e.record.getString('pelanggan');
    if(!pid && col === 'perbaikan'){
      const gid = e.record.getString('gangguan');
      if(gid){
        try { const g = e.app.findRecordById('layanan_gangguan', gid); pid = g.getString('pelanggan'); } catch(_){}
      }
    }
    if(pid){
      try { const p = e.app.findRecordById('pelanggan', pid); lokasi = p.getString('nama') || p.id; } catch(_){}
    }
  }catch(_){}
  if(!lokasi) lokasi = 'Pelanggan';

  for(const id of list){
    try{
      const dev = e.app.findRecordById('inventaris_perangkat', id);
      if(dev.getBool('diarsipkan')) continue;
      dev.set('kondisi', 'Terpasang');
      dev.set('lokasi_pemegang', lokasi);
      e.app.save(dev);
    }catch(err){ console.log('[task device sync]', col, String(err)); }
  }
}

module.exports = { syncDevices };
