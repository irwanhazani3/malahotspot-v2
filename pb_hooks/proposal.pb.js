/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e)=>{
  try{
    if(e.collection.name==='usulan_perubahan'){
      e.record.set('pemohon', e.auth?e.auth.id:'');
      e.record.set('status','Menunggu');
      // ensure single pending per record
      try{
        const ex = e.app.findRecordsByFilter('usulan_perubahan', `modul = "${e.record.getString('modul')}" && record_id = "${e.record.getString('record_id')}" && status = "Menunggu"`, '', 1, 0);
        if(ex && ex.length) throw new BadRequestError('Sudah ada usulan Menunggu untuk data ini');
      }catch(err){ if(err instanceof BadRequestError) throw err; }
    }
  }catch(err){ if(err instanceof BadRequestError||err instanceof ForbiddenError) throw err; console.log('[usulan create]', err); }
  e.next();
});

routerAdd('POST', '/api/usulan/:id/decide', (e) => {
  try{
    const { isAdmin, log } = require(__hooks + '/lib/proposal.js');
    if(!isAdmin(e)) return e.json(403,{message:'Hanya admin'});
    const id = e.request.pathValue('id');
    const body = e.requestInfo().body || {};
    const action = body.action; // setujui, tolak, ubah_setujui, tarik
    const rec = e.app.findRecordById('usulan_perubahan', id);
    const status = rec.getString('status');
    if(status !== 'Menunggu' && !(action==='tarik' && status==='Menunggu')) {
      // allow admin decide only when pending except special cases
    }
    if(action === 'tolak'){
      const alasan = String(body.alasan_tolak||'').trim(); if(!alasan) return e.json(400,{message:'Alasan tolak wajib'});
      rec.set('status','Ditolak'); rec.set('peninjau', e.auth.id); rec.set('alasan_tolak', alasan); rec.set('diputuskan', new Date().toISOString());
      e.app.save(rec); log(e.app,e,'tolak','usulan_perubahan',id,null,rec,null); return e.json(200,{ok:true});
    }
    if(action === 'tarik'){
      return e.json(403,{message:'Penarikan hanya oleh pemohon'});
    }
    if(action === 'setujui' || action === 'ubah_setujui'){
      let nilai = rec.get('nilai_usulan');
      if(action==='ubah_setujui' && body.nilai_usulan) nilai = body.nilai_usulan;
      const modul = rec.getString('modul'); const rid = rec.getString('record_id');
      const target = e.app.findRecordById(modul, rid);
      if(target.getBool('diarsipkan')){ rec.set('status','Ditarik'); e.app.save(rec); return e.json(400,{message:'Data sasaran nonaktif, usulan ditarik'}); }
      const old = JSON.parse(JSON.stringify(target));
      if(typeof nilai === 'object' && nilai){
        for(const k of Object.keys(nilai)){
          if(['id','collectionId','collectionName','dibuat_pada','diubah_pada','diarsipkan','diarsipkan_oleh','diarsipkan_pada','stok','stok_sebelum','stok_sesudah','dicatat_oleh','pemohon','peninjau','diputuskan','status'].includes(k)) continue;
          target.set(k, nilai[k]);
        }
      }
      e.app.save(target);
      rec.set('status','Disetujui'); rec.set('peninjau', e.auth.id); rec.set('diputuskan', new Date().toISOString()); if(action==='ubah_setujui') rec.set('nilai_usulan', nilai);
      e.app.save(rec); log(e.app,e,'setujui','usulan_perubahan',id,old,{target:rid, applied: nilai},'usulan disetujui');
      return e.json(200,{ok:true});
    }
    return e.json(400,{message:'Aksi tidak dikenal'});
  }catch(err){ console.log('[usulan decide]', err); return e.json(500,{message:'Gagal memproses usulan'}); }
});

routerAdd('POST', '/api/usulan/:id/withdraw', (e) => {
  try{
    const { log } = require(__hooks + '/lib/proposal.js');
    if(!e.auth) return e.json(401,{message:'Harus login'});
    const id = e.request.pathValue('id');
    const rec = e.app.findRecordById('usulan_perubahan', id);
    if(rec.getString('pemohon') !== e.auth.id) return e.json(403,{message:'Hanya pemohon'});
    if(rec.getString('status') !== 'Menunggu') return e.json(400,{message:'Hanya usulan Menunggu yang bisa ditarik'});
    rec.set('status','Ditarik'); rec.set('diputuskan', new Date().toISOString()); e.app.save(rec);
    log(e.app,e,'tarik','usulan_perubahan',id,null,rec,null);
    return e.json(200,{ok:true});
  }catch(err){ console.log('[usulan withdraw]', err); return e.json(500,{message:'Gagal menarik usulan'}); }
});
