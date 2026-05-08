/***************************************
 * INSURANCE INTAKE AUTOMATION
 *
 * Dashboard-compatible standalone web app automation.
 ***************************************/

const CONFIG = {
  gmailQuery: 'label:intake-insurance-assignment -label:intake-processed',
  processedLabel: 'intake-processed',
  errorLabel: 'intake-error',
  automationName: 'Insurance Intake Automation',
  maxThreadsPerRun: 10
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'process') {
    return jsonResponse(processInsuranceIntake());
  }

  return jsonResponse({
    status: 'Success',
    message: CONFIG.automationName + ' web app is live.',
    result: {
      availableActions: ['process'],
      query: CONFIG.gmailQuery
    }
  });
}

function processInsuranceIntake() {
  try {
    const threads = GmailApp.search(CONFIG.gmailQuery, 0, CONFIG.maxThreadsPerRun);

    return {
      status: 'Success',
      message: 'Found ' + threads.length + ' insurance intake thread(s).',
      result: {
        processedCount: 0,
        foundCount: threads.length,
        query: CONFIG.gmailQuery
      }
    };
  } catch (error) {
    return {
      status: 'Error',
      message: error.message,
      result: {
        stack: error.stack
      }
    };
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
