
function markEOJProcessed_(rowNumber, runId, outputId) {
  const sheet = getEOJLogSheet_();
  ensureEOJLogProcessingColumns_(sheet);

  const idx = indexHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);

  sheet.getRange(rowNumber, idx.Processing_Status + 1).setValue(CONFIG.STATUS.PROCESSED);
  sheet.getRange(rowNumber, idx.Processed_At + 1).setValue(new Date());
  sheet.getRange(rowNumber, idx.Processing_Run_ID + 1).setValue(runId);
  sheet.getRange(rowNumber, idx.Processing_Error + 1).setValue('');
  sheet.getRange(rowNumber, idx.Processing_Output_ID + 1).setValue(outputId);
}

function markEOJError_(rowNumber, runId, errorMessage) {
  const sheet = getEOJLogSheet_();
  ensureEOJLogProcessingColumns_(sheet);

  const idx = indexHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);

  sheet.getRange(rowNumber, idx.Processing_Status + 1).setValue(CONFIG.STATUS.ERROR);
  sheet.getRange(rowNumber, idx.Processed_At + 1).setValue(new Date());
  sheet.getRange(rowNumber, idx.Processing_Run_ID + 1).setValue(runId);
  sheet.getRange(rowNumber, idx.Processing_Error + 1).setValue(errorMessage);
  sheet.getRange(rowNumber, idx.Processing_Output_ID + 1).setValue('');
}

function getEOJLogSheet_() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.EOJ_SOURCE_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.EOJ_LOG_SHEET_NAME);

  if (!sheet) {
    throw new Error('EOJ_Log sheet not found.');
  }

  return sheet;
}