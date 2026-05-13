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

