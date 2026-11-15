/// <reference path="../pb_data/types.d.ts" />

function _getSettingQr(app, key, defVal){
  try {
    const rec = app.findFirstRecordByFilter('pengaturan', `kunci = "${key}"`);
    const v = rec.get('nilai');
    return (v === null || v === undefined || v === '') ? defVal : v;
  } catch(e){ return defVal; }
}
function witaNow(){ return new Date(Date.now() + 8*3600*1000); }
function witaDateStr(d=new Date(Date.now()+8*3600*1000)){ const y=d.getUTCFullYear(), m=String(d.getUTCMonth()+1).padStart(2,'0'), da=String(d.getUTCDate()).padStart(2,'0'); return `${y}-${m}-${da}`; }
function hmac(data, secret){
  // PocketBase JSVM provides $security; fallback simple hash not cryptographically strong if unavailable.
  try { return $security.hs256(data, secret); } catch(e) {
    try { return require('crypto').createHmac('sha256', secret).update(data).digest('hex'); } catch(_){ return ''; }
  }
}

function makeQrToken(app){
  const secret = $os.getenv('QR_SECRET') || 'change-me';
  const interval = Number(_getSettingQr(app,'interval_qr',30)) || 30;
  const slot = Math.floor(Date.now() / (interval*1000));
  const nonce = $security.randomString(12);
  const payload = `${slot}.${nonce}`;
  const sig = hmac(payload, secret);
  return { token: `${payload}.${sig}`, slot, interval, expires_in: interval - (Math.floor(Date.now()/1000) % interval) };
}

function verifyQrToken(app, token){
  const secret = $os.getenv('QR_SECRET') || 'change-me';
  const interval = Number(_getSettingQr(app,'interval_qr',30)) || 30;
  const parts = String(token||'').split('.');
  if(parts.length !== 3) return { ok:false, reason:'format' };
  const [slotStr, nonce, sig] = parts;
  const payload = `${slotStr}.${nonce}`;
  const expected = hmac(payload, secret);
  if(!sig || sig !== expected) return { ok:false, reason:'signature' };
  const slot = Number(slotStr);
  const nowSlot = Math.floor(Date.now() / (interval*1000));
  if(slot !== nowSlot) return { ok:false, reason:'expired' };
  // one-time use persistent check
  try {
    const used = app.findRecordsByFilter('qr_nonce_terpakai', `nonce = "${nonce}"`, '', 1, 0);
    if(used && used.length) return { ok:false, reason:'used' };
  } catch(e) {}
  return { ok:true, slot, nonce };
}

routerAdd('GET', '/api/absen/qr', (e) => {
  try {
    if(!e.auth || e.auth.getString('role') !== 'admin') return e.json(403,{message:'Hanya admin'});
    const t = makeQrToken(e.app);
    return e.json(200, t);
  } catch(err){ console.log('[qr gen]', err); return e.json(500,{message:'Gagal membuat QR'}); }
});

routerAdd('POST', '/api/absen/scan', (e) => {
  try {
    if(!e.auth) return e.json(401,{message:'Harus login'});
    const role = e.auth.getString('role');
    if(role !== 'teknisi' && role !== 'admin') return e.json(403,{message:'Tidak diizinkan'});
    const info = e.requestInfo().body || {};
    const token = info.token;
    const v = verifyQrToken(e.app, token);
    if(!v.ok) return e.json(400,{message: v.reason==='used' ? 'QR sudah digunakan' : 'QR tidak valid/kadaluarsa'});
    // jam tutup
    const tutup = String(_getSettingQr(e.app,'jam_tutup_absen','23:59'));
    const [hh,mm] = tutup.split(':').map(x=>Number(x||0));
    const wn = witaNow();
    const minutesNow = wn.getUTCHours()*60 + wn.getUTCMinutes();
    if(minutesNow > (hh*60+mm)) return e.json(400,{message:'Lewat jam tutup absen'});
    const day = witaDateStr(wn);
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
    if(!e.auth || e.auth.getString('role') !== 'admin') return e.json(403,{message:'Hanya admin'});
    const day = witaDateStr();
    const items = e.app.findRecordsByFilter('absen_hadir', `tanggal >= "${day} 00:00:00" && tanggal <= "${day} 23:59:59" && diarsipkan = false`, '-dibuat_pada', 200, 0);
    return e.json(200,{items: items.map(r=>({id:r.id, teknisi:r.getString('teknisi'), tanggal:r.getString('tanggal'), jam_masuk:r.getString('jam_masuk'), keterangan:r.getString('keterangan'), metode:r.getString('metode')}))});
  } catch(err){ console.log('[absen today]', err); return e.json(500,{message:'Gagal memuat'}); }
});
