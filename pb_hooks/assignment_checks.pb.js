/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  try{
    const { ensureActiveTeknisi } = require(__hooks + '/lib/assign.js');
    const name = e.collection && e.collection.name;
    if(name === 'layanan_gangguan' || name === 'pemasangan'){
      const a = e.record.getString('ditugaskan_ke');
      if(a) ensureActiveTeknisi(e.app, a, true);
    }
    if(name === 'perbaikan'){
      const t = e.record.getString('teknisi');
      if(t) ensureActiveTeknisi(e.app, t, true);
    }
  }catch(err){ if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err; console.log('[assign check create]', String(err)); }
  e.next();
});

onRecordUpdateRequest((e) => {
  try{
    const { ensureActiveTeknisi } = require(__hooks + '/lib/assign.js');
    const name = e.collection && e.collection.name;
    if(name === 'layanan_gangguan' || name === 'pemasangan'){
      const oldA = e.record.original().getString('ditugaskan_ke');
      const newA = e.record.getString('ditugaskan_ke');
      if(newA && newA !== oldA) ensureActiveTeknisi(e.app, newA, true);
    }
    if(name === 'perbaikan'){
      const oldT = e.record.original().getString('teknisi');
      const newT = e.record.getString('teknisi');
      if(newT && newT !== oldT) ensureActiveTeknisi(e.app, newT, true);
    }
  }catch(err){ if(err instanceof BadRequestError || err instanceof ForbiddenError) throw err; console.log('[assign check update]', String(err)); }
  e.next();
});
