

/**
 * Phase 8.5E
 * Historical Notes Import Service
 *
 * Initial goal:
 * Read Historical Notes XLSX structure and validate extraction.
 */

function testHistoricalNotesExtraction() {
  const file = findLatestHistoricalNotesFile_();

  if (!file) {
    throw new Error('No Historical Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const result = readHistoricalNotesRows_(tempSheetId);

    Logger.log('Total Rows: ' + result.rowCount);
    Logger.log('Headers: ' + JSON.stringify(result.headers));
    Logger.log('First Data Row: ' + JSON.stringify(result.firstRow));
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function findLatestHistoricalNotesFile_() {
  const parentFolder = DriveApp.getFolderById(CONFIG.folders.historical);

  let newestFile = null;
  let newestTimestamp = 0;

  function inspectFilesInFolder_(folder) {
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const updated = file.getLastUpdated().getTime();

      if (updated > newestTimestamp) {
        newestTimestamp = updated;
        newestFile = file;
      }
    }
  }

  // Support files uploaded directly into Historical Notes parent folder.
  inspectFilesInFolder_(parentFolder);

  // Support files uploaded into monthly YYYY-MM subfolders.
  const monthFolders = parentFolder.getFolders();

  while (monthFolders.hasNext()) {
    inspectFilesInFolder_(monthFolders.next());
  }

  return newestFile;
}

function readHistoricalNotesRows_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Historical Notes file contains no data rows.');
  }

  return {
    rowCount: values.length - 1,
    headers: values[0],
    firstRow: values[1]
  };
}

function testHistoricalNotesRecordExtraction() {
  const file = findLatestHistoricalNotesFile_();

  if (!file) {
    throw new Error('No Historical Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractHistoricalNotesRecords_(tempSheetId);

    Logger.log('Total Records: ' + records.length);
    Logger.log('First Record: ' + JSON.stringify(records[0] || null));
    Logger.log('Last Record: ' + JSON.stringify(records[records.length - 1] || null));
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function extractHistoricalNotesRecords_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Historical Notes file contains no data rows.');
  }

  const headers = values[0].map(function(header) {
    return String(header).trim();
  });

  const columnMap = buildHistoricalNotesColumnMap_(headers);
  const records = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const jobNumber = String(row[columnMap.jobNumber] || '').trim();
    const note = String(row[columnMap.note] || '').trim();

    if (!jobNumber && !note) {
      continue;
    }

    records.push({
      jobNumber: jobNumber,
      customerName: String(row[columnMap.customer] || '').trim(),
      addedBy: String(row[columnMap.addedBy] || '').trim(),
      eventDate: row[columnMap.eventDate],
      note: note,
      visibility: String(row[columnMap.visibility] || '').trim()
    });
  }

  return records;
}

function buildHistoricalNotesColumnMap_(headers) {
  const requiredColumns = {
    jobNumber: 'Job Number',
    customer: 'Customer',
    addedBy: 'Added By',
    eventDate: 'Event Date',
    note: 'Note',
    visibility: 'Visibility'
  };

  const columnMap = {};

  Object.keys(requiredColumns).forEach(function(key) {
    const headerName = requiredColumns[key];
    const index = headers.indexOf(headerName);

    if (index === -1) {
      throw new Error('Missing required Historical Notes column: ' + headerName);
    }

    columnMap[key] = index;
  });

  return columnMap;
}

function testWriteHistoricalNotesTimelineEvents() {
  const file = findLatestHistoricalNotesFile_();

  if (!file) {
    throw new Error('No Historical Notes file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractHistoricalNotesRecords_(tempSheetId);

    Logger.log('Extracted Records: ' + records.length);

    writeHistoricalNotesTimelineEvents_(records);
    appendImportLog_({
      source: 'Historical Notes',
      recordsRead: records.length,
      recordsImported: records.length,
      warnings: '',
      errors: '',
      status: 'Success'
    });

    Logger.log('Historical Notes Timeline_Events written successfully.');
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function writeHistoricalNotesTimelineEvents_(records) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Timeline_Events');

  if (!sheet) {
    throw new Error('Missing sheet: Timeline_Events');
  }

  clearDataRows_(sheet);

  if (!records.length) {
    Logger.log('No records to write to Timeline_Events.');
    return;
  }

  const rows = records.map(function(record, index) {
    return [
      generateHistoricalTimelineEventId_(record, index),
      generateClaimIdFromJobNumber_(record.jobNumber),
      record.jobNumber,
      record.eventDate,
      'Historical Notes',
      'Note',
      record.addedBy,
      buildHistoricalNoteSummary_(record.note),
      record.note,
      record.visibility
    ];
  });

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('Timeline_Events rows written: ' + rows.length);
}

function generateHistoricalTimelineEventId_(record, index) {
  const base = [
    record.jobNumber || 'NOJOB',
    record.eventDate || 'NODATE',
    index + 1
  ].join('-');

  const normalized = String(base)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-');

  return 'TLN-' + normalized;
}

function buildHistoricalNoteSummary_(note) {
  const text = String(note || '').replace(/\s+/g, ' ').trim();

  if (text.length <= 120) {
    return text;
  }

  return text.substring(0, 117) + '...';
}