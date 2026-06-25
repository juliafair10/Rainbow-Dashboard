/**
 * Phase 9
 * Claim Detail Service
 *
 * Full Claim Workspace payload.
 */

function getClaimDetail(claimId) {
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var drawer = ClaimDrawerService.getClaimDrawer(claimId);
  var externalLinks = ClaimExternalLinkService.getClaimExternalLinks(claimId);
  var financialTracks = ClaimFinancialTrackService.getClaimFinancialTracks(claimId);
  var timeline = getWorkspaceTimelineForClaim_(claimId);
  var fullClaimTimeline = buildFullClaimTimelineModel_(timeline.events);
  var workspaceSummary = typeof enrichClaimWorkspaceSummary_ === 'function'
    ? enrichClaimWorkspaceSummary_(drawer.claimSummary)
    : drawer.claimSummary;

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
  var claimFoundation = (typeof buildClaimFoundation_ === 'function')
    ? buildClaimFoundation_(claimId, detail)
    : null;

  detail.fullClaimHeader = buildFullClaimHeaderModel_(detail, claimFoundation);
  detail.fullClaimOperationalSummary = buildFullClaimOperationalSummaryModel_(detail, detail.fullClaimHeader, claimFoundation);
  detail.fullClaimCurrentState = buildFullClaimCurrentStateModel_(detail, detail.fullClaimHeader, claimFoundation);
  detail.operationalSummary = detail.fullClaimOperationalSummary;

  detail.claimFoundation = claimFoundation;

  return detail;
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

function normalizeClaimLifecycle_(detail) {
  detail = detail || {};

  return getFullClaimFirstValue_([
    detail.claimHeader && detail.claimHeader.lifecycleState,
    detail.lifecycleState
  ]) || 'Not recorded';
}

function normalizeClaimHealth_(detail) {
  detail = detail || {};

  return getFullClaimFirstValue_([
    detail.claimHeader && detail.claimHeader.healthLevel,
    detail.healthLevel
  ]) || 'Not rated';
}

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

function getOpenRequirementCount_(detail) {
  return getFullClaimOpenRequirements_(detail).length;
}

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
    detail: detail
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

function getWorkspaceTimelineForClaim_(claimId) {
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

        return {
          count: timelineResponse.data.count || normalizedTimelineEvents.length,
          events: normalizedTimelineEvents.slice(0, 25),
          recentEvents: normalizedTimelineEvents.slice(0, 5)
        };
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

    return {
      count: events.length,
      events: events.slice(0, 25),
      recentEvents: events.slice(0, 5)
    };
  } catch (error) {
    Logger.log('Workspace timeline unavailable for ' + claimId + ': ' + error);
    return {
      count: 0,
      events: [],
      recentEvents: []
    };
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

var ClaimDetailService = {
  getClaimDetail: getClaimDetail,
  testClaimDetail: testClaimDetail,
  testClaimDetailTimeline: testClaimDetailTimeline
};
