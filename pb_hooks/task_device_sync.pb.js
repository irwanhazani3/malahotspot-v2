/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  try{
    const col = e.collection && e.collection.name;
    if(col === 'pemasangan' || col === 'perbaikan'){
      const oldStatus = e.record.original().getString('status');
      const newStatus = e.record.getString('status');
      const oldDev = String(e.record.original().get('perangkat') || '');
      const newDev = String(e.record.get('perangkat') || '');
      if(newStatus === 'Selesai' && (oldStatus !== 'Selesai' || oldDev !== newDev)){
        const { validateDeviceAssignment } = require(__hooks + '/lib/task_device.js');
        validateDeviceAssignment(e.app, e.record);
      }
    }
  }catch(err){
    if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[task device validate]', String(err));
  }
  e.next();
});

onRecordCreateRequest((e) => {
  try{
    const col = e.collection && e.collection.name;
    if((col === 'pemasangan' || col === 'perbaikan') && e.record.getString('status') === 'Selesai'){
      const { validateDeviceAssignment } = require(__hooks + '/lib/task_device.js');
      validateDeviceAssignment(e.app, e.record);
    }
  }catch(err){
    if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[task device validate]', String(err));
  }
  e.next();
});

onRecordAfterUpdateSuccess((e) => {
  try{
    const { syncDevices } = require(__hooks + '/lib/task_device.js');
    syncDevices(e, false);
  }catch(err){ console.log('[task device update]', String(err)); }
  e.next();
});

onRecordAfterCreateSuccess((e) => {
  try{
    const { syncDevices } = require(__hooks + '/lib/task_device.js');
    syncDevices(e, true);
  }catch(err){ console.log('[task device create]', String(err)); }
  e.next();
});
