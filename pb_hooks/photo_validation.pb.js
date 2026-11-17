/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  try{
    const { validateFiles } = require(__hooks + '/lib/photo.js');
    validateFiles(e);
  }catch(err){ if(err instanceof BadRequestError) throw err; console.log('[photo create]', String(err)); }
  e.next();
});

onRecordUpdateRequest((e) => {
  try{
    const { validateFiles } = require(__hooks + '/lib/photo.js');
    validateFiles(e);
  }catch(err){ if(err instanceof BadRequestError) throw err; console.log('[photo update]', String(err)); }
  e.next();
});
