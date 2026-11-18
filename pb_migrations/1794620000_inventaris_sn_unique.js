migrate((app) => {
  const c = app.findCollectionByNameOrId('inventaris_perangkat');
  const name = 'idx_inventaris_perangkat_sn_unique';

  // Jangan gagalkan startup jika data lama sudah memiliki SN duplikat.
  // Hook tetap mencegah duplikat baru; admin bisa merapikan data lama dulu.
  try {
    const recs = app.findRecordsByFilter('inventaris_perangkat', 'sn_serial != ""', '', 5000, 0);
    const seen = {};
    for (const r of recs) {
      const key = String(r.getString('sn_serial') || '').trim().toLowerCase();
      if (!key) continue;
      if (seen[key]) {
        console.log('[migrasi] SN duplikat ditemukan, index unik dilewati:', key);
        return;
      }
      seen[key] = true;
    }
  } catch (e) {
    console.log('[migrasi] gagal memeriksa SN duplikat:', String(e));
    return;
  }

  const indexes = c.indexes || [];
  if (indexes.some(x => String(x).indexOf(name) !== -1)) return;

  c.indexes = indexes.concat([
    'CREATE UNIQUE INDEX `' + name + '` ON `inventaris_perangkat` (`sn_serial` COLLATE NOCASE) WHERE `sn_serial` != \'\''
  ]);
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId('inventaris_perangkat');
  const name = 'idx_inventaris_perangkat_sn_unique';
  const indexes = c.indexes || [];
  const next = indexes.filter(x => String(x).indexOf(name) === -1);
  if (next.length === indexes.length) return;
  c.indexes = next;
  app.save(c);
});
