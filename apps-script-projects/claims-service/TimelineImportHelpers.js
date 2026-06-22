

/**
 * TimelineImportHelpers
 * Shared helpers for importing external activity records into Timeline_Events.
 *
 * Phase 11A scope:
 * - Match imported note rows to active claims.
 * - Generate stable source record IDs for duplicate prevention.
 * - Detect existing timeline events by Event ID.
 * - Support timeline import services without creating alerts, conditions,
 *   ownership changes, Todoist tasks, calendar events, or health scoring changes.
 */

var TimelineImportHelpers = (function () {
  var ACTIVE_LIFECYCLE_STATES = [
    'Intake',
    'Active Work',
    'Insurance Resolution',
    'Administrative Closeout'
  ];

  function getActiveClaimSummaries() {
    var claims = [];

    if (typeof ClaimsQueryService !== 'undefined' &&
        ClaimsQueryService &&
        typeof ClaimsQueryService.getAllClaimSummaries === 'function') {
      claims = ClaimsQueryService.getAllClaimSummaries() || [];
    } else if (typeof getAllClaimSummaries === 'function') {
      claims = getAllClaimSummaries() || [];
    }

    return claims.filter(function (claim) {
      var lifecycle = String(claim.lifecycleState || claim.Lifecycle_State || '').trim();
      if (!lifecycle) return true;
      return ACTIVE_LIFECYCLE_STATES.indexOf(lifecycle) !== -1;
    });
  }

  function buildClaimLookupIndexes(claims) {
    var indexes = {
      byClaimId: {},
      byJobNumber: {},
      byClaimNumber: {},
      byCustomerName: {}
    };

    (claims || []).forEach(function (claim) {
      var claimId = normalizeKey_(claim.claimId || claim.Claim_ID || claim.id);
      var jobNumber = normalizeKey_(claim.jobNumber || claim.Job_Number || claim.job || claim.Job);
      var claimNumber = normalizeKey_(claim.claimNumber || claim.Claim_Number);
      var customerName = normalizeName_(claim.customerName || claim.Customer_Name || claim.displayName || claim.Display_Name || claim.customer || claim.Customer);

      if (claimId) indexes.byClaimId[claimId] = claim;
      if (jobNumber) indexes.byJobNumber[jobNumber] = claim;
      if (claimNumber) indexes.byClaimNumber[claimNumber] = claim;
      if (customerName) indexes.byCustomerName[customerName] = claim;
    });

    return indexes;
  }

  function matchHistoricalNoteRowToClaim(row, indexes) {
    var jobNumber = normalizeKey_(getRowValue_(row, ['jobNumber', 'Job Number', 'Job_Number', 'fusionJobNumber', 'Fusion Job Number']));
    var customer = normalizeName_(getRowValue_(row, ['customerName', 'Customer', 'Customer Name', 'Customer_Name']));

    if (jobNumber && indexes.byJobNumber[jobNumber]) {
      return {
        claim: indexes.byJobNumber[jobNumber],
        matchType: 'jobNumber',
        matchValue: jobNumber
      };
    }

    if (customer && indexes.byCustomerName[customer]) {
      return {
        claim: indexes.byCustomerName[customer],
        matchType: 'customer',
        matchValue: customer
      };
    }

    return {
      claim: null,
      matchType: 'unmatched',
      matchValue: jobNumber || customer || ''
    };
  }

  function buildSourceRecordId(parts) {
    var raw = (parts || [])
      .map(function (part) {
        if (part instanceof Date) return part.toISOString();
        return String(part === null || part === undefined ? '' : part).trim();
      })
      .join('|');

    return digest_(raw);
  }

  function loadExistingTimelineSourceRecordIds() {
    var ids = {};
    var sheet = getTimelineEventsSheet_();
    if (!sheet) return ids;

    var values = sheet.getDataRange().getValues();
    if (!values || values.length < 2) return ids;

    var headers = values[0].map(function (header) {
      return String(header || '').trim();
    });
    var sourceRecordIndex = headers.indexOf('Event ID');
    if (sourceRecordIndex === -1) return ids;

    for (var i = 1; i < values.length; i++) {
      var sourceRecordId = String(values[i][sourceRecordIndex] || '').trim();
      if (sourceRecordId) ids[sourceRecordId] = true;
    }

    return ids;
  }

  function appendImportedTimelineEvent(claim, event, dryRun, existingSourceRecordIds) {
    var claimId = claim.claimId || claim.Claim_ID || claim.id;
    if (!claimId) {
      throw new Error('Cannot append imported timeline event without Claim ID.');
    }

    if (event.sourceRecordId && existingSourceRecordIds && existingSourceRecordIds[event.sourceRecordId]) {
      return {
        status: 'duplicate',
        claimId: claimId,
        sourceRecordId: event.sourceRecordId
      };
    }

    if (dryRun === true) {
      return {
        status: 'dryRun',
        claimId: claimId,
        sourceRecordId: event.sourceRecordId,
        event: event
      };
    }

    var timelineEvent = {
      'Event ID': event.sourceRecordId,
      'Claim ID': claimId,
      'Job Number': event.jobNumber || '',
      'Date': event.eventDate,
      'Source': event.sourceSystem || 'Historical Notes',
      'Event Type': event.eventType || 'Historical Note',
      'Actor': event.actor || '',
      'Summary': event.summary || '',
      'Details': event.detail || '',
      'Visibility': event.visibility || 'Internal'
    };

    appendTimelineEvent(claimId, timelineEvent);

    if (event.sourceRecordId && existingSourceRecordIds) {
      existingSourceRecordIds[event.sourceRecordId] = true;
    }

    return {
      status: 'created',
      claimId: claimId,
      sourceRecordId: event.sourceRecordId
    };
  }

  function normalizeImportedDate(value) {
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (!value) return null;

    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  }

  function summarizeText(text, maxLength) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim();
    var limit = maxLength || 160;
    if (clean.length <= limit) return clean;
    return clean.substring(0, limit - 1) + '…';
  }

  function getRowValue_(row, possibleKeys) {
    for (var i = 0; i < possibleKeys.length; i++) {
      var key = possibleKeys[i];
      if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return '';
  }

  function normalizeKey_(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function normalizeName_(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function digest_(raw) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw || '');
    return bytes.map(function (byte) {
      var value = (byte < 0 ? byte + 256 : byte).toString(16);
      return value.length === 1 ? '0' + value : value;
    }).join('').substring(0, 32);
  }

  function getTimelineEventsSheet_() {
    var spreadsheet = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
    if (!spreadsheet) return null;

    return spreadsheet.getSheetByName('Timeline_Events') ||
      spreadsheet.getSheetByName('Timeline Events') ||
      spreadsheet.getSheetByName('TimelineEvents');
  }

  return {
    getActiveClaimSummaries: getActiveClaimSummaries,
    buildClaimLookupIndexes: buildClaimLookupIndexes,
    matchHistoricalNoteRowToClaim: matchHistoricalNoteRowToClaim,
    buildSourceRecordId: buildSourceRecordId,
    loadExistingTimelineSourceRecordIds: loadExistingTimelineSourceRecordIds,
    appendImportedTimelineEvent: appendImportedTimelineEvent,
    normalizeImportedDate: normalizeImportedDate,
    summarizeText: summarizeText
  };
})();