/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    app.db().newQuery("UPDATE inventaris_non_perangkat SET nama_barang = trim(nama_barang) WHERE nama_barang IS NOT NULL").execute();
  } catch (e) {
    console.log('[migration] normalisasi nama_barang:', String(e));
  }
  try {
    app.db().newQuery("CREATE UNIQUE INDEX IF NOT EXISTS idx_inventaris_non_perangkat_nama_barang_unique ON inventaris_non_perangkat(lower(trim(nama_barang))) WHERE nama_barang <> ''").execute();
  } catch (e) {
    console.log('[migration] indeks unik nama_barang gagal (mungkin ada duplikat):', String(e));
  }
}, (app) => {
  try {
    app.db().newQuery("DROP INDEX IF EXISTS idx_inventaris_non_perangkat_nama_barang_unique").execute();
  } catch (e) {}
});
