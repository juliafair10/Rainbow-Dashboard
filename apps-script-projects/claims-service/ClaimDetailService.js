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

  return {
    claimId: claimId,

    claimHeader: {
      claimId: drawer.claimSummary.claimId,
      customerName: drawer.claimSummary.customerName,
      displayName: drawer.claimSummary.displayName,
      claimNumber: drawer.claimSummary.claimNumber,
      address: drawer.claimSummary.address,
      lifecycleState: drawer.lifecycleState,
      ownershipArea: drawer.ownership.ownershipArea,
      primaryOwner: drawer.ownership.primaryOwner,
      healthLevel: drawer.operationalHealth.level,
      healthReason: drawer.operationalHealth.reason,
      activeConditions: drawer.activeConditions,
      activeAlerts: drawer.activeAlerts
    },

    timelineSection: {
      timelineEvents: timeline.events,
      timelineCount: timeline.count,
      timelineSummary: timeline.count > 0
        ? 'Timeline events loaded from Rainbow Claims Database.'
        : 'No timeline events found in Rainbow Claims Database.'
    },

    operationalContext: {
      nextAction: drawer.claimSummary.nextAction,
      blockers: [],
      currentCadence: null,
      upcomingScheduledWork: drawer.upcomingCalendarEvents,
      recentActivitySummary: drawer.claimSummary.lastMeaningfulActivityDate,
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
    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName('Timeline_Events');

    if (!sheet) {
      return {
        count: 0,
        events: []
      };
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return {
        count: 0,
        events: []
      };
    }

    var headerRowIndex = values[0].indexOf('Event ID') !== -1 ? 0 : 1;
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
      var recordClaimId = String(record['Claim ID'] || '');
      var recordJobNumber = String(record['Job Number'] || '');

      return recordClaimId === normalizedClaimId ||
             recordClaimId === normalizedJobNumber ||
             recordJobNumber === normalizedClaimId ||
             recordJobNumber === normalizedJobNumber;
    }).map(function(record) {
      return {
        eventId: record['Event ID'] || '',
        claimId: record['Claim ID'] || '',
        jobNumber: record['Job Number'] || '',
        eventDate: record['Date'] || '',
        source: record['Source'] || '',
        eventType: record['Event Type'] || '',
        actor: record['Actor'] || '',
        summary: record['Summary'] || '',
        details: record['Details'] || '',
        visibility: record['Visibility'] || ''
      };
    }).sort(function(a, b) {
      return new Date(b.eventDate || 0) - new Date(a.eventDate || 0);
    });

    return {
      count: events.length,
      events: events.slice(0, 25)
    };
  } catch (error) {
    Logger.log('Workspace timeline unavailable for ' + claimId + ': ' + error);
    return {
      count: 0,
      events: []
    };
  }
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