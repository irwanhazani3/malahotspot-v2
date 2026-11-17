/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/api/absen/qr', (e) => {
  try {
    const q = require(__hooks + '/lib/qr.js');
    if(!e.auth || e.auth.getString('role') !== 'admin') return e.json(403,{message:'Hanya admin'});
    const t = q.makeQrToken(e.app);
    return e.json(200, t);
  } catch(err){ console.log('[qr gen]', err); return e.json(500,{message:'Gagal membuat QR'}); }
});

routerAdd('POST', '/api/absen/scan', (e) => {
  try {
    const q = require(__hooks + '/lib/qr.js');
    if(!e.auth) return e.json(401,{message:'Harus login'});
    const role = e.auth.getString('role');
    if(role !== 'teknisi' && role !== 'admin') return e.json(403,{message:'Tidak diizinkan'});
    const info = e.requestInfo().body || {};
    const token = info.token;
    const v = q.verifyQrToken(e.app, token);
    if(!v.ok) return e.json(400,{message: v.reason==='used' ? 'QR sudah digunakan' : 'QR tidak valid/kadaluarsa'});
    // jam tutup
    const tutup = String(q._getSettingQr(e.app,'jam_tutup_absen','23:59'));
    const hh = Number((tutup.split(':')[0]||0)), mm = Number((tutup.split(':')[1]||0));
    const wn = q.witaNow();
    const minutesNow = wn.getUTCHours()*60 + wn.getUTCMinutes();
    if(minutesNow > (hh*60+mm)) return e.json(400,{message:'Lewat jam tutup absen'});
    const day = q.witaDateStr(wn);
    const uid = e.auth.id;
    const existing = e.app.findRecordsByFilter('absen_hadir', `teknisi = "${uid}" && tanggal >= "${day} 00:00:00" && tanggal <= "${day} 23:59:59"`, '', 1, 0);
    if(existing && existing.length) return e.json(400,{message:'Absen hari ini sudah ada'});
    const col = e.app.findCollectionByNameOrId('absen_hadir');
    const r = new Record(col);
    r.set('teknisi', uid); r.set('tanggal', day+' 00:00:00'); r.set('jam_masuk', new Date().toISOString());
    r.set('keterangan','Hadir'); r.set('metode','QR'); r.set('dicatat_oleh', uid);
    e.app.save(r);
    try {
      const nc = e.app.findCollectionByNameOrId('qr_nonce_terpakai');
      const nr = new Record(nc);
      nr.set('nonce', v.nonce);
      nr.set('digunakan_pada', new Date().toISOString());
      nr.set('teknisi', uid);
      e.app.save(nr);
    } catch(err2) { console.log('[qr nonce save]', String(err2)); }
    return e.json(200,{ok:true, id:r.id});
  } catch(err){ console.log('[qr scan]', err); return e.json(500,{message:'Gagal mencatat absen'}); }
});

routerAdd('GET', '/api/absen/today', (e) => {
  try {
    const q = require(__hooks + '/lib/qr.js');
    if(!e.auth || e.auth.getString('role') !== 'admin') return e.json(403,{message:'Hanya admin'});
    const day = q.witaDateStr();
    const items = e.app.findRecordsByFilter('absen_hadir', `tanggal >= "${day} 00:00:00" && tanggal <= "${day} 23:59:59" && diarsipkan = false`, '-dibuat_pada', 200, 0);
    return e.json(200,{items: items.map(r=>({id:r.id, teknisi:r.getString('teknisi'), tanggal:r.getString('tanggal'), jam_masuk:r.getString('jam_masuk'), keterangan:r.getString('keterangan'), metode:r.getString('metode')}))});
  } catch(err){ console.log('[absen today]', err); return e.json(500,{message:'Gagal memuat'}); }
});
