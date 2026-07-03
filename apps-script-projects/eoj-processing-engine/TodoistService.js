/**
 * TodoistService.js — eoj-processing-engine
 *
 * Creates Todoist tasks for EOJ office follow-up actions.
 * Follows the same pattern as insurance-intake-automation/Todoist.js.
 *
 * Script Properties:
 *   TODOIST_API_TOKEN            — API token (preferred; falls back to TODOIST_TOKEN)
 *   TODOIST_PROJECT_ID           — Numeric project ID for follow-up tasks
 *   TODOIST_ASSIGNEE_ID_JULIA    — Todoist user ID for Julia
 *   TODOIST_ASSIGNEE_ID_CLARENCE — Todoist user ID for Clarence
 *   TODOIST_SECTION_ID           — (optional) Section ID within the project
 *
 * API endpoints match the existing intake automation:
 *   POST https://api.todoist.com/api/v1/tasks
 *
 * Non-fatal: all errors are logged and returned, never thrown.
 * Do NOT modify the Insurance Intake Automation Todoist workflow.
 */

/**
 * Create a Todoist task for an EOJ office follow-up action.
 * Only runs when the technician flagged followUpNeeded = true.
 *
 * @param {Object} interpreted - output of interpretBasicEOJ_()
 * @returns {{ ok: boolean, taskId?: string, taskUrl?: string, reason?: string }}
 */
function createEojTodoistTask(interpreted) {
  try {
    var payload  = interpreted.rawParsed || {};

    // Only create a task when follow-up was requested
    if (!payload.followUpNeeded) {
      return { ok: false, reason: 'No follow-up needed for this EOJ' };
    }

    var action   = String(payload.followUpAction    || '').trim();
    var assignee = String(payload.followUpAssignedTo || '').trim();
    var note     = String(payload.followUpNote      || payload.followUpDescription || '').trim();

    if (!action) {
      return { ok: false, reason: 'No follow-up action specified' };
    }

    var todoist = getEojTodoistConfig_();

    if (!todoist.apiToken) {
      Logger.log('TodoistService: TODOIST_API_TOKEN not set in Script Properties — skipping.');
      return { ok: false, reason: 'TODOIST_API_TOKEN not configured' };
    }

    if (!todoist.projectId) {
      Logger.log('TodoistService: TODOIST_PROJECT_ID not set in Script Properties — skipping.');
      return { ok: false, reason: 'TODOIST_PROJECT_ID not configured' };
    }

    // Resolve assignee ID
    var assigneeId = null;
    if (assignee === 'Julia' && todoist.assigneeIdJulia) {
      assigneeId = Number(todoist.assigneeIdJulia);
    } else if (assignee === 'Clarence' && todoist.assigneeIdClarence) {
      assigneeId = Number(todoist.assigneeIdClarence);
    }

    // Build task fields
    var customer    = String(interpreted.customerName  || payload.customerName  || interpreted.jobName || '').trim();
    var claimNumber = String(interpreted.claimNumber   || payload.claimNumber   || '').trim();
    var claimId     = String(interpreted.claimId       || payload.claimId       || '').trim();
    var technician  = String(interpreted.technician    || '').trim();
    var visitDate   = String(interpreted.visitDate     || '').trim();
    var visitType   = String(interpreted.visitType     || payload.visitType     || '').trim();

    var content     = buildEojTaskTitle_(customer, claimNumber, action);
    var description = buildEojTaskDescription_(customer, claimNumber, action, note, claimId, technician, visitDate, visitType);
    var todayDate   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    var task = {
      content:       content,
      description:   description,
      project_id:    todoist.projectId,
      priority:      todoist.priority,
      due_date:      todayDate,
      deadline_date: todayDate
    };

    if (assigneeId) {
      task.assignee_id = assigneeId;
    }

    if (todoist.sectionId) {
      task.section_id = todoist.sectionId;
    }

    var response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/tasks', {
      method:             'post',
      contentType:        'application/json',
      headers:            { Authorization: 'Bearer ' + todoist.apiToken },
      payload:            JSON.stringify(task),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code < 200 || code >= 300) {
      Logger.log('TodoistService: API error HTTP ' + code + ': ' + body.slice(0, 500));
      return { ok: false, reason: 'Todoist API returned HTTP ' + code };
    }

    var created = {};
    try { created = JSON.parse(body || '{}'); } catch (e) { /* ignore */ }

    Logger.log('TodoistService: EOJ task created — id=' + created.id + ' | ' + content);
    return { ok: true, taskId: String(created.id || ''), taskUrl: String(created.url || '') };

  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    Logger.log('TodoistService error (non-fatal): ' + msg);
    return { ok: false, reason: msg };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Read EOJ Todoist config from Script Properties.
 * Mirrors the pattern of getTodoistConfig_() in the intake automation.
 * TODOIST_API_TOKEN is preferred; falls back to TODOIST_TOKEN for compatibility.
 */
function getEojTodoistConfig_() {
  var props        = PropertiesService.getScriptProperties();
  var todoistCfg   = (CONFIG && CONFIG.todoist) ? CONFIG.todoist : {};

  var apiToken = props.getProperty(todoistCfg.apiTokenProperty || 'TODOIST_API_TOKEN') ||
                 props.getProperty('TODOIST_TOKEN') || '';

  return {
    apiToken:           apiToken,
    projectId:          props.getProperty(todoistCfg.projectIdProperty          || 'TODOIST_PROJECT_ID')           || '',
    assigneeIdJulia:    props.getProperty(todoistCfg.assigneeIdJuliaProperty    || 'TODOIST_ASSIGNEE_ID_JULIA')    || '',
    assigneeIdClarence: props.getProperty(todoistCfg.assigneeIdClarenceProperty || 'TODOIST_ASSIGNEE_ID_CLARENCE') || '',
    sectionId:          props.getProperty(todoistCfg.sectionIdProperty          || 'TODOIST_SECTION_ID')           || '',
    priority:           todoistCfg.priority || 3
  };
}

function testEojTodoistConnection() {
  var todoist = getEojTodoistConfig_();

  Logger.log('Has token: ' + !!todoist.apiToken);
  Logger.log('Token length: ' + String(todoist.apiToken || '').length);
  Logger.log('Project ID: ' + todoist.projectId);
  Logger.log('Julia ID: ' + todoist.assigneeIdJulia);
  Logger.log('Clarence ID: ' + todoist.assigneeIdClarence);
  Logger.log('Section ID: ' + todoist.sectionId);

  if (!todoist.apiToken) {
    Logger.log('Missing TODOIST_API_TOKEN or TODOIST_TOKEN in Script Properties.');
    return {
      status: 'Error',
      message: 'Missing Todoist API token.'
    };
  }

  if (!todoist.projectId) {
    Logger.log('Missing TODOIST_PROJECT_ID in Script Properties.');
    return {
      status: 'Error',
      message: 'Missing Todoist project ID.'
    };
  }

  var response = UrlFetchApp.fetch(
    'https://api.todoist.com/api/v1/tasks?project_id=' + encodeURIComponent(todoist.projectId) + '&limit=5',
    {
      method: 'get',
      headers: {
        Authorization: 'Bearer ' + todoist.apiToken
      },
      muteHttpExceptions: true
    }
  );

  var code = response.getResponseCode();
  var body = response.getContentText();

  Logger.log('HTTP ' + code);
  Logger.log(body);

  return {
    status: code >= 200 && code < 300 ? 'Success' : 'Error',
    httpCode: code,
    body: body
  };
}

/**
 * Task title — concise, matches intake style: "Customer Name - Claim # | Action"
 */
function buildEojTaskTitle_(customer, claimNumber, action) {
  var parts = [];
  if (customer)    parts.push(customer);
  if (claimNumber) parts.push(claimNumber);
  var base = parts.join(' - ');
  return base ? base + ' | ' + action : action;
}

/**
 * Task description — the fields requested in the sprint spec.
 */
function buildEojTaskDescription_(customer, claimNumber, action, note, claimId, technician, visitDate, visitType) {
  var lines = [];

  if (customer)    lines.push('Customer: '    + customer);
  if (claimNumber) lines.push('Claim #: '     + claimNumber);
  lines.push(      'Action: '                 + action);
  if (note)        lines.push('Note: '         + note);
  if (technician)  lines.push('Technician: '   + technician);
  if (visitDate)   lines.push('Visit Date: '   + visitDate);
  if (visitType)   lines.push('Visit Type: '   + visitType);

  // Link to Claim — Rainbow Claims Database (deep link by Claim ID if available)
  if (claimId) {
    lines.push('Claim ID: ' + claimId);
  }

  return lines.join('\n');
}
