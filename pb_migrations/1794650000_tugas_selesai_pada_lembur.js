/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const names = ["layanan_gangguan", "pemasangan", "perbaikan"];
  for (const name of names) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col.fields.getByName("selesai_pada")) {
        col.fields.add(new Field({
          type: "text",
          name: "selesai_pada",
          required: false,
          system: false,
          hidden: false,
          presentable: false,
          min: 0,
          max: 0,
          pattern: "",
          autogeneratePattern: ""
        }));
        app.save(col);
      }
    } catch (e) {
      console.log("[migration] tambah selesai_pada", name, String(e));
    }
  }

  // Backfill: untuk tugas Selesai yang belum punya selesai_pada, isi dari diubah_pada (dikonversi ke WITA +08:00)
  for (const name of names) {
    try {
      const rows = app.findRecordsByFilter(name, 'status = "Selesai" && (selesai_pada = "" || selesai_pada = null)', '', 5000, 0);
      for (const r of (rows || [])) {
        const src = String(r.getString("diubah_pada") || r.getString("dibuat_pada") || "");
        if (!src) continue;
        let witaStr = "";
        try {
          const d = new Date(src);
          if (!isNaN(d)) {
            const w = new Date(d.getTime() + 8 * 3600 * 1000);
            const pad = n => String(n).padStart(2, '0');
            witaStr = `${w.getUTCFullYear()}-${pad(w.getUTCMonth()+1)}-${pad(w.getUTCDate())} ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}`;
          }
        } catch (_) {}
        if (!witaStr) continue;
        r.set("selesai_pada", witaStr);
        app.save(r);
      }
    } catch (e) {
      console.log("[migration] backfill selesai_pada", name, String(e));
    }
  }
}, (app) => {
  // rollback: tidak menghapus field selesai_pada agar data aman
});
