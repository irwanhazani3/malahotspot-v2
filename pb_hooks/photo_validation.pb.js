/// <reference path="../pb_data/types.d.ts" />

const FILE_FIELDS = {
  pelanggan: ['foto_rumah'],
  perbaikan: ['foto_sebelum','foto_sesudah'],
  inventaris_perangkat: ['foto_perangkat'],
  komentar_tugas: ['foto'],
  pesan_langsung: ['foto'],
  pengumuman: ['foto']
};
const ALLOWED = ['image/jpeg','image/png','image/webp'];
const MAX = 2 * 1024 * 1024;

function validateFiles(e){
  const name = e.collection ? e.collection.name : '';
  const fields = FILE_FIELDS[name];
  if(!fields) return;
  for(const f of fields){
    try{
      const files = e.record.getUnsavedFiles ? e.record.getUnsavedFiles(f) : null;
      if(!files || !files.length) continue;
      for(const file of files){
        const size = file.size || file.Size || 0;
        const type = file.type || file.contentType || file.content_type || '';
        if(size > MAX) throw new BadRequestError('Ukuran foto maksimal 2 MB');
        // content type may not always be populated depending on PB version; best-effort
        if(type && ALLOWED.indexOf(type) === -1) throw new BadRequestError('Format foto harus JPG, PNG, atau WebP');
        const nameStr = String(file.name || file.originalName || '').toLowerCase();
        if(nameStr && !(/\.(jpe?g|png|webp)$/i.test(nameStr)) && !type) {
          // allow if unknown; server stores as file
        }
      }
    }catch(err){
      if(err instanceof BadRequestError) throw err;
      console.log('[photo validate]', name, f, String(err));
    }
  }
}

onRecordCreateRequest((e)=>{ try{ validateFiles(e); }catch(err){ if(err instanceof BadRequestError) throw err; } e.next(); });
onRecordUpdateRequest((e)=>{ try{ validateFiles(e); }catch(err){ if(err instanceof BadRequestError) throw err; } e.next(); });
