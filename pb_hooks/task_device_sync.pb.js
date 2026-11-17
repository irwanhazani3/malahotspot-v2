/// <reference path="../pb_data/types.d.ts" />

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
