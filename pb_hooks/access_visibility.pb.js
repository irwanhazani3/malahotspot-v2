/// <reference path="../pb_data/types.d.ts" />

// Enforce komentar_tugas visibility (participants/admin only)
onRecordsListRequest((e) => {
  try{
    const { canAccessTask } = require(__hooks + '/lib/access.js');
    if(e.collection && e.collection.name === 'komentar_tugas'){
      const auth = e.auth;
      if(!auth){ e.records = []; }
      else if(auth.getString('role') !== 'admin'){
        const filtered = [];
        for(const r of (e.records || [])){
          try{
            if(canAccessTask(e.app, auth, r.getString('modul_referensi'), r.getString('referensi_id'))) filtered.push(r);
          }catch(_){}
        }
        e.records = filtered;
      }
    }
  }catch(err){ console.log('[visibility list]', String(err)); }
  e.next();
});

onRecordViewRequest((e) => {
  try{
    const { canAccessTask } = require(__hooks + '/lib/access.js');
    if(e.collection && e.collection.name === 'komentar_tugas'){
      const auth = e.auth;
      if(!auth) throw new ForbiddenError('Tidak diizinkan');
      if(auth.getString('role') !== 'admin'){
        if(!canAccessTask(e.app, auth, e.record.getString('modul_referensi'), e.record.getString('referensi_id'))) throw new ForbiddenError('Tidak diizinkan');
      }
    }
  }catch(err){ if(err instanceof ForbiddenError) throw err; console.log('[visibility view]', String(err)); }
  e.next();
});

// Extra safety: ensure pesan_langsung only for participants even if rule bypassed
onRecordsListRequest((e) => {
  try{
    if(e.collection && e.collection.name === 'pesan_langsung'){
      const auth = e.auth;
      if(!auth){ e.records = []; }
      else {
        const uid = auth.id;
        e.records = (e.records||[]).filter(r => r.getString('pengirim')===uid || r.getString('penerima')===uid || String(r.getString('percakapan')||'').includes(uid));
      }
    }
  }catch(err){ console.log('[pesan visibility]', String(err)); }
  e.next();
});

onRecordViewRequest((e) => {
  try{
    if(e.collection && e.collection.name === 'pesan_langsung'){
      const auth = e.auth; if(!auth) throw new ForbiddenError('Tidak diizinkan');
      const uid = auth.id;
      const r = e.record;
      if(!(r.getString('pengirim')===uid || r.getString('penerima')===uid || String(r.getString('percakapan')||'').includes(uid))) throw new ForbiddenError('Tidak diizinkan');
    }
  }catch(err){ if(err instanceof ForbiddenError) throw err; console.log('[pesan view]', String(err)); }
  e.next();
});
