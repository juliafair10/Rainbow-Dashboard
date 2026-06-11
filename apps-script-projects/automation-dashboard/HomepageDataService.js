
const HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID = '1oIakFjdJSigre_abJ-iiM74Trr1nfoC4_rjFi0lWrts';

const HOMEPAGE_CLAIM_SHEET_NAMES = {
  claims: 'Claims',
  conditions: 'Claim_Conditions',
  alerts: 'Claim_Alerts'
};

function getHomepageClaimSummaryData() {
  const claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims);
  const conditions = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.conditions);
  const alerts = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.alerts);

  const activeClaims = claims.filter(function(claim) {
    return isHomepageActiveClaim_(claim);
  });

  const activeClaimIds = activeClaims.reduce(function(map, claim) {
    if (claim.Claim_ID) {
      map[claim.Claim_ID] = true;
    }
    return map;
  }, {});

  const activeConditions = conditions.filter(function(condition) {
    return activeClaimIds[condition.Claim_ID] && isHomepageOpenStatus_(condition.Condition_Status);
  });

  const activeAlerts = alerts.filter(function(alert) {
    return activeClaimIds[alert.Claim_ID] && isHomepageOpenStatus_(alert.Alert_Status);
  });

  return {
    generatedAt: new Date().toISOString(),
    activeClaimCount: activeClaims.length,
    openConditionCount: activeConditions.length,
    openAlertCount: activeAlerts.length,
    kpis: {
      needsAttention: countHomepageClaimsByHealth_(activeClaims, ['Attention Soon', 'At Risk', 'Escalated', 'Critical']),
      atRisk: countHomepageClaimsByHealth_(activeClaims, ['At Risk']),
      escalated: countHomepageClaimsByHealth_(activeClaims, ['Escalated']),
      critical: countHomepageClaimsByHealth_(activeClaims, ['Critical']),
      waitingOnInsurance: countHomepageClaimsWithAnyCondition_(activeConditions, [
        'Coverage Pending',
        'Estimate Under Review',
        'Supplement Under Review',
        'Waiting on Payment'
      ]),
      monitoringActive: countHomepageClaimsWithAnyCondition_(activeConditions, ['Monitoring Active'])
    }
  };
}

function getHomepageKpis() {
  return getHomepageClaimSummaryData().kpis;
}

function getHomepageSheetRows_(sheetName) {
  const ss = SpreadsheetApp.openById(HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing homepage source sheet: ' + sheetName);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(1).filter(function(row) {
    return row.some(function(value) {
      return value !== '' && value !== null;
    });
  }).map(function(row) {
    return headers.reduce(function(record, header, index) {
      if (header) {
        record[header] = row[index];
      }
      return record;
    }, {});
  });
}

function isHomepageActiveClaim_(claim) {
  if (!claim || !claim.Claim_ID) {
    return false;
  }

  if (String(claim.Is_Active).toLowerCase() === 'false') {
    return false;
  }

  if (String(claim.Is_Not_Sold).toLowerCase() === 'true') {
    return false;
  }

  if (String(claim.Is_Operationally_Complete).toLowerCase() === 'true') {
    return false;
  }

  if (claim.Lifecycle_State === 'Not Sold' || claim.Lifecycle_State === 'Operationally Complete') {
    return false;
  }

  return true;
}

function isHomepageOpenStatus_(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized !== 'closed' && normalized !== 'resolved' && normalized !== 'complete' && normalized !== 'completed';
}

function countHomepageClaimsByHealth_(claims, healthLevels) {
  const levelMap = (healthLevels || []).reduce(function(map, level) {
    map[level] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  claims.forEach(function(claim) {
    if (claim.Claim_ID && levelMap[claim.Operational_Health || 'Healthy']) {
      countedClaimIds[claim.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}

function countHomepageClaimsWithAnyCondition_(conditions, conditionTypes) {
  const typeMap = (conditionTypes || []).reduce(function(map, conditionType) {
    map[conditionType] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  conditions.forEach(function(condition) {
    if (condition.Claim_ID && typeMap[condition.Condition_Type]) {
      countedClaimIds[condition.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}
