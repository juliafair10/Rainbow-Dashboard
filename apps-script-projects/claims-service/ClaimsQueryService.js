var CLAIM_SUMMARY_CACHE_SECONDS = 60;
function getAllClaimSummaries(options) {
  options = options || {};

  var cacheKey = 'claimSummaries:' + (options.includeTerminal === true ? 'all' : 'active');
  var cache = CacheService.getScriptCache();

  try {
    var cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  var sheet = getClaimsDatabaseSheet_();
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  var headers = values[0];
  var rows = values.slice(1);
  var activeConditionsByClaim = getActiveConditionsByClaim_();
  var activeAlertsByClaim = getActiveAlertsByClaim_();

  var includeTerminal = options.includeTerminal === true;

  var result = rows
    .map(function(row) {
      return normalizeClaimRow_(headers, row, activeConditionsByClaim, activeAlertsByClaim);
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

  try {
    cache.put(cacheKey, JSON.stringify(result), CLAIM_SUMMARY_CACHE_SECONDS);
  } catch (e) {}

  return result;
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

function normalizeClaimRow_(headers, row, activeConditionsByClaim, activeAlertsByClaim) {
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

  var hydratedAlerts = activeAlertsByClaim && claimId
    ? (activeAlertsByClaim[claimId] || [])
    : [];

  var sheetAlerts = splitList_(pick_(raw, ['Alerts', 'Active_Alerts', 'Active Alerts']));

  var activeAlerts = hydratedAlerts.length
    ? hydratedAlerts
    : sheetAlerts;

  var missingLinks = splitList_(pick_(raw, [
    'Missing_Links',
    'Missing Links',
    'Missing_Operational_Links',
    'Missing Operational Links',
    'Missing_External_Links',
    'Missing External Links'
  ]));

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
    activeAlerts: activeAlerts,
    financialTrackSummary: null,
    lastMeaningfulActivityAt: pick_(raw, ['Last_Meaningful_Activity_At', 'Last Meaningful Activity At']),
    lastMeaningfulActivityDate: pick_(raw, ['Last_Meaningful_Activity_At', 'Last Meaningful Activity At', 'Last Activity Date', 'Last_Meaningful_Activity_Date', 'Last Meaningful Activity Date']),
    lastActivityDate: pick_(raw, ['Last_Activity_Date', 'Last Activity Date']),
    daysSinceMeaningfulActivity: pick_(raw, ['Days_Since_Meaningful_Activity', 'Days Since Meaningful Activity']),
    totalClaimAgeDays: pick_(raw, ['Total_Claim_Age_Days', 'Total Claim Age Days']),
    nextAction: pick_(raw, ['Next_Action', 'Next Action']),
    nextScheduledEvent: null,
    missingLinks: missingLinks,
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
function getActiveAlertsByClaim_() {
  try {
    var sheet = getAlertsSheet_();

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

      var alertName = pick_(raw, [
        'Alert_Name',
        'Alert Name',
        'Alert_Type',
        'Alert Type',
        'alertName',
        'Name',
        'Title'
      ]);

      var status = String(pick_(raw, [
        'Status',
        'Alert_Status',
        'Alert Status'
      ]) || '').toLowerCase();

      if (!claimId || !alertName) {
        return;
      }

      if (status && status !== 'active' && status !== 'open') {
        return;
      }

      if (!result[claimId]) {
        result[claimId] = [];
      }

      result[claimId].push({
        alertType: pick_(raw, [
          'Alert_Type',
          'Alert Type',
          'Type',
          'alertType'
        ]) || alertName,
        alertName: alertName,
        severity: pick_(raw, [
          'Severity',
          'Priority',
          'severity'
        ]) || 'Medium',
        source: pick_(raw, [
          'Source',
          'source'
        ]) || 'Claim Alerts',
        reason: pick_(raw, [
          'Reason',
          'Description',
          'Message',
          'reason'
        ]),
        nextStep: pick_(raw, [
          'Next_Step',
          'Next Step',
          'Recommended_Action',
          'Recommended Action',
          'nextStep'
        ])
      });
    });

    return result;
  } catch (error) {
    Logger.log('Alert hydration failed: ' + error);
    return {};
  }
}

function getAlertsSheet_() {
  var spreadsheetId = typeof CLAIMS_DATABASE_SPREADSHEET_ID !== 'undefined'
    ? CLAIMS_DATABASE_SPREADSHEET_ID
    : CLAIM_FOUNDATION_SPREADSHEET_ID;

  var ss = SpreadsheetApp.openById(spreadsheetId);

  var possibleSheetNames = [];

  if (typeof CLAIM_SHEET_NAMES !== 'undefined' && CLAIM_SHEET_NAMES.alerts) {
    possibleSheetNames.push(CLAIM_SHEET_NAMES.alerts);
  }

  possibleSheetNames.push('Alerts');
  possibleSheetNames.push('Claim_Alerts');
  possibleSheetNames.push('Claim Alerts');
  possibleSheetNames.push('Operational_Alerts');
  possibleSheetNames.push('Operational Alerts');

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

function testClaimsQueryAlertHydration() {
  var alertsByClaim = getActiveAlertsByClaim_();
  var claimIds = Object.keys(alertsByClaim).filter(function(claimId) {
    return alertsByClaim[claimId] && alertsByClaim[claimId].length;
  });

  var result = {
    claimCountWithHydratedAlerts: claimIds.length,
    totalHydratedAlerts: claimIds.reduce(function(total, claimId) {
      return total + alertsByClaim[claimId].length;
    }, 0),
    sampleClaims: claimIds.slice(0, 10).map(function(claimId) {
      return {
        claimId: claimId,
        alerts: alertsByClaim[claimId]
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

function testClaimsQueryRafiLastActivity() {
  var sheet = getClaimsDatabaseSheet_();
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  var targetRow = null;
  var targetRaw = {};

  for (var i = 1; i < values.length; i++) {
    var raw = {};

    headers.forEach(function(header, index) {
      raw[header] = values[i][index];
    });

    if (raw.Claim_ID === 'CLM-26A-0034-WTR' || raw.Job_Number === '26A-0034-WTR') {
      targetRow = values[i];
      targetRaw = raw;
      break;
    }
  }

  var claims = getAllClaimSummaries({ includeTerminal: true });
  var match = claims.filter(function(claim) {
    return claim.claimId === 'CLM-26A-0034-WTR' || claim.jobNumber === '26A-0034-WTR';
  })[0] || null;

  var meaningfulHeaders = headers.filter(function(header) {
    return header.toLowerCase().indexOf('meaningful') !== -1 ||
      header.toLowerCase().indexOf('activity') !== -1 ||
      header.toLowerCase().indexOf('updated') !== -1;
  });

  var rawMeaningfulValues = {};
  meaningfulHeaders.forEach(function(header) {
    rawMeaningfulValues[header] = targetRaw[header];
  });

  var result = {
    found: !!match,
    spreadsheetName: sheet.getParent().getName(),
    sheetName: sheet.getName(),
    claimId: match ? match.claimId : '',
    jobNumber: match ? match.jobNumber : '',
    displayName: match ? match.displayName : '',
    normalized: {
      lastMeaningfulActivityAt: match ? match.lastMeaningfulActivityAt : '',
      lastMeaningfulActivityDate: match ? match.lastMeaningfulActivityDate : '',
      lastActivityDate: match ? match.lastActivityDate : '',
      lastUpdated: match ? match.lastUpdated : ''
    },
    rawMeaningfulValues: rawMeaningfulValues,
    matchingHeaders: meaningfulHeaders
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testMissingFromOpenJobsClaimDetails() {
  var missingClaimIds = [
    'CLM-26N-0128-CUS',
    'CLM-26N-0096-WTR',
    'CLM-26N-0099-WTR',
    'CLM-26N-0100-WTR',
    'CLM-26A-0044-WTR',
    'CLM-26N-0115-WTR',
    'CLM-26N-0121-WTR',
    'CLM-26N-0013-WTR',
    'CLM-26A-0046-CUS'
  ];

  var lookup = {};
  missingClaimIds.forEach(function(claimId) {
    lookup[claimId] = true;
  });

  var claims = getAllClaimSummaries({ includeTerminal: true });
  var details = claims.filter(function(claim) {
    return lookup[claim.claimId];
  }).map(function(claim) {
    return {
      claimId: claim.claimId,
      jobNumber: claim.jobNumber,
      customerName: claim.customerName || claim.displayName,
      claimNumber: claim.claimNumber,
      lifecycleState: claim.lifecycleState,
      ownershipArea: claim.ownershipArea,
      healthLevel: claim.healthLevel,
      healthReason: claim.healthReason,
      lastActivityDate: claim.lastActivityDate,
      lastMeaningfulActivityAt: claim.lastMeaningfulActivityAt || claim.lastMeaningfulActivityDate,
      activeConditions: claim.activeConditions || [],
      activeAlerts: claim.activeAlerts || [],
      nextAction: claim.nextAction || '',
      operationalTags: claim.operationalTags || []
    };
  });

  var foundLookup = {};
  details.forEach(function(detail) {
    foundLookup[detail.claimId] = true;
  });

  var missingFromClaims = missingClaimIds.filter(function(claimId) {
    return !foundLookup[claimId];
  });

  var result = {
    requestedCount: missingClaimIds.length,
    foundCount: details.length,
    missingFromClaims: missingFromClaims,
    claims: details
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
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
  testClaimsQueryConditionHydration: testClaimsQueryConditionHydration,
  testClaimsQueryAlertHydration: testClaimsQueryAlertHydration,
  testClaimsQueryRafiLastActivity: testClaimsQueryRafiLastActivity,
  testMissingFromOpenJobsClaimDetails: testMissingFromOpenJobsClaimDetails
};