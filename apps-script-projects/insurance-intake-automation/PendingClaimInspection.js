
// ========================
// Pending Claim Folder Inspection
// ========================

function inspectPendingClaimFolders() {
  const startedAt = new Date();
  const asbestos = inspectAsbestosPendingClaimFolders().result;
  const itel = inspectItelPendingClaimFolders().result;
  const totalPendingCount = asbestos.summary.pendingCount + itel.summary.pendingCount;

  return {
    status: 'Success',
    message: 'Inspected ' + totalPendingCount + ' pending claim folder vendor thread(s).',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: 'Pending Claim Folder Inspection',
      readOnly: true,
      startedAt: startedAt,
      finishedAt: new Date(),
      summary: {
        pendingCount: totalPendingCount,
        asbestosPendingCount: asbestos.summary.pendingCount,
        itelPendingCount: itel.summary.pendingCount
      },
      asbestos: asbestos,
      itel: itel
    }
  };
}

function inspectAsbestosPendingClaimFolders() {
  const startedAt = new Date();
  const query = 'label:"' + CONFIG.asbestosPendingClaimFolderLabel + '"';
  const items = inspectPendingClaimFolderThreads_(query, 'Asbestos Attachment Intake', 'Asbestos');

  return buildPendingClaimFolderInspectionResponse_({
    workflow: 'Asbestos Pending Claim Folder Inspection',
    vendor: 'Asbestos',
    query: query,
    startedAt: startedAt,
    items: items
  });
}

function inspectItelPendingClaimFolders() {
  const startedAt = new Date();
  const query = 'label:"' + CONFIG.itelPendingClaimFolderLabel + '"';
  const items = inspectPendingClaimFolderThreads_(query, 'Itel Attachment Intake', 'Itel');

  return buildPendingClaimFolderInspectionResponse_({
    workflow: 'Itel Pending Claim Folder Inspection',
    vendor: 'Itel',
    query: query,
    startedAt: startedAt,
    items: items
  });
}

function buildPendingClaimFolderInspectionResponse_(context) {
  const items = context.items || [];

  return {
    status: 'Success',
    message: context.vendor + ' pending claim folder inspection found ' + items.length + ' thread(s).',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: context.workflow,
      vendor: context.vendor,
      readOnly: true,
      query: context.query,
      startedAt: context.startedAt,
      finishedAt: new Date(),
      summary: {
        pendingCount: items.length,
        threadsWithClaimNumber: items.filter(function(item) { return item.claimNumber !== ''; }).length,
        threadsMissingClaimNumber: items.filter(function(item) { return item.claimNumber === ''; }).length
      },
      items: items
    }
  };
}

function inspectPendingClaimFolderThreads_(query, workflow, vendor) {
  if (!query) {
    return [];
  }

  const threads = GmailApp.search(query, 0, CONFIG.maxThreadsPerRun);

  return threads.map(function(thread) {
    return buildPendingClaimFolderInspectionItem_(thread, workflow, vendor);
  });
}

function buildPendingClaimFolderInspectionItem_(thread, workflow, vendor) {
  const messages = thread.getMessages();
  const firstMessage = messages.length > 0 ? messages[0] : null;
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  let claimData = {};
  let parseError = '';

  try {
    claimData = parseInsuranceIntakeThread(thread) || {};
  } catch (error) {
    parseError = error.message;
  }

  return {
    workflow: workflow,
    vendor: vendor,
    threadId: thread.getId(),
    messageCount: messages.length,
    subject: firstMessage ? firstMessage.getSubject() : '',
    firstMessageDate: firstMessage ? firstMessage.getDate() : null,
    lastMessageDate: lastMessage ? lastMessage.getDate() : null,
    lastSender: lastMessage ? lastMessage.getFrom() : '',
    claimNumber: claimData.claimNumber || '',
    customerName: claimData.customerName || '',
    parseError: parseError,
    status: 'pending_claim_folder_inspected',
    readOnly: true,
    recommendedNextStep: claimData.claimNumber
      ? 'Confirm claim folder exists or add claim folder map entry, then rerun vendor workflow.'
      : 'Review thread manually because no claim number was parsed.'
  };
}



