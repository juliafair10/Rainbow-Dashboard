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
  retryReadyLabel: 'Retry/Ready',
  retryInProgressLabel: 'Retry/In Progress',
  retryRecoveredLabel: 'Retry/Recovered',
  retryBlockedLabel: 'Retry/Blocked',
  retryLimitReachedLabel: 'Retry/Limit Reached',
  retryLogSheetName: 'Retry Log',
  maxRetryAttempts: 3,
  scheduledRetryTriggerHour: 7,
  automationName: 'Insurance Intake Automation',
  maxThreadsPerRun: 10,
  phase: '4F.2',
  dryRun: false,
  labelDryRun: false,
  claimFolderMapSpreadsheetId: '1kTRyZbPW1dZgkflH31s4MewuVHEl1ExQ7o3c6ad-btQ',
  claimFolderMapSheetName: 'Claim Folder Map',
  attachmentLogSheetName: 'Attachment Intake Log',
  claimFolderParentFolderId: '1r0A84zZGvUKA_0QFs1dwozbuteZt-DbL',
  createClaimFolders: true,
  calendar: {
    enabled: true,
    calendarId: '6aqe6hond86u044tgs868ouje8@group.calendar.google.com',
    startHour: 6,
    durationHours: 1,
    duplicateSearchDays: 30
  },
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

  if (action === 'diagnostics') {
    return jsonResponse(getInsuranceIntakeDiagnostics());
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

  if (action === 'retryWorkflow') {
    return jsonResponse(retryWorkflow(e && e.parameter ? e.parameter.workflow : ''));
  }

  if (action === 'retryInsuranceIntake') {
    return jsonResponse(retryWorkflow('insuranceIntake'));
  }

  if (action === 'retryAsbestos') {
    return jsonResponse(retryWorkflow('asbestos'));
  }

  if (action === 'retryItel') {
    return jsonResponse(retryWorkflow('itel'));
  }

  if (action === 'setupRetryLabels') {
    return jsonResponse(setupRetryLabels());
  }

  if (action === 'setupRetryTriggers') {
    return jsonResponse(setupRetryTriggers());
  }

  if (action === 'deleteRetryTriggers') {
    return jsonResponse(deleteRetryTriggers());
  }

  return jsonResponse({
    status: 'Success',
    message: CONFIG.automationName + ' web app is live.',
    result: {
      availableActions: ['process', 'diagnostics', 'testTodoist', 'listTodoistProjects', 'processAsbestos', 'cleanupAsbestosLabels', 'processItel', 'cleanupItelLabels', 'queueHealth', 'queueHealthAsbestos', 'queueHealthItel', 'queueHealthInsuranceIntake', 'inspectPendingClaimFolders', 'inspectAsbestosPendingClaimFolders', 'inspectItelPendingClaimFolders', 'retryWorkflow', 'retryInsuranceIntake', 'retryAsbestos', 'retryItel', 'setupRetryLabels', 'setupRetryTriggers', 'deleteRetryTriggers'],
      query: CONFIG.gmailQuery
    }
  });
}

function getInsuranceIntakeDiagnostics() {
  return {
    status: 'Success',
    message: 'Insurance Intake diagnostics checked.',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      checkedAt: new Date(),
      helperFunctions: {
        parseInsuranceIntakeThread: typeof parseInsuranceIntakeThread,
        applyInsuranceIntakeLabels_: typeof applyInsuranceIntakeLabels_,
        detectThreadAttachments_: typeof detectThreadAttachments_,
        updateAttachmentSummary_: typeof updateAttachmentSummary_,
        claimFolderMapHasDuplicate_: typeof claimFolderMapHasDuplicate_,
        checkOrCreateClaimFolder_: typeof checkOrCreateClaimFolder_,
        appendClaimFolderMapRow_: typeof appendClaimFolderMapRow_,
        createOrSkipCalendarDraft_: typeof createOrSkipCalendarDraft_,
        buildInsuranceCalendarTitle_: typeof buildInsuranceCalendarTitle_,
        findHeaderIndex_: typeof findHeaderIndex_,
        isCopyEligibleInsuranceAttachment_: typeof isCopyEligibleInsuranceAttachment_,
        normalizeInsuranceIntakeText_: typeof normalizeInsuranceIntakeText_,
        extractInsuranceClaimNumber_: typeof extractInsuranceClaimNumber_
      },
      config: {
        gmailQuery: CONFIG.gmailQuery,
        intakeLabel: CONFIG.intakeLabel,
        processedLabel: CONFIG.processedLabel,
        errorLabel: CONFIG.errorLabel,
        needsReviewLabel: CONFIG.needsReviewLabel,
        duplicateLabel: CONFIG.duplicateLabel
      }
    }
  };
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
      workflow: 'Phase 4F Queue Health',
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
    retryReadyQuery: 'label:"' + CONFIG.retryReadyLabel + '" label:"' + CONFIG.errorLabel + '"',
    retryInProgressQuery: 'label:"' + CONFIG.retryInProgressLabel + '" label:"' + CONFIG.errorLabel + '"',
    retryRecoveredQuery: 'label:"' + CONFIG.retryRecoveredLabel + '" label:"' + CONFIG.processedLabel + '"',
    retryBlockedQuery: 'label:"' + CONFIG.retryBlockedLabel + '" label:"' + CONFIG.errorLabel + '"',
    retryLimitReachedQuery: 'label:"' + CONFIG.retryLimitReachedLabel + '" label:"' + CONFIG.errorLabel + '"',
    cleanupBacklogQuery: '',
    duplicateQuery: 'label:' + CONFIG.duplicateLabel,
    staleActiveQuery: '',
    staleReviewQuery: '',
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
    retryReadyQuery: 'label:"' + CONFIG.retryReadyLabel + '" label:"' + CONFIG.asbestosPendingClaimFolderLabel + '"',
    retryInProgressQuery: 'label:"' + CONFIG.retryInProgressLabel + '" label:"' + CONFIG.asbestosPendingClaimFolderLabel + '"',
    retryRecoveredQuery: 'label:"' + CONFIG.retryRecoveredLabel + '" label:"' + CONFIG.asbestosProcessedLabel + '"',
    retryBlockedQuery: 'label:"' + CONFIG.retryBlockedLabel + '" label:"' + CONFIG.asbestosErrorLabel + '"',
    retryLimitReachedQuery: 'label:"' + CONFIG.retryLimitReachedLabel + '" label:"' + CONFIG.asbestosPendingClaimFolderLabel + '"',
    cleanupBacklogQuery: 'label:' + CONFIG.asbestosIntakeLabel + ' label:"' + CONFIG.asbestosProcessedLabel + '"',
    duplicateQuery: '',
    staleActiveQuery: '',
    staleReviewQuery: '',
    stalePendingClaimFolderQuery: ''
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
    retryReadyQuery: 'label:"' + CONFIG.retryReadyLabel + '" label:"' + CONFIG.itelPendingClaimFolderLabel + '"',
    retryInProgressQuery: 'label:"' + CONFIG.retryInProgressLabel + '" label:"' + CONFIG.itelPendingClaimFolderLabel + '"',
    retryRecoveredQuery: 'label:"' + CONFIG.retryRecoveredLabel + '" label:"' + CONFIG.itelProcessedLabel + '"',
    retryBlockedQuery: 'label:"' + CONFIG.retryBlockedLabel + '" label:"' + CONFIG.itelErrorLabel + '"',
    retryLimitReachedQuery: 'label:"' + CONFIG.retryLimitReachedLabel + '" label:"' + CONFIG.itelPendingClaimFolderLabel + '"',
    cleanupBacklogQuery: 'label:' + CONFIG.itelIntakeLabel + ' label:"' + CONFIG.itelProcessedLabel + '"',
    duplicateQuery: '',
    staleActiveQuery: '',
    staleReviewQuery: '',
    stalePendingClaimFolderQuery: ''
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
    retryReadyCount: countGmailThreadsForQueueHealth_(settings.retryReadyQuery),
    retryInProgressCount: countGmailThreadsForQueueHealth_(settings.retryInProgressQuery),
    retryRecoveredCount: countGmailThreadsForQueueHealth_(settings.retryRecoveredQuery),
    retryBlockedCount: countGmailThreadsForQueueHealth_(settings.retryBlockedQuery),
    retryLimitReachedCount: countGmailThreadsForQueueHealth_(settings.retryLimitReachedQuery),
    cleanupBacklogCount: countGmailThreadsForQueueHealth_(settings.cleanupBacklogQuery),
    duplicateCount: countGmailThreadsForQueueHealth_(settings.duplicateQuery),
    staleActiveCount: countGmailThreadsForQueueHealth_(settings.staleActiveQuery),
    staleReviewCount: countGmailThreadsForQueueHealth_(settings.staleReviewQuery),
    stalePendingClaimFolderCount: countGmailThreadsForQueueHealth_(settings.stalePendingClaimFolderQuery)
  };

  metrics.retryBacklogCount = metrics.retryReadyCount + metrics.retryInProgressCount + metrics.retryBlockedCount;
  metrics.staleThreadCount = metrics.staleActiveCount + metrics.staleReviewCount + metrics.stalePendingClaimFolderCount;
  // Queue-entry age is intentionally disabled for Phase 4F. Gmail thread dates can reflect
  // very old original messages, not the date a queue label was applied.
  metrics.oldestActiveItemAgeHours = null;
  metrics.oldestReviewItemAgeHours = null;
  metrics.oldestPendingClaimFolderAgeHours = null;
  metrics.ageCalculationNote = 'Disabled in Phase 4F because Gmail thread dates can predate current queue labels.';

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
      retryReady: settings.retryReadyQuery,
      retryInProgress: settings.retryInProgressQuery,
      retryRecovered: settings.retryRecoveredQuery,
      retryBlocked: settings.retryBlockedQuery,
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
// Recovery + Retry Orchestration
// ========================

function setupRetryLabels() {
  const startedAt = new Date();
  const labels = getRetryWorkflowLabels_();
  const items = [];
  let createdCount = 0;
  let existingCount = 0;
  let errors = 0;

  labels.forEach(function(labelName) {
    const item = {
      labelName: labelName,
      status: 'started',
      created: false,
      existing: false,
      error: ''
    };

    try {
      const existingLabel = GmailApp.getUserLabelByName(labelName);

      if (existingLabel) {
        item.status = 'already_exists';
        item.existing = true;
        existingCount++;
      } else {
        GmailApp.createLabel(labelName);
        item.status = 'created';
        item.created = true;
        createdCount++;
      }
    } catch (error) {
      item.status = 'error';
      item.error = error.message;
      errors++;
    }

    items.push(item);
  });

  return {
    status: errors > 0 ? 'Partial Success' : 'Success',
    message: 'Phase ' + CONFIG.phase + ' retry label setup created ' + createdCount +
      ' label(s), found ' + existingCount + ' existing label(s), with ' + errors + ' error(s).',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: 'Retry Label Setup',
      action: 'setupRetryLabels',
      readOnly: false,
      startedAt: startedAt,
      finishedAt: new Date(),
      summary: {
        labelCount: labels.length,
        createdCount: createdCount,
        existingCount: existingCount,
        errors: errors
      },
      items: items
    }
  };
}

function getRetryWorkflowLabels_() {
  return [
    CONFIG.retryReadyLabel,
    CONFIG.retryInProgressLabel,
    CONFIG.retryRecoveredLabel,
    CONFIG.retryBlockedLabel,
    CONFIG.retryLimitReachedLabel
  ];
}

function scheduledRetryInsuranceIntake() {
  return retryWorkflow('insuranceIntake');
}

function scheduledRetryAsbestos() {
  return retryWorkflow('asbestos');
}

function scheduledRetryItel() {
  return retryWorkflow('itel');
}

function setupRetryTriggers() {
  const startedAt = new Date();
  const triggerDefinitions = getRetryTriggerDefinitions_();
  const existingTriggers = ScriptApp.getProjectTriggers();
  const items = [];
  let createdCount = 0;
  let existingCount = 0;
  let errors = 0;

  triggerDefinitions.forEach(function(definition) {
    const item = {
      handlerFunction: definition.handlerFunction,
      workflow: definition.workflow,
      status: 'started',
      created: false,
      existing: false,
      error: ''
    };

    try {
      const alreadyExists = existingTriggers.some(function(trigger) {
        return trigger.getHandlerFunction && trigger.getHandlerFunction() === definition.handlerFunction;
      });

      if (alreadyExists) {
        item.status = 'already_exists';
        item.existing = true;
        existingCount++;
      } else {
        ScriptApp.newTrigger(definition.handlerFunction)
          .timeBased()
          .everyDays(1)
          .atHour(CONFIG.scheduledRetryTriggerHour)
          .create();

        item.status = 'created';
        item.created = true;
        createdCount++;
      }
    } catch (error) {
      item.status = 'error';
      item.error = error.message;
      errors++;
    }

    items.push(item);
  });

  return {
    status: errors > 0 ? 'Partial Success' : 'Success',
    message: 'Phase ' + CONFIG.phase + ' scheduled retry trigger setup created ' + createdCount +
      ' trigger(s), found ' + existingCount + ' existing trigger(s), with ' + errors + ' error(s).',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: 'Scheduled Retry Trigger Setup',
      action: 'setupRetryTriggers',
      readOnly: false,
      cadence: 'daily',
      triggerHour: CONFIG.scheduledRetryTriggerHour,
      startedAt: startedAt,
      finishedAt: new Date(),
      summary: {
        triggerCount: triggerDefinitions.length,
        createdCount: createdCount,
        existingCount: existingCount,
        errors: errors
      },
      items: items
    }
  };
}

function deleteRetryTriggers() {
  const startedAt = new Date();
  const retryHandlerFunctions = getRetryTriggerDefinitions_().map(function(definition) {
    return definition.handlerFunction;
  });
  const triggers = ScriptApp.getProjectTriggers();
  const items = [];
  let deletedCount = 0;
  let skippedCount = 0;
  let errors = 0;

  triggers.forEach(function(trigger) {
    const handlerFunction = trigger.getHandlerFunction ? trigger.getHandlerFunction() : '';
    const item = {
      handlerFunction: handlerFunction,
      status: 'started',
      deleted: false,
      skipped: false,
      error: ''
    };

    if (retryHandlerFunctions.indexOf(handlerFunction) === -1) {
      item.status = 'skipped_non_retry_trigger';
      item.skipped = true;
      skippedCount++;
      items.push(item);
      return;
    }

    try {
      ScriptApp.deleteTrigger(trigger);
      item.status = 'deleted';
      item.deleted = true;
      deletedCount++;
    } catch (error) {
      item.status = 'error';
      item.error = error.message;
      errors++;
    }

    items.push(item);
  });

  return {
    status: errors > 0 ? 'Partial Success' : 'Success',
    message: 'Phase ' + CONFIG.phase + ' scheduled retry trigger cleanup deleted ' + deletedCount +
      ' trigger(s), skipped ' + skippedCount + ' non-retry trigger(s), with ' + errors + ' error(s).',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
      workflow: 'Scheduled Retry Trigger Cleanup',
      action: 'deleteRetryTriggers',
      readOnly: false,
      startedAt: startedAt,
      finishedAt: new Date(),
      summary: {
        deletedCount: deletedCount,
        skippedCount: skippedCount,
        errors: errors
      },
      items: items
    }
  };
}

function getRetryTriggerDefinitions_() {
  return [
    {
      workflow: 'Insurance Intake Retry',
      handlerFunction: 'scheduledRetryInsuranceIntake'
    },
    {
      workflow: 'Asbestos Attachment Retry',
      handlerFunction: 'scheduledRetryAsbestos'
    },
    {
      workflow: 'Itel Attachment Retry',
      handlerFunction: 'scheduledRetryItel'
    }
  ];
}

function retryWorkflow(workflowKey) {
  const startedAt = new Date();
  const settings = getRetryWorkflowSettings_(workflowKey);

  if (!settings) {
    return {
      status: 'Error',
      message: 'Unknown retry workflow: ' + workflowKey,
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Recovery + Retry Orchestration',
        requestedWorkflow: workflowKey || '',
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: buildEmptyRetrySummary_(),
        items: []
      }
    };
  }

  const summary = buildEmptyRetrySummary_();
  const items = [];

  try {
    const candidateThreads = GmailApp.search(settings.query, 0, CONFIG.maxThreadsPerRun);
    const retryReadyThreads = filterRetryReadyThreads_(candidateThreads, settings);
    summary.candidateCount = candidateThreads.length;
    summary.foundCount = retryReadyThreads.length;

    for (let i = 0; i < retryReadyThreads.length; i++) {
      const thread = retryReadyThreads[i];
      const itemResult = retrySingleThread_(thread, settings);
      items.push(itemResult);
      updateRetrySummary_(summary, itemResult);
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildRetryWorkflowMessage_(settings, summary),
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: settings.workflow,
        action: 'retryWorkflow',
        retryMode: 'manual-dashboard-safe',
        query: settings.query,
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
        workflow: settings.workflow,
        action: 'retryWorkflow',
        query: settings.query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function getRetryWorkflowSettings_(workflowKey) {
  const normalizedWorkflowKey = String(workflowKey || '').trim();

  if (normalizedWorkflowKey === 'insuranceIntake') {
    return {
      key: 'insuranceIntake',
      workflow: 'Insurance Intake Retry',
      query: 'label:"' + CONFIG.errorLabel + '" -label:"' + CONFIG.retryInProgressLabel + '" -label:"' + CONFIG.retryLimitReachedLabel + '"',
      retryReadyRequiredLabel: CONFIG.retryReadyLabel,
      sourceLabels: [CONFIG.errorLabel, CONFIG.retryReadyLabel],
      labelsToRemoveBeforeRetry: [CONFIG.errorLabel, CONFIG.retryReadyLabel, CONFIG.retryBlockedLabel],
      labelsToAddBeforeRetry: [CONFIG.intakeLabel, CONFIG.retryInProgressLabel],
      successLabel: CONFIG.processedLabel,
      failureLabel: CONFIG.errorLabel,
      pendingLabel: '',
      processor: processInsuranceIntake
    };
  }

  if (normalizedWorkflowKey === 'asbestos') {
    return {
      key: 'asbestos',
      workflow: 'Asbestos Attachment Retry',
      query: 'label:"' + CONFIG.asbestosPendingClaimFolderLabel + '" -label:"' + CONFIG.retryInProgressLabel + '" -label:"' + CONFIG.retryLimitReachedLabel + '"',
      retryReadyRequiredLabel: CONFIG.retryReadyLabel,
      sourceLabels: [CONFIG.asbestosPendingClaimFolderLabel, CONFIG.retryReadyLabel],
      labelsToRemoveBeforeRetry: [CONFIG.asbestosPendingClaimFolderLabel, CONFIG.asbestosErrorLabel, CONFIG.retryReadyLabel, CONFIG.retryBlockedLabel],
      labelsToAddBeforeRetry: [CONFIG.asbestosIntakeLabel, CONFIG.retryInProgressLabel],
      successLabel: CONFIG.asbestosProcessedLabel,
      failureLabel: CONFIG.asbestosErrorLabel,
      pendingLabel: CONFIG.asbestosPendingClaimFolderLabel,
      processor: processAsbestosAttachments
    };
  }

  if (normalizedWorkflowKey === 'itel') {
    return {
      key: 'itel',
      workflow: 'Itel Attachment Retry',
      query: 'label:"' + CONFIG.itelPendingClaimFolderLabel + '" -label:"' + CONFIG.retryInProgressLabel + '" -label:"' + CONFIG.retryLimitReachedLabel + '"',
      retryReadyRequiredLabel: CONFIG.retryReadyLabel,
      sourceLabels: [CONFIG.itelPendingClaimFolderLabel, CONFIG.retryReadyLabel],
      labelsToRemoveBeforeRetry: [CONFIG.itelPendingClaimFolderLabel, CONFIG.itelErrorLabel, CONFIG.retryReadyLabel, CONFIG.retryBlockedLabel],
      labelsToAddBeforeRetry: [CONFIG.itelIntakeLabel, CONFIG.retryInProgressLabel],
      successLabel: CONFIG.itelProcessedLabel,
      failureLabel: CONFIG.itelErrorLabel,
      pendingLabel: CONFIG.itelPendingClaimFolderLabel,
      processor: processItelAttachments
    };
  }

  return null;
}

function filterRetryReadyThreads_(threads, settings) {
  if (!threads || threads.length === 0) {
    return [];
  }

  return threads.filter(function(thread) {
    return threadHasLabel_(thread, settings.retryReadyRequiredLabel);
  });
}

function retrySingleThread_(thread, settings) {
  const startedAt = new Date();
  const itemResult = {
    workflow: settings.workflow,
    threadId: thread.getId(),
    status: 'started',
    attemptNumber: 0,
    retryEligible: true,
    recovered: false,
    blocked: false,
    limitReached: false,
    warnings: [],
    errors: []
  };

  try {
    const attemptNumber = getRetryAttemptCount_(settings.key, thread.getId()) + 1;
    itemResult.attemptNumber = attemptNumber;

    if (attemptNumber > CONFIG.maxRetryAttempts) {
      itemResult.status = 'retry_limit_reached';
      itemResult.retryEligible = false;
      itemResult.blocked = true;
      itemResult.limitReached = true;

      itemResult.labelResult = applyInsuranceIntakeLabels_(thread, {
        add: [CONFIG.retryLimitReachedLabel],
        remove: [CONFIG.retryReadyLabel, CONFIG.retryInProgressLabel]
      });

      appendRetryLogRow_(settings, thread, itemResult, startedAt);
      return itemResult;
    }

    itemResult.preRetryLabelResult = applyInsuranceIntakeLabels_(thread, {
      add: settings.labelsToAddBeforeRetry,
      remove: settings.labelsToRemoveBeforeRetry
    });

    if (!itemResult.preRetryLabelResult.success) {
      itemResult.status = 'retry_label_setup_failed';
      itemResult.errors.push(itemResult.preRetryLabelResult.error);
      itemResult.blocked = true;
      appendRetryLogRow_(settings, thread, itemResult, startedAt);
      return itemResult;
    }

    const processorResult = settings.processor();
    itemResult.processorStatus = processorResult.status || '';
    itemResult.processorMessage = processorResult.message || '';
    itemResult.processorSummary = processorResult.result && processorResult.result.summary ? processorResult.result.summary : {};

    const refreshedThread = GmailApp.getThreadById(thread.getId()) || thread;

    if (threadHasLabel_(refreshedThread, settings.successLabel)) {
      itemResult.status = 'retry_recovered';
      itemResult.recovered = true;
      itemResult.postRetryLabelResult = applyInsuranceIntakeLabels_(thread, {
        add: [CONFIG.retryRecoveredLabel],
        remove: [CONFIG.retryReadyLabel, CONFIG.retryInProgressLabel, CONFIG.retryBlockedLabel]
      });
    } else if (threadHasLabel_(refreshedThread, settings.failureLabel)) {
      itemResult.status = attemptNumber >= CONFIG.maxRetryAttempts ? 'retry_limit_reached' : 'retry_failed_requeued';
      itemResult.blocked = attemptNumber >= CONFIG.maxRetryAttempts;
      itemResult.limitReached = attemptNumber >= CONFIG.maxRetryAttempts;
      itemResult.postRetryLabelResult = applyInsuranceIntakeLabels_(thread, {
        add: attemptNumber >= CONFIG.maxRetryAttempts ? [CONFIG.retryLimitReachedLabel] : [CONFIG.retryReadyLabel],
        remove: [CONFIG.retryInProgressLabel]
      });
    } else if (settings.pendingLabel && threadHasLabel_(refreshedThread, settings.pendingLabel)) {
      itemResult.status = attemptNumber >= CONFIG.maxRetryAttempts ? 'retry_limit_reached_pending_claim_folder' : 'retry_pending_claim_folder_requeued';
      itemResult.blocked = attemptNumber >= CONFIG.maxRetryAttempts;
      itemResult.limitReached = attemptNumber >= CONFIG.maxRetryAttempts;
      itemResult.pendingClaimFolder = true;
      itemResult.warnings.push('Retry finished but the claim folder is still unavailable, so the thread was kept visible for recovery.');
      itemResult.postRetryLabelResult = applyInsuranceIntakeLabels_(thread, {
        add: attemptNumber >= CONFIG.maxRetryAttempts ? [CONFIG.retryLimitReachedLabel] : [CONFIG.retryReadyLabel],
        remove: attemptNumber >= CONFIG.maxRetryAttempts
          ? [CONFIG.retryReadyLabel, CONFIG.retryInProgressLabel, CONFIG.retryBlockedLabel]
          : [CONFIG.retryInProgressLabel, CONFIG.retryBlockedLabel]
      });
    } else {
      itemResult.status = 'retry_result_needs_review';
      itemResult.warnings.push('Retry finished but the thread did not receive the expected success, failure, or pending label.');
      itemResult.postRetryLabelResult = applyInsuranceIntakeLabels_(thread, {
        add: [CONFIG.retryBlockedLabel],
        remove: [CONFIG.retryInProgressLabel]
      });
      itemResult.blocked = true;
    }

    appendRetryLogRow_(settings, thread, itemResult, startedAt);
    return itemResult;
  } catch (error) {
    itemResult.status = 'retry_exception';
    itemResult.errors.push(error.message);
    itemResult.blocked = true;

    try {
      itemResult.exceptionLabelResult = applyInsuranceIntakeLabels_(thread, {
        add: [settings.failureLabel, CONFIG.retryBlockedLabel],
        remove: [CONFIG.retryInProgressLabel]
      });
    } catch (labelError) {
      itemResult.warnings.push('Retry exception label update threw an exception: ' + labelError.message);
    }

    appendRetryLogRow_(settings, thread, itemResult, startedAt);
    return itemResult;
  }
}

function buildEmptyRetrySummary_() {
  return {
    candidateCount: 0,
    foundCount: 0,
    retriedCount: 0,
    recoveredCount: 0,
    blockedCount: 0,
    limitReachedCount: 0,
    warnings: 0,
    errors: 0
  };
}

function updateRetrySummary_(summary, itemResult) {
  summary.retriedCount++;

  if (itemResult.recovered) {
    summary.recoveredCount++;
  }

  if (itemResult.blocked) {
    summary.blockedCount++;
  }

  if (itemResult.limitReached) {
    summary.limitReachedCount++;
  }

  summary.warnings += itemResult.warnings ? itemResult.warnings.length : 0;
  summary.errors += itemResult.errors ? itemResult.errors.length : 0;
}

function buildRetryWorkflowMessage_(settings, summary) {
  return 'Phase ' + CONFIG.phase + ' ' + settings.workflow + ' found ' + summary.foundCount +
    ' retry-ready thread(s) from ' + (summary.candidateCount || 0) +
    ' candidate thread(s), retried ' + summary.retriedCount +
    ', recovered ' + summary.recoveredCount +
    ', blocked ' + summary.blockedCount +
    ', marked retry limit reached ' + summary.limitReachedCount +
    ', with ' + summary.warnings + ' warning(s) and ' + summary.errors + ' error(s).';
}

function threadHasLabel_(thread, labelName) {
  const labels = thread.getLabels();

  for (let i = 0; i < labels.length; i++) {
    if (labels[i].getName() === labelName) {
      return true;
    }
  }

  return false;
}

function getRetryAttemptCount_(workflowKey, threadId) {
  const sheet = getRetryLogSheet_();
  ensureRetryLogHeader_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, getRetryLogHeaders_().length).getValues();
  let count = 0;

  values.forEach(function(row) {
    const rowWorkflowKey = String(row[2] || '').trim();
    const rowThreadId = String(row[4] || '').trim();

    if (rowWorkflowKey === workflowKey && rowThreadId === threadId) {
      count++;
    }
  });

  return count;
}

function appendRetryLogRow_(settings, thread, itemResult, startedAt) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const sheet = getRetryLogSheet_();
    ensureRetryLogHeader_(sheet);

    sheet.appendRow([
      new Date(),
      buildRunId_(),
      settings.key,
      settings.workflow,
      thread.getId(),
      itemResult.attemptNumber || 0,
      itemResult.status || '',
      itemResult.recovered === true,
      itemResult.blocked === true,
      itemResult.limitReached === true,
      itemResult.processorStatus || '',
      itemResult.processorMessage || '',
      (itemResult.warnings || []).join(' | '),
      (itemResult.errors || []).join(' | '),
      startedAt,
      new Date(),
      CONFIG.phase
    ]);
  } catch (error) {
    itemResult.warnings = itemResult.warnings || [];
    itemResult.warnings.push('Retry log append failed: ' + error.message);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function getRetryLogSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
  let sheet = ss.getSheetByName(CONFIG.retryLogSheetName);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.retryLogSheetName);
  }

  return sheet;
}

function ensureRetryLogHeader_(sheet) {
  const headers = getRetryLogHeaders_();
  const existingHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = existingHeader.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getRetryLogHeaders_() {
  return [
    'Timestamp',
    'Run ID',
    'Workflow Key',
    'Workflow',
    'Thread ID',
    'Attempt Number',
    'Status',
    'Recovered',
    'Blocked',
    'Limit Reached',
    'Processor Status',
    'Processor Message',
    'Warnings',
    'Errors',
    'Started At',
    'Finished At',
    'Automation Phase'
  ];
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

// ========================
// Insurance Intake Parsing + Label Helpers
// ========================

function parseInsuranceIntakeThread(thread) {
  const messages = thread.getMessages();
  const firstMessage = messages && messages.length > 0 ? messages[0] : null;
  const lastMessage = messages && messages.length > 0 ? messages[messages.length - 1] : null;
  const subject = firstMessage ? firstMessage.getSubject() : '';
  const bodyParts = [];

  if (subject) {
    bodyParts.push(subject);
  }

  messages.forEach(function(message) {
    bodyParts.push(message.getSubject() || '');
    bodyParts.push(message.getPlainBody() || '');
  });

  const fullText = normalizeInsuranceIntakeText_(bodyParts.join('\n'));
  const claimNumber = extractInsuranceClaimNumber_(fullText);
  const rainbowJobNumber = extractRainbowJobNumber_(fullText);
  const customerName = extractInsuranceCustomerName_(fullText);
  const lossAddress = extractInsuranceLossAddress_(fullText);

  return {
    subject: subject,
    threadId: thread.getId(),
    messageCount: messages.length,
    firstMessageDate: firstMessage ? firstMessage.getDate() : null,
    lastMessageDate: lastMessage ? lastMessage.getDate() : null,
    sender: firstMessage ? firstMessage.getFrom() : '',
    lastSender: lastMessage ? lastMessage.getFrom() : '',
    claimNumber: claimNumber,
    rainbowJobNumber: rainbowJobNumber,
    customerName: customerName,
    insuredName: customerName,
    lossAddress: lossAddress,
    lossCity: extractInsuranceField_(fullText, /Loss City:\s*([^\n]+)/i),
    lossState: extractInsuranceField_(fullText, /Loss State:\s*([^\n]+)/i),
    lossZip: extractInsuranceField_(fullText, /(?:Loss Zip Code|zipcode):\s*([^\n]+)/i),
    dateOfLoss: extractInsuranceField_(fullText, /Date of Loss:\s*([^\n]+)/i),
    typeOfLoss: extractInsuranceField_(fullText, /(?:Type of Loss|Services):\s*([^\n]+)/i),
    client: extractInsuranceField_(fullText, /Client:\s*([^\n]+)/i),
    source: 'parseInsuranceIntakeThread'
  };
}

function normalizeInsuranceIntakeText_(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/Â/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#40;/g, '(')
    .replace(/&#41;/g, ')')
    .replace(/&#91;/g, '[')
    .replace(/&#93;/g, ']')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function extractInsuranceClaimNumber_(text) {
  const patterns = [
    /Claim Number:\s*([A-Z0-9-]+)/i,
    /claim #\s*([A-Z0-9-]+)/i,
    /Claim No:\s*([*A-Z0-9-]+)/i,
    /Claim:\s*\n?\s*(?:Rainbow:\s*)?([A-Z0-9-]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return String(match[1]).replace(/\*/g, '').trim();
    }
  }

  return '';
}

function extractRainbowJobNumber_(text) {
  const match = text.match(/Rainbow:\s*([A-Z0-9-]+)/i);
  return match && match[1] ? String(match[1]).trim() : '';
}

function extractInsuranceCustomerName_(text) {
  const patterns = [
    /Insured Name:\s*([^\n]+)/i,
    /Customer:\s*\n\s*([^\n]+)/i,
    /Customer:\s*([^\n]+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);

    if (match && match[1]) {
      return String(match[1]).replace(/\*/g, '').trim();
    }
  }

  return '';
}

function extractInsuranceLossAddress_(text) {
  const locationMatch = text.match(/Location of Property:\s*([^\n]+)/i);

  if (locationMatch && locationMatch[1]) {
    return String(locationMatch[1]).trim();
  }

  const mapMatch = text.match(/maps\?q=([^\]\n]+)/i);

  if (mapMatch && mapMatch[1]) {
    return decodeURIComponent(String(mapMatch[1]).replace(/\+/g, ' ')).trim();
  }

  return '';
}

function extractInsuranceField_(text, pattern) {
  const match = text.match(pattern);
  return match && match[1] ? String(match[1]).trim() : '';
}


function updateAttachmentSummary_(summary, attachmentResult) {
  if (!summary || !attachmentResult) {
    return;
  }

  const attachmentCount = Number(attachmentResult.attachmentCount || attachmentResult.totalAttachments || 0);
  const copyEligibleCount = Number(attachmentResult.copyEligibleCount || 0);
  const reviewNeededCount = Number(attachmentResult.reviewNeededCount || 0);
  const skippedCount = Number(attachmentResult.skippedCount || 0);

  if (attachmentCount > 0) {
    summary.threadsWithAttachments = Number(summary.threadsWithAttachments || 0) + 1;
  }

  summary.totalAttachmentsDetected = Number(summary.totalAttachmentsDetected || 0) + attachmentCount;
  summary.copyEligibleAttachments = Number(summary.copyEligibleAttachments || 0) + copyEligibleCount;
  summary.reviewNeededAttachments = Number(summary.reviewNeededAttachments || 0) + reviewNeededCount;
  summary.skippedAttachments = Number(summary.skippedAttachments || 0) + skippedCount;
}

function detectThreadAttachments_(thread) {
  const messages = thread.getMessages();
  const attachments = [];
  const reviewNeededAttachments = [];
  const skippedAttachments = [];

  messages.forEach(function(message, messageIndex) {
    const messageAttachments = message.getAttachments({
      includeInlineImages: false,
      includeAttachments: true
    }) || [];

    messageAttachments.forEach(function(attachment) {
      const name = attachment.getName() || '';
      const contentType = attachment.getContentType() || '';
      const sizeBytes = attachment.getBytes() ? attachment.getBytes().length : 0;
      const lowerName = name.toLowerCase();
      const copyEligible = isCopyEligibleInsuranceAttachment_(name, contentType);
      const likelySignatureAsset = lowerName.indexOf('logo') !== -1 || lowerName.indexOf('image') !== -1;

      const record = {
        messageIndex: messageIndex,
        messageDate: message.getDate(),
        messageSubject: message.getSubject() || '',
        sender: message.getFrom() || '',
        name: name,
        filename: name,
        contentType: contentType,
        sizeBytes: sizeBytes,
        copyEligible: copyEligible && !likelySignatureAsset,
        needsReview: !copyEligible && !likelySignatureAsset,
        skipped: likelySignatureAsset,
        reason: ''
      };

      if (record.skipped) {
        record.reason = 'Likely inline image or signature asset';
        skippedAttachments.push(record);
      } else if (record.needsReview) {
        record.reason = 'Attachment type is not automatically copy eligible';
        reviewNeededAttachments.push(record);
      }

      attachments.push(record);
    });
  });

  return {
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    totalAttachments: attachments.length,
    copyEligibleCount: attachments.filter(function(record) {
      return record.copyEligible;
    }).length,
    reviewNeededCount: reviewNeededAttachments.length,
    skippedCount: skippedAttachments.length,
    attachments: attachments,
    reviewNeededAttachments: reviewNeededAttachments,
    skippedAttachments: skippedAttachments
  };
}

function isCopyEligibleInsuranceAttachment_(name, contentType) {
  const filename = String(name || '').toLowerCase();
  const mimeType = String(contentType || '').toLowerCase();

  if (!filename && !mimeType) {
    return false;
  }

  if (mimeType === 'application/pdf') {
    return true;
  }

  if (mimeType.indexOf('spreadsheet') !== -1 || mimeType.indexOf('excel') !== -1) {
    return true;
  }

  if (/\.(pdf|xlsx|xls|csv|docx|doc)$/i.test(filename)) {
    return true;
  }

  return false;
}

function applyInsuranceIntakeLabels_(thread, labelPlan) {
  const result = {
    success: true,
    added: [],
    removed: [],
    warnings: [],
    error: ''
  };

  try {
    const labelsToAdd = dedupeLabelNames_((labelPlan && labelPlan.add) || []);
    const labelsToRemove = dedupeLabelNames_((labelPlan && labelPlan.remove) || []);

    labelsToAdd.forEach(function(labelName) {
      if (!labelName) {
        return;
      }

      let label = GmailApp.getUserLabelByName(labelName);

      if (!label) {
        label = GmailApp.createLabel(labelName);
        result.warnings.push('Created missing Gmail label: ' + labelName);
      }

      thread.addLabel(label);
      result.added.push(labelName);
    });

    labelsToRemove.forEach(function(labelName) {
      if (!labelName) {
        return;
      }

      const label = GmailApp.getUserLabelByName(labelName);

      if (!label) {
        result.warnings.push('Skipped missing Gmail label removal: ' + labelName);
        return;
      }

      thread.removeLabel(label);
      result.removed.push(labelName);
    });
  } catch (error) {
    result.success = false;
    result.error = error.message;
  }

  return result;
}

function dedupeLabelNames_(labelNames) {
  const seen = {};
  const deduped = [];

  (labelNames || []).forEach(function(labelName) {
    const normalized = String(labelName || '').trim();

    if (!normalized || seen[normalized]) {
      return;
    }

    seen[normalized] = true;
    deduped.push(normalized);
  });

  return deduped;
}
function claimFolderMapHasDuplicate_(claimData, thread) {
  const result = {
    duplicate: false,
    reason: '',
    rowNumber: 0,
    existingFolderId: '',
    existingFolderUrl: ''
  };

  if (!claimData) {
    return result;
  }

  const jobNumber = String(claimData.rainbowJobNumber || claimData.claimNumber || '').trim();

  if (!jobNumber) {
    return result;
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.claimFolderMapSheetName);

    if (!sheet) {
      return result;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 2 || lastColumn < 1) {
      return result;
    }

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values[0].map(function(header) {
      return String(header || '').trim().toLowerCase();
    });

    const jobNumberColumn = findHeaderIndex_(headers, [
      'our job number',
      'job number',
      'claim number',
      'claim #'
    ]);

    const folderUrlColumn = findHeaderIndex_(headers, [
      'drive folder url',
      'folder url'
    ]);

    const folderIdColumn = findHeaderIndex_(headers, [
      'folder id',
      'drive folder id'
    ]);

    if (jobNumberColumn === -1) {
      return result;
    }

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowNumber = i + 1;
      const rowJobNumber = String(row[jobNumberColumn] || '').trim();

      if (rowJobNumber && rowJobNumber === jobNumber) {
        const existingFolderUrl = folderUrlColumn !== -1 ? String(row[folderUrlColumn] || '').trim() : '';
        const existingFolderId = folderIdColumn !== -1 ? String(row[folderIdColumn] || '').trim() : '';

        if (existingFolderUrl || existingFolderId) {
          result.duplicate = true;
          result.reason = 'job_number_exists_with_folder';
          result.rowNumber = rowNumber;
          result.existingFolderId = existingFolderId;
          result.existingFolderUrl = existingFolderUrl;
          return result;
        }
      }
    }

    return result;
  } catch (error) {
    return result;
  }
}

function findHeaderIndex_(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const normalizedHeader = String(headers[i] || '').replace(/[^a-z0-9#]/g, '').toLowerCase();

    for (let j = 0; j < possibleNames.length; j++) {
      const normalizedName = String(possibleNames[j] || '').replace(/[^a-z0-9#]/g, '').toLowerCase();

      if (normalizedHeader === normalizedName) {
        return i;
      }
    }
  }

  return -1;
}

function checkOrCreateClaimFolder_(claimData) {
  const result = {
    success: false,
    status: 'started',
    folderId: '',
    folderUrl: '',
    folderName: '',
    created: false,
    existing: false,
    error: ''
  };

  try {
    const claimNumber = String(
      claimData && (claimData.claimNumber || claimData.rainbowJobNumber) || ''
    ).trim();

    const customerName = String(
      claimData && (claimData.customerName || claimData.insuredName) || ''
    ).trim();

    if (!claimNumber || !customerName) {
      result.status = 'missing_required_fields';
      result.error = 'Missing customer name or claim number.';
      return result;
    }

    const rootFolder = DriveApp.getFolderById(
      CONFIG.claimFolderParentFolderId
    );

    const currentYear = String(new Date().getFullYear());

    let yearFolder;
    const existingYearFolders = rootFolder.getFoldersByName(currentYear);

    if (existingYearFolders.hasNext()) {
      yearFolder = existingYearFolders.next();
    } else {
      yearFolder = rootFolder.createFolder(currentYear);
    }

    const safeCustomerName = customerName
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    const safeClaimNumber = claimNumber
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    const expectedFolderName =
      safeCustomerName + ' - ' + safeClaimNumber;

    const existingFolders =
      yearFolder.getFoldersByName(expectedFolderName);

    if (existingFolders.hasNext()) {
      const folder = existingFolders.next();

      result.success = true;
      result.status = 'existing_folder_found';
      result.folderId = folder.getId();
      result.folderUrl = folder.getUrl();
      result.folderName = folder.getName();
      result.existing = true;

      return result;
    }

    if (!CONFIG.createClaimFolders) {
      result.status = 'claim_folder_not_found';
      result.error =
        'No existing claim folder found and createClaimFolders is disabled.';
      return result;
    }

    if (CONFIG.dryRun) {
      result.success = true;
      result.status = 'dry_run_folder_create_skipped';
      result.folderName = expectedFolderName;
      return result;
    }

    const newFolder =
      yearFolder.createFolder(expectedFolderName);

    result.success = true;
    result.status = 'folder_created';
    result.folderId = newFolder.getId();
    result.folderUrl = newFolder.getUrl();
    result.folderName = newFolder.getName();
    result.created = true;

    return result;

  } catch (error) {
    result.status = 'folder_check_exception';
    result.error =
      error && error.message ? error.message : error.toString();

    return result;
  }
}

function appendClaimFolderMapRow_(claimData, folderResult, thread) {
  const result = {
    success: false,
    sheetUpdated: false,
    dryRun: false,
    rowNumber: 0,
    error: ''
  };

  try {
    const jobNumber = String(claimData && (claimData.rainbowJobNumber || claimData.claimNumber) || '').trim();

    if (!claimData || !jobNumber) {
      result.error = 'Cannot append claim folder map row without an Our Job Number / claim number.';
      return result;
    }

    if (!folderResult || !folderResult.success) {
      result.error = 'Cannot append claim folder map row without a successful folder result.';
      return result;
    }

    if (CONFIG.dryRun) {
      result.success = true;
      result.dryRun = true;
      return result;
    }

    const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
    let sheet = ss.getSheetByName(CONFIG.claimFolderMapSheetName);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.claimFolderMapSheetName);
    }

    ensureClaimFolderMapHeader_(sheet);

    const currentYear = new Date().getFullYear();
    const notes = [
      'Created by ' + CONFIG.automationName,
      'Claim Number: ' + (claimData.claimNumber || ''),
      'Thread ID: ' + (thread && thread.getId ? thread.getId() : ''),
      'Folder Status: ' + (folderResult.status || '')
    ].filter(function(note) {
      return String(note || '').trim() !== '';
    }).join(' | ');

    const row = [
      claimData.customerName || claimData.insuredName || '',
      jobNumber,
      currentYear,
      folderResult.folderUrl || '',
      folderResult.folderId || '',
      true,
      '',
      new Date(),
      notes
    ];

    sheet.appendRow(row);
    result.success = true;
    result.sheetUpdated = true;
    result.rowNumber = sheet.getLastRow();
    return result;
  } catch (error) {
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function ensureClaimFolderMapHeader_(sheet) {
  const headers = getClaimFolderMapHeaders_();
  const existingHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = existingHeader.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getClaimFolderMapHeaders_() {
  return [
    'Customer Name',
    'Our Job Number',
    'Year',
    'Drive Folder URL',
    'Folder ID',
    'Active',
    'Default Subfolder',
    'Last Updated',
    'Notes'
  ];
}

function createOrSkipCalendarDraft_(claimData, folderResult, thread) {
  const result = {
    enabled: CONFIG.calendar && CONFIG.calendar.enabled === true,
    success: true,
    skipped: false,
    duplicate: false,
    eventId: '',
    eventTitle: '',
    eventStart: '',
    eventEnd: '',
    status: 'calendar_disabled',
    message: '',
    error: ''
  };

  if (!result.enabled) {
    result.skipped = true;
    result.message = 'Calendar creation is disabled.';
    return result;
  }

  try {
    const calendar = CalendarApp.getCalendarById(CONFIG.calendar.calendarId);

    if (!calendar) {
      result.success = false;
      result.status = 'calendar_not_found';
      result.error = 'Calendar not found: ' + CONFIG.calendar.calendarId;
      return result;
    }

    const claimNumber = String(claimData.claimNumber || '').trim();
    const customerName = String(claimData.customerName || claimData.insuredName || '').trim();

    if (!claimNumber || !customerName) {
      result.success = false;
      result.status = 'missing_calendar_required_fields';
      result.error = 'Missing customer name or claim number.';
      return result;
    }

    const eventTitle = buildInsuranceCalendarTitle_(claimData);
    result.eventTitle = eventTitle;

    const startTime = new Date();
    startTime.setHours(CONFIG.calendar.startHour || 6, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + (CONFIG.calendar.durationHours || 1));

    result.eventStart = startTime;
    result.eventEnd = endTime;

    const duplicateSearchStart = new Date(startTime);
    duplicateSearchStart.setDate(duplicateSearchStart.getDate() - (CONFIG.calendar.duplicateSearchDays || 30));

    const duplicateSearchEnd = new Date(startTime);
    duplicateSearchEnd.setDate(duplicateSearchEnd.getDate() + (CONFIG.calendar.duplicateSearchDays || 30));

    const duplicateEvents = calendar.getEvents(duplicateSearchStart, duplicateSearchEnd, {
      search: claimNumber
    }) || [];

    if (duplicateEvents.length > 0) {
      result.skipped = true;
      result.duplicate = true;
      result.status = 'calendar_duplicate_skipped';
      result.message = 'Calendar event already exists for claim ' + claimNumber + '.';
      return result;
    }

    if (CONFIG.dryRun) {
      result.skipped = true;
      result.status = 'dry_run_calendar_skipped';
      result.message = 'Dry run skipped calendar event creation.';
      return result;
    }

    const description = buildInsuranceCalendarDescription_(claimData, folderResult, thread);

    const event = calendar.createEvent(eventTitle, startTime, endTime, {
      description: description,
      location: claimData.lossAddress || ''
    });

    result.eventId = event.getId ? event.getId() : '';
    result.status = 'calendar_event_created';
    result.message = 'Created calendar event for claim ' + claimNumber + '.';

    return result;
  } catch (error) {
    result.success = false;
    result.status = 'calendar_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function buildInsuranceCalendarTitle_(claimData) {
  const customerName = String(claimData.customerName || claimData.insuredName || '').trim();
  const claimNumber = String(claimData.claimNumber || '').trim();

  return customerName + ' - ' + claimNumber;
}

function buildInsuranceCalendarDescription_(claimData, folderResult, thread) {
  return [
    'Claim Number: ' + (claimData.claimNumber || ''),
    'Customer: ' + (claimData.customerName || claimData.insuredName || ''),
    'Date of Loss: ' + (claimData.dateOfLoss || ''),
    'Type of Loss: ' + (claimData.typeOfLoss || ''),
    'Loss Address: ' + (claimData.lossAddress || ''),
    '',
    'Claim Folder:',
    folderResult && folderResult.folderUrl ? folderResult.folderUrl : '',
    '',
    'Thread ID: ' + (thread && thread.getId ? thread.getId() : '')
  ].join('\n');
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

        const calendarResult = createOrSkipCalendarDraft_(claimData, folderResult, thread);
        itemResult.calendarResult = calendarResult;

        if (!calendarResult.success) {
          itemResult.status = 'calendar_event_failed';
          itemResult.errors.push(calendarResult.error);

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

function buildPhase4CMessage_(summary) {
  return 'Phase ' + CONFIG.phase + ' insurance intake found ' + summary.foundCount +
    ' thread(s), parsed ' + summary.parsedCount +
    ', processed ' + summary.processedCount +
    ', added ' + summary.sheetRowsAdded +
    ' sheet row(s), skipped ' + summary.duplicatesSkipped +
    ' duplicate(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
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
      threadId: thread.getId(),
      intakeDate: thread.getMessages()[0].getDate()
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

  const intakeDate = payload.intakeDate || new Date();
  const dueDate = new Date(intakeDate);
  dueDate.setDate(dueDate.getDate() + 3);

  const formattedDueDate = Utilities.formatDate(
    dueDate,
    Session.getScriptTimeZone(),
    'MM/dd/yyyy'
  );

  const todoistDeadlineDate = Utilities.formatDate(
    dueDate,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );

  const task = {
    content: buildTodoistIntakeTaskTitle_(payload.customerName, payload.claimNumber),
    description: 'Upload 3 Day - due ' + formattedDueDate,
    project_id: todoist.projectId,
    assignee_id: Number(todoist.assigneeId),
    priority: todoist.priority,
    due_date: todoistDeadlineDate,
    deadline_date: todoistDeadlineDate
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
  return "Upload 3 day - due (3 days from 'today')";
}

function buildTodoistDeadlineDate_(daysFromToday) {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + daysFromToday);
  return Utilities.formatDate(deadline, Session.getScriptTimeZone(), 'yyyy-MM-dd');

}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}