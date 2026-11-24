/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("inventaris_perangkat");
    let changed = false;
    if (!col.fields.getByName("no_seri_inv")) {
      col.fields.add(new Field({
        type: "text",
        name: "no_seri_inv",
        required: false,
        system: false,
        hidden: false,
        presentable: false,
        min: 0,
        max: 0,
        pattern: "",
        autogeneratePattern: ""
      }));
      changed = true;
    }
    if (!col.fields.getByName("no_inv")) {
      col.fields.add(new Field({
        type: "text",
        name: "no_inv",
        required: false,
        system: false,
        hidden: false,
        presentable: false,
        min: 0,
        max: 0,
        pattern: "",
        autogeneratePattern: ""
      }));
      changed = true;
    }
    if (changed) app.save(col);
  } catch (e) {
    console.log("[migration] tambah no_inv inventaris_perangkat", String(e));
  }
}, (app) => {
  // rollback: tidak menghapus field agar data aman
});
