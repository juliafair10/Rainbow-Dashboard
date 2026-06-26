
function markEOJProcessed_(rowNumber, runId, outputId) {
  const sheet = getEOJLogSheet_();
  ensureEOJLogProcessingColumns_(sheet);
  const idx = indexHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  batchWriteStatusColumns_(sheet, rowNumber, idx, {
    Processing_Status: CONFIG.STATUS.PROCESSED,
    Processed_At: new Date(),
    Processing_Run_ID: runId,
    Processing_Error: '',
    Processing_Output_ID: outputId
  });
}

function markEOJError_(rowNumber, runId, errorMessage) {
  const sheet = getEOJLogSheet_();
  ensureEOJLogProcessingColumns_(sheet);
  const idx = indexHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  batchWriteStatusColumns_(sheet, rowNumber, idx, {
    Processing_Status: CONFIG.STATUS.ERROR,
    Processed_At: new Date(),
    Processing_Run_ID: runId,
    Processing_Error: errorMessage,
    Processing_Output_ID: ''
  });
}

// Writes all status column values in a single setValues() call.
// Reads the current row, applies changes, writes back — handles non-contiguous columns safely.
function batchWriteStatusColumns_(sheet, rowNumber, idx, columnValues) {
  const colEntries = Object.keys(columnValues)
    .filter(key => idx[key] !== undefined)
    .map(key => ({ col: idx[key], value: columnValues[key] }));

  if (!colEntries.length) return;

  colEntries.sort((a, b) => a.col - b.col);
  const minCol = colEntries[0].col;
  const maxCol = colEntries[colEntries.length - 1].col;
  const rangeWidth = maxCol - minCol + 1;

  const range = sheet.getRange(rowNumber, minCol + 1, 1, rangeWidth);
  const rowData = range.getValues()[0];

  colEntries.forEach(entry => {
    rowData[entry.col - minCol] = entry.value;
  });

  range.setValues([rowData]);
}

function getEOJLogSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.EOJ_SOURCE_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.EOJ_LOG_SHEET_NAME);

  if (!sheet) {
    throw new Error('EOJ_Log sheet not found.');
  }

  return sheet;
}