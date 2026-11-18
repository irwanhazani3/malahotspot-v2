// Test perilaku Apps Script tanpa Google: pastikan sinkron bersifat upsert dan
// tidak pernah menghapus baris saat data web kosong.
// Run: node pb_tests/sheets_apps_script.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        row.push(this.sheet.getCell(this.row + r, this.col + c));
      }
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        this.sheet.setCell(this.row + r, this.col + c, values[r][c]);
      }
    }
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.rows = [];
    this.frozenRows = 0;
  }
  getLastRow() {
    let last = 0;
    for (let r = 0; r < this.rows.length; r++) {
      const row = this.rows[r] || [];
      if (row.some(v => v !== '' && v !== null && v !== undefined)) last = r + 1;
    }
    return last;
  }
  getLastColumn() {
    let max = 0;
    for (const row of this.rows) {
      for (let c = 0; c < (row || []).length; c++) {
        const v = row[c];
        if (v !== '' && v !== null && v !== undefined) max = Math.max(max, c + 1);
      }
    }
    return max;
  }
  getRange(row, col, numRows, numCols) {
    return new MockRange(this, row, col, numRows, numCols);
  }
  insertRowBefore(before) {
    this.rows.splice(before - 1, 0, []);
  }
  setFrozenRows(n) {
    this.frozenRows = n;
  }
  ensure(row, col) {
    while (this.rows.length < row) this.rows.push([]);
    for (const r of this.rows) {
      while (r.length < col) r.push('');
    }
  }
  getCell(row, col) {
    const r = this.rows[row - 1];
    return r && r[col - 1] !== undefined ? r[col - 1] : '';
  }
  setCell(row, col, value) {
    this.ensure(row, col);
    this.rows[row - 1][col - 1] = value;
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets[name] = sheet;
    return sheet;
  }
}

const ss = new MockSpreadsheet();
const sandbox = {
  console,
  SpreadsheetApp: {
    openById() {
      return ss;
    }
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) {
          if (key === 'TOKEN') return 'tok';
          if (key === 'SPREADSHEET_ID') return 'sheet-id';
          return '';
        }
      };
    }
  },
  LockService: {
    getScriptLock() {
      return {
        tryLock() { return true; },
        releaseLock() {}
      };
    }
  },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput(text) {
      return {
        text,
        setMimeType() { return this; }
      };
    }
  }
};

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '..', 'docs', 'apps-script-sheets.gs'), 'utf8');
vm.runInContext(code, sandbox);

function post(modules) {
  const res = sandbox.doPost({
    postData: {
      contents: JSON.stringify({ token: 'tok', modules })
    }
  });
  const data = JSON.parse(res.text);
  assert.strictEqual(data.ok, true, data.error || 'doPost gagal');
  return data;
}

(function () {
  // 1) Sinkron awal membuat header dan menambahkan dua baris.
  let result = post([{
    nama: 'pelanggan',
    headers: ['nama', 'id'],
    rows: [['Budi', 'p1'], ['Ani', 'p2']]
  }]);
  const pel = ss.getSheetByName('pelanggan');
  assert.strictEqual(result.appended, 2);
  assert.strictEqual(pel.getCell(1, 1), 'nama');
  assert.strictEqual(pel.getCell(1, 2), 'id');
  assert.strictEqual(pel.getLastRow(), 3);
  assert.strictEqual(pel.getCell(2, 1), 'Budi');
  assert.strictEqual(pel.getCell(3, 1), 'Ani');

  // 2) Data p2 hilang dari web/payload. Baris p2 HARUS tetap ada.
  result = post([{
    nama: 'pelanggan',
    headers: ['nama', 'id'],
    rows: [['Budi Baru', 'p1']]
  }]);
  assert.strictEqual(result.updated, 1);
  assert.strictEqual(pel.getLastRow(), 3);
  assert.strictEqual(pel.getCell(2, 1), 'Budi Baru');
  assert.strictEqual(pel.getCell(3, 1), 'Ani');

  // 3) Snapshot kosong tidak boleh menghapus header/baris.
  result = post([{
    nama: 'pelanggan',
    headers: ['nama', 'id'],
    rows: []
  }]);
  assert.strictEqual(result.appended, 0);
  assert.strictEqual(pel.getLastRow(), 3);
  assert.strictEqual(pel.getCell(2, 1), 'Budi Baru');
  assert.strictEqual(pel.getCell(3, 1), 'Ani');

  // 4) Tab lama tanpa kolom id: data lama dipertahankan, id diisi otomatis,
  //    dan tidak menghasilkan baris duplikat.
  const legacy = ss.insertSheet('layanan_gangguan');
  legacy.setCell(1, 1, 'pelanggan');
  legacy.setCell(1, 2, 'keluhan');
  legacy.setCell(2, 1, 'Budi');
  legacy.setCell(2, 2, 'Internet putus');
  result = post([{
    nama: 'layanan_gangguan',
    headers: ['pelanggan', 'keluhan', 'id'],
    rows: [['Budi', 'Internet putus', 'g1']]
  }]);
  assert.strictEqual(result.appended, 0);
  assert.strictEqual(legacy.getLastRow(), 2);
  assert.strictEqual(legacy.getCell(1, 3), 'id');
  assert.strictEqual(legacy.getCell(2, 3), 'g1');
  assert.strictEqual(legacy.getCell(2, 2), 'Internet putus');

  // 5) Kolom tambahan buatan pengguna tidak hilang saat baris diperbarui.
  const extra = ss.insertSheet('inventaris_perangkat');
  extra.setCell(1, 1, 'nama');
  extra.setCell(1, 2, 'id');
  extra.setCell(1, 3, 'catatan_manual');
  extra.setCell(2, 1, 'Router');
  extra.setCell(2, 2, 'r1');
  extra.setCell(2, 3, 'jangan dihapus');
  post([{
    nama: 'inventaris_perangkat',
    headers: ['nama', 'id'],
    rows: [['Router Baru', 'r1']]
  }]);
  assert.strictEqual(extra.getLastRow(), 2);
  assert.strictEqual(extra.getCell(2, 1), 'Router Baru');
  assert.strictEqual(extra.getCell(2, 2), 'r1');
  assert.strictEqual(extra.getCell(2, 3), 'jangan dihapus');

  // 6) Payload tanpa modul tidak mengubah apa pun.
  const before = JSON.stringify(pel.rows);
  result = post([]);
  assert.strictEqual(result.modules, 0);
  assert.strictEqual(JSON.stringify(pel.rows), before);

  // 7) Tab lama tanpa baris header: baris pertama adalah data dan tidak boleh
  //    hilang. Header disisipkan dan id lama diisi tanpa membuat duplikat.
  const noHeader = ss.insertSheet('perbaikan');
  noHeader.setCell(1, 1, 'Budi');
  noHeader.setCell(1, 2, 'Router rusak');
  noHeader.setCell(1, 3, '2026-11-18');
  noHeader.setCell(2, 1, 'Ani');
  noHeader.setCell(2, 2, 'Kabel putus');
  noHeader.setCell(2, 3, '2026-11-18');
  result = post([{
    nama: 'perbaikan',
    headers: ['pelanggan', 'tindakan', 'tanggal', 'id'],
    rows: [
      ['Budi', 'Router rusak', '2026-11-18', 'r1'],
      ['Ani', 'Kabel putus', '2026-11-18', 'r2']
    ]
  }]);
  assert.strictEqual(result.appended, 0);
  assert.strictEqual(noHeader.getLastRow(), 3, 'baris data tidak boleh hilang');
  assert.strictEqual(noHeader.getCell(1, 1), 'pelanggan');
  assert.strictEqual(noHeader.getCell(1, 4), 'id');
  assert.strictEqual(noHeader.getCell(2, 1), 'Budi');
  assert.strictEqual(noHeader.getCell(2, 3), '2026-11-18');
  assert.strictEqual(noHeader.getCell(2, 4), 'r1');
  assert.strictEqual(noHeader.getCell(3, 1), 'Ani');
  assert.strictEqual(noHeader.getCell(3, 4), 'r2');

  console.log('sheets_apps_script.test.js OK');
})();
