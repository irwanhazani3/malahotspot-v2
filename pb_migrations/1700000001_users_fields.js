migrate((app) => {
  const users = app.findCollectionByNameOrId('users');
  function ensure(field){
    try { if(!users.fields.find(f=>f.name===field.name)) users.fields.add(field); } catch(e){}
  }
  ensure({ type:'text', name:'nama', required:true, presentable:true, system:false, hidden:false, min:0, max:0, pattern:'', autogeneratePattern:'' });
  ensure({ type:'select', name:'role', required:true, presentable:false, system:false, hidden:false, maxSelect:1, values:['admin','teknisi'] });
  ensure({ type:'text', name:'telepon', required:false, presentable:false, system:false, hidden:false, min:0, max:0, pattern:'', autogeneratePattern:'' });
  ensure({ type:'bool', name:'aktif', required:false, presentable:false, system:false, hidden:false });
  // tighten rules: only admins manage users; registration disabled
  users.createRule = '@request.auth.role = "admin"';
  users.listRule = '@request.auth.id != ""';
  users.viewRule = '@request.auth.id != ""';
  users.updateRule = '@request.auth.role = "admin" || id = @request.auth.id';
  users.deleteRule = '@request.auth.role = "admin"';
  app.save(users);
}, (app) => {
  // keep fields on down-migrate to avoid data loss in dev
});
