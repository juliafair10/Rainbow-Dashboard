function getHomepageServiceSummaryLegacy_() {
  try {
    const claimSummary = getHomepageClaimSummaryData();
    const generatedAt = new Date().toISOString();

    return {
      status: 'Success',
      success: true,
      generatedAt: generatedAt,
      data: {
        kpis: claimSummary.kpis,
        todayPriorities: claimSummary.todayPriorities || [],
        todaySchedule: claimSummary.todaySchedule || [],
        becomingStale: claimSummary.becomingStale || [],
        recentActivity: claimSummary.recentActivity || [],
        operationalAlerts: getHomepageOperationalAlertsFromSummary_(claimSummary),
        claimSummary: {
          activeClaimCount: claimSummary.activeClaimCount,
          openConditionCount: claimSummary.openConditionCount,
          openAlertCount: claimSummary.openAlertCount,
          generatedAt: claimSummary.generatedAt
        },
        systemStatus: {
          dashboard: 'Connected',
          homepageService: 'Connected',
          claimsService: 'Connected to Claim Foundation data',
          lastRefresh: generatedAt
        }
      }
    };
  } catch (error) {
    return {
      status: 'Error',
      success: false,
      generatedAt: new Date().toISOString(),
      message: 'Failed to generate homepage summary.',
      error: error.message,
      data: {
        kpis: {
          needsAttention: 0,
          atRisk: 0,
          escalated: 0,
          critical: 0,
          waitingOnInsurance: 0,
          monitoringActive: 0
        },
        todayPriorities: [],
        todaySchedule: [],
        becomingStale: [],
        recentActivity: [],
        operationalAlerts: [],
        systemStatus: {
          dashboard: 'Connected',
          homepageService: 'Error',
          claimsService: 'Error reading Claim Foundation data',
          lastRefresh: new Date().toISOString()
        }
      }
    };
  }
}

function testGetHomepageSummary() {
  const result = getHomepageServiceSummaryLegacy_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function getHomepageOperationalAlertsFromSummary_(claimSummary) {
  if (claimSummary && claimSummary.operationalAlerts && claimSummary.operationalAlerts.length) {
    return claimSummary.operationalAlerts;
  }

  const priorities = claimSummary && claimSummary.todayPriorities
    ? claimSummary.todayPriorities
    : [];

  return priorities.filter(function(item) {
    return item.type === 'Alert';
  }).map(function(item) {
    return {
      claimId: item.claimId || '',
      claimDisplayName: item.claimDisplayName || '',
      customerName: item.customerName || '',
      claimNumber: item.claimNumber || '',
      lifecycleState: item.lifecycleState || '',
      ownershipArea: item.ownershipArea || '',
      primaryOwner: item.primaryOwner || '',
      alertType: item.alertType || item.title || 'Operational Alert',
      severity: item.severity || '',
      reason: item.reason || '',
      recommendedAction: item.recommendedAction || '',
      targetWorkspace: item.targetWorkspace || 'claims'
    };
  });
}
