
function getUnprocessedEOJRows() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.EOJ_SOURCE_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.EOJ_LOG_SHEET_NAME);

  if (!sheet) {
    throw new Error('EOJ_Log sheet not found.');
  }

  ensureEOJLogProcessingColumns_(sheet);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0];
  const idx = indexHeaders_(headers);

  if (idx.Raw_JSON === undefined) {
    throw new Error('Raw_JSON column not found in EOJ_Log.');
  }

  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const status = idx.Processing_Status !== undefined ? values[i][idx.Processing_Status] : '';
    const rawJson = values[i][idx.Raw_JSON];

    if (!rawJson) {
      continue;
    }

    if (status === CONFIG.STATUS.PROCESSED || status === CONFIG.STATUS.ERROR) {
      continue;
    }

    rows.push({
      rowNumber: i + 1,
      values: values[i],
      headers,
      rawJson,
      eojId: resolveValue_(values[i], idx, ['EOJ_ID', 'EOJ Id', 'EOJID', 'ID', 'Submission_ID']),
      technician: resolveValue_(values[i], idx, ['Technician', 'Tech', 'Submitted_By']),
      jobName: resolveValue_(values[i], idx, ['Job_Name', 'Job Name']),
      claimNumber: resolveValue_(values[i], idx, ['Claim_Number', 'Claim Number']),
      customerName: resolveValue_(values[i], idx, ['Customer_Name', 'Customer Name']),
      propertyAddress: resolveValue_(values[i], idx, ['Property_Address', 'Property Address']),
      visitDate: resolveValue_(values[i], idx, ['Visit_Date', 'Visit Date', 'Date']),
      visitType: resolveValue_(values[i], idx, ['Visit_Type', 'Visit Type'])
    });
  }

  return rows;
}

function ensureEOJLogProcessingColumns_(sheet) {
  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];

  CONFIG.EOJ_LOG_REQUIRED_COLUMNS.forEach(columnName => {
    if (!headers.includes(columnName)) {
      const nextColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextColumn).setValue(columnName);
      headers.push(columnName);
    }
  });
}

function indexHeaders_(headers) {
  const idx = {};
  headers.forEach((header, index) => {
    if (header !== '') {
      idx[String(header).trim()] = index;
    }
  });
  return idx;
}

function resolveValue_(rowValues, idx, possibleHeaders) {
  for (let i = 0; i < possibleHeaders.length; i++) {
    const header = possibleHeaders[i];
    if (idx[header] !== undefined) {
      return rowValues[idx[header]];
    }
  }
  return '';
}