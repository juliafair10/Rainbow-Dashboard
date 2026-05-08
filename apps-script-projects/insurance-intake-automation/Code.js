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
    const parsedThreads = threads.map(parseInsuranceIntakeThread);

    return {
      status: 'Success',
      message: 'Found ' + threads.length + ' insurance intake thread(s). Parsed ' + parsedThreads.length + ' thread(s).',
      result: {
        processedCount: 0,
        foundCount: threads.length,
        parsedCount: parsedThreads.length,
        query: CONFIG.gmailQuery,
        parsedThreads: parsedThreads
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

function parseInsuranceIntakeThread(thread) {
  const messages = thread.getMessages();
  const latestMessage = messages[messages.length - 1];
  const subject = latestMessage.getSubject() || '';
  const plainBody = latestMessage.getPlainBody() || '';
  const combinedText = subject + '\n' + plainBody;

  return {
    threadId: thread.getId(),
    messageCount: messages.length,
    subject: subject,
    from: latestMessage.getFrom(),
    date: latestMessage.getDate(),
    claimNumber: extractClaimNumber(combinedText),
    customerName: extractCustomerName(combinedText)
  };
}

function extractClaimNumber(text) {
  const patterns = [
    /claim\s*(?:number|#|no\.?|num\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /claim\s*[:#-]\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /\b([A-Z]{1,4}-?\d{5,})\b/i
  ];

  return extractFirstMatch(text, patterns);
}

function extractCustomerName(text) {
  const patterns = [
    /customer\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /insured\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /policyholder\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /claimant\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /customer\s*[:#-]\s*([^\n\r]+)/i,
    /insured\s*[:#-]\s*([^\n\r]+)/i,
    /claimant\s*[:#-]\s*([^\n\r]+)/i
  ];

  const match = extractFirstMatch(text, patterns);
  return match ? cleanExtractedName(match) : null;
}

function extractFirstMatch(text, patterns) {
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function cleanExtractedName(name) {
  return name
    .replace(/\s{2,}/g, ' ')
    .replace(/[,;|].*$/, '')
    .trim();
}

function testProcessInsuranceIntake() {
  Logger.log(JSON.stringify(processInsuranceIntake(), null, 2));
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
