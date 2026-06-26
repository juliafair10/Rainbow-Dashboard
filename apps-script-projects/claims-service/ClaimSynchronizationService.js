/**
 * ClaimSynchronizationService
 * Phase: Automatic Claim Enrichment & Synchronization
 *
 * Keeps Claims Foundation data consistent after new claims arrive from the
 * Daily Open Jobs import or any other bootstrap path.
 * All steps are idempotent — safe to run repeatedly without side effects.
 *
 * Recommended invocation order inside runRainbowMorningAutomation:
 *
 *   1. processDailyOpenJobsEmailIntake           ← bootstrap new rows + Last Activity Date
 *   2. reconcileDailyOpenJobsRemovedClaims       ← lifecycle transitions
 *   3. processComplianceTasksEmailIntake
 *   4. importNewHistoricalNotes
 *   5. rebuildTimelineDerivedFieldsForActiveClaims
 *   6. synchronizeClaimsFoundation               ← this file
 *   7. refreshHomepageData
 *
 * Responsibilities (in dependency order):
 *   Step 1 — Repair Customer Names
 *     Blank Customer_Name + Job_Number present → look up name from latest DOJ report.
 *     Never overwrites a non-blank value.
 *
 *   Step 2 — Repair Claim Numbers from Daily Open Jobs report
 *     Fallback Claim_Number (blank or = Job_Number) → real claim number from DOJ report.
 *     Never overwrites a non-fallback value. Conflict detection: if the same job has two
 *     different claim numbers in the report, the row is skipped.
 *
 *   Step 3 — Associate Claim_IDs onto External_Links (pass 1)
 *     EL rows with blank Claim_ID matched by Job_Number or Claim_Number → write Claim_ID.
 *     Never overwrites a non-blank Claim_ID. Never creates rows.
 *
 *   Step 4 — Repair Claim Numbers from External_Links
 *     External_Links may carry the real insurance claim number even when the DOJ report
 *     does not. Fills remaining fallback Claim_Numbers on Claims rows from EL.
 *
 *   Step 5 — Associate Claim_IDs onto External_Links (pass 2)
 *     After step 4 writes real Claim_Numbers to Claims rows, EL rows that only carry a
 *     real Claim_Number (no Job_Number) can now match. Pass 2 picks these up.
 *     In dryRun mode, step 4 made no writes, so pass 2 finds no additional rows —
 *     this is correct; the count is not double-added to the dryRun total.
 *
 *   Step 6 — Reconcile structured operational alerts
 *     Evaluates every active claim against External_Links and writes/resolves alerts.
 *     New alert types: "Missing Operational Links Record" (bootstrapped, no EL row),
 *     "Missing XA/Symbility Link" (EL row exists but no XA/Symbility URL).
 *     Stale alerts whose conditions are now satisfied are auto-resolved.
 *
 * NOT handled here (by design):
 *   Claim bootstrap            — owned by importLatestDailyOpenJobsReport (step 1 of morning run)
 *   Claim_Summaries rebuild    — homepage now reads Timeline_Events and Claims rows directly;
 *                                Claim_Summaries is supplementary. Regenerate manually via
 *                                writeClaimSummaries() in claims-data-foundation when needed.
 *
 * Performance note:
 *   Steps 1 and 2 each independently load the latest DOJ report (XLSX → temp Google Sheet).
 *   This is two load operations per run. If morning-run latency becomes a concern, the DOJ
 *   report data could be cached in a Script Property and shared between steps.
 */

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Main synchronization entry point.
 * Runs all repair and enrichment steps in the correct dependency order.
 *
 * @param {Object}  [options]
 * @param {boolean} [options.dryRun=false]  No writes; returns what would change.
 * @param {boolean} [options.quiet=false]   Suppresses per-step Logger output.
 * @returns {Object} ClaimSyncReport — see property list in the return statement below.
 */
function synchronizeClaimsFoundation(options) {
  options = options || {};
  var dryRun    = options.dryRun === true;
  var quiet     = options.quiet  === true;
  var startedAt = Date.now();

  var report = {
    success: true,
    dryRun:  dryRun,

    // claimsCreated is intentionally 0 here.
    // New claim rows are created by processDailyOpenJobsEmailIntake, which runs
    // before synchronizeClaimsFoundation in the morning automation sequence.
    claimsCreated: 0,

    customerNamesUpdated: 0,
    claimNumbersUpdated:  0,
    claimIdsAssociated:   0,
    externalLinksUpdated: 0,
    alertsCreated:        0,
    alertsResolved:       0,

    // Claim_Summaries is not auto-rebuilt here.
    // The homepage reads Timeline_Events and Claims rows directly after the
    // fix applied in the previous session. The Claim_Summaries cache is
    // supplementary and does not need to be on the critical morning-run path.
    // Rebuild manually via writeClaimSummaries() in claims-data-foundation.
    summariesUpdated: 0,

    durationMs: 0,
    steps:      [],
    errors:     []
  };

  // ── Step 1: Repair blank Customer Names ───────────────────────────────────
  // Uses the latest DOJ report as the source of truth for customer names.
  // Matches only by Job_Number. Never overwrites a non-blank Customer_Name.
  // Passing '' as the claimIdPrefix means ALL Claims rows with a blank
  // Customer_Name are eligible — not just a specific bootstrap-date batch.
  var step1 = runSyncStep_('repairCustomerNames', quiet, function() {
    return repairBootstrappedClaimNames_('', dryRun);
  });
  report.steps.push(step1);
  if (step1.success) {
    var s1 = step1.result;
    report.customerNamesUpdated = (s1.data && s1.data.affectedRowCount)
      ? s1.data.affectedRowCount
      : 0;
  } else {
    report.success = false;
    report.errors.push(step1.error);
  }

  // ── Step 2: Repair Claim Numbers from Daily Open Jobs report ──────────────
  // Replaces fallback Claim_Numbers (blank or equal to Job_Number) with the
  // real claim number from the latest DOJ report row for the same job.
  // Skips claims whose Claim_Number is already a real (non-fallback) value.
  // Skips jobs where two DOJ report rows disagree on claim number (conflict).
  var step2 = runSyncStep_('repairClaimNumbersFromDOJ', quiet, function() {
    return runBootstrappedClaimNumberEnrichment_(dryRun);
  });
  report.steps.push(step2);
  if (step2.success) {
    var s2 = step2.result;
    report.claimNumbersUpdated += dryRun
      ? (s2.eligibleUpdates || 0)
      : (s2.rowsUpdated     || 0);
  } else {
    report.success = false;
    report.errors.push(step2.error);
  }

  // ── Step 3: Associate Claim_IDs onto External_Links — pass 1 ─────────────
  // For every External_Links row with a blank Claim_ID, attempts to match by
  // Job_Number or Claim_Number against the Claims sheet and writes the
  // matching Claim_ID.  Never overwrites a non-blank Claim_ID. Never adds rows.
  var step3 = runSyncStep_('associateExternalLinkClaimIdsPass1', quiet, function() {
    return runExternalLinkClaimIdBackfill_(dryRun);
  });
  report.steps.push(step3);
  if (step3.success) {
    var s3 = step3.result;
    // dryRun: rowsUpdated is 0 (no writes); use rowsEligible as the "would update" count.
    // live:   rowsUpdated is the actual write count.
    report.claimIdsAssociated += dryRun
      ? (s3.rowsEligible || 0)
      : (s3.rowsUpdated  || 0);
  } else {
    report.success = false;
    report.errors.push(step3.error);
  }

  // ── Step 4: Repair Claim Numbers from External_Links ─────────────────────
  // External_Links (written by insurance-intake-automation) may carry the real
  // insurance claim number even when the DOJ report does not. This step fills
  // any remaining fallback Claim_Numbers on Claims rows from EL data.
  // Safety guards are identical to step 2 (never overwrite non-fallback,
  // skip conflicts).
  var step4 = runSyncStep_('repairClaimNumbersFromExternalLinks', quiet, function() {
    return runEnrichClaimNumbersFromExternalLinks_(dryRun);
  });
  report.steps.push(step4);
  if (step4.success) {
    var s4 = step4.result;
    report.claimNumbersUpdated += dryRun
      ? (s4.eligibleUpdates || 0)
      : (s4.rowsUpdated     || 0);
  } else {
    report.success = false;
    report.errors.push(step4.error);
  }

  // ── Step 5: Associate Claim_IDs onto External_Links — pass 2 ─────────────
  // After step 4 writes real Claim_Numbers to Claims rows, some EL rows that
  // only carry a real Claim_Number (not a Job_Number) can now match against
  // Claims rows that previously had a fallback Claim_Number.  Pass 2 picks up
  // exactly those newly-matchable rows.
  //
  // dryRun note: because step 4 made no writes in dryRun mode, the Claims
  // lookup is unchanged and pass 2 would re-find the same eligible rows as
  // pass 1.  To avoid double-counting, the dryRun total only includes pass 1.
  // The pass 2 step still runs so its timing and any errors are captured.
  var step5 = runSyncStep_('associateExternalLinkClaimIdsPass2', quiet, function() {
    return runExternalLinkClaimIdBackfill_(dryRun);
  });
  report.steps.push(step5);
  if (step5.success) {
    if (!dryRun) {
      // Live run only: pass 2 finds rows that step 4's Claim_Number updates enabled.
      // Pass 1 already wrote Claim_ID onto those rows, so they are now skipped
      // (rowsSkippedExistingClaimId is higher) — no overlap with pass 1.
      report.claimIdsAssociated += step5.result.rowsUpdated || 0;
    }
  } else {
    report.success = false;
    report.errors.push(step5.error);
  }

  report.externalLinksUpdated = report.claimIdsAssociated;

  // ── Step 6: Reconcile structured operational alerts ───────────────────────
  // After all data repairs are complete, re-evaluate every active claim and
  // write/resolve alerts.  Uses the same reconcileAllClaimAlerts path as
  // rebuildHomepageOperationalAlerts(), which means:
  //   - Claims with no EL row get "Missing Operational Links Record"
  //   - Claims with EL row but no XA/Symbility link get "Missing XA/Symbility Link"
  //   - Stale structured alerts whose conditions are now satisfied are resolved
  //   - Alert_Rules suppression is honoured before any write
  var step6 = runSyncStep_('reconcileAlerts', quiet, function() {
    var response = reconcileAllClaimAlerts({ dryRun: dryRun, quiet: quiet });
    return response && response.data ? response.data : response;
  });
  report.steps.push(step6);
  if (step6.success) {
    var s6 = step6.result;
    // In dryRun, alertsWritten is always 0 (gated by !dryRun in reconcileClaimAlerts).
    // Use newAlerts — computed before the guard — as the reliable dryRun indicator.
    report.alertsCreated  = dryRun ? (s6.newAlerts || 0) : (s6.alertsWritten || 0);
    report.alertsResolved = s6.staleStructuredAlertsResolved || 0;
  } else {
    report.success = false;
    report.errors.push(step6.error);
  }

  report.durationMs = Date.now() - startedAt;

  // Always log the compact summary regardless of quiet mode.
  Logger.log(
    'SYNC_CLAIMS_FOUNDATION_' + (dryRun ? 'PREVIEW' : 'RUN') + ' ' +
    JSON.stringify({
      success:              report.success,
      dryRun:               report.dryRun,
      customerNamesUpdated: report.customerNamesUpdated,
      claimNumbersUpdated:  report.claimNumbersUpdated,
      claimIdsAssociated:   report.claimIdsAssociated,
      alertsCreated:        report.alertsCreated,
      alertsResolved:       report.alertsResolved,
      durationMs:           report.durationMs,
      errorCount:           report.errors.length
    })
  );

  return report;
}

/**
 * Preview: returns what synchronizeClaimsFoundation would change, without writing.
 * Run this first to confirm expected counts before applying.
 */
function previewClaimsFoundationSync() {
  var result = synchronizeClaimsFoundation({ dryRun: true, quiet: false });
  Logger.log('SYNC_CLAIMS_FOUNDATION_PREVIEW_COMPLETE ' + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Apply: runs the full synchronization and writes all results.
 * Run previewClaimsFoundationSync() first to confirm expected counts.
 */
function runClaimsFoundationSync() {
  var result = synchronizeClaimsFoundation({ dryRun: false, quiet: false });
  Logger.log('SYNC_CLAIMS_FOUNDATION_COMPLETE ' + JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------------------
// Step runner
// ---------------------------------------------------------------------------

/**
 * Wraps a sync step with error isolation, timing, and optional logging.
 * A failure in one step does not prevent subsequent steps from running —
 * all steps execute regardless, so the report reflects partial progress.
 *
 * @param {string}   stepName
 * @param {boolean}  quiet     If true, successful steps are not logged individually.
 * @param {Function} fn        Step function. May throw. Return value stored in result.
 * @returns {{ stepName, success, result, error, durationMs }}
 * @private
 */
function runSyncStep_(stepName, quiet, fn) {
  var stepStart = Date.now();

  try {
    var result  = fn();
    var elapsed = Date.now() - stepStart;

    if (!quiet) {
      Logger.log('[ClaimSync] ' + stepName + ' OK (' + elapsed + 'ms)');
    }

    return {
      stepName:   stepName,
      success:    true,
      result:     result || {},
      error:      null,
      durationMs: elapsed
    };
  } catch (err) {
    var elapsed = Date.now() - stepStart;

    Logger.log(
      '[ClaimSync] ' + stepName + ' ERROR (' + elapsed + 'ms): ' +
      (err && err.message ? err.message : String(err))
    );

    return {
      stepName:   stepName,
      success:    false,
      result:     {},
      error: {
        stepName: stepName,
        message:  err && err.message ? err.message   : String(err),
        stack:    err && err.stack   ? String(err.stack).slice(0, 500) : ''
      },
      durationMs: elapsed
    };
  }
}
