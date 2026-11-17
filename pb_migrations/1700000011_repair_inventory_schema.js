migrate((app) => {
  const add = (colName, field) => {
    const c = app.findCollectionByNameOrId(colName);
    if (c.fields.getByName(field.name)) return false;
    c.fields.add(field);
    app.save(c);
    console.log('[repair schema] added', colName + '.' + field.name);
    return true;
  };

  const inv = app.findCollectionByNameOrId('inventaris_perangkat');

  add('mutasi_inventaris', new SelectField({
    name: 'arah_penyesuaian',
    required: false,
    presentable: false,
    system: false,
    hidden: false,
    values: ['Tambah', 'Kurang'],
    maxSelect: 1
  }));

  for (const colName of ['pemasangan', 'perbaikan']) {
    add(colName, new RelationField({
      name: 'perangkat',
      required: false,
      presentable: false,
      system: false,
      hidden: false,
      collectionId: inv.id,
      cascadeDelete: false,
      minSelect: 0,
      maxSelect: 20
    }));
    add(colName, new JSONField({
      name: 'material_pemakaian',
      required: false,
      presentable: false,
      system: false,
      hidden: false,
      maxSize: 200000
    }));
    add(colName, new BoolField({
      name: 'material_tercatat',
      required: false,
      presentable: false,
      system: false,
      hidden: false
    }));
  }
}, (app) => {
  const remove = (colName, fieldName) => {
    const c = app.findCollectionByNameOrId(colName);
    if (c.fields.getByName(fieldName)) {
      c.fields.removeByName(fieldName);
      app.save(c);
    }
  };
  remove('mutasi_inventaris', 'arah_penyesuaian');
  for (const colName of ['pemasangan', 'perbaikan']) {
    remove(colName, 'perangkat');
    remove(colName, 'material_pemakaian');
    remove(colName, 'material_tercatat');
  }
});
