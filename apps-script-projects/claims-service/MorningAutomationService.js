/**
 * MorningAutomationService
 *
 * Orchestrates Rainbow's morning report intake and daily timeline enrichment.
 * Historical Notes uses the incremental timeline importer so the morning run
 * only processes notes that are newer than the last imported timeline note.
 */

function runRainbowMorningAutomation() {
  const startedAt = nowIso();
  const steps = [];

  steps.push(runMorningAutomationStep_(
    'processDailyOpenJobsEmailIntake',
    processDailyOpenJobsEmailIntake
  ));

  steps.push(runMorningAutomationStep_(
    'reconcileDailyOpenJobsRemovedClaims',
    reconcileDailyOpenJobsRemovedClaims
  ));

  steps.push(runMorningAutomationStep_(
    'processComplianceTasksEmailIntake',
    processComplianceTasksEmailIntake
  ));

  steps.push(runMorningAutomationStep_(
    'importNewHistoricalNotes',
    runMorningHistoricalNotesImport_
  ));

  steps.push(runMorningAutomationStep_(
    'rebuildTimelineDerivedFieldsForActiveClaims',
    runMorningTimelineRebuild_
  ));

  // Future morning workflow placeholders. Do not enable until the owning
  // import/refresh functions exist and are explicitly approved for automation.
  // importLatestComplianceTasksReport();
  // batchReconcileClaimConditions();
  // testBatchApplyClaimHealth();
  // refreshHomepageData();

  const completedAt = nowIso();
  const summary = {
    startedAt: startedAt,
    completedAt: completedAt,
    steps: steps,
    successCount: steps.filter(function(step) {
      return step.success;
    }).length,
    failureCount: steps.filter(function(step) {
      return !step.success;
    }).length
  };

  logRainbowMorningAutomation_(
    summary.failureCount === 0 ? 'Success' : 'Warning',
    'Rainbow morning automation completed.',
    summary
  );

  return successResponse(summary, 'Rainbow morning automation completed.');
}

function runMorningHistoricalNotesImport_() {
  const result = importNewHistoricalNotes();

  return successResponse(
    result,
    'Historical notes incremental timeline import completed.'
  );
}

function runMorningTimelineRebuild_() {
  return bulkRebuildTimelineDerivedFieldsForActiveClaims();
}

function createRainbowMorningAutomationTrigger() {
  const deleteResult = deleteRainbowMorningAutomationTriggers();
  const trigger = ScriptApp.newTrigger('runRainbowMorningAutomation')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  const result = {
    deletedExistingTriggers: deleteResult.data ? deleteResult.data.deletedCount : 0,
    triggerFunction: 'runRainbowMorningAutomation',
    schedule: 'Daily during the 6 AM hour',
    triggerUniqueId: trigger.getUniqueId ? trigger.getUniqueId() : ''
  };

  logRainbowMorningAutomation_('Success', 'Rainbow morning automation trigger created.', result);
  return successResponse(result, 'Rainbow morning automation trigger created.');
}

function deleteRainbowMorningAutomationTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let deletedCount = 0;

  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction && trigger.getHandlerFunction() === 'runRainbowMorningAutomation') {
      ScriptApp.deleteTrigger(trigger);
      deletedCount++;
    }
  });

  const result = {
    triggerFunction: 'runRainbowMorningAutomation',
    deletedCount: deletedCount
  };

  logRainbowMorningAutomation_('Success', 'Rainbow morning automation triggers deleted.', result);
  return successResponse(result, 'Rainbow morning automation triggers deleted.');
}

function testRainbowMorningAutomationSearchOnly() {
  const startedAt = nowIso();
  const steps = [];

  steps.push(runMorningAutomationStep_(
    'testDailyOpenJobsEmailSearch',
    testDailyOpenJobsEmailSearch
  ));

  steps.push(runMorningAutomationStep_(
    'testComplianceTasksEmailSearch',
    testComplianceTasksEmailSearch
  ));

  const completedAt = nowIso();
  const summary = {
    startedAt: startedAt,
    completedAt: completedAt,
    steps: steps,
    successCount: steps.filter(function(step) {
      return step.success;
    }).length,
    failureCount: steps.filter(function(step) {
      return !step.success;
    }).length
  };

  Logger.log('RAINBOW_MORNING_AUTOMATION_SEARCH_ONLY ' + JSON.stringify(summary, null, 2));
  return successResponse(summary, 'Rainbow morning automation search-only test completed.');
}

function runMorningAutomationStep_(stepName, stepFunction) {
  const startedAt = nowIso();

  try {
    const response = stepFunction();
    const success = !!(response && response.success);

    return {
      stepName: stepName,
      success: success,
      status: response && response.status ? response.status : success ? 'Success' : 'Error',
      message: response && response.message ? response.message : '',
      startedAt: startedAt,
      completedAt: nowIso(),
      result: response && response.data ? response.data : response || null
    };
  } catch (error) {
    return {
      stepName: stepName,
      success: false,
      status: 'Error',
      message: error && error.message ? error.message : String(error),
      startedAt: startedAt,
      completedAt: nowIso(),
      error: {
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : ''
      }
    };
  }
}

function logRainbowMorningAutomation_(status, message, details) {
  if (typeof writeServiceLog === 'function') {
    writeServiceLog('runRainbowMorningAutomation', status, message, details || {});
    return;
  }

  Logger.log('RAINBOW_MORNING_AUTOMATION_' + String(status || '').toUpperCase() + ' ' + JSON.stringify({
    message: message,
    details: details || {}
  }));
}


function testRunRainbowMorningAutomation() {
  var result = runRainbowMorningAutomation();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
