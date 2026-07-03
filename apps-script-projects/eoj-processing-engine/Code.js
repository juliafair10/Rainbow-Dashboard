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
    bridgeErrorCount: 0,
    errors: [],
    bridgeErrors: []
  };

  rows.forEach(row => {
    try {
      const parsed      = parseRawJson_(row.rawJson);
      const interpreted = interpretBasicEOJ_(parsed, row, runId);
      const outputId    = writeProcessingOutput_(interpreted);

      // Write to Rainbow Claims Database:
      // Timeline_Events, Claim_Conditions, Claim_Alerts, Claims timestamps,
      // Claim_Service_Log. Non-fatal: bridge errors are logged but do not
      // fail the processing row or prevent it from being marked Processed.
      try {
        writeEojToClaimsDatabase_(interpreted);
      } catch (bridgeErr) {
        const bridgeMsg = bridgeErr && bridgeErr.message ? bridgeErr.message : String(bridgeErr);
        const bridgeStack = bridgeErr && bridgeErr.stack ? bridgeErr.stack : '';
        const bridgeContext = {
          rowNumber: row.rowNumber,
          eojId: row.eojId,
          claimNumber: interpreted.claimNumber || interpreted.claim_number || '',
          customerName: interpreted.customerName || interpreted.customer_name || interpreted.insuredName || '',
          error: bridgeMsg
        };

        result.bridgeErrorCount++;
        result.bridgeErrors.push(bridgeContext);

        Logger.log(
          'ClaimsBridge error (non-fatal) for row ' + row.rowNumber + ': ' + bridgeMsg +
          (bridgeStack ? '\n' + bridgeStack : '')
        );

        if (typeof notifyClaimsBridgeFailure_ === 'function') {
          try {
            notifyClaimsBridgeFailure_(bridgeContext, bridgeErr, interpreted);
          } catch (notifyErr) {
            Logger.log('ClaimsBridge failure notification error (non-fatal) for row ' + row.rowNumber + ': ' +
              (notifyErr && notifyErr.message ? notifyErr.message : String(notifyErr)));
          }
        }
      }

      // Create Todoist task if office follow-up was requested. Non-fatal.
      // Phase D: capture result so task ID can be written back to EOJ_Log.
      var todoistResult = { ok: false, taskId: '', taskUrl: '' };
      try {
        todoistResult = createEojTodoistTask(interpreted) || todoistResult;
      } catch (todoistErr) {
        Logger.log('Todoist error (non-fatal) for row ' + row.rowNumber + ': ' + (todoistErr.message || todoistErr));
      }

      // Post Google Chat notification. Non-fatal.
      try {
        postEojToGoogleChat(interpreted);
      } catch (chatErr) {
        Logger.log('Google Chat error (non-fatal) for row ' + row.rowNumber + ': ' + (chatErr.message || chatErr));
      }

      markEOJProcessed_(row.rowNumber, runId, outputId);

      // Phase D: write Todoist task ID back to EOJ_Log after the row is marked Processed.
      // Non-fatal — failure here does not affect the processing result.
      if (todoistResult.ok && todoistResult.taskId) {
        try {
          writeTodoistWriteback_(row.rowNumber, todoistResult.taskId, todoistResult.taskUrl);
        } catch (writebackErr) {
          Logger.log('Todoist writeback error (non-fatal) for row ' + row.rowNumber + ': ' + (writebackErr.message || writebackErr));
        }
      }
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
  } else if (result.bridgeErrorCount > 0) {
    result.status = 'Success With Bridge Warnings';
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
