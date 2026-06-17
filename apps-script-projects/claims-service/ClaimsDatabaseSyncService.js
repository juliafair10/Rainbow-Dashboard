/**
 * Phase 9
 * Sync evaluated health data from Claim Foundation
 * into Rainbow Claims Database.
 */

function syncClaimHealthToClaimsDatabase() {
  var foundationClaims = getClaimFoundationHealthRecords_();
  var claimsSheet = getClaimsDatabaseSheet_();
  var database = getClaimsDatabaseRows_(claimsSheet);

  var results = {
    processed: foundationClaims.length,
    updated: 0,
    missing: 0,
    skippedBlankHealth: 0,
    warnings: []
  };

  foundationClaims.forEach(function(claim) {
    if (!claim.healthLevel && !claim.healthReason) {
      results.skippedBlankHealth += 1;
      return;
    }

    var match = findClaimsDatabaseMatch_(claim, database.records);

    if (!match) {
      results.missing += 1;
      results.warnings.push({
        claimId: claim.claimId,
        claimNumber: claim.claimNumber,
        displayName: claim.displayName,
        reason: 'No matching Rainbow Claims Database row found.'
      });
      return;
    }

    claimsSheet.getRange(match.rowNumber, database.columns.healthStatus + 1).setValue(claim.healthLevel);
    claimsSheet.getRange(match.rowNumber, database.columns.healthReason + 1).setValue(claim.healthReason);
    claimsSheet.getRange(match.rowNumber, database.columns.lastUpdated + 1).setValue(new Date().toISOString());

    results.updated += 1;
  });

  Logger.log(JSON.stringify(results, null, 2));

  return results;
}

function testClaimHealthSyncPreview() {
  var foundationClaims = getClaimFoundationHealthRecords_();
  var database = getClaimsDatabaseRows_(getClaimsDatabaseSheet_());

  var preview = {
    foundationCount: foundationClaims.length,
    databaseCount: database.records.length,
    exactClaimIdMatches: 0,
    jobNumberMatches: 0,
    claimNumberMatches: 0,
    nameAndClaimNumberMatches: 0,
    unmatched: 0,
    sampleMatches: [],
    sampleUnmatched: []
  };

  foundationClaims.forEach(function(claim) {
    var match = findClaimsDatabaseMatch_(claim, database.records);

    if (!match) {
      preview.unmatched += 1;
      if (preview.sampleUnmatched.length < 10) {
        preview.sampleUnmatched.push({
          claimId: claim.claimId,
          claimNumber: claim.claimNumber,
          displayName: claim.displayName,
          healthLevel: claim.healthLevel,
          healthReason: claim.healthReason
        });
      }
      return;
    }

    if (match.matchType === 'claimId') preview.exactClaimIdMatches += 1;
    if (match.matchType === 'jobNumber') preview.jobNumberMatches += 1;
    if (match.matchType === 'claimNumber') preview.claimNumberMatches += 1;
    if (match.matchType === 'nameAndClaimNumber') preview.nameAndClaimNumberMatches += 1;

    if (preview.sampleMatches.length < 10) {
      preview.sampleMatches.push({
        matchType: match.matchType,
        sourceClaimId: claim.claimId,
        sourceClaimNumber: claim.claimNumber,
        sourceDisplayName: claim.displayName,
        targetClaimId: match.record.claimId,
        targetJobNumber: match.record.jobNumber,
        targetClaimNumber: match.record.claimNumber,
        targetCustomerName: match.record.customerName,
        healthLevel: claim.healthLevel,
        healthReason: claim.healthReason
      });
    }
  });

  Logger.log(JSON.stringify(preview, null, 2));

  return preview;
}

function getClaimsDatabaseRows_(claimsSheet) {
  var data = claimsSheet.getDataRange().getValues();

  if (data.length < 2) {
    return {
      columns: {},
      records: []
    };
  }

  var headers = data[0];
  var rows = data.slice(1);

  var columns = {
    claimId: headers.indexOf('Claim ID'),
    jobNumber: headers.indexOf('Job Number'),
    claimNumber: headers.indexOf('Claim Number'),
    customerName: headers.indexOf('Customer Name'),
    healthStatus: headers.indexOf('Health Status'),
    healthReason: headers.indexOf('Health Reason'),
    lastUpdated: headers.indexOf('Last Updated')
  };

  validateRequiredColumns_(columns);

  var records = rows.map(function(row, index) {
    return {
      rowNumber: index + 2,
      claimId: row[columns.claimId],
      jobNumber: row[columns.jobNumber],
      claimNumber: row[columns.claimNumber],
      customerName: row[columns.customerName]
    };
  }).filter(function(record) {
    return record.claimId || record.jobNumber || record.claimNumber || record.customerName;
  });

  return {
    columns: columns,
    records: records
  };
}

function findClaimsDatabaseMatch_(claim, records) {
  var exactClaimId = records.filter(function(record) {
    return normalizeKey_(record.claimId) && normalizeKey_(record.claimId) === normalizeKey_(claim.claimId);
  });

  if (exactClaimId.length === 1) {
    return buildMatch_('claimId', exactClaimId[0]);
  }

  var jobNumber = records.filter(function(record) {
    return normalizeKey_(record.jobNumber) && normalizeKey_(record.jobNumber) === normalizeKey_(claim.claimNumber);
  });

  if (jobNumber.length === 1) {
    return buildMatch_('jobNumber', jobNumber[0]);
  }

  var claimNumber = records.filter(function(record) {
    return normalizeKey_(record.claimNumber) && normalizeKey_(record.claimNumber) === normalizeKey_(claim.claimNumber);
  });

  if (claimNumber.length === 1) {
    return buildMatch_('claimNumber', claimNumber[0]);
  }

  var nameAndClaimNumber = records.filter(function(record) {
    return normalizeName_(record.customerName) &&
           normalizeName_(record.customerName) === normalizeName_(claim.displayName) &&
           normalizeKey_(record.claimNumber) &&
           normalizeKey_(record.claimNumber) === normalizeKey_(claim.claimNumber);
  });

  if (nameAndClaimNumber.length === 1) {
    return buildMatch_('nameAndClaimNumber', nameAndClaimNumber[0]);
  }

  return null;
}

function buildMatch_(matchType, record) {
  return {
    matchType: matchType,
    rowNumber: record.rowNumber,
    record: record
  };
}

function getClaimFoundationHealthRecords_() {
  var sheet = SpreadsheetApp
    .openById(CLAIM_FOUNDATION_SPREADSHEET_ID)
    .getSheetByName('Claims');

  var values = sheet.getDataRange().getValues();
  var headers = values[0];

  return values.slice(1).map(function(row) {
    var record = {};

    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    return {
      claimId: record.Claim_ID,
      claimNumber: record.Claim_Number,
      displayName: record.Display_Name,
      healthLevel: record.Operational_Health,
      healthReason: record.Health_Reason
    };
  }).filter(function(record) {
    return record.claimId || record.claimNumber || record.displayName;
  });
}

function validateRequiredColumns_(columns) {
  var required = [
    'claimId',
    'jobNumber',
    'claimNumber',
    'customerName',
    'healthStatus',
    'healthReason',
    'lastUpdated'
  ];

  required.forEach(function(key) {
    if (columns[key] === -1) {
      throw new Error('Missing required Rainbow Claims Database column: ' + key);
    }
  });
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeName_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

var ClaimsDatabaseSyncService = {
  syncClaimHealthToClaimsDatabase: syncClaimHealthToClaimsDatabase,
  testClaimHealthSyncPreview: testClaimHealthSyncPreview
};