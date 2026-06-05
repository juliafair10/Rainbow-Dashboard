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
