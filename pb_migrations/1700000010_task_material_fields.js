migrate((app) => {
  for (const name of ['pemasangan', 'perbaikan']) {
    const c = app.findCollectionByNameOrId(name);
    if (!c.fields.getByName('material_pemakaian')) {
      c.fields.add(new JSONField({
        name: 'material_pemakaian',
        required: false,
        presentable: false,
        system: false,
        hidden: false,
        maxSize: 200000
      }));
    }
    if (!c.fields.getByName('material_tercatat')) {
      c.fields.add(new BoolField({
        name: 'material_tercatat',
        required: false,
        presentable: false,
        system: false,
        hidden: false
      }));
    }
    app.save(c);
  }
}, (app) => {
  for (const name of ['pemasangan', 'perbaikan']) {
    const c = app.findCollectionByNameOrId(name);
    if (c.fields.getByName('material_pemakaian')) c.fields.removeByName('material_pemakaian');
    if (c.fields.getByName('material_tercatat')) c.fields.removeByName('material_tercatat');
    app.save(c);
  }
});
