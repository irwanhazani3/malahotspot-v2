// Modul helper komunikasi — di-require DI DALAM callback hook.

function isAdmin(e){ return e.auth && e.auth.getString('role') === 'admin'; }
function authId(e){ return e.auth ? e.auth.id : ''; }

function createdTime(rec){
  try { return new Date(rec.getString('dibuat_pada') || rec.getString('created') || 0).getTime(); } catch(e){ return 0; }
}

function within10Min(rec){
  const t = createdTime(rec);
  return t > 0 && (Date.now() - t) <= 10*60*1000;
}

function logMeta(app,e,aksi,modul,id,catatan){
  try{
    const col=app.findCollectionByNameOrId('riwayat');
    const r=new Record(col);
    r.set('waktu', new Date().toISOString());
    r.set('aktor', authId(e));
    r.set('aksi', aksi);
    r.set('modul', modul);
    r.set('record_id', id||'');
    r.set('catatan', catatan||'');
    r.set('nilai_lama', null);
    r.set('nilai_baru', null);
    app.save(r);
  }catch(err){ console.log('[riwayat meta]', modul, String(err)); }
}

function canAccessTask(app, auth, modul, refId){
  if(!auth) return false;
  if(auth.getString('role') === 'admin') return true;
  try{
    const rec = app.findRecordById(modul, refId);
    if(modul === 'perbaikan') return rec.getString('teknisi') === auth.id;
    return rec.getString('ditugaskan_ke') === auth.id;
  }catch(e){ return false; }
}

module.exports = { isAdmin, authId, createdTime, within10Min, logMeta, canAccessTask };
