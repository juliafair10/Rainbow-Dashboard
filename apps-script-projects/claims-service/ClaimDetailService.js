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
  var timeline = getTimelineForClaim(claimId);

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
      timelineEvents: timeline.success ? timeline.data.timeline : [],
      timelineCount: timeline.success ? timeline.data.count : 0,
      timelineSummary: timeline.success
        ? 'Timeline events loaded from TimelineService.'
        : 'Timeline unavailable.'
    },

    operationalContext: {
      nextAction: drawer.claimSummary.nextAction,
      blockers: [],
      currentCadence: null,
      upcomingScheduledWork: drawer.upcomingCalendarEvents,
      recentActivitySummary: drawer.claimSummary.lastMeaningfulActivityDate,
      timelineEventCount: timeline.success ? timeline.data.count : 0
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
  testClaimDetail: testClaimDetail
};