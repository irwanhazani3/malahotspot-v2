migrate((app) => {
  try { app.findCollectionByNameOrId('qr_nonce_terpakai'); console.log('qr_nonce_terpakai exists'); return; } catch(e){}
  try {
    app.importCollections([{
      name: 'qr_nonce_terpakai',
      type: 'base',
      system: false,
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { type:'text', name:'nonce', required:true, presentable:false, system:false, hidden:false, min:0,max:0,pattern:'',autogeneratePattern:'' },
        { type:'date', name:'digunakan_pada', required:true, presentable:false, system:false, hidden:false, min:'',max:'' },
        { type:'relation', name:'teknisi', required:false, presentable:false, system:false, hidden:false, collectionId:'_pb_users_auth_', cascadeDelete:false, minSelect:0, maxSelect:1 },
        { type:'autodate', name:'dibuat_pada', required:false, presentable:false, system:false, hidden:false, onCreate:true, onUpdate:false }
      ]
    }], false);
    console.log('qr_nonce_terpakai created');
  } catch(e){ console.log('qr nonce v2 error', e); }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId('qr_nonce_terpakai')); } catch(e){}
});
