// Basic unit test for WITA display formatting logic
// Run: node pb_tests/wita_format.test.js
const assert = require('assert');
function witaDisplay(v){
  if(!v) return '';
  const d = new Date(v); if(isNaN(d)) return String(v);
  const w = new Date(d.getTime()+8*3600*1000);
  const p=n=>String(n).padStart(2,'0');
  return `${w.getUTCFullYear()}-${p(w.getUTCMonth()+1)}-${p(w.getUTCDate())} ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`;
}
(function(){
  // 2026-01-01T00:00:00Z -> 2026-01-01 08:00 WITA
  assert.strictEqual(witaDisplay('2026-01-01T00:00:00Z'), '2026-01-01 08:00');
  assert.strictEqual(witaDisplay(''), '');
  console.log('wita_format.test.js OK');
})();
