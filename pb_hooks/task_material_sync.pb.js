/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  const name = e.collection && e.collection.name;
  if(name !== 'pemasangan' && name !== 'perbaikan') { e.next(); return; }
  try{
    const { validateMaterials } = require(__hooks + '/lib/task_material.js');
    const oldStatus = e.record.original().getString('status');
    const newStatus = e.record.getString('status');
    const wasRecorded = !!e.record.original().getBool('material_tercatat');
    if(wasRecorded) e.record.set('material_tercatat', true);
    if(newStatus === 'Selesai' && oldStatus !== 'Selesai' && !wasRecorded){
      validateMaterials(e.app, e.record);
    }
  }catch(err){
    if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[task material validate]', String(err));
  }
  e.next();
});

onRecordCreateRequest((e) => {
  const name = e.collection && e.collection.name;
  if(name !== 'pemasangan' && name !== 'perbaikan') { e.next(); return; }
  try{
    const { validateMaterials } = require(__hooks + '/lib/task_material.js');
    if(e.record.getString('status') === 'Selesai'){
      validateMaterials(e.app, e.record);
    }
  }catch(err){
    if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[task material create validate]', String(err));
  }
  e.next();
});

onRecordAfterUpdateSuccess((e) => {
  const col = e.record.collection().name;
  if(col !== 'pemasangan' && col !== 'perbaikan') { e.next(); return; }
  try{
    const { applyMaterials } = require(__hooks + '/lib/task_material.js');
    applyMaterials(e, false);
  }catch(err){ console.log('[task material apply]', String(err)); }
  e.next();
});

onRecordAfterCreateSuccess((e) => {
  const col = e.record.collection().name;
  if(col !== 'pemasangan' && col !== 'perbaikan') { e.next(); return; }
  try{
    const { applyMaterials } = require(__hooks + '/lib/task_material.js');
    applyMaterials(e, true);
  }catch(err){ console.log('[task material apply]', String(err)); }
  e.next();
});
