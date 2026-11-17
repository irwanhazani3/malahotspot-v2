// Modul validasi foto — di-require DI DALAM callback hook.

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
        if(type && ALLOWED.indexOf(type) === -1) throw new BadRequestError('Format foto harus JPG, PNG, atau WebP');
      }
    }catch(err){
      if(err instanceof BadRequestError) throw err;
      console.log('[photo validate]', name, f, String(err));
    }
  }
}

module.exports = { validateFiles };
