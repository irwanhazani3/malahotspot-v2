/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const usersId = "_pb_users_auth_";
  const common = () => ([
    { type: "bool", name: "diarsipkan", required: false, system: false, hidden: false, presentable: false },
    { type: "relation", name: "diarsipkan_oleh", required: false, system: false, hidden: false, presentable: false, collectionId: usersId, cascadeDelete: false, minSelect: 0, maxSelect: 1 },
    { type: "date", name: "diarsipkan_pada", required: false, system: false, hidden: false, presentable: false, min: "", max: "" },
    { type: "autodate", name: "dibuat_pada", required: false, system: false, hidden: false, presentable: false, onCreate: true, onUpdate: false },
    { type: "autodate", name: "diubah_pada", required: false, system: false, hidden: false, presentable: false, onCreate: true, onUpdate: true }
  ]);

  const collections = [
    { name: "pelanggan", type: "base", system: false, fields: [
      { type:"text", name:"nama", required:true, system:false, hidden:false, presentable:true, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"text", name:"nowa", required:true, system:false, hidden:false, presentable:false, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"text", name:"sn_perangkat", required:false, system:false, hidden:false, presentable:false, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"text", name:"koneksi", required:false, system:false, hidden:false, presentable:false, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"text", name:"vlan", required:false, system:false, hidden:false, presentable:false, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"relation", name:"teknisi", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"text", name:"link_maps", required:false, system:false, hidden:false, presentable:false, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"text", name:"keterangan_lokasi", required:false, system:false, hidden:false, presentable:false, min:0, max:0, pattern:"", autogeneratePattern:"" },
      { type:"file", name:"foto_rumah", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "inventaris_perangkat", type: "base", system: false, fields: [
      { type:"text", name:"nama", required:true, system:false, hidden:false, presentable:true, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"tipe", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"sn_serial", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"select", name:"kondisi", required:true, system:false, hidden:false, presentable:false, values:["Baik","Terpasang","Rusak","Nonaktif"], maxSelect:1 },
      { type:"text", name:"lokasi_pemegang", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"file", name:"foto_perangkat", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      { type:"text", name:"keterangan", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "inventaris_non_perangkat", type: "base", system: false, fields: [
      { type:"text", name:"nama_barang", required:true, system:false, hidden:false, presentable:true, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"satuan", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"number", name:"stok", required:false, system:false, hidden:false, presentable:false, min:null, max:null, onlyInt:false },
      { type:"number", name:"stok_minimum", required:false, system:false, hidden:false, presentable:false, min:null, max:null, onlyInt:false },
      { type:"text", name:"keterangan", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },
  ];

  app.importCollections(collections, false);

  const pelanggan = app.findCollectionByNameOrId("pelanggan");
  const invnp = app.findCollectionByNameOrId("inventaris_non_perangkat");

  const phase2 = [
    { name: "layanan_gangguan", type: "base", system: false, fields: [
      { type:"relation", name:"pelanggan", required:true, system:false, hidden:false, presentable:false, collectionId: pelanggan.id, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"text", name:"keluhan", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"select", name:"status", required:true, system:false, hidden:false, presentable:false, values:["Baru","Diproses","Selesai"], maxSelect:1 },
      { type:"relation", name:"ditugaskan_ke", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },
    { name: "pemasangan", type: "base", system: false, fields: [
      { type:"relation", name:"pelanggan", required:true, system:false, hidden:false, presentable:false, collectionId: pelanggan.id, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"date", name:"tanggal", required:true, system:false, hidden:false, presentable:false, min:"", max:"" },
      { type:"select", name:"status", required:true, system:false, hidden:false, presentable:false, values:["Menunggu","Dikerjakan","Selesai"], maxSelect:1 },
      { type:"relation", name:"ditugaskan_ke", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },
  ];
  app.importCollections(phase2, false);

  const gangguan = app.findCollectionByNameOrId("layanan_gangguan");
  const phase3 = [
    { name: "perbaikan", type: "base", system: false, fields: [
      { type:"relation", name:"gangguan", required:false, system:false, hidden:false, presentable:false, collectionId: gangguan.id, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"relation", name:"pelanggan", required:false, system:false, hidden:false, presentable:false, collectionId: pelanggan.id, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"date", name:"tanggal", required:true, system:false, hidden:false, presentable:false, min:"", max:"" },
      { type:"relation", name:"teknisi", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"text", name:"tindakan", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"select", name:"status", required:true, system:false, hidden:false, presentable:false, values:["Belum ditindak","Diproses","Selesai"], maxSelect:1 },
      { type:"file", name:"foto_sebelum", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      { type:"file", name:"foto_sesudah", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "absen_hadir", type: "base", system: false, fields: [
      { type:"relation", name:"teknisi", required:true, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"date", name:"tanggal", required:true, system:false, hidden:false, presentable:false, min:"", max:"" },
      { type:"text", name:"jam_masuk", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"select", name:"keterangan", required:true, system:false, hidden:false, presentable:false, values:["Hadir","Izin","Sakit"], maxSelect:1 },
      { type:"text", name:"alasan", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"select", name:"metode", required:true, system:false, hidden:false, presentable:false, values:["QR","Tugas","Admin","Mandiri"], maxSelect:1 },
      { type:"relation", name:"dicatat_oleh", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "mutasi_inventaris", type: "base", system: false, fields: [
      { type:"relation", name:"barang", required:true, system:false, hidden:false, presentable:false, collectionId: invnp.id, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"select", name:"jenis", required:true, system:false, hidden:false, presentable:false, values:["Pengadaan","Pemakaian","Penyesuaian"], maxSelect:1 },
      { type:"number", name:"jumlah", required:true, system:false, hidden:false, presentable:false, min:null, max:null, onlyInt:false },
      { type:"number", name:"stok_sebelum", required:false, system:false, hidden:false, presentable:false, min:null, max:null, onlyInt:false },
      { type:"number", name:"stok_sesudah", required:false, system:false, hidden:false, presentable:false, min:null, max:null, onlyInt:false },
      { type:"date", name:"tanggal", required:true, system:false, hidden:false, presentable:false, min:"", max:"" },
      { type:"select", name:"referensi_modul", required:false, system:false, hidden:false, presentable:false, values:["Perbaikan","Pemasangan","-"], maxSelect:1 },
      { type:"text", name:"referensi_id", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"keterangan", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"relation", name:"dicatat_oleh", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "usulan_perubahan", type: "base", system: false, fields: [
      { type:"text", name:"modul", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"record_id", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"json", name:"nilai_usulan", required:true, system:false, hidden:false, presentable:false, maxSize:100000 },
      { type:"select", name:"status", required:true, system:false, hidden:false, presentable:false, values:["Menunggu","Disetujui","Ditolak","Ditarik"], maxSelect:1 },
      { type:"relation", name:"pemohon", required:true, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"relation", name:"peninjau", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"text", name:"alasan_tolak", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"date", name:"diputuskan", required:false, system:false, hidden:false, presentable:false, min:"", max:"" },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "pengumuman", type: "base", system: false, fields: [
      { type:"text", name:"judul", required:true, system:false, hidden:false, presentable:true, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"isi", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"file", name:"foto", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      { type:"relation", name:"pembuat", required:true, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      ...common()
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "riwayat", type: "base", system: false, fields: [
      { type:"date", name:"waktu", required:true, system:false, hidden:false, presentable:false, min:"", max:"" },
      { type:"relation", name:"aktor", required:false, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"select", name:"aksi", required:true, system:false, hidden:false, presentable:false, values:["tambah","ubah","arsip","pulihkan","setujui","tolak","tarik"], maxSelect:1 },
      { type:"text", name:"modul", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"record_id", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"json", name:"nilai_lama", required:false, system:false, hidden:false, presentable:false, maxSize:100000 },
      { type:"json", name:"nilai_baru", required:false, system:false, hidden:false, presentable:false, maxSize:100000 },
      { type:"text", name:"catatan", required:false, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"autodate", name:"dibuat_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:false }
    ], listRule:"@request.auth.role = \"admin\"", viewRule:"@request.auth.role = \"admin\"", createRule:null, updateRule:null, deleteRule:null },

    { name: "pengaturan", type: "base", system: false, fields: [
      { type:"text", name:"kunci", required:true, system:false, hidden:false, presentable:true, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"json", name:"nilai", required:false, system:false, hidden:false, presentable:false, maxSize:100000 },
      { type:"autodate", name:"dibuat_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:false },
      { type:"autodate", name:"diubah_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:true }
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.role = \"admin\"", updateRule:"@request.auth.role = \"admin\"", deleteRule:"@request.auth.role = \"admin\"" },

    { name: "komentar_tugas", type: "base", system: false, fields: [
      { type:"select", name:"modul_referensi", required:true, system:false, hidden:false, presentable:false, values:["layanan_gangguan","perbaikan","pemasangan"], maxSelect:1 },
      { type:"text", name:"referensi_id", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"text", name:"isi", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"file", name:"foto", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      { type:"relation", name:"pengirim", required:true, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"autodate", name:"dibuat_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:false },
      { type:"autodate", name:"diubah_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:true }
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" },

    { name: "pesan_langsung", type: "base", system: false, fields: [
      { type:"text", name:"percakapan", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"relation", name:"pengirim", required:true, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"relation", name:"penerima", required:true, system:false, hidden:false, presentable:false, collectionId: usersId, cascadeDelete:false, minSelect:0, maxSelect:1 },
      { type:"text", name:"isi", required:true, system:false, hidden:false, presentable:false, min:0,max:0,pattern:"",autogeneratePattern:"" },
      { type:"file", name:"foto", required:false, system:false, hidden:false, presentable:false, maxSelect:1, maxSize:2097152, mimeTypes:["image/jpeg","image/png","image/webp"], thumbs:[], protected:false },
      { type:"date", name:"dibaca_pada", required:false, system:false, hidden:false, presentable:false, min:"", max:"" },
      { type:"autodate", name:"dibuat_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:false },
      { type:"autodate", name:"diubah_pada", required:false, system:false, hidden:false, presentable:false, onCreate:true, onUpdate:true }
    ], listRule:"@request.auth.id != \"\"", viewRule:"@request.auth.id != \"\"", createRule:"@request.auth.id != \"\"", updateRule:"@request.auth.id != \"\"", deleteRule:"@request.auth.id != \"\"" }
  ];
  app.importCollections(phase3, false);

  try {
    const s = app.findCollectionByNameOrId("pengaturan");
    const add=(k,v)=>{ const r=new Record(s); r.set("kunci",k); r.set("nilai",v); app.save(r); };
    add("interval_qr",30); add("jam_tutup_absen","23:59"); add("interval_sinkron_sheets",5);
  } catch(e){ console.log("init settings skipped", e); }
}, (app) => {
  const names = ["pesan_langsung","komentar_tugas","pengaturan","riwayat","pengumuman","usulan_perubahan","mutasi_inventaris","absen_hadir","perbaikan","pemasangan","layanan_gangguan","inventaris_non_perangkat","inventaris_perangkat","pelanggan"];
  for (const n of names){ try{ app.delete(app.findCollectionByNameOrId(n)); }catch(e){} }
});
