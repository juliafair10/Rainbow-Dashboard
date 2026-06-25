/**
 * ClaimsOperationalAwarenessService
 * Rainbow Phase 11 — Claims Operational Awareness Layer
 *
 * Builds a cross-claim operational awareness model for the Homepage
 * and dashboard-level awareness cards. Backend / model preparation only.
 *
 * CRITICAL PERFORMANCE RULE:
 *   Works exclusively from the already-fetched claimsWorkspacePayload.
 *   Does NOT call buildClaimFoundation_() or buildOperationalIntelligence_()
 *   per claim. No additional Sheets reads are made here.
 *
 * Primary entry point:
 *   buildClaimsOperationalAwareness_(claimsWorkspacePayload)
 *
 * Per-claim lightweight helper:
 *   buildLightweightOperationalIntelligenceSummary_(claim)
 */

// ---------------------------------------------------------------------------
// Primary entry point
// ---------------------------------------------------------------------------

/**
 * buildClaimsOperationalAwareness_
 *
 * @param {object} claimsWorkspacePayload - the already-fetched workspace object
 *   (output of getClaimsWorkspace). Do not re-fetch.
 * @returns {object} claimsOperationalAwareness
 */
function buildClaimsOperationalAwareness_(claimsWorkspacePayload) {
  claimsWorkspacePayload = claimsWorkspacePayload || {};

  var generatedAt = new Date().toISOString();

  // Extract flat claim list from workspace payload groups
  var claims = getAwarenessFlatClaimsFromPayload_(claimsWorkspacePayload);

  // Build lightweight summaries for each claim — no Sheets reads
  var lightweightClaims = claims.map(function(claim) {
    return buildLightweightOperationalIntelligenceSummary_(claim);
  });

  var summary = buildClaimsAwarenessSummary_(lightweightClaims);
  var priorityCards = buildClaimsPriorityCards_(lightweightClaims);
  var priorityClaims = buildClaimsPriorityClaimItems_(lightweightClaims);
  var followUps = buildAwarenessFollowUps_(lightweightClaims);
  var waitingOn = groupClaimsByWaitingOn_(lightweightClaims);
  var alerts = groupClaimsByAlertType_(lightweightClaims);

  return {
    generatedAt: generatedAt,
    summary: summary,
    priorityCards: priorityCards,
    priorityClaims: priorityClaims,
    followUps: followUps,
    waitingOn: waitingOn,
    alerts: alerts
  };
}

// ---------------------------------------------------------------------------
// Per-claim lightweight helper
// ---------------------------------------------------------------------------

/**
 * buildLightweightOperationalIntelligenceSummary_
 *
 * Works from stream-level claim row fields already present on the enriched
 * claim objects produced by enrichClaimWorkspaceSummary_() in
 * ClaimsWorkspaceService.js. No buildClaimFoundation_ or
 * buildOperationalIntelligence_ calls are made.
 *
 * @param {object} claim - enriched claim row
 * @returns {object} lightweight operational intelligence summary
 */
function buildLightweightOperationalIntelligenceSummary_(claim) {
  claim = claim || {};

  var claimId = buildAwarenessStr_(claim.claimId, '');
  var displayName = buildAwarenessStr_(claim.displayName || claim.customerName, '');
  var claimNumber = buildAwarenessStr_(claim.claimNumber, '');
  var jobNumber = buildAwarenessStr_(claim.jobNumber, '');
  var lifecycleState = buildAwarenessStr_(claim.lifecycleState, '');
  var ownershipArea = buildAwarenessStr_(claim.ownershipArea, '');
  var healthLevel = buildAwarenessStr_(claim.healthLevel, '');

  // --- Active conditions (string list from ClaimsQueryService.normalizeClaimRow_) ---
  var rawActiveConditions = Array.isArray(claim.activeConditions)
    ? claim.activeConditions
    : [];

  // Derive primaryCondition using the same priority ranking as
  // buildFoundationPrimaryCondition_ in ClaimFoundationService.js
  var primaryCondition = buildAwarenessPrimaryCondition_(rawActiveConditions);
  var primaryConditionLabel = primaryCondition || 'No active condition';

  // --- waitingOn: same logic as buildOIWaitingOn_ in OperationalIntelligenceService ---
  var waitingOn = buildAwarenessWaitingOn_(rawActiveConditions, primaryCondition, ownershipArea);

  // --- operationalPriority: same logic as buildOIOperationalPriority_ ---
  var operationalPriority = buildAwarenessOperationalPriority_(healthLevel, lifecycleState);

  // --- staleRisk: same threshold as buildOIStaleRisk_ (14 days) ---
  var lastMeaningfulActivity = buildAwarenessStr_(
    claim.lastMeaningfulActivityAt || claim.lastMeaningfulActivityDate,
    ''
  );

  var daysSinceMeaningfulActivity = buildAwarenessDaysSince_(lastMeaningfulActivity);
  var staleRisk = daysSinceMeaningfulActivity > 14;

  // --- Alerts (enriched by enrichClaimWorkspaceSummary_) ---
  var operationalAlerts = Array.isArray(claim.operationalAlerts) ? claim.operationalAlerts : [];
  var alertCount = buildAwarenessNum_(claim.alertCount, operationalAlerts.length);
  var highestAlertSeverity = buildAwarenessStr_(claim.highestAlertSeverity, '');

  // --- nextAction (enriched by enrichClaimWorkspaceSummary_) ---
  var nextAction = buildAwarenessStr_(claim.nextAction, '');

  return {
    claimId: claimId,
    displayName: displayName,
    claimNumber: claimNumber,
    jobNumber: jobNumber,
    lifecycleState: lifecycleState,
    ownershipArea: ownershipArea,
    healthLevel: healthLevel,
    primaryCondition: primaryCondition,
    primaryConditionLabel: primaryConditionLabel,
    activeConditions: rawActiveConditions,
    waitingOn: waitingOn,
    operationalPriority: operationalPriority,
    staleRisk: staleRisk,
    lastMeaningfulActivity: lastMeaningfulActivity,
    daysSinceMeaningfulActivity: daysSinceMeaningfulActivity,
    alertCount: alertCount,
    highestAlertSeverity: highestAlertSeverity,
    nextAction: nextAction,
    operationalAlerts: operationalAlerts
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildClaimsAwarenessSummary_(claims) {
  claims = claims || [];

  var totalActiveClaims = 0;
  var needsAttentionCount = 0;
  var atRiskCount = 0;
  var escalatedCount = 0;
  var criticalCount = 0;
  var missingEojCount = 0;
  var waitingOnInsuranceCount = 0;
  var monitoringCount = 0;
  var openRequirementCount = 0;
  var operationalAlertCount = 0;

  claims.forEach(function(c) {
    totalActiveClaims++;

    var health = buildAwarenessStr_(c.healthLevel, '').toLowerCase();

    if (health === 'attention soon' || health === 'at risk' || health === 'escalated' || health === 'critical') {
      needsAttentionCount++;
    }

    if (health === 'at risk') {
      atRiskCount++;
    }

    if (health === 'escalated') {
      escalatedCount++;
    }

    if (health === 'critical') {
      criticalCount++;
    }

    if (isMissingEojClaim_(c)) {
      missingEojCount++;
    }

    if (c.waitingOn === 'Carrier') {
      waitingOnInsuranceCount++;
    }

    var primaryConditionLower = buildAwarenessStr_(c.primaryCondition, '').toLowerCase();
    if (primaryConditionLower.indexOf('monitoring') !== -1) {
      monitoringCount++;
    }

    if (buildAwarenessNum_(c.alertCount, 0) > 0) {
      operationalAlertCount++;
    }
  });

  return {
    totalActiveClaims: totalActiveClaims,
    needsAttentionCount: needsAttentionCount,
    atRiskCount: atRiskCount,
    escalatedCount: escalatedCount,
    criticalCount: criticalCount,
    missingEojCount: missingEojCount,
    waitingOnInsuranceCount: waitingOnInsuranceCount,
    monitoringCount: monitoringCount,
    openRequirementCount: openRequirementCount,
    operationalAlertCount: operationalAlertCount
  };
}

// ---------------------------------------------------------------------------
// Priority cards builder
// ---------------------------------------------------------------------------

function buildClaimsPriorityCards_(claims) {
  claims = claims || [];

  var cards = [
    buildAwarenessCard_(
      'critical-escalated',
      'Critical / Escalated',
      'critical',
      'Claims requiring immediate or escalated attention.',
      'needsAttention',
      '/exec?page=claims&lensId=needsAttention',
      claims,
      function(c) {
        var h = buildAwarenessStr_(c.healthLevel, '').toLowerCase();
        return h === 'critical' || h === 'escalated';
      }
    ),
    buildAwarenessCard_(
      'needs-attention',
      'Needs Attention',
      'high',
      'Claims with degraded health or immediate operational priority.',
      'needsAttention',
      '/exec?page=claims&lensId=needsAttention',
      claims,
      function(c) {
        var h = buildAwarenessStr_(c.healthLevel, '').toLowerCase();
        var op = buildAwarenessStr_(c.operationalPriority, '');
        return h === 'attention soon' || h === 'at risk' || h === 'escalated' || h === 'critical' ||
               op === 'Immediate' || op === 'High';
      }
    ),
    buildAwarenessCard_(
      'follow-ups-due',
      'Follow-Ups Due',
      'medium',
      'Claims that are stale or have exceeded the 14-day follow-up threshold.',
      '',
      '/exec?page=claims',
      claims,
      function(c) {
        return c.staleRisk === true || buildAwarenessNum_(c.daysSinceMeaningfulActivity, 0) > 14;
      }
    ),
    buildAwarenessCard_(
      'waiting-on-insurance',
      'Waiting on Insurance',
      'high',
      'Claims waiting on carrier coverage, estimates, supplements, or payment.',
      'waitingOnInsurance',
      '/exec?page=claims&lensId=waitingOnInsurance',
      claims,
      function(c) {
        if (c.waitingOn === 'Carrier') {
          return true;
        }
        var cond = buildAwarenessStr_(c.primaryCondition, '').toLowerCase();
        return cond.indexOf('coverage') !== -1 ||
               cond.indexOf('supplement') !== -1 ||
               cond.indexOf('estimate') !== -1;
      }
    ),
    buildAwarenessCard_(
      'missing-eoj',
      'Missing EOJ',
      'high',
      'Claims with a missing EOJ alert.',
      'missingEoj',
      '/exec?page=claims&lensId=missingEoj',
      claims,
      function(c) {
        return isMissingEojClaim_(c);
      }
    ),
    buildAwarenessCard_(
      'monitoring-paid',
      'Monitoring / Paid',
      'info',
      'Claims in monitoring status or operationally complete.',
      'paidMonitoring',
      '/exec?page=claims&lensId=paidMonitoring',
      claims,
      function(c) {
        var cond = buildAwarenessStr_(c.primaryCondition, '').toLowerCase();
        var state = buildAwarenessStr_(c.lifecycleState, '').toLowerCase();
        return cond.indexOf('monitoring active') !== -1 || state === 'operationally complete';
      }
    ),
    buildAwarenessCard_(
      'operational-alerts',
      'Operational Alerts',
      'medium',
      'Claims with one or more active operational alerts.',
      '',
      '/exec?page=claims',
      claims,
      function(c) {
        return buildAwarenessNum_(c.alertCount, 0) > 0;
      }
    )
  ];

  return cards;
}

/**
 * Builds a single priority card object.
 */
function buildAwarenessCard_(id, label, severity, description, lensId, route, claims, filterFn) {
  var matched = claims.filter(filterFn);
  var preview = matched.slice(0, 3).map(function(c) {
    return {
      claimId: buildAwarenessStr_(c.claimId, ''),
      displayName: buildAwarenessStr_(c.displayName, ''),
      claimNumber: buildAwarenessStr_(c.claimNumber, '')
    };
  });

  return {
    id: buildAwarenessStr_(id, ''),
    label: buildAwarenessStr_(label, ''),
    count: matched.length,
    severity: buildAwarenessStr_(severity, 'info'),
    description: buildAwarenessStr_(description, ''),
    lensId: buildAwarenessStr_(lensId, ''),
    route: buildAwarenessStr_(route, ''),
    itemsPreview: preview
  };
}

// ---------------------------------------------------------------------------
// Priority claims list
// ---------------------------------------------------------------------------

function buildClaimsPriorityClaimItems_(claims) {
  claims = claims || [];

  var prioritized = claims.filter(function(c) {
    var h = buildAwarenessStr_(c.healthLevel, '').toLowerCase();
    var op = buildAwarenessStr_(c.operationalPriority, '');
    return h === 'critical' || h === 'escalated' || h === 'at risk' || h === 'attention soon' ||
           op === 'Immediate' || op === 'High' ||
           c.staleRisk === true ||
           buildAwarenessNum_(c.alertCount, 0) > 0;
  });

  prioritized.sort(function(a, b) {
    var rankA = getAwarenessHealthRank_(a.healthLevel);
    var rankB = getAwarenessHealthRank_(b.healthLevel);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return buildAwarenessNum_(b.daysSinceMeaningfulActivity, 0) -
           buildAwarenessNum_(a.daysSinceMeaningfulActivity, 0);
  });

  return prioritized.slice(0, 20).map(function(c) {
    return {
      claimId: buildAwarenessStr_(c.claimId, ''),
      displayName: buildAwarenessStr_(c.displayName, ''),
      claimNumber: buildAwarenessStr_(c.claimNumber, ''),
      jobNumber: buildAwarenessStr_(c.jobNumber, ''),
      lifecycleState: buildAwarenessStr_(c.lifecycleState, ''),
      healthLevel: buildAwarenessStr_(c.healthLevel, ''),
      ownershipArea: buildAwarenessStr_(c.ownershipArea, ''),
      primaryCondition: buildAwarenessStr_(c.primaryCondition, ''),
      waitingOn: buildAwarenessStr_(c.waitingOn, 'Unknown'),
      operationalPriority: buildAwarenessStr_(c.operationalPriority, 'Normal'),
      staleRisk: c.staleRisk === true,
      lastMeaningfulActivity: buildAwarenessStr_(c.lastMeaningfulActivity, ''),
      daysSinceMeaningfulActivity: buildAwarenessNum_(c.daysSinceMeaningfulActivity, 0),
      nextAction: buildAwarenessStr_(c.nextAction, ''),
      alertCount: buildAwarenessNum_(c.alertCount, 0),
      highestAlertSeverity: buildAwarenessStr_(c.highestAlertSeverity, ''),
      route: ''
    };
  });
}

// ---------------------------------------------------------------------------
// Follow-ups builder
// ---------------------------------------------------------------------------

function buildAwarenessFollowUps_(claims) {
  claims = claims || [];
  var now = new Date();
  var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var tomorrowStart = todayStart + 86400000;

  var dueToday = [];
  var overdue = [];
  var attentionSoon = [];

  claims.forEach(function(c) {
    if (!c.staleRisk && buildAwarenessNum_(c.daysSinceMeaningfulActivity, 0) <= 14) {
      return;
    }

    var days = buildAwarenessNum_(c.daysSinceMeaningfulActivity, 0);
    var item = {
      claimId: buildAwarenessStr_(c.claimId, ''),
      displayName: buildAwarenessStr_(c.displayName, ''),
      claimNumber: buildAwarenessStr_(c.claimNumber, ''),
      healthLevel: buildAwarenessStr_(c.healthLevel, ''),
      daysSinceMeaningfulActivity: days,
      waitingOn: buildAwarenessStr_(c.waitingOn, 'Unknown'),
      nextAction: buildAwarenessStr_(c.nextAction, '')
    };

    if (days > 21) {
      overdue.push(item);
    } else if (days > 14) {
      attentionSoon.push(item);
    } else {
      dueToday.push(item);
    }
  });

  return {
    dueToday: dueToday,
    overdue: overdue,
    attentionSoon: attentionSoon
  };
}

// ---------------------------------------------------------------------------
// Group by waitingOn
// ---------------------------------------------------------------------------

function groupClaimsByWaitingOn_(claims) {
  claims = claims || [];

  var groups = {
    carrier: [],
    customer: [],
    technician: [],
    accounting: [],
    lab: [],
    rainbow: [],
    unknown: []
  };

  claims.forEach(function(c) {
    var waitingOn = buildAwarenessStr_(c.waitingOn, 'Unknown');
    var item = {
      claimId: buildAwarenessStr_(c.claimId, ''),
      displayName: buildAwarenessStr_(c.displayName, ''),
      claimNumber: buildAwarenessStr_(c.claimNumber, ''),
      primaryCondition: buildAwarenessStr_(c.primaryCondition, ''),
      healthLevel: buildAwarenessStr_(c.healthLevel, '')
    };

    if (waitingOn === 'Carrier') {
      groups.carrier.push(item);
    } else if (waitingOn === 'Customer') {
      groups.customer.push(item);
    } else if (waitingOn === 'Technician') {
      groups.technician.push(item);
    } else if (waitingOn === 'Accounting') {
      groups.accounting.push(item);
    } else if (waitingOn === 'Lab') {
      groups.lab.push(item);
    } else if (waitingOn === 'Rainbow') {
      groups.rainbow.push(item);
    } else {
      groups.unknown.push(item);
    }
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Group by alert type
// ---------------------------------------------------------------------------

function groupClaimsByAlertType_(claims) {
  claims = claims || [];

  var groups = {
    missingEoj: [],
    missingLinks: [],
    claimReviewNeeded: [],
    duplicateReviewNeeded: [],
    other: []
  };

  claims.forEach(function(c) {
    var alerts = Array.isArray(c.operationalAlerts) ? c.operationalAlerts : [];

    alerts.forEach(function(alert) {
      var alertType = buildAwarenessStr_(alert.alertType || alert.Alert_Type, '').toLowerCase();
      var alertName = buildAwarenessStr_(alert.alertName || alert.Alert_Name, '').toLowerCase();
      var combined = alertType + ' ' + alertName;

      var item = {
        claimId: buildAwarenessStr_(c.claimId, ''),
        displayName: buildAwarenessStr_(c.displayName, ''),
        claimNumber: buildAwarenessStr_(c.claimNumber, ''),
        alertType: buildAwarenessStr_(alert.alertType || alert.Alert_Type, ''),
        alertName: buildAwarenessStr_(alert.alertName || alert.Alert_Name, ''),
        severity: buildAwarenessStr_(alert.severity || alert.Severity, 'Medium')
      };

      if (combined.indexOf('eoj') !== -1) {
        groups.missingEoj.push(item);
      } else if (combined.indexOf('missing link') !== -1 || combined.indexOf('missing xa') !== -1 ||
                 combined.indexOf('missing fusion') !== -1 || combined.indexOf('missing claimx') !== -1) {
        groups.missingLinks.push(item);
      } else if (combined.indexOf('claim review') !== -1 || combined.indexOf('review needed') !== -1) {
        groups.claimReviewNeeded.push(item);
      } else if (combined.indexOf('duplicate') !== -1) {
        groups.duplicateReviewNeeded.push(item);
      } else {
        groups.other.push(item);
      }
    });
  });

  return groups;
}

// ---------------------------------------------------------------------------
// Route helper
// ---------------------------------------------------------------------------

function getClaimsAwarenessRouteForCard_(cardId) {
  var routes = {
    'critical-escalated': '/exec?page=claims&lensId=needsAttention',
    'needs-attention': '/exec?page=claims&lensId=needsAttention',
    'follow-ups-due': '/exec?page=claims',
    'waiting-on-insurance': '/exec?page=claims&lensId=waitingOnInsurance',
    'missing-eoj': '/exec?page=claims&lensId=missingEoj',
    'monitoring-paid': '/exec?page=claims&lensId=paidMonitoring',
    'operational-alerts': '/exec?page=claims'
  };

  return routes[buildAwarenessStr_(cardId, '')] || '/exec?page=claims';
}

// ---------------------------------------------------------------------------
// waitingOn derivation — mirrors buildOIWaitingOn_ in OperationalIntelligenceService
// ---------------------------------------------------------------------------

function buildAwarenessWaitingOn_(activeConditions, primaryCondition, ownershipArea) {
  activeConditions = Array.isArray(activeConditions) ? activeConditions : [];
  primaryCondition = buildAwarenessStr_(primaryCondition, '').toLowerCase();
  ownershipArea = buildAwarenessStr_(ownershipArea, '').toLowerCase();

  // Build a concatenated signal string from all conditions
  var conditionText = primaryCondition + ' | ' + activeConditions.map(function(c) {
    if (typeof c === 'string') {
      return c.toLowerCase();
    }
    if (c && typeof c === 'object') {
      return String(
        c.conditionType || c.Condition_Type || c.conditionName || c.Condition_Name || c.name || ''
      ).toLowerCase();
    }
    return '';
  }).join(' | ');

  // Carrier
  if (conditionText.indexOf('coverage pending') !== -1 ||
      conditionText.indexOf('waiting on carrier') !== -1 ||
      conditionText.indexOf('carrier revision') !== -1 ||
      conditionText.indexOf('estimate under review') !== -1 ||
      conditionText.indexOf('supplement under review') !== -1) {
    return 'Carrier';
  }

  // Lab
  if (conditionText.indexOf('asbestos') !== -1 ||
      conditionText.indexOf('waiting on lab') !== -1 ||
      conditionText.indexOf('lab results') !== -1) {
    return 'Lab';
  }

  // Customer
  if (conditionText.indexOf('waiting on customer') !== -1 ||
      conditionText.indexOf('customer decision') !== -1) {
    return 'Customer';
  }

  // Accounting
  if (conditionText.indexOf('waiting on payment') !== -1) {
    return 'Accounting';
  }

  // Rainbow
  if (conditionText.indexOf('revision active') !== -1) {
    return 'Rainbow';
  }

  // Technician: field ops with no blocking condition
  if (ownershipArea.indexOf('field operations') !== -1 && activeConditions.length === 0) {
    return 'Technician';
  }

  // Nobody: operationally clean
  if (activeConditions.length === 0 &&
      (primaryCondition === 'no active condition' || primaryCondition === '')) {
    return 'Nobody';
  }

  return 'Unknown';
}

// ---------------------------------------------------------------------------
// operationalPriority derivation — mirrors buildOIOperationalPriority_
// ---------------------------------------------------------------------------

function buildAwarenessOperationalPriority_(healthLevel, lifecycleState) {
  healthLevel = buildAwarenessStr_(healthLevel, '');
  lifecycleState = buildAwarenessStr_(lifecycleState, '');

  if (healthLevel === 'Critical') {
    return 'Immediate';
  }

  if (healthLevel === 'Escalated') {
    return 'High';
  }

  if (healthLevel === 'At Risk') {
    return 'Normal';
  }

  if (healthLevel === 'Attention Soon') {
    return 'Low';
  }

  if (healthLevel === 'Healthy' && lifecycleState === 'Operationally Complete') {
    return 'Monitoring';
  }

  return 'Normal';
}

// ---------------------------------------------------------------------------
// primaryCondition derivation — mirrors buildFoundationPrimaryCondition_
// ---------------------------------------------------------------------------

function buildAwarenessPrimaryCondition_(activeConditions) {
  activeConditions = Array.isArray(activeConditions) ? activeConditions : [];

  if (!activeConditions.length) {
    return 'No active condition';
  }

  var priority = {
    'Positive Asbestos Result': 1,
    'Abatement Required': 2,
    'Revision Active': 3,
    'Carrier Revision Requested': 4,
    'Supplement Under Review': 5,
    'Waiting on Payment': 6,
    'Asbestos Testing Pending': 7,
    'Waiting on Lab Results': 8,
    'Coverage Pending': 9,
    'Estimate Under Review': 10,
    'Monitoring Active': 11,
    'Source of Loss Unresolved': 12,
    'Waiting on Customer Decision': 13
  };

  var bestLabel = '';
  var bestRank = 999;

  activeConditions.forEach(function(condition) {
    var label = '';

    if (typeof condition === 'string') {
      label = condition.trim();
    } else if (condition && typeof condition === 'object') {
      label = buildAwarenessStr_(
        condition.Condition_Type ||
        condition.conditionType ||
        condition.Condition_Name ||
        condition.conditionName ||
        condition.name ||
        condition.type,
        ''
      );
    }

    if (!label) {
      return;
    }

    var rank = priority[label] || 50;

    if (rank < bestRank) {
      bestLabel = label;
      bestRank = rank;
    }
  });

  return bestLabel || 'No active condition';
}

// ---------------------------------------------------------------------------
// EOJ missing detection helper
// ---------------------------------------------------------------------------

function isMissingEojClaim_(claim) {
  claim = claim || {};

  var alerts = Array.isArray(claim.operationalAlerts)
    ? claim.operationalAlerts
    : (Array.isArray(claim.activeAlerts) ? claim.activeAlerts : []);

  var hasEojAlert = alerts.some(function(alert) {
    var combined = [
      buildAwarenessStr_(alert.alertType || alert.Alert_Type, ''),
      buildAwarenessStr_(alert.alertName || alert.Alert_Name, '')
    ].join(' ').toLowerCase();
    return combined.indexOf('eoj') !== -1 || combined.indexOf('missing eoj') !== -1;
  });

  if (hasEojAlert) {
    return true;
  }

  // Also check missingLinks array
  var missingLinks = Array.isArray(claim.missingLinks) ? claim.missingLinks : [];
  return missingLinks.some(function(link) {
    return String(link || '').toLowerCase().indexOf('eoj') !== -1;
  });
}

// ---------------------------------------------------------------------------
// Health rank helper for sorting
// ---------------------------------------------------------------------------

function getAwarenessHealthRank_(healthLevel) {
  var ranks = {
    'Critical': 1,
    'Escalated': 2,
    'At Risk': 3,
    'Attention Soon': 4,
    'Healthy': 5
  };

  return ranks[buildAwarenessStr_(healthLevel, '')] || 6;
}

// ---------------------------------------------------------------------------
// Flat claim extractor from workspace payload
// ---------------------------------------------------------------------------

function getAwarenessFlatClaimsFromPayload_(payload) {
  payload = payload || {};

  var claimsList = payload.claimsList || {};
  var groups = Array.isArray(claimsList.groups) ? claimsList.groups : [];
  var claims = [];

  groups.forEach(function(group) {
    var groupClaims = Array.isArray(group.claims) ? group.claims : [];
    groupClaims.forEach(function(claim) {
      claims.push(claim);
    });
  });

  return claims;
}

// ---------------------------------------------------------------------------
// daysSince helper (inline — no Sheets call)
// ---------------------------------------------------------------------------

function buildAwarenessDaysSince_(isoDate) {
  if (!isoDate) {
    return 0;
  }

  var date = new Date(isoDate);

  if (isNaN(date.getTime())) {
    return 0;
  }

  var days = Math.floor((new Date().getTime() - date.getTime()) / 86400000);
  return days >= 0 ? days : 0;
}

// ---------------------------------------------------------------------------
// Safe value helpers — never return undefined, null, or NaN
// ---------------------------------------------------------------------------

function buildAwarenessStr_(value, fallback) {
  if (value === null || value === undefined) {
    return fallback !== undefined ? String(fallback) : '';
  }

  var text = String(value).trim();
  var lower = text.toLowerCase();

  if (!text || lower === 'undefined' || lower === 'null' || lower === 'nan') {
    return fallback !== undefined ? String(fallback) : '';
  }

  return text;
}

function buildAwarenessNum_(value, fallback) {
  if (value === null || value === undefined) {
    return typeof fallback === 'number' ? fallback : 0;
  }

  var n = Number(value);

  if (isNaN(n)) {
    return typeof fallback === 'number' ? fallback : 0;
  }

  return n;
}

// ---------------------------------------------------------------------------
// Service object
// ---------------------------------------------------------------------------

var ClaimsOperationalAwarenessService = {
  buildClaimsOperationalAwareness_: buildClaimsOperationalAwareness_,
  buildLightweightOperationalIntelligenceSummary_: buildLightweightOperationalIntelligenceSummary_
};
