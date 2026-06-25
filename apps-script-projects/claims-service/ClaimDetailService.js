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

  detail.fullClaimHeader = buildFullClaimHeaderModel_(detail);
  detail.fullClaimOperationalSummary = buildFullClaimOperationalSummaryModel_(detail, detail.fullClaimHeader);
  detail.operationalSummary = detail.fullClaimOperationalSummary;

  return detail;
}

function buildFullClaimHeaderModel_(detail) {
  detail = detail || {};

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  var owner = normalizeClaimOwner_(detail);
  var lifecycleState = normalizeClaimLifecycle_(detail);
  var healthLevel = normalizeClaimHealth_(detail);
  var primaryCondition = getPrimaryClaimCondition_(detail);
  var openRequirementCount = getOpenRequirementCount_(detail);
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
  var lastMeaningfulActivity = getFullClaimFirstValue_([
    header.lastMeaningfulActivityAt,
    header.lastMeaningfulActivityDate,
    operational.lastMeaningfulActivityAt,
    operational.lastMeaningfulActivityDate,
    operational.recentActivitySummary,
    detail.lastMeaningfulActivityAt,
    detail.lastMeaningfulActivityDate
  ]);
  var nextAction = getFullClaimFirstValue_([
    header.nextAction,
    operational.nextAction,
    detail.nextAction
  ]);
  var waitingOn = primaryCondition === 'No active condition'
    ? 'No active condition'
    : primaryCondition;

  return {
    eyebrow: 'Full Claim Workspace',
    title: title,
    claimId: detail.claimId || header.claimId || '',
    claimNumber: claimNumber || 'Not recorded',
    jobNumber: jobNumber,
    propertyAddress: propertyAddress,
    lifecycleState: lifecycleState,
    healthLevel: healthLevel,
    ownershipArea: owner.ownershipArea,
    primaryOwner: owner.primaryOwner,
    ownerLabel: owner.ownerLabel,
    primaryCondition: primaryCondition,
    lastMeaningfulActivity: lastMeaningfulActivity || 'Not recorded',
    waitingOn: waitingOn,
    nextAction: nextAction || 'No recommended action recorded',
    openRequirementCount: openRequirementCount,
    openRequirementsLabel: openRequirementCount > 0
      ? openRequirementCount + (openRequirementCount === 1 ? ' open requirement' : ' open requirements')
      : 'No open requirements',
    activeConditions: getFullClaimActiveConditions_(detail),
    openRequirements: getFullClaimOpenRequirements_(detail)
  };
}

function buildFullClaimOperationalSummaryModel_(detail, headerModel) {
  detail = detail || {};
  headerModel = headerModel || buildFullClaimHeaderModel_(detail);

  var header = detail.claimHeader || {};
  var operational = detail.operationalContext || {};
  var lifecycleState = getFullClaimDisplayValue_(headerModel.lifecycleState, 'Not recorded');
  var healthLevel = getFullClaimDisplayValue_(headerModel.healthLevel, 'Not rated');
  var primaryCondition = getFullClaimDisplayValue_(headerModel.primaryCondition, 'No active condition');
  var nextAction = getFullClaimFirstValue_([
    header.nextAction,
    operational.nextAction,
    detail.nextAction
  ]);
  var attentionReason = getFullClaimFirstValue_([
    header.attentionReason,
    operational.attentionReason,
    header.healthReason,
    operational.healthReason
  ]);
  var owner = normalizeClaimOwner_(detail);
  var openRequirementCount = getOpenRequirementCount_(detail);
  var statePhrase = lifecycleState === 'Not recorded'
    ? 'limited recorded state data'
    : lifecycleState;
  var healthPhrase = healthLevel === 'Not rated'
    ? ''
    : ' with ' + healthLevel + ' health';
  var trackingPhrase = primaryCondition !== 'No active condition'
    ? 'Rainbow is tracking ' + primaryCondition
    : attentionReason
      ? 'Rainbow is tracking ' + truncateFullClaimPhrase_(attentionReason, 120)
      : 'Rainbow is tracking current status and requirements as details are recorded';
  var ownerPhrase = '';

  if (owner.primaryOwner !== 'Not recorded') {
    ownerPhrase = owner.primaryOwner + ' owns the next action';
  } else if (owner.ownershipArea !== 'Not recorded') {
    ownerPhrase = 'The ' + owner.ownershipArea + ' ownership area owns the next action';
  } else {
    ownerPhrase = 'Ownership is not recorded yet';
  }

  var actionPhrase = nextAction
    ? 'the recommended next action is ' + stripFullClaimEndingPunctuation_(truncateFullClaimPhrase_(nextAction, 120))
    : openRequirementCount > 0
      ? 'there ' + (openRequirementCount === 1 ? 'is 1 open requirement' : 'are ' + openRequirementCount + ' open requirements') + ' to review'
      : 'no open requirements are recorded right now';
  var summaryText = 'This claim currently shows ' + statePhrase + healthPhrase + ', and ' + trackingPhrase + '. ' +
    ownerPhrase + ', and ' + actionPhrase + '.';

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
        label: 'Next action',
        value: nextAction || 'Not recorded'
      }
    ]
  };
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
