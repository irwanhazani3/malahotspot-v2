// Basic logic tests mirroring hook rules (pure)
// Run: node pb_tests/hooks_logic.test.js
const assert = require('assert');

function within10Min(createdIso, nowMs){
  const t = new Date(createdIso).getTime();
  return t > 0 && (nowMs - t) <= 10*60*1000;
}

(function(){
  const base = Date.now();
  assert.strictEqual(within10Min(new Date(base - 5*60*1000).toISOString(), base), true);
  assert.strictEqual(within10Min(new Date(base - 11*60*1000).toISOString(), base), false);
  console.log('hooks_logic.test.js OK');
})();
