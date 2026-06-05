
function writeProcessingOutput_(interpreted) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.EOJ_OUTPUT_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.PROCESSING_OUTPUT_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.PROCESSING_OUTPUT_SHEET_NAME);
  }

  ensureProcessingOutputHeaders_(sheet);

  const row = [
    interpreted.outputId,
    interpreted.eojId,
    interpreted.runId,
    interpreted.processedAt,
    interpreted.technician,
    interpreted.jobName,
    interpreted.claimNumber,
    interpreted.customerName,
    interpreted.propertyAddress,
    interpreted.visitDate,
    interpreted.visitType,
    JSON.stringify(interpreted.timelineEvent),
    JSON.stringify(interpreted.conditionOutput),
    JSON.stringify(interpreted.alertOutput),
    JSON.stringify(interpreted.followUpOutput),
    JSON.stringify(interpreted.equipmentOutput),
    JSON.stringify(interpreted.reviewOutput),
    JSON.stringify(interpreted.rawParsed),
    interpreted.status,
    interpreted.notes
  ];

  sheet.appendRow(row);
  return interpreted.outputId;
}

function ensureProcessingOutputHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONFIG.OUTPUT_COLUMNS.length).setValues([CONFIG.OUTPUT_COLUMNS]);
    return;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const missingHeaders = CONFIG.OUTPUT_COLUMNS.filter(header => !existingHeaders.includes(header));

  if (missingHeaders.length > 0) {
    const startColumn = sheet.getLastColumn() + 1;
    sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}