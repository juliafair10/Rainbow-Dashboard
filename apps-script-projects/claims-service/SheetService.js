/**
 * Low-level Google Sheets helpers for claims-service.
 */

var CLAIMS_READ_CACHE_SECONDS = 30;

function getReadCache_() {
  return CacheService.getScriptCache();
}

function getCachedJson_(key) {
  try {
    var value = getReadCache_().get(key);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    return null;
  }
}

function putCachedJson_(key, value) {
  try {
    getReadCache_().put(key, JSON.stringify(value), CLAIMS_READ_CACHE_SECONDS);
  } catch (e) {
    // Non-fatal.
  }
}

function invalidateSheetCache_(sheetName) {
  try {
    getReadCache_().remove('headers:' + sheetName);
    getReadCache_().remove('rows:' + sheetName);
  } catch (e) {
    // Non-fatal.
  }
}

function getClaimFoundationSpreadsheet_() {
  return SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
}

function getSheet(sheetName) {
  const ss = getClaimFoundationSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  return sheet;
}

function normalizeHeaderName_(header) {
  return String(header || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function normalizeHeaders_(headers) {
  return (headers || []).map(function(header) {
    return normalizeHeaderName_(header);
  });
}

function getHeaders(sheetName) {
  const cached = getCachedJson_('headers:' + sheetName);
  if (cached) {
    return cached;
  }
  const sheet = getSheet(sheetName);
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    return [];
  }

  const headers = normalizeHeaders_(sheet.getRange(1, 1, 1, lastColumn).getValues()[0]);
  putCachedJson_('headers:' + sheetName, headers);
  return headers;
}

function getRows(sheetName) {
  const cached = getCachedJson_('rows:' + sheetName);
  if (cached) {
    return cached;
  }
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn === 0) {
    return [];
  }

  const headers = getHeaders(sheetName);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();

  const rows = values.map(function(row) {
    return objectFromHeaders_(headers, row);
  });

  putCachedJson_('rows:' + sheetName, rows);
  return rows;
}

function appendRow(sheetName, object) {
  const sheet = getSheet(sheetName);
  const headers = getHeaders(sheetName);
  const values = valuesFromObject_(headers, object);

  sheet.appendRow(values);
  invalidateSheetCache_(sheetName);

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
      invalidateSheetCache_(sheetName);

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

function runPhase7HealthPrerequisiteMigration() {
  const results = {
    claimsColumns: ensureSheetColumns_(CLAIM_SHEET_NAMES.claims, CLAIM_FOUNDATION_SHEETS.Claims),
    healthHistorySheet: ensureSheetExistsWithHeaders_(CLAIM_SHEET_NAMES.healthHistory, CLAIM_FOUNDATION_SHEETS.Claim_Health_History),
    blankConditionCleanup: cleanupBlankConditionRows_()
  };

  writeServiceLog('runPhase7HealthPrerequisiteMigration', 'Success', 'Phase 7 health prerequisites completed.', {
    sourceSystem: CLAIM_SERVICE.name,
    results: results
  });

  return successResponse(results, 'Phase 7 health prerequisites completed.');
}

function ensureSheetExistsWithHeaders_(sheetName, requiredHeaders) {
  const ss = getClaimFoundationSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  let created = false;

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    created = true;
  }

  const columnResult = ensureSheetColumns_(sheetName, requiredHeaders || []);

  sheet.setFrozenRows(1);

  const headerCount = getHeaders(sheetName).length;
  if (headerCount > 0) {
    sheet.getRange(1, 1, 1, headerCount).setFontWeight('bold');
    sheet.autoResizeColumns(1, headerCount);
  }

  return {
    sheetName: sheetName,
    created: created,
    columnResult: columnResult
  };
}

function ensureSheetColumns_(sheetName, requiredHeaders) {
  const sheet = getSheet(sheetName);
  const existingHeaders = getHeaders(sheetName);
  const addedColumns = [];

  if (existingHeaders.length === 0 && requiredHeaders.length > 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);

    return {
      sheetName: sheetName,
      addedColumns: requiredHeaders,
      alreadyPresentCount: 0
    };
  }

  (requiredHeaders || []).forEach(function(header) {
    const currentHeaders = getHeaders(sheetName);

    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      addedColumns.push(header);
    }
  });

  return {
    sheetName: sheetName,
    addedColumns: addedColumns,
    alreadyPresentCount: requiredHeaders.length - addedColumns.length
  };
}

function cleanupBlankConditionRows_() {
  const sheet = getSheet(CLAIM_SHEET_NAMES.conditions);
  const headers = getHeaders(CLAIM_SHEET_NAMES.conditions);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return {
      sheetName: CLAIM_SHEET_NAMES.conditions,
      cleanedRows: 0,
      deletedConditionIds: []
    };
  }

  const conditionIdIndex = headers.indexOf('Condition_ID');
  const conditionTypeIndex = headers.indexOf('Condition_Type');
  const conditionStatusIndex = headers.indexOf('Condition_Status');
  const openedAtIndex = headers.indexOf('Opened_At');

  if (conditionIdIndex === -1 || conditionTypeIndex === -1 || conditionStatusIndex === -1 || openedAtIndex === -1) {
    return {
      sheetName: CLAIM_SHEET_NAMES.conditions,
      skipped: true,
      reason: 'Required condition columns were not found.',
      cleanedRows: 0,
      deletedConditionIds: []
    };
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const deletedConditionIds = [];

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const conditionId = row[conditionIdIndex];
    const conditionType = row[conditionTypeIndex];
    const conditionStatus = row[conditionStatusIndex];
    const openedAt = row[openedAtIndex];

    const isBlankCondition = conditionId && !conditionType && !conditionStatus && !openedAt;

    if (isBlankCondition) {
      sheet.deleteRow(i + 2);
      deletedConditionIds.push(conditionId);
    }
  }

  return {
    sheetName: CLAIM_SHEET_NAMES.conditions,
    cleanedRows: deletedConditionIds.length,
    deletedConditionIds: deletedConditionIds
  };
}

function testClaimFoundationSheetConnection() {
  const ss = getClaimFoundationSpreadsheet_();
  const claimsHeaders = getHeaders(CLAIM_SHEET_NAMES.claims);
  const timelineHeaders = getHeaders(CLAIM_SHEET_NAMES.timeline);

  writeServiceLog('testClaimFoundationSheetConnection', 'Success', 'Sheet connection test completed.', {
    sourceSystem: CLAIM_SERVICE.name,
    spreadsheetId: CLAIM_SERVICE.spreadsheetId
  });

  return successResponse({
    spreadsheetName: ss.getName(),
    spreadsheetId: CLAIM_SERVICE.spreadsheetId,
    claimsHeaderCount: claimsHeaders.length,
    timelineHeaderCount: timelineHeaders.length
  }, 'Claims spreadsheet connection verified.');
}
