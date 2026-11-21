/// <reference path="../pb_data/types.d.ts" />

function witaDateStr(){
  const w = new Date(Date.now() + 8 * 3600 * 1000);
  const y = w.getUTCFullYear();
  const m = String(w.getUTCMonth() + 1).padStart(2, '0');
  const d = String(w.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function witaDateTimeStr(){
  const w = new Date(Date.now() + 8 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth()+1)}-${pad(w.getUTCDate())} ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}`;
}

const TASK_COLS = ['layanan_gangguan', 'pemasangan', 'perbaikan'];

onRecordUpdateRequest((e) => {
  try{
    const col = e.collection && e.collection.name;
    if(TASK_COLS.includes(col)){
      const oldStatus = e.record.original().getString('status');
      const newStatus = e.record.getString('status');
      const oldDev = String(e.record.original().get('perangkat') || '');
      const newDev = String(e.record.get('perangkat') || '');

      if(newStatus === 'Selesai' && oldStatus !== 'Selesai'){
        e.record.set('selesai_pada', witaDateTimeStr());
        if(col === 'pemasangan' || col === 'perbaikan'){
          e.record.set('tanggal', witaDateStr() + ' 00:00:00');
        }
      }

      if((col === 'pemasangan' || col === 'perbaikan') && newStatus === 'Selesai' && (oldStatus !== 'Selesai' || oldDev !== newDev)){
        const { validateDeviceAssignment } = require(__hooks + '/lib/task_device.js');
        validateDeviceAssignment(e.app, e.record);
      }
    }
  }catch(err){
    if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[task update]', String(err));
  }
  e.next();
});

onRecordCreateRequest((e) => {
  try{
    const col = e.collection && e.collection.name;
    if(TASK_COLS.includes(col) && e.record.getString('status') === 'Selesai'){
      e.record.set('selesai_pada', witaDateTimeStr());
      if(col === 'pemasangan' || col === 'perbaikan'){
        e.record.set('tanggal', witaDateStr() + ' 00:00:00');
        const { validateDeviceAssignment } = require(__hooks + '/lib/task_device.js');
        validateDeviceAssignment(e.app, e.record);
      }
    }
  }catch(err){
    if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err;
    console.log('[task create]', String(err));
  }
  e.next();
});

onRecordAfterUpdateSuccess((e) => {
  try{
    const { syncDevices } = require(__hooks + '/lib/task_device.js');
    syncDevices(e, false);
  }catch(err){ console.log('[task device update]', String(err)); }
  try{
    const { recordInstallHistory } = require(__hooks + '/lib/install_history.js');
    recordInstallHistory(e.app, e.record, false);
  }catch(err){ console.log('[install history update]', String(err)); }
  e.next();
});

onRecordAfterCreateSuccess((e) => {
  try{
    const { syncDevices } = require(__hooks + '/lib/task_device.js');
    syncDevices(e, true);
  }catch(err){ console.log('[task device create]', String(err)); }
  try{
    const { recordInstallHistory } = require(__hooks + '/lib/install_history.js');
    recordInstallHistory(e.app, e.record, true);
  }catch(err){ console.log('[install history create]', String(err)); }
  e.next();
});
