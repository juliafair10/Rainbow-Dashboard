

/**
 * Phase 8.5D
 * Compliance Tasks Import Service
 *
 * Current goal:
 * Convert XLSX -> Google Sheet -> Read rows -> Log structure.
 * No database writes yet.
 */

function testComplianceTasksExtraction() {
  const file = findLatestComplianceTasksFile_();

  if (!file) {
    throw new Error('No Compliance Tasks file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const result = readComplianceTasksRows_(tempSheetId);

    Logger.log('Total Rows: ' + result.rowCount);
    Logger.log('Headers: ' + JSON.stringify(result.headers));
    Logger.log('First Data Row: ' + JSON.stringify(result.firstRow));
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function findLatestComplianceTasksFile_() {
  const parentFolder = DriveApp.getFolderById(CONFIG.folders.compliance);
  const monthFolders = parentFolder.getFolders();

  let newestFile = null;
  let newestTimestamp = 0;

  while (monthFolders.hasNext()) {
    const monthFolder = monthFolders.next();
    const files = monthFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const updated = file.getLastUpdated().getTime();

      if (updated > newestTimestamp) {
        newestTimestamp = updated;
        newestFile = file;
      }
    }
  }

  return newestFile;
}

function readComplianceTasksRows_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Compliance Tasks file contains no data rows.');
  }

  return {
    rowCount: values.length - 1,
    headers: values[0],
    firstRow: values[1]
  };
}

function testComplianceTasksRecordExtraction() {
  const file = findLatestComplianceTasksFile_();

  if (!file) {
    throw new Error('No Compliance Tasks file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractComplianceTasksRecords_(tempSheetId);

    Logger.log('Total Records: ' + records.length);
    Logger.log('First Record: ' + JSON.stringify(records[0] || null));
    Logger.log('Last Record: ' + JSON.stringify(records[records.length - 1] || null));
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function extractComplianceTasksRecords_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Compliance Tasks file contains no data rows.');
  }

  const headers = values[0].map(function(header) {
    return String(header).trim();
  });

  const columnMap = buildComplianceTasksColumnMap_(headers);
  const records = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const jobNumber = String(row[columnMap.jobNumber] || '').trim();
    const actionTitle = String(row[columnMap.actionTitle] || '').trim();

    if (!jobNumber && !actionTitle) {
      continue;
    }

    records.push({
      division: String(row[columnMap.division] || '').trim(),
      jobNumber: jobNumber,
      claimNumber: String(row[columnMap.claimNumber] || '').trim(),
      customerName: String(row[columnMap.customerName] || '').trim(),
      lossAddress: String(row[columnMap.lossAddress] || '').trim(),
      actionTitle: actionTitle,
      completedDate: row[columnMap.completedDate],
      dueDate: row[columnMap.dueDate],
      dueIn: String(row[columnMap.dueIn] || '').trim(),
      requiredAction: String(row[columnMap.requiredAction] || '').trim(),
      priority: String(row[columnMap.priority] || '').trim()
    });
  }

  return records;
}

function buildComplianceTasksColumnMap_(headers) {
  const requiredColumns = {
    division: 'Division',
    jobNumber: 'Job Number',
    claimNumber: 'Claim Number',
    customerName: 'Customer Name',
    lossAddress: 'Loss Address',
    actionTitle: 'Action Title',
    completedDate: 'Completed Date',
    dueDate: 'Due Date',
    dueIn: 'Due In',
    requiredAction: 'Required Action',
    priority: 'Priority'
  };

  const columnMap = {};

  Object.keys(requiredColumns).forEach(function(key) {
    const headerName = requiredColumns[key];
    const index = headers.indexOf(headerName);

    if (index === -1) {
      throw new Error('Missing required Compliance Tasks column: ' + headerName);
    }

    columnMap[key] = index;
  });

  return columnMap;
}

function testWriteComplianceActions() {
  const file = findLatestComplianceTasksFile_();

  if (!file) {
    throw new Error('No Compliance Tasks file found.');
  }

  Logger.log('Using file: ' + file.getName());

  const tempSheetId = convertExcelToSheet_(file.getId());

  try {
    const records = extractComplianceTasksRecords_(tempSheetId);

    Logger.log('Extracted Records: ' + records.length);

    writeComplianceActions_(records);
    appendImportLog_({
      source: 'Compliance Tasks',
      recordsRead: records.length,
      recordsImported: records.length,
      warnings: '',
      errors: '',
      status: 'Success'
    });

    Logger.log('Compliance Actions table written successfully.');
  } finally {
    cleanupTemporarySheet_(tempSheetId);
  }
}

function writeComplianceActions_(records) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Compliance_Actions');

  if (!sheet) {
    throw new Error('Missing sheet: Compliance_Actions');
  }

  clearDataRows_(sheet);

  if (!records.length) {
    Logger.log('No records to write to Compliance_Actions.');
    return;
  }

  const rows = records.map(function(record, index) {
    return [
      generateComplianceActionId_(record, index),
      generateClaimIdFromJobNumber_(record.jobNumber),
      record.jobNumber,
      record.actionTitle,
      record.priority,
      record.requiredAction,
      record.dueDate,
      record.completedDate,
      determineComplianceActionStatus_(record),
      record.lossAddress
    ];
  });

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('Compliance_Actions rows written: ' + rows.length);
}

function generateComplianceActionId_(record, index) {
  const base = [
    record.jobNumber || 'NOJOB',
    record.actionTitle || 'NOACTION',
    index + 1
  ].join('-');

  const normalized = String(base)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-');

  return 'ACT-' + normalized;
}

function generateClaimIdFromJobNumber_(jobNumber) {
  const normalized = String(jobNumber || 'UNKNOWN')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-');

  return 'CLM-' + normalized;
}

function determineComplianceActionStatus_(record) {
  if (record.completedDate) {
    return 'Completed';
  }

  if (record.priority && record.priority.toLowerCase() === 'critical') {
    return 'Open - Critical';
  }

  return 'Open';
}

function testEnrichClaimsWithComplianceAddresses() {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);

  const claimsSheet = ss.getSheetByName('Claims');
  const complianceSheet = ss.getSheetByName('Compliance_Actions');

  if (!claimsSheet) {
    throw new Error('Missing sheet: Claims');
  }

  if (!complianceSheet) {
    throw new Error('Missing sheet: Compliance_Actions');
  }

  enrichClaimsWithComplianceAddresses_(claimsSheet, complianceSheet);
}

function enrichClaimsWithComplianceAddresses_(claimsSheet, complianceSheet) {
  const addressMap = buildAddressMapFromComplianceActions_(complianceSheet);

  const lastRow = claimsSheet.getLastRow();

  if (lastRow < 3) {
    Logger.log('No Claims records found.');
    return;
  }

  const claimData = claimsSheet.getRange(3, 1, lastRow - 2, 14).getValues();

  let updatedCount = 0;

  claimData.forEach(function(row) {
    const jobNumber = String(row[1] || '').trim();
    const currentAddress = String(row[4] || '').trim();

    if (!jobNumber || currentAddress) {
      return;
    }

    const address = addressMap[jobNumber];

    if (!address) {
      return;
    }

    row[4] = address;
    updatedCount++;
  });

  claimsSheet.getRange(3, 1, claimData.length, claimData[0].length)
    .setValues(claimData);

  Logger.log('Claims addresses updated: ' + updatedCount);
}

function buildAddressMapFromComplianceActions_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 3) {
    return {};
  }

  const values = sheet.getRange(3, 1, lastRow - 2, 10).getValues();

  const map = {};

  values.forEach(function(row) {
    const jobNumber = String(row[2] || '').trim();
    const address = String(row[9] || '').trim();

    if (!jobNumber || !address) {
      return;
    }

    if (!map[jobNumber]) {
      map[jobNumber] = address;
    }
  });

  return map;
}