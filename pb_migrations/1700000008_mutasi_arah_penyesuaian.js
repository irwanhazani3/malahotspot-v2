migrate((app) => {
  const c = app.findCollectionByNameOrId('mutasi_inventaris');
  if (!c.fields.getByName('arah_penyesuaian')) {
    c.fields.add(new SelectField({
      name: 'arah_penyesuaian',
      required: false,
      presentable: false,
      system: false,
      hidden: false,
      values: ['Tambah', 'Kurang'],
      maxSelect: 1
    }));
    app.save(c);
  }
}, (app) => {
  const c = app.findCollectionByNameOrId('mutasi_inventaris');
  if (c.fields.getByName('arah_penyesuaian')) {
    c.fields.removeByName('arah_penyesuaian');
    app.save(c);
  }
});
