/***************************************
 * INSURANCE INTAKE AUTOMATION
 *
 * Dashboard-compatible standalone web app automation.
 ***************************************/

function authorizeTodoistUrlFetch() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TODOIST_API_TOKEN') || 'authorization-check-only';

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/sync', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify({
      sync_token: '*',
      resource_types: ['projects']
    }),
    muteHttpExceptions: true
  });

  Logger.log('Todoist UrlFetch authorization check complete. HTTP ' + response.getResponseCode());
}

const CONFIG = {
  gmailQuery: 'label:"Intake-Insurance Assignment" -label:"Intake-Processed" -label:intake-duplicate -label:"Intake-Pending Review" -label:"Intake-Error"',
  intakeLabel: 'Intake-Insurance Assignment',
  processedLabel: 'Intake-Processed',
  errorLabel: 'Intake-Error',
  duplicateLabel: 'intake-duplicate',
  needsReviewLabel: 'Intake-Pending Review',
  asbestosQuery: 'label:Asbestos -label:"Asbestos/Processed/Asbestos"',
  asbestosIntakeLabel: 'Asbestos',
  asbestosProcessedLabel: 'Asbestos/Processed/Asbestos',
  asbestosProcessedLabelLegacy: 'Processed-Asbestos',
  asbestosErrorLabel: 'Asbestos/Error',
  asbestosNeedsReviewLabel: 'Asbestos/Needs Review',
  asbestosPendingClaimFolderLabel: 'Asbestos/Pending Claim Folder',
  asbestosSubfolderName: 'Asbestos',
  // Temporary EMSL aliases route old EMSL calls to the new Asbestos labels during transition.
  emslQuery: 'label:Asbestos -label:"Asbestos/Processed/Asbestos"',
  emslIntakeLabel: 'Asbestos',
  emslProcessedLabel: 'Asbestos/Processed/Asbestos',
  emslErrorLabel: 'Asbestos/Error',
  emslNeedsReviewLabel: 'Asbestos/Needs Review',
  emslPendingClaimFolderLabel: 'Asbestos/Pending Claim Folder',
  itelQuery: 'label:Itel -label:"Itel/Processed/Itel"',
  itelIntakeLabel: 'Itel',
  itelProcessedLabel: 'Itel/Processed/Itel',
  itelProcessedLabelLegacy: 'Processed-Itel',
  itelErrorLabel: 'Itel/Error',
  itelNeedsReviewLabel: 'Itel/Needs Review',
  itelPendingClaimFolderLabel: 'Itel/Pending Claim Folder',
  itelSubfolderName: 'Itel',
  automationName: 'Insurance Intake Automation',
  maxThreadsPerRun: 10,
  phase: '4D.10',
  dryRun: false,
  labelDryRun: false,
  claimFolderMapSpreadsheetId: '1kTRyZbPW1dZgkflH31s4MewuVHEl1ExQ7o3c6ad-btQ',
  claimFolderMapSheetName: 'Claim Folder Map',
  attachmentLogSheetName: 'Attachment Intake Log',
  claimFolderParentFolderId: '1r0A84zZGvUKA_0QFs1dwozbuteZt-DbL',
  createClaimFolders: true,
  todoist: {
    enabled: true,
    apiTokenProperty: 'TODOIST_API_TOKEN',
    projectIdProperty: 'TODOIST_PROJECT_ID',
    assigneeIdClarenceProperty: 'TODOIST_ASSIGNEE_ID_CLARENCE',
    sectionIdProperty: 'TODOIST_SECTION_ID',
    dueString: 'in 3 days',
    priority: 3
  },
  attachments: {
    detectionEnabled: true,
    loggingEnabled: true,
    labelingEnabled: false,
    duplicateCheckEnabled: true,
    manifestEnabled: true,
    manifestFileName: 'attachment-manifest.json',
    manifestSchemaVersion: 2,
    manifestReconciliationEnabled: true,
    manifestRepairEnabled: false,
    copyEnabled: true,
    copyVerificationEnabled: true,
    testMode: true,
    stabilizationEnabled: true,
    identityDuplicateCheckEnabled: true,
    filenameDuplicateCheckEnabled: true,
    logDuplicateCheckEnabled: true,
    recoveryModeEnabled: true,
    markUnreadOnRecoveryRequired: true,
    skipCopyIfManifestFileExists: true,
    skipCopyIfDriveFilenameExists: true,
    appendRecoveryLogRows: true,
    checksumEnabled: false,
    checksumMaxBytes: 10000000,
    maxAttachmentBytes: 25000000,
    retries: {
      enabled: true,
      maxCopyAttempts: 1,
      maxManifestAttempts: 1,
      maxSheetAttempts: 1,
      failFastOnDriveError: true
    },
    allowedMimeTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    reviewMimeTypes: [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream'
    ]
  }
};

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'process') {
    return jsonResponse(processInsuranceIntake());
  }

  if (action === 'testTodoist') {
    return jsonResponse(testTodoistConnection());
  }

  if (action === 'listTodoistProjects') {
    return jsonResponse(listTodoistProjects());
  }

  if (action === 'processAsbestos') {
    return jsonResponse(processAsbestosAttachments());
  }

  if (action === 'cleanupAsbestosLabels') {
    return jsonResponse(cleanupProcessedAsbestosLabels());
  }

  // Temporary backward-compatible aliases while the dashboard and labels are being updated.
  if (action === 'processEmsl') {
    return jsonResponse(processAsbestosAttachments());
  }

  if (action === 'cleanupEmslLabels') {
    return jsonResponse(cleanupProcessedAsbestosLabels());
  }

  if (action === 'processItel') {
    return jsonResponse(processItelAttachments());
  }

  if (action === 'cleanupItelLabels') {
    return jsonResponse(cleanupProcessedItelLabels());
  }

  if (action === 'queueHealth') {
    return jsonResponse(getQueueHealth());
  }

  if (action === 'queueHealthAsbestos') {
    return jsonResponse(getAsbestosQueueHealth());
  }

  if (action === 'queueHealthItel') {
    return jsonResponse(getItelQueueHealth());
  }

  if (action === 'queueHealthInsuranceIntake') {
    return jsonResponse(getInsuranceIntakeQueueHealth());
  }

  if (action === 'inspectPendingClaimFolders') {
    return jsonResponse(inspectPendingClaimFolders());
  }

  if (action === 'inspectAsbestosPendingClaimFolders') {
    return jsonResponse(inspectAsbestosPendingClaimFolders());
  }

  if (action === 'inspectItelPendingClaimFolders') {
    return jsonResponse(inspectItelPendingClaimFolders());
  }

  return jsonResponse({
    status: 'Success',
    message: CONFIG.automationName + ' web app is live.',
    result: {
      availableActions: ['process', 'testTodoist', 'listTodoistProjects', 'processAsbestos', 'cleanupAsbestosLabels', 'processItel', 'cleanupItelLabels', 'queueHealth', 'queueHealthAsbestos', 'queueHealthItel', 'queueHealthInsuranceIntake', 'inspectPendingClaimFolders', 'inspectAsbestosPendingClaimFolders', 'inspectItelPendingClaimFolders'],
      query: CONFIG.gmailQuery
    }
  });
}

function getQueueHealth() {
  const startedAt = new Date();
  const insuranceIntake = getInsuranceIntakeQueueHealth().result.workflowHealth;
  const asbestos = getAsbestosQueueHealth().result.workflowHealth;
  const itel = getItelQueueHealth().result.workflowHealth;
  const workflows = [insuranceIntake, asbestos, itel];
  const overallHealth = calculateOverallQueueHealth_(workflows);

  return {
    status: 'Success',
    message: 'Phase ' + CONFIG.phase + ' queue health checked for Insurance Intake, Asbestos, and Itel.',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: 'Phase 4E Queue Health',
      readOnly: true,
      startedAt: startedAt,
      finishedAt: new Date(),
      overallHealth: overallHealth,
      workflows: {
        insuranceIntake: insuranceIntake,
        asbestos: asbestos,
        itel: itel
      }
    }
  };
}

function getInsuranceIntakeQueueHealth() {
  const startedAt = new Date();
  const workflowHealth = buildQueueHealthForWorkflow_({
    workflow: 'Insurance Intake',
    activeQuery: CONFIG.gmailQuery,
    processedQuery: 'label:"' + CONFIG.processedLabel + '"',
    errorQuery: 'label:"' + CONFIG.errorLabel + '"',
    reviewQuery: 'label:"' + CONFIG.needsReviewLabel + '"',
    pendingClaimFolderQuery: '',
    retryQuery: '',
    retryLimitReachedQuery: '',
    cleanupBacklogQuery: '',
    duplicateQuery: 'label:' + CONFIG.duplicateLabel,
    staleActiveQuery: CONFIG.gmailQuery + ' older_than:2d',
    staleReviewQuery: 'label:"' + CONFIG.needsReviewLabel + '" older_than:2d',
    stalePendingClaimFolderQuery: ''
  });

  return buildSingleQueueHealthResponse_('Insurance Intake Queue Health', startedAt, workflowHealth);
}

function getAsbestosQueueHealth() {
  const startedAt = new Date();
  const workflowHealth = buildQueueHealthForWorkflow_({
    workflow: 'Asbestos Attachment Intake',
    activeQuery: CONFIG.asbestosQuery,
    processedQuery: 'label:"' + CONFIG.asbestosProcessedLabel + '"',
    errorQuery: 'label:"' + CONFIG.asbestosErrorLabel + '"',
    reviewQuery: 'label:"' + CONFIG.asbestosNeedsReviewLabel + '"',
    pendingClaimFolderQuery: 'label:"' + CONFIG.asbestosPendingClaimFolderLabel + '"',
    retryQuery: 'label:"Asbestos/Retry"',
    retryLimitReachedQuery: 'label:"Asbestos/Retry Limit Reached"',
    cleanupBacklogQuery: 'label:' + CONFIG.asbestosIntakeLabel + ' label:"' + CONFIG.asbestosProcessedLabel + '"',
    duplicateQuery: '',
    staleActiveQuery: CONFIG.asbestosQuery + ' older_than:2d',
    staleReviewQuery: 'label:"' + CONFIG.asbestosNeedsReviewLabel + '" older_than:2d',
    stalePendingClaimFolderQuery: 'label:"' + CONFIG.asbestosPendingClaimFolderLabel + '" older_than:2d'
  });

  return buildSingleQueueHealthResponse_('Asbestos Queue Health', startedAt, workflowHealth);
}

function getItelQueueHealth() {
  const startedAt = new Date();
  const workflowHealth = buildQueueHealthForWorkflow_({
    workflow: 'Itel Attachment Intake',
    activeQuery: CONFIG.itelQuery,
    processedQuery: 'label:"' + CONFIG.itelProcessedLabel + '"',
    errorQuery: 'label:"' + CONFIG.itelErrorLabel + '"',
    reviewQuery: 'label:"' + CONFIG.itelNeedsReviewLabel + '"',
    pendingClaimFolderQuery: 'label:"' + CONFIG.itelPendingClaimFolderLabel + '"',
    retryQuery: 'label:"Itel/Retry"',
    retryLimitReachedQuery: 'label:"Itel/Retry Limit Reached"',
    cleanupBacklogQuery: 'label:' + CONFIG.itelIntakeLabel + ' label:"' + CONFIG.itelProcessedLabel + '"',
    duplicateQuery: '',
    staleActiveQuery: CONFIG.itelQuery + ' older_than:2d',
    staleReviewQuery: 'label:"' + CONFIG.itelNeedsReviewLabel + '" older_than:2d',
    stalePendingClaimFolderQuery: 'label:"' + CONFIG.itelPendingClaimFolderLabel + '" older_than:2d'
  });

  return buildSingleQueueHealthResponse_('Itel Queue Health', startedAt, workflowHealth);
}

function buildSingleQueueHealthResponse_(workflowName, startedAt, workflowHealth) {
  return {
    status: 'Success',
    message: workflowName + ' checked. Health: ' + workflowHealth.health + '.',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: workflowName,
      readOnly: true,
      startedAt: startedAt,
      finishedAt: new Date(),
      workflowHealth: workflowHealth
    }
  };
}

function buildQueueHealthForWorkflow_(settings) {
  const metrics = {
    activeQueueCount: countGmailThreadsForQueueHealth_(settings.activeQuery),
    processedCount: countGmailThreadsForQueueHealth_(settings.processedQuery),
    errorCount: countGmailThreadsForQueueHealth_(settings.errorQuery),
    reviewCount: countGmailThreadsForQueueHealth_(settings.reviewQuery),
    pendingClaimFolderCount: countGmailThreadsForQueueHealth_(settings.pendingClaimFolderQuery),
    retryBacklogCount: countGmailThreadsForQueueHealth_(settings.retryQuery),
    retryLimitReachedCount: countGmailThreadsForQueueHealth_(settings.retryLimitReachedQuery),
    cleanupBacklogCount: countGmailThreadsForQueueHealth_(settings.cleanupBacklogQuery),
    duplicateCount: countGmailThreadsForQueueHealth_(settings.duplicateQuery),
    staleActiveCount: countGmailThreadsForQueueHealth_(settings.staleActiveQuery),
    staleReviewCount: countGmailThreadsForQueueHealth_(settings.staleReviewQuery),
    stalePendingClaimFolderCount: countGmailThreadsForQueueHealth_(settings.stalePendingClaimFolderQuery)
  };

  metrics.staleThreadCount = metrics.staleActiveCount + metrics.staleReviewCount + metrics.stalePendingClaimFolderCount;
  // Queue-entry age is intentionally disabled for Phase 4E. Gmail thread dates can reflect
  // very old original messages, not the date a queue label was applied.
  metrics.oldestActiveItemAgeHours = null;
  metrics.oldestReviewItemAgeHours = null;
  metrics.oldestPendingClaimFolderAgeHours = null;
  metrics.ageCalculationNote = 'Disabled in Phase 4E because Gmail thread dates can predate current queue labels.';

  return {
    workflow: settings.workflow,
    health: calculateWorkflowQueueHealth_(metrics),
    checkedAt: new Date(),
    readOnly: true,
    queries: {
      active: settings.activeQuery,
      processed: settings.processedQuery,
      error: settings.errorQuery,
      review: settings.reviewQuery,
      pendingClaimFolder: settings.pendingClaimFolderQuery,
      retry: settings.retryQuery,
      retryLimitReached: settings.retryLimitReachedQuery,
      cleanupBacklog: settings.cleanupBacklogQuery
    },
    metrics: metrics
  };
}

function countGmailThreadsForQueueHealth_(query) {
  if (!query) {
    return 0;
  }

  try {
    return GmailApp.search(query, 0, 500).length;
  } catch (error) {
    return -1;
  }
}

function getOldestThreadAgeHoursForQueueHealth_(query) {
  if (!query) {
    return null;
  }

  try {
    const threads = GmailApp.search(query, 0, 50);

    if (!threads || threads.length === 0) {
      return null;
    }

    let oldestDate = null;

    threads.forEach(function(thread) {
      const messages = thread.getMessages();

      messages.forEach(function(message) {
        const messageDate = message.getDate();

        if (!oldestDate || messageDate < oldestDate) {
          oldestDate = messageDate;
        }
      });
    });

    if (!oldestDate) {
      return null;
    }

    return Math.round((new Date().getTime() - oldestDate.getTime()) / 36) / 100;
  } catch (error) {
    return null;
  }
}

function calculateWorkflowQueueHealth_(metrics) {
  if (metrics.errorCount > 0 || metrics.retryLimitReachedCount > 0 || metrics.staleThreadCount > 0) {
    return 'Critical';
  }

  if (metrics.reviewCount > 0 || metrics.pendingClaimFolderCount > 0 || metrics.retryBacklogCount > 0 || metrics.cleanupBacklogCount > 0) {
    return 'Warning';
  }

  return 'Healthy';
}

function calculateOverallQueueHealth_(workflows) {
  const healthValues = workflows.map(function(workflow) {
    return workflow.health;
  });

  if (healthValues.indexOf('Critical') !== -1) {
    return 'Critical';
  }

  if (healthValues.indexOf('Warning') !== -1) {
    return 'Warning';
  }

  return 'Healthy';
}

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

function processInsuranceIntake() {
  const startedAt = new Date();

  const summary = {
    foundCount: 0,
    parsedCount: 0,
    processedCount: 0,
    sheetRowsAdded: 0,
    duplicatesSkipped: 0,
    warnings: 0,
    errors: 0,
    threadsWithAttachments: 0,
    totalAttachmentsDetected: 0,
    copyEligibleAttachments: 0,
    reviewNeededAttachments: 0,
    skippedAttachments: 0
  };

  const items = [];

  try {
    const threads = GmailApp.search(CONFIG.gmailQuery, 0, CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        duplicate: false,
        sheetUpdated: false,
        warnings: [],
        errors: []
      };

      try {
        const claimData = parseInsuranceIntakeThread(thread);
        summary.parsedCount++;

        itemResult.subject = claimData.subject;
        itemResult.claimNumber = claimData.claimNumber;
        itemResult.customerName = claimData.customerName;
        const attachmentResult = detectThreadAttachments_(thread);
        itemResult.attachmentResult = attachmentResult;
        updateAttachmentSummary_(summary, attachmentResult);

        if (!claimData.claimNumber) {
          itemResult.status = 'needs_review_missing_claim_number';
          itemResult.warnings.push('No claim number could be extracted.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.needsReviewLabel],
            remove: [CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Needs-review label update failed: ' + labelResult.error);
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        const duplicateCheck = claimFolderMapHasDuplicate_(claimData, thread);

        if (duplicateCheck.duplicate) {
          itemResult.duplicate = true;
          itemResult.duplicateReason = duplicateCheck.reason;
          itemResult.existingRowNumber = duplicateCheck.rowNumber;

          const labelPlan = duplicateCheck.reason === 'gmail_thread_id_exists'
            ? {
                add: [CONFIG.processedLabel],
                remove: [CONFIG.intakeLabel]
              }
            : {
                add: [CONFIG.duplicateLabel],
                remove: [CONFIG.intakeLabel]
              };

          const labelResult = applyInsuranceIntakeLabels_(thread, labelPlan);
          itemResult.labelResult = labelResult;

          if (duplicateCheck.reason === 'gmail_thread_id_exists') {
            itemResult.status = labelResult.success ? 'already_logged_marked_processed' : 'already_logged_label_warning';
          } else {
            itemResult.status = labelResult.success ? 'duplicate_skipped' : 'duplicate_label_warning';
          }

          if (!labelResult.success) {
            itemResult.warnings.push('Duplicate label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.duplicatesSkipped++;
          items.push(itemResult);
          continue;
        }

        const folderResult = checkOrCreateClaimFolder_(claimData);

        if (!folderResult.success) {
          itemResult.status = 'folder_check_failed';
          itemResult.folderResult = folderResult;
          itemResult.errors.push(folderResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const todoistResult = createOrSkipTodoistIntakeTask_(claimData, folderResult, thread);
        itemResult.todoistResult = todoistResult;

        if (!todoistResult.success) {
          itemResult.status = 'todoist_task_failed';
          itemResult.errors.push(todoistResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const sheetResult = appendClaimFolderMapRow_(claimData, folderResult, thread);

        itemResult.folderResult = folderResult;
        itemResult.sheetResult = sheetResult;
        itemResult.sheetUpdated = sheetResult.sheetUpdated;

        if (!sheetResult.success) {
          itemResult.status = 'sheet_update_failed';
          itemResult.errors.push(sheetResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        if (sheetResult.dryRun) {
          itemResult.status = 'dry_run_sheet_append_skipped';
        } else {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.processedLabel],
            remove: [CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.status = 'processed_with_label_warning';
            itemResult.warnings.push('Processed label update failed: ' + labelResult.error);
            summary.warnings++;
          } else {
            itemResult.status = 'processed';
          }

          summary.processedCount++;
          summary.sheetRowsAdded++;
        }

        items.push(itemResult);
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);

        try {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }
        } catch (labelError) {
          itemResult.warnings.push('Error label update threw an exception: ' + labelError.message);
          summary.warnings++;
        }

        summary.errors++;
        items.push(itemResult);
      }
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildPhase4CMessage_(summary),
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        dryRun: CONFIG.dryRun,
        query: CONFIG.gmailQuery,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        items: items
      }
    };
  } catch (error) {
    summary.errors++;

    return {
      status: 'Error',
      message: error.message,
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        dryRun: CONFIG.dryRun,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function processAsbestosAttachments() {
  const startedAt = new Date();

  const summary = {
    foundCount: 0,
    parsedCount: 0,
    processedCount: 0,
    folderReadyCount: 0,
    warnings: 0,
    errors: 0,
    threadsWithAttachments: 0,
    totalAttachmentsDetected: 0,
    copyEligibleAttachments: 0,
    reviewNeededAttachments: 0,
    skippedAttachments: 0
  };

  const items = [];

  try {
    const threads = GmailApp.search(CONFIG.asbestosQuery, 0, CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        warnings: [],
        errors: []
      };

      try {
        const claimData = parseInsuranceIntakeThread(thread);
        summary.parsedCount++;

        itemResult.subject = claimData.subject;
        itemResult.claimNumber = claimData.claimNumber;
        itemResult.customerName = claimData.customerName;
        itemResult.extractionDebug = {
          claimNumber: claimData.claimNumber,
          customerName: claimData.customerName,
          source: 'parseInsuranceIntakeThread'
        };

        const attachmentResult = detectThreadAttachments_(thread);
        itemResult.attachmentResult = attachmentResult;
        updateAttachmentSummary_(summary, attachmentResult);

        if (!claimData.claimNumber) {
          itemResult.status = 'needs_review_missing_claim_number';
          itemResult.warnings.push('No claim number could be extracted from Asbestos thread.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.asbestosNeedsReviewLabel],
            remove: [CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        const folderResult = findExistingClaimFolderForVendor_(claimData);
        itemResult.folderResult = folderResult;

        if (!folderResult.success) {
          itemResult.status = folderResult.status || 'folder_check_failed';
          itemResult.errors.push(folderResult.error);

          const folderFailureLabel = folderResult.status === 'pending_claim_folder'
            ? CONFIG.asbestosPendingClaimFolderLabel
            : CONFIG.asbestosErrorLabel;

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [folderFailureLabel],
            remove: [CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos folder-status label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const asbestosSubfolderResult = checkOrCreateVendorSubfolder_(folderResult.folderId, CONFIG.asbestosSubfolderName);
        itemResult.asbestosSubfolderResult = asbestosSubfolderResult;

        if (!asbestosSubfolderResult.success) {
          itemResult.status = 'asbestos_subfolder_check_failed';
          itemResult.errors.push(asbestosSubfolderResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.asbestosErrorLabel],
            remove: [CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        summary.folderReadyCount++;

        const asbestosCopyResult = copyEligibleAttachments_({
          workflow: 'Asbestos Attachment Intake',
          vendor: 'Asbestos',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: asbestosSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentCopyResult = asbestosCopyResult;

        if (!asbestosCopyResult.success) {
          itemResult.warnings.push('Asbestos attachment copy update failed: ' + asbestosCopyResult.error);
          summary.warnings++;
        }

        const asbestosLogResult = appendAttachmentLogRows_({
          workflow: 'Asbestos Attachment Intake',
          vendor: 'Asbestos',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: asbestosSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentLogResult = asbestosLogResult;

        if (!asbestosLogResult.success) {
          itemResult.warnings.push('Asbestos attachment log update failed: ' + asbestosLogResult.error);
          summary.warnings++;
        }

        const asbestosManifestResult = writeAttachmentManifest_({
          workflow: 'Asbestos Attachment Intake',
          vendor: 'Asbestos',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: asbestosSubfolderResult,
          attachmentResult: attachmentResult,
          copyResult: asbestosCopyResult,
          logResult: asbestosLogResult
        });
        itemResult.attachmentManifestResult = asbestosManifestResult;

        if (!asbestosManifestResult.success) {
          itemResult.warnings.push('Asbestos attachment manifest update failed: ' + asbestosManifestResult.error);
          summary.warnings++;
        }

        if (attachmentResult.attachmentCount <= 0) {
          itemResult.status = 'needs_review_no_attachments';
          itemResult.warnings.push('No Asbestos attachments were detected.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.asbestosNeedsReviewLabel],
            remove: [CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        itemResult.status = 'asbestos_attachments_detected_folder_ready';

        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [CONFIG.asbestosProcessedLabel],
          remove: getAsbestosWorkflowStateLabelsToRemove_()
        });

        thread.markRead();
        itemResult.mailReadState = 'marked_read';
        itemResult.labelResult = labelResult;

        if (!labelResult.success) {
          itemResult.status = 'asbestos_detected_with_label_warning';
          itemResult.warnings.push('Asbestos processed label update failed: ' + labelResult.error);
          summary.warnings++;
        }

        summary.processedCount++;
        items.push(itemResult);
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);

        try {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.asbestosErrorLabel],
            remove: [CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos error label update failed: ' + labelResult.error);
            summary.warnings++;
          }
        } catch (labelError) {
          itemResult.warnings.push('Asbestos error label update threw an exception: ' + labelError.message);
          summary.warnings++;
        }

        summary.errors++;
        items.push(itemResult);
      }
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildAsbestosAttachmentMessage_(summary),
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Asbestos Attachment Intake',
        dryRun: CONFIG.dryRun,
        query: CONFIG.asbestosQuery,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        items: items
      }
    };
  } catch (error) {
    summary.errors++;

    return {
      status: 'Error',
      message: error.message,
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Asbestos Attachment Intake',
        dryRun: CONFIG.dryRun,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function cleanupProcessedAsbestosLabels() {
  const startedAt = new Date();
  const query = 'label:Asbestos label:"Asbestos/Processed/Asbestos"';
  const summary = {
    foundCount: 0,
    cleanedCount: 0,
    warnings: 0,
    errors: 0
  };
  const items = [];

  try {
    const threads = GmailApp.search(query, 0, CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        warnings: [],
        errors: []
      };

      try {
        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [],
          remove: [CONFIG.asbestosIntakeLabel]
        });

        itemResult.labelResult = labelResult;

        if (labelResult.success) {
          itemResult.status = 'asbestos_source_label_removed';
          summary.cleanedCount++;
        } else {
          itemResult.status = 'asbestos_source_label_remove_warning';
          itemResult.warnings.push(labelResult.error);
          summary.warnings++;
        }
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);
        summary.errors++;
      }

      items.push(itemResult);
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: 'Cleaned ' + summary.cleanedCount + ' Asbestos source label(s) from ' + summary.foundCount + ' processed Asbestos thread(s).',
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Asbestos Label Cleanup',
        query: query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        items: items
      }
    };
  } catch (error) {
    summary.errors++;

    return {
      status: 'Error',
      message: error.message,
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Asbestos Label Cleanup',
        query: query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function buildAsbestosAttachmentMessage_(summary) {
  return 'Phase ' + CONFIG.phase + ' Asbestos attachment intake found ' + summary.foundCount +
    ' Asbestos thread(s), parsed ' + summary.parsedCount +
    ', prepared ' + summary.folderReadyCount +
    ' claim folder(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
}

function processEmslAttachments() {
  return processAsbestosAttachments();
}

function buildEmslAttachmentMessage_(summary) {
  return buildAsbestosAttachmentMessage_(summary);
}

function cleanupProcessedEmslLabels() {
  return cleanupProcessedAsbestosLabels();
}

function processItelAttachments() {
  const startedAt = new Date();

  const summary = {
    foundCount: 0,
    parsedCount: 0,
    processedCount: 0,
    folderReadyCount: 0,
    warnings: 0,
    errors: 0,
    threadsWithAttachments: 0,
    totalAttachmentsDetected: 0,
    copyEligibleAttachments: 0,
    reviewNeededAttachments: 0,
    skippedAttachments: 0
  };

  const items = [];

  try {
    const threads = GmailApp.search(CONFIG.itelQuery, 0, CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        warnings: [],
        errors: []
      };

      try {
        const claimData = parseInsuranceIntakeThread(thread);
        summary.parsedCount++;

        itemResult.subject = claimData.subject;
        itemResult.claimNumber = claimData.claimNumber;
        itemResult.customerName = claimData.customerName;
        itemResult.extractionDebug = {
          claimNumber: claimData.claimNumber,
          customerName: claimData.customerName,
          source: 'parseInsuranceIntakeThread'
        };

        const attachmentResult = detectThreadAttachments_(thread);
        itemResult.attachmentResult = attachmentResult;
        updateAttachmentSummary_(summary, attachmentResult);

        if (!claimData.claimNumber) {
          itemResult.status = 'needs_review_missing_claim_number';
          itemResult.warnings.push('No claim number could be extracted from Itel thread.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelNeedsReviewLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        const folderResult = findExistingClaimFolderForVendor_(claimData);
        itemResult.folderResult = folderResult;

        if (!folderResult.success) {
          itemResult.status = folderResult.status || 'folder_check_failed';
          itemResult.errors.push(folderResult.error);

          const folderFailureLabel = folderResult.status === 'pending_claim_folder'
            ? CONFIG.itelPendingClaimFolderLabel
            : CONFIG.itelErrorLabel;

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [folderFailureLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const itelSubfolderResult = checkOrCreateVendorSubfolder_(folderResult.folderId, CONFIG.itelSubfolderName);
        itemResult.itelSubfolderResult = itelSubfolderResult;

        if (!itelSubfolderResult.success) {
          itemResult.status = 'itel_subfolder_check_failed';
          itemResult.errors.push(itelSubfolderResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelErrorLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        summary.folderReadyCount++;

        const itelCopyResult = copyEligibleAttachments_({
          workflow: 'Itel Attachment Intake',
          vendor: 'Itel',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: itelSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentCopyResult = itelCopyResult;

        if (!itelCopyResult.success) {
          itemResult.warnings.push('Itel attachment copy update failed: ' + itelCopyResult.error);
          summary.warnings++;
        }

        const itelLogResult = appendAttachmentLogRows_({
          workflow: 'Itel Attachment Intake',
          vendor: 'Itel',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: itelSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentLogResult = itelLogResult;

        if (!itelLogResult.success) {
          itemResult.warnings.push('Itel attachment log update failed: ' + itelLogResult.error);
          summary.warnings++;
        }

        const itelManifestResult = writeAttachmentManifest_({
          workflow: 'Itel Attachment Intake',
          vendor: 'Itel',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: itelSubfolderResult,
          attachmentResult: attachmentResult,
          copyResult: itelCopyResult,
          logResult: itelLogResult
        });
        itemResult.attachmentManifestResult = itelManifestResult;

        if (!itelManifestResult.success) {
          itemResult.warnings.push('Itel attachment manifest update failed: ' + itelManifestResult.error);
          summary.warnings++;
        }

        if (attachmentResult.attachmentCount <= 0) {
          itemResult.status = 'needs_review_no_attachments';
          itemResult.warnings.push('No Itel attachments were detected.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelNeedsReviewLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        itemResult.status = 'itel_attachments_detected_folder_ready';

        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [CONFIG.itelProcessedLabel],
          remove: getItelWorkflowStateLabelsToRemove_()
        });

        thread.markRead();
        itemResult.mailReadState = 'marked_read';
        itemResult.labelResult = labelResult;

        if (!labelResult.success) {
          itemResult.status = 'itel_detected_with_label_warning';
          itemResult.warnings.push('Itel processed label update failed: ' + labelResult.error);
          summary.warnings++;
        }

        summary.processedCount++;
        items.push(itemResult);
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);

        try {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelErrorLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel error label update failed: ' + labelResult.error);
            summary.warnings++;
          }
        } catch (labelError) {
          itemResult.warnings.push('Itel error label update threw an exception: ' + labelError.message);
          summary.warnings++;
        }

        summary.errors++;
        items.push(itemResult);
      }
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildItelAttachmentMessage_(summary),
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Attachment Intake',
        dryRun: CONFIG.dryRun,
        query: CONFIG.itelQuery,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        items: items
      }
    };
  } catch (error) {
    summary.errors++;

    return {
      status: 'Error',
      message: error.message,
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Attachment Intake',
        dryRun: CONFIG.dryRun,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function cleanupProcessedItelLabels() {
  const startedAt = new Date();
  const query = 'label:Itel label:"Itel/Processed/Itel"';
  const summary = {
    foundCount: 0,
    cleanedCount: 0,
    warnings: 0,
    errors: 0
  };
  const items = [];

  try {
    const threads = GmailApp.search(query, 0, CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        warnings: [],
        errors: []
      };

      try {
        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [],
          remove: [CONFIG.itelIntakeLabel]
        });

        itemResult.labelResult = labelResult;

        if (labelResult.success) {
          itemResult.status = 'itel_source_label_removed';
          summary.cleanedCount++;
        } else {
          itemResult.status = 'itel_source_label_remove_warning';
          itemResult.warnings.push(labelResult.error);
          summary.warnings++;
        }
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);
        summary.errors++;
      }

      items.push(itemResult);
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: 'Cleaned ' + summary.cleanedCount + ' Itel source label(s) from ' + summary.foundCount + ' processed Itel thread(s).',
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Label Cleanup',
        query: query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        items: items
      }
    };
  } catch (error) {
    summary.errors++;

    return {
      status: 'Error',
      message: error.message,
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Label Cleanup',
        query: query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function buildItelAttachmentMessage_(summary) {
  return 'Phase ' + CONFIG.phase + ' Itel attachment intake found ' + summary.foundCount +
    ' Itel thread(s), parsed ' + summary.parsedCount +
    ', prepared ' + summary.folderReadyCount +
    ' claim folder(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
}

function listTodoistProjects() {
  const startedAt = new Date();
  const result = {
    automation: CONFIG.automationName,
    phase: CONFIG.phase,
    workflow: 'Todoist Project List',
    readOnly: true,
    startedAt: startedAt,
    finishedAt: null,
    projects: []
  };

  try {
    const todoist = getTodoistConfig_();

    if (!todoist.apiToken) {
      throw new Error('Missing TODOIST_API_TOKEN script property.');
    }

    const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/sync', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + todoist.apiToken
      },
      payload: JSON.stringify({
        sync_token: '*',
        resource_types: ['projects', 'sections', 'collaborators']
      }),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Todoist project list failed: HTTP ' + code + ' - ' + body);
    }

    const data = JSON.parse(body || '{}');
    const sections = data.sections || [];
    const collaborators = data.collaborators || [];

    result.projects = (data.projects || []).map(function(project) {
      return {
        id: project.id || '',
        name: project.name || '',
        isShared: project.is_shared === true,
        sectionCount: sections.filter(function(section) {
          return String(section.project_id || '') === String(project.id || '');
        }).length
      };
    });

    result.sections = sections.map(function(section) {
      return {
        id: section.id || '',
        name: section.name || '',
        projectId: section.project_id || ''
      };
    });

    result.collaborators = collaborators.map(function(collaborator) {
      return {
        id: collaborator.id || '',
        name: collaborator.full_name || collaborator.name || '',
        email: collaborator.email || ''
      };
    });

    result.finishedAt = new Date();

    return {
      status: 'Success',
      message: 'Todoist project list succeeded. Found ' + result.projects.length + ' project(s).',
      result: result
    };
  } catch (error) {
    result.finishedAt = new Date();
    result.error = error.message;

    return {
      status: 'Error',
      message: error.message,
      result: result
    };
  }
}

function testTodoistConnection() {
  const startedAt = new Date();
  const result = {
    automation: CONFIG.automationName,
    phase: CONFIG.phase,
    workflow: 'Todoist Connection Test',
    readOnly: true,
    startedAt: startedAt,
    finishedAt: null,
    config: {
      enabled: CONFIG.todoist && CONFIG.todoist.enabled === true,
      hasApiToken: false,
      hasProjectId: false,
      hasAssigneeIdClarence: false,
      hasSectionId: false,
      dueString: CONFIG.todoist && CONFIG.todoist.dueString ? CONFIG.todoist.dueString : '',
      priority: CONFIG.todoist && CONFIG.todoist.priority ? CONFIG.todoist.priority : ''
    },
    todoist: {
      reachable: false,
      projectTaskCount: 0,
      sampleTasks: []
    }
  };

  try {
    const todoist = getTodoistConfig_();
    result.config.hasApiToken = !!todoist.apiToken;
    result.config.hasProjectId = !!todoist.projectId;
    result.config.hasAssigneeIdClarence = !!todoist.assigneeId;
    result.config.hasSectionId = !!todoist.sectionId;

    if (!todoist.apiToken) {
      throw new Error('Missing TODOIST_API_TOKEN script property.');
    }

    if (!todoist.projectId) {
      throw new Error('Missing TODOIST_PROJECT_ID script property.');
    }

    const url = 'https://api.todoist.com/api/v1/tasks?project_id=' + encodeURIComponent(todoist.projectId) + '&limit=200';
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + todoist.apiToken
      },
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    if (code < 200 || code >= 300) {
      throw new Error('Todoist connection test failed: HTTP ' + code + ' - ' + body);
    }

    const parsed = JSON.parse(body || '{}');
    const tasks = parsed.results || [];
    result.todoist.reachable = true;
    result.todoist.projectTaskCount = tasks.length;
    result.todoist.sampleTasks = tasks.slice(0, 5).map(function(task) {
      return {
        id: task.id || '',
        content: task.content || '',
        url: task.url || ''
      };
    });
    result.finishedAt = new Date();

    return {
      status: 'Success',
      message: 'Todoist connection test succeeded. Found ' + tasks.length + ' task(s) in the configured project.',
      result: result
    };
  } catch (error) {
    result.finishedAt = new Date();
    result.error = error.message;

    return {
      status: 'Error',
      message: error.message,
      result: result
    };
  }
}

function createOrSkipTodoistIntakeTask_(claimData, folderResult, thread) {
  const result = {
    enabled: CONFIG.todoist && CONFIG.todoist.enabled === true,
    success: true,
    skipped: false,
    duplicate: false,
    taskId: '',
    taskUrl: '',
    status: 'todoist_disabled',
    message: ''
  };

  if (!result.enabled) {
    result.skipped = true;
    result.message = 'Todoist integration is disabled.';
    return result;
  }

  try {
    const existingTask = searchTodoistTaskByClaimNumber_(claimData.claimNumber);

    if (existingTask) {
      result.duplicate = true;
      result.taskId = existingTask.id || '';
      result.taskUrl = existingTask.url || '';
      result.status = 'todoist_duplicate_skipped';
      result.message = 'Todoist task already exists for claim ' + claimData.claimNumber + '.';
      return result;
    }

    const createdTask = createTodoistIntakeTask_({
      customerName: claimData.customerName,
      claimNumber: claimData.claimNumber,
      subject: claimData.subject,
      folderId: folderResult.folderId,
      folderUrl: folderResult.folderUrl,
      threadId: thread.getId()
    });

    result.taskId = createdTask.id || '';
    result.taskUrl = createdTask.url || '';
    result.status = 'todoist_task_created';
    result.message = 'Created Todoist task for claim ' + claimData.claimNumber + '.';
    return result;
  } catch (error) {
    result.success = false;
    result.status = 'todoist_error';
    result.error = error.message;
    return result;
  }
}

function getTodoistConfig_() {
  const props = PropertiesService.getScriptProperties();
  const todoistConfig = CONFIG.todoist || {};

  return {
    apiToken: props.getProperty(todoistConfig.apiTokenProperty || 'TODOIST_API_TOKEN'),
    projectId: props.getProperty(todoistConfig.projectIdProperty || 'TODOIST_PROJECT_ID'),
    assigneeId: props.getProperty(todoistConfig.assigneeIdClarenceProperty || 'TODOIST_ASSIGNEE_ID_CLARENCE'),
    sectionId: props.getProperty(todoistConfig.sectionIdProperty || 'TODOIST_SECTION_ID'),
    dueString: todoistConfig.dueString || 'today',
    priority: todoistConfig.priority || 3
  };
}

function searchTodoistTaskByClaimNumber_(claimNumber) {
  const todoist = getTodoistConfig_();

  if (!claimNumber) {
    throw new Error('Cannot search Todoist without a claim number.');
  }

  if (!todoist.apiToken) {
    throw new Error('Missing TODOIST_API_TOKEN script property.');
  }

  if (!todoist.projectId) {
    throw new Error('Missing TODOIST_PROJECT_ID script property.');
  }

  const url = 'https://api.todoist.com/api/v1/tasks?project_id=' + encodeURIComponent(todoist.projectId) + '&limit=200';
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + todoist.apiToken
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Todoist task search failed: HTTP ' + code + ' - ' + body);
  }

  const parsed = JSON.parse(body || '{}');
  const tasks = parsed.results || [];
  const normalizedClaimNumber = String(claimNumber || '').trim();

  return tasks.find(function(task) {
    const content = String(task.content || '');
    const description = String(task.description || '');
    return content.indexOf(normalizedClaimNumber) !== -1 || description.indexOf(normalizedClaimNumber) !== -1;
  }) || null;
}

function createTodoistIntakeTask_(payload) {
  const todoist = getTodoistConfig_();

  if (!todoist.apiToken) {
    throw new Error('Missing TODOIST_API_TOKEN script property.');
  }

  if (!todoist.projectId) {
    throw new Error('Missing TODOIST_PROJECT_ID script property.');
  }

  if (!todoist.assigneeId) {
    throw new Error('Missing TODOIST_ASSIGNEE_ID_CLARENCE script property.');
  }

  const task = {
    content: buildTodoistIntakeTaskTitle_(payload.customerName, payload.claimNumber),
    description: buildTodoistIntakeTaskDescription_(payload),
    project_id: todoist.projectId,
    assignee_id: todoist.assigneeId,
    priority: todoist.priority,
    due_string: todoist.dueString
  };

  if (todoist.sectionId) {
    task.section_id = todoist.sectionId;
  }

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/tasks', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + todoist.apiToken
    },
    payload: JSON.stringify(task),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Todoist task creation failed: HTTP ' + code + ' - ' + body);
  }

  return JSON.parse(body || '{}');
}

function buildTodoistIntakeTaskTitle_(customerName, claimNumber) {
  return String(customerName || 'UNKNOWN CUSTOMER').trim() + ' - ' + String(claimNumber || '').trim();
}

function buildTodoistIntakeTaskDescription_(payload) {
  return 'Upload 3 Day';
}

function buildPhase4CMessage_(summary) {
  return 'Phase ' + CONFIG.phase + ' found ' + summary.foundCount +
    ' insurance intake thread(s), parsed ' + summary.parsedCount +
    ', skipped ' + summary.duplicatesSkipped +
    ' duplicate(s), added ' + summary.sheetRowsAdded +
    ' sheet row(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
}

function detectThreadAttachments_(thread) {
  const result = {
    detectionEnabled: CONFIG.attachments && CONFIG.attachments.detectionEnabled === true,
    copyEnabled: CONFIG.attachments && CONFIG.attachments.copyEnabled === true,
    threadId: thread.getId(),
    messageCount: 0,
    attachmentCount: 0,
    copyEligibleCount: 0,
    reviewNeededCount: 0,
    skippedCount: 0,
    attachments: [],
    warnings: [],
    errors: []
  };

  if (!result.detectionEnabled) {
    result.status = 'attachment_detection_disabled';
    return result;
  }

  try {
    const messages = thread.getMessages();
    result.messageCount = messages.length;

    for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
      const message = messages[messageIndex];
      const attachments = message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      });

      for (let attachmentIndex = 0; attachmentIndex < attachments.length; attachmentIndex++) {
        const attachmentRecord = buildAttachmentMetadata_(thread, message, attachments[attachmentIndex], messageIndex, attachmentIndex);
        result.attachments.push(attachmentRecord);
        result.attachmentCount++;

        if (attachmentRecord.status === 'CopyEligible') {
          result.copyEligibleCount++;
        } else if (attachmentRecord.status === 'ReviewNeeded') {
          result.reviewNeededCount++;
        } else {
          result.skippedCount++;
        }
      }
    }

    result.status = result.attachmentCount > 0 ? 'attachments_detected' : 'no_attachments_detected';
    return result;
  } catch (error) {
    result.status = 'attachment_detection_error';
    result.errors.push(error.message);
    return result;
  }
}

function buildAttachmentMetadata_(thread, message, attachment, messageIndex, attachmentIndex) {
  const name = attachment.getName() || 'unnamed-attachment';
  const contentType = attachment.getContentType() || 'unknown';
  const sizeBytes = attachment.getBytes().length;
  const classification = classifyAttachment_(name, contentType, sizeBytes);
  const attachmentIdentity = buildAttachmentIdentity_(thread.getId(), message.getId(), name, contentType, sizeBytes);

  return {
    threadId: thread.getId(),
    messageId: message.getId(),
    messageIndex: messageIndex,
    messageDate: message.getDate(),
    messageFrom: message.getFrom(),
    attachmentIndex: attachmentIndex,
    attachmentName: name,
    contentType: contentType,
    sizeBytes: sizeBytes,
    attachmentIdentity: attachmentIdentity,
    fingerprint: buildAttachmentFingerprint_(thread.getId(), message.getId(), name, contentType, sizeBytes),
    copyEligible: classification.copyEligible,
    reviewNeeded: classification.reviewNeeded,
    status: classification.status,
    reviewReason: classification.reviewReason,
    copyAttempted: false,
    copiedFileId: null,
    copiedFileUrl: null,
    duplicateFileDetected: false,
    duplicateMatchFileId: null,
    error: null
  };
}

function classifyAttachment_(name, contentType, sizeBytes) {
  const maxBytes = CONFIG.attachments && CONFIG.attachments.maxAttachmentBytes ? CONFIG.attachments.maxAttachmentBytes : 25000000;
  const allowedMimeTypes = CONFIG.attachments && CONFIG.attachments.allowedMimeTypes ? CONFIG.attachments.allowedMimeTypes : [];
  const reviewMimeTypes = CONFIG.attachments && CONFIG.attachments.reviewMimeTypes ? CONFIG.attachments.reviewMimeTypes : [];

  if (!name || name === 'unnamed-attachment') {
    return {
      status: 'ReviewNeeded',
      copyEligible: false,
      reviewNeeded: true,
      reviewReason: 'Attachment has no usable filename.'
    };
  }

  if (!sizeBytes || sizeBytes <= 0) {
    return {
      status: 'ReviewNeeded',
      copyEligible: false,
      reviewNeeded: true,
      reviewReason: 'Attachment is empty or has an unreadable size.'
    };
  }

  if (sizeBytes > maxBytes) {
    return {
      status: 'ReviewNeeded',
      copyEligible: false,
      reviewNeeded: true,
      reviewReason: 'Attachment exceeds configured max size of ' + maxBytes + ' bytes.'
    };
  }

  if (allowedMimeTypes.indexOf(contentType) !== -1) {
    return {
      status: 'CopyEligible',
      copyEligible: true,
      reviewNeeded: false,
      reviewReason: null
    };
  }

  if (reviewMimeTypes.indexOf(contentType) !== -1) {
    return {
      status: 'ReviewNeeded',
      copyEligible: false,
      reviewNeeded: true,
      reviewReason: 'Attachment MIME type requires manual review: ' + contentType
    };
  }

  return {
    status: 'ReviewNeeded',
    copyEligible: false,
    reviewNeeded: true,
    reviewReason: 'Attachment MIME type is not allowlisted: ' + contentType
  };
}

function buildAttachmentIdentity_(threadId, messageId, name, contentType, sizeBytes) {
  return [
    threadId || '',
    messageId || '',
    name || '',
    contentType || '',
    String(sizeBytes || 0)
  ].join('|');
}

function buildAttachmentFingerprint_(threadId, messageId, name, contentType, sizeBytes) {
  return [
    threadId || '',
    messageId || '',
    name || '',
    contentType || '',
    String(sizeBytes || 0)
  ].join('|');
}


function copyEligibleAttachments_(context) {
  const attachmentResult = context.attachmentResult;
  const vendorSubfolderResult = context.vendorSubfolderResult || {};

  const result = {
    copyEnabled: CONFIG.attachments && CONFIG.attachments.copyEnabled === true,
    duplicateCheckEnabled: CONFIG.attachments && CONFIG.attachments.duplicateCheckEnabled === true,
    copyAttemptedCount: 0,
    copiedCount: 0,
    duplicateFileCount: 0,
    skippedCount: 0,
    errorCount: 0,
    copiedFiles: [],
    duplicateFiles: [],
    skippedFiles: [],
    errors: []
  };

  if (!result.copyEnabled) {
    result.success = true;
    result.skipped = true;
    result.reason = 'Attachment copying disabled.';
    return result;
  }

  if (!attachmentResult || !attachmentResult.attachments || attachmentResult.attachments.length === 0) {
    result.success = true;
    result.skipped = true;
    result.reason = 'No attachments to copy.';
    return result;
  }

  if (!vendorSubfolderResult.folderId) {
    result.success = false;
    result.skipped = false;
    result.error = 'Missing destination folder ID for attachment copy.';
    return result;
  }

  try {
    const destinationFolder = DriveApp.getFolderById(vendorSubfolderResult.folderId);
    const messages = context.thread.getMessages();

    attachmentResult.attachments.forEach(function(attachmentRecord) {
      if (attachmentRecord.copyEligible !== true) {
        attachmentRecord.copyAttempted = false;
        attachmentRecord.copyStatus = 'SkippedNotEligible';
        result.skippedCount++;
        result.skippedFiles.push(attachmentRecord.attachmentName);
        return;
      }

      result.copyAttemptedCount++;
      attachmentRecord.copyAttempted = true;

      const safeFileName = buildSafeAttachmentFileName_(attachmentRecord);
      attachmentRecord.targetFileName = safeFileName;

      const existingFile = result.duplicateCheckEnabled
        ? findChildFileByName_(destinationFolder, safeFileName)
        : null;

      if (existingFile) {
        attachmentRecord.copyStatus = 'DuplicateFileDetected';
        attachmentRecord.duplicateFileDetected = true;
        attachmentRecord.duplicateMatchFileId = existingFile.getId();
        attachmentRecord.copiedFileId = existingFile.getId();
        attachmentRecord.copiedFileUrl = existingFile.getUrl();
        result.duplicateFileCount++;
        result.duplicateFiles.push({
          attachmentName: attachmentRecord.attachmentName,
          targetFileName: safeFileName,
          fileId: existingFile.getId(),
          fileUrl: existingFile.getUrl()
        });
        return;
      }

      const sourceMessage = messages[attachmentRecord.messageIndex];
      const sourceAttachments = sourceMessage.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      });
      const sourceAttachment = sourceAttachments[attachmentRecord.attachmentIndex];

      if (!sourceAttachment) {
        attachmentRecord.copyStatus = 'CopyError';
        attachmentRecord.error = 'Source attachment no longer available at recorded index.';
        result.errorCount++;
        result.errors.push(attachmentRecord.error);
        return;
      }

      const blob = sourceAttachment.copyBlob().setName(safeFileName);
      const copiedFile = destinationFolder.createFile(blob);
      const verificationResult = verifyCopiedDriveFile_(copiedFile, safeFileName);

      attachmentRecord.copyVerification = verificationResult;

      if (!verificationResult.success) {
        attachmentRecord.copyStatus = 'CopyVerificationFailed';
        attachmentRecord.error = verificationResult.error;
        result.errorCount++;
        result.errors.push(verificationResult.error);
        return;
      }

      attachmentRecord.copyStatus = 'CopiedVerified';
      attachmentRecord.copiedFileId = copiedFile.getId();
      attachmentRecord.copiedFileUrl = copiedFile.getUrl();
      result.copiedCount++;
      result.copiedFiles.push({
        attachmentName: attachmentRecord.attachmentName,
        targetFileName: safeFileName,
        fileId: copiedFile.getId(),
        fileUrl: copiedFile.getUrl(),
        verificationStatus: verificationResult.status
      });
    });

    result.success = result.errorCount === 0;

    if (!result.success) {
      result.error = result.errors.join(' | ');
    }

    return result;
  } catch (error) {
    result.success = false;
    result.error = error.message;
    result.errors.push(error.message);
    return result;
  }
}

function buildSafeAttachmentFileName_(attachmentRecord) {
  const messageDate = attachmentRecord.messageDate ? new Date(attachmentRecord.messageDate) : new Date();
  const datePrefix = Utilities.formatDate(messageDate, Session.getScriptTimeZone(), 'yyyyMMdd');
  const originalName = sanitizeFileName_(attachmentRecord.attachmentName || 'attachment');

  return datePrefix + ' - ' + originalName;
}

function sanitizeFileName_(fileName) {
  return String(fileName || 'attachment')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function findChildFileByName_(parentFolder, fileName) {
  const files = parentFolder.getFilesByName(fileName);
  return files.hasNext() ? files.next() : null;
}

function verifyCopiedDriveFile_(file, expectedFileName) {
  try {
    if (!CONFIG.attachments || CONFIG.attachments.copyVerificationEnabled !== true) {
      return {
        success: true,
        skipped: true,
        status: 'CopyVerificationDisabled'
      };
    }

    if (!file) {
      return {
        success: false,
        skipped: false,
        status: 'CopyVerificationFailed',
        error: 'Copied file object was not returned by Drive.'
      };
    }

    const fileId = file.getId();
    const fileName = file.getName();
    const fileUrl = file.getUrl();

    if (!fileId) {
      return {
        success: false,
        skipped: false,
        status: 'CopyVerificationFailed',
        error: 'Copied file is missing a Drive file ID.'
      };
    }

    if (!fileUrl) {
      return {
        success: false,
        skipped: false,
        status: 'CopyVerificationFailed',
        error: 'Copied file is missing a Drive file URL.'
      };
    }

    if (expectedFileName && fileName !== expectedFileName) {
      return {
        success: false,
        skipped: false,
        status: 'CopyVerificationFailed',
        error: 'Copied file name mismatch. Expected "' + expectedFileName + '" but found "' + fileName + '".'
      };
    }

    return {
      success: true,
      skipped: false,
      status: 'CopiedVerified',
      fileId: fileId,
      fileName: fileName,
      fileUrl: fileUrl,
      verifiedAt: new Date()
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      status: 'CopyVerificationFailed',
      error: error.message
    };
  }
}


function updateAttachmentSummary_(summary, attachmentResult) {
  if (!attachmentResult || !attachmentResult.detectionEnabled) {
    return;
  }

  if (attachmentResult.attachmentCount > 0) {
    summary.threadsWithAttachments++;
  }

  summary.totalAttachmentsDetected += attachmentResult.attachmentCount || 0;
  summary.copyEligibleAttachments += attachmentResult.copyEligibleCount || 0;
  summary.reviewNeededAttachments += attachmentResult.reviewNeededCount || 0;
  summary.skippedAttachments += attachmentResult.skippedCount || 0;

  if (attachmentResult.errors && attachmentResult.errors.length > 0) {
    summary.warnings += attachmentResult.errors.length;
  }
}

function appendAttachmentLogRows_(context) {
  const attachmentResult = context.attachmentResult;

  if (!CONFIG.attachments || CONFIG.attachments.loggingEnabled !== true) {
    return {
      success: true,
      skipped: true,
      reason: 'Attachment logging disabled.'
    };
  }

  if (!attachmentResult || !attachmentResult.attachments || attachmentResult.attachments.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'No attachments to log.'
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const sheet = getAttachmentLogSheet_();
    ensureAttachmentLogHeader_(sheet);

    const existingAttachmentIdentities = getExistingAttachmentIdentities_(sheet);
    const runId = buildRunId_();
    const rows = [];
    let duplicateCount = 0;

    attachmentResult.attachments.forEach(function(attachmentRecord) {
      const attachmentLogIdentity = getAttachmentLogIdentity_(attachmentRecord);
      const duplicateLogged = existingAttachmentIdentities.indexOf(attachmentLogIdentity) !== -1 ||
        (attachmentRecord.fingerprint && existingAttachmentIdentities.indexOf(attachmentRecord.fingerprint) !== -1);

      if (duplicateLogged) {
        duplicateCount++;
        attachmentRecord.duplicateLogDetected = true;
        attachmentRecord.attachmentLogStatus = 'DuplicateLogSkipped';
        return;
      }

      attachmentRecord.duplicateLogDetected = false;
      attachmentRecord.attachmentLogStatus = 'Logged';

      rows.push(buildAttachmentLogRow_(context, attachmentRecord, runId, false));
    });

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return {
      success: true,
      skipped: false,
      runId: runId,
      rowsAdded: rows.length,
      duplicateLogCount: duplicateCount,
      duplicateRowsSkipped: duplicateCount
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error: error.message
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function getAttachmentLogSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
  let sheet = ss.getSheetByName(CONFIG.attachmentLogSheetName);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.attachmentLogSheetName);
  }

  return sheet;
}

function ensureAttachmentLogHeader_(sheet) {
  const headers = getAttachmentLogHeaders_();
  const existingHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = existingHeader.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getAttachmentLogHeaders_() {
  return [
    'Timestamp',
    'Run ID',
    'Workflow',
    'Vendor',
    'Claim Number',
    'Customer Name',
    'Thread ID',
    'Message ID',
    'Message Date',
    'Sender',
    'Subject',
    'Claim Folder ID',
    'Claim Folder URL',
    'Vendor Folder ID',
    'Vendor Folder URL',
    'Attachment Name',
    'Attachment MIME Type',
    'Attachment Size Bytes',
    'Attachment Identity',
    'Attachment Status',
    'Copy Eligible',
    'Review Needed',
    'Review Reason',
    'Duplicate Log Detected',
    'Copy Attempted',
    'Copied File ID',
    'Copied File URL',
    'Error',
    'Automation Phase'
  ];
}

function getExistingAttachmentIdentities_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const attachmentIdentityColumn = 19;
  const values = sheet.getRange(2, attachmentIdentityColumn, lastRow - 1, 1).getValues();

  return values
    .map(function(row) {
      return String(row[0] || '').trim();
    })
    .filter(function(value) {
      return value !== '';
    });
}
function getAttachmentLogIdentity_(attachmentRecord) {
  if (!attachmentRecord) {
    return '';
  }

  return attachmentRecord.attachmentIdentity || attachmentRecord.fingerprint || '';
}


function buildAttachmentLogRow_(context, attachmentRecord, runId, duplicateLogged) {
  const claimData = context.claimData || {};
  const folderResult = context.folderResult || {};
  const vendorSubfolderResult = context.vendorSubfolderResult || {};

  return [
    new Date(),
    runId,
    context.workflow || '',
    context.vendor || '',
    claimData.claimNumber || '',
    claimData.customerName || '',
    attachmentRecord.threadId || '',
    attachmentRecord.messageId || '',
    attachmentRecord.messageDate || '',
    attachmentRecord.messageFrom || '',
    claimData.subject || '',
    folderResult.folderId || '',
    folderResult.folderUrl || '',
    vendorSubfolderResult.folderId || '',
    vendorSubfolderResult.folderUrl || '',
    attachmentRecord.attachmentName || '',
    attachmentRecord.contentType || '',
    attachmentRecord.sizeBytes || 0,
    getAttachmentLogIdentity_(attachmentRecord),
    attachmentRecord.copyStatus || attachmentRecord.attachmentLogStatus || attachmentRecord.status || '',
    attachmentRecord.copyEligible === true,
    attachmentRecord.reviewNeeded === true,
    attachmentRecord.reviewReason || '',
    duplicateLogged === true,
    attachmentRecord.copyAttempted === true,
    attachmentRecord.copiedFileId || '',
    attachmentRecord.copiedFileUrl || '',
    attachmentRecord.error || '',
    CONFIG.phase
  ];
}

function buildRunId_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
}

function writeAttachmentManifest_(context) {
  if (!CONFIG.attachments || CONFIG.attachments.manifestEnabled !== true) {
    return {
      success: true,
      skipped: true,
      reason: 'Attachment manifest disabled.'
    };
  }

  const attachmentResult = context.attachmentResult;
  const vendorSubfolderResult = context.vendorSubfolderResult || {};

  if (!attachmentResult || !attachmentResult.attachments || attachmentResult.attachments.length === 0) {
    return {
      success: true,
      skipped: true,
      reason: 'No attachments to write to manifest.'
    };
  }

  if (!vendorSubfolderResult.folderId) {
    return {
      success: false,
      skipped: false,
      error: 'Missing vendor folder ID for attachment manifest.'
    };
  }

  try {
    const vendorFolder = DriveApp.getFolderById(vendorSubfolderResult.folderId);
    const manifestFileName = CONFIG.attachments.manifestFileName || 'attachment-manifest.json';
    const existingManifestFile = findChildFileByName_(vendorFolder, manifestFileName);
    const existingManifest = existingManifestFile ? readManifestFile_(existingManifestFile) : null;
    const manifest = buildUpdatedAttachmentManifest_(context, existingManifest);
    const manifestJson = JSON.stringify(manifest, null, 2);

    if (existingManifestFile) {
      existingManifestFile.setContent(manifestJson);

      return {
        success: true,
        skipped: false,
        created: false,
        updated: true,
        manifestFileName: manifestFileName,
        manifestFileId: existingManifestFile.getId(),
        manifestFileUrl: existingManifestFile.getUrl(),
        attachmentCount: manifest.attachments.length
      };
    }

    const createdFile = vendorFolder.createFile(manifestFileName, manifestJson, MimeType.PLAIN_TEXT);

    return {
      success: true,
      skipped: false,
      created: true,
      updated: false,
      manifestFileName: manifestFileName,
      manifestFileId: createdFile.getId(),
      manifestFileUrl: createdFile.getUrl(),
      attachmentCount: manifest.attachments.length
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error: error.message
    };
  }
}

function readManifestFile_(manifestFile) {
  try {
    const content = manifestFile.getBlob().getDataAsString();

    if (!content) {
      return null;
    }

    return JSON.parse(content);
  } catch (error) {
    return {
      manifestReadWarning: error.message,
      attachments: []
    };
  }
}

function buildUpdatedAttachmentManifest_(context, existingManifest) {
  const claimData = context.claimData || {};
  const folderResult = context.folderResult || {};
  const vendorSubfolderResult = context.vendorSubfolderResult || {};
  const attachmentResult = context.attachmentResult || {};
  const existingAttachments = existingManifest && existingManifest.attachments ? existingManifest.attachments : [];
  const attachmentMap = {};

  existingAttachments.forEach(function(record) {
    const identityKey = record && (record.attachmentIdentity || record.fingerprint);

    if (identityKey) {
      attachmentMap[identityKey] = record;
    }
  });

  attachmentResult.attachments.forEach(function(attachmentRecord) {
    const identityKey = attachmentRecord.attachmentIdentity || attachmentRecord.fingerprint;

    if (!identityKey) {
      return;
    }

    attachmentMap[identityKey] = buildManifestAttachmentRecord_(attachmentRecord);
  });

  const attachments = Object.keys(attachmentMap)
    .sort()
    .map(function(key) {
      return attachmentMap[key];
    });

  return {
    manifestVersion: CONFIG.attachments.manifestSchemaVersion || 2,
    automationPhase: CONFIG.phase,
    workflow: context.workflow || '',
    vendor: context.vendor || '',
    claimNumber: claimData.claimNumber || '',
    customerName: claimData.customerName || '',
    claimFolderId: folderResult.folderId || '',
    claimFolderUrl: folderResult.folderUrl || '',
    vendorFolderId: vendorSubfolderResult.folderId || '',
    vendorFolderUrl: vendorSubfolderResult.folderUrl || '',
    sourceThreadId: context.thread && context.thread.getId ? context.thread.getId() : '',
    subject: claimData.subject || '',
    createdAt: existingManifest && existingManifest.createdAt ? existingManifest.createdAt : new Date(),
    lastUpdatedAt: new Date(),
    attachmentCount: attachments.length,
    attachments: attachments
  };
}

function buildManifestAttachmentRecord_(attachmentRecord) {
  return {
    attachmentIdentity: attachmentRecord.attachmentIdentity || attachmentRecord.fingerprint || '',
    fingerprint: attachmentRecord.fingerprint || '',
    originalName: attachmentRecord.attachmentName || '',
    storedName: attachmentRecord.targetFileName || '',
    mimeType: attachmentRecord.contentType || '',
    sizeBytes: attachmentRecord.sizeBytes || 0,
    sourceThreadId: attachmentRecord.threadId || '',
    sourceMessageId: attachmentRecord.messageId || '',
    sourceMessageDate: attachmentRecord.messageDate || '',
    sourceSender: attachmentRecord.messageFrom || '',
    copyEligible: attachmentRecord.copyEligible === true,
    reviewNeeded: attachmentRecord.reviewNeeded === true,
    reviewReason: attachmentRecord.reviewReason || '',
    copyAttempted: attachmentRecord.copyAttempted === true,
    copyStatus: attachmentRecord.copyStatus || attachmentRecord.status || '',
    duplicateFileDetected: attachmentRecord.duplicateFileDetected === true,
    duplicateMatchFileId: attachmentRecord.duplicateMatchFileId || '',
    fileId: attachmentRecord.copiedFileId || '',
    fileUrl: attachmentRecord.copiedFileUrl || '',
    error: attachmentRecord.error || '',
    updatedAt: new Date()
  };
}

function checkOrCreateClaimFolder_(claimData) {
  if (!CONFIG.createClaimFolders) {
    return {
      success: true,
      phase: CONFIG.phase,
      skipped: true,
      folderId: '',
      folderUrl: '',
      note: 'Claim folder creation/checking is disabled. Set CONFIG.createClaimFolders to true after configuring claimFolderParentFolderId.'
    };
  }

  if (!CONFIG.claimFolderParentFolderId || CONFIG.claimFolderParentFolderId === 'PASTE_CLAIM_FOLDER_PARENT_FOLDER_ID_HERE') {
    return {
      success: false,
      phase: CONFIG.phase,
      folderId: '',
      folderUrl: '',
      error: 'Set CONFIG.claimFolderParentFolderId before enabling claim folder creation/checking.'
    };
  }

  try {
    const parentFolder = DriveApp.getFolderById(CONFIG.claimFolderParentFolderId);
    const yearFolder = getOrCreateCurrentYearFolder_(parentFolder);
    const folderName = buildClaimFolderName_(claimData);
    const existingFolder = findChildFolderByName_(yearFolder.folder, folderName);

    if (existingFolder) {
      return {
        success: true,
        phase: CONFIG.phase,
        created: false,
        existing: true,
        matchedBy: 'exact_folder_name',
        year: yearFolder.year,
        yearFolderCreated: yearFolder.created,
        yearFolderId: yearFolder.folder.getId(),
        yearFolderUrl: yearFolder.folder.getUrl(),
        folderName: folderName,
        folderId: existingFolder.getId(),
        folderUrl: existingFolder.getUrl()
      };
    }

    const existingFolderByClaimNumber = findChildFolderByClaimNumber_(yearFolder.folder, claimData.claimNumber);

    if (existingFolderByClaimNumber) {
      return {
        success: true,
        phase: CONFIG.phase,
        created: false,
        existing: true,
        matchedBy: 'claim_number_in_folder_name',
        year: yearFolder.year,
        yearFolderCreated: yearFolder.created,
        yearFolderId: yearFolder.folder.getId(),
        yearFolderUrl: yearFolder.folder.getUrl(),
        folderName: existingFolderByClaimNumber.getName(),
        requestedFolderName: folderName,
        folderId: existingFolderByClaimNumber.getId(),
        folderUrl: existingFolderByClaimNumber.getUrl()
      };
    }

    if (!claimData.customerName) {
      return {
        success: false,
        phase: CONFIG.phase,
        status: 'pending_claim_folder',
        created: false,
        existing: false,
        matchedBy: 'claim_number_not_found_and_customer_missing',
        year: yearFolder.year,
        yearFolderCreated: yearFolder.created,
        yearFolderId: yearFolder.folder.getId(),
        yearFolderUrl: yearFolder.folder.getUrl(),
        requestedFolderName: folderName,
        folderId: '',
        folderUrl: '',
        error: 'No existing claim folder found by claim number, and customer name is missing. Not creating UNKNOWN CUSTOMER folder.'
      };
    }

    const createdFolder = yearFolder.folder.createFolder(folderName);

    return {
      success: true,
      phase: CONFIG.phase,
      created: true,
      existing: false,
      matchedBy: 'created_new_folder',
      year: yearFolder.year,
      yearFolderCreated: yearFolder.created,
      yearFolderId: yearFolder.folder.getId(),
      yearFolderUrl: yearFolder.folder.getUrl(),
      folderName: folderName,
      folderId: createdFolder.getId(),
      folderUrl: createdFolder.getUrl()
    };
  } catch (error) {
    return {
      success: false,
      phase: CONFIG.phase,
      folderId: '',
      folderUrl: '',
      error: error.message
    };
  }
}

function findExistingClaimFolderForVendor_(claimData) {
  if (!CONFIG.claimFolderParentFolderId || CONFIG.claimFolderParentFolderId === 'PASTE_CLAIM_FOLDER_PARENT_FOLDER_ID_HERE') {
    return {
      success: false,
      phase: CONFIG.phase,
      status: 'folder_check_failed',
      created: false,
      existing: false,
      folderId: '',
      folderUrl: '',
      error: 'Set CONFIG.claimFolderParentFolderId before checking vendor claim folders.'
    };
  }

  try {
    const parentFolder = DriveApp.getFolderById(CONFIG.claimFolderParentFolderId);
    const currentYearFolder = getOrCreateCurrentYearFolder_(parentFolder);
    const claimNumber = claimData.claimNumber || '';
    const normalizedClaimNumber = normalizeClaimNumberForMatch_(claimNumber);
    const searchedFolders = [];

    const currentYearMatch = findChildFolderByClaimNumber_(currentYearFolder.folder, claimNumber);
    searchedFolders.push(currentYearFolder.folder.getName());

    if (currentYearMatch) {
      return {
        success: true,
        phase: CONFIG.phase,
        created: false,
        existing: true,
        matchedBy: 'claim_number_in_current_year_folder_name',
        vendorLookupOnly: true,
        year: currentYearFolder.year,
        yearFolderCreated: currentYearFolder.created,
        yearFolderId: currentYearFolder.folder.getId(),
        yearFolderUrl: currentYearFolder.folder.getUrl(),
        folderName: currentYearMatch.getName(),
        requestedClaimNumber: claimNumber,
        normalizedRequestedClaimNumber: normalizedClaimNumber,
        folderId: currentYearMatch.getId(),
        folderUrl: currentYearMatch.getUrl(),
        searchedFolders: searchedFolders
      };
    }

    const currentYearNameMatch = findChildFolderByCustomerName_(currentYearFolder.folder, claimData.customerName);

    if (currentYearNameMatch) {
      return {
        success: true,
        phase: CONFIG.phase,
        created: false,
        existing: true,
        matchedBy: 'customer_name_in_current_year_folder_name',
        vendorLookupOnly: true,
        year: currentYearFolder.year,
        yearFolderCreated: currentYearFolder.created,
        yearFolderId: currentYearFolder.folder.getId(),
        yearFolderUrl: currentYearFolder.folder.getUrl(),
        folderName: currentYearNameMatch.getName(),
        requestedClaimNumber: claimNumber,
        normalizedRequestedClaimNumber: normalizedClaimNumber,
        requestedCustomerName: claimData.customerName || '',
        normalizedRequestedCustomerName: normalizeNameForMatch_(claimData.customerName),
        folderId: currentYearNameMatch.getId(),
        folderUrl: currentYearNameMatch.getUrl(),
        searchedFolders: searchedFolders
      };
    }

    const claimFolderMapMatch = findClaimFolderFromMapByClaimNumberOrName_(claimNumber, claimData.customerName);

    if (claimFolderMapMatch) {
      return {
        success: true,
        phase: CONFIG.phase,
        created: false,
        existing: true,
        matchedBy: claimFolderMapMatch.matchedBy,
        vendorLookupOnly: true,
        year: claimFolderMapMatch.year || currentYearFolder.year,
        yearFolderCreated: currentYearFolder.created,
        yearFolderId: currentYearFolder.folder.getId(),
        yearFolderUrl: currentYearFolder.folder.getUrl(),
        folderName: claimFolderMapMatch.folderName,
        requestedClaimNumber: claimNumber,
        normalizedRequestedClaimNumber: normalizedClaimNumber,
        requestedCustomerName: claimData.customerName || '',
        normalizedRequestedCustomerName: normalizeNameForMatch_(claimData.customerName),
        folderId: claimFolderMapMatch.folderId,
        folderUrl: claimFolderMapMatch.folderUrl,
        claimFolderMapRowNumber: claimFolderMapMatch.rowNumber,
        searchedFolders: searchedFolders
      };
    }

    const yearFolders = parentFolder.getFolders();

    while (yearFolders.hasNext()) {
      const yearFolder = yearFolders.next();
      const yearFolderName = yearFolder.getName();

      if (yearFolder.getId() === currentYearFolder.folder.getId()) {
        continue;
      }

      searchedFolders.push(yearFolderName);

      const crossYearMatch = findChildFolderByClaimNumber_(yearFolder, claimNumber);

      if (crossYearMatch) {
        return {
          success: true,
          phase: CONFIG.phase,
          created: false,
          existing: true,
          matchedBy: 'claim_number_in_any_year_folder_name',
          vendorLookupOnly: true,
          year: yearFolderName,
          yearFolderCreated: false,
          yearFolderId: yearFolder.getId(),
          yearFolderUrl: yearFolder.getUrl(),
          folderName: crossYearMatch.getName(),
          requestedClaimNumber: claimNumber,
          normalizedRequestedClaimNumber: normalizedClaimNumber,
          requestedCustomerName: claimData.customerName || '',
          normalizedRequestedCustomerName: normalizeNameForMatch_(claimData.customerName),
          folderId: crossYearMatch.getId(),
          folderUrl: crossYearMatch.getUrl(),
          searchedFolders: searchedFolders
        };
      }

      const crossYearNameMatch = findChildFolderByCustomerName_(yearFolder, claimData.customerName);

      if (crossYearNameMatch) {
        return {
          success: true,
          phase: CONFIG.phase,
          created: false,
          existing: true,
          matchedBy: 'customer_name_in_any_year_folder_name',
          vendorLookupOnly: true,
          year: yearFolderName,
          yearFolderCreated: false,
          yearFolderId: yearFolder.getId(),
          yearFolderUrl: yearFolder.getUrl(),
          folderName: crossYearNameMatch.getName(),
          requestedClaimNumber: claimNumber,
          normalizedRequestedClaimNumber: normalizedClaimNumber,
          requestedCustomerName: claimData.customerName || '',
          normalizedRequestedCustomerName: normalizeNameForMatch_(claimData.customerName),
          folderId: crossYearNameMatch.getId(),
          folderUrl: crossYearNameMatch.getUrl(),
          searchedFolders: searchedFolders
        };
      }
    }

    return {
      success: false,
      phase: CONFIG.phase,
      status: 'pending_claim_folder',
      created: false,
      existing: false,
      matchedBy: 'claim_number_not_found',
      vendorLookupOnly: true,
      year: currentYearFolder.year,
      yearFolderCreated: currentYearFolder.created,
      yearFolderId: currentYearFolder.folder.getId(),
      yearFolderUrl: currentYearFolder.folder.getUrl(),
      requestedClaimNumber: claimNumber,
      normalizedRequestedClaimNumber: normalizedClaimNumber,
      requestedCustomerName: claimData.customerName || '',
      normalizedRequestedCustomerName: normalizeNameForMatch_(claimData.customerName),
      searchedFolders: searchedFolders,
      folderId: '',
      folderUrl: '',
      error: 'No existing claim folder found by claim number in current year folder, Claim Folder Map, or other year folders. Vendor workflow will not create a main claim folder.'
    };
  } catch (error) {
    return {
      success: false,
      phase: CONFIG.phase,
      status: 'folder_check_failed',
      created: false,
      existing: false,
      vendorLookupOnly: true,
      folderId: '',
      folderUrl: '',
      error: error.message
    };
  }
}

function checkOrCreateVendorSubfolder_(claimFolderId, subfolderName) {
  if (!claimFolderId) {
    return {
      success: false,
      subfolderName: subfolderName,
      folderId: '',
      folderUrl: '',
      error: 'Missing claim folder ID for vendor subfolder creation.'
    };
  }

  try {
    const claimFolder = DriveApp.getFolderById(claimFolderId);
    const cleanSubfolderName = sanitizeFolderName_(subfolderName);
    const existingSubfolder = findChildFolderByName_(claimFolder, cleanSubfolderName);

    if (existingSubfolder) {
      return {
        success: true,
        created: false,
        existing: true,
        subfolderName: cleanSubfolderName,
        folderId: existingSubfolder.getId(),
        folderUrl: existingSubfolder.getUrl()
      };
    }

    const createdSubfolder = claimFolder.createFolder(cleanSubfolderName);

    return {
      success: true,
      created: true,
      existing: false,
      subfolderName: cleanSubfolderName,
      folderId: createdSubfolder.getId(),
      folderUrl: createdSubfolder.getUrl()
    };
  } catch (error) {
    return {
      success: false,
      subfolderName: subfolderName,
      folderId: '',
      folderUrl: '',
      error: error.message
    };
  }
}

function getOrCreateCurrentYearFolder_(parentFolder) {
  const year = String(new Date().getFullYear());
  const existingYearFolder = findChildFolderByName_(parentFolder, year);

  if (existingYearFolder) {
    return {
      year: year,
      created: false,
      folder: existingYearFolder
    };
  }

  const createdYearFolder = parentFolder.createFolder(year);

  return {
    year: year,
    created: true,
    folder: createdYearFolder
  };
}

function buildClaimFolderName_(claimData) {
  const customerName = claimData.customerName || 'UNKNOWN CUSTOMER';
  const claimNumber = claimData.claimNumber || 'NO CLAIM NUMBER';

  return sanitizeFolderName_(claimNumber + ' - ' + customerName.toUpperCase());
}

function sanitizeFolderName_(folderName) {
  return String(folderName)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function findChildFolderByName_(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : null;
}

function findChildFolderByClaimNumber_(parentFolder, claimNumber) {
  const cleanClaimNumber = String(claimNumber || '').trim();
  const normalizedClaimNumber = normalizeClaimNumberForMatch_(cleanClaimNumber);
  const digitsOnlyClaimNumber = cleanClaimNumber.replace(/\D/g, '');

  if (!cleanClaimNumber) {
    return null;
  }

  const folders = parentFolder.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();
    const folderName = folder.getName();
    const normalizedFolderName = normalizeClaimNumberForMatch_(folderName);
    const folderDigitsOnly = folderName.replace(/\D/g, '');

    if (folderName.indexOf(cleanClaimNumber) !== -1) {
      return folder;
    }

    if (normalizedClaimNumber && normalizedFolderName.indexOf(normalizedClaimNumber) !== -1) {
      return folder;
    }

    if (digitsOnlyClaimNumber && folderDigitsOnly.indexOf(digitsOnlyClaimNumber) !== -1) {
      return folder;
    }
  }

  return null;
}

function findChildFolderByCustomerName_(parentFolder, customerName) {
  const normalizedCustomerName = normalizeNameForMatch_(customerName);

  if (!normalizedCustomerName) {
    return null;
  }

  const folders = parentFolder.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();
    const folderName = folder.getName();
    const normalizedFolderName = normalizeNameForMatch_(folderName);

    if (normalizedFolderName.indexOf(normalizedCustomerName) !== -1) {
      return folder;
    }
  }

  return null;
}

function normalizeNameForMatch_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeClaimNumberForMatch_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function appendClaimFolderMapRow_(claimData, folderResult, thread) {
  const rowData = [
    claimData.customerName || '',
    claimData.claimNumber || '',
    folderResult.year || String(new Date().getFullYear()),
    folderResult.folderUrl || '',
    folderResult.folderId || '',
    true,
    '',
    new Date(),
    buildClaimFolderNotes_(claimData, folderResult, thread)
  ];

  if (CONFIG.dryRun) {
    return {
      success: true,
      dryRun: true,
      sheetUpdated: false,
      rowData: rowData
    };
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const sheet = getClaimFolderMapSheet_();
    sheet.appendRow(rowData);

    return {
      success: true,
      dryRun: false,
      sheetUpdated: true,
      rowNumber: sheet.getLastRow()
    };
  } catch (error) {
    return {
      success: false,
      dryRun: CONFIG.dryRun,
      sheetUpdated: false,
      error: error.message
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function buildClaimFolderNotes_(claimData, folderResult, thread) {
  const notes = [];

  notes.push('Created by Insurance Intake Automation');
  notes.push('Phase: ' + CONFIG.phase);

  if (folderResult.created) {
    notes.push('Folder Created');
  }

  if (folderResult.existing) {
    notes.push('Existing Folder Reused');
  }

  if (thread && thread.getId) {
    notes.push('Thread ID: ' + thread.getId());
  }

  if (claimData.subject) {
    notes.push('Subject: ' + claimData.subject);
  }

  return notes.join(' | ');
}

function getGmailLabelForAdd_(labelName) {
  if (isRequiredExistingGmailLabel_(labelName)) {
    return getRequiredGmailLabel_(labelName);
  }

  return getOrCreateGmailLabel_(labelName);
}

function isRequiredExistingGmailLabel_(labelName) {
  const requiredLabels = [
    CONFIG.processedLabel,
    CONFIG.errorLabel,
    CONFIG.duplicateLabel,
    CONFIG.needsReviewLabel,
    CONFIG.asbestosProcessedLabel,
    CONFIG.asbestosErrorLabel,
    CONFIG.asbestosNeedsReviewLabel,
    CONFIG.asbestosPendingClaimFolderLabel,
    CONFIG.itelProcessedLabel,
    CONFIG.itelErrorLabel,
    CONFIG.itelNeedsReviewLabel,
    CONFIG.itelPendingClaimFolderLabel
  ];

  return requiredLabels.indexOf(labelName) !== -1;
}

function getRequiredGmailLabel_(labelName) {
  const label = GmailApp.getUserLabelByName(labelName);

  if (!label) {
    throw new Error('Required Gmail label does not exist: ' + labelName);
  }

  return label;
}

function getAsbestosWorkflowStateLabelsToRemove_() {
  return [
    CONFIG.asbestosIntakeLabel,
    CONFIG.asbestosNeedsReviewLabel,
    CONFIG.asbestosPendingClaimFolderLabel,
    CONFIG.asbestosErrorLabel,
    CONFIG.asbestosProcessedLabelLegacy
  ];
}

function getItelWorkflowStateLabelsToRemove_() {
  return [
    CONFIG.itelIntakeLabel,
    CONFIG.itelNeedsReviewLabel,
    CONFIG.itelPendingClaimFolderLabel,
    CONFIG.itelErrorLabel,
    CONFIG.itelProcessedLabelLegacy
  ];
}

function applyInsuranceIntakeLabels_(thread, labelPlan) {
  if (CONFIG.labelDryRun) {
    return {
      success: true,
      dryRun: true,
      labelsAdded: [],
      labelsRemoved: [],
      wouldAdd: labelPlan.add || [],
      wouldRemove: labelPlan.remove || []
    };
  }

  const labelsAdded = [];
  const labelsRemoved = [];
  const removeFailures = [];
  const addFailures = [];

  try {
    const addLabels = labelPlan.add || [];
    const removeLabels = labelPlan.remove || [];

    // Add destination labels first. Source labels are removed only after destination labels are verified.
    addLabels.forEach(function(labelName) {
      const label = getGmailLabelForAdd_(labelName);
      thread.addLabel(label);
      labelsAdded.push(labelName);
    });

    // Verify additions before removals so a processed/review/error label must stick before source labels are removed.
    addLabels.forEach(function(labelName) {
      const alreadyApplied = thread.getLabels().some(function(label) {
        return label.getName() === labelName;
      });

      if (!alreadyApplied) {
        const label = getGmailLabelForAdd_(labelName);
        thread.addLabel(label);
      }
    });

    addLabels.forEach(function(labelName) {
      const stillMissing = !thread.getLabels().some(function(label) {
        return label.getName() === labelName;
      });

      if (stillMissing) {
        addFailures.push(labelName);
      }
    });

    if (addFailures.length > 0) {
      return {
        success: false,
        dryRun: false,
        labelsAdded: labelsAdded,
        labelsRemoved: labelsRemoved,
        addFailures: addFailures,
        removeFailures: removeFailures,
        error: 'Failed to add label(s): ' + addFailures.join(', ')
      };
    }

    // Remove source labels only after destination labels have been verified.
    removeLabels.forEach(function(labelName) {
      const labelsToRemove = [labelName];

      if (labelName === CONFIG.asbestosIntakeLabel) {
        labelsToRemove.push(CONFIG.asbestosProcessedLabelLegacy);
      }

      if (labelName === CONFIG.itelIntakeLabel) {
        labelsToRemove.push(CONFIG.itelProcessedLabelLegacy);
      }

      labelsToRemove.forEach(function(removalLabelName) {
        const label = GmailApp.getUserLabelByName(removalLabelName);

        if (label) {
          thread.removeLabel(label);
          labelsRemoved.push(removalLabelName);
        }
      });
    });

    // Verify removals. Gmail can occasionally show stale label state unless we force a second pass.
    removeLabels.forEach(function(labelName) {
      const labelsToRemove = [labelName];

      if (labelName === CONFIG.asbestosIntakeLabel) {
        labelsToRemove.push(CONFIG.asbestosProcessedLabelLegacy);
      }

      if (labelName === CONFIG.itelIntakeLabel) {
        labelsToRemove.push(CONFIG.itelProcessedLabelLegacy);
      }

      labelsToRemove.forEach(function(removalLabelName) {
        const stillApplied = thread.getLabels().some(function(label) {
          return label.getName() === removalLabelName;
        });

        if (stillApplied) {
          const label = GmailApp.getUserLabelByName(removalLabelName);

          if (label) {
            thread.removeLabel(label);
          }
        }
      });
    });

    removeLabels.forEach(function(labelName) {
      const labelsToCheck = [labelName];

      if (labelName === CONFIG.asbestosIntakeLabel) {
        labelsToCheck.push(CONFIG.asbestosProcessedLabelLegacy);
      }

      if (labelName === CONFIG.itelIntakeLabel) {
        labelsToCheck.push(CONFIG.itelProcessedLabelLegacy);
      }

      labelsToCheck.forEach(function(checkLabelName) {
        const stillApplied = thread.getLabels().some(function(label) {
          return label.getName() === checkLabelName;
        });

        if (stillApplied) {
          removeFailures.push(checkLabelName);
        }
      });
    });

    if (removeFailures.length > 0) {
      return {
        success: false,
        dryRun: false,
        labelsAdded: labelsAdded,
        labelsRemoved: labelsRemoved,
        addFailures: addFailures,
        removeFailures: removeFailures,
        error: 'Failed to remove label(s): ' + removeFailures.join(', ')
      };
    }

    return {
      success: true,
      dryRun: false,
      labelsAdded: labelsAdded,
      labelsRemoved: labelsRemoved,
      addFailures: addFailures,
      removeFailures: removeFailures
    };
  } catch (error) {
    return {
      success: false,
      dryRun: CONFIG.labelDryRun,
      labelsAdded: labelsAdded,
      labelsRemoved: labelsRemoved,
      addFailures: addFailures,
      removeFailures: removeFailures,
      error: error.message
    };
  }
}

function getOrCreateGmailLabel_(labelName) {
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

function claimFolderMapHasDuplicate_(claimData, thread) {
  if (CONFIG.claimFolderMapSpreadsheetId === 'PASTE_CLAIM_FOLDER_MAP_SPREADSHEET_ID_HERE') {
    return {
      duplicate: false,
      dryRunSkipped: true,
      reason: 'Claim Folder Map spreadsheet ID not configured yet.'
    };
  }

  const sheet = getClaimFolderMapSheet_();
  const values = sheet.getDataRange().getValues();
  const threadId = thread.getId();
  const claimNumber = claimData.claimNumber;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const existingClaimNumber = String(row[1] || '').trim();
    const existingNotes = String(row[8] || '').trim();
    const existingThreadId = existingNotes.indexOf('Thread ID: ' + threadId) !== -1 ? threadId : '';

    if (claimNumber && existingClaimNumber === String(claimNumber).trim()) {
      return {
        duplicate: true,
        reason: 'claim_number_exists',
        rowNumber: i + 1
      };
    }

    if (existingThreadId && existingThreadId === threadId) {
      return {
        duplicate: true,
        reason: 'gmail_thread_id_exists',
        rowNumber: i + 1
      };
    }
  }

  return {
    duplicate: false
  };
}

function getClaimFolderMapSheet_() {
  if (CONFIG.claimFolderMapSpreadsheetId === 'PASTE_CLAIM_FOLDER_MAP_SPREADSHEET_ID_HERE') {
    throw new Error('Set CONFIG.claimFolderMapSpreadsheetId before enabling real Claim Folder Map updates.');
  }

  const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.claimFolderMapSheetName);

  if (!sheet) {
    throw new Error('Claim Folder Map sheet not found: ' + CONFIG.claimFolderMapSheetName);
  }

  return sheet;
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
    /\((\d{6,})\s*-\s*[^\)]+\)/i,
    /order\(s\)\s*(\d{6,})/i,
    /order\s*(?:number|#|no\.?|num\.?)?\s*[:#-]?\s*(\d{6,})/i,
    /claim\s*(?:number|#|no\.?|num\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /claim\s*[:#-]\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /clm\s*#?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /\b(\d{6,})\b/i,
    /\b([A-Z]{1,4}-?\d{5,})\b/i
  ];

  return extractFirstMatch(text, patterns);
}

function extractCustomerName(text) {
  const patterns = [
    /\((\d{6,})\s*-\s*([^\)]+)\)/i,
    /order\(s\)\s*\d{6,}\s*\((\d{6,})\s*-\s*([^\)]+)\)/i,
    /EMSL\s+report,\s*invoice,\s*COC\s+for\s+order\(s\)\s*\d{6,}\s*\(\d{6,}\s*-\s*([^\)]+)\)/i,
    /ITEL\s+Lab\s+Report\s*-\s*([^\n\r-]+?)\s*-\s*Clm\s*#/i,
    /customer\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /insured\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /policyholder\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /claimant\s*name\s*[:#-]?\s*([^\n\r]+)/i,
    /customer\s*[:#-]\s*([^\n\r]+)/i,
    /insured\s*[:#-]\s*([^\n\r]+)/i,
    /claimant\s*[:#-]\s*([^\n\r]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (!match) {
      continue;
    }

    const extractedName = match[2] || match[1];

    if (extractedName) {
      return cleanExtractedName(extractedName);
    }
  }

  return null;
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
  const cleaned = String(name || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,;|].*$/, function(match) {
      return match.indexOf(',') === 0 ? match : '';
    })
    .trim();

  const commaNameMatch = cleaned.match(/^([^,]+),\s*(.+)$/);

  if (commaNameMatch) {
    return (commaNameMatch[2] + ' ' + commaNameMatch[1])
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  return cleaned;
}

function testProcessInsuranceIntake() {
  Logger.log(JSON.stringify(processInsuranceIntake(), null, 2));
}

function testProcessAsbestosAttachments() {
  Logger.log(JSON.stringify(processAsbestosAttachments(), null, 2));
}

function testCleanupProcessedAsbestosLabels() {
  Logger.log(JSON.stringify(cleanupProcessedAsbestosLabels(), null, 2));
}

function testAsbestosSubjectParsingExample() {
  const subject = 'EMSL report, invoice, COC for order(s) 072604367 (072604367 - KAMALRAJ ARUMUGAM)';

  Logger.log(JSON.stringify({
    subject: subject,
    claimNumber: extractClaimNumber(subject),
    customerName: extractCustomerName(subject)
  }, null, 2));
}

// Temporary backward-compatible test wrappers.
function testProcessEmslAttachments() {
  Logger.log(JSON.stringify(processAsbestosAttachments(), null, 2));
}

function testCleanupProcessedEmslLabels() {
  Logger.log(JSON.stringify(cleanupProcessedAsbestosLabels(), null, 2));
}

function testProcessItelAttachments() {
  Logger.log(JSON.stringify(processItelAttachments(), null, 2));
}

function testCleanupProcessedItelLabels() {
  Logger.log(JSON.stringify(cleanupProcessedItelLabels(), null, 2));
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function findClaimFolderFromMapByClaimNumberOrName_(claimNumber, customerName) {
  const normalizedClaimNumber = normalizeClaimNumberForMatch_(claimNumber);
  const normalizedCustomerName = normalizeNameForMatch_(customerName);

  if (!normalizedClaimNumber && !normalizedCustomerName) {
    return null;
  }

  try {
    const sheet = getClaimFolderMapSheet_();
    const values = sheet.getDataRange().getValues();

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowCustomerName = String(row[0] || '').trim();
      const rowClaimNumber = String(row[1] || '').trim();
      const rowFolderUrl = String(row[3] || '').trim();
      const rowFolderId = String(row[4] || '').trim();
      const rowYear = String(row[2] || '').trim();

      if (!rowFolderId) {
        continue;
      }

      const rowNormalizedClaimNumber = normalizeClaimNumberForMatch_(rowClaimNumber);
      const rowNormalizedCustomerName = normalizeNameForMatch_(rowCustomerName);
      const claimMatches = normalizedClaimNumber && rowNormalizedClaimNumber === normalizedClaimNumber;
      const nameMatches = normalizedCustomerName && rowNormalizedCustomerName && rowNormalizedCustomerName.indexOf(normalizedCustomerName) !== -1;

      if (claimMatches || nameMatches) {
        let folderName = '';

        try {
          folderName = DriveApp.getFolderById(rowFolderId).getName();
        } catch (folderError) {
          folderName = rowCustomerName && rowClaimNumber ? rowClaimNumber + ' - ' + rowCustomerName : rowClaimNumber || rowCustomerName;
        }

        return {
          rowNumber: i + 1,
          matchedBy: claimMatches ? 'claim_folder_map_claim_number' : 'claim_folder_map_customer_name',
          claimNumber: rowClaimNumber,
          customerName: rowCustomerName,
          year: rowYear,
          folderName: folderName,
          folderId: rowFolderId,
          folderUrl: rowFolderUrl
        };
      }
    }
  } catch (error) {
    Logger.log('Claim Folder Map lookup failed: ' + error.message);
  }

  return null;
}

function findClaimFolderFromMapByClaimNumber_(claimNumber) {
  return findClaimFolderFromMapByClaimNumberOrName_(claimNumber, '');
}
