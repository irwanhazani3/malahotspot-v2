// Basic unit tests for inventory mutation logic (pure functions mirrored from hook behavior)
// Run: node pb_tests/inventory_logic.test.js
const assert = require('assert');

function applyMutation(jenis, sebelum, jumlah, keterangan='', arah=''){
  jumlah = Number(jumlah); sebelum = Number(sebelum);
  if(!(jumlah > 0)) throw new Error('Jumlah mutasi harus > 0');
  let sesudah = sebelum;
  if(jenis === 'Pengadaan') sesudah = sebelum + jumlah;
  else if(jenis === 'Pemakaian') sesudah = sebelum - jumlah;
  else if(jenis === 'Penyesuaian'){
    if(arah === 'Kurang') sesudah = sebelum - jumlah;
    else if(arah === 'Tambah') sesudah = sebelum + jumlah;
    else {
      const ket = String(keterangan||'').toLowerCase();
      if(ket.includes('kurang') || ket.includes('minus') || ket.includes('turun') || ket.trim().startsWith('-')) sesudah = sebelum - jumlah; else sesudah = sebelum + jumlah;
    }
  } else throw new Error('Jenis tidak dikenal');
  if(sesudah < 0) throw new Error('Stok tidak boleh negatif');
  return sesudah;
}

(function(){
  assert.strictEqual(applyMutation('Pengadaan', 10, 5), 15);
  assert.strictEqual(applyMutation('Pemakaian', 10, 3), 7);
  assert.strictEqual(applyMutation('Penyesuaian', 10, 2, 'catatan', 'Tambah'), 12);
  assert.strictEqual(applyMutation('Penyesuaian', 10, 2, 'catatan', 'Kurang'), 8);
  // backward compat fallback
  assert.strictEqual(applyMutation('Penyesuaian', 10, 2, 'kurang selisih opname'), 8);
  let err=null; try{ applyMutation('Pemakaian', 2, 5); }catch(e){ err=e; } assert(err && /negatif/.test(err.message));
  err=null; try{ applyMutation('Pengadaan', 0, 0); }catch(e){ err=e; } assert(err);
  console.log('inventory_logic.test.js OK');
})();
