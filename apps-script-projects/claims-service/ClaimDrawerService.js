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

    openNextActions: [],

    financialTracks: financialTrackPayload.tracks,

    externalLinks: externalLinkPayload.links,

    missingLinks: externalLinkPayload.missingLinks,

    recentTimelineEvents: [],

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

var ClaimDrawerService = {
  getClaimDrawer: getClaimDrawer,
  testClaimDrawer: testClaimDrawer
};
