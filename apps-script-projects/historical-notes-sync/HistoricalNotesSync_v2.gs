const CONFIG = {
  NOTES_REPORT_FOLDER_ID: '1hFyhuJjcaSzGpixXI-bijiFGtmYRXhEz',
  HISTORICAL_NOTES_SPREADSHEET_ID: '1El1gDoh8GHvMfj8aFbV7pEH34vddo0DD2azT6p4XsSQ',
  HISTORICAL_NOTES_SHEET_NAME: 'Historical_Notes',
  NOTES_SYNC_LOG_SHEET_NAME: 'Notes_Sync_Log',
  SYNC_STATE_SHEET_NAME: 'Sync_State',
  DAILY_LOOKBACK_DAYS: 3,
  WEEKLY_RECONCILIATION_DAYS: 30,
  MONTHLY_AUDIT_LOOKBACK_MONTHS: 6
};

const HISTORICAL_NOTES_HEADERS = [
  'noteId',
  'noteIdSource',
  'fusionJobNumber',
  'customerName',
  'jobNumber',
  'noteDate',
  'noteAuthor',
  'noteText',
  'visibility',
  'sourceFileName',
  'importedAt',
  'lastSeenAt',
  'syncRunId'
];

const NOTES_SYNC_LOG_HEADERS = [
  'syncRunId',
  'syncType',
  'startedAt',
  'completedAt',
  'sourceFile',
  'rowsRead',
  'rowsInserted',
  'rowsUpdated',
  'duplicatesSkipped',
  'errors',
  'status'
];

const SYNC_STATE_HEADERS = [
  'key',
  'value',
  'updatedAt'
];

function testSpreadsheetAccess() {
  const ss = SpreadsheetApp.openById(CONFIG.HISTORICAL_NOTES_SPREADSHEET_ID);
  Logger.log(`Connected to: ${ss.getName()}`);
  return ss.getName();
}

function testDriveFolderAccess() {
  const folder = DriveApp.getFolderById(CONFIG.NOTES_REPORT_FOLDER_ID);
  Logger.log(`Connected to folder: ${folder.getName()}`);
  return folder.getName();
}

function testFindNewestFile() {
  const file = getNewestNotesReportFile_();

  if (!file) {
    throw new Error('No supported .xlsx or .csv files found in notes folder or first-level subfolders.');
  }

  Logger.log(`Newest file: ${file.getName()}`);
  Logger.log(`File ID: ${file.getId()}`);
  Logger.log(`Last updated: ${file.getLastUpdated()}`);
  return file.getName();
}

function getNewestNotesReportFile_() {
  const rootFolder = DriveApp.getFolderById(CONFIG.NOTES_REPORT_FOLDER_ID);
  const candidateFiles = [];

  collectNotesReportFiles_(rootFolder, candidateFiles);

  const subfolders = rootFolder.getFolders();
  while (subfolders.hasNext()) {
    collectNotesReportFiles_(subfolders.next(), candidateFiles);
  }

  if (!candidateFiles.length) {
    return null;
  }

  candidateFiles.sort((a, b) => b.getLastUpdated().getTime() - a.getLastUpdated().getTime());
  return candidateFiles[0];
}

function collectNotesReportFiles_(folder, candidateFiles) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();

    if (!isSupportedNotesReportFile_(name)) {
      continue;
    }

    candidateFiles.push(file);
  }
}

function isSupportedNotesReportFile_(fileName) {
  const normalized = String(fileName || '').toLowerCase();
  return normalized.endsWith('.xlsx') || normalized.endsWith('.csv');
}

function testParseNewestFile() {
  const file = getNewestNotesReportFile_();

  if (!file) {
    throw new Error('No supported .xlsx or .csv files found to parse.');
  }

  const parsed = parseNotesReport_(file);

  Logger.log(`Parsed file: ${file.getName()}`);
  Logger.log(`Header count: ${parsed.headers.length}`);
  Logger.log(`Row count: ${parsed.rows.length}`);
  Logger.log(`Headers: ${JSON.stringify(parsed.headers)}`);

  const previewRows = parsed.rows.slice(0, 5);
  Logger.log(`Preview rows: ${JSON.stringify(previewRows)}`);

  return {
    fileName: file.getName(),
    headerCount: parsed.headers.length,
    rowCount: parsed.rows.length,
    headers: parsed.headers,
    previewRows
  };
}

function parseNotesReport_(file) {
  const fileName = file.getName();
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith('.csv')) {
    return parseCsvNotesReport_(file);
  }

  if (normalizedName.endsWith('.xlsx')) {
    return parseXlsxNotesReport_(file);
  }

  throw new Error(`Unsupported notes report file type: ${fileName}`);
}

function parseCsvNotesReport_(file) {
  const csvText = file.getBlob().getDataAsString();
  const values = Utilities.parseCsv(csvText);
  return normalizeParsedValues_(values);
}

function parseXlsxNotesReport_(file) {
  let tempSpreadsheetId = null;

  try {
    const tempFile = Drive.Files.copy(
      {
        title: `TEMP Historical Notes Parse - ${file.getName()} - ${new Date().toISOString()}`,
        mimeType: MimeType.GOOGLE_SHEETS
      },
      file.getId(),
      {
        supportsAllDrives: true
      }
    );

    tempSpreadsheetId = tempFile.id;
    const tempSpreadsheet = SpreadsheetApp.openById(tempSpreadsheetId);
    const sheet = tempSpreadsheet.getSheets()[0];
    const values = sheet.getDataRange().getValues();

    return normalizeParsedValues_(values);
  } finally {
    if (tempSpreadsheetId) {
      try {
        Drive.Files.remove(tempSpreadsheetId, { supportsAllDrives: true });
      } catch (error) {
        Logger.log(`Warning: could not delete temporary parse spreadsheet ${tempSpreadsheetId}: ${error.message}`);
      }
    }
  }
}

function normalizeParsedValues_(values) {
  if (!values || !values.length) {
    return {
      headers: [],
      rows: []
    };
  }

  const nonEmptyRows = values.filter(row => row.some(cell => String(cell || '').trim() !== ''));

  if (!nonEmptyRows.length) {
    return {
      headers: [],
      rows: []
    };
  }

  const headers = nonEmptyRows[0].map(header => String(header || '').trim());
  const rows = nonEmptyRows.slice(1).map(row => {
    const record = {};

    headers.forEach((header, index) => {
      if (!header) {
        return;
      }

      record[header] = row[index];
    });

    return record;
  });

  return {
    headers,
    rows
  };
}

function testNormalizeNewestFile() {
  const file = getNewestNotesReportFile_();

  if (!file) {
    throw new Error('No supported .xlsx or .csv files found to normalize.');
  }

  const parsed = parseNotesReport_(file);
  const normalizedNotes = normalizeNotesRows_(parsed.rows, file.getName(), null);

  Logger.log(`Normalized notes count: ${normalizedNotes.length}`);
  Logger.log(`Preview normalized notes: ${JSON.stringify(normalizedNotes.slice(0, 5))}`);

  return normalizedNotes.slice(0, 5);
}

function testDailySync_DryRun() {
  const file = getNewestNotesReportFile_();

  if (!file) {
    throw new Error('No supported .xlsx or .csv files found for daily dry run.');
  }

  const parsed = parseNotesReport_(file);
  const cutoffDate = getDateDaysAgo_(CONFIG.DAILY_LOOKBACK_DAYS);
  const normalizedNotes = normalizeNotesRows_(parsed.rows, file.getName(), cutoffDate);

  Logger.log(`Daily dry run file: ${file.getName()}`);
  Logger.log(`Daily lookback days: ${CONFIG.DAILY_LOOKBACK_DAYS}`);
  Logger.log(`Cutoff date: ${cutoffDate}`);
  Logger.log(`Rows after daily date filter: ${normalizedNotes.length}`);
  Logger.log(`Preview daily notes: ${JSON.stringify(normalizedNotes.slice(0, 5))}`);

  return {
    fileName: file.getName(),
    cutoffDate,
    rowCount: normalizedNotes.length,
    previewRows: normalizedNotes.slice(0, 5)
  };
}

function runInitialHistoricalNotesBackfill() {
  return runHistoricalNotesSync_('BACKFILL', null);
}

function runDailyHistoricalNotesSync() {
  return runHistoricalNotesSync_('DAILY', getDateDaysAgo_(CONFIG.DAILY_LOOKBACK_DAYS));
}

function runWeeklyHistoricalNotesReconciliation() {
  return runHistoricalNotesSync_('WEEKLY_RECON', getDateDaysAgo_(CONFIG.WEEKLY_RECONCILIATION_DAYS));
}

function runMonthlyHistoricalNotesAudit() {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - CONFIG.MONTHLY_AUDIT_LOOKBACK_MONTHS);
  return runHistoricalNotesSync_('MONTHLY_AUDIT', cutoff);
}

function runHistoricalNotesSync_(syncType, cutoffDate) {
  const syncRunId = createSyncRunId_();
  const startedAt = new Date();
  let sourceFileName = '';

  try {
    ensureHistoricalNotesSheets_();

    const file = getNewestNotesReportFile_();
    if (!file) {
      throw new Error('No supported .xlsx or .csv files found for sync.');
    }

    sourceFileName = file.getName();
    const parsed = parseNotesReport_(file);
    const normalizedNotes = normalizeNotesRows_(parsed.rows, sourceFileName, cutoffDate);
    const result = upsertHistoricalNotes_(normalizedNotes, syncRunId);

    const completedAt = new Date();
    logNotesSyncRun_({
      syncRunId,
      syncType,
      startedAt,
      completedAt,
      sourceFile: sourceFileName,
      rowsRead: normalizedNotes.length,
      rowsInserted: result.rowsInserted,
      rowsUpdated: result.rowsUpdated,
      duplicatesSkipped: result.duplicatesSkipped,
      errors: '',
      status: 'SUCCESS'
    });

    setSyncState_(getSyncStateKey_(syncType), completedAt);

    return {
      syncRunId,
      syncType,
      sourceFile: sourceFileName,
      rowsRead: normalizedNotes.length,
      rowsInserted: result.rowsInserted,
      rowsUpdated: result.rowsUpdated,
      duplicatesSkipped: result.duplicatesSkipped,
      status: 'SUCCESS'
    };
  } catch (error) {
    const completedAt = new Date();
    logNotesSyncRun_({
      syncRunId,
      syncType,
      startedAt,
      completedAt,
      sourceFile: sourceFileName,
      rowsRead: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      duplicatesSkipped: 0,
      errors: error.message,
      status: 'ERROR'
    });

    throw error;
  }
}

function normalizeNotesRows_(rows, sourceFileName, cutoffDate) {
  return rows
    .map(row => normalizeSingleNoteRow_(row, sourceFileName))
    .filter(note => note.noteText || note.jobNumber || note.customerName)
    .filter(note => {
      if (!cutoffDate || !note.noteDate) {
        return true;
      }

      const noteDate = new Date(note.noteDate);
      if (Number.isNaN(noteDate.getTime())) {
        return true;
      }

      return noteDate >= cutoffDate;
    });
}

function normalizeSingleNoteRow_(row, sourceFileName) {
  const fusionJobNumber = getRowValue_(row, ['Job Number']);
  const customerName = getRowValue_(row, ['Customer']);
  const noteAuthor = getRowValue_(row, ['Added By']);
  const noteDate = normalizeDateValue_(getRowValue_(row, ['Event Date']));
  const noteText = String(getRowValue_(row, ['Note']) || '').trim();
  const visibility = getRowValue_(row, ['Visibility']);
  const jobNumber = fusionJobNumber;
  const noteId = generateNoteKey_({
    fusionJobNumber,
    jobNumber,
    noteDate,
    noteAuthor,
    noteText
  });

  return {
    noteId,
    noteIdSource: 'generated',
    fusionJobNumber,
    customerName,
    jobNumber,
    noteDate,
    noteAuthor,
    noteText,
    visibility,
    sourceFileName
  };
}

function upsertHistoricalNotes_(notes, syncRunId) {
  const sheet = getOrCreateSheet_(CONFIG.HISTORICAL_NOTES_SHEET_NAME, HISTORICAL_NOTES_HEADERS);
  const now = new Date();
  const existing = getExistingNotesIndex_(sheet);
  const rowsToAppend = [];
  let rowsUpdated = 0;
  let duplicatesSkipped = 0;

  notes.forEach(note => {
    const existingEntry = existing[note.noteId];

    if (!existingEntry) {
      rowsToAppend.push(noteToSheetRow_(note, now, now, syncRunId));
      return;
    }

    const currentRow = existingEntry.values;
    const currentNoteText = String(currentRow[7] || '');
    const currentVisibility = String(currentRow[8] || '');
    const incomingNoteText = String(note.noteText || '');
    const incomingVisibility = String(note.visibility || '');

    if (currentNoteText !== incomingNoteText || currentVisibility !== incomingVisibility) {
      const updatedRow = noteToSheetRow_(note, currentRow[10], now, syncRunId);
      sheet.getRange(existingEntry.rowNumber, 1, 1, HISTORICAL_NOTES_HEADERS.length).setValues([updatedRow]);
      rowsUpdated += 1;
    } else {
      sheet.getRange(existingEntry.rowNumber, 12, 1, 2).setValues([[now, syncRunId]]);
      duplicatesSkipped += 1;
    }
  });

  if (rowsToAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, HISTORICAL_NOTES_HEADERS.length).setValues(rowsToAppend);
  }

  return {
    rowsInserted: rowsToAppend.length,
    rowsUpdated,
    duplicatesSkipped
  };
}

function getExistingNotesIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const index = {};

  if (lastRow < 2) {
    return index;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, HISTORICAL_NOTES_HEADERS.length).getValues();
  values.forEach((row, idx) => {
    const noteId = String(row[0] || '').trim();
    if (!noteId) {
      return;
    }

    index[noteId] = {
      rowNumber: idx + 2,
      values: row
    };
  });

  return index;
}

function noteToSheetRow_(note, importedAt, lastSeenAt, syncRunId) {
  return [
    note.noteId,
    note.noteIdSource,
    note.fusionJobNumber,
    note.customerName,
    note.jobNumber,
    note.noteDate,
    note.noteAuthor,
    note.noteText,
    note.visibility,
    note.sourceFileName,
    importedAt,
    lastSeenAt,
    syncRunId
  ];
}

function logNotesSyncRun_(entry) {
  const sheet = getOrCreateSheet_(CONFIG.NOTES_SYNC_LOG_SHEET_NAME, NOTES_SYNC_LOG_HEADERS);
  sheet.appendRow([
    entry.syncRunId,
    entry.syncType,
    entry.startedAt,
    entry.completedAt,
    entry.sourceFile,
    entry.rowsRead,
    entry.rowsInserted,
    entry.rowsUpdated,
    entry.duplicatesSkipped,
    entry.errors,
    entry.status
  ]);
}

function ensureHistoricalNotesSheets_() {
  getOrCreateSheet_(CONFIG.HISTORICAL_NOTES_SHEET_NAME, HISTORICAL_NOTES_HEADERS);
  getOrCreateSheet_(CONFIG.NOTES_SYNC_LOG_SHEET_NAME, NOTES_SYNC_LOG_HEADERS);
  getOrCreateSheet_(CONFIG.SYNC_STATE_SHEET_NAME, SYNC_STATE_HEADERS);
}

function getOrCreateSheet_(sheetName, headers) {
  const ss = SpreadsheetApp.openById(CONFIG.HISTORICAL_NOTES_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headerMismatch = headers.some((header, index) => String(existingHeaders[index] || '').trim() !== header);

  if (headerMismatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getRowValue_(row, possibleHeaders) {
  for (let i = 0; i < possibleHeaders.length; i += 1) {
    const header = possibleHeaders[i];
    if (Object.prototype.hasOwnProperty.call(row, header)) {
      return row[header];
    }
  }

  return '';
}

function normalizeDateValue_(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return String(value || '').trim();
}

function normalizeText_(value) {
  return String(value || '')
    .replace(/\r\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function generateNoteKey_(note) {
  const rawKey = [
    note.fusionJobNumber,
    note.jobNumber,
    note.noteDate instanceof Date ? note.noteDate.toISOString() : note.noteDate,
    note.noteAuthor,
    normalizeText_(note.noteText)
  ].join('|');

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, rawKey);
  return digest.map(byte => {
    const value = (byte + 256) % 256;
    return value.toString(16).padStart(2, '0');
  }).join('');
}

function createSyncRunId_() {
  return `SYNC-${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')}`;
}

function getDateDaysAgo_(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSyncStateKey_(syncType) {
  if (syncType === 'DAILY') {
    return 'LAST_SUCCESSFUL_DAILY_SYNC';
  }

  if (syncType === 'WEEKLY_RECON') {
    return 'LAST_SUCCESSFUL_WEEKLY_RECON';
  }

  if (syncType === 'MONTHLY_AUDIT') {
    return 'LAST_SUCCESSFUL_MONTHLY_AUDIT';
  }

  return `LAST_SUCCESSFUL_${syncType}`;
}

function getSyncState_(key) {
  const sheet = getOrCreateSheet_(CONFIG.SYNC_STATE_SHEET_NAME, SYNC_STATE_HEADERS);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return '';
  }

  const values = sheet.getRange(2, 1, lastRow - 1, SYNC_STATE_HEADERS.length).getValues();
  const match = values.find(row => String(row[0] || '').trim() === key);
  return match ? match[1] : '';
}

function setSyncState_(key, value) {
  if (!key) {
    return;
  }

  const sheet = getOrCreateSheet_(CONFIG.SYNC_STATE_SHEET_NAME, SYNC_STATE_HEADERS);
  const lastRow = sheet.getLastRow();
  const now = new Date();

  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, SYNC_STATE_HEADERS.length).getValues();
    for (let i = 0; i < values.length; i += 1) {
      if (String(values[i][0] || '').trim() === key) {
        sheet.getRange(i + 2, 1, 1, SYNC_STATE_HEADERS.length).setValues([[key, value, now]]);
        return;
      }
    }
  }

  sheet.appendRow([key, value, now]);
}


function repairHistoricalNotesHeaders() {
  ensureHistoricalNotesSheets_();
  Logger.log('Historical notes sheet headers repaired.');
}
