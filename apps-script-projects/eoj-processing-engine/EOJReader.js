
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

  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = idx.Processing_Status !== undefined ? String(row[idx.Processing_Status] || '') : '';

    if (status === CONFIG.STATUS.PROCESSED || status === CONFIG.STATUS.ERROR) {
      continue;
    }

    // Resolve Raw_JSON by header name first, then fall back to scanning the row.
    let rawJson = idx.Raw_JSON !== undefined ? row[idx.Raw_JSON] : undefined;
    const rawJsonLooksValid = isJsonPayload_(rawJson);

    if (!rawJsonLooksValid) {
      const fallback = findJsonInRow_(row);
      if (fallback) {
        if (rawJson !== undefined && rawJson !== '') {
          Logger.log(
            'EOJReader WARNING: Row ' + (i + 1) + ' — header says Raw_JSON is at column ' + idx.Raw_JSON +
            ' but that value does not parse as JSON (first 80 chars: "' + String(rawJson).slice(0, 80) + '").' +
            ' Using fallback JSON found at column ' + fallback.col + '.'
          );
          Logger.log('EOJReader: Headers (first 30): ' + JSON.stringify(headers.slice(0, 30)));
        }
        rawJson = fallback.value;
      } else {
        if (rawJson !== undefined && rawJson !== '' && rawJson !== null) {
          Logger.log(
            'EOJReader ERROR: Row ' + (i + 1) + ' — Raw_JSON column (idx=' + idx.Raw_JSON + ') value is not JSON' +
            ' and no JSON fallback found. Value (first 80 chars): "' + String(rawJson).slice(0, 80) + '".' +
            '\nHeaders (first 30): ' + JSON.stringify(headers.slice(0, 30))
          );
        }
        continue;
      }
    }

    if (!rawJson) {
      continue;
    }

    rows.push({
      rowNumber: i + 1,
      values: row,
      headers,
      rawJson,
      eojId:           resolveValue_(row, idx, ['EOJ_ID', 'EOJ Id', 'EOJID', 'ID', 'Submission_ID']),
      technician:      resolveValue_(row, idx, ['Technician', 'Tech', 'Submitted_By']),
      jobName:         resolveValue_(row, idx, ['Job_Name', 'Job Name']),
      claimNumber:     resolveValue_(row, idx, ['Claim_Number', 'Claim Number']),
      claimId:         resolveValue_(row, idx, ['Claim_ID', 'ClaimId']),
      customerName:    resolveValue_(row, idx, ['Customer_Name', 'Customer Name']),
      propertyAddress: resolveValue_(row, idx, ['Property_Address', 'Property Address']),
      visitDate:       resolveValue_(row, idx, ['Visit_Date', 'Visit Date', 'Date']),
      visitType:       resolveValue_(row, idx, ['Visit_Type', 'Visit Type'])
    });
  }

  return rows;
}

// Returns true if the value looks like a JSON object payload.
function isJsonPayload_(value) {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'object') return true;
  const s = String(value).trim();
  return s.length > 2 && s[0] === '{';
}

// Scans a row from right to left for the first cell that parses as a JSON object.
// Returns { col, value } or null.
function findJsonInRow_(row) {
  for (let col = row.length - 1; col >= 0; col--) {
    const val = row[col];
    if (typeof val === 'string' && val.length > 10 && val.trim()[0] === '{') {
      try {
        JSON.parse(val);
        return { col: col, value: val };
      } catch (e) {
        // not valid JSON — keep scanning
      }
    }
  }
  return null;
}

/**
 * Run from the Apps Script editor to diagnose EOJ_Log column mapping.
 * Check View → Logs after running.
 */
function testReadUnprocessedEOJs() {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.EOJ_SOURCE_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(CONFIG.EOJ_LOG_SHEET_NAME);

  if (!sheet) {
    Logger.log('ERROR: Sheet "' + CONFIG.EOJ_LOG_SHEET_NAME + '" not found.');
    return;
  }

  ensureEOJLogProcessingColumns_(sheet);

  const values = sheet.getDataRange().getValues();
  Logger.log('Total rows (including header): ' + values.length);

  if (values.length < 1) {
    Logger.log('Sheet is empty — no header row.');
    return;
  }

  const headers = values[0];
  const idx = indexHeaders_(headers);

  Logger.log('Header count: ' + headers.filter(function(h) { return h !== ''; }).length);
  Logger.log('Headers (all): ' + JSON.stringify(headers));
  Logger.log('idx.EOJ_ID:            ' + idx['EOJ_ID']);
  Logger.log('idx.Claim_ID:          ' + idx['Claim_ID']);
  Logger.log('idx.Processing_Status: ' + idx['Processing_Status']);
  Logger.log('idx.Raw_JSON:          ' + idx['Raw_JSON']);

  if (values.length < 2) {
    Logger.log('No data rows.');
    return;
  }

  // Find and log the first unprocessed row.
  const terminal = new Set([CONFIG.STATUS.PROCESSED, CONFIG.STATUS.ERROR]);
  let foundUnprocessed = false;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = idx.Processing_Status !== undefined ? String(row[idx.Processing_Status] || '') : '';
    if (terminal.has(status)) continue;

    foundUnprocessed = true;
    Logger.log('--- First unprocessed row: ' + (i + 1) + ' ---');
    Logger.log('  EOJ_ID:            ' + (idx['EOJ_ID']   !== undefined ? row[idx['EOJ_ID']]   : 'column missing'));
    Logger.log('  Claim_ID:          ' + (idx['Claim_ID'] !== undefined ? row[idx['Claim_ID']] : 'column missing'));
    Logger.log('  Processing_Status: ' + status);

    const rawJsonColIdx = idx['Raw_JSON'];
    const rawJsonValue  = rawJsonColIdx !== undefined ? row[rawJsonColIdx] : undefined;
    const rawJsonStr    = (rawJsonValue !== undefined && rawJsonValue !== null) ? String(rawJsonValue) : '';

    Logger.log('  idx.Raw_JSON column index:        ' + rawJsonColIdx);
    Logger.log('  Raw_JSON value (first 100 chars): "' + rawJsonStr.slice(0, 100) + '"');
    Logger.log('  Raw_JSON looks like JSON:         ' + (rawJsonStr.trim().length > 0 && rawJsonStr.trim()[0] === '{'));

    // If the header-resolved value is not JSON, report what the fallback scan finds.
    if (!isJsonPayload_(rawJsonValue)) {
      const fallback = findJsonInRow_(row);
      if (fallback) {
        Logger.log('  FALLBACK: JSON found at column ' + fallback.col + ' (first 100 chars): "' + String(fallback.value).slice(0, 100) + '"');
        Logger.log('  DIAGNOSIS: Header row is out of sync with data rows. Re-run setupEOJLogSheet() in the EOJ App to repair the header, then push via clasp.');
      } else {
        Logger.log('  FALLBACK: No JSON object found anywhere in this row. The submission may be corrupt.');
      }
    }

    break;
  }

  if (!foundUnprocessed) {
    Logger.log('No unprocessed rows found.');
  }
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