/// <reference path="../pb_data/types.d.ts" />

// Default akun baru aktif, kecuali admin secara eksplisit mengirim aktif=false
onRecordCreateRequest((e) => {
  if (!e.collection || e.collection.name !== 'users') { e.next(); return; }
  try {
    let body = {};
    try { body = e.requestInfo().body || {}; } catch (_) { body = {}; }
    const hasAktif = body && Object.prototype.hasOwnProperty.call(body, 'aktif');
    if (!hasAktif) e.record.set('aktif', true);
  } catch (err) { console.log('[user create aktif]', String(err)); }
  e.next();
});

// Prevent inactive users from logging in
onRecordAuthWithPasswordRequest((e) => {
  try {
    if (e.record && e.collection && e.collection.name === 'users') {
      if (e.record.getBool('aktif') === false) {
        throw new ForbiddenError('Akun nonaktif. Hubungi admin.');
      }
    }
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof BadRequestError) throw err;
    console.log('[auth login]', String(err));
  }
  e.next();
});

// When deactivating a teknisi, ensure no active assignments remain (must be moved/cleared first)
onRecordUpdateRequest((e) => {
  if (!e.collection || e.collection.name !== 'users') { e.next(); return; }
  try {
    const oldAktif = e.record.original().getBool('aktif');
    const newAktif = e.record.getBool('aktif');
    if (oldAktif === true && newAktif === false) {
      const uid = e.record.id;
      let g = 0, p = 0, r = 0;
      try { g = e.app.findRecordsByFilter('layanan_gangguan', `ditugaskan_ke = "${uid}" && diarsipkan = false`, '', 200, 0).length; } catch(err){}
      try { p = e.app.findRecordsByFilter('pemasangan', `ditugaskan_ke = "${uid}" && diarsipkan = false`, '', 200, 0).length; } catch(err){}
      try { r = e.app.findRecordsByFilter('perbaikan', `teknisi = "${uid}" && diarsipkan = false`, '', 200, 0).length; } catch(err){}
      if (g > 0 || p > 0 || r > 0) {
        throw new BadRequestError(`Nonaktifkan gagal: masih ada penugasan aktif (gangguan:${g}, pemasangan:${p}, perbaikan:${r}). Pindahkan atau kosongkan terlebih dahulu.`);
      }
    }
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof BadRequestError) throw err;
    console.log('[user deactivate]', String(err));
  }
  e.next();
});
