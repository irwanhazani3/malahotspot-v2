migrate((app) => {
  try {
    const c = new Collection({
      name: 'qr_nonce_terpakai',
      type: 'base',
      system: false,
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null
    });
    c.fields.add({ type:'text', name:'nonce', required:true, presentable:false, system:false, hidden:false, min:0,max:0,pattern:'',autogeneratePattern:'' });
    c.fields.add({ type:'date', name:'digunakan_pada', required:true, presentable:false, system:false, hidden:false, min:'',max:'' });
    c.fields.add({ type:'relation', name:'teknisi', required:false, presentable:false, system:false, hidden:false, collectionId:'_pb_users_auth_', cascadeDelete:false, minSelect:0, maxSelect:1 });
    c.fields.add({ type:'autodate', name:'dibuat_pada', required:false, presentable:false, system:false, hidden:false, onCreate:true, onUpdate:false });
    app.save(c);
  } catch(e){ console.log('qr nonce migration', e); }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId('qr_nonce_terpakai')); } catch(e){}
});
