// Modul helper QR absen — di-require DI DALAM callback hook.

function _getSettingQr(app, key, defVal){
  try {
    const rec = app.findFirstRecordByFilter('pengaturan', `kunci = "${key}"`);
    const v = rec.get('nilai');
    return (v === null || v === undefined || v === '') ? defVal : v;
  } catch(e){ return defVal; }
}

function witaNow(){ return new Date(Date.now() + 8*3600*1000); }

function witaDateStr(d){
  if(!d) d = new Date(Date.now() + 8*3600*1000);
  const y=d.getUTCFullYear(), m=String(d.getUTCMonth()+1).padStart(2,'0'), da=String(d.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

function hmac(data, secret){
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
  const slotStr = parts[0], nonce = parts[1], sig = parts[2];
  const payload = `${slotStr}.${nonce}`;
  const expected = hmac(payload, secret);
  if(!sig || sig !== expected) return { ok:false, reason:'signature' };
  const slot = Number(slotStr);
  const nowSlot = Math.floor(Date.now() / (interval*1000));
  if(slot !== nowSlot) return { ok:false, reason:'expired' };
  try {
    const used = app.findRecordsByFilter('qr_nonce_terpakai', `nonce = "${nonce}"`, '', 1, 0);
    if(used && used.length) return { ok:false, reason:'used' };
  } catch(e) {}
  return { ok:true, slot, nonce };
}

module.exports = { _getSettingQr, witaNow, witaDateStr, hmac, makeQrToken, verifyQrToken };
