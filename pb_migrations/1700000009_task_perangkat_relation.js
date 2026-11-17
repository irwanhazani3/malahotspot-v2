migrate((app) => {
  const inv = app.findCollectionByNameOrId('inventaris_perangkat');
  for (const colName of ['pemasangan', 'perbaikan']) {
    const c = app.findCollectionByNameOrId(colName);
    if (!c.fields.getByName('perangkat')) {
      c.fields.add(new RelationField({
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
      app.save(c);
    }
  }
}, (app) => {
  for (const colName of ['pemasangan', 'perbaikan']) {
    const c = app.findCollectionByNameOrId(colName);
    if (c.fields.getByName('perangkat')) {
      c.fields.removeByName('perangkat');
      app.save(c);
    }
  }
});
