/**
 * ClaimFoundationService
 * Rainbow Phase 9 — Claim Foundation
 *
 * Builds a canonical claimFoundation object from already-fetched detail data.
 * Called by ClaimDetailService.getClaimDetail() after all existing fields are built.
 * Does not re-fetch any data — consumes what detail already holds.
 */

/**
 * buildClaimFoundation_
 *
 * @param {string} claimId
 * @param {object} detail - the fully assembled detail object from getClaimDetail()
 * @returns {object} claimFoundation canonical object
 */
function buildClaimFoundation_(claimId, detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  var fullHeader = detail.fullClaimHeader || {};
  var opSummary = detail.fullClaimOperationalSummary || {};
  var fullTimeline = detail.fullClaimTimeline || {};

  // --- Identity ---
  var resolvedClaimId = getFullClaimFirstValue_([
    claimId,
    header.claimId,
    detail.claimId
  ]) || '';

  var claimNumber = getFullClaimFirstValue_([
    header.claimNumber,
    fullHeader.claimNumber,
    detail.claimNumber
  ]) || '';

  var jobNumber = getFullClaimFirstValue_([
    header.jobNumber,
    fullHeader.jobNumber,
    detail.jobNumber
  ]) || '';

  var displayName = getFullClaimFirstValue_([
    header.displayName,
    fullHeader.title,
    header.customerName,
    detail.displayName
  ]) || '';

  var customerName = getFullClaimFirstValue_([
    header.customerName,
    detail.customerName
  ]) || '';

  var propertyAddress = getFullClaimFirstValue_([
    header.propertyAddress,
    header.address,
    fullHeader.propertyAddress,
    detail.propertyAddress,
    detail.address
  ]) || '';

  // --- Lifecycle ---
  var lifecycleState = getFullClaimFirstValue_([
    header.lifecycleState,
    fullHeader.lifecycleState,
    detail.lifecycleState
  ]) || '';

  var lifecycle = {
    state: lifecycleState || 'Not recorded',
    reason: '',
    confidence: '',
    lastUpdated: ''
  };

  // --- Health ---
  var healthLevel = getFullClaimFirstValue_([
    header.healthLevel,
    fullHeader.healthLevel,
    detail.healthLevel
  ]) || '';

  var healthReason = getFullClaimFirstValue_([
    header.healthReason,
    operational.healthReason,
    fullHeader.healthReason,
    detail.healthReason
  ]) || '';

  var lastMeaningfulActivity = getFullClaimFirstValue_([
    header.lastMeaningfulActivityAt,
    header.lastMeaningfulActivityDate,
    fullHeader.lastMeaningfulActivity,
    operational.lastMeaningfulActivityAt,
    operational.lastMeaningfulActivityDate,
    detail.lastMeaningfulActivityAt
  ]) || '';

  var daysSinceMeaningfulActivity = buildFoundationDaysSinceActivity_(lastMeaningfulActivity);

  var health = {
    level: healthLevel || 'Not rated',
    reason: healthReason || '',
    priority: buildFoundationHealthPriority_(healthLevel),
    lastMeaningfulActivity: lastMeaningfulActivity || '',
    daysSinceMeaningfulActivity: daysSinceMeaningfulActivity
  };

  // --- Ownership ---
  var ownershipArea = getFullClaimFirstValue_([
    header.ownershipArea,
    fullHeader.ownershipArea,
    detail.ownershipArea
  ]) || '';

  var primaryOwner = getFullClaimFirstValue_([
    header.primaryOwner,
    fullHeader.primaryOwner,
    detail.primaryOwner
  ]) || '';

  var ownerLabel = getFullClaimFirstValue_([
    fullHeader.ownerLabel
  ]) || '';

  if (!ownerLabel) {
    if (primaryOwner && ownershipArea) {
      ownerLabel = primaryOwner + ' / ' + ownershipArea;
    } else {
      ownerLabel = primaryOwner || ownershipArea || 'Unassigned';
    }
  }

  var ownershipReason = '';

  var ownership = {
    area: ownershipArea || 'Not recorded',
    primaryOwner: primaryOwner || 'Not recorded',
    ownerLabel: ownerLabel,
    reason: ownershipReason
  };

  // --- Conditions ---
  var rawActiveConditions = buildFoundationActiveConditions_(detail);
  var primaryCondition = getFullClaimFirstValue_([
    fullHeader.primaryCondition
  ]) || buildFoundationPrimaryCondition_(rawActiveConditions);

  var waitingOn = primaryCondition && primaryCondition !== 'No active condition'
    ? primaryCondition
    : 'No active condition';

  var conditions = {
    active: rawActiveConditions,
    primaryCondition: primaryCondition || 'No active condition',
    waitingOn: waitingOn
  };

  // --- Alerts ---
  var rawActiveAlerts = buildFoundationActiveAlerts_(detail);
  var alertCount = rawActiveAlerts.length;
  var highestSeverity = buildFoundationHighestSeverity_(rawActiveAlerts);

  if (!alertCount) {
    var headerAlertCount = Number(header.alertCount || 0);
    if (!isNaN(headerAlertCount) && headerAlertCount > 0) {
      alertCount = headerAlertCount;
    }
  }

  if (!highestSeverity) {
    highestSeverity = getFullClaimFirstValue_([header.highestAlertSeverity]) || '';
  }

  var alerts = {
    active: rawActiveAlerts,
    count: alertCount,
    highestSeverity: highestSeverity || ''
  };

  // --- Requirements ---
  var openRequirements = buildFoundationOpenRequirements_(detail);
  var requirements = {
    open: openRequirements,
    count: openRequirements.length
  };

  // --- Next Action ---
  var nextActionLabel = getFullClaimFirstValue_([
    header.nextAction,
    operational.nextAction,
    detail.nextAction
  ]) || '';

  var nextActionOwner = getFullClaimFirstValue_([primaryOwner, ownershipArea]) || '';

  var nextAction = {
    label: nextActionLabel || 'No recommended action',
    reason: getFullClaimFirstValue_([header.attentionReason, operational.attentionReason]) || '',
    owner: nextActionOwner,
    source: 'claimDetail'
  };

  // --- Links ---
  var links = buildFoundationLinks_(detail);

  // --- Financial Tracks ---
  var financialTracks = Array.isArray(detail.financialTracks) ? detail.financialTracks : [];

  // --- Timeline ---
  var timelineGroups = Array.isArray(fullTimeline.groups) ? fullTimeline.groups : [];
  var timelineItems = Array.isArray(fullTimeline.items) ? fullTimeline.items : [];
  var rawEvents = [];

  if (detail.timelineSection && Array.isArray(detail.timelineSection.events)) {
    rawEvents = detail.timelineSection.events;
  } else if (Array.isArray(detail.recentTimelineEvents)) {
    rawEvents = detail.recentTimelineEvents;
  }

  var timeline = {
    groups: timelineGroups,
    events: rawEvents
  };

  // --- Summary ---
  var operationalSummaryText = getFullClaimFirstValue_([
    opSummary.text,
    detail.operationalSummary && detail.operationalSummary.text
  ]) || '';

  var supportingText = getFullClaimFirstValue_([
    opSummary.supportingText,
    detail.operationalSummary && detail.operationalSummary.supportingText
  ]) || '';

  var facts = (opSummary.facts && Array.isArray(opSummary.facts))
    ? opSummary.facts
    : [];

  var summary = {
    operationalSummary: operationalSummaryText,
    supportingText: supportingText,
    facts: facts
  };

  // --- Raw ---
  var raw = {
    claimHeader: header,
    operationalContext: operational,
    externalLinks: Array.isArray(detail.externalLinks) ? detail.externalLinks : [],
    relatedWorkflows: detail.relatedWorkflows || {}
  };

  return {
    claimId: resolvedClaimId,
    claimNumber: claimNumber,
    jobNumber: jobNumber,
    displayName: displayName,
    customerName: customerName,
    propertyAddress: propertyAddress,
    lifecycle: lifecycle,
    ownership: ownership,
    health: health,
    conditions: conditions,
    alerts: alerts,
    requirements: requirements,
    nextAction: nextAction,
    links: links,
    financialTracks: financialTracks,
    timeline: timeline,
    summary: summary,
    raw: raw
  };
}

// --- Foundation Helpers ---

function buildFoundationActiveConditions_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  var rawList = header.activeConditions ||
    operational.activeConditions ||
    detail.activeConditions ||
    [];

  if (!Array.isArray(rawList)) {
    if (typeof rawList === 'string' && rawList.trim()) {
      return rawList.split(/[,;]+/).map(function(item) {
        return { conditionType: item.trim() };
      }).filter(function(item) {
        return item.conditionType;
      });
    }
    return [];
  }

  return rawList.filter(function(item) {
    return item !== null && item !== undefined;
  });
}

function buildFoundationActiveAlerts_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var rawAlerts = header.operationalAlerts ||
    header.activeAlerts ||
    detail.activeAlerts ||
    [];

  if (!Array.isArray(rawAlerts)) {
    return [];
  }

  return rawAlerts.filter(function(item) {
    return item !== null && item !== undefined;
  });
}

function buildFoundationOpenRequirements_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  var rawList = header.openRequirements ||
    operational.openRequirements ||
    detail.openRequirements ||
    [];

  if (!Array.isArray(rawList)) {
    if (typeof rawList === 'string' && rawList.trim()) {
      return rawList.split(/[,;]+/).map(function(item) {
        return item.trim();
      }).filter(function(item) {
        return item;
      });
    }
    return [];
  }

  return rawList.filter(function(item) {
    return item !== null && item !== undefined && String(item).trim() !== '';
  });
}

function buildFoundationLinks_(detail) {
  detail = detail || {};

  var externalLinksArray = Array.isArray(detail.externalLinks) ? detail.externalLinks : [];

  var fusion = '';
  var driveFolder = '';
  var estimatePlatform = '';
  var claimX = '';

  externalLinksArray.forEach(function(link) {
    if (!link) {
      return;
    }

    var linkType = String(link.linkType || link.Link_Type || link.type || '').toLowerCase();
    var url = getFullClaimFirstValue_([link.url, link.URL, link.href]) || '';

    if (!url) {
      return;
    }

    if (linkType.indexOf('fusion') !== -1) {
      fusion = fusion || url;
    } else if (linkType.indexOf('drive') !== -1 || linkType.indexOf('folder') !== -1) {
      driveFolder = driveFolder || url;
    } else if (linkType.indexOf('xact') !== -1 || linkType.indexOf('symbility') !== -1 || linkType.indexOf('estimate') !== -1) {
      estimatePlatform = estimatePlatform || url;
    } else if (linkType.indexOf('claimx') !== -1 || linkType.indexOf('claim_x') !== -1) {
      claimX = claimX || url;
    }
  });

  return {
    fusion: fusion,
    driveFolder: driveFolder,
    estimatePlatform: estimatePlatform,
    claimX: claimX
  };
}

function buildFoundationPrimaryCondition_(activeConditions) {
  if (!Array.isArray(activeConditions) || !activeConditions.length) {
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
      label = getFullClaimFirstValue_([
        condition.Condition_Type,
        condition.conditionType,
        condition.Condition_Name,
        condition.conditionName,
        condition.name,
        condition.type
      ]) || '';
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

function buildFoundationHighestSeverity_(alerts) {
  if (!Array.isArray(alerts) || !alerts.length) {
    return '';
  }

  var severityRank = {
    'Critical': 1,
    'High': 2,
    'Medium': 3,
    'Low': 4
  };

  var highestLabel = '';
  var highestRank = 999;

  alerts.forEach(function(alert) {
    if (!alert) {
      return;
    }

    var severity = getFullClaimFirstValue_([
      alert.Severity,
      alert.severity,
      alert.alertSeverity
    ]) || '';

    if (!severity) {
      return;
    }

    var rank = severityRank[severity] || 50;

    if (rank < highestRank) {
      highestLabel = severity;
      highestRank = rank;
    }
  });

  return highestLabel;
}

function buildFoundationHealthPriority_(healthLevel) {
  var ranks = {
    'Critical': 1,
    'Escalated': 2,
    'At Risk': 3,
    'Attention Soon': 4,
    'Healthy': 5
  };

  return ranks[healthLevel] || 5;
}

function buildFoundationDaysSinceActivity_(lastActivityValue) {
  if (!lastActivityValue) {
    return 0;
  }

  var date = new Date(lastActivityValue);

  if (isNaN(date.getTime())) {
    return 0;
  }

  var now = new Date();
  var millisecondsPerDay = 24 * 60 * 60 * 1000;
  var days = Math.floor((now.getTime() - date.getTime()) / millisecondsPerDay);

  return days >= 0 ? days : 0;
}

// --- Service Object ---

var ClaimFoundationService = {
  buildClaimFoundation_: buildClaimFoundation_
};
