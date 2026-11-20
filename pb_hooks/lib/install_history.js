// Pencatatan riwayat pemasangan/pergantian perangkat — di-require DI DALAM callback hook.

function selectedDevices(rec){
  const ids = rec.get('perangkat');
  return Array.isArray(ids) ? ids.map(String) : (ids ? [String(ids)] : []);
}

function witaNowStr(){
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').replace('Z', '');
}

function normalizeDateStr(v){
  if(!v) return witaNowStr();
  const s = String(v);
  if(s.length >= 10) return s; // keep as-is (PocketBase date string)
  return s;
}

function findExisting(app, col, taskId, deviceId){
  try{
    const field = col === 'perbaikan' ? 'perbaikan' : 'pemasangan';
    const rows = app.findRecordsByFilter('riwayat_pemasangan_perangkat', `${field} = {:tid} && perangkat = {:did}`, '', 1, 0, { tid: taskId, did: deviceId });
    return rows && rows[0];
  }catch(_){ return null; }
}

function recordInstallHistory(app, rec, _fromCreate){
  const col = rec.collection().name;
  if(col !== 'pemasangan' && col !== 'perbaikan') return;
  if(rec.getBool('diarsipkan')) return;

  const newStatus = String(rec.getString('status') || '');
  if(newStatus !== 'Selesai') return;

  const devices = selectedDevices(rec).filter(Boolean);
  if(!devices.length) return;

  let pid = String(rec.getString('pelanggan') || '');
  if(!pid && col === 'perbaikan'){
    const gid = String(rec.getString('gangguan') || '');
    if(gid){
      try { const g = app.findRecordById('layanan_gangguan', gid); pid = String(g.getString('pelanggan') || ''); } catch(_){}
    }
  }
  if(!pid) return;

  const taskId = rec.id;
  const newSet = new Set(devices.map(String));

  // Idempoten: jika semua perangkat tugas ini sudah tercatat untuk tugas ini, anggap sudah diproses.
  let allExist = true;
  for(const devId of devices){
    if(!findExisting(app, col, taskId, devId)){ allExist = false; break; }
  }
  if(allExist) return;

  const tanggal = normalizeDateStr(rec.getString('tanggal'));
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '');

  // Riwayat aktif pelanggan saat ini
  let activeCustomer = [];
  try {
    activeCustomer = app.findRecordsByFilter('riwayat_pemasangan_perangkat', 'pelanggan = {:pid} && status = "Aktif"', '-tanggal_pasang', 200, 0, { pid });
  } catch (_) { activeCustomer = []; }

  const hadActiveBefore = activeCustomer.length > 0;

  // Perangkat lama aktif milik pelanggan yang tidak ada di set baru => dicabut/diganti
  for(const h of activeCustomer){
    const oldDev = String(h.getString('perangkat') || '');
    if(!oldDev) continue;
    if(newSet.has(oldDev)) continue; // masih dipakai
    try{
      h.set('status', 'Dicabut');
      h.set('tanggal_dilepas', tanggal);
      const ket = String(h.getString('keterangan') || '');
      const note = 'Diganti pada ' + tanggal.slice(0,10) + ' (' + col + ' ' + taskId + ')';
      h.set('keterangan', ket ? (ket + ' | ' + note) : note);
      app.save(h);
    }catch(e){ console.log('[install history] close old', String(e)); }
    try{
      app.db().newQuery("UPDATE inventaris_perangkat SET kondisi = {:k}, lokasi_pemegang = {:l}, diubah_pada = {:t} WHERE id = {:id}")
        .bind({ k: 'Cabutan', l: 'Kantor', t: now, id: oldDev }).execute();
    }catch(e){ console.log('[install history] set cabutan', String(e)); }
  }

  // Tentukan apakah ini pemasangan pertama untuk pelanggan (berdasarkan riwayat yang pernah ada sebelum event ini)
  let hasAnyHistory = hadActiveBefore;
  if(!hasAnyHistory){
    try{
      const any = app.findRecordsByFilter('riwayat_pemasangan_perangkat', 'pelanggan = {:pid}', '', 1, 0, { pid });
      // ada riwayat milik tugas ini yang mungkin sudah sebagian tercipta? abaikan; cek riwayat lain
      hasAnyHistory = !!((any||[]).some(x => String(x.getString(col === 'pemasangan' ? 'pemasangan' : 'perbaikan') || '') !== taskId));
      if(!hasAnyHistory) hasAnyHistory = !!((any||[]).some(x => String(x.getString('pemasangan')||'') !== taskId && String(x.getString('perbaikan')||'') !== taskId));
    }catch(_){ hasAnyHistory = false; }
  }
  const isFirst = !hasAnyHistory;

  // Buat riwayat aktif untuk setiap perangkat baru (jika belum ada untuk tugas ini)
  for(const devId of devices){
    try{
      const existing = findExisting(app, col, taskId, devId);
      if(existing){
        // pastikan aktif dan data utama benar (jika sebelumnya belum lengkap)
        if(String(existing.getString('status')||'') !== 'Aktif'){
          existing.set('status', 'Aktif');
          existing.set('tanggal_dilepas', '');
          existing.set('tanggal_pasang', tanggal);
          existing.set('pelanggan', pid);
          existing.set('jenis', String(existing.getString('jenis')||'') || (isFirst ? 'Pemasangan Pertama' : 'Penggantian'));
          app.save(existing);
        }
        continue;
      }

      // tutup riwayat aktif perangkat ini pada pelanggan lain (jaga konsistensi)
      try{
        const actDev = app.findRecordsByFilter('riwayat_pemasangan_perangkat', 'perangkat = {:did} && status = "Aktif"', '', 10, 0, { did: devId });
        for(const h of (actDev||[])){
          if(String(h.getString('pelanggan')||'') === pid) continue;
          h.set('status', 'Dicabut');
          h.set('tanggal_dilepas', tanggal);
          const note = 'Dicabut pada ' + tanggal.slice(0,10);
          const ket = String(h.getString('keterangan')||'');
          h.set('keterangan', ket ? (ket + ' | ' + note) : note);
          app.save(h);
        }
      }catch(_){}

      const collection = app.findCollectionByNameOrId('riwayat_pemasangan_perangkat');
      const h = new Record(collection);
      h.set('pelanggan', pid);
      h.set('perangkat', devId);
      if(col === 'pemasangan') h.set('pemasangan', taskId); else h.set('perbaikan', taskId);
      h.set('tanggal_pasang', tanggal);
      h.set('jenis', isFirst ? 'Pemasangan Pertama' : 'Penggantian');
      h.set('status', 'Aktif');
      h.set('keterangan', (col === 'pemasangan' ? 'Pemasangan' : 'Perbaikan') + ' ' + taskId);
      app.save(h);
    }catch(e){ console.log('[install history] record', String(e)); }
  }
}

module.exports = { recordInstallHistory };
