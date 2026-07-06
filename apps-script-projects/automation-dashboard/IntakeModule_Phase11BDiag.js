/**
 * Phase 11B — TEMPORARY diagnostic. Safe to delete after use.
 *
 * Times getIntakeWorkspaceSummary() (the function the Intake Workspace calls on
 * load) and logs how long it took and whether it completed or errored. Use this
 * to confirm whether the stuck-on-loading page is caused by the heavy in-process
 * load (slow but completes / times out) versus a logic error.
 *
 * HOW TO RUN:
 *   1. In the Apps Script editor, pick "diagnoseIntakeWorkspaceSummaryTiming"
 *      from the function dropdown (top toolbar).
 *   2. Click Run.
 *   3. Open View -> Logs (or the Execution log) and read the JSON report.
 *
 * Interpreting it:
 *   - completed: true with a large ranFor_seconds  -> it's slow (load weight),
 *     not a logic bug. Reverting the workspace reads to HTTP is the quick fix.
 *   - completed: false with an error/timeout        -> capture the error text.
 */
function diagnoseIntakeWorkspaceSummaryTiming() {
  var start = new Date();
  var result = null;
  var error = '';

  try {
    result = getIntakeWorkspaceSummary();
  } catch (e) {
    error = e && e.message ? e.message : String(e);
  }

  var ms = new Date().getTime() - start.getTime();

  var report = {
    ranFor_ms: ms,
    ranFor_seconds: Math.round(ms / 100) / 10,
    completed: !error,
    error: error,
    resultStatus: result && result.status ? result.status : '',
    workspaceHealthStatus: result && result.workspaceHealth ? result.workspaceHealth.status : '',
    sourceServiceUrlConfigured: result ? !!result.sourceServiceUrlConfigured : null,
    // How many of the four in-process source calls came back OK (for spotting
    // a single slow/failing sub-call).
    sourceResponses: result && result.sourceResponses ? result.sourceResponses : null
  };

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
