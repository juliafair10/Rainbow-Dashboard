/**
 * Shared utility helpers for claims-service.
 */

function nowIso() {
  return new Date().toISOString();
}

function formatDateKey_(date) {
  const d = date || new Date();
  return Utilities.formatDate(d, CLAIM_SERVICE.timezone, 'yyyyMMdd');
}

function generateId(prefix) {
  const dateKey = formatDateKey_(new Date());
  const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return prefix + '-' + dateKey + '-' + randomPart;
}

function normalizeString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeClaimNumber(value) {
  return normalizeString(value).toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function normalizeAddress(value) {
  return normalizeLower(value)
    .replace(/\./g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeJsonParse(value, fallback) {
  if (!value) {
    return fallback || {};
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback || {};
  }
}

function stringifyJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch (error) {
    return JSON.stringify({ error: 'Unable to stringify value.' });
  }
}

function parseRequestPayload_(e) {
  if (!e) {
    return {};
  }

  if (e.postData && e.postData.contents) {
    return safeJsonParse(e.postData.contents, {});
  }

  return e.parameter || {};
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function objectFromHeaders_(headers, values) {
  const rowObject = {};

  headers.forEach(function(header, index) {
    rowObject[header] = values[index];
  });

  return rowObject;
}

function valuesFromObject_(headers, object) {
  return headers.map(function(header) {
    return object && Object.prototype.hasOwnProperty.call(object, header)
      ? object[header]
      : '';
  });
}
