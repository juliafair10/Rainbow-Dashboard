/**
 * Phase 8.5E / Historical Notes Import Service
 *
 * Current architecture:
 * historical-notes-sync maintains the native Google Sheet archive.
 * claims-data-foundation reads that archive and projects it into Timeline_Events.
 *
 * Canonical source:
 * Rainbow - Historical Notes Archive -> Historical_Notes
 */

function testHistoricalNotesExtraction() {
  const source = getHistoricalNotesSource_();

  Logger.log('Using source: ' + source.description);

  const result = readHistoricalNotesRows_(source.spreadsheetId, source.sheetName);

  Logger.log('Total Rows: ' + result.rowCount);
  Logger.log('Headers: ' + JSON.stringify(result.headers));
  Logger.log('First Data Row: ' + JSON.stringify(result.firstRow));
}

function getHistoricalNotesSource_() {
  if (
    CONFIG.historicalNotesArchive &&
    CONFIG.historicalNotesArchive.spreadsheetId &&
    CONFIG.historicalNotesArchive.sheetName
  ) {
    return {
      spreadsheetId: CONFIG.historicalNotesArchive.spreadsheetId,
      sheetName: CONFIG.historicalNotesArchive.sheetName,
      description: 'Rainbow - Historical Notes Archive / ' + CONFIG.historicalNotesArchive.sheetName,
      isNativeArchive: true
    };
  }

  const file = findLatestHistoricalNotesFile_();

  if (!file) {
    throw new Error('No Historical Notes file found.');
  }

  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    return {
      spreadsheetId: file.getId(),
      sheetName: null,
      description: file.getName(),
      isNativeArchive: true
    };
  }

  const tempSheetId = convertExcelToSheet_(file.getId());

  return {
    spreadsheetId: tempSheetId,
    sheetName: null,
    description: file.getName(),
    isTemporarySheet: true
  };
}

function cleanupHistoricalNotesSource_(source) {
  if (source && source.isTemporarySheet) {
    cleanupTemporarySheet_(source.spreadsheetId);
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

  inspectFilesInFolder_(parentFolder);

  const monthFolders = parentFolder.getFolders();

  while (monthFolders.hasNext()) {
    inspectFilesInFolder_(monthFolders.next());
  }

  return newestFile;
}

function getHistoricalNotesSheet_(spreadsheetId, sheetName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);

  if (sheetName) {
    const namedSheet = ss.getSheetByName(sheetName);

    if (!namedSheet) {
      throw new Error('Missing Historical Notes sheet: ' + sheetName);
    }

    return namedSheet;
  }

  return ss.getSheets()[0];
}

function readHistoricalNotesRows_(spreadsheetId, sheetName) {
  const sheet = getHistoricalNotesSheet_(spreadsheetId, sheetName);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Historical Notes source contains no data rows.');
  }

  return {
    rowCount: values.length - 1,
    headers: values[0],
    firstRow: values[1]
  };
}

function testHistoricalNotesRecordExtraction() {
  const source = getHistoricalNotesSource_();

  Logger.log('Using source: ' + source.description);

  try {
    const records = extractHistoricalNotesRecords_(source.spreadsheetId, source.sheetName);

    Logger.log('Total Records: ' + records.length);
    Logger.log('First Record: ' + JSON.stringify(records[0] || null));
    Logger.log('Last Record: ' + JSON.stringify(records[records.length - 1] || null));
  } finally {
    cleanupHistoricalNotesSource_(source);
  }
}

function extractHistoricalNotesRecords_(spreadsheetId, sheetName) {
  const sheet = getHistoricalNotesSheet_(spreadsheetId, sheetName);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Historical Notes source contains no data rows.');
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
      noteId: columnMap.noteId !== undefined ? String(row[columnMap.noteId] || '').trim() : '',
      fusionJobNumber: columnMap.fusionJobNumber !== undefined ? String(row[columnMap.fusionJobNumber] || '').trim() : '',
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
  return {
    noteId: findHistoricalColumnIndex_(headers, ['noteId', 'Note ID'], false),
    fusionJobNumber: findHistoricalColumnIndex_(headers, ['fusionJobNumber', 'Fusion Job Number'], false),
    jobNumber: findHistoricalColumnIndex_(headers, ['jobNumber', 'Job Number'], true),
    customer: findHistoricalColumnIndex_(headers, ['customerName', 'Customer Name', 'Customer'], true),
    addedBy: findHistoricalColumnIndex_(headers, ['noteAuthor', 'Added By', 'Author'], true),
    eventDate: findHistoricalColumnIndex_(headers, ['noteDate', 'Event Date', 'Date'], true),
    note: findHistoricalColumnIndex_(headers, ['noteText', 'Note Text', 'Note'], true),
    visibility: findHistoricalColumnIndex_(headers, ['visibility', 'Visibility'], true)
  };
}

function findHistoricalColumnIndex_(headers, possibleNames, required) {
  for (let i = 0; i < possibleNames.length; i++) {
    const index = headers.indexOf(possibleNames[i]);

    if (index !== -1) {
      return index;
    }
  }

  if (required) {
    throw new Error('Missing required Historical Notes column. Expected one of: ' + possibleNames.join(', '));
  }

  return undefined;
}

function testWriteHistoricalNotesTimelineEvents() {
  const source = getHistoricalNotesSource_();

  Logger.log('Using source: ' + source.description);

  try {
    const records = extractHistoricalNotesRecords_(source.spreadsheetId, source.sheetName);

    Logger.log('Extracted Records: ' + records.length);

    writeHistoricalNotesTimelineEvents_(records);
    appendImportLog_({
      source: 'Historical Notes Archive',
      recordsRead: records.length,
      recordsImported: records.length,
      warnings: '',
      errors: '',
      status: 'Success'
    });

    Logger.log('Historical Notes Timeline_Events written successfully.');
  } finally {
    cleanupHistoricalNotesSource_(source);
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
  if (record.noteId) {
    return 'TLN-' + record.noteId;
  }

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