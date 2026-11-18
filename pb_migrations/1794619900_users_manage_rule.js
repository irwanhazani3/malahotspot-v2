/// <reference path="../pb_data/types.d.ts" />

// Izinkan admin aplikasi mengelola akun auth (email/password teknisi)
// tanpa harus menjadi superuser PocketBase.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  users.manageRule = '@request.auth.role = "admin"';
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId('users');
  users.manageRule = null;
  app.save(users);
});
