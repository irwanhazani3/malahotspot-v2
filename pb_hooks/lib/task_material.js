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
  const grouped = {};
  for(const it of items){
    let b;
    try { b = app.findRecordById('inventaris_non_perangkat', it.barang); }
    catch(e){ throw new BadRequestError('Barang material tidak ditemukan'); }
    if(b.getBool('diarsipkan')) throw new BadRequestError('Barang material nonaktif tidak dapat dipakai: ' + (b.getString('nama_barang')||''));
    if(!grouped[it.barang]) grouped[it.barang] = { rec: b, total: 0 };
    grouped[it.barang].total += it.jumlah;
  }
  // Validasi total per barang, bukan per baris. Dua baris kabel 6+6 dengan
  // stok 10 harus ditolak karena totalnya 12.
  const { validatePlannedUsage } = require(__hooks + '/lib/mutasi.js');
  const tanggal = rec.getString('tanggal') || new Date().toISOString();
  for(const id of Object.keys(grouped)){
    const g = grouped[id];
    const stok = Number(g.rec.getFloat('stok') || 0);
    if(stok < g.total){
      throw new BadRequestError('Stok tidak cukup untuk ' + (g.rec.getString('nama_barang')||'barang') + ' (tersedia: ' + stok + ', diminta: ' + g.total + ')');
    }
    // Tanggal tugas bisa mundur. Simulasikan pemakaian pada urutan
    // kronologisnya agar stok tidak negatif di titik mana pun.
    validatePlannedUsage(app, id, g.total, tanggal);
  }
}

function applyMaterials(e, fromCreate){
  const col = e.record.collection().name;
  const newStatus = e.record.getString('status');
  const recorded = !!e.record.getBool('material_tercatat');
  if(newStatus !== 'Selesai' || recorded || e.record.getBool('diarsipkan')) return;

  const items = parseMaterials(e.record);
  // Jangan tandai material_tercatat jika tidak ada material. Dengan begitu,
  // material masih bisa ditambahkan saat tugas dibuka/diperbarui lagi.
  if(!items.length) return;

  const { recomputeStock, validateMutationSave } = require(__hooks + '/lib/mutasi.js');
  const refMod = col === 'pemasangan' ? 'Pemasangan' : 'Perbaikan';
  const tanggal = e.record.getString('tanggal') || new Date().toISOString();

  const run = function(tx){
    const mutCol = tx.findCollectionByNameOrId('mutasi_inventaris');
    const running = {};
    const touched = [];

    for(const it of items){
      let before = running[it.barang];
      let barang = null;
      if(before === undefined){
        barang = tx.findRecordById('inventaris_non_perangkat', it.barang);
        if(barang.getBool('diarsipkan')) throw new BadRequestError('Barang material nonaktif: ' + (barang.getString('nama_barang')||''));
        before = Number(barang.getFloat('stok') || 0);
      }
      const after = before - it.jumlah;
      if(after < 0){
        const nama = barang ? (barang.getString('nama_barang')||'barang') : it.barang;
        throw new BadRequestError('Stok tidak cukup untuk ' + nama + ' (tersedia: ' + before + ', diminta: ' + it.jumlah + ')');
      }
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

      // Validasi terhadap riwayat nyata (termasuk mutasi bertanggal mundur)
      // sebelum record ditulis. Jika salah satu gagal, transaksi dibatalkan.
      const hasil = validateMutationSave(tx, m, null, 'create');
      if(hasil && hasil.candidate){
        m.set('stok_sebelum', hasil.candidate.before);
        m.set('stok_sesudah', hasil.candidate.after);
      }
      tx.save(m);
    }

    for(const bid of touched){
      recomputeStock(tx, bid);
    }

    const fresh = tx.findRecordById(col, e.record.id);
    fresh.set('material_tercatat', true);
    tx.save(fresh);
  };

  try{
    if(typeof e.app.runInTransaction === 'function') e.app.runInTransaction(run);
    else run(e.app);
    // Jaga agar response request ikut menampilkan status terbaru.
    e.record.set('material_tercatat', true);
  }catch(err){
    console.log('[task material apply]', col, String(err));
    throw err;
  }
}

module.exports = { parseMaterials, validateMaterials, applyMaterials };
