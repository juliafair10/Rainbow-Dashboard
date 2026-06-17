function getAllClaimSummaries(options) {
  options = options || {};

  var sheet = getClaimsDatabaseSheet_();
  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  var headers = values[0];
  var rows = values.slice(1);

  return rows
    .map(function(row) {
      return normalizeClaimRow_(headers, row);
    })
    .filter(function(claim) {
      return claim.claimId;
    })
    .filter(function(claim) {
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

function normalizeClaimRow_(headers, row) {
  var raw = {};

  headers.forEach(function(header, index) {
    raw[String(header).trim()] = row[index];
  });

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
    activeConditions: splitList_(pick_(raw, ['Conditions', 'Active_Conditions', 'Active Conditions'])),
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

var ClaimsQueryService = {
  getAllClaimSummaries: getAllClaimSummaries,
  testClaimsQueryHeaders: testClaimsQueryHeaders
};