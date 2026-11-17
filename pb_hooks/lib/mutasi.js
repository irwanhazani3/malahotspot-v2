// Modul recompute stok — di-require DI DALAM callback hook.

const _recomputing = {};

function recomputeStock(app, barangId){
  if(!barangId || _recomputing[barangId]) return;
  _recomputing[barangId] = true;
  try{
    const recs = app.findRecordsByFilter('mutasi_inventaris', `barang = "${barangId}" && diarsipkan = false`, '+tanggal,+dibuat_pada', 5000, 0);
    let stok = 0;
    for(const r of recs){
      const jenis = r.getString('jenis');
      const jumlah = Number(r.getFloat('jumlah') || 0);
      const ket = r.getString('keterangan') || '';
      const before = stok;
      if(jenis === 'Pengadaan') stok = stok + jumlah;
      else if(jenis === 'Pemakaian') stok = stok - jumlah;
      else if(jenis === 'Penyesuaian'){
        const arah = String(r.getString('arah_penyesuaian') || '').trim();
        if(arah === 'Kurang') stok = stok - jumlah;
        else if(arah === 'Tambah') stok = stok + jumlah;
        else {
          const k = ket.toLowerCase();
          if(k.includes('kurang') || k.includes('minus') || k.includes('turun') || k.trim().startsWith('-')) stok = stok - jumlah; else stok = stok + jumlah;
        }
      }
      if(stok < 0) stok = 0;
      try {
        const oldBefore = Number(r.getFloat('stok_sebelum') || 0);
        const oldAfter = Number(r.getFloat('stok_sesudah') || 0);
        if(oldBefore !== before || oldAfter !== stok){
          r.set('stok_sebelum', before);
          r.set('stok_sesudah', stok);
          app.save(r);
        }
      } catch(e){}
    }
    try {
      const barang = app.findRecordById('inventaris_non_perangkat', barangId);
      if(Number(barang.getFloat('stok') || 0) !== stok){ barang.set('stok', stok); app.save(barang); }
    } catch(e){}
  }catch(e){ console.log('[recompute stok]', String(e)); }
  finally { delete _recomputing[barangId]; }
}

function needsRecompute(e){
  try{
    const o = e.record.original();
    const n = e.record;
    return o.getString('barang') !== n.getString('barang') ||
      o.getString('jenis') !== n.getString('jenis') ||
      Number(o.getFloat('jumlah')||0) !== Number(n.getFloat('jumlah')||0) ||
      String(o.getString('keterangan')||'') !== String(n.getString('keterangan')||'') ||
      String(o.getString('arah_penyesuaian')||'') !== String(n.getString('arah_penyesuaian')||'') ||
      !!o.getBool('diarsipkan') !== !!n.getBool('diarsipkan');
  }catch(e){ return true; }
}

module.exports = { recomputeStock, needsRecompute };
