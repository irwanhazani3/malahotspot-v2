/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersId = "_pb_users_auth_";
  const pelanggan = app.findCollectionByNameOrId("pelanggan");
  const perangkat = app.findCollectionByNameOrId("inventaris_perangkat");
  const pemasangan = app.findCollectionByNameOrId("pemasangan");
  let perbaikan = null;
  try { perbaikan = app.findCollectionByNameOrId("perbaikan"); } catch (_) {}

  // Tambah status "Cabutan" pada inventaris_perangkat.kondisi
  try {
    const inv = app.findCollectionByNameOrId("inventaris_perangkat");
    const field = inv.fields.getByName("kondisi");
    if (field && Array.isArray(field.values) && !field.values.includes("Cabutan")) {
      field.values.push("Cabutan");
      app.save(inv);
    }
  } catch (e) {
    console.log("[migration] tambah kondisi Cabutan gagal:", String(e));
  }

  const fields = [
    { type: "relation", name: "pelanggan", required: true, system: false, hidden: false, presentable: false, collectionId: pelanggan.id, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
    { type: "relation", name: "perangkat", required: true, system: false, hidden: false, presentable: false, collectionId: perangkat.id, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
    { type: "relation", name: "pemasangan", required: false, system: false, hidden: false, presentable: false, collectionId: pemasangan.id, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
    { type: "date", name: "tanggal_pasang", required: true, system: false, hidden: false, presentable: false, min: "", max: "" },
    { type: "date", name: "tanggal_dilepas", required: false, system: false, hidden: false, presentable: false, min: "", max: "" },
    { type: "select", name: "jenis", required: true, system: false, hidden: false, presentable: false, values: ["Pemasangan Pertama", "Penggantian"], maxSelect: 1 },
    { type: "select", name: "status", required: true, system: false, hidden: false, presentable: false, values: ["Aktif", "Dicabut"], maxSelect: 1 },
    { type: "text", name: "keterangan", required: false, system: false, hidden: false, presentable: false, min: 0, max: 0, pattern: "", autogeneratePattern: "" },
    { type: "bool", name: "diarsipkan", required: false, system: false, hidden: false, presentable: false },
    { type: "relation", name: "diarsipkan_oleh", required: false, system: false, hidden: false, presentable: false, collectionId: usersId, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
    { type: "date", name: "diarsipkan_pada", required: false, system: false, hidden: false, presentable: false, min: "", max: "" },
    { type: "autodate", name: "dibuat_pada", required: false, system: false, hidden: false, presentable: false, onCreate: true, onUpdate: false },
    { type: "autodate", name: "diubah_pada", required: false, system: false, hidden: false, presentable: false, onCreate: true, onUpdate: true },
  ];
  if (perbaikan) {
    fields.splice(3, 0, { type: "relation", name: "perbaikan", required: false, system: false, hidden: false, presentable: false, collectionId: perbaikan.id, cascadeDelete: false, minSelect: 0, maxSelect: 1 });
  }

  const col = new Collection({
    name: "riwayat_pemasangan_perangkat",
    type: "base",
    system: false,
    fields: fields,
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.role = \"admin\"",
    updateRule: "@request.auth.role = \"admin\"",
    deleteRule: "@request.auth.role = \"admin\"",
  });
  app.save(col);
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("riwayat_pemasangan_perangkat");
    app.delete(col);
  } catch (e) {}
  // Catatan: nilai "Cabutan" pada kondisi inventaris_perangkat tidak dihapus otomatis saat rollback.
});
