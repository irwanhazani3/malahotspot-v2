/// <reference path="../pb_data/types.d.ts" />

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
  try {
    if (!e.collection || e.collection.name !== 'users') { e.next(); return; }
    const oldAktif = e.record.original().getBool('aktif');
    const newAktif = e.record.getBool('aktif');
    if (oldAktif === true && newAktif === false) {
      const uid = e.record.id;
      let g = 0, p = 0, r = 0;
      try { g = $app.findRecordsByFilter('layanan_gangguan', `ditugaskan_ke = "${uid}" && diarsipkan = false`, '', 1, 0).length; } catch(err){}
      // count properly
      try { g = $app.findRecordsByFilter('layanan_gangguan', `ditugaskan_ke = "${uid}" && diarsipkan = false`, '', 200, 0).length; } catch(err){}
      try { p = $app.findRecordsByFilter('pemasangan', `ditugaskan_ke = "${uid}" && diarsipkan = false`, '', 200, 0).length; } catch(err){}
      try { r = $app.findRecordsByFilter('perbaikan', `teknisi = "${uid}" && diarsipkan = false`, '', 200, 0).length; } catch(err){}
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
