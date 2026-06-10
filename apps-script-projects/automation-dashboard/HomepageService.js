function getHomepageSummary() {
  return {
    status: 'Success',
    success: true,
    generatedAt: new Date().toISOString(),
    data: {
      kpis: getHomepageKpis(),
      todayPriorities: [],
      todaySchedule: [],
      becomingStale: [],
      recentActivity: [],
      operationalAlerts: [],
      systemStatus: {
        dashboard: 'Connected',
        homepageService: 'Connected',
        claimsService: 'Not connected yet',
        lastRefresh: new Date().toISOString()
      }
    }
  };
}
