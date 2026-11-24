// Sinkronisasi perangkat saat tugas Selesai — di-require DI DALAM callback hook.

function targetLocation(app, rec){
  let lokasi = '';
  try{
    let pid = rec.getString('pelanggan');
    if(!pid && rec.collection().name === 'perbaikan'){
      const gid = rec.getString('gangguan');
      if(gid){
        try { const g = app.findRecordById('layanan_gangguan', gid); pid = g.getString('pelanggan'); } catch(_){}
      }
    }
    if(pid){
      try { const p = app.findRecordById('pelanggan', pid); lokasi = p.getString('nama') || p.id; } catch(_){}
    }
  }catch(_){}
  return lokasi || 'Pelanggan';
}

function selectedDevices(rec){
  const ids = rec.get('perangkat');
  return Array.isArray(ids) ? ids : (ids ? [ids] : []);
}

function validateDeviceAssignment(app, rec){
  const col = rec.collection().name;
  if(col !== 'pemasangan' && col !== 'perbaikan') return;
  if(String(rec.getString('status')) !== 'Selesai') return;
  if(rec.getBool('diarsipkan')) return;

  const list = selectedDevices(rec);
  if(!list.length) return;
  const lokasi = targetLocation(app, rec);

  for(const id of list){
    let dev;
    try { dev = app.findRecordById('inventaris_perangkat', id); }
    catch(e){ throw new BadRequestError('Perangkat tidak ditemukan'); }

    const nama = dev.getString('nama') || dev.id;
    const kondisi = dev.getString('kondisi');
    if(dev.getBool('diarsipkan')) throw new BadRequestError('Perangkat nonaktif tidak dapat dipakai: ' + nama);
    if(kondisi === 'Nonaktif') throw new BadRequestError('Perangkat kondisi Nonaktif tidak dapat dipakai: ' + nama);
    if(col === 'pemasangan' && kondisi === 'Rusak') throw new BadRequestError('Perangkat kondisi Rusak belum dapat dipasang: ' + nama);

    const lokasiLama = String(dev.getString('lokasi_pemegang') || '').trim();
    if(kondisi === 'Terpasang' && lokasiLama && lokasiLama !== lokasi){
      throw new BadRequestError('Perangkat ' + nama + ' sudah terpasang di ' + lokasiLama + '. Ubah kondisinya dulu jika akan dipindahkan.');
    }
  }
}

function syncDevices(e, fromCreate){
  const col = e.record.collection().name;
  if(col !== 'pemasangan' && col !== 'perbaikan') return;
  if(e.record.getBool('diarsipkan')) return;
  const oldStatus = fromCreate ? '' : e.record.original().getString('status');
  const newStatus = e.record.getString('status');
  const oldDev = fromCreate ? [] : selectedDevices(e.record.original());
  const newDev = selectedDevices(e.record);
  const oldDevStr = fromCreate ? '' : String(e.record.original().get('perangkat') || '');
  const newDevStr = String(e.record.get('perangkat') || '');
  if(newStatus !== 'Selesai' || (!fromCreate && oldStatus === 'Selesai' && oldDevStr === newDevStr)) return;

  const lokasi = targetLocation(e.app, e.record);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

  // Set perangkat BARU ke kondisi Terpasang
  for(const id of newDev){
    try{
      const dev = e.app.findRecordById('inventaris_perangkat', id);
      if(dev.getBool('diarsipkan')) continue;
      e.app.db().newQuery(
        "UPDATE inventaris_perangkat SET kondisi = {:k}, lokasi_pemegang = {:l}, diubah_pada = {:t} WHERE id = {:id}"
      ).bind({
        k: 'Terpasang',
        l: lokasi,
        t: now,
        id: id,
      }).execute();
    }catch(err){ console.log('[task device sync terpasang]', col, String(err)); }
  }

  // Set perangkat LAMA yang dilepas (tidak ada di list baru) ke kondisi Cabutan
  const newSet = new Set(newDev.map(String));
  for(const id of oldDev){
    if(newSet.has(String(id))) continue; // masih dipakai, skip
    try{
      const dev = e.app.findRecordById('inventaris_perangkat', id);
      if(dev.getBool('diarsipkan')) continue;
      // Hanya ubah jika sebelumnya Terpasang — jangan overwrite kondisi manual lain
      if(dev.getString('kondisi') !== 'Terpasang') continue;
      e.app.db().newQuery(
        "UPDATE inventaris_perangkat SET kondisi = {:k}, diubah_pada = {:t} WHERE id = {:id}"
      ).bind({
        k: 'Cabutan',
        t: now,
        id: id,
      }).execute();
      console.log('[task device sync cabutan]', col, id);
    }catch(err){ console.log('[task device sync cabutan]', col, String(err)); }
  }
}

module.exports = { syncDevices, validateDeviceAssignment, targetLocation };
