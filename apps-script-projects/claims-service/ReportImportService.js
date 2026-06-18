/**
 * ReportImportService
 *
 * Phase 8C
 * Daily Open Jobs + Compliance Report Import Pipeline
 */

const REPORT_IMPORT_CONFIG = {
  dailyOpenJobsReportKey: 'dailyOpenJobs',
  complianceTasksReportKey: 'complianceTasks',
  maxSampleRows: 5
};

/**
 * Phase 8C Entry Point
 */
function importLatestDailyOpenJobsReport() {
  let converted = null;

  try {
    const latestFileResponse = getLatestReportImportFile(
      REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey
    );

    const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

    if (!latestFile || !latestFile.fileId) {
      throw new Error('No Daily Open Jobs report found.');
    }

    converted = convertXlsxToGoogleSheet_(
      latestFile.fileId,
      latestFile.fileName
    );

    const reportData = readReportSheetRows_(converted.spreadsheetId);
    const claimIndexes = buildClaimLookupIndexes_();

    const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
    const claimsSheet = spreadsheet.getSheetByName('Claims');

    if (!claimsSheet) {
      throw new Error('Claims sheet not found.');
    }

    const values = claimsSheet.getDataRange().getValues();
    const headers = values.length ? values[0] : [];
    const headerMap = buildHeaderIndexMap_(headers);

    let updatedCount = 0;
    let unmatchedCount = 0;
    let skippedCount = 0;

    reportData.rowObjects.forEach(row => {
      const match = matchReportRowToClaim_(row, claimIndexes);

      if (!match.matched) {
        unmatchedCount++;
        return;
      }

      const lastJournalDate = getReportValue_(row, 'date_last_journal_note_entered');
      const rowNumber = match.claimRowNumber;
      let rowUpdated = false;

      if (lastJournalDate && headerMap['Last Activity Date'] !== undefined) {
        claimsSheet
          .getRange(rowNumber, headerMap['Last Activity Date'] + 1)
          .setValue(lastJournalDate);
        rowUpdated = true;
      }

      if (headerMap['Last Updated'] !== undefined) {
        claimsSheet
          .getRange(rowNumber, headerMap['Last Updated'] + 1)
          .setValue(new Date());
        rowUpdated = true;
      }

      if (rowUpdated) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    });

    const result = {
      status: 'Success',
      success: true,
      message: 'Daily Open Jobs imported successfully.',
      data: {
        sourceFileName: latestFile.fileName,
        totalReportRows: reportData.totalDataRows,
        updatedCount: updatedCount,
        unmatchedCount: unmatchedCount,
        skippedCount: skippedCount,
        convertedSpreadsheetId: converted.spreadsheetId
      }
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    cleanupConvertedReportSheet_(converted);
  }
}

/**
 * Phase 8C Entry Point
 */
function importLatestComplianceTasksReport() {
  const latestFileResponse = getLatestReportImportFile(
    REPORT_IMPORT_CONFIG.complianceTasksReportKey
  );

  const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

  if (!latestFile || !latestFile.fileId) {
    throw new Error('No Compliance Tasks report found.');
  }

  const converted = convertXlsxToGoogleSheet_(
    latestFile.fileId,
    latestFile.fileName
  );

  const reportData = readReportSheetRows_(converted.spreadsheetId);
  const claimIndexes = buildClaimLookupIndexes_();

  const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const complianceSheet = spreadsheet.getSheetByName('Compliance_Actions');

  if (!complianceSheet) {
    throw new Error('Compliance_Actions sheet not found.');
  }

  const existingValues = complianceSheet.getDataRange().getValues();
  const existingHeaders = existingValues[0] || [];
  const existingRows = existingValues.slice(1);

  const existingActionIds = {};

  existingRows.forEach(row => {
    const actionId = String(row[0] || '').trim();
    if (actionId) {
      existingActionIds[actionId] = true;
    }
  });

  let createdCount = 0;
  let skippedCount = 0;
  let unmatchedCount = 0;
  let completedSkippedCount = 0;
  const rowsToAppend = [];

  reportData.rowObjects.forEach(row => {
    if (getReportValue_(row, 'completed_date')) {
      completedSkippedCount++;
      return;
    }

    const match = matchReportRowToClaim_(row, claimIndexes);

    if (!match.matched) {
      unmatchedCount++;
      return;
    }

    const actionId = [
      match.claimId,
      getReportValue_(row, 'action_title'),
      getReportValue_(row, 'due_date')
    ].join('|');

    if (existingActionIds[actionId]) {
      skippedCount++;
      return;
    }

    rowsToAppend.push([
      actionId,
      match.claimId,
      getReportValue_(row, 'job_number'),
      getReportValue_(row, 'action_title'),
      getReportValue_(row, 'priority'),
      getReportValue_(row, 'required_action'),
      getReportValue_(row, 'due_date'),
      getReportValue_(row, 'completed_date'),
      getReportValue_(row, 'completed_date') ? 'Completed' : 'Open',
      getReportValue_(row, 'loss_address')
    ]);

    existingActionIds[actionId] = true;
    createdCount++;
  });

  if (rowsToAppend.length) {
    complianceSheet
      .getRange(
        complianceSheet.getLastRow() + 1,
        1,
        rowsToAppend.length,
        existingHeaders.length
      )
      .setValues(rowsToAppend);
  }

  cleanupConvertedReportSheet_(converted);

  return {
    status: 'Success',
    success: true,
    message: 'Compliance Tasks imported successfully.',
    data: {
      sourceFileName: latestFile.fileName,
      totalReportRows: reportData.totalDataRows,
      createdCount: createdCount,
      skippedCount: skippedCount
    }
  };
}

/**
 * Debug report discovery before XLSX conversion.
 */
function testDebugReportImportDiscovery() {
  const reportKeys = [
    REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey,
    REPORT_IMPORT_CONFIG.complianceTasksReportKey
  ];

  const results = reportKeys.map(reportKey => {
    try {
      const latestFileResponse = getLatestReportImportFile(reportKey);
      const latestFile = unwrapLatestReportImportFile_(latestFileResponse);
      return {
        reportKey: reportKey,
        found: !!(latestFile && latestFile.fileId),
        latestFile: latestFile || null,
        rawResponse: latestFileResponse || null
      };
    } catch (error) {
      return {
        reportKey: reportKey,
        found: false,
        error: error.message
      };
    }
  });

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

/**
 * Inspect latest Daily Open Jobs report.
 */
function testInspectLatestDailyOpenJobsColumns() {
  return inspectLatestReportColumns_(REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey);
}

/**
 * Inspect latest Compliance Tasks report.
 */
function testInspectLatestComplianceTasksColumns() {
  return inspectLatestReportColumns_(REPORT_IMPORT_CONFIG.complianceTasksReportKey);
}

/**
 * Inspect latest imported report file and return headers/sample rows.
 *
 * This is intentionally read-only against Rainbow claim data.
 */
function inspectLatestReportColumns_(reportKey) {
  const latestFileResponse = getLatestReportImportFile(reportKey);
  const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

  if (!latestFile || !latestFile.fileId) {
    throw new Error('No latest imported report file found for reportKey: ' + reportKey);
  }

  Logger.log('Inspecting report key: ' + reportKey);
  Logger.log('Latest file name: ' + latestFile.fileName);
  Logger.log('Latest file ID: ' + latestFile.fileId);
  Logger.log('Latest folder name: ' + latestFile.folderName);

  const converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
  const reportData = readReportSheetRows_(converted.spreadsheetId);

  const result = {
    status: 'Success',
    success: true,
    message: 'Report columns inspected successfully.',
    data: {
      reportKey: reportKey,
      sourceFile: latestFile,
      convertedSheet: converted,
      tabs: reportData.tabs,
      activeTabName: reportData.activeTabName,
      rawHeaderCount: reportData.headers.length,
      rawHeaders: reportData.headers,
      normalizedHeaders: reportData.normalizedHeaders,
      totalDataRows: reportData.totalDataRows,
      sampleRows: reportData.sampleRows
    }
  };

  Logger.log(JSON.stringify(result, null, 2));

  return {
    status: result.status,
    success: result.success,
    message: result.message,
    data: {
      reportKey: result.data.reportKey,
      convertedSheet: result.data.convertedSheet,
      tabs: result.data.tabs,
      activeTabName: result.data.activeTabName,
      rawHeaderCount: result.data.rawHeaderCount,
      rawHeaders: result.data.rawHeaders,
      normalizedHeaders: result.data.normalizedHeaders,
      totalDataRows: result.data.totalDataRows,
      sampleRows: result.data.sampleRows
    }
  };
}

/**
 * Extract file metadata from standard Rainbow response wrapper.
 */
function unwrapLatestReportImportFile_(response) {
  if (!response) {
    return null;
  }

  if (response.fileId) {
    return response;
  }

  if (response.data && response.data.fileId) {
    return response.data;
  }

  return null;
}

/**
 * Convert imported XLSX to Google Sheet when needed.
 *
 * Some imported report files are already readable by SpreadsheetApp even though
 * the filename still ends with .xlsx. Try direct read first, then fall back to
 * Drive Advanced Service conversion.
 */
function convertXlsxToGoogleSheet_(fileId, originalFileName) {
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.copy) {
    throw new Error(
      'Drive Advanced Service is not enabled. In Apps Script, enable Services > Drive API, then retry.'
    );
  }

  const convertedName = buildConvertedReportName_(originalFileName);
  const resource = {
    title: convertedName,
    mimeType: MimeType.GOOGLE_SHEETS
  };

  const convertedFile = Drive.Files.copy(resource, fileId, {
    convert: true,
    supportsAllDrives: true
  });

  const spreadsheetId = convertedFile.id;
  const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';

  Logger.log('Converted XLSX to Google Sheet: ' + spreadsheetUrl);

  return {
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: spreadsheetUrl,
    convertedName: convertedName,
    originalFileName: originalFileName || '',
    conversionMode: 'drive_api_copy_convert'
  };
}

/**
 * Trash temporary converted report sheet after import/inspection.
 */
function cleanupConvertedReportSheet_(converted) {
  if (!converted || !converted.spreadsheetId) {
    return;
  }

  if (converted.conversionMode !== 'drive_api_copy_convert') {
    return;
  }

  try {
    DriveApp.getFileById(converted.spreadsheetId).setTrashed(true);
    Logger.log('Temporary converted report sheet trashed: ' + converted.spreadsheetId);
  } catch (error) {
    Logger.log('Unable to trash temporary converted report sheet: ' + error.message);
  }
}

/**
 * Build a clear temporary name for converted report inspection sheets.
 */
function buildConvertedReportName_(originalFileName) {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );

  return 'TEMP Converted Report - ' + (originalFileName || 'Unknown Report') + ' - ' + timestamp;
}

/**
 * Read headers and sample rows from converted or already-readable report sheet.
 */
function readReportSheetRows_(spreadsheetId) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheets = spreadsheet.getSheets();

  if (!sheets || sheets.length === 0) {
    throw new Error('Converted report spreadsheet has no sheets: ' + spreadsheetId);
  }

  const activeSheet = sheets[0];
  const values = activeSheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];
  const normalizedHeaders = normalizeReportHeaders_(headers);
  const dataRows = values.length > 1 ? values.slice(1) : [];

  const sampleRows = dataRows
    .slice(0, REPORT_IMPORT_CONFIG.maxSampleRows)
    .map(row => buildSampleRowObject_(headers, normalizedHeaders, row));

  return {
    spreadsheetId: spreadsheetId,
    tabs: sheets.map(sheet => sheet.getName()),
    activeTabName: activeSheet.getName(),
    headers: headers,
    normalizedHeaders: normalizedHeaders,
    totalDataRows: dataRows.length,
    sampleRows: sampleRows,
    rowObjects: dataRows.map(row => buildNormalizedRowObject_(headers, normalizedHeaders, row))
  };
}

/**
 * Build readable sample row object using raw headers where available.
 */
function buildSampleRowObject_(headers, normalizedHeaders, row) {
  const sample = {};

  headers.forEach((header, index) => {
    const rawHeader = String(header || '').trim();
    const normalizedHeader = normalizedHeaders[index] || ('column_' + (index + 1));
    const key = rawHeader || normalizedHeader;
    sample[key] = row[index];
  });

  return sample;
}

/**
 * Normalize report headers.
 */
function normalizeReportHeaders_(headers) {
  return (headers || []).map(header =>
    String(header || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

/**
 * Inspect target Rainbow sheets before building import mappings.
 */
function testInspectReportImportTargetSheets() {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);

  const targetSheets = [
    'Claims',
    'Compliance_Actions'
  ];

  const results = targetSheets.map(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      return {
        sheetName,
        found: false
      };
    }

    const values = sheet.getDataRange().getValues();
    const headers = values.length ? values[0] : [];

    return {
      sheetName,
      found: true,
      columnCount: headers.length,
      headers: headers,
      normalizedHeaders: normalizeReportHeaders_(headers),
      rowCount: Math.max(values.length - 1, 0)
    };
  });

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

/**
 * Dry-run Daily Open Jobs import matching before writing to Claims.
 */
function testDryRunDailyOpenJobsImport() {
  return dryRunReportImportMatching_(REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey);
}

/**
 * Dry-run Compliance Tasks import matching before writing Compliance_Actions.
 */
function testDryRunComplianceTasksImport() {
  return dryRunReportImportMatching_(REPORT_IMPORT_CONFIG.complianceTasksReportKey);
}

/**
 * Dry-run report matching against existing Claims.
 */
function dryRunReportImportMatching_(reportKey) {
  const latestFileResponse = getLatestReportImportFile(reportKey);
  const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

  if (!latestFile || !latestFile.fileId) {
    throw new Error('No latest imported report file found for reportKey: ' + reportKey);
  }

  const converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
  const reportData = readReportSheetRows_(converted.spreadsheetId);
  const claimIndexes = buildClaimLookupIndexes_();

  const matched = [];
  const unmatched = [];

  reportData.rowObjects.forEach((row, index) => {
    const match = matchReportRowToClaim_(row, claimIndexes);
    const result = {
      reportRowNumber: index + 2,
      jobNumber: getReportValue_(row, 'job_number'),
      claimNumber: getReportValue_(row, 'claim_number'),
      customerName: getReportValue_(row, 'customer_name'),
      match: match
    };

    if (match && match.claimId) {
      matched.push(result);
    } else {
      unmatched.push(result);
    }
  });

  const summary = {
    status: 'Success',
    success: true,
    message: 'Report import dry run completed.',
    data: {
      reportKey: reportKey,
      sourceFileName: latestFile.fileName,
      convertedSpreadsheetId: converted.spreadsheetId,
      totalRows: reportData.totalDataRows,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      sampleMatched: matched.slice(0, REPORT_IMPORT_CONFIG.maxSampleRows),
      sampleUnmatched: unmatched.slice(0, REPORT_IMPORT_CONFIG.maxSampleRows)
    }
  };

  Logger.log(JSON.stringify(summary, null, 2));
  cleanupConvertedReportSheet_(converted);
  return summary;
}

/**
 * Build claim lookup indexes.
 */
function buildClaimLookupIndexes_() {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('Claims');

  if (!sheet) {
    throw new Error('Claims sheet not found.');
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];
  const normalizedHeaders = normalizeReportHeaders_(headers);
  const rows = values.length > 1 ? values.slice(1) : [];

  const byClaimId = {};
  const byJobNumber = {};
  const byClaimNumber = {};

  rows.forEach((row, index) => {
    const rowObject = buildNormalizedRowObject_(headers, normalizedHeaders, row);
    const claimRecord = {
      rowNumber: index + 2,
      claimId: getReportValue_(rowObject, 'claim_id'),
      jobNumber: getReportValue_(rowObject, 'job_number'),
      claimNumber: getReportValue_(rowObject, 'claim_number'),
      customerName: getReportValue_(rowObject, 'customer_name'),
      address: getReportValue_(rowObject, 'address'),
      raw: rowObject
    };

    if (claimRecord.claimId) {
      byClaimId[normalizeLookupKey_(claimRecord.claimId)] = claimRecord;
    }

    if (claimRecord.jobNumber) {
      byJobNumber[normalizeLookupKey_(claimRecord.jobNumber)] = claimRecord;
    }

    if (claimRecord.claimNumber) {
      byClaimNumber[normalizeLookupKey_(claimRecord.claimNumber)] = claimRecord;
    }
  });

  return {
    byClaimId: byClaimId,
    byJobNumber: byJobNumber,
    byClaimNumber: byClaimNumber,
    totalClaims: rows.length
  };
}

/**
 * Match report row to claim.
 */
function matchReportRowToClaim_(row, claimIndexes) {
  const claimId = getReportValue_(row, 'claim_id');
  const jobNumber = getReportValue_(row, 'job_number');
  const claimNumber = getReportValue_(row, 'claim_number');

  if (claimId) {
    const claimIdMatch = claimIndexes.byClaimId[normalizeLookupKey_(claimId)];
    if (claimIdMatch) {
      return buildMatchResult_(claimIdMatch, 'claim_id');
    }
  }

  if (jobNumber) {
    const jobNumberMatch = claimIndexes.byJobNumber[normalizeLookupKey_(jobNumber)];
    if (jobNumberMatch) {
      return buildMatchResult_(jobNumberMatch, 'job_number');
    }
  }

  if (claimNumber) {
    const claimNumberMatch = claimIndexes.byClaimNumber[normalizeLookupKey_(claimNumber)];
    if (claimNumberMatch) {
      return buildMatchResult_(claimNumberMatch, 'claim_number');
    }
  }

  return {
    matched: false,
    reason: 'No claim match found by Claim ID, Job Number, or Claim Number.'
  };
}

/**
 * Build match result for dry-run and import logic.
 */
function buildMatchResult_(claimRecord, matchedBy) {
  return {
    matched: true,
    matchedBy: matchedBy,
    claimId: claimRecord.claimId,
    claimRowNumber: claimRecord.rowNumber,
    jobNumber: claimRecord.jobNumber,
    claimNumber: claimRecord.claimNumber,
    customerName: claimRecord.customerName
  };
}

/**
 * Build normalized row object with both normalized and raw header keys.
 */
function buildNormalizedRowObject_(headers, normalizedHeaders, row) {
  const rowObject = {};

  headers.forEach((header, index) => {
    const rawHeader = String(header || '').trim();
    const normalizedHeader = normalizedHeaders[index] || ('column_' + (index + 1));
    const value = row[index];

    rowObject[normalizedHeader] = value;

    if (rawHeader) {
      rowObject[rawHeader] = value;
    }
  });

  return rowObject;
}

/**
 * Get report value safely as a trimmed string.
 */
function getReportValue_(row, key) {
  if (!row || row[key] === undefined || row[key] === null) {
    return '';
  }

  const value = row[key];

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

/**
 * Normalize lookup key for matching.
 */
function normalizeLookupKey_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Build header index map from sheet header row.
 */
function buildHeaderIndexMap_(headers) {
  const map = {};

  (headers || []).forEach((header, index) => {
    map[String(header || '').trim()] = index;
  });

  return map;
}

/**
 * One-time cleanup for Phase 8C.
 * Removes completed Compliance_Actions rows imported before importer hardening.
 */
function cleanupCompletedComplianceActions() {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('Compliance_Actions');

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h || '').trim());
  const statusColIndex = headers.indexOf('Status');

  let deletedCount = 0;

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const status = String(values[rowIndex][statusColIndex] || '').trim().toLowerCase();

    if (status === 'completed' || status === 'complete') {
      sheet.deleteRow(rowIndex + 1);
      deletedCount++;
    }
  }

  const result = {
    status: 'Success',
    success: true,
    message: 'Completed Compliance_Actions cleanup finished.',
    data: {
      deletedCount: deletedCount,
      remainingRowCount: Math.max(sheet.getLastRow() - 1, 0)
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
