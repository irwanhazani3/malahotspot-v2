/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  try {
    if (e.auth && e.auth.getBool('aktif') === false) throw new ForbiddenError('Akun nonaktif');
    const name = e.collection ? e.collection.name : '';
    const admin = !!(e.auth && e.auth.getString('role') === 'admin');
    const uid = e.auth ? e.auth.id : '';
    if (name === 'mutasi_inventaris') {
      const jenis = e.record.getString('jenis');
      if (jenis === 'Penyesuaian' && !admin) throw new ForbiddenError('Penyesuaian hanya admin');
    }
    if (name === 'layanan_gangguan' || name === 'pemasangan') {
      if (!admin && e.record.getString('ditugaskan_ke')) throw new ForbiddenError('Penugasan hanya oleh admin');
    }
    if (name === 'perbaikan') {
      if (!admin && e.record.getString('teknisi') && e.record.getString('teknisi') !== uid) throw new ForbiddenError('Teknisi ditentukan otomatis/admin');
    }
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof BadRequestError) throw err;
    console.log('[access create]', String(err));
  }
  e.next();
});

onRecordUpdateRequest((e) => {
  try {
    if (e.auth && e.auth.getBool('aktif') === false) throw new ForbiddenError('Akun nonaktif');
    const name = e.collection ? e.collection.name : '';
    const admin = !!(e.auth && e.auth.getString('role') === 'admin');
    const uid = e.auth ? e.auth.id : '';
    if (name === 'riwayat') throw new ForbiddenError('Riwayat tidak dapat diubah');

    if (name === 'layanan_gangguan' || name === 'pemasangan') {
      const oldA = e.record.original().getString('ditugaskan_ke');
      const newA = e.record.getString('ditugaskan_ke');
      if (oldA !== newA && !admin) throw new ForbiddenError('Penugasan hanya oleh admin');
      if (!admin) {
        if (!oldA || oldA !== uid) throw new ForbiddenError('Hanya teknisi yang ditugaskan');
      }
    }
    if (name === 'perbaikan') {
      const oldT = e.record.original().getString('teknisi');
      const newT = e.record.getString('teknisi');
      if (oldT !== newT && !admin) throw new ForbiddenError('Teknisi hanya diubah admin');
      if (!admin) {
        if (!oldT || oldT !== uid) throw new ForbiddenError('Hanya teknisi terkait');
      }
    }
    if (['pelanggan', 'inventaris_perangkat', 'inventaris_non_perangkat'].includes(name)) {
      if (!admin) throw new ForbiddenError('Perubahan data master oleh teknisi harus melalui usulan');
    }
    if (name === 'mutasi_inventaris' && !admin) throw new ForbiddenError('Mutasi hanya dapat diubah admin');
    if (name === 'absen_hadir' && !admin) throw new ForbiddenError('Absen hanya dapat diubah admin');
    if (name === 'pengaturan' && !admin) throw new ForbiddenError('Pengaturan hanya admin');
    if (name === 'usulan_perubahan') {
      if (!admin) {
        const pemohon = e.record.original().getString('pemohon');
        if (pemohon !== uid) throw new ForbiddenError('Tidak berhak');
        throw new ForbiddenError('Gunakan aksi tarik usulan');
      }
    }
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof BadRequestError) throw err;
    console.log('[access update]', String(err));
  }
  e.next();
});

onRecordDeleteRequest((e) => {
  try {
    if (e.auth && e.auth.getBool('aktif') === false) throw new ForbiddenError('Akun nonaktif');
    const name = e.collection ? e.collection.name : '';
    const admin = !!(e.auth && e.auth.getString('role') === 'admin');
    if (['komentar_tugas', 'pesan_langsung', 'pengumuman'].includes(name)) { e.next(); return; }
    if (!admin) throw new ForbiddenError('Hapus/arsip hanya admin');
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof BadRequestError) throw err;
    console.log('[access delete]', String(err));
  }
  e.next();
});
