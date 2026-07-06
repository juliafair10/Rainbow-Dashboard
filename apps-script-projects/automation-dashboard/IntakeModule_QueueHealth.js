function getQueueHealth() {
  const startedAt = new Date();
  const insuranceIntake = getInsuranceIntakeQueueHealth().result.workflowHealth;
  const asbestos = getAsbestosQueueHealth().result.workflowHealth;
  const itel = getItelQueueHealth().result.workflowHealth;
  const workflows = [insuranceIntake, asbestos, itel];
  const overallHealth = calculateOverallQueueHealth_(workflows);

  return {
    status: 'Success',
    message: 'Phase ' + INTAKE_CONFIG.phase + ' queue health checked for Insurance Intake, Asbestos, and Itel.',
    result: {
      automation: INTAKE_CONFIG.automationName,
      phase: INTAKE_CONFIG.phase,
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
    activeQuery: INTAKE_CONFIG.gmailQuery,
    processedQuery: 'label:"' + INTAKE_CONFIG.processedLabel + '"',
    errorQuery: 'label:"' + INTAKE_CONFIG.errorLabel + '"',
    reviewQuery: 'label:"' + INTAKE_CONFIG.needsReviewLabel + '"',
    pendingClaimFolderQuery: '',
    retryReadyQuery: 'label:"' + INTAKE_CONFIG.retryReadyLabel + '" label:"' + INTAKE_CONFIG.errorLabel + '"',
    retryInProgressQuery: 'label:"' + INTAKE_CONFIG.retryInProgressLabel + '" label:"' + INTAKE_CONFIG.errorLabel + '"',
    retryRecoveredQuery: 'label:"' + INTAKE_CONFIG.retryRecoveredLabel + '" label:"' + INTAKE_CONFIG.processedLabel + '"',
    retryBlockedQuery: 'label:"' + INTAKE_CONFIG.retryBlockedLabel + '" label:"' + INTAKE_CONFIG.errorLabel + '"',
    retryLimitReachedQuery: 'label:"' + INTAKE_CONFIG.retryLimitReachedLabel + '" label:"' + INTAKE_CONFIG.errorLabel + '"',
    cleanupBacklogQuery: '',
    duplicateQuery: 'label:' + INTAKE_CONFIG.duplicateLabel,
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
    activeQuery: INTAKE_CONFIG.asbestosQuery,
    processedQuery: 'label:"' + INTAKE_CONFIG.asbestosProcessedLabel + '"',
    errorQuery: 'label:"' + INTAKE_CONFIG.asbestosErrorLabel + '"',
    reviewQuery: 'label:"' + INTAKE_CONFIG.asbestosNeedsReviewLabel + '"',
    pendingClaimFolderQuery: 'label:"' + INTAKE_CONFIG.asbestosPendingClaimFolderLabel + '"',
    retryReadyQuery: 'label:"' + INTAKE_CONFIG.retryReadyLabel + '" label:"' + INTAKE_CONFIG.asbestosPendingClaimFolderLabel + '"',
    retryInProgressQuery: 'label:"' + INTAKE_CONFIG.retryInProgressLabel + '" label:"' + INTAKE_CONFIG.asbestosPendingClaimFolderLabel + '"',
    retryRecoveredQuery: 'label:"' + INTAKE_CONFIG.retryRecoveredLabel + '" label:"' + INTAKE_CONFIG.asbestosProcessedLabel + '"',
    retryBlockedQuery: 'label:"' + INTAKE_CONFIG.retryBlockedLabel + '" label:"' + INTAKE_CONFIG.asbestosErrorLabel + '"',
    retryLimitReachedQuery: 'label:"' + INTAKE_CONFIG.retryLimitReachedLabel + '" label:"' + INTAKE_CONFIG.asbestosPendingClaimFolderLabel + '"',
    cleanupBacklogQuery: 'label:' + INTAKE_CONFIG.asbestosIntakeLabel + ' label:"' + INTAKE_CONFIG.asbestosProcessedLabel + '"',
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
    activeQuery: INTAKE_CONFIG.itelQuery,
    processedQuery: 'label:"' + INTAKE_CONFIG.itelProcessedLabel + '"',
    errorQuery: 'label:"' + INTAKE_CONFIG.itelErrorLabel + '"',
    reviewQuery: 'label:"' + INTAKE_CONFIG.itelNeedsReviewLabel + '"',
    pendingClaimFolderQuery: 'label:"' + INTAKE_CONFIG.itelPendingClaimFolderLabel + '"',
    retryReadyQuery: 'label:"' + INTAKE_CONFIG.retryReadyLabel + '" label:"' + INTAKE_CONFIG.itelPendingClaimFolderLabel + '"',
    retryInProgressQuery: 'label:"' + INTAKE_CONFIG.retryInProgressLabel + '" label:"' + INTAKE_CONFIG.itelPendingClaimFolderLabel + '"',
    retryRecoveredQuery: 'label:"' + INTAKE_CONFIG.retryRecoveredLabel + '" label:"' + INTAKE_CONFIG.itelProcessedLabel + '"',
    retryBlockedQuery: 'label:"' + INTAKE_CONFIG.retryBlockedLabel + '" label:"' + INTAKE_CONFIG.itelErrorLabel + '"',
    retryLimitReachedQuery: 'label:"' + INTAKE_CONFIG.retryLimitReachedLabel + '" label:"' + INTAKE_CONFIG.itelPendingClaimFolderLabel + '"',
    cleanupBacklogQuery: 'label:' + INTAKE_CONFIG.itelIntakeLabel + ' label:"' + INTAKE_CONFIG.itelProcessedLabel + '"',
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
      automation: INTAKE_CONFIG.automationName,
      phase: INTAKE_CONFIG.phase,
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

