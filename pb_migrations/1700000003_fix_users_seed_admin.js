migrate((app) => {
  const users = app.findCollectionByNameOrId('users');

  function ensureField(obj){
    try {
      const existing = users.fields.getByName(obj.name);
      if(!existing){
        // in PB 0.40+ fields can be added; use import/update via collection save with field def may vary
        // try direct add with plain object for compatibility
        users.fields.add(obj);
      } else {
        // fix role options if select
        if(obj.name === 'role' && obj.type === 'select'){
          existing.values = ['admin','teknisi'];
          existing.maxSelect = 1;
          existing.required = true;
        }
      }
    } catch(e){ console.log('[fix users field]', obj.name, e); }
  }

  // Ensure required custom fields exist (idempotent best-effort)
  try {
    ensureField({ type:'text', name:'nama', required:false, presentable:true, system:false, hidden:false, min:0, max:0, pattern:'', autogeneratePattern:'' });
    ensureField({ type:'select', name:'role', required:false, presentable:false, system:false, hidden:false, maxSelect:1, values:['admin','teknisi'] });
    ensureField({ type:'text', name:'telepon', required:false, presentable:false, system:false, hidden:false, min:0, max:0, pattern:'', autogeneratePattern:'' });
    ensureField({ type:'bool', name:'aktif', required:false, presentable:false, system:false, hidden:false });
    users.createRule = '@request.auth.role = "admin"';
    users.listRule = '@request.auth.id != ""';
    users.viewRule = '@request.auth.id != ""';
    users.updateRule = '@request.auth.role = "admin" || id = @request.auth.id';
    users.deleteRule = '@request.auth.role = "admin"';
    app.save(users);
  } catch(e){ console.log('[fix users collection]', e); }

  // Fix existing records
  try {
    const all = app.findRecordsByFilter('users', 'id != ""', '', 500, 0);
    for(const r of all){
      // activate by default for usability (admin can deactivate later)
      try { if(r.get('aktif') === false || r.get('aktif') === null || r.get('aktif') === undefined) r.set('aktif', true); } catch(e){}
      try { if(!r.getString('role')) r.set('role','teknisi'); } catch(e){}
      try { if(!r.getString('nama')) r.set('nama', r.getString('email') || r.getString('name') || 'User'); } catch(e){}
      try { r.set('verified', true); } catch(e){}
      app.save(r);
    }
  } catch(e){ console.log('[fix users records]', e); }

  // Ensure there is at least one app admin account
  try {
    let admins = [];
    try { admins = app.findRecordsByFilter('users', 'role = "admin"', '', 10, 0); } catch(e){ admins = []; }
    if(!admins || admins.length === 0){
      const email = 'admin@local.test';
      let rec = null;
      try { rec = app.findAuthRecordByEmail('users', email); } catch(e){ rec = null; }
      if(!rec){
        rec = new Record(users);
        rec.setEmail(email);
      }
      rec.set('nama', 'Administrator');
      rec.set('role', 'admin');
      rec.set('telepon', '');
      rec.set('aktif', true);
      rec.set('verified', true);
      try { rec.setPassword('admin123'); } catch(e){
        try { rec.set('password', 'admin123'); rec.set('passwordConfirm', 'admin123'); } catch(e2){}
      }
      app.save(rec);
      console.log('[fix users] created default app admin: admin@local.test / admin123');
    } else {
      console.log('[fix users] app admin exists');
    }
  } catch(e){ console.log('[fix users] seed admin', e); }

}, (app) => {
  // no-op down
});
