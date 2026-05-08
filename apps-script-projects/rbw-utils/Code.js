function myFunction() {
  /** =========================
 *  RBW-Utils Library (MyLib)
 *  Modules: MyLib.utils, MyLib.Aging
 *  Call from a workbook as:
 *    MyLib.Aging.buildAgingSheet('Accounts Recievable','O','P','Aging');
 *  ========================= */

var MyLib = (typeof MyLib !== 'undefined') ? MyLib : {};

// --------------------------- utils ---------------------------
MyLib.utils = (function () {
  /** Get existing sheet by name or create it */
  function getOrCreateSheet(name) {
    const ss = SpreadsheetApp.getActive();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  }

  /** Build a map of header text → 1-based column index */
  function getColIndexMap(sheet, headerRow) {
    headerRow = headerRow || 1;
    const lastCol = Math.max(1, sheet.getLastColumn());
    const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
    const map = {};
    headers.forEach((h, i) => {
      const key = String(h || '').trim();
      if (key) map[key] = i + 1;
    });
    return map;
  }

  /** Normalize currency/number strings to Number (handles $, commas, parentheses) */
  function toNumber(v) {
    if (v === null || v === '') return null;
    if (typeof v === 'number') return v;
    const s = String(v).trim()
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .replace(/^\((.*)\)$/, '-$1'); // (123) -> -123
    const n = Number(s);
    return isNaN(n) ? null : n;
  }

  /** Convert cell value to Date or null */
  function toDate(v) {
    if (v == null || v === '') return null;
    if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return v;
    if (typeof v === 'number') {
      // Defensive: rarely needed because getValues returns Date objects
      const epoch = new Date(Math.round((v - 25569) * 86400 * 1000));
      return isNaN(epoch) ? null : epoch;
    }
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }

  /** Age in days (defaults to today) */
  function ageInDays(d, today) {
    if (!d) return null;
    today = today || new Date();
    const ms = today.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0);
    return Math.floor(ms / 86400000);
  }

  /** Bucket label for an age value */
  function bucketForAge(age) {
    if (age == null || age < 0) return '';
    if (age <= 60) return 'Current (0-60)';
    if (age <= 90) return '60-90 Days';
    return '>90 Days';
  }

  /** Sum amounts into buckets given parallel arrays of dates and amounts */
  function sumBuckets(dates, amts) {
    let current = 0, d60_90 = 0, d90p = 0;
    const today = new Date();
    for (let i = 0; i < dates.length; i++) {
      const d = toDate(dates[i]);
      const a = toNumber(amts[i]);
      if (!d || !a || a === 0) continue;
      const age = ageInDays(d, today);
      if (age == null) continue;
      if (age <= 60) current += a;
      else if (age <= 90) d60_90 += a;
      else d90p += a;
    }
    return { current, d60_90, d90p, total: current + d60_90 + d90p };
  }

  return {
    getOrCreateSheet,
    getColIndexMap,
    toNumber,
    toDate,
    ageInDays,
    bucketForAge,
    sumBuckets
  };
})();

// --------------------------- Aging ---------------------------
MyLib.Aging = (function () {
  /**
   * Build/refresh an "Aging" tab with:
   *  - Three bucket totals (Current 0–60, 60–90, >90)
   *  - A detail table that auto-filters to rows with a valid date and amount > 0
   *
   * @param {string} dataSheetName   e.g., 'Accounts Recievable'
   * @param {string} dateColLetter   e.g., 'O'
   * @param {string} amountColLetter e.g., 'P'
   * @param {string} agingSheetName  e.g., 'Aging'
   */
  function buildAgingSheet(dataSheetName, dateColLetter, amountColLetter, agingSheetName) {
    const ss = SpreadsheetApp.getActive();
    const src = ss.getSheetByName(dataSheetName);
    if (!src) throw new Error('Data sheet not found: ' + dataSheetName);

    const aging = MyLib.utils.getOrCreateSheet(agingSheetName || 'Aging');
    aging.clear();

    // Title / As-of
    aging.getRange('A1').setValue(
      'Accounts Receivable Aging (based on ' + dateColLetter + ' = Date, ' + amountColLetter + ' = Amount)'
    ).setFontWeight('bold');
    aging.getRange('A3').setValue('As of:');
    aging.getRange('B3').setFormula('=TODAY()');

    // Summary buckets
    aging.getRange('A5:B5').setValues([['Bucket','Total Outstanding']]).setFontWeight('bold');
    aging.getRange('A6:A8').setValues([['Current (0-60)'],['60-90 Days'],['>90 Days']]);

    const tab = "'" + dataSheetName + "'";
    const d = `${tab}!${dateColLetter}:${dateColLetter}`;
    const a = `${tab}!${amountColLetter}:${amountColLetter}`;

    aging.getRange('B6').setFormula(
      `=SUM(FILTER(${a}, ISNUMBER(${d}), TODAY()-${d}<=60, TODAY()-${d}>=0))`
    );
    aging.getRange('B7').setFormula(
      `=SUM(FILTER(${a}, ISNUMBER(${d}), TODAY()-${d}>60, TODAY()-${d}<=90))`
    );
    aging.getRange('B8').setFormula(
      `=SUM(FILTER(${a}, ISNUMBER(${d}), TODAY()-${d}>90))`
    );
    aging.getRange('B6:B8').setNumberFormat('$#,##0.00;[Red]$#,##0.00');

    // Detail table (visible-only via FILTER; hides blank/zero by excluding them)
    aging.getRange('D5:H5')
      .setValues([['Row','Date ('+dateColLetter+')','Amount ('+amountColLetter+')','Age (days)','Bucket']])
      .setFontWeight('bold');

    const spill = [
      "=LET(",
      `  dateCol, ${d},`,
      `  amtCol,  ${a},`,
      "  age,     TODAY()-dateCol,",
      '  bucket,  IF(age<=60,"Current (0-60)", IF(age<=90,"60-90 Days", ">90 Days")),',
      "  FILTER({ROW(dateCol), dateCol, amtCol, age, bucket}, ISNUMBER(dateCol) * (amtCol>0))",
      ")"
    ].join("");
    aging.getRange('D6').setFormula(spill);

    // Formatting
    aging.setColumnWidths(1, 2, 170); // A:B
    aging.setColumnWidths(4, 5, 150); // D:H
    aging.getRange('E:E').setNumberFormat('mm/dd/yyyy');
    aging.getRange('F:F').setNumberFormat('$#,##0.00;[Red]$#,##0.00');
    aging.getRange('G:G').setNumberFormat('0');

    SpreadsheetApp.flush();
  }

  return { buildAgingSheet };
})();

/** Optional shim: guarantees a top-level exported function (useful if you prefer calling a flat function) */
function Aging_buildAgingSheet(dataSheetName, dateCol, amountCol, agingSheetName) {
  return MyLib.Aging.buildAgingSheet(dataSheetName, dateCol, amountCol, agingSheetName);
}
}
