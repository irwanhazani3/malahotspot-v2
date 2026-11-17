/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  try{
    const h = require(__hooks + '/lib/communication.js');
    const name = e.collection.name;
    if(name === 'komentar_tugas'){
      const modul = e.record.getString('modul_referensi'); const refId = e.record.getString('referensi_id');
      if(!['layanan_gangguan','perbaikan','pemasangan'].includes(modul)) throw new BadRequestError('Modul referensi tidak valid');
      if(!h.canAccessTask(e.app, e.auth, modul, refId)) throw new ForbiddenError('Tidak berhak mengomentari tugas ini');
      e.record.set('pengirim', h.authId(e));
    }
    if(name === 'pesan_langsung'){
      const penerima = e.record.getString('penerima'); const pengirim = h.authId(e);
      if(!penerima || !pengirim) throw new BadRequestError('Pesan tidak valid');
      if(penerima === pengirim) throw new BadRequestError('Penerima tidak valid');
      const ids = [pengirim, penerima].sort();
      e.record.set('pengirim', pengirim);
      e.record.set('percakapan', ids.join('__'));
    }
    if(name === 'pengumuman'){
      if(!h.isAdmin(e)) throw new ForbiddenError('Hanya admin dapat membuat pengumuman');
      e.record.set('pembuat', h.authId(e));
    }
  }catch(err){ if(err instanceof ForbiddenError || err instanceof BadRequestError) throw err; console.log('[comm create]', String(err)); }
  e.next();
});

onRecordUpdateRequest((e) => {
  try{
    const h = require(__hooks + '/lib/communication.js');
    const name = e.collection.name;
    if(name === 'komentar_tugas' || name === 'pesan_langsung'){
      const orig = e.record.original();
      const pengirim = orig.getString('pengirim');
      if(pengirim !== h.authId(e)) throw new ForbiddenError('Hanya pengirim dapat mengubah');
      if(!h.within10Min(orig)) throw new ForbiddenError('Batas 10 menit telah lewat');
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
      if(!h.isAdmin(e)) throw new ForbiddenError('Hanya admin');
      const orig = e.record.original();
      const contentChanged = orig.getString('judul')!==e.record.getString('judul') || orig.getString('isi')!==e.record.getString('isi');
      if(contentChanged && !h.within10Min(orig)) throw new ForbiddenError('Batas 10 menit edit konten telah lewat');
    }
  }catch(err){ if(err instanceof ForbiddenError || err instanceof BadRequestError) throw err; console.log('[comm update]', String(err)); }
  e.next();
});

onRecordDeleteRequest((e) => {
  try{
    const h = require(__hooks + '/lib/communication.js');
    const name = e.collection.name;
    if(name === 'komentar_tugas' || name === 'pesan_langsung'){
      const orig = e.record.original();
      const pengirim = orig.getString('pengirim');
      if(pengirim !== h.authId(e)) throw new ForbiddenError('Hanya pengirim dapat menghapus');
      if(!h.within10Min(orig)) throw new ForbiddenError('Batas 10 menit telah lewat');
    }
    if(name === 'pengumuman'){
      if(!h.isAdmin(e)) throw new ForbiddenError('Hanya admin');
      if(!h.within10Min(e.record.original())) throw new ForbiddenError('Batas 10 menit hapus telah lewat; gunakan arsip');
    }
  }catch(err){ if(err instanceof ForbiddenError || err instanceof BadRequestError) throw err; console.log('[comm delete]', String(err)); }
  e.next();
});

onRecordAfterUpdateSuccess((e)=>{
  const n=e.record.collection().name;
  if(['komentar_tugas','pesan_langsung','pengumuman'].includes(n)){
    const h=require(__hooks + '/lib/communication.js');
    h.logMeta(e.app,e,'ubah',n,e.record.id,'metadata komunikasi');
  }
  e.next();
});

onRecordAfterDeleteSuccess((e)=>{
  const n=e.record.collection().name;
  if(['komentar_tugas','pesan_langsung','pengumuman'].includes(n)){
    const h=require(__hooks + '/lib/communication.js');
    h.logMeta(e.app,e,'ubah',n,e.record.id,'hapus metadata');
  }
  e.next();
});
