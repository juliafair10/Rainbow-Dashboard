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
