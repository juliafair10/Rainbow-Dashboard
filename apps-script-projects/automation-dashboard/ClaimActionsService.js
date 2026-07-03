/**
 * ClaimActionsService.js — automation-dashboard
 * Phase 10D — Claim Activity Center: Claim Actions
 *
 * Framework for the Full Claim page's "Claim Actions" panel. Each button
 * is an operational shortcut that (1) creates a Todoist task using claim
 * context and (2) logs a lightweight "Claim Action" Timeline event on the
 * claim via claims-service. This is intentionally the framework only —
 * it does not perform the underlying workflow (e.g. it does not actually
 * bill or close the job). Future phases can extend CLAIM_ACTION_DEFINITIONS_
 * with real downstream automation per action.
 *
 * Script Properties (set on THIS project — automation-dashboard — separately
 * from eoj-processing-engine's Todoist properties, since Script Properties
 * do not share across Apps Script projects):
 *   TODOIST_API_TOKEN   — Todoist API token
 *   TODOIST_PROJECT_ID  — numeric Todoist project ID for these tasks
 *   TODOIST_SECTION_ID  — (optional) section within that project
 *
 * If TODOIST_API_TOKEN / TODOIST_PROJECT_ID are not configured, the Todoist
 * step is skipped (non-fatal) — the Timeline event still gets logged and the
 * user still sees a clear confirmation of what did/did not happen.
 */

var CLAIM_ACTION_DEFINITIONS_ = {
  billInspectionClose: {
    buttonLabel: 'Bill Inspection & Close',
    taskTitle: 'Bill inspection and close',
    instruction: 'Review inspection billing and close if appropriate.'
  },
  followUpCoverage: {
    buttonLabel: 'Follow Up on Coverage',
    taskTitle: 'Follow up on coverage',
    instruction: 'Follow up with the carrier on the coverage decision for this claim.'
  },
  requestRevision: {
    buttonLabel: 'Request Revision',
    taskTitle: 'Request revision',
    instruction: 'Review the estimate and request a revision from the carrier if needed.'
  },
  scheduleMonitoring: {
    buttonLabel: 'Schedule Monitoring',
    taskTitle: 'Schedule monitoring',
    instruction: 'Schedule the next monitoring visit for this claim.'
  }
};

/**
 * Called via google.script.run from ClaimActivityCenter.html.
 * @param {Object} payload - { claimId, actionKey, customerName, claimNumber, jobNumber, claimLink }
 */
function fcvRunClaimAction(payload) {
  payload = payload || {};

  var actionKey = String(payload.actionKey || '').trim();
  var definition = CLAIM_ACTION_DEFINITIONS_[actionKey];

  if (!payload.claimId) {
    return { ok: false, message: 'Missing claimId — cannot run claim action.' };
  }
  if (!definition) {
    return { ok: false, message: 'Unknown claim action: ' + actionKey };
  }

  var todoistResult = createClaimActionTodoistTask_(definition, payload);

  var timelineResult = { ok: false, reason: 'Not attempted' };
  try {
    var response = fetchClaimsServiceJson_('createClaimActivityEvent', {
      claimId: payload.claimId,
      actionKey: actionKey,
      actionLabel: definition.buttonLabel,
      note: definition.instruction
    });
    timelineResult.ok = !!(response && (response.success === true || response.status === 'Success'));
    timelineResult.reason = timelineResult.ok ? '' : (response && response.message ? response.message : 'Unknown error');
  } catch (err) {
    timelineResult.ok = false;
    timelineResult.reason = err && err.message ? err.message : String(err);
  }

  var messageParts = [];
  messageParts.push(todoistResult.ok
    ? 'Todoist task created.'
    : 'Todoist task skipped (' + (todoistResult.reason || 'not configured') + ').');
  messageParts.push(timelineResult.ok
    ? 'Timeline event logged.'
    : 'Timeline event failed (' + (timelineResult.reason || 'unknown error') + ').');

  return {
    ok: todoistResult.ok || timelineResult.ok,
    actionKey: actionKey,
    actionLabel: definition.buttonLabel,
    todoist: todoistResult,
    timelineEvent: timelineResult,
    message: messageParts.join(' ')
  };
}

function createClaimActionTodoistTask_(definition, payload) {
  try {
    var config = getClaimActionTodoistConfig_();

    if (!config.apiToken) {
      return { ok: false, reason: 'TODOIST_API_TOKEN not configured on automation-dashboard' };
    }
    if (!config.projectId) {
      return { ok: false, reason: 'TODOIST_PROJECT_ID not configured on automation-dashboard' };
    }

    var description = buildClaimActionTaskDescription_(definition, payload);
    var todayDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    var task = {
      content: definition.taskTitle,
      description: description,
      project_id: config.projectId,
      due_date: todayDate
    };

    if (config.sectionId) {
      task.section_id = config.sectionId;
    }

    var response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/tasks', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + config.apiToken },
      payload: JSON.stringify(task),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code < 200 || code >= 300) {
      return { ok: false, reason: 'Todoist API returned HTTP ' + code };
    }

    var created = {};
    try { created = JSON.parse(body || '{}'); } catch (e) { /* ignore */ }

    return { ok: true, taskId: String(created.id || ''), taskUrl: String(created.url || '') };
  } catch (err) {
    return { ok: false, reason: err && err.message ? err.message : String(err) };
  }
}

function buildClaimActionTaskDescription_(definition, payload) {
  var lines = [];
  lines.push('Customer: ' + (payload.customerName || ''));
  lines.push('Claim Number: ' + (payload.claimNumber || ''));
  lines.push('Job Number: ' + (payload.jobNumber || ''));
  lines.push('');
  lines.push('Claim Link: ' + (payload.claimLink || ''));
  lines.push('');
  lines.push(definition.instruction);
  return lines.join('\n');
}

function getClaimActionTodoistConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    apiToken: props.getProperty('TODOIST_API_TOKEN') || '',
    projectId: props.getProperty('TODOIST_PROJECT_ID') || '',
    sectionId: props.getProperty('TODOIST_SECTION_ID') || ''
  };
}

/**
 * Run from the Apps Script editor to confirm Script Properties are set
 * before relying on the Claim Actions panel live.
 */
function testClaimActionTodoistConnection() {
  var config = getClaimActionTodoistConfig_();
  Logger.log('Has token: ' + !!config.apiToken);
  Logger.log('Project ID: ' + config.projectId);
  Logger.log('Section ID: ' + config.sectionId);
  return config;
}
