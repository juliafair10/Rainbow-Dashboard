function getAllClaimSummaries(options) {
  options = options || {};

  var sheet = getClaimsDatabaseSheet_();
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  var headers = values[0];
  var rows = values.slice(1);
  var activeConditionsByClaim = getActiveConditionsByClaim_();

  var includeTerminal = options.includeTerminal === true;

  return rows
    .map(function(row) {
      return normalizeClaimRow_(headers, row, activeConditionsByClaim);
    })
    .filter(function(claim) {
      return claim.claimId;
    })
    .filter(function(claim) {
      if (includeTerminal) {
        return true;
      }

      return claim.lifecycleState !== 'Operationally Complete' &&
             claim.lifecycleState !== 'Not Sold';
    })
    .sort(function(a, b) {
      return new Date(b.createdDate || 0) - new Date(a.createdDate || 0);
    });
}

function getClaimsDatabaseSheet_() {
  var spreadsheetId = typeof CLAIMS_DATABASE_SPREADSHEET_ID !== 'undefined'
    ? CLAIMS_DATABASE_SPREADSHEET_ID
    : CLAIM_FOUNDATION_SPREADSHEET_ID;

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName('Claims');

  if (!sheet) {
    throw new Error('Claims sheet not found in spreadsheet: ' + spreadsheetId);
  }

  return sheet;
}

function normalizeClaimRow_(headers, row, activeConditionsByClaim) {
  var raw = {};

  headers.forEach(function(header, index) {
    raw[String(header).trim()] = row[index];
  });

  var claimId = pick_(raw, ['Claim_ID', 'Claim ID', 'claimId']);
  var hydratedConditions = activeConditionsByClaim && claimId
    ? (activeConditionsByClaim[claimId] || [])
    : [];

  var sheetConditions = splitList_(pick_(raw, ['Conditions', 'Active_Conditions', 'Active Conditions']));

  var activeConditions = hydratedConditions.length
    ? hydratedConditions
    : sheetConditions;

  return {
    claimId: pick_(raw, ['Claim_ID', 'Claim ID', 'claimId']),
    jobNumber: pick_(raw, ['Job Number', 'Job_Number']),
    displayName: pick_(raw, ['Display_Name', 'Display Name', 'Claim Name', 'Customer Name', 'Customer_Name']),
    customerName: pick_(raw, ['Customer Name', 'Customer_Name']),
    claimNumber: pick_(raw, ['Claim Number', 'Claim_Number']),
    address: pick_(raw, ['Address', 'Loss Address', 'Property Address']),
    lifecycleState: pick_(raw, ['Lifecycle State', 'Lifecycle_State']),
    ownershipArea: pick_(raw, ['Ownership Area', 'Ownership_Area']),
    primaryOwner: pick_(raw, ['Primary Owner', 'Primary_Owner', 'Owner']),
    healthLevel: pick_(raw, ['Health Status', 'Health_Level', 'Health Level']),
    healthReason: pick_(raw, ['Health Reason', 'Health_Reason']),
    activeConditions: activeConditions,
    activeAlerts: splitList_(pick_(raw, ['Alerts', 'Active_Alerts', 'Active Alerts'])),
    financialTrackSummary: null,
    lastMeaningfulActivityDate: pick_(raw, ['Last Activity Date', 'Last_Meaningful_Activity_Date', 'Last Meaningful Activity Date']),
    daysSinceMeaningfulActivity: pick_(raw, ['Days_Since_Meaningful_Activity', 'Days Since Meaningful Activity']),
    totalClaimAgeDays: pick_(raw, ['Total_Claim_Age_Days', 'Total Claim Age Days']),
    nextAction: pick_(raw, ['Next_Action', 'Next Action']),
    nextScheduledEvent: null,
    missingLinks: [],
    timelinePreview: [],
    operationalTags: buildOperationalTags_(raw),
    createdDate: pick_(raw, ['Created Date', 'Created_Date']),
    lastUpdated: pick_(raw, ['Last Updated', 'Last_Updated'])
  };
}

function buildOperationalTags_(raw) {
  var tags = [];
  var lifecycleState = pick_(raw, ['Lifecycle State', 'Lifecycle_State']);
  var healthStatus = pick_(raw, ['Health Status', 'Health_Level', 'Health Level']);
  var conditions = splitList_(pick_(raw, ['Conditions', 'Active_Conditions', 'Active Conditions']));
  var alerts = splitList_(pick_(raw, ['Alerts', 'Active_Alerts', 'Active Alerts']));

  if (lifecycleState) tags.push(lifecycleState);
  if (healthStatus) tags.push(healthStatus);

  conditions.forEach(function(condition) {
    tags.push(condition);
  });

  alerts.forEach(function(alert) {
    tags.push(alert);
  });

  return tags;
}

function getActiveConditionsByClaim_() {
  try {
    var sheet = getConditionsSheet_();

    if (!sheet) {
      return {};
    }

    var values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return {};
    }

    var headers = values[0].map(function(header) {
      return String(header).trim();
    });

    var result = {};

    values.slice(1).forEach(function(row) {
      var raw = {};

      headers.forEach(function(header, index) {
        raw[header] = row[index];
      });

      var claimId = pick_(raw, [
        'Claim_ID',
        'Claim ID',
        'claimId',
        'ClaimId'
      ]);

      var conditionName = pick_(raw, [
        'Condition_Name',
        'Condition Name',
        'Condition_Type',
        'Condition Type',
        'conditionName'
      ]);

      var status = String(pick_(raw, [
        'Status',
        'Condition_Status',
        'Condition Status'
      ]) || '').toLowerCase();

      if (!claimId || !conditionName) {
        return;
      }

      if (status && status !== 'active' && status !== 'open') {
        return;
      }

      if (!result[claimId]) {
        result[claimId] = [];
      }

      if (result[claimId].indexOf(conditionName) === -1) {
        result[claimId].push(conditionName);
      }
    });

    return result;
  } catch (error) {
    Logger.log('Condition hydration failed: ' + error);
    return {};
  }
}

function getConditionsSheet_() {
  var spreadsheetId = typeof CLAIMS_DATABASE_SPREADSHEET_ID !== 'undefined'
    ? CLAIMS_DATABASE_SPREADSHEET_ID
    : CLAIM_FOUNDATION_SPREADSHEET_ID;

  var ss = SpreadsheetApp.openById(spreadsheetId);

  var possibleSheetNames = [];

  if (typeof CLAIM_SHEET_NAMES !== 'undefined' && CLAIM_SHEET_NAMES.conditions) {
    possibleSheetNames.push(CLAIM_SHEET_NAMES.conditions);
  }

  possibleSheetNames.push('Conditions');
  possibleSheetNames.push('Claim_Conditions');
  possibleSheetNames.push('Claim Conditions');

  for (var i = 0; i < possibleSheetNames.length; i++) {
    var sheet = ss.getSheetByName(possibleSheetNames[i]);

    if (sheet) {
      return sheet;
    }
  }

  return null;
}
function testClaimsQueryConditionHydration() {
  var conditionsByClaim = getActiveConditionsByClaim_();
  var claimIds = Object.keys(conditionsByClaim).filter(function(claimId) {
    return conditionsByClaim[claimId] && conditionsByClaim[claimId].length;
  });

  var result = {
    claimCountWithHydratedConditions: claimIds.length,
    totalHydratedConditions: claimIds.reduce(function(total, claimId) {
      return total + conditionsByClaim[claimId].length;
    }, 0),
    sampleClaims: claimIds.slice(0, 10).map(function(claimId) {
      return {
        claimId: claimId,
        conditions: conditionsByClaim[claimId]
      };
    })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function pick_(obj, possibleKeys) {
  for (var i = 0; i < possibleKeys.length; i++) {
    if (obj[possibleKeys[i]] !== undefined && obj[possibleKeys[i]] !== '') {
      return obj[possibleKeys[i]];
    }
  }
  return '';
}

function splitList_(value) {
  if (!value) return [];

  return String(value)
    .split(',')
    .map(function(item) {
      return item.trim();
    })
    .filter(Boolean);
}
function testClaimsQueryHeaders() {
  var sheet = getClaimsDatabaseSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  Logger.log(JSON.stringify({
    spreadsheetName: sheet.getParent().getName(),
    sheetName: sheet.getName(),
    lastColumn: sheet.getLastColumn(),
    headers: headers
  }, null, 2));

  return headers;
}

function testClaimsQueryIncludeTerminal() {
  var activeOnlyClaims = getAllClaimSummaries();
  var allClaims = getAllClaimSummaries({ includeTerminal: true });

  var terminalClaims = allClaims.filter(function(claim) {
    return claim.lifecycleState === 'Operationally Complete' ||
           claim.lifecycleState === 'Not Sold';
  });

  var result = {
    activeOnlyCount: activeOnlyClaims.length,
    allClaimCount: allClaims.length,
    terminalClaimCount: terminalClaims.length,
    sampleTerminalClaims: terminalClaims.slice(0, 5).map(function(claim) {
      return {
        claimId: claim.claimId,
        displayName: claim.displayName,
        lifecycleState: claim.lifecycleState
      };
    })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

var ClaimsQueryService = {
  getAllClaimSummaries: getAllClaimSummaries,
  testClaimsQueryHeaders: testClaimsQueryHeaders,
  testClaimsQueryIncludeTerminal: testClaimsQueryIncludeTerminal,
  testClaimsQueryConditionHydration: testClaimsQueryConditionHydration
};