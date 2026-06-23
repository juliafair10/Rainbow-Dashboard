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

  return {
    claimId: claimId,

    claimHeader: {
      claimId: workspaceSummary.claimId,
      customerName: workspaceSummary.customerName,
      displayName: workspaceSummary.displayName,
      claimNumber: workspaceSummary.claimNumber,
      jobNumber: workspaceSummary.jobNumber,
      address: workspaceSummary.address,
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
      nextAction: workspaceSummary.nextAction,
      attentionReason: workspaceSummary.attentionReason || '',
      openRequirements: workspaceSummary.openRequirements || [],
      blockers: [],
      currentCadence: null,
      upcomingScheduledWork: drawer.upcomingCalendarEvents,
      recentActivitySummary: workspaceSummary.lastMeaningfulActivityDate,
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
