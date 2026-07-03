/**
 * EojAdminService.js — automation-dashboard
 *
 * Server-side data functions for the EOJ Admin view (?view=eojAdmin).
 * Reads from the EOJ Database and Claims Database.
 * Provides status visibility, error review, and retry capability.
 */

var EOJ_ADMIN_DATABASE_ID_  = '10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs';
var EOJ_ADMIN_LOG_SHEET_    = 'EOJ_Log';
var EOJ_ADMIN_MAX_ROWS_     = 50;

/**
 * Return recent EOJ submissions for the admin dashboard.
 * Returns up to EOJ_ADMIN_MAX_ROWS_ rows in reverse-chronological order.
 */
function getEojAdminData() {
  try {
    const ss    = SpreadsheetApp.openById(EOJ_ADMIN_DATABASE_ID_);
    const sheet = ss.getSheetByName(EOJ_ADMIN_LOG_SHEET_);

    if (!sheet || sheet.getLastRow() < 2) {
      return { ok: true, data: { rows: [], headers: [], spreadsheetUrl: ss.getUrl(), sheetName: EOJ_ADMIN_LOG_SHEET_ } };
    }

    const values  = sheet.getDataRange().getValues();
    const headers = values[0].map(function(h) { return String(h || '').trim(); });
    const idx     = buildIdx_(headers);

    // Read rows newest-first
    const rows = [];
    for (var i = values.length - 1; i >= 1; i--) {
      if (rows.length >= EOJ_ADMIN_MAX_ROWS_) break;
      const row = values[i];

      rows.push({
        rowNumber:        i + 1,
        eojId:            cellStr_(row, idx, 'EOJ_ID'),
        submittedAt:      cellStr_(row, idx, 'Submitted_At'),
        technician:       cellStr_(row, idx, 'Technician'),
        jobName:          cellStr_(row, idx, 'Job_Name'),
        claimId:          cellStr_(row, idx, 'Claim_ID'),
        claimNumber:      cellStr_(row, idx, 'Claim_Number'),
        visitDate:        cellStr_(row, idx, 'Visit_Date'),
        visitType:        cellStr_(row, idx, 'Visit_Type'),
        jobStatus:        cellStr_(row, idx, 'Job_Status'),
        processingStatus: cellStr_(row, idx, 'Processing_Status'),
        processedAt:      cellStr_(row, idx, 'Processed_At'),
        processingError:  cellStr_(row, idx, 'Processing_Error'),
        processingRunId:  cellStr_(row, idx, 'Processing_Run_ID')
      });
    }

    return {
      ok: true,
      data: {
        rows: rows,
        headers: headers,
        spreadsheetUrl: ss.getUrl(),
        sheetName: EOJ_ADMIN_LOG_SHEET_,
        totalDataRows: values.length - 1
      }
    };
  } catch (err) {
    Logger.log('getEojAdminData error: ' + err.message);
    return { ok: false, error: { message: err.message } };
  }
}

/**
 * Reset a single EOJ row from 'Error' back to 'New' so the processing
 * engine picks it up on the next trigger run.
 * Only resets rows that currently have Processing_Status = 'Error'.
 *
 * @param {number} rowNumber - 1-based sheet row number
 * @returns {{ ok: boolean, message: string }}
 */
function retryEojRow(rowNumber) {
  try {
    if (!rowNumber || rowNumber < 2) {
      return { ok: false, error: { message: 'Invalid row number.' } };
    }

    const ss    = SpreadsheetApp.openById(EOJ_ADMIN_DATABASE_ID_);
    const sheet = ss.getSheetByName(EOJ_ADMIN_LOG_SHEET_);

    if (!sheet) {
      return { ok: false, error: { message: 'EOJ_Log sheet not found.' } };
    }

    const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    const idx     = buildIdx_(headers.map(function(h) { return String(h || '').trim(); }));

    var statusCol = idx['Processing_Status'];
    var errorCol  = idx['Processing_Error'];

    if (statusCol === undefined) {
      return { ok: false, error: { message: 'Processing_Status column not found in EOJ_Log header.' } };
    }

    const currentStatus = String(sheet.getRange(rowNumber, statusCol + 1).getValue() || '');

    if (currentStatus !== 'Error') {
      return { ok: false, error: { message: 'Row ' + rowNumber + ' has status "' + currentStatus + '" — only Error rows can be retried.' } };
    }

    // Reset to New, clear error
    sheet.getRange(rowNumber, statusCol + 1).setValue('New');
    if (errorCol !== undefined) {
      sheet.getRange(rowNumber, errorCol + 1).setValue('');
    }

    SpreadsheetApp.flush();
    Logger.log('retryEojRow: reset row ' + rowNumber + ' from Error to New.');

    return { ok: true, data: { message: 'Row ' + rowNumber + ' reset to New. It will be picked up on the next processing run.' } };
  } catch (err) {
    Logger.log('retryEojRow error: ' + err.message);
    return { ok: false, error: { message: err.message } };
  }
}

/**
 * Return the full Raw_JSON for a single EOJ row.
 * Used by the admin view to show submission details without loading all data.
 *
 * @param {number} rowNumber - 1-based sheet row number
 */
function getEojRowDetail(rowNumber) {
  try {
    if (!rowNumber || rowNumber < 2) {
      return { ok: false, error: { message: 'Invalid row number.' } };
    }

    const ss    = SpreadsheetApp.openById(EOJ_ADMIN_DATABASE_ID_);
    const sheet = ss.getSheetByName(EOJ_ADMIN_LOG_SHEET_);
    if (!sheet) return { ok: false, error: { message: 'EOJ_Log not found.' } };

    const headers  = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    const idx      = buildIdx_(headers.map(function(h) { return String(h || '').trim(); }));
    const rowData  = sheet.getRange(rowNumber, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];

    const rawJsonCol = idx['Raw_JSON'];
    const rawJson    = rawJsonCol !== undefined ? String(rowData[rawJsonCol] || '') : '';

    var parsed = null;
    try { parsed = rawJson ? JSON.parse(rawJson) : null; } catch (e) { /* ignore */ }

    return {
      ok: true,
      data: {
        eojId:           cellStr_(rowData, idx, 'EOJ_ID'),
        processingStatus:cellStr_(rowData, idx, 'Processing_Status'),
        processingError: cellStr_(rowData, idx, 'Processing_Error'),
        processedAt:     cellStr_(rowData, idx, 'Processed_At'),
        processingRunId: cellStr_(rowData, idx, 'Processing_Run_ID'),
        rawJson:         rawJson,
        parsedPayload:   parsed
      }
    };
  } catch (err) {
    Logger.log('getEojRowDetail error: ' + err.message);
    return { ok: false, error: { message: err.message } };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildIdx_(headers) {
  var idx = {};
  headers.forEach(function(h, i) { if (h) idx[h] = i; });
  return idx;
}

function cellStr_(row, idx, col) {
  var c = idx[col];
  if (c === undefined) return '';
  var v = row[c];
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return String(v != null ? v : '');
}
