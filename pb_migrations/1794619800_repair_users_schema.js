/// <reference path="../pb_data/types.d.ts" />

// Menjamin skema `users` benar pada instalasi baru maupun lama:
// - `nama` dan `telepon` ada (migrasi awal lama gagal menambahkannya),
// - `role` berupa select admin/teknisi,
// - `aktif` tidak required agar user bisa dinonaktifkan,
// - field typo lama `telpon` (number) dibuang,
// - akun admin bawaan selalu punya nama, role, dan status aktif.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users');

  if (users.fields.getByName('telpon')) {
    users.fields.removeByName('telpon');
  }

  if (!users.fields.getByName('nama')) {
    users.fields.add(new TextField({
      name: 'nama',
      required: false,
      presentable: true,
      system: false,
      hidden: false,
      min: 0,
      max: 0
    }));
  }

  if (!users.fields.getByName('telepon')) {
    users.fields.add(new TextField({
      name: 'telepon',
      required: false,
      presentable: false,
      system: false,
      hidden: false,
      min: 0,
      max: 0
    }));
  }

  const role = users.fields.getByName('role');
  if (!role) {
    users.fields.add(new SelectField({
      name: 'role',
      required: true,
      presentable: false,
      system: false,
      hidden: false,
      maxSelect: 1,
      values: ['admin', 'teknisi']
    }));
  } else if (role.type === 'select') {
    role.values = ['admin', 'teknisi'];
    role.maxSelect = 1;
    role.required = true;
  }

  const aktif = users.fields.getByName('aktif');
  if (!aktif) {
    users.fields.add(new BoolField({
      name: 'aktif',
      required: false,
      presentable: false,
      system: false,
      hidden: false
    }));
  } else {
    aktif.required = false;
  }

  users.createRule = '@request.auth.role = "admin"';
  users.listRule = '@request.auth.id != ""';
  users.viewRule = '@request.auth.id != ""';
  users.updateRule = '@request.auth.role = "admin" || id = @request.auth.id';
  users.deleteRule = '@request.auth.role = "admin"';
  app.save(users);

  // Perbaiki akun admin bawaan yang mungkin dibuat sebelum field `nama`
  // dan `role` berhasil ditambahkan.
  let admin = null;
  try {
    admin = app.findAuthRecordByEmail('users', 'admin@local.test');
  } catch (_) {
    admin = null;
  }
  if (!admin) {
    try {
      const admins = app.findRecordsByFilter('users', 'role = "admin"', '', 1, 0);
      if (admins && admins.length) admin = admins[0];
    } catch (_) {}
  }

  if (!admin) {
    admin = new Record(users);
    admin.setEmail('admin@local.test');
    try { admin.setPassword('admin123'); } catch (_) {}
  }

  if (!admin.getString('nama')) admin.set('nama', 'Administrator');
  if (!admin.getString('role')) admin.set('role', 'admin');
  admin.set('aktif', true);
  admin.set('verified', true);
  app.save(admin);

  // Isi nama kosong lain agar field nama aman dijadikan wajib.
  try {
    const blank = app.findRecordsByFilter('users', 'nama = ""', '', 1000, 0);
    for (const rec of blank) {
      rec.set('nama', rec.getString('email') || 'User');
      app.save(rec);
    }
  } catch (e) {
    console.log('[repair users] nama kosong', String(e));
  }

  const nama = users.fields.getByName('nama');
  if (nama) {
    nama.required = true;
    nama.presentable = true;
    app.save(users);
  }
}, (app) => {
  // Tidak ada rollback: perbaikan skema bersifat aditif.
});
