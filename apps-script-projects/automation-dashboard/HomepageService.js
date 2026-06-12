
function getHomepageSummary() {
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
        todaySchedule: [],
        becomingStale: [],
        recentActivity: [],
        operationalAlerts: [],
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
  const result = getHomepageSummary();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
