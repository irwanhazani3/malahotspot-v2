migrate((app) => {
  try {
    const pesan = app.findCollectionByNameOrId('pesan_langsung');
    const rule = '@request.auth.id != "" && (pengirim = @request.auth.id || penerima = @request.auth.id)';
    pesan.listRule = rule;
    pesan.viewRule = rule;
    // update/delete: sender only within 10 min handled in hooks; keep basic auth and restrict to participants
    pesan.updateRule = rule;
    pesan.deleteRule = rule;
    app.save(pesan);
  } catch(e){ console.log('tighten pesan', e); }

  try {
    const kom = app.findCollectionByNameOrId('komentar_tugas');
    // list/view filtered in hooks because access depends on referenced task assignment
    kom.listRule = '@request.auth.id != ""';
    kom.viewRule = '@request.auth.id != ""';
    app.save(kom);
  } catch(e){ console.log('tighten komentar', e); }

  try {
    const ann = app.findCollectionByNameOrId('pengumuman');
    ann.listRule = '@request.auth.id != ""';
    ann.viewRule = '@request.auth.id != ""';
    app.save(ann);
  } catch(e){ console.log('tighten pengumuman', e); }
}, (app) => {});
