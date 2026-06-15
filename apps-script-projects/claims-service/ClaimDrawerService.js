/**
 * Phase 9
 * Claim Drawer Service
 *
 * Lightweight claim preview payload.
 */

function getClaimDrawer(claimId) {
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var claim = getClaimSummaryById_(claimId);
  var externalLinkPayload = ClaimExternalLinkService.getClaimExternalLinks(claimId);
  var financialTrackPayload = ClaimFinancialTrackService.getClaimFinancialTracks(claimId);
  var summary = getClaimWorkspaceSummary_(claimId);

  if (!claim) {
    throw new Error('Claim not found: ' + claimId);
  }

  return {
    claimId: claim.claimId,

    claimSummary: claim,

    lifecycleState: claim.lifecycleState,

    ownership: {
      ownershipArea: claim.ownershipArea,
      primaryOwner: claim.primaryOwner
    },

    operationalHealth: {
      level: claim.healthLevel,
      reason: claim.healthReason
    },

    activeConditions: claim.activeConditions || [],
    activeAlerts: claim.activeAlerts || [],

    openNextActions: summary.openComplianceActions > 0
      ? [{
          actionId: 'reviewOpenActions',
          label: summary.openComplianceActions + ' Open Compliance Actions'
        }]
      : [],

    financialTracks: financialTrackPayload.tracks,

    externalLinks: externalLinkPayload.links,

    missingLinks: externalLinkPayload.missingLinks,

    recentTimelineEvents: [],

    activitySummary: {
      lastActivityDate: summary.lastActivityDate,
      lastActivityType: summary.lastActivityType,
      lastActivitySummary: summary.lastActivitySummary,
      timelineEventCount: summary.timelineEventCount,
      openComplianceActions: summary.openComplianceActions
    },

    upcomingCalendarEvents: [],

    latestEojSignal: null,

    revisionSummary: null,

    monitoringSummary: null,
    financialTrackSummary: {
      totalTracks: financialTrackPayload.totalTracks,
      hasActiveTracks: financialTrackPayload.hasActiveTracks
    },

    recommendedDrawerActions: buildRecommendedDrawerActions_(claim)
  };
}
function getClaimWorkspaceSummary_(claimId) {
  try {
    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName('Claim_Summaries');

    if (!sheet) {
      return {};
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      return {};
    }

    var headers = values[0];

    var records = values.slice(1)
      .filter(function(row) {
        return row.join('').trim() !== '';
      })
      .map(function(row) {
        var record = {};
        headers.forEach(function(header, index) {
          record[header] = row[index];
        });
        return record;
      });

    var normalizedClaimId = String(claimId || '');
    var normalizedJobNumber = normalizedClaimId.replace(/^CLM-/, '');

    var match = records.find(function(record) {
      var recordClaimId = String(record['Claim ID'] || '');
      var recordJobNumber = String(record['Job Number'] || '');

      return recordClaimId === normalizedClaimId ||
             recordClaimId === normalizedJobNumber ||
             recordJobNumber === normalizedClaimId ||
             recordJobNumber === normalizedJobNumber;
    });

    if (!match) {
      Logger.log('Claim_Summaries match not found for: ' + claimId);
      return {};
    }

    return {
      lastActivityDate: match['Last Activity Date'] || null,
      lastActivityType: match['Last Activity Type'] || '',
      lastActivitySummary: match['Last Activity Summary'] || '',
      timelineEventCount: Number(match['Timeline Event Count'] || 0),
      openComplianceActions: Number(match['Open Compliance Actions'] || 0)
    };
  } catch (error) {
    return {};
  }
}

function getClaimSummaryById_(claimId) {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  var matches = claims.filter(function(claim) {
    return String(claim.claimId) === String(claimId);
  });

  return matches.length ? matches[0] : null;
}

function buildRecommendedDrawerActions_(claim) {
  var actions = [];

  actions.push({
    actionId: 'openClaimWorkspace',
    label: 'Open Full Claim Workspace'
  });

  var externalLinkPayload = ClaimExternalLinkService.getClaimExternalLinks(claim.claimId);

  if ((externalLinkPayload.missingLinks || []).length > 0) {
    actions.push({
      actionId: 'resolveMissingLinks',
      label: 'Resolve Missing Links'
    });
  }

  if (String(claim.healthLevel || '').toLowerCase() === 'at risk') {
    actions.push({
      actionId: 'reviewClaimHealth',
      label: 'Review Claim Health'
    });
  }

  return actions;
}

function testClaimDrawer() {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  if (!claims.length) {
    throw new Error('No claims available for testing.');
  }

  var drawer = getClaimDrawer(claims[0].claimId);

  Logger.log(JSON.stringify(drawer, null, 2));

  return drawer;
}

function debugClaimSummariesLookup() {
  var sheet = SpreadsheetApp
    .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
    .getSheetByName('Claim_Summaries');

  var values = sheet.getDataRange().getValues();

  Logger.log('Total rows: ' + values.length);
  Logger.log('Row 1: ' + JSON.stringify(values[0]));

  if (values.length > 1) {
    Logger.log('Row 2: ' + JSON.stringify(values[1]));
  }

  if (values.length > 2) {
    Logger.log('Row 3: ' + JSON.stringify(values[2]));
  }

  return {
    totalRows: values.length,
    row1: values[0],
    row2: values.length > 1 ? values[1] : null,
    row3: values.length > 2 ? values[2] : null
  };
}

var ClaimDrawerService = {
  getClaimDrawer: getClaimDrawer,
  testClaimDrawer: testClaimDrawer,
  debugClaimSummariesLookup: debugClaimSummariesLookup
};
