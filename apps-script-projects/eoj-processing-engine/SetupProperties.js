/**
 * SetupProperties.js — eoj-processing-engine
 *
 * ONE-TIME SETUP: Run setupEojScriptProperties() once from the Apps Script editor
 * to seed all required Script Properties for this project.
 *
 * After running, you can delete this file or leave it — but do not push
 * live secret values to a shared repo. Clear the values below after running
 * if this project is version-controlled.
 *
 * To run: open the Apps Script editor → select setupEojScriptProperties → Run
 */

function setupEojScriptProperties() {
  PropertiesService.getScriptProperties().setProperties({
    'TODOIST_API_TOKEN':            'bec0e54eb282bae9f810429793952ad9ed7f7f60',
    'TODOIST_PROJECT_ID':           '6gVr69JGQM5w9rQX',
    'TODOIST_ASSIGNEE_ID_JULIA':    '58844832',
    'TODOIST_ASSIGNEE_ID_CLARENCE': '58990561',
    'GOOGLE_CHAT_WEBHOOK_URL':      'https://chat.googleapis.com/v1/spaces/AAAAuubD3rw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=_S4IAjIWeYM72gnQ8E59GbcoCHjwsLyuqKlzdh2hfMM'
  });

  Logger.log('✅ EOJ Processing Engine script properties set successfully.');
  Logger.log('Properties configured: TODOIST_API_TOKEN, TODOIST_PROJECT_ID, TODOIST_ASSIGNEE_ID_JULIA, TODOIST_ASSIGNEE_ID_CLARENCE, GOOGLE_CHAT_WEBHOOK_URL');
}

/**
 * Verify all required properties are present (safe to run any time — read-only).
 */
function verifyEojScriptProperties() {
  var props = PropertiesService.getScriptProperties();
  var required = [
    'TODOIST_API_TOKEN',
    'TODOIST_PROJECT_ID',
    'TODOIST_ASSIGNEE_ID_JULIA',
    'TODOIST_ASSIGNEE_ID_CLARENCE',
    'GOOGLE_CHAT_WEBHOOK_URL'
  ];

  var results = required.map(function(key) {
    var val = props.getProperty(key);
    return key + ': ' + (val ? '✅ set (' + val.slice(0, 8) + '...)' : '❌ MISSING');
  });

  results.forEach(function(line) { Logger.log(line); });
  return results;
}
