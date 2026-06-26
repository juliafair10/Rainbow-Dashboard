/**
 * Run createProcessingTrigger() once from the Apps Script editor to set up
 * the time-based trigger. Every 15 minutes is the recommended cadence for pilot.
 * Re-running createProcessingTrigger() removes old triggers first, so it's safe to call again.
 */
function createProcessingTrigger() {
  // Remove existing triggers for this function to prevent duplicates.
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processUnprocessedEOJs')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('processUnprocessedEOJs')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('Processing trigger created: processUnprocessedEOJs runs every 15 minutes.');
  return { ok: true, message: 'Trigger created. processUnprocessedEOJs will run every 15 minutes.' };
}

function deleteProcessingTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processUnprocessedEOJs');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log('Deleted ' + triggers.length + ' processing trigger(s).');
  return { ok: true, deleted: triggers.length };
}

function listProcessingTriggers() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processUnprocessedEOJs')
    .map(t => ({
      triggerId: t.getUniqueId(),
      handlerFunction: t.getHandlerFunction(),
      eventType: String(t.getEventType())
    }));
  Logger.log(JSON.stringify(triggers, null, 2));
  return triggers;
}

function processUnprocessedEOJs() {
  const runId = Utilities.getUuid();
  const rows = getUnprocessedEOJRows();

  const result = {
    status: 'Success',
    runId,
    foundCount: rows.length,
    processedCount: 0,
    errorCount: 0,
    errors: []
  };

  rows.forEach(row => {
    try {
      const parsed = parseRawJson_(row.rawJson);
      const interpreted = interpretBasicEOJ_(parsed, row, runId);
      const outputId = writeProcessingOutput_(interpreted);
      markEOJProcessed_(row.rowNumber, runId, outputId);
      result.processedCount++;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      markEOJError_(row.rowNumber, runId, message);
      result.errorCount++;
      result.errors.push({
        rowNumber: row.rowNumber,
        eojId: row.eojId,
        error: message
      });
    }
  });

  if (result.errorCount > 0 && result.processedCount > 0) {
    result.status = 'Partial Success';
  } else if (result.errorCount > 0) {
    result.status = 'Error';
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
