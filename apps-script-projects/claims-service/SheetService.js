/**
 * Low-level Google Sheets helpers for claims-service.
 */

function getClaimFoundationSpreadsheet_() {
  return SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
}

function getSheet(sheetName) {
  const ss = getClaimFoundationSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  return sheet;
}

function getHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    return [];
  }

  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
}

function getRows(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn === 0) {
    return [];
  }

  const headers = getHeaders(sheetName);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  return values.map(function(row) {
    return objectFromHeaders_(headers, row);
  });
}

function appendRow(sheetName, object) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const values = valuesFromObject_(headers, object);

  sheet.appendRow(values);

  return successResponse({
    sheetName: sheetName,
    rowNumber: sheet.getLastRow(),
    row: object
  }, 'Row appended to ' + sheetName + '.');
}

function findRows(sheetName, criteria) {
  const rows = getRows(sheetName);
  const keys = Object.keys(criteria || {});

  if (keys.length === 0) {
    return rows;
  }

  return rows.filter(function(row) {
    return keys.every(function(key) {
      return normalizeString(row[key]) === normalizeString(criteria[key]);
    });
  });
}

function updateRowByKey(sheetName, keyColumn, keyValue, updates) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const keyIndex = headers.indexOf(keyColumn);

  if (keyIndex === -1) {
    throw new Error('Missing key column ' + keyColumn + ' in ' + sheetName);
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return notFoundResponse('No rows available in ' + sheetName + '.', {
      keyColumn: keyColumn,
      keyValue: keyValue
    });
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  for (let i = 0; i < values.length; i++) {
    if (normalizeString(values[i][keyIndex]) === normalizeString(keyValue)) {
      const rowNumber = i + 2;
      const rowObject = objectFromHeaders_(headers, values[i]);
      const updatedObject = Object.assign({}, rowObject, updates || {});
      const updatedValues = valuesFromObject_(headers, updatedObject);

      sheet.getRange(rowNumber, 1, 1, headers.length).setValues([updatedValues]);

      return successResponse({
        sheetName: sheetName,
        rowNumber: rowNumber,
        keyColumn: keyColumn,
        keyValue: keyValue,
        row: updatedObject
      }, 'Row updated in ' + sheetName + '.');
    }
  }

  return notFoundResponse('No matching row found in ' + sheetName + '.', {
    keyColumn: keyColumn,
    keyValue: keyValue
  });
}

function writeServiceLog(action, status, message, details) {
  const logRow = {
    Log_ID: generateId(CLAIM_ID_PREFIXES.log),
    Timestamp: nowIso(),
    Action: action || '',
    Status: status || '',
    Claim_ID: details && details.claimId ? details.claimId : '',
    Source_System: details && details.sourceSystem ? details.sourceSystem : CLAIM_SERVICE.name,
    Source_Record_ID: details && details.sourceRecordId ? details.sourceRecordId : '',
    Message: message || '',
    Error_Detail: details && details.error ? String(details.error) : '',
    Raw_JSON: stringifyJson(details || {})
  };

  return appendRow(CLAIM_SHEET_NAMES.serviceLog, logRow);
}

function testClaimFoundationSheetConnection() {
  const ss = getClaimFoundationSpreadsheet_();
  const claimsHeaders = getHeaders(CLAIM_SHEET_NAMES.claims);
  const timelineHeaders = getHeaders(CLAIM_SHEET_NAMES.timeline);

  writeServiceLog('testClaimFoundationSheetConnection', 'Success', 'Sheet connection test completed.', {
    sourceSystem: CLAIM_SERVICE.name,
    spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID
  });

  return successResponse({
    spreadsheetName: ss.getName(),
    spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID,
    claimsHeaderCount: claimsHeaders.length,
    timelineHeaderCount: timelineHeaders.length
  }, 'Claim Foundation spreadsheet connection verified.');
}
