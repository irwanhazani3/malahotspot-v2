// Modul helper akses tugas — di-require DI DALAM callback hook.

module.exports = {
  canAccessTask: function(app, auth, modul, refId){
    if(!auth) return false;
    if(auth.getString('role') === 'admin') return true;
    try{
      const rec = app.findRecordById(modul, refId);
      if(modul === 'perbaikan') return rec.getString('teknisi') === auth.id;
      return rec.getString('ditugaskan_ke') === auth.id;
    }catch(e){ return false; }
  }
};
