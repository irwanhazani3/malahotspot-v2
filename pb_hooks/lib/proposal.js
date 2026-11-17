// Modul helper usulan — di-require DI DALAM callback hook.

function isAdmin(e){ return e.auth && e.auth.getString('role') === 'admin'; }

function log(app,e,aksi,modul,id,oldV,newV,cat){
  try{
    const c = app.findCollectionByNameOrId('riwayat');
    const r = new Record(c);
    r.set('waktu', new Date().toISOString());
    r.set('aktor', e.auth ? e.auth.id : '');
    r.set('aksi', aksi);
    r.set('modul', modul);
    r.set('record_id', id || '');
    r.set('nilai_lama', oldV || null);
    r.set('nilai_baru', newV || null);
    r.set('catatan', cat || '');
    app.save(r);
  }catch(err){ console.log('[riwayat proposal]', err); }
}

module.exports = { isAdmin, log };
