function writeProcessingOutput_(interpreted) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.EOJ_OUTPUT_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.PROCESSING_OUTPUT_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.PROCESSING_OUTPUT_SHEET_NAME);
  }

  ensureProcessingOutputHeaders_(sheet);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowByHeader = {
    Output_ID: interpreted.outputId,
    EOJ_ID: interpreted.eojId,
    Processing_Run_ID: interpreted.runId,
    Processed_At: interpreted.processedAt,
    Technician: interpreted.technician,
    Job_Name: interpreted.jobName,
    Claim_Number: interpreted.claimNumber,
    Customer_Name: interpreted.customerName,
    Property_Address: interpreted.propertyAddress,
    Visit_Date: interpreted.visitDate,
    Visit_Type: interpreted.visitType,
    Timeline_Event_JSON: JSON.stringify(interpreted.timelineEvent),
    Condition_Output_JSON: JSON.stringify(interpreted.conditionOutput),
    Alert_Output_JSON: JSON.stringify(interpreted.alertOutput),
    Follow_Up_Output_JSON: JSON.stringify(interpreted.followUpOutput),
    Equipment_Output_JSON: JSON.stringify(interpreted.equipmentOutput),
    Review_Output_JSON: JSON.stringify(interpreted.reviewOutput),
    Operational_Object_JSON: JSON.stringify(interpreted.operationalObjects),
    Raw_Parsed_JSON: JSON.stringify(interpreted.rawParsed),
    Processing_Status: interpreted.status,
    Processing_Notes: interpreted.notes
  };

  const row = headers.map(header => rowByHeader[header] !== undefined ? rowByHeader[header] : '');

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