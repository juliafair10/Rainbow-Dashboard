

function getClaimsForLens(lensId, options) {
  lensId = lensId || 'all';
  options = options || {};

  if (lensId === 'closed' || normalizeClaimsRouteValue_(options.claimId || options.claim)) {
    options = Object.assign({}, options, {
      includeTerminal: true
    });
  }

  var claims = ClaimsQueryService.getAllClaimSummaries(options);
  var lensClaims;

  switch (lensId) {
    case 'needsAttention':
      lensClaims = filterNeedsAttention_(claims);
      break;

    case 'waitingOnInsurance':
      lensClaims = filterWaitingOnInsurance_(claims);
      break;

    case 'missingEoj':
      lensClaims = filterMissingEoj_(claims);
      break;

    case 'paidMonitoring':
      lensClaims = filterPaidMonitoring_(claims);
      break;

    case 'closed':
      lensClaims = filterClosedClaims_(claims);
      break;

    case 'all':
    default:
      lensClaims = claims;
      break;
  }

  return filterClaimsByWorkspaceRoute_(lensClaims, options);
}

function getClaimsLensCounts(options) {
  options = Object.assign({}, options || {}, {
    claimId: '',
    claim: '',
    includeTerminal: true
  });

  var allClaims = ClaimsQueryService.getAllClaimSummaries(options);
  var routeFilteredClaims = filterClaimsByWorkspaceRoute_(allClaims, options);
  var activeClaims = routeFilteredClaims.filter(function(claim) {
    return !isClosedClaim_(claim);
  });

  return {
    all: activeClaims.length,
    needsAttention: filterNeedsAttention_(activeClaims).length,
    waitingOnInsurance: filterWaitingOnInsurance_(activeClaims).length,
    missingEoj: filterMissingEoj_(activeClaims).length,
    paidMonitoring: filterPaidMonitoring_(activeClaims).length,
    closed: filterClosedClaims_(routeFilteredClaims).length
  };
}

function filterClaimsByWorkspaceRoute_(claims, options) {
  options = options || {};

  var ownershipArea = normalizeClaimsRouteComparable_(options.ownershipArea || options.ownership);
  var conditionType = normalizeClaimsRouteComparable_(options.conditionType || options.condition);
  var claimId = normalizeClaimsRouteComparable_(options.claimId || options.claim);

  if (!ownershipArea && !conditionType && !claimId) {
    return claims;
  }

  return claims.filter(function(claim) {
    if (claimId && !claimMatchesRouteClaimId_(claim, claimId)) {
      return false;
    }

    if (ownershipArea && normalizeClaimsRouteComparable_(claim.ownershipArea) !== ownershipArea) {
      return false;
    }

    if (conditionType && !claimHasRouteCondition_(claim, conditionType)) {
      return false;
    }

    return true;
  });
}

function claimMatchesRouteClaimId_(claim, normalizedClaimId) {
  return [
    claim.claimId,
    claim.jobNumber,
    claim.claimNumber
  ].some(function(value) {
    return normalizeClaimsRouteComparable_(value) === normalizedClaimId;
  });
}

function claimHasRouteCondition_(claim, normalizedConditionType) {
  return (claim.activeConditions || []).some(function(condition) {
    return normalizeClaimsRouteComparable_(getClaimsRouteConditionValue_(condition)) === normalizedConditionType;
  });
}

function getClaimsRouteConditionValue_(condition) {
  if (!condition || typeof condition !== 'object') {
    return condition;
  }

  return condition.Condition_Type ||
    condition.Condition_Name ||
    condition.conditionType ||
    condition.conditionName ||
    condition.Name ||
    '';
}

function normalizeClaimsRouteComparable_(value) {
  return normalizeClaimsRouteValue_(value).toLowerCase();
}

function normalizeClaimsRouteValue_(value) {
  if (typeof normalizeString === 'function') {
    return normalizeString(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

function filterNeedsAttention_(claims) {
  return claims.filter(function(claim) {
    return claimNeedsAttention_(claim);
  });
}

function claimNeedsAttention_(claim) {
  var health = String(claim.healthLevel || '').toLowerCase();
  var healthReason = String(claim.healthReason || '').toLowerCase();
  var conditions = claim.activeConditions || [];
  var alerts = claim.activeAlerts || [];

  if (health === 'attention soon' ||
      health === 'at risk' ||
      health === 'escalated' ||
      health === 'critical') {
    return true;
  }

  if (containsAny_(healthReason, [
    'follow-up date has passed',
    'scheduled follow-up date has passed',
    'overdue',
    'missed cadence',
    'stale',
    'no future visit',
    'no scheduled visit',
    'past due'
  ])) {
    return true;
  }

  if (containsAnyInList_(conditions, [
    'carrier revision requested',
    'revision active',
    'waiting on payment',
    'monitoring active'
  ])) {
    return true;
  }

  if (containsAnyInList_(alerts, [
    'claim review needed',
    'missing eoj',
    'missing required',
    'overdue',
    'past due'
  ])) {
    return true;
  }

  if (alerts.some(function(alert) {
    var severity = getClaimsLensAlertSeverity_(alert);

    return severity === 'critical' || severity === 'high';
  })) {
    return true;
  }

  return false;
}

function filterWaitingOnInsurance_(claims) {
  return claims.filter(function(claim) {
    return (claim.activeConditions || []).some(function(condition) {
      var value = String(getClaimsRouteConditionValue_(condition)).toLowerCase();

      return value.indexOf('coverage pending') !== -1 ||
             value.indexOf('estimate under review') !== -1 ||
             value.indexOf('supplement under review') !== -1 ||
             value.indexOf('waiting on payment') !== -1;
    });
  });
}

function filterMissingEoj_(claims) {
  return claims.filter(function(claim) {
    return containsAnyInList_(claim.activeAlerts || [], ['missing eoj']) ||
      containsAnyInList_(claim.missingLinks || [], ['eoj']);
  });
}

function filterPaidMonitoring_(claims) {
  return claims.filter(function(claim) {
    return (claim.activeConditions || []).some(function(condition) {
      var value = String(getClaimsRouteConditionValue_(condition)).toLowerCase();

      return value.indexOf('monitoring active') !== -1 ||
             value.indexOf('monitoring') !== -1;
    });
  });
}

function filterClosedClaims_(claims) {
  return claims.filter(function(claim) {
    return isClosedClaim_(claim);
  });
}

function isClosedClaim_(claim) {
  var lifecycle = String(claim && claim.lifecycleState || '').toLowerCase();

  return lifecycle === 'operationally complete' ||
         lifecycle === 'not sold';
}

function containsAny_(value, phrases) {
  value = String(value || '').toLowerCase();

  return phrases.some(function(phrase) {
    return value.indexOf(String(phrase).toLowerCase()) !== -1;
  });
}

function containsAnyInList_(items, phrases) {
  items = items || [];

  return items.some(function(item) {
    return containsAny_(getClaimsLensSignalText_(item), phrases);
  });
}

function getClaimsLensSignalText_(item) {
  if (!item || typeof item !== 'object') {
    return item || '';
  }

  return [
    item.alertName,
    item.alertType,
    item.Alert_Name,
    item.Alert_Type,
    item.name,
    item.Name,
    item.Condition_Type,
    item.Condition_Name,
    item.conditionType,
    item.conditionName,
    item.linkType,
    item.Link_Type,
    item.missingLinkType,
    item.Missing_Link_Type,
    item.reason,
    item.Reason,
    item.message,
    item.Message
  ].filter(Boolean).join(' ');
}

function getClaimsLensAlertSeverity_(alert) {
  if (!alert || typeof alert !== 'object') {
    return '';
  }

  return String(alert.severity || alert.Severity || alert.priority || alert.Priority || '').toLowerCase();
}

function testClaimsLensSourceSignals() {
  var claims = ClaimsQueryService.getAllClaimSummaries({});
  var summary = {
    totalClaims: claims.length,
    healthLevels: {},
    healthReasons: {},
    nonEmptyConditions: 0,
    nonEmptyAlerts: 0,
    sampleClaims: []
  };

  claims.forEach(function(claim) {
    var healthLevel = claim.healthLevel || '(blank)';
    var healthReason = claim.healthReason || '(blank)';

    summary.healthLevels[healthLevel] = (summary.healthLevels[healthLevel] || 0) + 1;
    summary.healthReasons[healthReason] = (summary.healthReasons[healthReason] || 0) + 1;

    if ((claim.activeConditions || []).length > 0) {
      summary.nonEmptyConditions += 1;
    }

    if ((claim.activeAlerts || []).length > 0) {
      summary.nonEmptyAlerts += 1;
    }

    if (summary.sampleClaims.length < 10) {
      summary.sampleClaims.push({
        claimId: claim.claimId,
        displayName: claim.displayName,
        healthLevel: claim.healthLevel,
        healthReason: claim.healthReason,
        activeConditions: claim.activeConditions,
        activeAlerts: claim.activeAlerts
      });
    }
  });

  Logger.log(JSON.stringify(summary, null, 2));

  return summary;
}

function testClaimsLensCounts() {
  var lensIds = [
    'all',
    'needsAttention',
    'waitingOnInsurance',
    'missingEoj',
    'paidMonitoring',
    'closed'
  ];

  var summary = {};

  lensIds.forEach(function(lensId) {
    var claims = getClaimsForLens(lensId, {});

    summary[lensId] = {
      count: claims.length,
      sampleClaimIds: claims.slice(0, 10).map(function(claim) {
        return claim.claimId;
      })
    };
  });

  Logger.log(JSON.stringify(summary, null, 2));

  return summary;
}

var ClaimsLensService = {
  getClaimsForLens: getClaimsForLens,
  getClaimsLensCounts: getClaimsLensCounts,
  testClaimsLensSourceSignals: testClaimsLensSourceSignals,
  testClaimsLensCounts: testClaimsLensCounts
};
