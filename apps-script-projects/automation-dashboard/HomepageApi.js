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