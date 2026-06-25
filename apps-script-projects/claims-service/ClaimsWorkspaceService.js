

function getClaimsList(lensId, options) {
  options = normalizeClaimsWorkspaceOptions_(lensId, options);
  lensId = options.lensId || 'all';

  var claims = ClaimsLensService.getClaimsForLens(lensId, options);

  claims = claims.map(function(claim) {
    return enrichClaimWorkspaceSummary_(claim);
  });

  var stream = ClaimsStreamService.buildClaimsStream(claims, lensId, options);

  return {
    lensId: lensId,
    lensName: getClaimsLensName_(lensId),
    generatedAt: new Date().toISOString(),
    totalCount: claims.length,
    groups: stream.groups,
    filtersApplied: buildClaimsWorkspaceFiltersApplied_(lensId, options),
    routeContext: buildClaimsWorkspaceRouteContext_(options),
    sortApplied: stream.sortApplied,
    warnings: stream.warnings
  };
}

function getClaimsWorkspace(options) {
  options = normalizeClaimsWorkspaceOptions_(options && (options.lensId || options.lens), options);
  var claimsList = getClaimsList(options.lensId || 'all', options);
  var lensCounts = ClaimsLensService.getClaimsLensCounts
    ? ClaimsLensService.getClaimsLensCounts(options)
    : {};

  return {
    generatedAt: new Date().toISOString(),
    defaultLensId: 'all',
    activeLensId: options.lensId || 'all',
    routeContext: buildClaimsWorkspaceRouteContext_(options),
    availableLenses: buildClaimsWorkspaceAvailableLenses_(lensCounts),
    lensCounts: lensCounts,
    queueIntelligence: buildClaimsWorkspaceQueueIntelligence_(claimsList, lensCounts, options),
    claimsList: claimsList
  };
}

function buildClaimsWorkspaceAvailableLenses_(lensCounts) {
  var lensIds = [
    'all',
    'needsAttention',
    'waitingOnInsurance',
    'missingEoj',
    'paidMonitoring',
    'closed'
  ];

  return lensIds.map(function(lensId) {
    return {
      lensId: lensId,
      lensName: getClaimsLensName_(lensId),
      count: lensCounts && lensCounts[lensId] !== undefined ? lensCounts[lensId] : null
    };
  });
}

function buildClaimsWorkspaceQueueIntelligence_(claimsList, lensCounts, options) {
  var claims = getClaimsWorkspaceClaimsFromList_(claimsList);
  var totalOperationalAlerts = 0;
  var missingLinkCount = 0;

  claims.forEach(function(claim) {
    var operationalAlerts = claim.operationalAlerts || [];
    var alertCount = Number(claim.alertCount);

    totalOperationalAlerts += isNaN(alertCount) ? operationalAlerts.length : alertCount;

    var missingLinkAlerts = operationalAlerts.filter(function(alert) {
      var alertType = String(alert.alertType || '').toLowerCase();
      var source = String(alert.source || '').toLowerCase();

      return alertType.indexOf('missing link') !== -1 || source === 'missinglinks';
    }).length;

    missingLinkCount += missingLinkAlerts || (claim.missingLinks || []).length;
  });

  return {
    lensId: claimsList.lensId,
    lensName: claimsList.lensName,
    visibleClaimCount: claims.length,
    totalClaimsNeedingAttention: lensCounts && lensCounts.needsAttention !== undefined
      ? lensCounts.needsAttention
      : 0,
    totalOperationalAlerts: totalOperationalAlerts,
    missingLinkCount: missingLinkCount,
    stalestClaim: getClaimsWorkspaceStalestClaim_(claims),
    viewLogic: buildClaimsWorkspaceViewLogic_(claimsList, options)
  };
}

function getClaimsWorkspaceClaimsFromList_(claimsList) {
  var claims = [];

  (claimsList.groups || []).forEach(function(group) {
    claims = claims.concat(group.claims || []);
  });

  return claims;
}

function getClaimsWorkspaceStalestClaim_(claims) {
  var stalestClaim = null;
  var highestAge = -1;

  claims.forEach(function(claim) {
    var age = getClaimsWorkspaceActivityAge_(claim);

    if (age > highestAge) {
      highestAge = age;
      stalestClaim = claim;
    }
  });

  if (!stalestClaim) {
    return null;
  }

  return {
    claimId: stalestClaim.claimId || '',
    displayName: stalestClaim.displayName || stalestClaim.claimId || '',
    lastMeaningfulActivityDate: stalestClaim.lastMeaningfulActivityDate || '',
    daysSinceMeaningfulActivity: highestAge >= 0 ? highestAge : ''
  };
}

function getClaimsWorkspaceActivityAge_(claim) {
  var explicitAge = Number(claim.daysSinceMeaningfulActivity);

  if (!isNaN(explicitAge)) {
    return explicitAge;
  }

  var activityDate = claim.lastMeaningfulActivityDate ||
    claim.lastMeaningfulActivityAt ||
    '';

  if (!activityDate) {
    return -1;
  }

  // Delegate to the canonical days-since-activity calculator in ClaimFoundationService.
  // buildFoundationDaysSinceActivity_ uses the same date arithmetic and is the
  // authoritative implementation for this calculation.
  if (typeof buildFoundationDaysSinceActivity_ === 'function') {
    var days = buildFoundationDaysSinceActivity_(activityDate);
    // buildFoundationDaysSinceActivity_ returns 0 for unparseable dates;
    // distinguish "genuinely 0 days" from "could not parse" by re-checking.
    var parsed = new Date(activityDate);
    if (isNaN(parsed.getTime())) {
      return -1;
    }
    return days;
  }

  // Fallback: inline date arithmetic in case ClaimFoundationService is not loaded.
  var timestamp = new Date(activityDate).getTime();

  if (isNaN(timestamp)) {
    return -1;
  }

  return Math.max(0, Math.floor((new Date().getTime() - timestamp) / 86400000));
}

function buildClaimsWorkspaceViewLogic_(claimsList, options) {
  var filters = [];

  if (options.ownershipArea) {
    filters.push('Ownership: ' + options.ownershipArea);
  }

  if (options.conditionType) {
    filters.push('Condition: ' + options.conditionType);
  }

  if (options.compliance) {
    filters.push('Compliance: ' + options.compliance);
  }

  return {
    lensName: claimsList.lensName || getClaimsLensName_(options.lensId || 'all'),
    filters: filters,
    summary: filters.length
      ? claimsList.lensName + ' filtered by ' + filters.join(', ')
      : claimsList.lensName + ' lens'
  };
}
function enrichClaimWorkspaceSummary_(claim) {
  claim = Object.assign({}, claim || {});

  claim.openRequirements = buildClaimOpenRequirements_(claim);
  claim.nextAction = buildClaimNextAction_(claim);
  claim.attentionReason = buildClaimAttentionReason_(claim);
  claim.operationalAlerts = buildClaimOperationalAlerts_(claim);
  claim.alertCount = claim.operationalAlerts.length;
  claim.highestAlertSeverity = getHighestClaimAlertSeverity_(claim.operationalAlerts);

  return claim;
}

function buildClaimOpenRequirements_(claim) {
  var requirements = [];
  var conditions = claim.activeConditions || [];

  conditions.forEach(function(condition) {
    var name = getClaimsWorkspaceTestConditionType_(condition);

    if (name === 'Carrier Revision Requested') {
      requirements.push('Respond to carrier revision');
    }

    if (name === 'Revision Active') {
      requirements.push('Continue revision follow-up');
    }

    if (name === 'Coverage Pending') {
      requirements.push('Coverage determination pending');
    }

    if (name === 'Waiting on Payment') {
      requirements.push('Payment follow-up may be needed');
    }
  });

  return requirements.filter(function(item, index, array) {
    return array.indexOf(item) === index;
  });
}

function buildClaimNextAction_(claim) {
  if (claim.healthLevel === 'At Risk' || claim.healthLevel === 'Escalated') {
    return 'Review claim and restore operational cadence';
  }

  if ((claim.activeConditions || []).length) {
    return 'Review active claim conditions';
  }

  return '';
}

function buildClaimAttentionReason_(claim) {
  return claim.healthReason ||
    claim.operationalReason ||
    claim.staleReason ||
    '';
}

function buildClaimOperationalAlerts_(claim) {
  var alerts = [];

  (claim.activeAlerts || []).forEach(function(alert) {
    alerts.push(normalizeClaimOperationalAlert_(alert));
  });

  (claim.missingLinks || []).forEach(function(link) {
    var linkName = getClaimsWorkspaceAlertValue_(link, [
      'linkType',
      'Link_Type',
      'missingLinkType',
      'Missing_Link_Type',
      'name',
      'Name'
    ]) || String(link || 'Missing Link');

    alerts.push({
      alertType: 'Missing Link',
      alertName: 'Missing ' + linkName,
      severity: 'Medium',
      source: 'missingLinks',
      reason: 'Required operational link is missing.',
      nextStep: 'Add or verify the missing operational link.'
    });
  });

  return dedupeClaimOperationalAlerts_(alerts);
}

function normalizeClaimOperationalAlert_(alert) {
  if (!alert || typeof alert !== 'object') {
    return {
      alertType: 'Alert',
      alertName: String(alert || 'Operational Alert'),
      severity: 'Medium',
      source: 'activeAlerts',
      reason: '',
      nextStep: ''
    };
  }

  return {
    alertType: getClaimsWorkspaceAlertValue_(alert, [
      'alertType',
      'Alert_Type',
      'type',
      'Type'
    ]) || 'Operational Alert',
    alertName: getClaimsWorkspaceAlertValue_(alert, [
      'alertName',
      'Alert_Name',
      'name',
      'Name',
      'title',
      'Title'
    ]) || 'Operational Alert',
    severity: getClaimsWorkspaceAlertValue_(alert, [
      'severity',
      'Severity',
      'priority',
      'Priority'
    ]) || 'Medium',
    source: getClaimsWorkspaceAlertValue_(alert, [
      'source',
      'Source'
    ]) || 'activeAlerts',
    reason: getClaimsWorkspaceAlertValue_(alert, [
      'reason',
      'Reason',
      'description',
      'Description',
      'message',
      'Message'
    ]) || '',
    nextStep: getClaimsWorkspaceAlertValue_(alert, [
      'nextStep',
      'Next_Step',
      'recommendedAction',
      'Recommended_Action'
    ]) || ''
  };
}

function getClaimsWorkspaceAlertValue_(record, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (record[key] !== null && record[key] !== undefined && String(record[key]).trim() !== '') {
      return String(record[key]).trim();
    }
  }

  return '';
}

function dedupeClaimOperationalAlerts_(alerts) {
  var seen = {};

  return alerts.filter(function(alert) {
    var key = [
      alert.alertType || '',
      alert.alertName || '',
      alert.severity || ''
    ].join('|');

    if (seen[key]) {
      return false;
    }

    seen[key] = true;
    return true;
  });
}

function getHighestClaimAlertSeverity_(alerts) {
  // Delegate to the canonical severity resolver in ClaimFoundationService.
  // buildFoundationHighestSeverity_ uses the same severity ranking logic
  // and is the authoritative implementation for this calculation.
  if (typeof buildFoundationHighestSeverity_ === 'function') {
    return buildFoundationHighestSeverity_(alerts) || '';
  }

  // Fallback: inline ranking in case ClaimFoundationService is not loaded.
  var severityRank = {
    Critical: 5,
    High: 4,
    Medium: 3,
    Low: 2,
    Info: 1
  };

  var highestSeverity = '';
  var highestRank = 0;

  (alerts || []).forEach(function(alert) {
    var severity = alert.severity || 'Medium';
    var rank = severityRank[severity] || severityRank.Medium;

    if (rank > highestRank) {
      highestRank = rank;
      highestSeverity = severity;
    }
  });

  return highestSeverity;
}

function normalizeClaimsWorkspaceOptions_(lensId, options) {
  if (typeof lensId === 'object' && !options) {
    options = lensId;
    lensId = options && (options.lensId || options.lens || options.claimsLens);
  }

  options = Object.assign({}, options || {});

  options.lensId = normalizeClaimsWorkspaceValue_(
    lensId ||
    options.lensId ||
    options.lens ||
    options.claimsLens ||
    'all'
  ) || 'all';
  options.page = normalizeClaimsWorkspaceValue_(options.page || '');
  options.ownershipArea = normalizeClaimsWorkspaceValue_(options.ownershipArea || options.ownership || '');
  options.conditionType = normalizeClaimsWorkspaceValue_(options.conditionType || options.condition || '');
  options.claimId = normalizeClaimsWorkspaceValue_(options.claimId || options.claim || '');
  options.compliance = normalizeClaimsWorkspaceValue_(options.compliance || options.complianceType || '');
  options.routeSource = normalizeClaimsWorkspaceValue_(options.routeSource || '');

  return options;
}

function buildClaimsWorkspaceFiltersApplied_(lensId, options) {
  return {
    lensId: lensId || 'all',
    excludeTerminal: lensId !== 'closed' && !options.claimId,
    ownershipArea: options.ownershipArea || '',
    conditionType: options.conditionType || '',
    claimId: options.claimId || '',
    compliance: options.compliance || ''
  };
}

function buildClaimsWorkspaceRouteContext_(options) {
  return {
    page: options.page || '',
    routeSource: options.routeSource || '',
    lensId: options.lensId || 'all',
    ownershipArea: options.ownershipArea || '',
    conditionType: options.conditionType || '',
    claimId: options.claimId || '',
    compliance: options.compliance || '',
    hasRouteFilters: !!(
      options.ownershipArea ||
      options.conditionType ||
      options.claimId ||
      options.compliance ||
      (options.lensId && options.lensId !== 'all')
    )
  };
}

function normalizeClaimsWorkspaceValue_(value) {
  if (typeof normalizeString === 'function') {
    return normalizeString(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

function getClaimsLensName_(lensId) {
  var names = {
    all: 'All Claims',
    needsAttention: 'Needs Attention',
    waitingOnInsurance: 'Waiting on Insurance',
    missingEoj: 'Missing EOJ',
    paidMonitoring: 'Paid / Monitoring',
    closed: 'Closed'
  };

  return names[lensId] || 'All Claims';
}

function testClaimsWorkspaceAllClaims() {
  var result = getClaimsList('all', {});

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function testClaimsWorkspaceLensCounts() {
  var lensIds = [
    'all',
    'needsAttention',
    'waitingOnInsurance',
    'missingEoj',
    'paidMonitoring',
    'closed'
  ];

  var results = lensIds.map(function(lensId) {
    var list = getClaimsList(lensId, {});

    return {
      lensId: lensId,
      lensName: list.lensName,
      totalCount: list.totalCount,
      groupCount: list.groups.length,
      groups: list.groups.map(function(group) {
        return {
          groupId: group.groupId,
          groupLabel: group.groupLabel,
          count: group.claims.length
        };
      })
    };
  });

  Logger.log(JSON.stringify(results, null, 2));

  return results;
}

function testClaimsWorkspaceRouteFilters() {
  var claims = ClaimsLensService.getClaimsForLens('all', {});
  var sampleClaim = claims.find(function(claim) {
    return claim.claimId;
  });
  var ownershipClaim = claims.find(function(claim) {
    return claim.ownershipArea;
  });
  var conditionClaim = claims.find(function(claim) {
    return (claim.activeConditions || []).length > 0;
  });

  var ownershipArea = ownershipClaim ? ownershipClaim.ownershipArea : '';
  var conditionType = conditionClaim
    ? getClaimsWorkspaceTestConditionType_(conditionClaim.activeConditions[0])
    : '';
  var claimId = sampleClaim ? sampleClaim.claimId : '';

  var lensRoute = getClaimsList('needsAttention', {
    page: 'claims',
    routeSource: 'test'
  });
  var ownershipRoute = getClaimsList('all', {
    page: 'claims',
    ownership: ownershipArea,
    routeSource: 'test'
  });
  var conditionRoute = getClaimsList('all', {
    page: 'claims',
    condition: conditionType,
    routeSource: 'test'
  });
  var claimRoute = getClaimsList('all', {
    page: 'claims',
    claimId: claimId,
    routeSource: 'test'
  });

  var result = {
    lensRoute: summarizeClaimsWorkspaceRouteTest_(lensRoute),
    ownershipRoute: summarizeClaimsWorkspaceRouteTest_(ownershipRoute),
    conditionRoute: summarizeClaimsWorkspaceRouteTest_(conditionRoute),
    claimRoute: summarizeClaimsWorkspaceRouteTest_(claimRoute),
    samples: {
      ownershipArea: ownershipArea,
      conditionType: conditionType,
      claimId: claimId
    }
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function testClaimsWorkspaceRouteConsumption() {
  return testClaimsWorkspaceRouteFilters();
}

function summarizeClaimsWorkspaceRouteTest_(list) {
  return {
    lensId: list.lensId,
    totalCount: list.totalCount,
    filtersApplied: list.filtersApplied,
    routeContext: list.routeContext
  };
}

function getClaimsWorkspaceTestConditionType_(condition) {
  if (!condition || typeof condition !== 'object') {
    return condition || '';
  }

  return condition.Condition_Type ||
    condition.Condition_Name ||
    condition.conditionType ||
    condition.conditionName ||
    condition.Name ||
    '';
}

function testClaimsWorkspaceSample() {
  var result = getClaimsList('needsAttention', {});
  var sampleClaim = result && result.groups && result.groups[0] && result.groups[0].claims
    ? result.groups[0].claims[0]
    : null;

  Logger.log(JSON.stringify(sampleClaim, null, 2));

  return sampleClaim;
}

var ClaimsWorkspaceService = {
  getClaimsWorkspace: getClaimsWorkspace,
  getClaimsList: getClaimsList,
  testClaimsWorkspaceAllClaims: testClaimsWorkspaceAllClaims,
  testClaimsWorkspaceLensCounts: testClaimsWorkspaceLensCounts,
  testClaimsWorkspaceRouteFilters: testClaimsWorkspaceRouteFilters,
  testClaimsWorkspaceRouteConsumption: testClaimsWorkspaceRouteConsumption,
  testClaimsWorkspaceSample: testClaimsWorkspaceSample
};
