/**
 * Phase 9
 * Claim Detail Service
 *
 * Full Claim Workspace payload.
 */

function getClaimDetail(claimId) {
  Logger.log('CLAIM_DETAIL_START ' + claimId);
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var detailStartedAt = new Date().getTime();
  var detailTimings = [];

  function markDetailTiming_(label, startedAt) {
    detailTimings.push({
      label: label,
      ms: new Date().getTime() - startedAt
    });
  }

  var timingStartedAt = new Date().getTime();
  var drawer = ClaimDrawerService.getClaimDrawer(claimId);
  markDetailTiming_('ClaimDrawerService.getClaimDrawer', timingStartedAt);

  timingStartedAt = new Date().getTime();
  var externalLinks = ClaimExternalLinkService.getClaimExternalLinks(claimId);
  markDetailTiming_('ClaimExternalLinkService.getClaimExternalLinks', timingStartedAt);

  timingStartedAt = new Date().getTime();
  var financialTracks = ClaimFinancialTrackService.getClaimFinancialTracks(claimId);
  markDetailTiming_('ClaimFinancialTrackService.getClaimFinancialTracks', timingStartedAt);

  timingStartedAt = new Date().getTime();
  var timeline = getWorkspaceTimelineForClaim_(claimId);
  markDetailTiming_('getWorkspaceTimelineForClaim_', timingStartedAt);

  timingStartedAt = new Date().getTime();
  var fullClaimTimeline = buildFullClaimTimelineModel_(timeline.events);
  markDetailTiming_('buildFullClaimTimelineModel_', timingStartedAt);

  timingStartedAt = new Date().getTime();
  var workspaceSummary = typeof enrichClaimWorkspaceSummary_ === 'function'
    ? enrichClaimWorkspaceSummary_(drawer.claimSummary)
    : drawer.claimSummary;
  markDetailTiming_('enrichClaimWorkspaceSummary_', timingStartedAt);

  var detail = {
    claimId: claimId,

    claimHeader: {
      claimId: workspaceSummary.claimId,
      customerName: workspaceSummary.customerName,
      displayName: workspaceSummary.displayName,
      claimNumber: workspaceSummary.claimNumber,
      jobNumber: workspaceSummary.jobNumber,
      address: workspaceSummary.address,
      propertyAddress: workspaceSummary.propertyAddress || workspaceSummary.address,
      lifecycleState: drawer.lifecycleState,
      ownershipArea: drawer.ownership.ownershipArea,
      primaryOwner: drawer.ownership.primaryOwner,
      healthLevel: drawer.operationalHealth.level,
      healthReason: drawer.operationalHealth.reason,
      activeConditions: workspaceSummary.activeConditions || drawer.activeConditions,
      activeAlerts: workspaceSummary.activeAlerts || drawer.activeAlerts,
      openRequirements: workspaceSummary.openRequirements || [],
      nextAction: workspaceSummary.nextAction || '',
      attentionReason: workspaceSummary.attentionReason || '',
      lastMeaningfulActivityAt: workspaceSummary.lastMeaningfulActivityAt || '',
      lastMeaningfulActivityDate: workspaceSummary.lastMeaningfulActivityDate || workspaceSummary.lastMeaningfulActivityAt || '',
      operationalAlerts: workspaceSummary.operationalAlerts || [],
      alertCount: workspaceSummary.alertCount || 0,
      highestAlertSeverity: workspaceSummary.highestAlertSeverity || ''
    },

    timelineSection: {
      events: timeline.events,
      recentEvents: timeline.recentEvents,
      timelineGroups: fullClaimTimeline.groups,
      timelineItemModels: fullClaimTimeline.items,
      timelineEvents: timeline.events,
      timelineCount: timeline.count,
      timelineSummary: timeline.count > 0
        ? 'Timeline events loaded from Rainbow Claims Database.'
        : 'No timeline events found in Rainbow Claims Database.'
    },
    recentTimelineEvents: timeline.recentEvents,

    operationalContext: {
      nextAction: workspaceSummary.nextAction || '',
      attentionReason: workspaceSummary.attentionReason || '',
      healthReason: drawer.operationalHealth.reason || '',
      activeConditions: workspaceSummary.activeConditions || drawer.activeConditions || [],
      openRequirements: workspaceSummary.openRequirements || [],
      blockers: [],
      currentCadence: null,
      upcomingScheduledWork: drawer.upcomingCalendarEvents,
      recentActivitySummary: workspaceSummary.lastMeaningfulActivityDate || workspaceSummary.lastMeaningfulActivityAt || '',
      lastMeaningfulActivityAt: workspaceSummary.lastMeaningfulActivityAt || '',
      lastMeaningfulActivityDate: workspaceSummary.lastMeaningfulActivityDate || workspaceSummary.lastMeaningfulActivityAt || '',
      timelineEventCount: timeline.count
    },

    financialTracks: financialTracks.tracks,

    externalLinks: externalLinks.links,

    relatedWorkflows: {
      monitoring: null,
      asbestos: null,
      itel: null,
      revision: null,
      supplements: []
    }
  };

  // Build claimFoundation first so model builders can read from it instead of recalculating.
  // At this point detail has claimHeader, operationalContext, timelineSection, financialTracks,
  // externalLinks, and relatedWorkflows — enough for buildClaimFoundation_ to work.
  // fullClaimHeader/fullClaimTimeline references inside buildClaimFoundation_ have fallbacks,
  // so calling it before those are set is safe.
  detail.fullClaimTimeline = fullClaimTimeline;
  timingStartedAt = new Date().getTime();
  var claimFoundation = (typeof buildClaimFoundation_ === 'function')
    ? buildClaimFoundation_(claimId, detail)
    : null;
  markDetailTiming_('buildClaimFoundation_', timingStartedAt);

  timingStartedAt = new Date().getTime();
  detail.fullClaimHeader = buildFullClaimHeaderModel_(detail, claimFoundation);
  detail.fullClaimOperationalSummary = buildFullClaimOperationalSummaryModel_(detail, detail.fullClaimHeader, claimFoundation);
  detail.fullClaimCurrentState = buildFullClaimCurrentStateModel_(detail, detail.fullClaimHeader, claimFoundation);
  detail.operationalSummary = detail.fullClaimOperationalSummary;
  markDetailTiming_('full claim model builders', timingStartedAt);

  detail.claimFoundation = claimFoundation;

  timingStartedAt = new Date().getTime();
  detail.operationalIntelligence = (typeof buildOperationalIntelligence_ === 'function')
    ? buildOperationalIntelligence_(detail.claimFoundation, detail)
    : null;
  markDetailTiming_('buildOperationalIntelligence_', timingStartedAt);

  timingStartedAt = new Date().getTime();
  detail.workspaceContext = (typeof buildWorkspaceContext_ === 'function')
    ? buildWorkspaceContext_(detail.claimFoundation, detail.operationalIntelligence, detail)
    : null;
  markDetailTiming_('buildWorkspaceContext_', timingStartedAt);

  // Phase 10D - Claim Activity Center: EOJ Reports.
  // Performance: EOJ Reports are intentionally deferred from the initial claim
  // detail payload because the recovery lookup reads cross-project EOJ sheets.
  // The dashboard should lazy-load them after the claim shell appears.
  detail.eojReports = [];
  detail.eojReportsDeferred = true;
  detail.eojReportsError = '';
  markDetailTiming_('getEojReportsForClaim_ deferred from initial load', new Date().getTime());

  detail.performanceTimings = detailTimings;

  var totalMs = new Date().getTime() - detailStartedAt;

  Logger.log('CLAIM_DETAIL_TIMINGS ' + JSON.stringify({
    claimId: claimId,
    totalMs: totalMs,
    timings: detailTimings
  }));

  if (totalMs > 1000) {
    Logger.log('CLAIM_DETAIL_SLOW ' + claimId + ' ' + totalMs + 'ms');
  }

  return detail;
}

function getClaimEojReports(claimId) {
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var startedAt = new Date().getTime();
  try {
    var reports = getEojReportsForClaim_(claimId);
    var elapsedMs = new Date().getTime() - startedAt;

    Logger.log('CLAIM_EOJ_REPORTS_TIMINGS ' + JSON.stringify({
      claimId: claimId,
      totalMs: elapsedMs,
      reportCount: Array.isArray(reports) ? reports.length : 0
    }));

    return {
      claimId: claimId,
      reports: Array.isArray(reports) ? reports : [],
      reportCount: Array.isArray(reports) ? reports.length : 0,
      elapsedMs: elapsedMs,
      error: ''
    };
  } catch (error) {
    Logger.log('getClaimEojReports failed for ' + claimId + ': ' + error);
    return {
      claimId: claimId,
      reports: [],
      reportCount: 0,
      elapsedMs: new Date().getTime() - startedAt,
      error: String(error && error.message ? error.message : error)
    };
  }
}

function buildFullClaimHeaderModel_(detail, claimFoundation) {
  detail = detail || {};
  claimFoundation = claimFoundation || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};

  // Read lifecycle, health, ownership, conditions, requirements from claimFoundation.
  // Fall back to the original normalize helpers if claimFoundation is absent.
  var lifecycleState = (claimFoundation.lifecycle && claimFoundation.lifecycle.state)
    ? claimFoundation.lifecycle.state
    : normalizeClaimLifecycle_(detail);

  var healthLevel = (claimFoundation.health && claimFoundation.health.level)
    ? claimFoundation.health.level
    : normalizeClaimHealth_(detail);

  var ownershipArea = (claimFoundation.ownership && claimFoundation.ownership.area)
    ? claimFoundation.ownership.area
    : normalizeClaimOwner_(detail).ownershipArea;

  var primaryOwner = (claimFoundation.ownership && claimFoundation.ownership.primaryOwner)
    ? claimFoundation.ownership.primaryOwner
    : normalizeClaimOwner_(detail).primaryOwner;

  var ownerLabel = (claimFoundation.ownership && claimFoundation.ownership.ownerLabel)
    ? claimFoundation.ownership.ownerLabel
    : normalizeClaimOwner_(detail).ownerLabel;

  var primaryCondition = (claimFoundation.conditions && claimFoundation.conditions.primaryCondition)
    ? claimFoundation.conditions.primaryCondition
    : getPrimaryClaimCondition_(detail);

  var activeConditions = (claimFoundation.conditions && Array.isArray(claimFoundation.conditions.active))
    ? claimFoundation.conditions.active
    : getFullClaimActiveConditions_(detail);

  var openRequirementsArr = (claimFoundation.requirements && Array.isArray(claimFoundation.requirements.open))
    ? claimFoundation.requirements.open
    : getFullClaimOpenRequirements_(detail);

  var openRequirementCount = openRequirementsArr.length;

  var lastMeaningfulActivity = (claimFoundation.health && claimFoundation.health.lastMeaningfulActivity)
    ? claimFoundation.health.lastMeaningfulActivity
    : getFullClaimFirstValue_([
        header.lastMeaningfulActivityAt,
        header.lastMeaningfulActivityDate,
        operational.lastMeaningfulActivityAt,
        operational.lastMeaningfulActivityDate,
        operational.recentActivitySummary,
        detail.lastMeaningfulActivityAt,
        detail.lastMeaningfulActivityDate
      ]);

  var nextAction = (claimFoundation.nextAction && claimFoundation.nextAction.label && claimFoundation.nextAction.label !== 'No recommended action')
    ? claimFoundation.nextAction.label
    : getFullClaimFirstValue_([
        header.nextAction,
        operational.nextAction,
        detail.nextAction
      ]);

  var claimNumber = getFullClaimFirstValue_([
    header.claimNumber,
    detail.claimNumber,
    header.Claim_Number,
    detail.Claim_Number
  ]);
  var jobNumber = getFullClaimFirstValue_([
    header.jobNumber,
    detail.jobNumber,
    header.Job_Number,
    detail.Job_Number
  ]);
  var propertyAddress = getFullClaimFirstValue_([
    header.propertyAddress,
    header.address,
    detail.propertyAddress,
    detail.address
  ]);
  var title = getFullClaimFirstValue_([
    header.displayName,
    header.customerName,
    detail.displayName,
    detail.customerName,
    claimNumber,
    jobNumber,
    detail.claimId
  ]) || 'Unnamed Claim';

  var waitingOn = primaryCondition === 'No active condition'
    ? 'No active condition'
    : primaryCondition;
  var openRequirementsLabel = openRequirementCount > 0
    ? openRequirementCount + (openRequirementCount === 1 ? ' open requirement' : ' open requirements')
    : 'No open requirements';
  var headerIntel = [
    {
      label: 'Last Activity',
      value: lastMeaningfulActivity || 'Not recorded'
    },
    {
      label: 'Waiting On',
      value: waitingOn || 'No active condition'
    },
    {
      label: 'Next Action',
      value: nextAction || 'No recommended action'
    },
    {
      label: 'Requirements',
      value: openRequirementsLabel
    }
  ];

  return {
    eyebrow: 'Full Claim Workspace',
    title: title,
    claimId: detail.claimId || header.claimId || '',
    claimNumber: claimNumber || 'Not recorded',
    jobNumber: jobNumber,
    propertyAddress: propertyAddress,
    lifecycleState: lifecycleState,
    healthLevel: healthLevel,
    ownershipArea: ownershipArea,
    primaryOwner: primaryOwner,
    ownerLabel: ownerLabel,
    primaryCondition: primaryCondition,
    lastMeaningfulActivity: lastMeaningfulActivity || 'Not recorded',
    waitingOn: waitingOn,
    nextAction: nextAction || 'No recommended action',
    openRequirementCount: openRequirementCount,
    openRequirementsLabel: openRequirementsLabel,
    headerIntel: headerIntel,
    activeConditions: activeConditions,
    openRequirements: openRequirementsArr
  };
}

function buildFullClaimOperationalSummaryModel_(detail, headerModel, claimFoundation) {
  detail = detail || {};
  claimFoundation = claimFoundation || {};
  headerModel = headerModel || buildFullClaimHeaderModel_(detail, claimFoundation);

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  var lifecycleState = getFullClaimDisplayValue_(headerModel.lifecycleState, 'Not recorded');
  var healthLevel = getFullClaimDisplayValue_(headerModel.healthLevel, 'Not rated');
  var primaryCondition = getFullClaimDisplayValue_(headerModel.primaryCondition, 'No active condition');

  // Read nextAction and attentionReason from claimFoundation when available.
  var nextAction = (claimFoundation.nextAction && claimFoundation.nextAction.label && claimFoundation.nextAction.label !== 'No recommended action')
    ? claimFoundation.nextAction.label
    : getFullClaimFirstValue_([
        header.nextAction,
        operational.nextAction,
        detail.nextAction
      ]);
  var attentionReason = (claimFoundation.nextAction && claimFoundation.nextAction.reason)
    ? claimFoundation.nextAction.reason
    : getFullClaimFirstValue_([
        header.attentionReason,
        operational.attentionReason,
        header.healthReason,
        operational.healthReason
      ]);

  // Read ownership from claimFoundation when available, fall back to normalizeClaimOwner_.
  var owner = (claimFoundation.ownership)
    ? {
        primaryOwner: claimFoundation.ownership.primaryOwner || 'Not recorded',
        ownershipArea: claimFoundation.ownership.area || 'Not recorded',
        ownerLabel: claimFoundation.ownership.ownerLabel || 'Unassigned'
      }
    : normalizeClaimOwner_(detail);

  // Read openRequirementCount from claimFoundation when available.
  var openRequirementCount = (claimFoundation.requirements)
    ? claimFoundation.requirements.count
    : getOpenRequirementCount_(detail);
  var stateSentence = lifecycleState === 'Not recorded' && healthLevel === 'Not rated'
    ? 'This claim currently shows limited recorded lifecycle and health data.'
    : lifecycleState === 'Not recorded'
      ? 'This claim currently shows limited recorded lifecycle data and is currently ' + healthLevel + '.'
      : healthLevel === 'Not rated'
        ? 'This claim appears to be in ' + lifecycleState + '.'
        : 'This claim appears to be in ' + lifecycleState + ' and is currently ' + healthLevel + '.';
  var trackingClause = primaryCondition !== 'No active condition'
    ? 'Rainbow is tracking ' + primaryCondition
    : attentionReason
      ? 'Rainbow is tracking ' + stripFullClaimEndingPunctuation_(truncateFullClaimPhrase_(attentionReason, 120))
      : 'Rainbow is tracking available conditions and requirements as details are recorded';
  var ownerPhrase = '';

  if (owner.primaryOwner !== 'Not recorded') {
    ownerPhrase = owner.primaryOwner + ' owns the next action';
  } else if (owner.ownershipArea !== 'Not recorded') {
    ownerPhrase = owner.ownershipArea + ' owns the next action';
  } else {
    ownerPhrase = 'ownership is not recorded yet';
  }

  var requirementPhrase = openRequirementCount > 0
    ? (openRequirementCount === 1
      ? 'one open requirement still needs review'
      : openRequirementCount + ' open requirements still need review')
    : 'no open requirements are recorded right now';
  var followUpPhrase = nextAction
    ? 'follow-up should be planned around ' + stripFullClaimEndingPunctuation_(truncateFullClaimPhrase_(nextAction, 120))
    : openRequirementCount > 0
      ? 'follow-up should be planned'
      : '';
  var secondSentenceParts = [ownerPhrase, requirementPhrase];

  if (followUpPhrase) {
    secondSentenceParts.push(followUpPhrase);
  }

  var summaryText = stateSentence + ' ' + trackingClause + '; ' + joinFullClaimPhraseList_(secondSentenceParts) + '.';

  return {
    title: 'Operational Summary',
    text: summaryText,
    supportingText: 'Based on lifecycle, ownership, conditions, requirements, and recent activity.',
    facts: [
      {
        label: 'Lifecycle',
        value: lifecycleState
      },
      {
        label: 'Owner',
        value: owner.ownerLabel
      },
      {
        label: 'Health',
        value: healthLevel
      },
      {
        label: 'Requirements',
        value: openRequirementCount > 0 ? openRequirementCount + ' open' : 'None open'
      }
    ]
  };
}

function buildFullClaimCurrentStateModel_(detail, headerModel, claimFoundation) {
  detail = detail || {};
  claimFoundation = claimFoundation || {};
  headerModel = headerModel || buildFullClaimHeaderModel_(detail, claimFoundation);

  // Read alert count from claimFoundation when available, fall back to getFullClaimAlertCount_.
  var alertCount = (claimFoundation.alerts)
    ? claimFoundation.alerts.count
    : getFullClaimAlertCount_(detail);

  return {
    title: 'Current State',
    helperText: 'Used for operational routing, follow-up cadence, and claim prioritization.',
    items: [
      {
        label: 'Lifecycle',
        value: headerModel.lifecycleState || 'Not recorded'
      },
      {
        label: 'Health',
        value: headerModel.healthLevel || 'Not rated'
      },
      {
        label: 'Ownership',
        value: headerModel.ownerLabel || 'Unassigned'
      },
      {
        label: 'Primary condition',
        value: headerModel.primaryCondition || 'No active condition'
      },
      {
        label: 'Last meaningful activity',
        value: headerModel.lastMeaningfulActivity || 'Not recorded'
      },
      {
        label: 'Open requirements',
        value: headerModel.openRequirementsLabel || 'No open requirements'
      },
      {
        label: 'Alert count',
        value: String(alertCount)
      }
    ]
  };
}

// LEGACY: retained as fallback — primary source is now claimFoundation.alerts.count
function getFullClaimAlertCount_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var alertCountValue = getFullClaimFirstValue_([
    header.alertCount,
    detail.alertCount
  ]);
  var parsedCount = Number(alertCountValue);

  if (alertCountValue && !isNaN(parsedCount)) {
    return Math.max(0, parsedCount);
  }

  var operationalAlerts = Array.isArray(header.operationalAlerts)
    ? header.operationalAlerts
    : Array.isArray(detail.operationalAlerts)
      ? detail.operationalAlerts
      : [];
  var activeAlerts = Array.isArray(header.activeAlerts)
    ? header.activeAlerts
    : Array.isArray(detail.activeAlerts)
      ? detail.activeAlerts
      : [];

  return Math.max(operationalAlerts.length, activeAlerts.length);
}

// LEGACY: retained as fallback — primary source is now claimFoundation.ownership
function normalizeClaimOwner_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var primaryOwner = getFullClaimFirstValue_([
    header.primaryOwner,
    header.owner,
    detail.primaryOwner,
    detail.owner
  ]);
  var ownershipArea = getFullClaimFirstValue_([
    header.ownershipArea,
    detail.ownershipArea
  ]);
  var ownerLabel = '';

  if (primaryOwner && ownershipArea) {
    ownerLabel = primaryOwner + ' / ' + ownershipArea;
  } else {
    ownerLabel = primaryOwner || ownershipArea || 'Unassigned';
  }

  return {
    primaryOwner: primaryOwner || 'Not recorded',
    ownershipArea: ownershipArea || 'Not recorded',
    ownerLabel: ownerLabel
  };
}

// LEGACY: retained as fallback — primary source is now claimFoundation.lifecycle.state
function normalizeClaimLifecycle_(detail) {
  detail = detail || {};

  return getFullClaimFirstValue_([
    detail.claimHeader && detail.claimHeader.lifecycleState,
    detail.lifecycleState
  ]) || 'Not recorded';
}

// LEGACY: retained as fallback — primary source is now claimFoundation.health.level
function normalizeClaimHealth_(detail) {
  detail = detail || {};

  return getFullClaimFirstValue_([
    detail.claimHeader && detail.claimHeader.healthLevel,
    detail.healthLevel
  ]) || 'Not rated';
}

// LEGACY: retained as fallback — primary source is now claimFoundation.conditions.primaryCondition
function getPrimaryClaimCondition_(detail) {
  var conditions = getFullClaimActiveConditions_(detail);
  var priority = {
    'Carrier Revision Requested': 1,
    'Revision Active': 2,
    'Coverage Pending': 3,
    'Waiting on Payment': 4,
    'Monitoring Active': 5
  };
  var bestLabel = '';
  var bestRank = 999;

  conditions.forEach(function(condition) {
    var label = getFullClaimConditionLabel_(condition);
    var rank = priority[label] || 50;

    if (label && rank < bestRank) {
      bestLabel = label;
      bestRank = rank;
    }
  });

  return bestLabel || 'No active condition';
}

// LEGACY: retained as fallback — primary source is now claimFoundation.requirements.count
function getOpenRequirementCount_(detail) {
  return getFullClaimOpenRequirements_(detail).length;
}

// LEGACY: retained as fallback — primary source is now claimFoundation.conditions.active
function getFullClaimActiveConditions_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  return normalizeFullClaimList_(
    header.activeConditions ||
    operational.activeConditions ||
    detail.activeConditions ||
    []
  );
}

// LEGACY: retained as fallback — primary source is now claimFoundation.requirements.open
function getFullClaimOpenRequirements_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  return normalizeFullClaimTextList_(
    header.openRequirements ||
    operational.openRequirements ||
    detail.openRequirements ||
    []
  );
}

function normalizeFullClaimList_(value) {
  if (Array.isArray(value)) {
    return value.filter(function(item) {
      return getFullClaimFirstValue_([typeof item === 'object' ? getFullClaimConditionLabel_(item) : item]);
    });
  }

  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;]+/).map(function(item) {
      return item.trim();
    }).filter(function(item) {
      return item;
    });
  }

  return [];
}

function normalizeFullClaimTextList_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) {
      return getFullClaimListItemLabel_(item);
    }).filter(function(item) {
      return item;
    });
  }

  if (typeof value === 'string' && value.trim()) {
    return value.split(/[,;]+/).map(function(item) {
      return item.trim();
    }).filter(function(item) {
      return item;
    });
  }

  return [];
}

function getFullClaimListItemLabel_(item) {
  if (!item || typeof item !== 'object') {
    return getFullClaimFirstValue_([item]);
  }

  return getFullClaimFirstValue_([
    item.label,
    item.Label,
    item.name,
    item.Name,
    item.title,
    item.Title,
    item.requirement,
    item.Requirement,
    item.requirementName,
    item.Requirement_Name,
    item.description,
    item.Description,
    item.action,
    item.Action
  ]);
}

function getFullClaimConditionLabel_(condition) {
  if (!condition || typeof condition !== 'object') {
    return getFullClaimFirstValue_([condition]);
  }

  return getFullClaimFirstValue_([
    condition.Condition_Type,
    condition.Condition_Name,
    condition.conditionType,
    condition.conditionName,
    condition.Name,
    condition.name,
    condition.Type,
    condition.type
  ]);
}

function getFullClaimDisplayValue_(value, fallback) {
  return getFullClaimFirstValue_([value]) || fallback;
}

function getFullClaimFirstValue_(values) {
  values = values || [];

  for (var i = 0; i < values.length; i++) {
    var value = values[i];

    if (value === 0) {
      return '0';
    }

    if (value === null || value === undefined || Array.isArray(value) || typeof value === 'object') {
      continue;
    }

    var text = String(value).trim();
    var normalized = text.toLowerCase();

    if (text && normalized !== 'undefined' && normalized !== 'null' && normalized !== 'nan') {
      return text;
    }
  }

  return '';
}

function truncateFullClaimPhrase_(value, maxLength) {
  var text = getFullClaimFirstValue_([value]);

  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 1).trim() + '...';
}

function stripFullClaimEndingPunctuation_(value) {
  return getFullClaimFirstValue_([value]).replace(/[.!?]+$/g, '');
}

function joinFullClaimPhraseList_(phrases) {
  phrases = (phrases || []).filter(function(phrase) {
    return getFullClaimFirstValue_([phrase]);
  });

  if (phrases.length <= 1) {
    return phrases[0] || '';
  }

  if (phrases.length === 2) {
    return phrases[0] + ', and ' + phrases[1];
  }

  return phrases.slice(0, -1).join(', ') + ', and ' + phrases[phrases.length - 1];
}

function buildFullClaimTimelineModel_(events) {
  var items = (Array.isArray(events) ? events : [])
    .map(buildFullClaimTimelineItemModel_)
    .filter(function(item) {
      return item && item.title;
    });

  return {
    items: items,
    groups: groupFullClaimTimelineItemModels_(items)
  };
}

function groupFullClaimTimelineItemModels_(items) {
  var groupOrder = [
    'Revision / Insurance Activity',
    'Field / EOJ Activity',
    'Notes & Communication',
    'Accounting / Payment Activity',
    'System Activity',
    'Other Activity'
  ];
  var grouped = {};

  (items || []).forEach(function(item) {
    var groupLabel = item.groupLabel || 'Other Activity';

    if (!grouped[groupLabel]) {
      grouped[groupLabel] = [];
    }

    grouped[groupLabel].push(item);
  });

  return groupOrder
    .filter(function(label) {
      return grouped[label] && grouped[label].length;
    })
    .map(function(label) {
      return {
        label: label,
        events: grouped[label],
        count: grouped[label].length
      };
    });
}

function buildFullClaimTimelineItemModel_(event) {
  event = event || {};

  var eventType = getFullClaimTimelineEventType_(event);
  var source = getFullClaimTimelineEventSource_(event);
  var actor = getFullClaimTimelineEventActor_(event);
  var rawSummary = getFullClaimTimelineEventSummary_(event);
  var rawDetail = getFullClaimTimelineEventDetail_(event);
  var category = getFullClaimTimelineCategory_(event);
  var categoryClass = getFullClaimTimelineCategoryClass_(category);
  var title = normalizeFullClaimTimelineTitle_(rawSummary || eventType || rawDetail || 'Timeline Event');
  var detail = normalizeFullClaimTimelineDetail_(rawDetail);
  var dateLabel = formatFullClaimTimelineDate_(getFullClaimTimelineEventDate_(event));

  if (!shouldShowFullClaimTimelineDetail_(detail, title)) {
    detail = '';
  }

  var model = {
    eventId: getFullClaimFirstValue_([
      event.eventId,
      event.timelineEventId,
      event.Timeline_Event_ID,
      event.Event_ID
    ]),
    category: category,
    categoryClass: categoryClass,
    className: 'full-claim-timeline-item full-claim-timeline-item-' + categoryClass,
    groupLabel: getFullClaimTimelineGroupLabel_(event),
    title: title,
    date: dateLabel || 'Undated',
    source: source,
    actor: actor,
    eventType: eventType,
    detail: detail,
    isEojGrouped: event.isEojGrouped === true,
    eojEventCount: event.eojEventCount || '',
    eojId: event.eojId || event.sourceRecordId || '',
    sourceRecordId: event.sourceRecordId || '',
    groupedEventTypes: event.groupedEventTypes || []
  };

  model.meta = formatFullClaimTimelineMeta_(model);

  return model;
}

function getFullClaimTimelineCategory_(event) {
  var groupLabel = getFullClaimTimelineGroupLabel_(event);
  var source = String(getFullClaimTimelineEventSource_(event) || '').toLowerCase();
  var eventType = String(getFullClaimTimelineEventType_(event) || '').toLowerCase();
  var combined = [source, eventType, getFullClaimTimelineEventSummary_(event)].join(' ').toLowerCase();

  if (groupLabel === 'Revision / Insurance Activity') {
    return 'Revision / Insurance';
  }

  if (groupLabel === 'Field / EOJ Activity') {
    return 'EOJ / Field Visit';
  }

  if (groupLabel === 'Notes & Communication') {
    return combined.indexOf('historical') !== -1 ? 'Historical Note' : 'Notes / Communication';
  }

  if (groupLabel === 'Accounting / Payment Activity') {
    return 'Accounting / Payment';
  }

  if (groupLabel === 'System Activity') {
    return 'System Activity';
  }

  return 'Claim Activity';
}

function getFullClaimTimelineCategoryClass_(category) {
  var normalized = String(category || '').toLowerCase();

  if (normalized.indexOf('revision') !== -1 || normalized.indexOf('insurance') !== -1) {
    return 'insurance';
  }

  if (normalized.indexOf('eoj') !== -1 || normalized.indexOf('field') !== -1) {
    return 'field';
  }

  if (normalized.indexOf('note') !== -1 || normalized.indexOf('communication') !== -1) {
    return 'note';
  }

  if (normalized.indexOf('payment') !== -1 || normalized.indexOf('accounting') !== -1) {
    return 'payment';
  }

  if (normalized.indexOf('system') !== -1) {
    return 'system';
  }

  return 'other';
}

function getFullClaimTimelineGroupLabel_(event) {
  var eventType = String(getFullClaimTimelineEventType_(event) || '').toLowerCase();
  var source = String(getFullClaimTimelineEventSource_(event) || '').toLowerCase();
  var summary = String(getFullClaimTimelineEventSummary_(event) || '').toLowerCase();
  var detail = String(getFullClaimTimelineEventDetail_(event) || '').toLowerCase();
  var combined = [eventType, source, summary, detail].join(' ');

  if (combined.indexOf('revision') !== -1 ||
      combined.indexOf('estimate') !== -1 ||
      combined.indexOf('carrier') !== -1 ||
      combined.indexOf('xact') !== -1 ||
      combined.indexOf('symbility') !== -1 ||
      combined.indexOf('insurance') !== -1) {
    return 'Revision / Insurance Activity';
  }

  if (combined.indexOf('eoj') !== -1 ||
      combined.indexOf('field') !== -1 ||
      combined.indexOf('monitor') !== -1 ||
      combined.indexOf('inspection') !== -1 ||
      combined.indexOf('technician') !== -1 ||
      combined.indexOf('calendar') !== -1) {
    return 'Field / EOJ Activity';
  }

  if (combined.indexOf('note') !== -1 ||
      combined.indexOf('email') !== -1 ||
      combined.indexOf('historical') !== -1 ||
      combined.indexOf('communication') !== -1) {
    return 'Notes & Communication';
  }

  if (combined.indexOf('payment') !== -1 ||
      combined.indexOf('remittance') !== -1 ||
      combined.indexOf('accounting') !== -1 ||
      combined.indexOf('invoice') !== -1 ||
      combined.indexOf('paid') !== -1) {
    return 'Accounting / Payment Activity';
  }

  if (combined.indexOf('system') !== -1 ||
      combined.indexOf('health') !== -1 ||
      combined.indexOf('condition') !== -1 ||
      combined.indexOf('alert') !== -1 ||
      combined.indexOf('intelligence') !== -1) {
    return 'System Activity';
  }

  return 'Other Activity';
}

function formatFullClaimTimelineMeta_(model) {
  model = model || {};

  var metaItems = [
    model.actor,
    model.source,
    model.date
  ].filter(function(item) {
    var value = getFullClaimFirstValue_([item]);
    return value && value !== 'Undated';
  });

  if (!metaItems.length && model.eventType) {
    metaItems.push(model.eventType);
  }

  return metaItems.join(' • ');
}

function shouldShowFullClaimTimelineDetail_(detail, title) {
  var normalizedDetail = stripFullClaimEndingPunctuation_(detail).toLowerCase();
  var normalizedTitle = stripFullClaimEndingPunctuation_(title).toLowerCase();

  if (!normalizedDetail || normalizedDetail.length < 8) {
    return false;
  }

  if (normalizedDetail === normalizedTitle) {
    return false;
  }

  return normalizedDetail.indexOf(normalizedTitle) !== 0 || normalizedDetail.length > normalizedTitle.length + 18;
}

function normalizeFullClaimTimelineTitle_(value) {
  var text = getFullClaimFirstValue_([value]).replace(/\s+/g, ' ').trim();

  if (!text) {
    return 'Timeline Event';
  }

  var letters = text.replace(/[^A-Za-z]/g, '');
  var uppercaseLetters = text.replace(/[^A-Z]/g, '');
  var isMostlyUppercase = letters.length > 12 && uppercaseLetters.length / letters.length > 0.72;

  if (isMostlyUppercase) {
    text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    text = restoreFullClaimTimelineAcronyms_(text);
  }

  return truncateFullClaimPhrase_(text, 140);
}

function normalizeFullClaimTimelineDetail_(value) {
  var text = getFullClaimFirstValue_([value]).replace(/\s+/g, ' ').trim();

  return truncateFullClaimPhrase_(text, 260);
}

function restoreFullClaimTimelineAcronyms_(value) {
  return String(value || '')
    .replace(/\beoj\b/gi, 'EOJ')
    .replace(/\bxa\b/gi, 'XA')
    .replace(/\bxactanalysis\b/gi, 'XactAnalysis')
    .replace(/\bsymbility\b/gi, 'Symbility')
    .replace(/\bclaimx\b/gi, 'ClaimX');
}

function formatFullClaimTimelineDate_(value) {
  var rawValue = getFullClaimFirstValue_([value]);

  if (!rawValue && !(value instanceof Date)) {
    return '';
  }

  var date = normalizeWorkspaceTimelineDate_(value);

  if (!date || isNaN(date.getTime()) || date.getTime() === 0) {
    return rawValue;
  }

  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var currentYear = new Date().getFullYear();
  var label = months[date.getMonth()] + ' ' + date.getDate();

  if (date.getFullYear() !== currentYear) {
    label += ', ' + date.getFullYear();
  }

  return label;
}

function getFullClaimTimelineEventSummary_(event) {
  event = event || {};

  return getFullClaimFirstValue_([
    event.summary,
    event.Summary,
    event.title,
    event.eventSummary,
    event.description,
    event.lastActivitySummary,
    event.activitySummary,
    event.Activity_Label,
    event['Activity Label']
  ]);
}

function getFullClaimTimelineEventDetail_(event) {
  event = event || {};

  return getFullClaimFirstValue_([
    event.detail,
    event.details,
    event.Detail,
    event.Details,
    event.Note,
    event.Notes,
    event.description,
    event.Description
  ]);
}

function getFullClaimTimelineEventDate_(event) {
  event = event || {};

  var candidates = [
    event.eventDate,
    event.date,
    event.Date,
    event.createdAt,
    event.timestamp
  ];

  for (var i = 0; i < candidates.length; i++) {
    if (candidates[i] instanceof Date && !isNaN(candidates[i].getTime())) {
      return candidates[i];
    }
  }

  return getFullClaimFirstValue_(candidates);
}

function getFullClaimTimelineEventType_(event) {
  event = event || {};

  return getFullClaimFirstValue_([
    event.eventType,
    event.type,
    event.Event_Type,
    event['Event Type'],
    event.Activity_Type,
    event['Activity Type']
  ]);
}

function getFullClaimTimelineEventSource_(event) {
  event = event || {};

  return getFullClaimFirstValue_([
    event.source,
    event.sourceSystem,
    event.Source,
    event.Source_System,
    event['Source System'],
    event.Event_Source,
    event['Event Source']
  ]);
}

function getFullClaimTimelineEventActor_(event) {
  event = event || {};

  return getFullClaimFirstValue_([
    event.actor,
    event.Actor,
    event.owner,
    event.Owner,
    event.createdBy,
    event.Created_By
  ]);
}

function cacheWorkspaceTimelineResult_(cache, cacheKey, result) {
  try {
    cache.put(cacheKey, JSON.stringify(result), 300);
  } catch (cacheWriteError) {
    Logger.log('cacheWorkspaceTimelineResult_: cache write skipped for ' + cacheKey + ': ' + cacheWriteError);
  }
}

function getWorkspaceTimelineForClaim_(claimId) {
  var cacheKey = 'CLAIM_WORKSPACE_TIMELINE_' + String(claimId || '').trim();
  var cache = CacheService.getScriptCache();
  var cachedTimeline = cache.get(cacheKey);

  if (cachedTimeline) {
    try {
      return JSON.parse(cachedTimeline);
    } catch (cacheReadError) {
      Logger.log('getWorkspaceTimelineForClaim_: cache parse failed for ' + claimId + ': ' + cacheReadError);
    }
  }
  try {
    if (typeof getTimelineForClaim === 'function') {
      var timelineResponse = getTimelineForClaim(claimId);

      if (timelineResponse && timelineResponse.success && timelineResponse.data) {
        var timelineRows = Array.isArray(timelineResponse.data.timeline)
          ? timelineResponse.data.timeline
          : [];
        var normalizedTimelineEvents = timelineRows
          .map(normalizeWorkspaceTimelineEvent_)
          .sort(sortWorkspaceTimelineEventsNewestFirst_);
        var displayTimelineEvents = collapseEojWorkspaceTimelineEventsForDisplay_(normalizedTimelineEvents);

        var cachedResult = {
          count: displayTimelineEvents.length,
          rawCount: timelineResponse.data.count || normalizedTimelineEvents.length,
          events: displayTimelineEvents.slice(0, 200),
          rawEvents: normalizedTimelineEvents.slice(0, 200),
          recentEvents: displayTimelineEvents.slice(0, 5)
        };
        cacheWorkspaceTimelineResult_(cache, cacheKey, cachedResult);
        return cachedResult;
      }
    }

    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName(CLAIM_SHEET_NAMES.timeline || 'Timeline_Events');

    if (!sheet) {
      return {
        count: 0,
        events: [],
        recentEvents: []
      };
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return {
        count: 0,
        events: [],
        recentEvents: []
      };
    }

    var headerRowIndex = findWorkspaceTimelineHeaderRowIndex_(values);
    var headers = values[headerRowIndex];
    var rows = values.slice(headerRowIndex + 1).filter(function(row) {
      return row.join('').trim() !== '';
    });

    var normalizedClaimId = String(claimId || '');
    var normalizedJobNumber = normalizedClaimId.replace(/^CLM-/, '');

    var events = rows.map(function(row) {
      var record = {};

      headers.forEach(function(header, index) {
        record[header] = row[index];
      });

      return record;
    }).filter(function(record) {
      var recordClaimId = String(record.Claim_ID || record['Claim ID'] || '');
      var recordJobNumber = String(record.Job_Number || record['Job Number'] || '');
      var recordClaimNumber = String(record.Claim_Number || record['Claim Number'] || '');

      return recordClaimId === normalizedClaimId ||
             recordClaimId === normalizedJobNumber ||
             recordJobNumber === normalizedClaimId ||
             recordJobNumber === normalizedJobNumber ||
             recordClaimNumber === normalizedClaimId ||
             recordClaimNumber === normalizedJobNumber;
    }).map(normalizeWorkspaceTimelineEvent_).sort(sortWorkspaceTimelineEventsNewestFirst_);
    var collapsedEvents = collapseEojWorkspaceTimelineEventsForDisplay_(events);

    var fallbackCachedResult = {
      count: collapsedEvents.length,
      rawCount: events.length,
      events: collapsedEvents.slice(0, 200),
      rawEvents: events.slice(0, 200),
      recentEvents: collapsedEvents.slice(0, 5)
    };
    cacheWorkspaceTimelineResult_(cache, cacheKey, fallbackCachedResult);
    return fallbackCachedResult;
  } catch (error) {
    Logger.log('Workspace timeline unavailable for ' + claimId + ': ' + error);
    return {
      count: 0,
      events: [],
      recentEvents: []
    };
  }
}

function collapseEojWorkspaceTimelineEventsForDisplay_(events) {
  events = Array.isArray(events) ? events : [];

  var output = [];
  var eojGroupOrder = [];
  var eojGroups = {};

  events.forEach(function(event) {
    if (!isWorkspaceTimelineEojEvent_(event)) {
      output.push(event);
      return;
    }

    var key = getWorkspaceTimelineEojGroupKey_(event);
    if (!eojGroups[key]) {
      eojGroups[key] = [];
      eojGroupOrder.push(key);
    }
    eojGroups[key].push(event);
  });

  eojGroupOrder.forEach(function(key) {
    output.push(buildGroupedWorkspaceEojTimelineEvent_(key, eojGroups[key]));
  });

  return output.sort(sortWorkspaceTimelineEventsNewestFirst_);
}

function isWorkspaceTimelineEojEvent_(event) {
  event = event || {};

  var detailPayload = getWorkspaceTimelineEojDetailPayload_(event);
  var source = String(event.source || event.sourceSystem || event.Source || event.Event_Source || '').toLowerCase().trim();
  var eventType = String(event.eventType || event.Event_Type || event.type || '').toLowerCase().trim();
  var combined = [
    source,
    eventType,
    String(event.summary || event.Summary || '').toLowerCase(),
    String(event.details || event.Detail || event.Details || '').toLowerCase()
  ].join(' ');

  if (source.indexOf('eoj') !== -1) {
    return true;
  }

  if (event.sourceRecordId || event.relatedEojId || event.eojId || detailPayload.eoj_id || detailPayload.eojId || detailPayload.source_id) {
    return true;
  }

  var eojEventTypes = [
    'eoj submitted',
    'inspection completed',
    'monitoring visit completed',
    'demo visit completed',
    'demolition completed',
    'equipment pickup visit completed',
    'pickup / completion completed',
    'equipment updated',
    'equipment pickup completed',
    'monitoring updated',
    'mitigate status updated',
    'mica status updated',
    'follow-up requested',
    'follow up requested',
    'asbestos testing requested',
    'asbestos samples taken',
    'itel sample required'
  ];

  if (eojEventTypes.indexOf(eventType) !== -1) {
    return true;
  }

  return combined.indexOf('eoj report') !== -1 ||
         combined.indexOf('eoj submitted') !== -1 ||
         combined.indexOf('source_record_id') !== -1 ||
         combined.indexOf('eoj_id') !== -1;
}

function getWorkspaceTimelineEojGroupKey_(event) {
  event = event || {};
  var detailPayload = getWorkspaceTimelineEojDetailPayload_(event);
  var eojId = getFullClaimFirstValue_([
    event.sourceRecordId,
    event.relatedEojId,
    event.eojId,
    event.sourceId,
    detailPayload.eoj_id,
    detailPayload.eojId,
    detailPayload.source_id,
    detailPayload.Source_Record_ID
  ]);

  if (eojId) {
    return 'eoj:' + eojId;
  }

  var claimId = getFullClaimFirstValue_([event.claimId, event.Claim_ID, event['Claim ID']]);
  var date = normalizeWorkspaceTimelineDate_(event.eventDate || event.date || event.createdAt);
  var dateKey = date && !isNaN(date.getTime()) && date.getTime() !== 0
    ? [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-')
    : String(event.eventDate || event.date || '');
  var actor = String(event.actor || event.Actor || '').toLowerCase().trim();
  var createdAt = normalizeWorkspaceTimelineDate_(event.createdAt || event.eventDate || event.date);
  var createdBucket = createdAt && !isNaN(createdAt.getTime()) && createdAt.getTime() !== 0
    ? Math.floor(createdAt.getTime() / (1000 * 60 * 60 * 6))
    : '';

  return ['eoj-fallback', claimId, dateKey, actor, createdBucket].join(':');
}

function buildGroupedWorkspaceEojTimelineEvent_(groupKey, rows) {
  rows = (rows || []).slice().sort(sortWorkspaceTimelineEventsNewestFirst_);

  var primary = getWorkspaceTimelinePrimaryEojRow_(rows) || rows[0] || {};
  var detailPayload = getWorkspaceTimelineEojDetailPayload_(primary);
  var eojId = groupKey.indexOf('eoj:') === 0 ? groupKey.replace(/^eoj:/, '') : '';

  if (!eojId) {
    rows.some(function(row) {
      var rowDetail = getWorkspaceTimelineEojDetailPayload_(row);
      eojId = getFullClaimFirstValue_([
        row.sourceRecordId,
        row.relatedEojId,
        row.eojId,
        rowDetail.eoj_id,
        rowDetail.eojId,
        rowDetail.source_id
      ]);
      return !!eojId;
    });
  }

  var actor = getFullClaimFirstValue_([
    primary.actor,
    detailPayload.technician,
    detailPayload.Technician
  ]);
  var visitType = getFullClaimFirstValue_([
    detailPayload.visit_type,
    detailPayload.visitType,
    primary.visitType,
    inferWorkspaceTimelineEojVisitType_(rows)
  ]);
  var title = 'EOJ Report Submitted';
  if (actor) {
    title += ' by ' + actor;
  }
  if (visitType) {
    title += ' - ' + visitType;
  }

  return {
    eventId: eojId || groupKey,
    timelineEventId: eojId || groupKey,
    claimId: primary.claimId || '',
    jobNumber: primary.jobNumber || '',
    eventDate: getWorkspaceTimelineBestEojDate_(rows),
    createdAt: getFullClaimFirstValue_([primary.createdAt, primary.eventDate, primary.date, primary.Date]),
    source: 'EOJ',
    sourceRecordId: eojId,
    eojId: eojId,
    eventType: 'EOJ Report Submitted',
    actor: actor,
    summary: title,
    details: '',
    visibility: primary.visibility || '',
    category: 'EOJ / Field Visit',
    groupLabel: 'Field / EOJ Activity',
    isEojGrouped: true,
    eojEventCount: rows.length,
    groupedEventTypes: rows.map(function(row) {
      return row.eventType || '';
    }).filter(Boolean)
  };
}

function getWorkspaceTimelinePrimaryEojRow_(rows) {
  rows = rows || [];

  var preferredTypes = {
    'eoj submitted': true,
    'inspection completed': true,
    'monitoring visit completed': true,
    'demo visit completed': true,
    'equipment pickup visit completed': true,
    'pickup / completion completed': true
  };

  for (var i = 0; i < rows.length; i++) {
    var type = String(rows[i].eventType || '').toLowerCase().trim();
    if (preferredTypes[type]) {
      return rows[i];
    }
  }

  return rows[0] || null;
}

function getWorkspaceTimelineBestEojDate_(rows) {
  rows = rows || [];
  for (var i = 0; i < rows.length; i++) {
    var detailPayload = getWorkspaceTimelineEojDetailPayload_(rows[i]);
    var visitDate = getFullClaimFirstValue_([
      detailPayload.visit_date,
      detailPayload.visitDate,
      rows[i].eventDate,
      rows[i].createdAt
    ]);
    if (visitDate) {
      return visitDate;
    }
  }
  return '';
}

function inferWorkspaceTimelineEojVisitType_(rows) {
  rows = rows || [];

  for (var i = 0; i < rows.length; i++) {
    var type = String(rows[i].eventType || '').toLowerCase();
    if (type.indexOf('inspection') !== -1) { return 'Inspection'; }
    if (type.indexOf('monitoring') !== -1) { return 'Monitoring'; }
    if (type.indexOf('demo') !== -1 || type.indexOf('demolition') !== -1) { return 'Demo'; }
    if (type.indexOf('pickup') !== -1 || type.indexOf('completion') !== -1) { return 'Pickup / Completion'; }
  }

  return '';
}

function getWorkspaceTimelineEojDetailPayload_(event) {
  event = event || {};
  var rawDetail = event.details;
  if (rawDetail === null || rawDetail === undefined || rawDetail === '') { rawDetail = event.detail; }
  if (rawDetail === null || rawDetail === undefined || rawDetail === '') { rawDetail = event.Detail; }
  if (rawDetail === null || rawDetail === undefined || rawDetail === '') { rawDetail = event.Details; }

  if (!rawDetail || typeof rawDetail === 'object') {
    return rawDetail && typeof rawDetail === 'object' ? rawDetail : {};
  }

  var text = String(rawDetail || '').trim();
  if (!text || text.charAt(0) !== '{') {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function sortWorkspaceTimelineEventsNewestFirst_(a, b) {
  var aDate = normalizeWorkspaceTimelineDate_(a.eventDate || a.createdAt || a.Date || a.date);
  var bDate = normalizeWorkspaceTimelineDate_(b.eventDate || b.createdAt || b.Date || b.date);

  return bDate.getTime() - aDate.getTime();
}

function normalizeWorkspaceTimelineDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (!value) {
    return new Date(0);
  }

  var parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(0);
}

function findWorkspaceTimelineHeaderRowIndex_(values) {
  for (var rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
    var normalizedHeaders = values[rowIndex].map(function(value) {
      return normalizeWorkspaceTimelineHeaderName_(value);
    });

    if (normalizedHeaders.indexOf('claimid') !== -1 &&
        (normalizedHeaders.indexOf('eventdate') !== -1 ||
         normalizedHeaders.indexOf('date') !== -1 ||
         normalizedHeaders.indexOf('timelineeventid') !== -1)) {
      return rowIndex;
    }
  }

  return 0;
}

function normalizeWorkspaceTimelineEvent_(record) {
  record = record || {};

  return {
    eventId: getWorkspaceTimelineValue_(record, [
      'Timeline_Event_ID',
      'Timeline Event ID',
      'Event_ID',
      'Event ID'
    ]),
    claimId: getWorkspaceTimelineValue_(record, [
      'Claim_ID',
      'Claim ID',
      'claimId'
    ]),
    jobNumber: getWorkspaceTimelineValue_(record, [
      'Job_Number',
      'Job Number',
      'jobNumber'
    ]),
    eventDate: getWorkspaceTimelineValue_(record, [
      'Event_Date',
      'Event Date',
      'Activity_Date',
      'Activity Date',
      'Date',
      'eventDate'
    ]),
    createdAt: getWorkspaceTimelineValue_(record, [
      'Created_At',
      'Created At',
      'createdAt'
    ]),
    source: getWorkspaceTimelineValue_(record, [
      'Event_Source',
      'Event Source',
      'Source_System',
      'Source System',
      'Source',
      'source'
    ]),
    sourceRecordId: getWorkspaceTimelineValue_(record, [
      'Source_Record_ID',
      'Source Record ID',
      'Source_ID',
      'Source ID',
      'sourceRecordId',
      'source_id'
    ]),
    relatedEojId: getWorkspaceTimelineValue_(record, [
      'Related_EOJ_ID',
      'Related EOJ ID',
      'EOJ_ID',
      'EOJ ID',
      'eoj_id',
      'eojId'
    ]),
    eventType: getWorkspaceTimelineValue_(record, [
      'Event_Type',
      'Event Type',
      'Activity_Type',
      'Activity Type',
      'Type',
      'eventType'
    ]),
    actor: getWorkspaceTimelineValue_(record, [
      'Actor',
      'Owner',
      'actor'
    ]),
    summary: getWorkspaceTimelineValue_(record, [
      'Summary',
      'Activity_Label',
      'Activity Label',
      'Description',
      'summary'
    ]),
    details: getWorkspaceTimelineValue_(record, [
      'Detail',
      'Details',
      'Note',
      'Notes',
      'detail',
      'details'
    ]),
    visibility: getWorkspaceTimelineValue_(record, [
      'Visibility',
      'visibility'
    ])
  };
}

function getWorkspaceTimelineValue_(record, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (record[key] !== null && record[key] !== undefined && String(record[key]).trim() !== '') {
      return record[key];
    }
  }

  return '';
}

function normalizeWorkspaceTimelineHeaderName_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ============================================================
// Phase 10D - Claim Activity Center: EOJ Reports
//
// Read-only recovery view. The full structured EOJ payload is recovered from
// EOJ_Processing_Output first. EOJ_Log is used to enrich submittedAt and as a
// raw-payload fallback when output rows are unavailable. Timeline_Events is
// used last, and cards from it are marked thin/limited because live EOJ rows
// have blank Details.
// ============================================================

function getEojReportsForClaim_(claimId) {
  try {
    var outputRows = getEojProcessingOutputRowsForClaim_(claimId);
    if (outputRows.length) {
      var logRowsByEojId = getEojLogRowsForClaimByEojId_(claimId);
      var reports = getLatestEojProcessingRowsByEojId_(outputRows)
        .map(function(row) {
          return buildEojReportFromProcessingOutputRow_(row, logRowsByEojId);
        })
        .filter(Boolean);

      reports.sort(sortEojReportsNewestFirst_);
      return reports;
    }
  } catch (error) {
    Logger.log('getEojReportsForClaim_: EOJ_Processing_Output unavailable for ' + claimId + ': ' + formatEojError_(error));
  }

  try {
    var logReports = getEojReportsForClaimFromLog_(claimId);
    if (logReports.length) {
      logReports.sort(sortEojReportsNewestFirst_);
      return logReports;
    }
  } catch (logError) {
    Logger.log('getEojReportsForClaim_: EOJ_Log unavailable for ' + claimId + ': ' + formatEojError_(logError));
  }

  var timelineReports = getEojReportsForClaimFromTimeline_(claimId);
  return timelineReports;
}

function openEojProcessingOutputSpreadsheet_() {
  var spreadsheetId = getEojProcessingOutputSpreadsheetId_();
  if (!spreadsheetId) {
    throw new Error('Missing EOJ processing output spreadsheet id.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function openEojSourceSpreadsheet_() {
  var spreadsheetId = getEojSourceSpreadsheetId_();
  if (!spreadsheetId) {
    throw new Error('Missing EOJ source spreadsheet id.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getEojProcessingOutputSpreadsheetId_() {
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.EOJ_OUTPUT_SPREADSHEET_ID) {
    return CONFIG.EOJ_OUTPUT_SPREADSHEET_ID;
  }
  if (typeof EOJ_OUTPUT_SPREADSHEET_ID !== 'undefined' && EOJ_OUTPUT_SPREADSHEET_ID) {
    return EOJ_OUTPUT_SPREADSHEET_ID;
  }
  return '';
}

function getEojSourceSpreadsheetId_() {
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.EOJ_SOURCE_SPREADSHEET_ID) {
    return CONFIG.EOJ_SOURCE_SPREADSHEET_ID;
  }
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.EOJ_DATABASE_ID) {
    return CONFIG.EOJ_DATABASE_ID;
  }
  if (typeof EOJ_SOURCE_SPREADSHEET_ID !== 'undefined' && EOJ_SOURCE_SPREADSHEET_ID) {
    return EOJ_SOURCE_SPREADSHEET_ID;
  }
  return '';
}

function getEojProcessingOutputSheetName_() {
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.PROCESSING_OUTPUT_SHEET_NAME) {
    return CONFIG.PROCESSING_OUTPUT_SHEET_NAME;
  }
  if (typeof EOJ_PROCESSING_OUTPUT_SHEET_NAME !== 'undefined' && EOJ_PROCESSING_OUTPUT_SHEET_NAME) {
    return EOJ_PROCESSING_OUTPUT_SHEET_NAME;
  }
  return 'EOJ_Processing_Output';
}

function getEojLogSheetName_() {
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.EOJ_LOG_SHEET_NAME) {
    return CONFIG.EOJ_LOG_SHEET_NAME;
  }
  if (typeof EOJ_LOG_SHEET_NAME !== 'undefined' && EOJ_LOG_SHEET_NAME) {
    return EOJ_LOG_SHEET_NAME;
  }
  return 'EOJ_Log';
}

function getEojProcessingOutputRowsForClaim_(claimId) {
  var ss = openEojProcessingOutputSpreadsheet_();
  var sheetName = getEojProcessingOutputSheetName_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }
  return getEojSheetRowsForClaim_(sheet, claimId);
}

function getEojLogRowsForClaim_(claimId) {
  var ss = openEojSourceSpreadsheet_();
  var sheetName = getEojLogSheetName_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }
  return getEojSheetRowsForClaim_(sheet, claimId);
}

function getEojLogRowsForClaimByEojId_(claimId) {
  try {
    var rows = getEojLogRowsForClaim_(claimId);
    var byId = {};
    rows.forEach(function(row) {
      var eojId = normalizeEojGroupField_(getEojRecordValue_(row, ['EOJ_ID', 'EOJ ID', 'EOJID', 'ID']));
      if (eojId) {
        byId[eojId] = row;
      }
    });
    return byId;
  } catch (error) {
    Logger.log('getEojLogRowsForClaimByEojId_ non-fatal error for ' + claimId + ': ' + formatEojError_(error));
    return {};
  }
}

function getCachedEojSheetValues_(sheet) {
  if (!sheet) {
    return [];
  }

  var cacheKey = buildEojSheetCacheKey_(sheet);
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      Logger.log('getCachedEojSheetValues_: cache parse failed for ' + cacheKey + ': ' + error);
    }
  }

  var values = sheet.getDataRange().getValues();
  var serializedValues = values.map(function(row) {
    return row.map(function(value) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
  });

  try {
    cache.put(cacheKey, JSON.stringify(serializedValues), 300);
  } catch (cacheError) {
    Logger.log('getCachedEojSheetValues_: cache write skipped for ' + cacheKey + ': ' + cacheError);
  }

  return serializedValues;
}

function buildEojSheetCacheKey_(sheet) {
  var spreadsheetId = '';
  try {
    spreadsheetId = sheet.getParent().getId();
  } catch (error) {
    spreadsheetId = 'unknown-spreadsheet';
  }

  return 'EOJ_SHEET_VALUES_' + spreadsheetId + '_' + sheet.getName();
}

function buildEojClaimRowsCacheKey_(sheet, claimId) {
  var baseKey = buildEojSheetCacheKey_(sheet);
  return baseKey + '_CLAIM_' + normalizeEojGroupField_(claimId);
}

function getEojSheetRowsForClaim_(sheet, claimId) {
  var sheetNameForDiag = sheet && typeof sheet.getName === 'function' ? sheet.getName() : '(missing-sheet)';
  if (!sheet || !claimId) {
    return [];
  }

  var claimRowsCacheKey = buildEojClaimRowsCacheKey_(sheet, claimId);
  var cache = CacheService.getScriptCache();
  var cachedRows = cache.get(claimRowsCacheKey);

  if (cachedRows) {
    try {
      return JSON.parse(cachedRows);
    } catch (cacheReadError) {
      Logger.log('getEojSheetRowsForClaim_: claim-row cache parse failed for ' + claimRowsCacheKey + ': ' + cacheReadError);
    }
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return [];
  }

  var headerRowIndex = findEojHeaderRowIndex_(values);
  var headers = (values[headerRowIndex] || []).map(function(header) {
    return String(header || '').trim();
  });
  var claimIdIndex = getEojHeaderIndex_(headers, ['Claim_ID', 'Claim ID', 'ClaimId', 'Claim Id']);

  if (claimIdIndex < 0) {
    return [];
  }

  var rows = [];
  var targetClaimId = normalizeEojGroupField_(claimId);

  for (var rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex++) {
    var row = values[rowIndex];
    var rowClaimId = normalizeEojGroupField_(row[claimIdIndex]);
    if (rowClaimId !== targetClaimId) {
      continue;
    }

    rows.push(mapEojSheetRecord_(headers, row, rowIndex + 1));
  }

  try {
    cache.put(claimRowsCacheKey, JSON.stringify(rows), 300);
  } catch (cacheWriteError) {
    Logger.log('getEojSheetRowsForClaim_: claim-row cache write skipped for ' + claimRowsCacheKey + ': ' + cacheWriteError);
  }

  return rows;
}

function findEojHeaderRowIndex_(values) {
  for (var rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
    var headers = (values[rowIndex] || []).map(function(value) {
      return normalizeEojHeaderName_(value);
    });
    if (headers.indexOf('Claim_ID') !== -1 || headers.indexOf('ClaimId') !== -1) {
      return rowIndex;
    }
  }
  return 0;
}

function getEojHeaderIndex_(headers, candidates) {
  var direct = {};
  var normalized = {};

  (headers || []).forEach(function(header, index) {
    if (!header) {
      return;
    }
    direct[String(header).trim()] = index;
    normalized[normalizeEojHeaderName_(header)] = index;
  });

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (direct[candidate] !== undefined) {
      return direct[candidate];
    }
    var normalizedCandidate = normalizeEojHeaderName_(candidate);
    if (normalized[normalizedCandidate] !== undefined) {
      return normalized[normalizedCandidate];
    }
  }

  return -1;
}

function mapEojSheetRecord_(headers, row, rowNumber) {
  var record = {
    __rowNumber: rowNumber
  };

  (headers || []).forEach(function(header, index) {
    var cleanHeader = String(header || '').trim();
    if (!cleanHeader) {
      return;
    }
    var value = row[index];
    record[cleanHeader] = value;

    var normalizedHeader = normalizeEojHeaderName_(cleanHeader);
    if (normalizedHeader && record[normalizedHeader] === undefined) {
      record[normalizedHeader] = value;
    }
  });

  return record;
}

function getLatestEojProcessingRowsByEojId_(rows) {
  var byEojId = {};

  (rows || []).forEach(function(row) {
    var eojId = normalizeEojGroupField_(getEojRecordValue_(row, ['EOJ_ID', 'EOJ ID', 'EOJID', 'ID']));
    var key = eojId || ('row:' + row.__rowNumber);

    if (!byEojId[key] || getEojRecordSortTimestamp_(row) >= getEojRecordSortTimestamp_(byEojId[key])) {
      byEojId[key] = row;
    }
  });

  return Object.keys(byEojId).map(function(key) {
    return byEojId[key];
  });
}

function buildEojReportFromProcessingOutputRow_(record, logRowsByEojId) {
  record = record || {};
  logRowsByEojId = logRowsByEojId || {};

  var eojId = normalizeEojGroupField_(getEojRecordValue_(record, ['EOJ_ID', 'EOJ ID', 'EOJID', 'ID']));
  var logRecord = eojId ? (logRowsByEojId[eojId] || null) : null;
  var rawParsed = safeParseEojJsonValue_(getEojRecordValue_(record, ['Raw_Parsed_JSON', 'Raw Parsed JSON']), {});

  if (!Object.keys(rawParsed).length && logRecord) {
    rawParsed = safeParseEojJsonValue_(getEojRecordValue_(logRecord, ['Raw_JSON', 'Raw JSON']), {});
  }

  var equipmentOutput = safeParseEojJsonValue_(getEojRecordValue_(record, ['Equipment_Output_JSON', 'Equipment Output JSON']), {});
  var followUpOutput = safeParseEojJsonValue_(getEojRecordValue_(record, ['Follow_Up_Output_JSON', 'Follow Up Output JSON']), {});
  var conditionOutput = safeParseEojJsonValue_(getEojRecordValue_(record, ['Condition_Output_JSON', 'Condition Output JSON']), {});
  var alertOutput = safeParseEojJsonValue_(getEojRecordValue_(record, ['Alert_Output_JSON', 'Alert Output JSON']), {});
  var reviewOutput = safeParseEojJsonValue_(getEojRecordValue_(record, ['Review_Output_JSON', 'Review Output JSON']), {});
  var timelineOutput = safeParseEojJsonValue_(getEojRecordValue_(record, ['Timeline_Event_JSON', 'Timeline Event JSON']), {});

  var report = buildEojReportFromRecoveredPayload_({
    source: 'EOJ_Processing_Output',
    limited: false,
    eojId: eojId,
    record: record,
    logRecord: logRecord,
    rawParsed: rawParsed,
    equipmentOutput: equipmentOutput,
    followUpOutput: followUpOutput,
    conditionOutput: conditionOutput,
    alertOutput: alertOutput,
    reviewOutput: reviewOutput,
    timelineOutput: timelineOutput,
    processedAt: getEojRecordValue_(record, ['Processed_At', 'Processed At']),
    submittedAt: logRecord ? getEojRecordValue_(logRecord, ['Submitted_At', 'Submitted At']) : ''
  });
  return report;
}

function getEojReportsForClaimFromLog_(claimId) {
  return getEojLogRowsForClaim_(claimId)
    .map(buildEojReportFromLogRecord_)
    .filter(Boolean);
}

function buildEojReportFromLogRecord_(record) {
  record = record || {};
  var rawParsed = safeParseEojJsonValue_(getEojRecordValue_(record, ['Raw_JSON', 'Raw JSON']), {});
  var eojId = normalizeEojGroupField_(getEojRecordValue_(record, ['EOJ_ID', 'EOJ ID', 'EOJID', 'ID']));

  return buildEojReportFromRecoveredPayload_({
    source: 'EOJ_Log',
    limited: false,
    eojId: eojId,
    record: record,
    logRecord: record,
    rawParsed: rawParsed,
    equipmentOutput: {},
    followUpOutput: {},
    conditionOutput: {},
    alertOutput: {},
    reviewOutput: {},
    timelineOutput: {},
    processedAt: getEojRecordValue_(record, ['Processed_At', 'Processed At']),
    submittedAt: getEojRecordValue_(record, ['Submitted_At', 'Submitted At'])
  });
}

function buildEojReportFromRecoveredPayload_(input) {
  input = input || {};

  var record = input.record || {};
  var logRecord = input.logRecord || {};
  var rawParsed = input.rawParsed || {};
  var equipmentOutput = input.equipmentOutput || {};
  var followUpOutput = input.followUpOutput || {};
  var conditionOutput = input.conditionOutput || {};
  var alertOutput = input.alertOutput || {};
  var reviewOutput = input.reviewOutput || {};
  var timelineOutput = input.timelineOutput || {};

  var submittedDetails = getEojTimelineDetailsByType_(timelineOutput, ['EOJ Submitted']);
  var visitDetails = getEojTimelineDetailsWithAnyKey_(timelineOutput, ['work_performed', 'technician_notes', 'remaining_work']);
  var monitoringDetails = getEojTimelineDetailsByType_(timelineOutput, ['Monitoring Updated']);
  var micaDetails = getEojTimelineDetailsByType_(timelineOutput, ['Mitigate Status Updated', 'MICA Status Updated']);
  var asbestosDetails = mergeEojObjects_(
    getEojTimelineDetailsByType_(timelineOutput, ['Asbestos Testing Requested']),
    getEojTimelineDetailsByType_(timelineOutput, ['Asbestos Samples Taken'])
  );

  var eojId = normalizeEojGroupField_(firstEojValue_(
    input.eojId,
    getEojRecordValue_(record, ['EOJ_ID', 'EOJ ID', 'EOJID', 'ID']),
    getEojRecordValue_(logRecord, ['EOJ_ID', 'EOJ ID', 'EOJID', 'ID']),
    getNestedEojValue_(rawParsed, ['eojId'])
  ));

  var processedAt = normalizeEojDateScalar_(firstEojValue_(
    input.processedAt,
    getEojRecordValue_(record, ['Processed_At', 'Processed At']),
    getEojRecordValue_(logRecord, ['Processed_At', 'Processed At'])
  ));

  var visitDate = normalizeEojDateScalar_(firstEojValue_(
    getEojRecordValue_(record, ['Visit_Date', 'Visit Date']),
    getEojRecordValue_(logRecord, ['Visit_Date', 'Visit Date']),
    getNestedEojValue_(rawParsed, ['visitDate']),
    getNestedEojValue_(rawParsed, ['Visit_Date']),
    submittedDetails.visit_date,
    visitDetails.visit_date
  ));

  var submittedAt = normalizeEojDateScalar_(firstEojValue_(
    input.submittedAt,
    getEojRecordValue_(record, ['Submitted_At', 'Submitted At']),
    getEojRecordValue_(logRecord, ['Submitted_At', 'Submitted At']),
    getNestedEojValue_(rawParsed, ['submittedAt']),
    getNestedEojValue_(rawParsed, ['Submitted_At']),
    processedAt,
    visitDate
  ));

  var followUpRequired = coerceEojBoolean_(firstEojValue_(
    followUpOutput.follow_up_required,
    alertOutput.follow_up_required,
    getNestedEojValue_(rawParsed, ['followUpNeeded']),
    getEojRecordValue_(logRecord, ['Office_Follow_Up_Needed', 'Office Follow Up Needed'])
  ), '');

  var asbestosTestNeeded = coerceEojBoolean_(firstEojValue_(
    asbestosDetails.testing_required,
    alertOutput.asbestos_attention_needed,
    conditionOutput.asbestos_testing_pending,
    getNestedEojValue_(rawParsed, ['asbestosTestNeeded']),
    getEojRecordValue_(logRecord, ['Asbestos_Test_Needed', 'Asbestos Test Needed'])
  ), '');

  var asbestosSamplesTaken = coerceEojBoolean_(firstEojValue_(
    asbestosDetails.samples_taken,
    conditionOutput.waiting_on_lab_results,
    getNestedEojValue_(rawParsed, ['asbestosSamplesTaken']),
    getEojRecordValue_(logRecord, ['Asbestos_Samples_Taken', 'Asbestos Samples Taken'])
  ), '');

  var x1SketchProvided = coerceEojBoolean_(firstEojValue_(
    getNestedEojValue_(rawParsed, ['x1SketchProvided']),
    getEojRecordValue_(logRecord, ['X1_Sketch_Provided', 'X1 Sketch Provided'])
  ), '');

  var explicitMicaUpdated = firstEojValue_(
    getNestedEojValue_(rawParsed, ['micaUpdated']),
    getEojRecordValue_(logRecord, ['MICA_Updated', 'MICA Updated'])
  );
  var inferredMicaUpdated = firstEojValue_(
    micaDetails.has_mica_activity === true ? true : '',
    micaDetails.mitigation_plan_updated === true ? true : '',
    getNestedEojValue_(rawParsed, ['mitigationPlanUpdated']),
    getEojRecordValue_(logRecord, ['Mitigation_Plan_Updated', 'Mitigation Plan Updated'])
  );
  if (inferredMicaUpdated !== true) {
    inferredMicaUpdated = '';
  }
  var micaUpdated = firstEojValue_(explicitMicaUpdated, inferredMicaUpdated);

  var reviewReasons = firstEojValue_(
    reviewOutput.reasons,
    alertOutput.review_reasons,
    []
  );
  var reviewNeeded = coerceEojBoolean_(firstEojValue_(
    reviewOutput.review_needed,
    alertOutput.review_needed,
    Array.isArray(reviewReasons) && reviewReasons.length > 0 ? true : ''
  ), '');

  var report = {
    eojId: eojId,
    source: input.source || '',
    dataSource: input.source || '',
    limited: input.limited === true,
    isThinFallback: false,
    submittedAt: submittedAt,
    processedAt: processedAt,
    visitDate: visitDate,
    visitType: normalizeEojGroupField_(firstEojValue_(
      getEojRecordValue_(record, ['Visit_Type', 'Visit Type']),
      getEojRecordValue_(logRecord, ['Visit_Type', 'Visit Type']),
      getNestedEojValue_(rawParsed, ['visitType']),
      getNestedEojValue_(rawParsed, ['Visit_Type']),
      submittedDetails.visit_type
    )),
    technician: normalizeEojGroupField_(firstEojValue_(
      getEojRecordValue_(record, ['Technician']),
      getEojRecordValue_(logRecord, ['Technician']),
      getNestedEojValue_(rawParsed, ['technician']),
      getNestedEojValue_(rawParsed, ['Technician']),
      submittedDetails.technician
    )),
    jobStatus: normalizeEojGroupField_(firstEojValue_(
      getNestedEojValue_(rawParsed, ['jobStatus']),
      submittedDetails.job_status,
      getEojRecordValue_(logRecord, ['Job_Status', 'Job Status'])
    )),
    workPerformed: normalizeEojGroupField_(firstEojValue_(
      getNestedEojValue_(rawParsed, ['workPerformed']),
      submittedDetails.work_performed,
      visitDetails.work_performed,
      getEojRecordValue_(logRecord, ['Work_Performed', 'Work Performed'])
    )),
    technicianNotes: normalizeEojGroupField_(firstEojValue_(
      getNestedEojValue_(rawParsed, ['technicianNotes']),
      visitDetails.technician_notes,
      getEojRecordValue_(logRecord, ['Technician_Notes', 'Technician Notes'])
    )),
    equipmentSummary: buildEojEquipmentSummaryText_(equipmentOutput, rawParsed, logRecord),
    waitingOn: normalizeEojGroupField_(firstEojValue_(
      followUpOutput.waiting_on,
      getNestedEojValue_(rawParsed, ['waitingOn']),
      getEojRecordValue_(logRecord, ['Waiting_On', 'Waiting On'])
    )),
    followUpRequired: followUpRequired,
    followUpAssignedTo: normalizeEojGroupField_(firstEojValue_(
      followUpOutput.assigned_to,
      getNestedEojValue_(rawParsed, ['followUpAssignedTo'])
    )),
    followUpDueDate: normalizeEojDateScalar_(firstEojValue_(
      followUpOutput.due_date,
      getNestedEojValue_(rawParsed, ['followUpDueDate'])
    )),
    followUpDescription: normalizeEojGroupField_(firstEojValue_(
      followUpOutput.description,
      getNestedEojValue_(rawParsed, ['followUpDescription']),
      getNestedEojValue_(rawParsed, ['followUpNote']),
      getNestedEojValue_(rawParsed, ['followUpAction']),
      getEojRecordValue_(logRecord, ['Follow_Up_Note', 'Follow Up Note', 'Follow_Up_Action', 'Follow Up Action'])
    )),
    monitoringStatus: normalizeEojGroupField_(firstEojValue_(
      monitoringDetails.monitoring_status,
      getNestedEojValue_(rawParsed, ['monitoringStatus']),
      getEojRecordValue_(logRecord, ['Monitoring_Status', 'Monitoring Status']),
      conditionOutput.monitoring_active === true ? 'Active' : ''
    )),
    nextMonitoringDate: normalizeEojDateScalar_(firstEojValue_(
      monitoringDetails.next_monitoring_date,
      getNestedEojValue_(rawParsed, ['nextMonitoringDate']),
      getEojRecordValue_(logRecord, ['Next_Monitoring_Date', 'Next Monitoring Date'])
    )),
    asbestosTestNeeded: asbestosTestNeeded,
    asbestosSamplesTaken: asbestosSamplesTaken,
    asbestosSampleCount: firstEojValue_(
      asbestosDetails.sample_count,
      getNestedEojValue_(rawParsed, ['asbestosSampleCount']),
      getEojRecordValue_(logRecord, ['Asbestos_Sample_Count', 'Asbestos Sample Count'])
    ),
    asbestosHandler: normalizeEojGroupField_(firstEojValue_(
      asbestosDetails.handler,
      getNestedEojValue_(rawParsed, ['asbestosHandler'])
    )),
    x1SketchProvided: x1SketchProvided,
    micaUpdated: micaUpdated,
    micaDelayReason: normalizeEojGroupField_(firstEojValue_(
      micaDetails.mica_delay_reason,
      getNestedEojValue_(rawParsed, ['micaDelayReason']),
      getEojRecordValue_(logRecord, ['MICA_Delay_Reason', 'MICA Delay Reason'])
    )),
    micaExpectedDate: normalizeEojDateScalar_(firstEojValue_(
      getNestedEojValue_(rawParsed, ['micaExpectedDate']),
      getNestedEojValue_(rawParsed, ['micaExpectedUpdateDate']),
      micaDetails.mica_expected_update_date,
      getEojRecordValue_(logRecord, ['MICA_Expected_Update_Date', 'MICA Expected Update Date'])
    )),
    micaExpectedTime: normalizeEojGroupField_(firstEojValue_(
      getNestedEojValue_(rawParsed, ['micaExpectedTime']),
      getEojRecordValue_(logRecord, ['MICA_Expected_Update_Time', 'MICA Expected Update Time'])
    )),
    reviewNeeded: reviewNeeded,
    reviewReasons: reviewReasons,
    insuranceSummary: normalizeEojGroupField_(firstEojValue_(
      getNestedEojValue_(rawParsed, ['forInsuranceSummary']),
      getNestedEojValue_(rawParsed, ['workSummaryForInsurance']),
      getNestedEojValue_(rawParsed, ['insuranceSummary'])
    )),
    rawParsed: pickEojRawParsedUiFields_(rawParsed),
    rawParsedKeys: rawParsed && typeof rawParsed === 'object' ? Object.keys(rawParsed) : [],
    eventTypesPresent: getEojTimelineEvents_(timelineOutput).map(function(event) {
      return normalizeEojGroupField_(event.event_type || event.Event_Type || event.type);
    }).filter(Boolean)
  };

  report.workSummary = report.workPerformed;
  report.collapsedSummary = report.workPerformed || report.technicianNotes || report.equipmentSummary || report.followUpDescription || '';
  report.sortTimestamp = parseEojDateForSort_(report.processedAt) || parseEojDateForSort_(report.submittedAt) || parseEojDateForSort_(report.visitDate);
  report.submittedAtSort = report.sortTimestamp;
  report.fields = buildEojReportFields_(report);

  return report;
}

function getEojReportsForClaimFromTimeline_(claimId) {
  try {
    var timelineResponse = (typeof getTimelineForClaim === 'function') ? getTimelineForClaim(claimId) : null;
    var rows = (timelineResponse && timelineResponse.success && timelineResponse.data && Array.isArray(timelineResponse.data.timeline))
      ? timelineResponse.data.timeline
      : [];

    var eojRows = rows.filter(function(row) {
      var source = normalizeEojGroupField_(firstEojValue_(
        getEojRecordValue_(row, ['Event_Source', 'Event Source']),
        getEojRecordValue_(row, ['Source_System', 'Source System']),
        getEojRecordValue_(row, ['Source'])
      )).toLowerCase();
      return source.indexOf('eoj') !== -1;
    });

    if (!eojRows.length) {
      return [];
    }

    var groupOrder = [];
    var groups = {};

    eojRows.forEach(function(row) {
      var key = normalizeEojGroupField_(firstEojValue_(
        getEojRecordValue_(row, ['Source_Record_ID', 'Source Record ID']),
        getEojRecordValue_(row, ['EOJ_ID', 'EOJ ID'])
      ));
      if (!key) {
        key = [
          'timeline',
          normalizeEojDateScalar_(getEojRecordValue_(row, ['Event_Date', 'Event Date', 'Date'])),
          normalizeEojGroupField_(getEojRecordValue_(row, ['Actor'])),
          normalizeEojGroupField_(getEojRecordValue_(row, ['Job_Number', 'Job Number']))
        ].join(':');
      }
      if (!groups[key]) {
        groups[key] = [];
        groupOrder.push(key);
      }
      groups[key].push(row);
    });

    var reports = groupOrder.map(function(key) {
      return buildEojReportFromTimelineGroup_(key, groups[key]);
    }).filter(Boolean);

    reports.sort(sortEojReportsNewestFirst_);
    return reports;
  } catch (error) {
    Logger.log('getEojReportsForClaimFromTimeline_ error for ' + claimId + ': ' + formatEojError_(error));
    return [];
  }
}

function buildEojReportFromTimelineGroup_(groupKey, rows) {
  rows = rows || [];
  if (!rows.length) {
    return null;
  }

  var mergedDetails = {};
  var technician = '';
  var visitDate = '';
  var processedAt = '';
  var eojId = '';
  var summary = '';
  var eventTypes = [];

  rows.forEach(function(row) {
    var eventType = normalizeEojGroupField_(getEojRecordValue_(row, ['Event_Type', 'Event Type']));
    if (eventType) {
      eventTypes.push(eventType);
    }
    if (!technician) {
      technician = normalizeEojGroupField_(getEojRecordValue_(row, ['Actor']));
    }
    if (!visitDate) {
      visitDate = normalizeEojDateScalar_(getEojRecordValue_(row, ['Event_Date', 'Event Date', 'Date']));
    }
    if (!processedAt) {
      processedAt = normalizeEojDateScalar_(getEojRecordValue_(row, ['Created_At', 'Created At']));
    }
    if (!eojId) {
      eojId = normalizeEojGroupField_(getEojRecordValue_(row, ['Source_Record_ID', 'Source Record ID', 'EOJ_ID', 'EOJ ID']));
    }
    if (!summary) {
      summary = normalizeEojGroupField_(getEojRecordValue_(row, ['Summary']));
    }

    var parsedDetail = safeParseEojJsonValue_(getEojRecordValue_(row, ['Detail', 'Details']), {});
    Object.keys(parsedDetail).forEach(function(key) {
      if (mergedDetails[key] === undefined && eojHasValue_(parsedDetail[key])) {
        mergedDetails[key] = parsedDetail[key];
      }
    });
  });

  var report = {
    eojId: eojId || groupKey,
    source: 'Timeline_Events',
    dataSource: 'Timeline_Events',
    limited: true,
    isThinFallback: true,
    dataQuality: 'thin_timeline_fallback',
    submittedAt: processedAt || visitDate,
    processedAt: processedAt,
    visitDate: visitDate,
    visitType: normalizeEojGroupField_(mergedDetails.visit_type),
    technician: technician,
    jobStatus: normalizeEojGroupField_(mergedDetails.job_status),
    workPerformed: normalizeEojGroupField_(mergedDetails.work_performed),
    technicianNotes: normalizeEojGroupField_(mergedDetails.technician_notes),
    equipmentSummary: buildEojEquipmentSummaryText_(mergedDetails, {}, {}),
    waitingOn: normalizeEojGroupField_(mergedDetails.waiting_on),
    followUpRequired: coerceEojBoolean_(mergedDetails.follow_up_required, ''),
    followUpAssignedTo: normalizeEojGroupField_(mergedDetails.assigned_to),
    followUpDueDate: normalizeEojDateScalar_(mergedDetails.due_date),
    followUpDescription: normalizeEojGroupField_(mergedDetails.description || mergedDetails.follow_up_description),
    monitoringStatus: normalizeEojGroupField_(mergedDetails.monitoring_status),
    nextMonitoringDate: normalizeEojDateScalar_(mergedDetails.next_monitoring_date),
    asbestosTestNeeded: coerceEojBoolean_(mergedDetails.testing_required, ''),
    asbestosSamplesTaken: coerceEojBoolean_(mergedDetails.samples_taken, ''),
    asbestosSampleCount: mergedDetails.sample_count || '',
    asbestosHandler: normalizeEojGroupField_(mergedDetails.handler),
    x1SketchProvided: '',
    micaUpdated: firstEojValue_(mergedDetails.has_mica_activity, mergedDetails.mitigation_plan_updated, ''),
    micaDelayReason: normalizeEojGroupField_(mergedDetails.mica_delay_reason),
    micaExpectedDate: normalizeEojDateScalar_(mergedDetails.mica_expected_update_date),
    micaExpectedTime: '',
    reviewNeeded: '',
    reviewReasons: [],
    rawParsed: {},
    rawParsedKeys: [],
    eventTypesPresent: eventTypes
  };

  report.workSummary = report.workPerformed;
  report.collapsedSummary = summary || report.workPerformed || 'Limited EOJ timeline record';
  report.sortTimestamp = parseEojDateForSort_(report.processedAt) || parseEojDateForSort_(report.submittedAt) || parseEojDateForSort_(report.visitDate);
  report.submittedAtSort = report.sortTimestamp;
  report.fields = buildEojReportFields_(report);
  report.fields.unshift({
    label: 'Data Notice',
    value: 'Limited Timeline_Events fallback. Structured EOJ Details were blank for this card.'
  });
  if (eventTypes.length) {
    report.fields.push({
      label: 'Timeline Event Types',
      value: eventTypes.join(', ')
    });
  }

  return report;
}

function buildEojReportFields_(report) {
  var fields = [];

  addEojReportField_(fields, 'Visit Date', report.visitDate);
  addEojReportField_(fields, 'Technician', report.technician);
  addEojReportField_(fields, 'Visit Type', report.visitType);
  addEojReportField_(fields, 'Job Status', report.jobStatus);
  addEojReportField_(fields, 'Work Performed', report.workPerformed);
  addEojReportField_(fields, 'Technician Notes', report.technicianNotes);
  addEojReportField_(fields, 'Insurance Summary', report.insuranceSummary);
  addEojReportField_(fields, 'Equipment Summary', report.equipmentSummary);
  addEojReportField_(fields, 'Waiting On', report.waitingOn);
  addEojReportField_(fields, 'Follow-Up Required', report.followUpRequired);
  addEojReportField_(fields, 'Follow-Up Assigned To', report.followUpAssignedTo);
  addEojReportField_(fields, 'Follow-Up Due Date', report.followUpDueDate);
  addEojReportField_(fields, 'Follow-Up Description', report.followUpDescription);
  addEojReportField_(fields, 'Monitoring Status', report.monitoringStatus);
  addEojReportField_(fields, 'Next Monitoring Date', report.nextMonitoringDate);
  addEojReportField_(fields, 'Asbestos Test Needed', report.asbestosTestNeeded);
  addEojReportField_(fields, 'Asbestos Samples Taken', report.asbestosSamplesTaken);
  addEojReportField_(fields, 'Asbestos Sample Count', report.asbestosSampleCount);
  addEojReportField_(fields, 'Asbestos Handler', report.asbestosHandler);
  addEojReportField_(fields, 'X1 Sketch Provided', report.x1SketchProvided);
  addEojReportField_(fields, 'MICA Updated', report.micaUpdated);
  addEojReportField_(fields, 'MICA Delay Reason', report.micaDelayReason);
  addEojReportField_(fields, 'MICA Expected Date', report.micaExpectedDate);
  addEojReportField_(fields, 'MICA Expected Time', report.micaExpectedTime);
  addEojReportField_(fields, 'Review Needed', report.reviewNeeded);
  addEojReportField_(fields, 'Review Reasons', report.reviewReasons);
  addEojReportField_(fields, 'Processed At', report.processedAt);

  return fields;
}

function addEojReportField_(fields, label, value) {
  if (!eojHasValue_(value)) {
    return;
  }
  fields.push({
    label: label,
    value: formatEojValueForField_(value)
  });
}

function buildEojEquipmentSummaryText_(equipmentOutput, rawParsed, logRecord) {
  equipmentOutput = equipmentOutput || {};
  rawParsed = rawParsed || {};
  logRecord = logRecord || {};

  var summary = normalizeEojGroupField_(firstEojValue_(
    equipmentOutput.summary,
    getNestedEojValue_(rawParsed, ['equipmentSummary']),
    getNestedEojValue_(rawParsed, ['equipment', 'notes'])
  ));
  if (summary) {
    return summary;
  }

  var added = numberFromEojValue_(firstEojValue_(
    equipmentOutput.total_added,
    sumEojEquipmentLogCounts_(logRecord, ['Air_Movers_Added', 'Dehumidifiers_Added', 'HEPA_Added'])
  ));
  var removed = numberFromEojValue_(firstEojValue_(
    equipmentOutput.total_removed,
    sumEojEquipmentLogCounts_(logRecord, ['Air_Movers_Removed', 'Dehumidifiers_Removed', 'HEPA_Removed'])
  ));
  var onSite = numberFromEojValue_(firstEojValue_(
    equipmentOutput.total_on_site_after_visit,
    sumEojEquipmentLogCounts_(logRecord, ['Air_Movers_After', 'Dehumidifiers_After', 'HEPA_After'])
  ));

  if (!added && !removed && !onSite) {
    return '';
  }

  var parts = [];
  if (added) {
    parts.push(added + ' added');
  }
  if (removed) {
    parts.push(removed + ' removed');
  }
  parts.push(onSite + ' on site after visit');

  return parts.join(', ');
}

function sumEojEquipmentLogCounts_(record, headers) {
  if (!record) {
    return '';
  }

  var total = 0;
  var sawValue = false;
  (headers || []).forEach(function(header) {
    var value = getEojRecordValue_(record, [header]);
    if (eojHasValue_(value)) {
      total += numberFromEojValue_(value);
      sawValue = true;
    }
  });

  return sawValue ? total : '';
}

function getEojTimelineEvents_(timelineOutput) {
  if (Array.isArray(timelineOutput)) {
    return timelineOutput;
  }
  if (timelineOutput && Array.isArray(timelineOutput.events)) {
    return timelineOutput.events;
  }
  return [];
}

function getEojTimelineDetailsByType_(timelineOutput, eventTypes) {
  var normalizedTypes = {};
  (eventTypes || []).forEach(function(type) {
    normalizedTypes[normalizeEojGroupField_(type).toLowerCase()] = true;
  });

  var events = getEojTimelineEvents_(timelineOutput);
  for (var i = 0; i < events.length; i++) {
    var event = events[i] || {};
    var eventType = normalizeEojGroupField_(event.event_type || event.Event_Type || event.type).toLowerCase();
    if (normalizedTypes[eventType]) {
      return event.details || event.Details || {};
    }
  }

  return {};
}

function getEojTimelineDetailsWithAnyKey_(timelineOutput, keys) {
  var events = getEojTimelineEvents_(timelineOutput);

  for (var i = 0; i < events.length; i++) {
    var details = (events[i] && (events[i].details || events[i].Details)) || {};
    for (var j = 0; j < keys.length; j++) {
      if (eojHasValue_(details[keys[j]])) {
        return details;
      }
    }
  }

  return {};
}

function mergeEojObjects_() {
  var merged = {};

  for (var i = 0; i < arguments.length; i++) {
    var object = arguments[i] || {};
    Object.keys(object).forEach(function(key) {
      if (eojHasValue_(object[key])) {
        merged[key] = object[key];
      }
    });
  }

  return merged;
}

function getEojRecordValue_(record, keys) {
  record = record || {};
  keys = keys || [];

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (eojHasValue_(record[key])) {
      return record[key];
    }
    var normalizedKey = normalizeEojHeaderName_(key);
    if (eojHasValue_(record[normalizedKey])) {
      return record[normalizedKey];
    }
  }

  return '';
}

function getNestedEojValue_(object, path) {
  if (!object || !path || !path.length) {
    return '';
  }

  var current = object;
  for (var i = 0; i < path.length; i++) {
    if (current === null || current === undefined || current[path[i]] === undefined) {
      return '';
    }
    current = current[path[i]];
  }
  return current;
}

function firstEojValue_() {
  for (var i = 0; i < arguments.length; i++) {
    if (eojHasValue_(arguments[i])) {
      return arguments[i];
    }
  }
  return '';
}

function eojHasValue_(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

function normalizeEojGroupField_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value === null || value === undefined ? '' : value).trim();
}

function normalizeEojHeaderName_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

function safeParseEojJsonValue_(value, fallback) {
  if (!eojHasValue_(value)) {
    return fallback || {};
  }
  if (typeof value === 'object' && !(value instanceof Date)) {
    return value;
  }

  var text = String(value || '').trim();
  if (!text || (text.charAt(0) !== '{' && text.charAt(0) !== '[')) {
    return fallback || {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback || {};
  }
}

function coerceEojBoolean_(value, fallback) {
  if (!eojHasValue_(value)) {
    return fallback;
  }
  if (value === true || value === false) {
    return value;
  }
  if (typeof value === 'number') {
    return value > 0;
  }

  var normalized = String(value).toLowerCase().trim();
  if (['yes', 'true', 'needed', 'required', 'active', 'complete', 'completed', '1'].indexOf(normalized) !== -1) {
    return true;
  }
  if (['no', 'false', 'not needed', 'not required', 'inactive', 'none', '0'].indexOf(normalized) !== -1) {
    return false;
  }

  return value;
}

function numberFromEojValue_(value) {
  var numberValue = Number(value);
  return isNaN(numberValue) ? 0 : numberValue;
}

function normalizeEojDateScalar_(value) {
  if (!eojHasValue_(value)) {
    return '';
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value);
}

function parseEojDateForSort_(value) {
  if (!value) {
    return 0;
  }
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function getEojRecordSortTimestamp_(record) {
  return parseEojDateForSort_(firstEojValue_(
    getEojRecordValue_(record, ['Processed_At', 'Processed At']),
    getEojRecordValue_(record, ['Submitted_At', 'Submitted At']),
    getEojRecordValue_(record, ['Visit_Date', 'Visit Date'])
  ));
}

function sortEojReportsNewestFirst_(a, b) {
  var aTime = (a && a.sortTimestamp) || 0;
  var bTime = (b && b.sortTimestamp) || 0;
  return bTime - aTime;
}

function formatEojValueForField_(value) {
  if (value === true) {
    return 'Yes';
  }
  if (value === false) {
    return 'No';
  }
  if (Array.isArray(value)) {
    return value.join('; ');
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
}

function pickEojRawParsedUiFields_(rawParsed) {
  rawParsed = rawParsed || {};
  var keys = [
    'technician', 'jobName', 'claimNumber', 'claimId', 'customerName',
    'propertyAddress', 'visitDate', 'visitType', 'workPerformed',
    'technicianNotes', 'otherVisitNotes', 'remainingWork', 'jobStatus',
    'forInsuranceSummary', 'workSummaryForInsurance', 'insuranceSummary',
    'equipmentSummary', 'equipment', 'waitingOn', 'followUpNeeded',
    'followUpAction', 'followUpAssignedTo', 'followUpNote',
    'followUpDescription', 'followUpDueDate', 'monitoringStatus',
    'monitoringNotes', 'nextMonitoringNeeded', 'nextMonitoringDate',
    'nextMonitoringWindow', 'asbestosTestNeeded', 'asbestosHandler',
    'asbestosSamplesTaken', 'asbestosSampleCount',
    'asbestosFollowUpDescription', 'x1SketchProvided', 'micaUpdated',
    'micaDelayReason', 'micaExpectedDate', 'micaExpectedTime',
    'micaExpectedUpdateDate', 'mitigationPlanUpdated',
    'mitigationPlanSummary', 'demoPerformed', 'flooringRemoved',
    'itelSampleStatus', 'itelNotes', 'equipmentPickedUp',
    'fieldWorkComplete'
  ];
  var picked = {};

  keys.forEach(function(key) {
    if (eojHasValue_(rawParsed[key])) {
      picked[key] = rawParsed[key];
    }
  });

  return picked;
}

function formatEojError_(error) {
  return error && error.message ? error.message : String(error || 'Unknown error');
}

function testGetEojReportsForKnownClaim() {
  var claimId = 'CLM-20260626-495576';
  var reports = getEojReportsForClaim_(claimId);
  Logger.log('testGetEojReportsForKnownClaim count: ' + reports.length);
  Logger.log(JSON.stringify(reports.slice(0, 2), null, 2));
  return {
    claimId: claimId,
    count: reports.length,
    reports: reports.slice(0, 2)
  };
}

function testGroupedEojTimelineForKnownClaim() {
  var claimId = 'CLM-20260626-495576';
  var timeline = getWorkspaceTimelineForClaim_(claimId);
  var rawEvents = Array.isArray(timeline.rawEvents) ? timeline.rawEvents : [];
  var displayEvents = Array.isArray(timeline.events) ? timeline.events : [];
  var rawEojEvents = rawEvents.filter(isWorkspaceTimelineEojEvent_);
  var groupedEojEvents = displayEvents.filter(function(event) {
    return event && event.isEojGrouped === true;
  });

  var result = {
    claimId: claimId,
    rawTimelineCount: rawEvents.length,
    displayTimelineCount: displayEvents.length,
    rawEojSubEventCount: rawEojEvents.length,
    groupedEojDisplayCount: groupedEojEvents.length,
    groupedEojEvents: groupedEojEvents.map(function(event) {
      return {
        eojId: event.eojId || '',
        title: event.summary || event.title || '',
        date: event.eventDate || event.date || '',
        eojEventCount: event.eojEventCount || 0,
        groupedEventTypes: event.groupedEventTypes || []
      };
    })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testClaimDetailTimeline() {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  if (!claims.length) {
    throw new Error('No claims available for testing.');
  }

  var timeline = getWorkspaceTimelineForClaim_(claims[0].claimId);

  Logger.log(JSON.stringify(timeline, null, 2));

  return timeline;
}

function testClaimDetail() {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  if (!claims.length) {
    throw new Error('No claims available for testing.');
  }

  var detail = getClaimDetail(claims[0].claimId);

  Logger.log(JSON.stringify(detail, null, 2));

  return detail;
}

/**
 * testFullClaimLatestNotes(claimId)
 *
 * Diagnostic: traces the notes pipeline for a specific claim.
 * Logs raw Timeline_Events rows, what ClaimDetailService returns,
 * and whether each note would render in the Full Claim Workspace.
 *
 * Run from the Apps Script editor with a real claimId to diagnose
 * why notes are (or aren't) appearing in the Full Claim Workspace.
 */
function testFullClaimLatestNotes(claimId) {
  if (!claimId) {
    var claims = ClaimsQueryService.getAllClaimSummaries({});
    claimId = claims.length ? claims[0].claimId : null;
  }

  if (!claimId) {
    Logger.log('testFullClaimLatestNotes: no claimId available');
    return;
  }

  Logger.log('=== testFullClaimLatestNotes: ' + claimId + ' ===');

  // 1. Read raw Timeline_Events sheet directly
  var ss = SpreadsheetApp.openById(CLAIMS_DATABASE_SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Timeline_Events');
  var rawNoteRows = [];
  var allRawRows = [];

  if (sheet && sheet.getLastRow() > 1) {
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(h) { return String(h || '').trim(); });
    var claimIdIdx = headers.indexOf('Claim ID') !== -1 ? headers.indexOf('Claim ID') : headers.indexOf('Claim_ID');
    var dateIdx = headers.indexOf('Date') !== -1 ? headers.indexOf('Date') : headers.indexOf('Event_Date');
    var typeIdx = headers.indexOf('Event Type') !== -1 ? headers.indexOf('Event Type') : headers.indexOf('Event_Type');
    var sourceIdx = headers.indexOf('Source') !== -1 ? headers.indexOf('Source') : headers.indexOf('Event_Source');
    var summaryIdx = headers.indexOf('Summary');

    for (var i = 1; i < values.length; i++) {
      var rowClaimId = String(claimIdIdx >= 0 ? values[i][claimIdIdx] : '').trim();
      if (!rowClaimId) continue;
      var matchesClaimId = rowClaimId === claimId || rowClaimId === claimId.replace(/^CLM-/, '');
      if (!matchesClaimId) continue;

      var rowDate = dateIdx >= 0 ? values[i][dateIdx] : '';
      var rowType = typeIdx >= 0 ? String(values[i][typeIdx] || '').trim() : '';
      var rowSource = sourceIdx >= 0 ? String(values[i][sourceIdx] || '').trim() : '';
      var rowSummary = summaryIdx >= 0 ? String(values[i][summaryIdx] || '').substring(0, 80) : '';

      allRawRows.push({ rowNum: i + 1, claimId: rowClaimId, date: rowDate, type: rowType, source: rowSource, summary: rowSummary });

      var combined = (rowType + ' ' + rowSource).toLowerCase();
      if (combined.indexOf('note') !== -1 || combined.indexOf('historical') !== -1 ||
          combined.indexOf('communication') !== -1 || combined.indexOf('email') !== -1) {
        rawNoteRows.push({ rowNum: i + 1, claimId: rowClaimId, date: rowDate, type: rowType, source: rowSource, summary: rowSummary });
      }
    }

    allRawRows.sort(function(a, b) {
      return normalizeWorkspaceTimelineDate_(b.date).getTime() - normalizeWorkspaceTimelineDate_(a.date).getTime();
    });
    rawNoteRows.sort(function(a, b) {
      return normalizeWorkspaceTimelineDate_(b.date).getTime() - normalizeWorkspaceTimelineDate_(a.date).getTime();
    });
  }

  Logger.log('--- Raw Timeline_Events: latest 10 rows for claim ---');
  Logger.log(JSON.stringify(allRawRows.slice(0, 10), null, 2));
  Logger.log('Total raw rows for claim: ' + allRawRows.length);

  Logger.log('--- Raw Timeline_Events: latest 10 note-type rows ---');
  Logger.log(JSON.stringify(rawNoteRows.slice(0, 10), null, 2));
  Logger.log('Total raw note rows for claim: ' + rawNoteRows.length);

  // 2. What getWorkspaceTimelineForClaim_ returns
  var timeline = getWorkspaceTimelineForClaim_(claimId);
  Logger.log('--- getWorkspaceTimelineForClaim_ result ---');
  Logger.log('events returned: ' + timeline.events.length + ' (of ' + timeline.count + ' total)');
  Logger.log('event dates: ' + timeline.events.map(function(e) {
    return String(e.eventDate || e.date || '').substring(0, 10) + '/' + String(e.eventType || e.source || '').substring(0, 18);
  }).join(', '));

  // 3. Which events are note-type in the returned set
  var serviceNotes = timeline.events.filter(function(evt) {
    var type = String(evt.eventType || evt.type || '').toLowerCase();
    var src = String(evt.source || evt.sourceSystem || '').toLowerCase();
    var sum = String(evt.summary || '').toLowerCase();
    var combined = type + ' ' + src + ' ' + sum;
    return combined.indexOf('note') !== -1 || combined.indexOf('historical') !== -1 ||
           combined.indexOf('communication') !== -1 || combined.indexOf('email') !== -1;
  });

  Logger.log('--- Note-type events in service payload (' + serviceNotes.length + ') ---');
  Logger.log(JSON.stringify(serviceNotes.map(function(e) {
    return { date: e.eventDate, type: e.eventType, source: e.source, summary: String(e.summary || '').substring(0, 60) };
  }), null, 2));

  // 4. Verdict
  Logger.log('--- Diagnosis ---');
  Logger.log('Raw note rows in sheet: ' + rawNoteRows.length);
  Logger.log('Total raw rows for claim in sheet: ' + allRawRows.length);
  Logger.log('Events returned by service: ' + timeline.events.length + ' (cap was 25, now 200)');
  Logger.log('Note-type events in service payload: ' + serviceNotes.length);
  if (rawNoteRows.length > 0 && serviceNotes.length === 0) {
    Logger.log('ISSUE: notes present in sheet but not in service payload — check sort order and event cap');
  } else if (rawNoteRows.length === 0) {
    Logger.log('ISSUE: no note-type rows found in sheet for this claim — check import or Claim_ID match');
  } else {
    Logger.log('OK: notes are present in sheet and visible in service payload');
  }

  return {
    claimId: claimId,
    rawTotalRows: allRawRows.length,
    rawNoteRows: rawNoteRows.length,
    serviceEventsReturned: timeline.events.length,
    serviceNoteEvents: serviceNotes.length,
    top10RawRows: allRawRows.slice(0, 10),
    top10RawNoteRows: rawNoteRows.slice(0, 10),
    serviceNotes: serviceNotes
  };
}

/**
 * buildWorkspaceContext_
 *
 * Builds a concise, self-contained workspace context object from already-computed
 * claimFoundation and operationalIntelligence objects. No additional Sheets reads.
 *
 * @param {object} claimFoundation       - canonical foundation from buildClaimFoundation_()
 * @param {object} operationalIntelligence - OI object from buildOperationalIntelligence_()
 * @param {object} detail                - the full detail object (for safe fallbacks only)
 * @returns {object} workspaceContext
 */
function buildWorkspaceContext_(claimFoundation, operationalIntelligence, detail) {
  claimFoundation = claimFoundation || {};
  operationalIntelligence = operationalIntelligence || {};
  detail = detail || {};

  var oiHealth = operationalIntelligence.health || {};
  var oiLifecycle = operationalIntelligence.lifecycle || {};
  var oiOwnership = operationalIntelligence.ownership || {};
  var oiConditions = operationalIntelligence.conditions || {};
  var oiAlerts = operationalIntelligence.alerts || {};
  var oiRequirements = operationalIntelligence.requirements || {};
  var oiNextAction = operationalIntelligence.nextAction || {};
  var oiSummary = operationalIntelligence.operationalSummary || {};
  var cfSummary = claimFoundation.summary || {};

  // --- claim identity ---
  var claimId = getFullClaimFirstValue_([claimFoundation.claimId, detail.claimId]) || '';
  var claimNumber = getFullClaimFirstValue_([claimFoundation.claimNumber, detail.claimNumber]) || '';
  var jobNumber = getFullClaimFirstValue_([claimFoundation.jobNumber, detail.jobNumber]) || '';
  var displayName = getFullClaimFirstValue_([claimFoundation.displayName, detail.displayName]) || '';
  var customerName = getFullClaimFirstValue_([claimFoundation.customerName, detail.customerName]) || '';
  var propertyAddress = getFullClaimFirstValue_([claimFoundation.propertyAddress, detail.propertyAddress]) || '';

  // --- owner ---
  var ownerArea = getFullClaimFirstValue_([oiOwnership.area, claimFoundation.ownership && claimFoundation.ownership.area]) || 'Not recorded';
  var primaryOwner = getFullClaimFirstValue_([oiOwnership.primaryOwner, claimFoundation.ownership && claimFoundation.ownership.primaryOwner]) || 'Not recorded';
  var ownerLabel = getFullClaimFirstValue_([oiOwnership.ownerLabel, claimFoundation.ownership && claimFoundation.ownership.ownerLabel]) || 'Unassigned';

  // --- health ---
  var healthLevel = getFullClaimFirstValue_([oiHealth.level, claimFoundation.health && claimFoundation.health.level]) || 'Not rated';
  var healthReason = getFullClaimFirstValue_([oiHealth.reason, claimFoundation.health && claimFoundation.health.reason]) || '';
  var healthPriority = (typeof oiHealth.priority === 'number') ? oiHealth.priority : ((claimFoundation.health && claimFoundation.health.priority) || 5);
  var daysSinceMeaningfulActivity = (typeof oiHealth.daysSinceMeaningfulActivity === 'number') ? oiHealth.daysSinceMeaningfulActivity : 0;

  // --- lifecycle ---
  var lifecycleState = getFullClaimFirstValue_([oiLifecycle.state, claimFoundation.lifecycle && claimFoundation.lifecycle.state]) || 'Not recorded';
  var lifecycleReason = getFullClaimFirstValue_([oiLifecycle.reason, claimFoundation.lifecycle && claimFoundation.lifecycle.reason]) || '';

  // --- waitingOn, operationalPriority, staleRisk ---
  var waitingOn = getFullClaimFirstValue_([operationalIntelligence.waitingOn]) || 'Unknown';
  var operationalPriority = getFullClaimFirstValue_([operationalIntelligence.operationalPriority]) || 'Normal';
  var staleRisk = operationalIntelligence.staleRisk === true;

  // --- nextAction ---
  var nextActionTitle = getFullClaimFirstValue_([oiNextAction.title, claimFoundation.nextAction && claimFoundation.nextAction.label]) || 'No recommended action';
  var nextActionReason = getFullClaimFirstValue_([oiNextAction.reason, claimFoundation.nextAction && claimFoundation.nextAction.reason]) || '';
  var nextActionOwner = getFullClaimFirstValue_([oiNextAction.owner, primaryOwner]) || '';
  var nextActionGeneratedBy = getFullClaimFirstValue_([oiNextAction.generatedBy]) || '';

  // --- attentionReason ---
  var attentionReason = getFullClaimFirstValue_([
    claimFoundation.nextAction && claimFoundation.nextAction.reason,
    detail.claimHeader && detail.claimHeader.attentionReason,
    detail.operationalContext && detail.operationalContext.attentionReason
  ]) || '';

  // --- alerts ---
  var alertCount = (typeof oiAlerts.count === 'number') ? oiAlerts.count : ((claimFoundation.alerts && claimFoundation.alerts.count) || 0);
  var highestSeverity = getFullClaimFirstValue_([oiAlerts.highestSeverity, claimFoundation.alerts && claimFoundation.alerts.highestSeverity]) || '';
  var activeAlerts = Array.isArray(oiAlerts.active) ? oiAlerts.active : (Array.isArray(claimFoundation.alerts && claimFoundation.alerts.active) ? claimFoundation.alerts.active : []);

  // --- conditions ---
  var activeConditions = Array.isArray(oiConditions.active) ? oiConditions.active : (Array.isArray(claimFoundation.conditions && claimFoundation.conditions.active) ? claimFoundation.conditions.active : []);
  var primaryCondition = getFullClaimFirstValue_([oiConditions.primaryCondition, claimFoundation.conditions && claimFoundation.conditions.primaryCondition]) || 'No active condition';
  var conditionsWaitingOn = getFullClaimFirstValue_([oiConditions.waitingOn, claimFoundation.conditions && claimFoundation.conditions.waitingOn]) || 'No active condition';

  // --- requirements ---
  var openRequirements = Array.isArray(oiRequirements.open) ? oiRequirements.open : (Array.isArray(claimFoundation.requirements && claimFoundation.requirements.open) ? claimFoundation.requirements.open : []);
  var requirementCount = (typeof oiRequirements.count === 'number') ? oiRequirements.count : openRequirements.length;

  // --- lastMeaningfulActivity ---
  var lastMeaningfulActivity = getFullClaimFirstValue_([
    operationalIntelligence.lastMeaningfulActivity,
    oiHealth.lastMeaningfulActivity,
    claimFoundation.health && claimFoundation.health.lastMeaningfulActivity
  ]) || '';

  // --- summary ---
  var operationalSummaryText = getFullClaimFirstValue_([oiSummary.text, cfSummary.operationalSummary]) || '';
  var supportingText = getFullClaimFirstValue_([oiSummary.supportingText, cfSummary.supportingText]) || '';
  var summaryFacts = Array.isArray(oiSummary.facts) ? oiSummary.facts : (Array.isArray(cfSummary.facts) ? cfSummary.facts : []);

  // --- timelineHighlights — first 5 events, no re-fetch ---
  var timelineEvents = [];

  if (claimFoundation.timeline && Array.isArray(claimFoundation.timeline.events)) {
    timelineEvents = claimFoundation.timeline.events;
  } else if (operationalIntelligence.timeline && Array.isArray(operationalIntelligence.timeline.events)) {
    timelineEvents = operationalIntelligence.timeline.events;
  }

  var timelineHighlights = timelineEvents.slice(0, 5);

  // --- financialTracks ---
  var financialTracks = Array.isArray(claimFoundation.financialTracks) ? claimFoundation.financialTracks : [];

  return {
    claim: {
      claimId: claimId,
      claimNumber: claimNumber,
      jobNumber: jobNumber,
      displayName: displayName,
      customerName: customerName,
      propertyAddress: propertyAddress
    },
    owner: {
      area: ownerArea,
      primaryOwner: primaryOwner,
      ownerLabel: ownerLabel
    },
    health: {
      level: healthLevel,
      reason: healthReason,
      priority: healthPriority,
      daysSinceMeaningfulActivity: daysSinceMeaningfulActivity
    },
    lifecycle: {
      state: lifecycleState,
      reason: lifecycleReason
    },
    waitingOn: waitingOn,
    operationalPriority: operationalPriority,
    staleRisk: staleRisk,
    nextAction: {
      title: nextActionTitle,
      reason: nextActionReason,
      owner: nextActionOwner,
      generatedBy: nextActionGeneratedBy
    },
    attentionReason: attentionReason,
    alerts: {
      count: alertCount,
      highestSeverity: highestSeverity,
      active: activeAlerts
    },
    conditions: {
      active: activeConditions,
      primaryCondition: primaryCondition,
      waitingOn: conditionsWaitingOn
    },
    requirements: {
      open: openRequirements,
      count: requirementCount
    },
    lastMeaningfulActivity: lastMeaningfulActivity,
    summary: {
      operationalSummary: operationalSummaryText,
      supportingText: supportingText,
      facts: summaryFacts
    },
    timelineHighlights: timelineHighlights,
    financialTracks: financialTracks,
    generatedAt: new Date().toISOString()
  };
}

var ClaimDetailService = {
  getClaimDetail: getClaimDetail,
  testClaimDetail: testClaimDetail,
  testClaimDetailTimeline: testClaimDetailTimeline,
  testGroupedEojTimelineForKnownClaim: testGroupedEojTimelineForKnownClaim,
  testGetEojReportsForKnownClaim: testGetEojReportsForKnownClaim
};
