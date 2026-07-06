/**
 * Phase 11B — Temporary Script Property setup helpers (automation-dashboard).
 *
 * These are one-time setup helpers to seed the Script Properties the relocated
 * Insurance Intake module needs to run in-process (Phase 11B UI cutover).
 *
 * TEMPORARY: delete this file once the dashboard project's Script Properties
 * are confirmed set. This is setup tooling, not part of the intake pipeline.
 *
 * SECURITY: the Todoist API token is intentionally NOT stored in this source
 * file. Use setTodoistApiTokenForPhase11B(token) and pass the token at call
 * time so the secret never lives in the repository.
 *
 * All setters are additive: setProperties(..., false) does NOT delete other
 * existing properties, and setProperty() only writes the single named key.
 */

/**
 * Sets the non-secret Script Properties required by the Phase 11B intake module.
 * Does NOT set TODOIST_API_TOKEN (use setTodoistApiTokenForPhase11B instead).
 * Does NOT delete any existing properties.
 *
 * @returns {Object} A summary of what was set (token status shown separately,
 *                   never the token value).
 */
function setPhase11BScriptProperties() {
  var properties = {
    CLAIMS_SERVICE_WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzrsk0ixP_q0jrkDtXyXeTo7NjspbQvgRVC4m7XUWTam3CIkfF0oazo5NYYRhuDw5Pr3Q/exec',
    TODOIST_ASSIGNEE_ID_CLARENCE: '58990561',
    TODOIST_PROJECT_ID: '6gXFgfjffVRQRMqP',
    USE_CLAIMS_SERVICE_EXTERNAL_LINKS: 'false',
    CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE: 'true'
  };

  // false = do NOT delete other existing properties (additive write).
  PropertiesService.getScriptProperties().setProperties(properties, false);

  var result = {
    status: 'Success',
    message: 'Phase 11B non-secret script properties set (additive; existing properties preserved).',
    setKeys: Object.keys(properties),
    note: 'TODOIST_API_TOKEN is not set here. Run setTodoistApiTokenForPhase11B(token) separately.'
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Stores the Todoist API token as a Script Property.
 * The token is passed as an argument so it is never committed to source.
 *
 * Example (run once from the Apps Script editor, then clear the value):
 *   setTodoistApiTokenForPhase11B('your-todoist-api-token');
 *
 * @param {string} token The Todoist API token.
 * @returns {Object} A summary that never echoes the token value.
 */
function setTodoistApiTokenForPhase11B(token) {
  var cleanToken = String(token || '').trim();

  if (!cleanToken) {
    var missing = {
      status: 'Error',
      success: false,
      message: 'No token provided. Call setTodoistApiTokenForPhase11B(token) with the Todoist API token as the argument.'
    };
    Logger.log(JSON.stringify(missing, null, 2));
    return missing;
  }

  PropertiesService.getScriptProperties().setProperty('TODOIST_API_TOKEN', cleanToken);

  var result = {
    status: 'Success',
    success: true,
    message: 'TODOIST_API_TOKEN stored.',
    tokenLength: cleanToken.length,
    tokenValueLogged: false
  };

  // Deliberately do NOT log the token value.
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Reports whether each required Phase 11B Script Property exists.
 * Never returns or logs the Todoist token value — only whether it is present.
 *
 * @returns {Object} Presence report for every required property.
 */
function listPhase11BScriptProperties() {
  var props = PropertiesService.getScriptProperties();

  // Every required property, including the Todoist token. For each we report
  // ONLY whether it exists (a boolean) — never the value. This is safe for the
  // token because getProperty is used solely to test presence.
  var requiredKeys = [
    'CLAIMS_SERVICE_WEB_APP_URL',
    'TODOIST_ASSIGNEE_ID_CLARENCE',
    'TODOIST_PROJECT_ID',
    'TODOIST_API_TOKEN',
    'USE_CLAIMS_SERVICE_EXTERNAL_LINKS',
    'CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE'
  ];

  var report = {};

  requiredKeys.forEach(function(key) {
    var value = props.getProperty(key);
    report[key] = value !== null && value !== undefined && String(value).length > 0;
  });

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/**
 * ============================================================================
 * ⚠️  TEMPORARY ONE-CLICK RUNNER — CONTAINS A SECRET. DELETE AFTER RUNNING. ⚠️
 * ============================================================================
 *
 * Select this function in the Apps Script editor and click Run. It sets every
 * required Phase 11B Script Property (including the Todoist token) in one shot,
 * then logs the presence report so you can confirm all six are true.
 *
 * The Run button cannot pass arguments, which is why the token is inlined here.
 * Because that puts the token in the file:
 *   1. Run this ONCE.
 *   2. Then remove the token (or delete this whole helper file) before committing.
 *   3. Rotate the Todoist token afterward as good hygiene.
 *
 * This runner is the ONLY place the token appears; the other functions never
 * hardcode it.
 */
// TOKEN REMOVED after successful setup on 2026-07-06. The runner previously
// inlined the Todoist token here; it has been stripped now that the property
// is stored. Safe to delete this entire file.
function runPhase11BScriptPropertySetup() {
  setPhase11BScriptProperties();
  // Token intentionally NOT inlined. If you need to re-set it, pass it directly:
  //   setTodoistApiTokenForPhase11B('your-token');
  return listPhase11BScriptProperties();
}
