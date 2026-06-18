/**
 * Homepage API
 * Phase 8 Homepage Shell
 */

function getHomepageSummary() {
  return getHomepageSummaryV2();
}

function getHomepageSummaryV2() {
  try {
    return {
      status: 'Success',
      success: true,
      generatedAt: new Date().toISOString(),
      data: getHomepageClaimSummaryData()
    };
  } catch (error) {
    return {
      status: 'Error',
      success: false,
      message: error.message,
      stack: error.stack
    };
  }
}

function testHomepageApi() {
  const response = getHomepageSummaryV2();

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}

function testHomepageVisibilityFieldsOnly() {
  const response = getHomepageSummaryV2();
  const data = response && response.data ? response.data : {};

  const result = {
    status: response.status,
    success: response.success,
    ownershipVisibilityCount: Array.isArray(data.ownershipVisibility) ? data.ownershipVisibility.length : 0,
    ownershipVisibility: data.ownershipVisibility || [],
    conditionsVisibilityCount: Array.isArray(data.conditionsVisibility) ? data.conditionsVisibility.length : 0,
    conditionsVisibility: data.conditionsVisibility || [],
    complianceVisibility: data.complianceVisibility || {},
    topLevelKeys: Object.keys(data)
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}