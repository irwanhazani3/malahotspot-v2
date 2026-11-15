migrate((app) => {
  // Update users role field options
  try {
    const users = app.findCollectionByNameOrId('users');
    const roleField = users.fields.getByName('role');
    if (roleField) {
      roleField.values = ['admin', 'teknisi'];
      app.save(users);
    }
  } catch (e) { console.log('[mig role] users field', e); }

  // Rename absen_hadir.petugas -> teknisi if present
  try {
    const absen = app.findCollectionByNameOrId('absen_hadir');
    const f = absen.fields.getByName('petugas');
    if (f) {
      f.name = 'teknisi';
      app.save(absen);
    }
  } catch (e) { console.log('[mig role] absen field', e); }

  // Update existing user role values
  try {
    const records = app.findRecordsByFilter('users', 'role = "petugas"', '', 500, 0);
    for (const r of records) { r.set('role', 'teknisi'); app.save(r); }
  } catch (e) { console.log('[mig role] user data', e); }
}, (app) => {
  try {
    const users = app.findCollectionByNameOrId('users');
    const roleField = users.fields.getByName('role');
    if (roleField) { roleField.values = ['admin', 'petugas']; app.save(users); }
  } catch (e) {}
  try {
    const absen = app.findCollectionByNameOrId('absen_hadir');
    const f = absen.fields.getByName('teknisi');
    if (f) { f.name = 'petugas'; app.save(absen); }
  } catch (e) {}
  try {
    const records = app.findRecordsByFilter('users', 'role = "teknisi"', '', 500, 0);
    for (const r of records) { r.set('role', 'petugas'); app.save(r); }
  } catch (e) {}
});
