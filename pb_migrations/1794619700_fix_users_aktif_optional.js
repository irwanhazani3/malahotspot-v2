migrate((app) => {
  const collection = app.findCollectionByNameOrId('users');
  const field = collection.fields.getByName('aktif');
  if (field) {
    // Required bool di PocketBase menganggap `false` sebagai "blank",
    // sehingga user tidak akan pernah bisa dinonaktifkan.
    field.required = false;
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('users');
  const field = collection.fields.getByName('aktif');
  if (field) {
    field.required = true;
    app.save(collection);
  }
});
