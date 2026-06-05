
function parseRawJson_(rawJson) {
  try {
    if (rawJson === null || rawJson === undefined || rawJson === '') {
      throw new Error('Raw_JSON is blank.');
    }

    if (typeof rawJson === 'object') {
      return rawJson;
    }

    return JSON.parse(String(rawJson));
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    throw new Error('Malformed Raw_JSON: ' + message);
  }
}