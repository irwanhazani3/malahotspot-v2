// Modul helper — di-require DI DALAM callback hook
// (PocketBase JSVM tidak membagikan variabel top-level antar handler).

module.exports = {
  ensureActiveTeknisi: function(app, userId, allowEmpty){
    if(!userId){ if(allowEmpty) return; throw new BadRequestError('Penugasan/teknisi wajib diisi'); }
    try{
      const u = app.findRecordById('users', userId);
      if(u.getBool('aktif') === false) throw new BadRequestError('Teknisi nonaktif tidak dapat ditugaskan');
      const role = u.getString('role');
      if(role !== 'teknisi' && role !== 'admin') throw new BadRequestError('User bukan teknisi/admin');
    }catch(err){
      if(err instanceof BadRequestError) throw err;
      throw new BadRequestError('Teknisi/penugasan tidak valid');
    }
  }
};
