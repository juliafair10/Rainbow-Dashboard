

function getClaimsForLens(lensId, options) {
  lensId = lensId || 'all';
  options = options || {};

  var claims = ClaimsQueryService.getAllClaimSummaries(options);

  switch (lensId) {
    case 'needsAttention':
      return filterNeedsAttention_(claims);

    case 'waitingOnInsurance':
      return filterWaitingOnInsurance_(claims);

    case 'missingEoj':
      return filterMissingEoj_(claims);

    case 'paidMonitoring':
      return filterPaidMonitoring_(claims);

    case 'closed':
      return filterClosedClaims_(claims);

    case 'all':
    default:
      return claims;
  }
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
    'requires attention',
    'needs attention',
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

  return false;
}

function filterWaitingOnInsurance_(claims) {
  return claims.filter(function(claim) {
    return (claim.activeConditions || []).some(function(condition) {
      var value = String(condition).toLowerCase();

      return value.indexOf('coverage pending') !== -1 ||
             value.indexOf('estimate under review') !== -1 ||
             value.indexOf('supplement under review') !== -1 ||
             value.indexOf('waiting on payment') !== -1;
    });
  });
}

function filterMissingEoj_(claims) {
  return claims.filter(function(claim) {
    return (claim.activeAlerts || []).some(function(alert) {
      return String(alert).toLowerCase().indexOf('missing eoj') !== -1;
    });
  });
}

function filterPaidMonitoring_(claims) {
  return claims.filter(function(claim) {
    return (claim.activeConditions || []).some(function(condition) {
      var value = String(condition).toLowerCase();

      return value.indexOf('monitoring active') !== -1 ||
             value.indexOf('monitoring') !== -1;
    });
  });
}

function filterClosedClaims_(claims) {
  return claims.filter(function(claim) {
    var lifecycle = String(claim.lifecycleState || '').toLowerCase();

    return lifecycle === 'operationally complete' ||
           lifecycle === 'not sold';
  });
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
    return containsAny_(item, phrases);
  });
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

var ClaimsLensService = {
  getClaimsForLens: getClaimsForLens,
  testClaimsLensSourceSignals: testClaimsLensSourceSignals
};