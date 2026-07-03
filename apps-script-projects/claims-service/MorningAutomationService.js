/**
 * MorningAutomationService
 *
 * Orchestrates Rainbow's morning report intake and daily timeline enrichment.
 * Historical Notes uses the incremental timeline importer so the morning run
 * only processes notes that are newer than the last imported timeline note.
 *
 * Phase structure (Orchestration Refactor — 2026-07-01):
 * runRainbowMorningAutomation() is a thin wrapper that calls three
 * independently-callable phase functions in sequence and merges their step
 * results into one combined summary/log entry, exactly as before. This is an
 * orchestration-only change — no business logic moved, no steps added or
 * removed, no trigger changes. The single 6 AM trigger still calls
 * runRainbowMorningAutomation().
 *
 *   Phase 1 — runMorningDataRefresh()
 *     1. processDailyOpenJobsEmailIntake        — save XLSX attachment to Drive
 *     2. importLatestDailyOpenJobsReport        — bootstrap new Claims rows + update Last Activity Date
 *     3. reconcileDailyOpenJobsRemovedClaims    — mark removed jobs Operationally Complete
 *     4. processComplianceTasksEmailIntake      — save compliance XLSX
 *     5. importNewHistoricalNotes               — enrich Timeline_Events for matched claims
 *     6. synchronizeClaimsFoundation
 *
 *   Phase 2 — runMorningIntelligence()
 *     1. rebuildTimelineDerivedFieldsForActiveClaims
 *     2. reconcileClaimConditions               — batchReconcileClaimConditions() (ConditionEngineService.js)
 *     3. applyClaimHealth                       — batchApplyClaimHealth() (HealthEngineService.js)
 *
 *   Phase 3 — runMorningBrief()
 *     1. refreshHomepageData
 *
 * reconcileDailyOpenJobsRemovedClaims stays in Phase 1, immediately after
 * importLatestDailyOpenJobsReport, in its current relative position (2026-07-01
 * refactor decision). It has intelligence-like lifecycle logic, but it is
 * currently part of reconciling the Claims table against the Daily Open Jobs
 * report, so Phase 2's intelligence steps operate on the already-reconciled
 * dataset. Revisit once lifecycle/removed-claim handling is separated more
 * cleanly. importLatestDailyOpenJobsReport must still run BEFORE
 * reconcileDailyOpenJobsRemovedClaims so that newly bootstrapped claims are
 * present in Claims before the reconciliation evaluates which active claims
 * are missing from the report.
 *
 * reconcileClaimConditions runs BEFORE applyClaimHealth so a condition added
 * earlier in the same run (or by the historical notes / timeline steps above)
 * is reflected in that day's health evaluation, matching how these two were
 * previously chained together whenever they were run manually. refreshHomepageData
 * runs last (Phase 3) so it reflects the freshly recalculated health/conditions
 * rather than the previous day's snapshot.
 *
 * Both new steps are idempotent: reconcileClaimConditions only adds conditions
 * that aren't already active (never removes, per its "toRemove" policy), and
 * applyClaimHealth only writes a new Claim_Health_History row when the health
 * level actually changes (recordHealthHistoryIfChanged_). Re-running this
 * function against unchanged claims is safe and produces no duplicate writes.
 */

function runRainbowMorningAutomation() {
  const startedAt = nowIso();

  const dataRefresh = runMorningDataRefresh();
  const intelligence = runMorningIntelligence();
  const brief = runMorningBrief();

  const steps = [].concat(dataRefresh.steps, intelligence.steps, brief.steps);

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

/**
 * Phase 1 — Data Refresh.
 * Raw intake + repair/enrichment steps, plus the DOJ removed-claims lifecycle
 * reconciliation (kept here per the 2026-07-01 refactor decision — see header
 * comment above). Independently callable for manual testing; not wired to its
 * own trigger.
 */
function runMorningDataRefresh() {
  const startedAt = nowIso();
  const steps = [];

  steps.push(runMorningAutomationStep_(
    'processDailyOpenJobsEmailIntake',
    processDailyOpenJobsEmailIntake
  ));

  steps.push(runMorningAutomationStep_(
    'importLatestDailyOpenJobsReport',
    importLatestDailyOpenJobsReport
  ));

  steps.push(runMorningAutomationStep_(
    'reconcileDailyOpenJobsRemovedClaims',
    reconcileDailyOpenJobsRemovedClaims
  ));

  steps.push(runMorningAutomationStep_(
    'processComplianceTasksEmailIntake',
    processComplianceTasksEmailIntake
  ));

  // Future morning workflow placeholder. Do not enable until the owning
  // import function is explicitly approved for automation.
  // importLatestComplianceTasksReport();

  steps.push(runMorningAutomationStep_(
    'importNewHistoricalNotes',
    runMorningHistoricalNotesImport_
  ));

  steps.push(runMorningAutomationStep_(
    'synchronizeClaimsFoundation',
    runMorningSynchronizeClaimsFoundation_
  ));

  return buildMorningPhaseSummary_('dataRefresh', startedAt, steps);
}

/**
 * Phase 2 — Intelligence Engine.
 * Derived/deterministic calculations over the data refreshed in Phase 1:
 * timeline-derived fields, condition reconciliation, health evaluation.
 * Independently callable for manual testing; not wired to its own trigger.
 */
function runMorningIntelligence() {
  const startedAt = nowIso();
  const steps = [];

  steps.push(runMorningAutomationStep_(
    'rebuildTimelineDerivedFieldsForActiveClaims',
    runMorningTimelineRebuild_
  ));

  steps.push(runMorningAutomationStep_(
    'reconcileClaimConditions',
    runMorningConditionReconciliation_
  ));

  steps.push(runMorningAutomationStep_(
    'applyClaimHealth',
    runMorningHealthEvaluation_
  ));

  return buildMorningPhaseSummary_('intelligence', startedAt, steps);
}

/**
 * Phase 3 — Morning Brief / Actions.
 * Uses completed intelligence only; currently just the homepage refresh.
 * Independently callable for manual testing; not wired to its own trigger.
 */
function runMorningBrief() {
  const startedAt = nowIso();
  const steps = [];

  steps.push(runMorningAutomationStep_(
    'refreshHomepageData',
    runMorningHomepageRefresh_
  ));

  // Future morning workflow placeholder. Do not enable until the owning
  // refresh function is explicitly approved for automation.
  // refreshHomepageData();

  return buildMorningPhaseSummary_('brief', startedAt, steps);
}

function buildMorningPhaseSummary_(phaseName, startedAt, steps) {
  return {
    phase: phaseName,
    startedAt: startedAt,
    completedAt: nowIso(),
    steps: steps,
    successCount: steps.filter(function(step) {
      return step.success;
    }).length,
    failureCount: steps.filter(function(step) {
      return !step.success;
    }).length
  };
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

function runMorningSynchronizeClaimsFoundation_() {
  var result = synchronizeClaimsFoundation({ dryRun: false, quiet: true });
  return successResponse(result, 'Claims Foundation synchronization completed.');
}

function runMorningHomepageRefresh_() {
  const dashboardUrl = 'https://script.google.com/macros/s/AKfycbzX9Mvyr2zk1GkBR2Nfdv9PE994onOVpxQpJj9lq3j87n2NN_iZ3eRWDFWlbfmrvpNoFw/exec';
  const url = dashboardUrl + '?action=getHomepageData&source=claims-service-morning-automation&cacheBust=' + encodeURIComponent(nowIso());

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true
  });

  const responseCode = response.getResponseCode();
  const text = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    return {
      success: false,
      status: 'Error',
      message: 'Dashboard homepage refresh returned HTTP ' + responseCode + '.',
      data: {
        responseCode: responseCode,
        bodyPreview: String(text || '').slice(0, 1000)
      }
    };
  }

  const payload = JSON.parse(text || '{}');

  return successResponse(
    {
      refreshedVia: 'automation-dashboard-web-app',
      responseCode: responseCode,
      payloadStatus: payload.status || '',
      payloadSuccess: payload.success,
      generatedAt: payload.data && payload.data.generatedAt ? payload.data.generatedAt : nowIso()
    },
    'Homepage data refreshed through automation-dashboard web app.'
  );
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

function testMorningHomepageRefresh() {
  var result = runMorningHomepageRefresh_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------------------
// Manual per-phase test entry points (2026-07-01 orchestration refactor).
// Mirror testRunRainbowMorningAutomation() but run a single phase in
// isolation. Not wired to any trigger.
// ---------------------------------------------------------------------------

function testRunMorningDataRefresh() {
  var result = runMorningDataRefresh();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testRunMorningIntelligence() {
  var result = runMorningIntelligence();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testRunMorningBrief() {
  var result = runMorningBrief();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
