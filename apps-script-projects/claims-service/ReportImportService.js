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
    let createdClaimsCount = 0;
    let skippedMissingIdentifiersCount = 0;

    reportData.rowObjects.forEach(row => {
      const match = matchReportRowToClaim_(row, claimIndexes);

      if (!match.matched) {
        const bootstrapResult = tryBootstrapClaimFromDailyOpenJobsRow_(row, claimIndexes);
        if (bootstrapResult.created) {
          createdClaimsCount++;
        } else if (bootstrapResult.skippedMissingIdentifiers) {
          skippedMissingIdentifiersCount++;
        } else {
          unmatchedCount++;
        }
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
        matchedUpdated: updatedCount,
        createdClaims: createdClaimsCount,
        unmatchedSkipped: unmatchedCount,
        skippedMissingIdentifiers: skippedMissingIdentifiersCount,
        skippedCount: skippedCount,
        // Legacy alias kept for backward compatibility
        updatedCount: updatedCount,
        unmatchedCount: unmatchedCount,
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
 * Dry-run Daily Open Jobs active reconciliation.
 *
 * Compares the latest Daily Open Jobs report against current non-terminal
 * Claims rows and identifies claims that are active in Rainbow but missing
 * from today's open jobs report.
 *
 * This is read-only. It does not close claims or update lifecycle state.
 */
function testDryRunDailyOpenJobsActiveReconciliation() {
  let converted = null;

  try {
    const latestFileResponse = getLatestReportImportFile(
      REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey
    );
    const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

    if (!latestFile || !latestFile.fileId) {
      throw new Error('No Daily Open Jobs report found.');
    }

    converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
    const reportData = readReportSheetRows_(converted.spreadsheetId);
    const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
    const claimsSheet = spreadsheet.getSheetByName('Claims');

    if (!claimsSheet) {
      throw new Error('Claims sheet not found.');
    }

    const claimValues = claimsSheet.getDataRange().getValues();
    const claimHeaders = claimValues.length ? claimValues[0].map(function(header) {
      return String(header || '').trim();
    }) : [];
    const claimHeaderMap = buildHeaderIndexMap_(claimHeaders);

    const reportJobNumbers = {};
    const reportClaimNumbers = {};

    reportData.rowObjects.forEach(function(row) {
      const jobNumber = normalizeLookupKey_(getReportValue_(row, 'job_number'));
      const claimNumber = normalizeLookupKey_(getReportValue_(row, 'claim_number'));

      if (jobNumber) {
        reportJobNumbers[jobNumber] = true;
      }

      if (claimNumber) {
        reportClaimNumbers[claimNumber] = true;
      }
    });

    const missingFromOpenJobs = [];
    const stillOpenInReport = [];
    let skippedTerminal = 0;
    let skippedBlank = 0;

    for (var rowIndex = 1; rowIndex < claimValues.length; rowIndex++) {
      const row = claimValues[rowIndex];
      const claimId = getSheetCellValueByHeader_(row, claimHeaderMap, ['Claim ID', 'Claim_ID']);
      const jobNumber = getSheetCellValueByHeader_(row, claimHeaderMap, ['Job Number', 'Job_Number']);
      const claimNumber = getSheetCellValueByHeader_(row, claimHeaderMap, ['Claim Number', 'Claim_Number']);
      const customerName = getSheetCellValueByHeader_(row, claimHeaderMap, ['Customer Name', 'Customer_Name']);
      const lifecycleState = getSheetCellValueByHeader_(row, claimHeaderMap, ['Lifecycle State', 'Lifecycle_State']);
      const lastActivityDate = getSheetCellValueByHeader_(row, claimHeaderMap, ['Last Activity Date', 'Last_Activity_Date']);
      const lastMeaningfulActivityAt = getSheetCellValueByHeader_(row, claimHeaderMap, ['Last_Meaningful_Activity_At', 'Last Meaningful Activity At']);

      if (!claimId && !jobNumber && !claimNumber) {
        skippedBlank++;
        continue;
      }

      if (isReportImportTerminalLifecycle_(lifecycleState)) {
        skippedTerminal++;
        continue;
      }

      const normalizedJobNumber = normalizeLookupKey_(jobNumber);
      const normalizedClaimNumber = normalizeLookupKey_(claimNumber);
      const matchedInReport = !!(
        (normalizedJobNumber && reportJobNumbers[normalizedJobNumber]) ||
        (normalizedClaimNumber && reportClaimNumbers[normalizedClaimNumber])
      );

      const claimSummary = {
        rowNumber: rowIndex + 1,
        claimId: claimId,
        jobNumber: jobNumber,
        claimNumber: claimNumber,
        customerName: customerName,
        lifecycleState: lifecycleState,
        lastActivityDate: lastActivityDate,
        lastMeaningfulActivityAt: lastMeaningfulActivityAt
      };

      if (matchedInReport) {
        stillOpenInReport.push(claimSummary);
      } else {
        missingFromOpenJobs.push(claimSummary);
      }
    }

    const result = {
      status: 'Success',
      success: true,
      message: 'Daily Open Jobs active reconciliation dry run completed.',
      data: {
        sourceFileName: latestFile.fileName,
        totalReportRows: reportData.totalDataRows,
        activeClaimRowsChecked: stillOpenInReport.length + missingFromOpenJobs.length,
        stillOpenInReportCount: stillOpenInReport.length,
        missingFromOpenJobsCount: missingFromOpenJobs.length,
        skippedTerminal: skippedTerminal,
        skippedBlank: skippedBlank,
        sampleMissingFromOpenJobs: missingFromOpenJobs.slice(0, 20),
        sampleStillOpenInReport: stillOpenInReport.slice(0, 5)
      }
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    cleanupConvertedReportSheet_(converted);
  }
}

/**
 * Apply Daily Open Jobs lifecycle reconciliation.
 *
 * Current Rainbow rule:
 * If a claim is currently Active Work and is missing from the latest Daily Open Jobs report,
 * it leaves the active operational workload and is marked Operationally Complete.
 *
 * This preserves the claim history in Rainbow while removing it from active dashboards/lenses.
 */
function reconcileDailyOpenJobsRemovedClaims() {
  let converted = null;

  try {
    const latestFileResponse = getLatestReportImportFile(
      REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey
    );
    const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

    if (!latestFile || !latestFile.fileId) {
      throw new Error('No Daily Open Jobs report found.');
    }

    converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
    const reportData = readReportSheetRows_(converted.spreadsheetId);
    const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
    const claimsSheet = spreadsheet.getSheetByName('Claims');

    if (!claimsSheet) {
      throw new Error('Claims sheet not found.');
    }

    const claimValues = claimsSheet.getDataRange().getValues();
    const claimHeaders = claimValues.length ? claimValues[0].map(function(header) {
      return String(header || '').trim();
    }) : [];
    const claimHeaderMap = buildHeaderIndexMap_(claimHeaders);

    const reportJobNumbers = {};
    const reportClaimNumbers = {};

    reportData.rowObjects.forEach(function(row) {
      const jobNumber = normalizeLookupKey_(getReportValue_(row, 'job_number'));
      const claimNumber = normalizeLookupKey_(getReportValue_(row, 'claim_number'));

      if (jobNumber) {
        reportJobNumbers[jobNumber] = true;
      }

      if (claimNumber) {
        reportClaimNumbers[claimNumber] = true;
      }
    });

    const lifecycleCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Lifecycle State', 'Lifecycle_State']);
    const ownershipCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Ownership Area', 'Ownership_Area']);
    const healthStatusCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Health Status', 'Health_Status']);
    const healthReasonCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Health Reason', 'Health_Reason']);
    const lastUpdatedCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Last Updated', 'Last_Updated']);
    const updatedAtCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Updated At', 'Updated_At']);

    if (lifecycleCol === -1) {
      throw new Error('Lifecycle State column not found in Claims sheet.');
    }

    const transitionedClaims = [];
    const skippedClaims = [];
    const now = new Date();

    for (var rowIndex = 1; rowIndex < claimValues.length; rowIndex++) {
      const row = claimValues[rowIndex];
      const claimId = getSheetCellValueByHeader_(row, claimHeaderMap, ['Claim ID', 'Claim_ID']);
      const jobNumber = getSheetCellValueByHeader_(row, claimHeaderMap, ['Job Number', 'Job_Number']);
      const claimNumber = getSheetCellValueByHeader_(row, claimHeaderMap, ['Claim Number', 'Claim_Number']);
      const customerName = getSheetCellValueByHeader_(row, claimHeaderMap, ['Customer Name', 'Customer_Name']);
      const lifecycleState = getSheetCellValueByHeader_(row, claimHeaderMap, ['Lifecycle State', 'Lifecycle_State']);

      if (!claimId && !jobNumber && !claimNumber) {
        continue;
      }

      if (String(lifecycleState || '').trim() !== 'Active Work') {
        skippedClaims.push({
          claimId: claimId,
          jobNumber: jobNumber,
          customerName: customerName,
          reason: 'Lifecycle is not Active Work.',
          lifecycleState: lifecycleState
        });
        continue;
      }

      const normalizedJobNumber = normalizeLookupKey_(jobNumber);
      const normalizedClaimNumber = normalizeLookupKey_(claimNumber);
      const matchedInReport = !!(
        (normalizedJobNumber && reportJobNumbers[normalizedJobNumber]) ||
        (normalizedClaimNumber && reportClaimNumbers[normalizedClaimNumber])
      );

      if (matchedInReport) {
        continue;
      }

      row[lifecycleCol] = 'Operationally Complete';

      if (ownershipCol !== -1) {
        row[ownershipCol] = '';
      }

      if (healthStatusCol !== -1) {
        row[healthStatusCol] = 'Not Applicable';
      }

      if (healthReasonCol !== -1) {
        row[healthReasonCol] = 'Claim removed from active workload because it is no longer present on the Daily Open Jobs report.';
      }

      if (lastUpdatedCol !== -1) {
        row[lastUpdatedCol] = now;
      }

      if (updatedAtCol !== -1) {
        row[updatedAtCol] = now;
      }

      transitionedClaims.push({
        rowNumber: rowIndex + 1,
        claimId: claimId,
        jobNumber: jobNumber,
        claimNumber: claimNumber,
        customerName: customerName,
        previousLifecycleState: lifecycleState,
        newLifecycleState: 'Operationally Complete'
      });
    }

    if (claimValues.length > 1) {
      claimsSheet
        .getRange(1, 1, claimValues.length, claimValues[0].length)
        .setValues(claimValues);
    }

    transitionedClaims.forEach(function(claim) {
      appendDailyOpenJobsRemovalTimelineEvent_(claim, latestFile.fileName, now);
    });

    const result = {
      status: 'Success',
      success: true,
      message: 'Daily Open Jobs removed-claim reconciliation completed.',
      data: {
        sourceFileName: latestFile.fileName,
        totalReportRows: reportData.totalDataRows,
        transitionedCount: transitionedClaims.length,
        skippedCount: skippedClaims.length,
        transitionedClaims: transitionedClaims,
        sampleSkippedClaims: skippedClaims.slice(0, 10)
      }
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    cleanupConvertedReportSheet_(converted);
  }
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
 * Attempt to bootstrap a new Claims row from an unmatched Daily Open Jobs report row.
 *
 * Guards:
 * 1. Requires job_number AND customer_name — skips if either is blank.
 * 2. Checks claimIndexes.byJobNumber before creating — prevents duplicates against
 *    pre-existing claims and against rows already created in this same import run
 *    (because the index is updated in-memory after each creation).
 * 3. findOrCreateClaim() performs an additional DB-level lookup by Claim_Number
 *    before appending a row.
 *
 * Returns: { created, skippedMissingIdentifiers, alreadyExists, error }
 */
function tryBootstrapClaimFromDailyOpenJobsRow_(row, claimIndexes) {
  const jobNumber = getReportValue_(row, 'job_number');
  const customerName = getReportValue_(row, 'customer_name');

  if (!jobNumber || !customerName) {
    return {
      created: false,
      skippedMissingIdentifiers: true,
      reason: !jobNumber ? 'missing job_number' : 'missing customer_name'
    };
  }

  // Guard: in-memory index check (covers pre-existing claims by job number
  // and same-run duplicates from rows processed earlier in this forEach).
  if (claimIndexes.byJobNumber[normalizeLookupKey_(jobNumber)]) {
    return { created: false, alreadyExists: true };
  }

  const claimNumber = getReportValue_(row, 'claim_number');
  const lossAddress = getReportValue_(row, 'loss_address');

  const createResult = findOrCreateClaim({
    Job_Number: jobNumber,
    Claim_Number: claimNumber || jobNumber,
    Display_Name: customerName,
    Customer_Name: customerName,
    Property_Address: lossAddress || '',
    Lifecycle_State: 'Active Work',
    Ownership_Area: 'Field Operations',
    Operational_Health: 'Healthy',
    Source_System: 'daily-open-jobs-import'
  });

  if (!createResult || !createResult.success) {
    Logger.log(
      'ReportImportService BOOTSTRAP ERROR: job=' + jobNumber +
      ' customer=' + customerName +
      ' error=' + (createResult ? createResult.message : 'null result')
    );
    return { created: false, error: createResult ? createResult.message : 'null result' };
  }

  const wasCreated = !!(createResult.data && createResult.data.created);
  const claim = createResult.data && createResult.data.claim;

  if (claim) {
    // Update in-memory indexes so later rows in this same import run don't duplicate.
    const claimRecord = {
      rowNumber: -1,
      claimId: claim.Claim_ID || '',
      jobNumber: jobNumber,
      claimNumber: claim.Claim_Number || claimNumber || jobNumber,
      customerName: customerName
    };

    claimIndexes.byJobNumber[normalizeLookupKey_(jobNumber)] = claimRecord;

    if (claim.Claim_ID) {
      claimIndexes.byClaimId[normalizeLookupKey_(claim.Claim_ID)] = claimRecord;
    }

    if (claimRecord.claimNumber) {
      claimIndexes.byClaimNumber[normalizeLookupKey_(claimRecord.claimNumber)] = claimRecord;
    }
  }

  if (wasCreated) {
    Logger.log(
      'ReportImportService BOOTSTRAP: Created claim ' + (claim ? claim.Claim_ID : '?') +
      ' for job=' + jobNumber + ' (' + customerName + ')'
    );
  }

  return { created: wasCreated, alreadyExists: !wasCreated };
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

function getHeaderIndexByPossibleNames_(headerMap, possibleHeaders) {
  for (var i = 0; i < possibleHeaders.length; i++) {
    var header = possibleHeaders[i];
    if (headerMap[header] !== undefined) {
      return headerMap[header];
    }
  }

  return -1;
}

function appendDailyOpenJobsRemovalTimelineEvent_(claim, sourceFileName, eventDate) {
  if (typeof appendTimelineEvent !== 'function') {
    return;
  }

  try {
    appendTimelineEvent(claim.claimId, {
      Timeline_Event_ID: 'DOJ-REMOVED-' + claim.claimId + '-' + Utilities.formatDate(eventDate, Session.getScriptTimeZone(), 'yyyyMMdd'),
      Claim_ID: claim.claimId,
      Job_Number: claim.jobNumber,
      Event_Date: eventDate,
      Event_Category: 'Lifecycle',
      Event_Type: 'Removed from Daily Open Jobs',
      Event_Source: 'Daily Open Jobs Reconciliation',
      Source_System: 'Daily Open Jobs',
      Source_Record_ID: sourceFileName || '',
      Summary: 'Claim removed from active workload because it is no longer present on the Daily Open Jobs report.',
      Detail: 'Daily Open Jobs reconciliation transitioned this claim from Active Work to Operationally Complete. Source file: ' + (sourceFileName || ''),
      Actor: 'Rainbow Morning Automation',
      Is_Meaningful_Activity: true,
      Meaningful_Activity_Type: 'Lifecycle Transition',
      Updates_Last_Activity: true,
      Display_Priority: 'normal',
      Visibility: 'Internal'
    });
  } catch (error) {
    Logger.log('Unable to append Daily Open Jobs removal timeline event for ' + claim.claimId + ': ' + error.message);
  }
}

function getSheetCellValueByHeader_(row, headerMap, possibleHeaders) {
  for (var i = 0; i < possibleHeaders.length; i++) {
    var header = possibleHeaders[i];
    if (headerMap[header] !== undefined) {
      return row[headerMap[header]];
    }
  }
  return '';
}

function isReportImportTerminalLifecycle_(lifecycleState) {
  var normalized = String(lifecycleState || '').trim().toUpperCase();
  return normalized === 'OPERATIONALLY COMPLETE' ||
    normalized === 'NOT SOLD' ||
    normalized === 'CLOSED';
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
 * Preview which Daily Open Jobs rows would create new Claims rows.
 *
 * Dry-run only — no writes. Run this first; then run
 * backfillMissingClaimsFromLatestDailyOpenJobs() to apply.
 *
 * Logs:
 *   - total report rows
 *   - matched rows (existing claims)
 *   - rows eligible for creation (have job_number + customer_name, not already indexed)
 *   - rows skipped due to missing identifiers
 *   - first 5 would-create claims
 */
function testDailyOpenJobsClaimBootstrapPreview() {
  let converted = null;

  try {
    const latestFileResponse = getLatestReportImportFile(REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey);
    const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

    if (!latestFile || !latestFile.fileId) {
      throw new Error('No Daily Open Jobs report found.');
    }

    converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
    const reportData = readReportSheetRows_(converted.spreadsheetId);
    const claimIndexes = buildClaimLookupIndexes_();

    let matchedCount = 0;
    const wouldCreate = [];
    const skippedMissingIdentifiers = [];
    const alreadyIndexedByJobNumber = [];

    reportData.rowObjects.forEach(function(row, index) {
      const match = matchReportRowToClaim_(row, claimIndexes);

      if (match.matched) {
        matchedCount++;
        return;
      }

      const jobNumber = getReportValue_(row, 'job_number');
      const customerName = getReportValue_(row, 'customer_name');
      const claimNumber = getReportValue_(row, 'claim_number');
      const lossAddress = getReportValue_(row, 'loss_address');

      if (!jobNumber || !customerName) {
        skippedMissingIdentifiers.push({
          reportRow: index + 2,
          jobNumber: jobNumber || '(blank)',
          customerName: customerName || '(blank)',
          reason: !jobNumber ? 'missing job_number' : 'missing customer_name'
        });
        return;
      }

      if (claimIndexes.byJobNumber[normalizeLookupKey_(jobNumber)]) {
        alreadyIndexedByJobNumber.push({
          reportRow: index + 2,
          jobNumber: jobNumber,
          customerName: customerName
        });
        return;
      }

      wouldCreate.push({
        reportRow: index + 2,
        jobNumber: jobNumber,
        customerName: customerName,
        claimNumber: claimNumber || '(will use job number as Claim_Number)',
        lossAddress: lossAddress || '(blank)',
        proposedClaimNumber: claimNumber || jobNumber
      });
    });

    const result = {
      status: 'Preview',
      success: true,
      message: 'Bootstrap preview completed. No claims were created.',
      data: {
        sourceFileName: latestFile.fileName,
        totalReportRows: reportData.totalDataRows,
        matchedExistingClaims: matchedCount,
        unmatchedRows: reportData.totalDataRows - matchedCount,
        eligibleForCreation: wouldCreate.length,
        alreadyIndexedByJobNumber: alreadyIndexedByJobNumber.length,
        skippedMissingIdentifiers: skippedMissingIdentifiers.length,
        sampleWouldCreate: wouldCreate.slice(0, 5),
        sampleSkippedMissingIdentifiers: skippedMissingIdentifiers.slice(0, 5),
        duplicatePreventionNote: [
          'Each row is checked against byJobNumber (pre-loaded from Claims sheet) before creation.',
          'After each creation the in-memory index is updated so same-run duplicates are prevented.',
          'findOrCreateClaim() performs a final DB-level Claim_Number lookup before appending a row.'
        ].join(' ')
      }
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    cleanupConvertedReportSheet_(converted);
  }
}

/**
 * One-time backfill: create missing Claims rows for all jobs in the latest
 * Daily Open Jobs report that do not yet have a Claims row.
 *
 * Run testDailyOpenJobsClaimBootstrapPreview() first to confirm expected counts.
 * This calls importLatestDailyOpenJobsReport() which now includes bootstrap logic.
 */
function backfillMissingClaimsFromLatestDailyOpenJobs() {
  Logger.log('ReportImportService: Starting one-time backfill of missing claims from latest Daily Open Jobs report.');
  const result = importLatestDailyOpenJobsReport();
  Logger.log('ReportImportService: Backfill complete. ' + JSON.stringify({
    createdClaims: result.data && result.data.createdClaims,
    matchedUpdated: result.data && result.data.matchedUpdated,
    unmatchedSkipped: result.data && result.data.unmatchedSkipped,
    skippedMissingIdentifiers: result.data && result.data.skippedMissingIdentifiers
  }));
  return result;
}

/**
 * Preview which bootstrapped Claims rows are missing Customer Name.
 *
 * Targets rows where:
 *   - Claim_ID starts with the provided prefix (default: 'CLM-20260626-')
 *   - Job_Number is not blank
 *   - Customer Name is blank
 *
 * Dry-run only — no writes. Run this first; then run
 * repairDailyOpenJobsBootstrappedClaimNames() to apply.
 */
function previewRepairDailyOpenJobsBootstrappedClaimNames(claimIdPrefix) {
  return repairBootstrappedClaimNames_(claimIdPrefix || 'CLM-20260626-', true);
}

/**
 * Repair bootstrapped Claims rows that are missing Customer Name.
 *
 * Looks up the correct customer name from the latest Daily Open Jobs report
 * by matching Job_Number. Only writes to Customer Name — does not change
 * lifecycle, health, ownership, or any other field.
 *
 * Run previewRepairDailyOpenJobsBootstrappedClaimNames() first to confirm counts.
 */
function repairDailyOpenJobsBootstrappedClaimNames(claimIdPrefix) {
  return repairBootstrappedClaimNames_(claimIdPrefix || 'CLM-20260626-', false);
}

/**
 * Core logic for bootstrapped claim name repair.
 * @param {string} claimIdPrefix - Only repairs rows whose Claim_ID starts with this string.
 * @param {boolean} dryRun - If true, logs what would be written without writing.
 */
function repairBootstrappedClaimNames_(claimIdPrefix, dryRun) {
  let converted = null;

  try {
    // --- Load Daily Open Jobs report for job_number → customer_name lookup ---
    const latestFileResponse = getLatestReportImportFile(REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey);
    const latestFile = unwrapLatestReportImportFile_(latestFileResponse);

    if (!latestFile || !latestFile.fileId) {
      throw new Error('No Daily Open Jobs report found.');
    }

    converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
    const reportData = readReportSheetRows_(converted.spreadsheetId);

    // Build job_number → customer_name index from report
    const reportByJobNumber = {};
    reportData.rowObjects.forEach(function(row) {
      const jobNumber = normalizeLookupKey_(getReportValue_(row, 'job_number'));
      const customerName = getReportValue_(row, 'customer_name');
      if (jobNumber && customerName) {
        reportByJobNumber[jobNumber] = customerName;
      }
    });

    // --- Read live Claims sheet ---
    const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
    const claimsSheet = spreadsheet.getSheetByName('Claims');

    if (!claimsSheet) {
      throw new Error('Claims sheet not found.');
    }

    const claimValues = claimsSheet.getDataRange().getValues();
    const rawHeaders = claimValues.length ? claimValues[0].map(function(h) {
      return String(h || '').trim();
    }) : [];
    const claimHeaderMap = buildHeaderIndexMap_(rawHeaders);

    // Resolve column indexes for the fields we read/write.
    const claimIdCol       = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Claim_ID', 'Claim ID']);
    const jobNumberCol     = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Job_Number', 'Job Number']);
    const customerNameCol  = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Customer_Name', 'Customer Name']);

    if (claimIdCol === -1) {
      throw new Error('Claim_ID column not found in Claims sheet.');
    }

    if (customerNameCol === -1) {
      throw new Error('Customer_Name / Customer Name column not found in Claims sheet.');
    }

    const repairs = [];
    const skipped = [];

    for (var rowIndex = 1; rowIndex < claimValues.length; rowIndex++) {
      const row = claimValues[rowIndex];
      const claimId      = String(row[claimIdCol] || '').trim();
      const jobNumber    = jobNumberCol !== -1 ? String(row[jobNumberCol] || '').trim() : '';
      const customerName = String(row[customerNameCol] || '').trim();

      // Filter: must match the Claim_ID prefix (targets the specific backfill batch)
      if (!claimId || claimId.indexOf(claimIdPrefix) !== 0) {
        continue;
      }

      // Filter: must have a Job_Number to look up from the report
      if (!jobNumber) {
        skipped.push({ rowNumber: rowIndex + 1, claimId: claimId, reason: 'Job_Number is blank' });
        continue;
      }

      // Filter: only repair rows where Customer Name is blank
      if (customerName) {
        skipped.push({ rowNumber: rowIndex + 1, claimId: claimId, jobNumber: jobNumber, reason: 'Customer Name already populated: ' + customerName });
        continue;
      }

      // Look up customer name from the report
      const proposedName = reportByJobNumber[normalizeLookupKey_(jobNumber)] || '';

      if (!proposedName) {
        skipped.push({ rowNumber: rowIndex + 1, claimId: claimId, jobNumber: jobNumber, reason: 'Job number not found in latest Daily Open Jobs report' });
        continue;
      }

      repairs.push({
        rowNumber: rowIndex + 1,
        claimId: claimId,
        jobNumber: jobNumber,
        proposedCustomerName: proposedName
      });
    }

    // Apply repairs if not dry-run
    if (!dryRun) {
      repairs.forEach(function(repair) {
        claimsSheet
          .getRange(repair.rowNumber, customerNameCol + 1)
          .setValue(repair.proposedCustomerName);
      });
    }

    const result = {
      status: dryRun ? 'Preview' : 'Success',
      success: true,
      message: dryRun
        ? 'Repair preview completed. No rows were modified.'
        : 'Customer Name repair completed. ' + repairs.length + ' rows updated.',
      data: {
        dryRun: dryRun,
        claimIdPrefix: claimIdPrefix,
        sourceFileName: latestFile.fileName,
        reportJobsIndexed: Object.keys(reportByJobNumber).length,
        totalClaimRowsScanned: claimValues.length - 1,
        affectedRowCount: repairs.length,
        skippedRowCount: skipped.length,
        customerNameColumn: rawHeaders[customerNameCol] || '(column ' + customerNameCol + ')',
        sampleRepairs: repairs.slice(0, 10),
        sampleSkipped: skipped.slice(0, 5)
      }
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    cleanupConvertedReportSheet_(converted);
  }
}

// ---------------------------------------------------------------------------
// Bootstrapped Claim_Number Enrichment
// ---------------------------------------------------------------------------
// When the bootstrap path created Claims rows from the Daily Open Jobs report,
// it used `Claim_Number = claimNumber || jobNumber`.  If no real claim number
// was available at import time the Job_Number became the Claim_Number (fallback).
//
// A "fallback" Claim_Number is:
//   - blank, OR
//   - identical to Job_Number (normalized comparison)
//
// This pass re-reads the latest Daily Open Jobs report and, where the report
// now carries a real claim number for a job that has a fallback Claim_Number,
// updates only the Claim_Number cell.
//
// Safety rules (all enforced):
//   1. Skip if Job_Number is blank (no join key).
//   2. Skip if current Claim_Number is non-blank AND ≠ Job_Number (not a fallback).
//   3. Skip if report has no row for this job number.
//   4. Skip if the report claim_number is blank.
//   5. Skip if the report claim_number equals the job_number (still a fallback).
//   6. Skip if multiple report rows for the same job_number disagree on
//      claim_number (conflict — logged individually).
//   7. Never touch Claim_ID, Customer_Name, lifecycle, ownership, or health.
// ---------------------------------------------------------------------------

/**
 * Dry-run preview: scans Claims sheet for fallback Claim_Numbers and proposes
 * updates from the latest Daily Open Jobs report. No writes are performed.
 */
function previewEnrichBootstrappedClaimNumbersFromDailyOpenJobs() {
  return runBootstrappedClaimNumberEnrichment_(true);
}

/**
 * Apply: writes real Claim_Numbers from the latest Daily Open Jobs report to
 * Claims rows where Claim_Number is a fallback (blank or equals Job_Number).
 * Only the Claim_Number cell is touched.
 *
 * Run previewEnrichBootstrappedClaimNumbersFromDailyOpenJobs() first to
 * confirm proposed updates, then run this to apply.
 *
 * After apply, re-run previewBackfillExternalLinkClaimIds() and
 * backfillExternalLinkClaimIds() because updated Claim_Numbers may now
 * match External_Links rows that were previously unmatched.
 */
function enrichBootstrappedClaimNumbersFromDailyOpenJobs() {
  return runBootstrappedClaimNumberEnrichment_(false);
}

/**
 * @private
 * Core enrichment logic.
 * @param {boolean} dryRun
 */
function runBootstrappedClaimNumberEnrichment_(dryRun) {
  var converted = null;

  try {
    // ── Load Daily Open Jobs report ─────────────────────────────────────────
    var latestFileResponse = getLatestReportImportFile(REPORT_IMPORT_CONFIG.dailyOpenJobsReportKey);
    var latestFile = unwrapLatestReportImportFile_(latestFileResponse);

    if (!latestFile || !latestFile.fileId) {
      throw new Error('No Daily Open Jobs report found.');
    }

    converted = convertXlsxToGoogleSheet_(latestFile.fileId, latestFile.fileName);
    var reportData = readReportSheetRows_(converted.spreadsheetId);

    // ── Build job_number → claim_number index from report ───────────────────
    // Track conflicts: if two rows have the same job_number but different
    // claim_numbers, we cannot safely pick one — skip the job.
    var reportByJobNumber = {};    // normalizedJobNumber → raw claim_number string
    var conflictsByJobNumber = {}; // normalizedJobNumber → { first, second }

    reportData.rowObjects.forEach(function(row) {
      var jobNumber   = normalizeLookupKey_(getReportValue_(row, 'job_number'));
      var claimNumber = getReportValue_(row, 'claim_number');  // raw, may be blank

      if (!jobNumber) {
        return;
      }

      // Already flagged as conflicted — ignore additional rows.
      if (conflictsByJobNumber[jobNumber]) {
        return;
      }

      if (reportByJobNumber.hasOwnProperty(jobNumber)) {
        // Second row for this job_number: conflict if claim_numbers differ.
        var normalizedNew      = normalizeLookupKey_(claimNumber);
        var normalizedExisting = normalizeLookupKey_(reportByJobNumber[jobNumber]);

        if (normalizedNew !== normalizedExisting) {
          conflictsByJobNumber[jobNumber] = {
            first:  reportByJobNumber[jobNumber],
            second: claimNumber
          };
          delete reportByJobNumber[jobNumber];
        }
        // If they match, no conflict — keep existing.
      } else {
        reportByJobNumber[jobNumber] = claimNumber;
      }
    });

    // ── Read Claims sheet ───────────────────────────────────────────────────
    var spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
    var claimsSheet = spreadsheet.getSheetByName('Claims');

    if (!claimsSheet) {
      throw new Error('Claims sheet not found.');
    }

    var claimValues = claimsSheet.getDataRange().getValues();

    if (claimValues.length < 2) {
      return { success: false, message: 'Claims sheet has no data rows.' };
    }

    var rawHeaders = claimValues[0].map(function(h) { return String(h || '').trim(); });
    var claimHeaderMap = buildHeaderIndexMap_(rawHeaders);

    var jobNumberCol   = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Job_Number',   'Job Number']);
    var claimNumberCol = getHeaderIndexByPossibleNames_(claimHeaderMap, ['Claim_Number', 'Claim Number']);
    var customerNameCol = getHeaderIndexByPossibleNames_(claimHeaderMap, [
      'Customer_Name', 'Customer Name', 'Display_Name', 'Display Name'
    ]);

    if (claimNumberCol === -1) {
      throw new Error('Claim_Number / Claim Number column not found in Claims sheet.');
    }

    if (jobNumberCol === -1) {
      throw new Error('Job_Number / Job Number column not found in Claims sheet.');
    }

    // ── Scan Claims rows ────────────────────────────────────────────────────
    var claimsChecked                         = 0;
    var fallbackClaimNumbersFound             = 0;
    var eligibleUpdates                       = 0;
    var conflictCount                         = 0;
    var skippedNoJobNumber                    = 0;
    var skippedNotFallback                    = 0;
    var skippedNoReportRow                    = 0;
    var skippedBlankReportClaimNumber         = 0;
    var skippedReportClaimNumberEqualsJobNum  = 0;
    var proposals                             = [];

    for (var rowIndex = 1; rowIndex < claimValues.length; rowIndex++) {
      var row = claimValues[rowIndex];
      claimsChecked++;

      var jobNumber          = jobNumberCol     !== -1 ? String(row[jobNumberCol]    || '').trim() : '';
      var currentClaimNumber = claimNumberCol   !== -1 ? String(row[claimNumberCol]  || '').trim() : '';
      var customerName       = customerNameCol  !== -1 ? String(row[customerNameCol] || '').trim() : '';

      // Rule 1: must have a Job_Number to join against the report.
      if (!jobNumber) {
        skippedNoJobNumber++;
        continue;
      }

      // Rule 2: only update fallback claim numbers.
      // Fallback = blank OR normalized value equals normalized job number.
      var normalizedCurrentClaim = normalizeLookupKey_(currentClaimNumber);
      var normalizedJobNumber    = normalizeLookupKey_(jobNumber);
      var isFallback = !currentClaimNumber || (normalizedCurrentClaim === normalizedJobNumber);

      if (!isFallback) {
        skippedNotFallback++;
        continue;
      }

      fallbackClaimNumbersFound++;

      // Rule 6: conflict check.
      if (conflictsByJobNumber[normalizedJobNumber]) {
        conflictCount++;
        Logger.log(
          '[ClaimNumberEnrich] CONFLICT — skipping job=' + jobNumber +
          ' row=' + (rowIndex + 1) +
          ' conflict=' + JSON.stringify(conflictsByJobNumber[normalizedJobNumber])
        );
        continue;
      }

      // Rule 3: report must have a row for this job number.
      if (!reportByJobNumber.hasOwnProperty(normalizedJobNumber)) {
        skippedNoReportRow++;
        continue;
      }

      var reportClaimNumber = reportByJobNumber[normalizedJobNumber];

      // Rule 4: report claim number must not be blank.
      if (!reportClaimNumber) {
        skippedBlankReportClaimNumber++;
        continue;
      }

      // Rule 5: report claim number must not equal job number (still a fallback).
      if (normalizeLookupKey_(reportClaimNumber) === normalizedJobNumber) {
        skippedReportClaimNumberEqualsJobNum++;
        continue;
      }

      // Eligible.
      eligibleUpdates++;
      var sheetRowNumber = rowIndex + 1;

      proposals.push({
        sheetRow:              sheetRowNumber,
        jobNumber:             jobNumber,
        currentClaimNumber:    currentClaimNumber || '(blank — was using job number as fallback)',
        proposedClaimNumber:   reportClaimNumber,
        customerName:          customerName
      });

      if (!dryRun) {
        claimsSheet.getRange(sheetRowNumber, claimNumberCol + 1).setValue(reportClaimNumber);
      }
    }

    if (!dryRun && eligibleUpdates > 0) {
      SpreadsheetApp.flush();
    }

    // ── Log summary ─────────────────────────────────────────────────────────
    Logger.log(
      '[ClaimNumberEnrich] ' + (dryRun ? 'PREVIEW' : 'RUN') +
      ': claimsChecked=' + claimsChecked +
      ' fallbackFound=' + fallbackClaimNumbersFound +
      ' eligible=' + eligibleUpdates +
      ' written=' + (dryRun ? '(dryRun)' : eligibleUpdates) +
      ' conflicts=' + conflictCount +
      ' skippedNoJob=' + skippedNoJobNumber +
      ' skippedNotFallback=' + skippedNotFallback +
      ' skippedNoReportRow=' + skippedNoReportRow +
      ' skippedBlankReportClaim=' + skippedBlankReportClaimNumber +
      ' skippedReportClaimEqualsJob=' + skippedReportClaimNumberEqualsJobNum
    );

    if (dryRun && proposals.length > 0) {
      Logger.log(
        '[ClaimNumberEnrich] PREVIEW — first ' + Math.min(10, proposals.length) + ' proposals:'
      );
      proposals.slice(0, 10).forEach(function(p) {
        Logger.log(
          '  row=' + p.sheetRow +
          ' job=' + p.jobNumber +
          ' currentClaim=' + p.currentClaimNumber +
          ' proposedClaim=' + p.proposedClaimNumber +
          ' customer=' + p.customerName
        );
      });
    }

    return {
      success:                             true,
      dryRun:                              dryRun,
      generatedAt:                         new Date().toISOString(),
      sourceFileName:                      latestFile.fileName,
      claimsChecked:                       claimsChecked,
      fallbackClaimNumbersFound:           fallbackClaimNumbersFound,
      eligibleUpdates:                     eligibleUpdates,
      rowsUpdated:                         dryRun ? 0 : eligibleUpdates,
      conflicts:                           conflictCount,
      skippedNoJobNumber:                  skippedNoJobNumber,
      skippedNotFallback:                  skippedNotFallback,
      skippedNoReportRow:                  skippedNoReportRow,
      skippedBlankReportClaimNumber:       skippedBlankReportClaimNumber,
      skippedReportClaimNumberEqualsJobNum: skippedReportClaimNumberEqualsJobNum,
      sampleProposals:                     proposals.slice(0, 10)
    };
  } finally {
    cleanupConvertedReportSheet_(converted);
  }
}

// ---------------------------------------------------------------------------

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
