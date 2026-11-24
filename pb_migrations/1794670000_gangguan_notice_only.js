/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("layanan_gangguan");
    const field = col.fields.getByName("status");
    if (field) {
      // Gangguan jadi notice/pencatatan, ditindaklanjuti lewat Perbaikan
      field.values = ["Baru", "Ditindaklanjuti"];
      app.save(col);
    }
  } catch (e) {
    console.log("[migration] gangguan notice status", String(e));
  }

  // Migrasi data lama: Diproses/Selesai -> Ditindaklanjuti
  try {
    const rows = app.findRecordsByFilter("layanan_gangguan", 'status = "Diproses" || status = "Selesai"', "", 5000, 0);
    for (const r of (rows || [])) {
      r.set("status", "Ditindaklanjuti");
      app.save(r);
    }
  } catch (e) {
    console.log("[migration] gangguan notice data", String(e));
  }
}, (app) => {
  // rollback manual jika diperlukan
});
