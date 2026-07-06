/**
 * Phase11C_TemporaryHelpers.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE AFTER RUNNING ONCE. ⚠️
 *
 * One-time helper for the Phase 11C go-live flip. It sets exactly one existing
 * Script Property (USE_CLAIMS_SERVICE_EXTERNAL_LINKS) to 'true', making Claims
 * Service the primary External_Links writer. It touches nothing else.
 *
 * Does NOT: call setProperties() or deleteAllProperties(); read or modify the
 * Todoist properties; touch CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE; or alter
 * any of the other ~50 existing properties.
 *
 * Run once from the Apps Script editor, confirm the log line, then delete this
 * file and push.
 */
function enableClaimsServiceExternalLinks() {
  PropertiesService.getScriptProperties().setProperty(
    'USE_CLAIMS_SERVICE_EXTERNAL_LINKS',
    'true'
  );
  Logger.log('USE_CLAIMS_SERVICE_EXTERNAL_LINKS=true');
}
