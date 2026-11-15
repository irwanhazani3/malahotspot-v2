/// <reference path="../pb_data/types.d.ts" />

let warnedSheets = false;
let lastSync = 0;

function witaString(v){
  if(!v) return '';
  const d = new Date(v);
  if(isNaN(d)) return String(v);
  const w = new Date(d.getTime()+8*3600*1000);
  const pad=n=>String(n).padStart(2,'0');
  const hasTime = String(v).includes(':') || String(v).includes('T');
  if(!hasTime) return `${w.getUTCFullYear()}-${pad(w.getUTCMonth()+1)}-${pad(w.getUTCDate())}`;
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth()+1)}-${pad(w.getUTCDate())} ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

function nameOf(app, collection, id, field='nama'){
  if(!id) return '';
  try {
    const r = app.findRecordById(collection, id);
    const v = r.getString(field) || r.getString('nama_barang') || r.getString('email') || r.getString('keluhan') || id;
    return v;
  } catch(e){ return String(id); }
}

function collectModule(app, name, headers, mapFn){
  const rows=[];
  try{
    const recs = app.findRecordsByFilter(name, 'diarsipkan = false', '', 5000, 0);
    for(const r of recs){ rows.push(mapFn(r, app)); }
  }catch(e){ console.log('[sheets] skip', name, String(e)); }
  return { koleksi:name, nama:name, headers, rows };
}

function syncSheets(app){
  try{
    const url = $os.getenv('SHEETS_WEBHOOK_URL');
    const token = $os.getenv('SHEETS_WEBHOOK_TOKEN');
    if(!url || !token){ if(!warnedSheets){ console.log('[sheets] URL/token belum diatur, sinkron dilewati'); warnedSheets=true; } return; }
    warnedSheets=false;
    const modules = [
      collectModule(app,'pelanggan',['nama','nowa','sn_perangkat','koneksi','vlan','teknisi','keterangan_lokasi','link_maps'], (r,a)=>[r.getString('nama'),r.getString('nowa'),r.getString('sn_perangkat'),r.getString('koneksi'),r.getString('vlan'),nameOf(a,'users',r.getString('teknisi')),r.getString('keterangan_lokasi'),r.getString('link_maps')]),
      collectModule(app,'layanan_gangguan',['pelanggan','keluhan','status','ditugaskan_ke'], (r,a)=>[nameOf(a,'pelanggan',r.getString('pelanggan')),r.getString('keluhan'),r.getString('status'),nameOf(a,'users',r.getString('ditugaskan_ke'))]),
      collectModule(app,'absen_hadir',['teknisi','tanggal','jam_masuk','keterangan','metode','alasan','dicatat_oleh'], (r,a)=>[nameOf(a,'users',r.getString('teknisi')),witaString(r.getString('tanggal')),witaString(r.getString('jam_masuk')),r.getString('keterangan'),r.getString('metode'),r.getString('alasan'),nameOf(a,'users',r.getString('dicatat_oleh'))]),
      collectModule(app,'perbaikan',['pelanggan','gangguan','tanggal','teknisi','tindakan','status'], (r,a)=>[nameOf(a,'pelanggan',r.getString('pelanggan')),r.getString('gangguan'),witaString(r.getString('tanggal')),nameOf(a,'users',r.getString('teknisi')),r.getString('tindakan'),r.getString('status')]),
      collectModule(app,'inventaris_perangkat',['nama','tipe','sn_serial','kondisi','lokasi_pemegang','keterangan'], (r)=>[r.getString('nama'),r.getString('tipe'),r.getString('sn_serial'),r.getString('kondisi'),r.getString('lokasi_pemegang'),r.getString('keterangan')]),
      collectModule(app,'inventaris_non_perangkat',['nama_barang','satuan','stok','stok_minimum','keterangan'], (r)=>[r.getString('nama_barang'),r.getString('satuan'),r.getFloat('stok'),r.getFloat('stok_minimum'),r.getString('keterangan')]),
      collectModule(app,'pemasangan',['pelanggan','tanggal','status','ditugaskan_ke'], (r,a)=>[nameOf(a,'pelanggan',r.getString('pelanggan')),witaString(r.getString('tanggal')),r.getString('status'),nameOf(a,'users',r.getString('ditugaskan_ke'))]),
      collectModule(app,'mutasi_inventaris',['barang','jenis','jumlah','stok_sebelum','stok_sesudah','tanggal','referensi_modul','referensi_id','keterangan','dicatat_oleh'], (r,a)=>[nameOf(a,'inventaris_non_perangkat',r.getString('barang'),'nama_barang'),r.getString('jenis'),r.getFloat('jumlah'),r.getFloat('stok_sebelum'),r.getFloat('stok_sesudah'),witaString(r.getString('tanggal')),r.getString('referensi_modul'),r.getString('referensi_id'),r.getString('keterangan'),nameOf(a,'users',r.getString('dicatat_oleh'))]),
    ];
    const res = $http.send({ url, method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+token}, body: JSON.stringify({modules}), timeout: 30 });
    if(res.statusCode >= 300) console.log('[sheets] gagal status', res.statusCode);
  }catch(e){ console.log('[sheets] error sinkron', String(e)); }
}

// run every minute, but honor interval setting
cronAdd('sheets-sync', '* * * * *', () => {
  try{
    const app = $app;
    let intervalMin = 5;
    try {
      const r = app.findFirstRecordByFilter('pengaturan', 'kunci = "interval_sinkron_sheets"');
      const v = r.get('nilai');
      if (v !== null && v !== undefined && v !== '') intervalMin = Number(v) || 5;
    } catch (e) {}
    intervalMin = Math.max(1, Math.min(1440, intervalMin));
    const now = Date.now();
    if(now - lastSync < intervalMin*60*1000) return;
    lastSync = now;
    syncSheets(app);
  }catch(e){ console.log('[sheets cron]', String(e)); }
});

routerAdd('POST', '/api/sheets/sync', (e) => {
  try{
    if(!e.auth || e.auth.getString('role')!=='admin') return e.json(403,{message:'Hanya admin'});
    syncSheets(e.app);
    return e.json(200,{ok:true});
  } catch(err){ console.log('[sheets manual]', String(err)); return e.json(500,{message:'Gagal sinkron'}); }
});
