
function testProcessUnprocessedEOJs() {
  const result = processUnprocessedEOJs();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testGetUnprocessedEOJRows() {
  const rows = getUnprocessedEOJRows();
  Logger.log(JSON.stringify({ foundCount: rows.length, rows: rows }, null, 2));
  return rows;
}

function testParseFirstUnprocessedEOJ() {
  const rows = getUnprocessedEOJRows();

  if (rows.length === 0) {
    Logger.log('No unprocessed EOJs found.');
    return null;
  }

  const parsed = parseRawJson_(rows[0].rawJson);
  Logger.log(JSON.stringify(parsed, null, 2));
  return parsed;
}