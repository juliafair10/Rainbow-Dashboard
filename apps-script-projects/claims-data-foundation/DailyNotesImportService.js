/**
 * Phase 8.5B
 * Daily Notes Import Service
 *
 * Current goal:
 * Convert XLSX -> Google Sheet -> Read rows -> Log structure.
 * No database writes yet.
 */

function testDailyNotesExtraction() {
  const file = findLatestDailyNotesFile_();

  if (!file) {
    throw new Error('No Daily Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const result = readDailyNotesRows_(tempSheetId);

    Logger.log('Total Rows: ' + result.rowCount);
    Logger.log('Headers: ' + JSON.stringify(result.headers));
    Logger.log('First Data Row: ' + JSON.stringify(result.firstRow));

  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function convertExcelToSheet_(fileId) {
  const sourceFile = DriveApp.getFileById(fileId);

  const resource = {
    title: 'TEMP Daily Notes Import ' + new Date().getTime(),
    mimeType: MimeType.GOOGLE_SHEETS
  };

  const converted = Drive.Files.insert(
    resource,
    sourceFile.getBlob(),
    { convert: true }
  );

  Logger.log('Temporary Sheet Created: ' + converted.id);

  return converted.id;
}

function readDailyNotesRows_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Daily Notes file contains no data rows.');
  }

  return {
    rowCount: values.length - 1,
    headers: values[0],
    firstRow: values[1]
  };
}

function cleanupTemporarySheet_(sheetId) {
  Drive.Files.remove(sheetId);

  Logger.log('Temporary Sheet Deleted: ' + sheetId);
}

function inspectJobNumberCell() {
  const file = findLatestDailyNotesFile_();
  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const ss = SpreadsheetApp.openById(tempSheetId);
    const sheet = ss.getSheets()[0];

    const jobNumberCell = sheet.getRange(2, 7);
    const richText = jobNumberCell.getRichTextValue();
    const linkUrl = richText ? richText.getLinkUrl() : null;

    Logger.log('Display Value: ' + jobNumberCell.getDisplayValue());
    Logger.log('Link URL: ' + linkUrl);
    Logger.log('Rich Text Text: ' + (richText ? richText.getText() : null));
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function testDailyNotesRecordExtraction() {
  const file = findLatestDailyNotesFile_();

  if (!file) {
    throw new Error('No Daily Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractDailyNotesRecords_(tempSheetId);

    Logger.log('Total Records: ' + records.length);
    Logger.log('First Record: ' + JSON.stringify(records[0] || null));
    Logger.log('Last Record: ' + JSON.stringify(records[records.length - 1] || null));
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function extractDailyNotesRecords_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Daily Notes file contains no data rows.');
  }

  const headers = values[0].map(function(header) {
    return String(header).trim();
  });

  const columnMap = buildDailyNotesColumnMap_(headers);
  const records = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const jobNumber = String(row[columnMap.jobNumber] || '').trim();

    if (!jobNumber) {
      continue;
    }

    const sheetRowNumber = rowIndex + 1;
    const jobNumberCell = sheet.getRange(sheetRowNumber, columnMap.jobNumber + 1);
    const richText = jobNumberCell.getRichTextValue();
    const fusionUrl = richText ? richText.getLinkUrl() : null;

    records.push({
      divisionType: String(row[columnMap.divisionType] || '').trim(),
      status: String(row[columnMap.status] || '').trim(),
      claimNumber: String(row[columnMap.claimNumber] || '').trim(),
      customerName: String(row[columnMap.customerName] || '').trim(),
      daysOld: row[columnMap.daysOld],
      lastJournalNote: String(row[columnMap.lastJournalNote] || '').trim(),
      jobNumber: jobNumber,
      fusionUrl: fusionUrl,
      fusionJobId: extractFusionJobId_(fusionUrl)
    });
  }

  return records;
}

function buildDailyNotesColumnMap_(headers) {
  const requiredColumns = {
    divisionType: 'Division Type',
    status: 'Status',
    claimNumber: 'Claim Number',
    customerName: 'Customer Name',
    daysOld: 'Days Old (Date Last Journal Note Entered)',
    lastJournalNote: 'Last Journal Note Entered',
    jobNumber: 'Job Number'
  };

  const columnMap = {};

  Object.keys(requiredColumns).forEach(function(key) {
    const headerName = requiredColumns[key];
    const index = headers.indexOf(headerName);

    if (index === -1) {
      throw new Error('Missing required Daily Notes column: ' + headerName);
    }

    columnMap[key] = index;
  });

  return columnMap;
}

function extractFusionJobId_(fusionUrl) {
  if (!fusionUrl) {
    return '';
  }

  const match = String(fusionUrl).match(/[?&]JobId=([^&]+)/i);

  return match ? decodeURIComponent(match[1]) : '';
}

function testWriteDailyNotesIdentityTables() {
  const file = findLatestDailyNotesFile_();

  if (!file) {
    throw new Error('No Daily Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractDailyNotesRecords_(tempSheetId);

    Logger.log('Extracted Records: ' + records.length);

    writeClaimCrosswalk_(records);
    writeExternalLinks_(records);
    appendImportLog_({
      source: 'Daily Notes',
      recordsRead: records.length,
      recordsImported: records.length,
      warnings: '',
      errors: '',
      status: 'Success'
    });

    Logger.log('Daily Notes identity tables written successfully.');
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function writeClaimCrosswalk_(records) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Claim_Crosswalk');

  if (!sheet) {
    throw new Error('Missing sheet: Claim_Crosswalk');
  }

  clearDataRows_(sheet);

  if (!records.length) {
    Logger.log('No records to write to Claim_Crosswalk.');
    return;
  }

  const now = new Date();

  const rows = records.map(function(record) {
    return [
      record.jobNumber,
      record.claimNumber,
      record.fusionJobId,
      record.fusionUrl,
      record.customerName,
      now,
      now,
      true
    ];
  });

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('Claim_Crosswalk rows written: ' + rows.length);
}

function writeExternalLinks_(records) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('External_Links');

  if (!sheet) {
    throw new Error('Missing sheet: External_Links');
  }

  clearDataRows_(sheet);

  if (!records.length) {
    Logger.log('No records to write to External_Links.');
    return;
  }

  const rows = records.map(function(record) {
    return [
      '',
      record.jobNumber,
      record.fusionUrl,
      record.fusionJobId,
      '',
      '',
      '',
      '',
      ''
    ];
  });

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('External_Links rows written: ' + rows.length);
}

function appendImportLog_(logEntry) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Import_Log');

  if (!sheet) {
    throw new Error('Missing sheet: Import_Log');
  }

  const importId = 'IMP-' + Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMdd-HHmmss'
  );

  sheet.appendRow([
    importId,
    logEntry.source,
    new Date(),
    logEntry.recordsRead,
    logEntry.recordsImported,
    logEntry.warnings,
    logEntry.errors,
    logEntry.status
  ]);

  Logger.log('Import_Log row appended: ' + importId);
}

function clearDataRows_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 2) {
    return;
  }

  sheet.getRange(3, 1, lastRow - 2, lastColumn).clearContent();
}

function testWriteDailyNotesClaims() {
  const file = findLatestDailyNotesFile_();

  if (!file) {
    throw new Error('No Daily Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractDailyNotesRecords_(tempSheetId);

    Logger.log('Extracted Records: ' + records.length);

    writeClaimsFromDailyNotes_(records);

    appendImportLog_({
      source: 'Daily Notes - Claims Population',
      recordsRead: records.length,
      recordsImported: records.length,
      warnings: '',
      errors: '',
      status: 'Success'
    });

    Logger.log('Daily Notes Claims table written successfully.');
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function writeClaimsFromDailyNotes_(records) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Claims');

  if (!sheet) {
    throw new Error('Missing sheet: Claims');
  }

  clearDataRows_(sheet);

  if (!records.length) {
    Logger.log('No records to write to Claims.');
    return;
  }

  const rows = records.map(function(record) {
    return buildClaimRowFromDailyNotes_(record);
  });

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('Claims rows written: ' + rows.length);
}

function buildClaimRowFromDailyNotes_(record) {
  const now = new Date();
  const lastActivityDate = calculateLastActivityDate_(record.daysOld, now);

  return [
    generateClaimId_(record),
    record.jobNumber,
    record.claimNumber,
    record.customerName,
    '',
    'Active Work',
    'Office Operations',
    'Not Evaluated',
    'Imported from Daily Notes; health not evaluated yet.',
    '',
    '',
    now,
    now,
    lastActivityDate
  ];
}

function generateClaimId_(record) {
  const base = record.jobNumber || record.claimNumber || record.customerName || 'UNKNOWN';
  const normalized = String(base)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-');

  return 'CLM-' + normalized;
}

function calculateLastActivityDate_(daysOld, referenceDate) {
  const parsedDays = Number(daysOld);

  if (isNaN(parsedDays)) {
    return '';
  }

  const date = new Date(referenceDate.getTime());
  date.setDate(date.getDate() - parsedDays);

  return date;
}