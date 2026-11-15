/// <reference path="../pb_data/types.d.ts" />

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
    const col=app.findCollectionByNameOrId('riwayat'); const r=new Record(col);
    r.set('waktu', new Date().toISOString()); r.set('aktor', authId(e)); r.set('aksi', aksi); r.set('modul', modul); r.set('record_id', id||''); r.set('catatan', catatan||''); r.set('nilai_lama', null); r.set('nilai_baru', null);
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

onRecordCreateRequest((e) => {
  try{
    const name = e.collection.name;
    if(name === 'komentar_tugas'){
      const modul = e.record.getString('modul_referensi'); const refId = e.record.getString('referensi_id');
      if(!['layanan_gangguan','perbaikan','pemasangan'].includes(modul)) throw new BadRequestError('Modul referensi tidak valid');
      if(!canAccessTask(e.app, e.auth, modul, refId)) throw new ForbiddenError('Tidak berhak mengomentari tugas ini');
      e.record.set('pengirim', authId(e));
    }
    if(name === 'pesan_langsung'){
      const penerima = e.record.getString('penerima'); const pengirim = authId(e);
      if(!penerima || !pengirim) throw new BadRequestError('Pesan tidak valid');
      if(penerima === pengirim) throw new BadRequestError('Penerima tidak valid');
      const ids = [pengirim, penerima].sort();
      e.record.set('pengirim', pengirim);
      e.record.set('percakapan', ids.join('__'));
    }
    if(name === 'pengumuman'){
      if(!isAdmin(e)) throw new ForbiddenError('Hanya admin dapat membuat pengumuman');
      e.record.set('pembuat', authId(e));
    }
  }catch(err){ if(err instanceof ForbiddenError || err instanceof BadRequestError) throw err; console.log('[comm create]', String(err)); }
  e.next();
});

onRecordUpdateRequest((e) => {
  try{
    const name = e.collection.name;
    if(name === 'komentar_tugas' || name === 'pesan_langsung'){
      const orig = e.record.original();
      const pengirim = orig.getString('pengirim');
      if(pengirim !== authId(e)) throw new ForbiddenError('Hanya pengirim dapat mengubah');
      if(!within10Min(orig)) throw new ForbiddenError('Batas 10 menit telah lewat');
      // prevent changing ownership/references
      if(name==='komentar_tugas'){
        e.record.set('pengirim', pengirim);
        e.record.set('modul_referensi', orig.getString('modul_referensi'));
        e.record.set('referensi_id', orig.getString('referensi_id'));
      }
      if(name==='pesan_langsung'){
        e.record.set('pengirim', pengirim);
        e.record.set('penerima', orig.getString('penerima'));
        e.record.set('percakapan', orig.getString('percakapan'));
      }
    }
    if(name === 'pengumuman'){
      if(!isAdmin(e)) throw new ForbiddenError('Hanya admin');
      const orig = e.record.original();
      const contentChanged = orig.getString('judul')!==e.record.getString('judul') || orig.getString('isi')!==e.record.getString('isi');
      // photo changes count as content change (best-effort via field presence not deep-compared)
      if(contentChanged && !within10Min(orig)) throw new ForbiddenError('Batas 10 menit edit konten telah lewat');
    }
  }catch(err){ if(err instanceof ForbiddenError || err instanceof BadRequestError) throw err; console.log('[comm update]', String(err)); }
  e.next();
});

onRecordDeleteRequest((e) => {
  try{
    const name = e.collection.name;
    if(name === 'komentar_tugas' || name === 'pesan_langsung'){
      const orig = e.record.original();
      const pengirim = orig.getString('pengirim');
      if(pengirim !== authId(e)) throw new ForbiddenError('Hanya pengirim dapat menghapus');
      if(!within10Min(orig)) throw new ForbiddenError('Batas 10 menit telah lewat');
    }
    if(name === 'pengumuman'){
      if(!isAdmin(e)) throw new ForbiddenError('Hanya admin');
      if(!within10Min(e.record.original())) throw new ForbiddenError('Batas 10 menit hapus telah lewat; gunakan arsip');
    }
  }catch(err){ if(err instanceof ForbiddenError || err instanceof BadRequestError) throw err; console.log('[comm delete]', String(err)); }
  e.next();
});

onRecordAfterUpdateSuccess((e)=>{ const n=e.record.collection().name; if(['komentar_tugas','pesan_langsung','pengumuman'].includes(n)){ logMeta(e.app,e,'ubah',n,e.record.id,'metadata komunikasi'); } e.next(); });
onRecordAfterDeleteSuccess((e)=>{ const n=e.record.collection().name; if(['komentar_tugas','pesan_langsung','pengumuman'].includes(n)){ logMeta(e.app,e,'ubah',n,e.record.id,'hapus metadata'); } e.next(); });
