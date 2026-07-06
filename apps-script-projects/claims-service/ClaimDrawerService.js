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

    recommendedDrawerActions: buildRecommendedDrawerActions_(claim, externalLinkPayload)
  };
}
var CLAIM_DRAWER_SUMMARY_CACHE_SECONDS = 60;

function getClaimWorkspaceSummary_(claimId) {
  var cache, cacheKey, cached, summary;
  try {
    cache = CacheService.getScriptCache();
    cacheKey = 'drawerSummary:' + claimId;
    cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Ignore parse errors, proceed to fetch fresh
      }
    }
  } catch (e) {
    // Ignore cache errors
  }

  try {
    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName('Claim_Summaries');

    if (!sheet) {
      summary = {};
      try { cache && cache.put(cacheKey, JSON.stringify(summary), CLAIM_DRAWER_SUMMARY_CACHE_SECONDS); } catch (e) {}
      return summary;
    }

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      summary = {};
      try { cache && cache.put(cacheKey, JSON.stringify(summary), CLAIM_DRAWER_SUMMARY_CACHE_SECONDS); } catch (e) {}
      return summary;
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
      summary = {};
      try { cache && cache.put(cacheKey, JSON.stringify(summary), CLAIM_DRAWER_SUMMARY_CACHE_SECONDS); } catch (e) {}
      return summary;
    }

    summary = {
      lastActivityDate: match['Last Activity Date'] || null,
      lastActivityType: match['Last Activity Type'] || '',
      lastActivitySummary: match['Last Activity Summary'] || '',
      timelineEventCount: Number(match['Timeline Event Count'] || 0),
      openComplianceActions: Number(match['Open Compliance Actions'] || 0)
    };
    try { cache && cache.put(cacheKey, JSON.stringify(summary), CLAIM_DRAWER_SUMMARY_CACHE_SECONDS); } catch (e) {}
    return summary;
  } catch (error) {
    summary = {};
    try { cache && cache.put(cacheKey, JSON.stringify(summary), CLAIM_DRAWER_SUMMARY_CACHE_SECONDS); } catch (e) {}
    return summary;
  }
}

function getClaimSummaryById_(claimId) {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  for (var i = 0; i < claims.length; i++) {
    if (String(claims[i].claimId) === String(claimId)) {
      return claims[i];
    }
  }

  return null;
}

function buildRecommendedDrawerActions_(claim, externalLinkPayload) {
  var actions = [];

  actions.push({
    actionId: 'openClaimWorkspace',
    label: 'Open Full Claim Workspace'
  });

  externalLinkPayload = externalLinkPayload || { missingLinks: [] };

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

function testGetClaimDrawerCoveragePending() {
  var drawer = getClaimDrawer('CLM-26A-0052-WTR');

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
  testGetClaimDrawerCoveragePending: testGetClaimDrawerCoveragePending,
  debugClaimSummariesLookup: debugClaimSummariesLookup
};
