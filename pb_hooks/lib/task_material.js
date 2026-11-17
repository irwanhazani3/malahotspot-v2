// Logika material tugas — di-require DI DALAM callback hook.

function parseMaterials(rec){
  let raw = rec.get('material_pemakaian');
  if(typeof raw === 'string'){
    try { raw = JSON.parse(raw || '[]'); } catch(e){ raw = []; }
  }
  if(raw && typeof raw !== 'string' && raw.length && typeof raw[0] === 'number'){
    try {
      let s = '';
      try { s = toString(raw); } catch(_) { s = String.fromCharCode.apply(null, raw); }
      raw = JSON.parse(s || '[]');
    } catch(e){ raw = []; }
  }
  if(!Array.isArray(raw)) raw = [];
  const out = [];
  for(const it of raw){
    if(!it) continue;
    const barang = String(it.barang || '').trim();
    const jumlah = Number(it.jumlah || 0);
    if(!barang || !(jumlah > 0)) continue;
    out.push({ barang, jumlah, keterangan: String(it.keterangan || '').trim() });
  }
  return out;
}

function validateMaterials(app, rec){
  const items = parseMaterials(rec);
  for(const it of items){
    let b;
    try { b = app.findRecordById('inventaris_non_perangkat', it.barang); }
    catch(e){ throw new BadRequestError('Barang material tidak ditemukan'); }
    if(b.getBool('diarsipkan')) throw new BadRequestError('Barang material nonaktif tidak dapat dipakai: ' + (b.getString('nama_barang')||''));
    const stok = Number(b.getFloat('stok') || 0);
    if(stok < it.jumlah) throw new BadRequestError('Stok tidak cukup untuk ' + (b.getString('nama_barang')||'barang') + ' (tersedia: ' + stok + ', diminta: ' + it.jumlah + ')');
  }
}

function applyMaterials(e, fromCreate){
  const col = e.record.collection().name;
  const oldStatus = fromCreate ? '' : e.record.original().getString('status');
  const newStatus = e.record.getString('status');
  const recorded = !!e.record.getBool('material_tercatat');
  if(newStatus !== 'Selesai' || (!fromCreate && oldStatus === 'Selesai') || recorded) return;

  const items = parseMaterials(e.record);
  if(!items.length){
    try{ e.record.set('material_tercatat', true); e.app.save(e.record); }catch(_){ }
    return;
  }

  const { recomputeStock } = require(__hooks + '/lib/mutasi.js');
  const refMod = col === 'pemasangan' ? 'Pemasangan' : 'Perbaikan';
  const tanggal = e.record.getString('tanggal') || new Date().toISOString();
  const mutCol = e.app.findCollectionByNameOrId('mutasi_inventaris');
  const running = {};
  const touched = [];
  for(const it of items){
    try{
      let before = running[it.barang];
      if(before === undefined){
        const barang = e.app.findRecordById('inventaris_non_perangkat', it.barang);
        before = Number(barang.getFloat('stok') || 0);
      }
      const after = before - it.jumlah;
      running[it.barang] = after;
      if(touched.indexOf(it.barang) === -1) touched.push(it.barang);
      const m = new Record(mutCol);
      m.set('barang', it.barang);
      m.set('jenis', 'Pemakaian');
      m.set('jumlah', it.jumlah);
      m.set('stok_sebelum', before);
      m.set('stok_sesudah', after);
      m.set('tanggal', tanggal);
      m.set('referensi_modul', refMod);
      m.set('referensi_id', e.record.id);
      const ket = it.keterangan ? ('Pemakaian otomatis ('+refMod+'): '+it.keterangan) : ('Pemakaian otomatis - '+refMod+' '+e.record.id.slice(0,8));
      m.set('keterangan', ket);
      if(e.auth) m.set('dicatat_oleh', e.auth.id);
      e.app.save(m);
    }catch(err){ console.log('[task material apply item]', col, String(err)); }
  }
  for(const bid of touched){
    try { recomputeStock(e.app, bid); } catch(err){ console.log('[task material recompute]', String(err)); }
  }
  try{ e.record.set('material_tercatat', true); e.app.save(e.record); }catch(err){ console.log('[task material flag]', String(err)); }
}

module.exports = { parseMaterials, validateMaterials, applyMaterials };
