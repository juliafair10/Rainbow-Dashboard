/**
 * Timeline event storage for claims-service.
 * Rainbow Phase 4 - Claim Foundation
 * Phase 5 integration: TimelineEngineService classifies stored events.
 */

function appendTimelineEvent(claimId, event) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to append a timeline event.']);
  }

  const claimLookup = lookupClaim({ Claim_ID: claimId });
  if (!claimLookup.success) {
    return notFoundResponse('Cannot append timeline event because claim was not found.', {
      claimId: claimId
    });
  }

  const normalizedEvent = classifyTimelineEngineEvent_(normalizeTimelineEvent_(claimId, event || {}));
  const appendResult = appendRow(CLAIM_SHEET_NAMES.timeline, normalizedEvent);

  if (normalizedEvent.Updates_Last_Activity === true || normalizedEvent.Updates_Last_Activity === 'TRUE') {
    updateClaim(claimId, {
      Last_Meaningful_Activity_At: normalizedEvent.Event_Date
    });
  }

  writeServiceLog('appendTimelineEvent', 'Success', 'Timeline event appended.', {
    claimId: claimId,
    sourceSystem: normalizedEvent.Source_System,
    sourceRecordId: normalizedEvent.Source_Record_ID,
    timelineEventId: normalizedEvent.Timeline_Event_ID
  });

  return successResponse({
    timelineEvent: normalizedEvent,
    appendResult: appendResult
  }, 'Timeline event appended successfully.');
}

// ============================================================
// Phase 10D — Claim Activity Center: Claim Actions
//
// Thin wrapper around the existing appendTimelineEvent() so the Full Claim
// page's "Claim Actions" panel can log that an operational shortcut was
// used (Bill Inspection & Close, Follow Up on Coverage, Request Revision,
// Schedule Monitoring), without introducing any new storage or engine
// behavior. Does not touch the Health/Condition/Timeline engines.
// ============================================================
function createClaimActivityEvent(claimId, actionKey, actionLabel, note) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to log a claim action.']);
  }
  if (!actionKey) {
    return validationErrorResponse(['actionKey is required to log a claim action.']);
  }

  const label = normalizeString(actionLabel || actionKey);
  const summary = 'Claim Action: ' + label;
  const detailText = note ? String(note) : ('Triggered from the Full Claim Activity Center (' + actionKey + ').');

  return appendTimelineEvent(claimId, {
    Event_Type: 'Claim Action',
    Event_Source: 'Claim Activity Center',
    Source_System: 'automation-dashboard',
    Source_Record_ID: actionKey,
    Summary: summary,
    Detail: detailText,
    Actor: 'Julia',
    Related_Workflow: 'Claim Actions'
  });
}

function appendTimelineEvents(claimId, events) {
  if (!Array.isArray(events)) {
    return validationErrorResponse(['events must be an array.']);
  }

  const results = events.map(function(event) {
    return appendTimelineEvent(claimId, event);
  });

  const failures = results.filter(function(result) {
    return !result.success;
  });

  if (failures.length > 0) {
    return errorResponse('One or more timeline events failed to append.', {
      results: results,
      failures: failures
    });
  }

  return successResponse({
    count: results.length,
    results: results
  }, 'Timeline events appended successfully.');
}

function getTimelineForClaim(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to retrieve timeline.']);
  }

  let rows = findRows(CLAIM_SHEET_NAMES.timeline, {
    Claim_ID: claimId
  });

  if (!rows || rows.length === 0) {
    rows = getTimelineRowsForClaimFallback_(claimId);
  }

  rows.sort(function(a, b) {
    const aDate = normalizeTimelineServiceDate_(a.Event_Date || a['Event Date'] || a.Date || a.date || a.Created_At || a['Created At'] || 0).getTime();
    const bDate = normalizeTimelineServiceDate_(b.Event_Date || b['Event Date'] || b.Date || b.date || b.Created_At || b['Created At'] || 0).getTime();
    return bDate - aDate;
  });

  return successResponse({
    claimId: claimId,
    timeline: rows,
    count: rows.length
  }, 'Timeline retrieved successfully.');
}

// Helper for matching claim keys for fallback timeline search

function getTimelineMatchingKeysForClaim_(claimId) {
  const keys = {};
  const rawClaimId = String(claimId || '').trim();

  if (rawClaimId) {
    keys[rawClaimId] = true;
  }

  const claims = typeof findConditionEngineClaimsRows_ === 'function'
    ? findConditionEngineClaimsRows_()
    : [];

  const claim = (claims || []).find(function(row) {
    return getConditionEngineClaimIdFromRow_(row) === rawClaimId;
  });

  if (!claim) {
    return keys;
  }

  const jobNumber = String(getConditionEngineJobNumberFromRow_(claim) || '').trim();
  const claimNumber = String(claim.Claim_Number || claim['Claim Number'] || '').trim();

  if (jobNumber) {
    keys[jobNumber] = true;
    keys['CLM-' + jobNumber] = true;
  }

  if (claimNumber) {
    keys[claimNumber] = true;
  }

  return keys;
}

function getTimelineRowsForClaimFallback_(claimId) {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.timeline);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return [];
  }

  const headerRowIndex = findTimelineHeaderRowIndex_(values);
  const headers = values[headerRowIndex];
  const rows = [];
  const matchingKeys = getTimelineMatchingKeysForClaim_(claimId);

  for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const record = {};

    headers.forEach(function(header, columnIndex) {
      if (header) {
        record[String(header).trim()] = row[columnIndex];
      }
    });
    const recordClaimKey = String(
      record.Claim_ID ||
      record['Claim ID'] ||
      record.Job_Number ||
      record['Job Number'] ||
      record.Claim_Number ||
      record['Claim Number'] ||
      ''
    ).trim();

    if (matchingKeys[recordClaimKey]) {
      rows.push(normalizeTimelineFallbackRecord_(record));
    }
  }

  return rows;
}

function findTimelineHeaderRowIndex_(values) {
  for (let rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
    const row = values[rowIndex].map(function(value) {
      return String(value || '').trim();
    });

    if (row.indexOf('Claim_ID') !== -1 || row.indexOf('Claim ID') !== -1) {
      return rowIndex;
    }
  }

  return 0;
}

function normalizeTimelineFallbackRecord_(record) {
  return {
    Timeline_Event_ID: record.Timeline_Event_ID || record['Timeline Event ID'] || record.Event_ID || record['Event ID'] || '',
    Claim_ID: record.Claim_ID || record['Claim ID'] || '',
    Event_Date: record.Event_Date || record['Event Date'] || record.Date || record.date || record.Activity_Date || record['Activity Date'] || record.Created_At || record['Created At'] || '',
    Created_At: record.Created_At || record['Created At'] || '',
    Event_Type: record.Event_Type || record['Event Type'] || record.Activity_Type || record['Activity Type'] || record.Type || '',
    Event_Source: record.Event_Source || record['Event Source'] || record.Source_System || record['Source System'] || record.Source || record.source || '',
    Source_System: record.Source_System || record['Source System'] || record.Event_Source || record['Event Source'] || record.Source || record.source || '',
    Source_Record_ID: record.Source_Record_ID || record['Source Record ID'] || record.Event_ID || record['Event ID'] || '',
    Summary: record.Summary || record.Activity_Label || record['Activity Label'] || record.Description || '',
    Detail: record.Detail || record.Details || record.details || record.Note || record.Notes || '',
    Actor: record.Actor || record.Owner || '',
    Related_Workflow: record.Related_Workflow || record['Related Workflow'] || record.Workflow || '',
    Event_Category: record.Event_Category || record['Event Category'] || record.Category || '',
    Is_Meaningful_Activity: record.Is_Meaningful_Activity || record['Is Meaningful Activity'] || record.Meaningful || false
  };
}

function normalizeTimelineServiceDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (!value) {
    return new Date(0);
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(0);
}

function isMeaningfulActivity(event) {
  if (!event) {
    return false;
  }

  if (event.Is_Meaningful_Activity === true || event.Is_Meaningful_Activity === 'TRUE') {
    return true;
  }

  const meaningfulTypes = [
    'Intake Created',
    'EOJ Submitted',
    'Inspection Completed',
    'Monitoring Visit Completed',
    'Demo Completed',
    'Carrier Response',
    'Revision Submitted',
    'Payment Received',
    'Claim Updated'
  ];

  return meaningfulTypes.indexOf(event.Event_Type) !== -1;
}

function normalizeTimelineEvent_(claimId, event) {
  const now = nowIso();
  const eventType = normalizeString(event.Event_Type || event.eventType || 'Claim Updated');
  const eventSource = normalizeString(event.Event_Source || event.eventSource || event.Source_System || event.sourceSystem || CLAIM_SERVICE.name);
  const sourceSystem = normalizeString(event.Source_System || event.sourceSystem || eventSource || CLAIM_SERVICE.name);

  const normalizedEvent = {
    Timeline_Event_ID: event.Timeline_Event_ID || event.timelineEventId || event['Event ID'] || generateId(CLAIM_ID_PREFIXES.timelineEvent),
    Claim_ID: claimId,
    Event_Date: event.Event_Date || event.eventDate || event.Date || event.date || now,
    Event_Type: eventType,
    Event_Source: eventSource,
    Source_Record_ID: normalizeString(event.Source_Record_ID || event.sourceRecordId || event['Event ID'] || ''),
    Source_System: sourceSystem,
    Summary: normalizeString(event.Summary || event.summary || ''),
    Detail: normalizeString(event.Detail || event.detail || event.Details || event.details || ''),
    Actor: normalizeString(event.Actor || event.actor || ''),
    Related_Workflow: normalizeString(event.Related_Workflow || event.relatedWorkflow || ''),
    Related_Financial_Track_ID: normalizeString(event.Related_Financial_Track_ID || event.relatedFinancialTrackId || ''),
    Event_Category: normalizeString(event.Event_Category || event.eventCategory || ''),
    Source_Run_ID: normalizeString(event.Source_Run_ID || event.sourceRunId || ''),
    Owner_Area: normalizeString(event.Owner_Area || event.ownerArea || ''),
    Related_Condition_ID: normalizeString(event.Related_Condition_ID || event.relatedConditionId || ''),
    Related_Alert_ID: normalizeString(event.Related_Alert_ID || event.relatedAlertId || ''),
    Related_EOJ_ID: normalizeString(event.Related_EOJ_ID || event.relatedEojId || ''),
    Related_External_Link_ID: normalizeString(event.Related_External_Link_ID || event.relatedExternalLinkId || ''),
    Is_Meaningful_Activity: event.Is_Meaningful_Activity !== undefined
      ? event.Is_Meaningful_Activity
      : isMeaningfulActivity({ Event_Type: eventType }),
    Meaningful_Activity_Type: normalizeString(event.Meaningful_Activity_Type || event.meaningfulActivityType || ''),
    Updates_Last_Activity: event.Updates_Last_Activity !== undefined ? event.Updates_Last_Activity : '',
    Display_Priority: normalizeString(event.Display_Priority || event.displayPriority || ''),
    Visibility: normalizeString(event.Visibility || event.visibility || ''),
    Group_ID: normalizeString(event.Group_ID || event.groupId || ''),
    Group_Label: normalizeString(event.Group_Label || event.groupLabel || ''),
    Parent_Event_ID: normalizeString(event.Parent_Event_ID || event.parentEventId || ''),
    Is_Group_Parent: event.Is_Group_Parent !== undefined ? event.Is_Group_Parent : '',
    Noise_Reason: normalizeString(event.Noise_Reason || event.noiseReason || ''),
    Created_At: now,
    Created_By: normalizeString(event.Created_By || event.createdBy || 'TimelineService')
  };

  if (!normalizedEvent.Summary) {
    normalizedEvent.Summary = eventType;
  }

  return normalizedEvent;
}

function testAppendTimelineEvent() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    return claimLookup;
  }

  return appendTimelineEvent(claimLookup.data.claim.Claim_ID, {
    Event_Type: 'Intake Created',
    Event_Source: 'claims-service test',
    Source_System: 'claims-service test',
    Source_Record_ID: 'TEST-TIMELINE-001',
    Summary: 'Test intake timeline event created.',
    Detail: 'This verifies TimelineService can attach events to an existing claim.',
    Actor: 'System',
    Related_Workflow: 'Claim Foundation Test',
    Is_Meaningful_Activity: true
  });
}

function testGetTimelineForClaim() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = getTimelineForClaim(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function cleanupNonCanonicalEojPhotoTimelineEvents() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.timeline);

  if (!sheet) {
    return errorResponse('Claim_Timeline sheet not found.', {
      sheetName: CLAIM_SHEET_NAMES.timeline
    });
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return successResponse({
      removedCount: 0,
      removedRows: []
    }, 'No timeline rows found to clean.');
  }

  const headers = values[0];
  const eventTypeIndex = headers.indexOf('Event_Type');
  const summaryIndex = headers.indexOf('Summary');

  if (eventTypeIndex === -1 || summaryIndex === -1) {
    return errorResponse('Required timeline columns not found.', {
      headers: headers
    });
  }

  const removedRows = [];

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const row = values[rowIndex];
    const eventType = row[eventTypeIndex];
    const summary = row[summaryIndex];

    if (eventType === 'Alert Added' && summary === 'Missing EOJ Photos') {
      const sheetRowNumber = rowIndex + 1;
      removedRows.push(sheetRowNumber);
      sheet.deleteRow(sheetRowNumber);
    }
  }

  return successResponse({
    removedCount: removedRows.length,
    removedRows: removedRows.reverse()
  }, 'Non-canonical EOJ photo timeline events cleaned successfully.');
}

function testCleanupNonCanonicalEojPhotoTimelineEvents() {
  const response = cleanupNonCanonicalEojPhotoTimelineEvents();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testTimelineFallbackForFirstClaim() {
  const claims = typeof findConditionEngineClaimsRows_ === 'function'
    ? findConditionEngineClaimsRows_()
    : [];

  const firstClaim = claims && claims.length ? claims[0] : null;
  const claimId = firstClaim ? getConditionEngineClaimIdFromRow_(firstClaim) : '';

  const result = getTimelineForClaim(claimId);

  const response = successResponse({
    claimId: claimId,
    timelineCount: result.success ? result.data.count : 0,
    sampleTimelineEvent: result.success && result.data.timeline.length ? result.data.timeline[0] : null,
    result: result
  }, 'Timeline fallback test completed.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testTimelineFallbackForKnownClaim() {
  const claimId = 'CLM-26A-0034-WTR';
  const result = getTimelineForClaim(claimId);

  const response = successResponse({
    claimId: claimId,
    timelineCount: result.success ? result.data.count : 0,
    sampleTimelineEvent: result.success && result.data.timeline.length ? result.data.timeline[0] : null,
    result: result
  }, 'Timeline fallback known-claim test completed.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testTimelineSheetStructure() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.timeline);

  if (!sheet) {
    const response = errorResponse('Timeline sheet not found.', {
      spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID,
      timelineSheetName: CLAIM_SHEET_NAMES.timeline
    });
    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }

  const values = sheet.getDataRange().getValues();
  const headerRowIndex = findTimelineHeaderRowIndex_(values);
  const headers = values.length ? values[headerRowIndex] : [];
  const knownClaimId = 'CLM-26A-0034-WTR';
  const matchingKeys = getTimelineMatchingKeysForClaim_(knownClaimId);

  const firstFiveRecords = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < Math.min(values.length, headerRowIndex + 6); rowIndex++) {
    const row = values[rowIndex];
    const record = {};
    headers.forEach(function(header, columnIndex) {
      if (header) {
        record[String(header).trim()] = row[columnIndex];
      }
    });
    firstFiveRecords.push(record);
  }

  const claimLikeMatches = [];
  for (let rowIndex = headerRowIndex + 1; rowIndex < values.length && claimLikeMatches.length < 10; rowIndex++) {
    const row = values[rowIndex];
    const record = {};
    headers.forEach(function(header, columnIndex) {
      if (header) {
        record[String(header).trim()] = row[columnIndex];
      }
    });

    const recordText = JSON.stringify(record);
    if (recordText.indexOf('26A-0034-WTR') !== -1 || recordText.indexOf('822508719') !== -1 || recordText.indexOf('RAFI') !== -1) {
      claimLikeMatches.push(record);
    }
  }

  const response = successResponse({
    spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID,
    sheetName: CLAIM_SHEET_NAMES.timeline,
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn(),
    detectedHeaderRow: headerRowIndex + 1,
    detectedHeaders: headers,
    matchingKeysForKnownClaim: matchingKeys,
    firstFiveRecords: firstFiveRecords,
    claimLikeMatches: claimLikeMatches
  }, 'Timeline sheet structure inspected.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

// ============================================================
// DIAGNOSTIC ONLY — Phase 10D EOJ Reports investigation.
// Read-only. Does not modify any data, and does not touch
// getEojReportsForClaim_() or any other production logic.
//
// Purpose: EOJ Reports on the Full Claim page shows "No EOJ reports
// recorded" even though the Timeline clearly has EOJ events for the
// same claim. getEojReportsForClaim_() (ClaimDetailService.js) builds
// its groups from getTimelineForClaim()'s output, filtering rows whose
// Event_Source/Source_System contains "eoj", then grouping by
// Source_Record_ID. This function dumps exactly what that call chain
// actually returns for a known EOJ claim — plus a completely raw,
// assumption-free read of the sheet itself — so we can see the real
// column names/values before changing any code.
// ============================================================

function diagnoseEojTimelineRawDataForKnownClaim() {
  return diagnoseEojTimelineRawData('CLM-26N-0135-WTR');
}

function diagnoseEojTimelineRawData(claimId) {
  claimId = claimId || 'CLM-26N-0135-WTR';
  Logger.log('========================================================');
  Logger.log('diagnoseEojTimelineRawData: ' + claimId);
  Logger.log('========================================================');

  // ── 1. Exactly what getEojReportsForClaim_() sees ─────────────────────
  // (via getTimelineForClaim(), the same function it calls internally)
  const serviceResult = getTimelineForClaim(claimId);
  Logger.log('--- getTimelineForClaim(' + claimId + ') — full response ---');
  Logger.log(JSON.stringify(serviceResult, null, 2));

  const serviceRows = (serviceResult && serviceResult.success && serviceResult.data && Array.isArray(serviceResult.data.timeline))
    ? serviceResult.data.timeline
    : [];

  Logger.log('getTimelineForClaim row count: ' + serviceRows.length);

  serviceRows.forEach(function(row, i) {
    Logger.log('--- getTimelineForClaim row ' + i + ' — key fields ---');
    Logger.log('  Event_Type:       ' + JSON.stringify(row.Event_Type));
    Logger.log('  Event_Source:     ' + JSON.stringify(row.Event_Source));
    Logger.log('  Source_System:    ' + JSON.stringify(row.Source_System));
    Logger.log('  Source_Record_ID: ' + JSON.stringify(row.Source_Record_ID));
    Logger.log('  Actor:            ' + JSON.stringify(row.Actor));
    Logger.log('  Event_Date:       ' + JSON.stringify(row.Event_Date));
    Logger.log('  Created_At:       ' + JSON.stringify(row.Created_At));
    Logger.log('  Summary:          ' + JSON.stringify(row.Summary));
    Logger.log('  Detail:           ' + JSON.stringify(row.Detail));
    Logger.log('--- getTimelineForClaim row ' + i + ' — ALL keys (full object) ---');
    Logger.log(JSON.stringify(row, null, 2));
  });

  // ── 2. Completely raw sheet read — no header assumptions, no filters ──
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.timeline);

  if (!sheet) {
    Logger.log('RAW SHEET: sheet "' + CLAIM_SHEET_NAMES.timeline + '" not found in spreadsheet ' + CLAIM_FOUNDATION_SPREADSHEET_ID + '.');
    return { claimId: claimId, serviceRowCount: serviceRows.length, rawSheetFound: false };
  }

  const values = sheet.getDataRange().getValues();
  const literalRow1 = values.length ? values[0] : [];
  const detectedHeaderRowIndex = findTimelineHeaderRowIndex_(values);
  const detectedHeaders = values.length ? values[detectedHeaderRowIndex] : [];

  Logger.log('--- RAW SHEET structure ---');
  Logger.log('Sheet name: ' + sheet.getName());
  Logger.log('Total rows (incl. header): ' + values.length);
  Logger.log('Total columns: ' + (values.length ? values[0].length : 0));
  Logger.log('Literal row 1 (what getRows()/getHeaders() in SheetService.js assumes is the header row): ' + JSON.stringify(literalRow1));
  Logger.log('Header row detected by findTimelineHeaderRowIndex_() (0-based index, scans first 10 rows for Claim_ID): ' + detectedHeaderRowIndex);
  Logger.log('Headers at that detected row: ' + JSON.stringify(detectedHeaders));
  if (detectedHeaderRowIndex !== 0) {
    Logger.log('*** NOTE: detected header row is NOT row 1. getRows()/getHeaders() (used by getTimelineForClaim -> findRows) always reads row 1 as the header row and would misalign every column if this sheet\'s real header row is elsewhere. ***');
  }

  // Header-agnostic scan: any row where claimId literally appears anywhere
  // in the row, regardless of which column that is or what the header says.
  const rawMatches = [];
  for (let r = 1; r < values.length; r++) {
    const rowValues = values[r];
    const rowText = rowValues.map(function(v) { return String(v === null || v === undefined ? '' : v); }).join(' | ');
    if (rowText.indexOf(claimId) !== -1) {
      rawMatches.push({ sheetRowNumber: r + 1, values: rowValues });
    }
  }

  Logger.log('RAW SHEET rows where "' + claimId + '" appears anywhere in the row: ' + rawMatches.length);

  rawMatches.forEach(function(match) {
    Logger.log('--- RAW sheet row ' + match.sheetRowNumber + ' (every column, labeled using literal row 1 headers) ---');
    literalRow1.forEach(function(header, colIndex) {
      const label = header || ('(column ' + (colIndex + 1) + ' — blank header)');
      Logger.log('  [' + label + ']: ' + JSON.stringify(match.values[colIndex]));
    });
  });

  const summary = {
    claimId: claimId,
    serviceRowCount: serviceRows.length,
    rawTotalSheetRows: values.length - 1,
    rawMatchCount: rawMatches.length,
    literalRow1Headers: literalRow1,
    detectedHeaderRowIndex: detectedHeaderRowIndex,
    detectedHeaders: detectedHeaders
  };

  Logger.log('--- SUMMARY ---');
  Logger.log(JSON.stringify(summary, null, 2));

  return summary;
}

// ============================================================
// DIAGNOSTIC ONLY — follow-up to diagnoseEojTimelineRawData().
// Read-only, sheet-wide. Does not modify any data or touch
// getEojReportsForClaim_() / any production logic.
//
// Purpose: diagnoseEojTimelineRawData() showed that CLM-26N-0135-WTR's
// 4 EOJ-sourced Timeline_Events rows are test rows from
// eoj-processing-engine's testClaimsBridge() (Job Number "DIAG-001"),
// with empty Details on every one. Before deciding how to fix anything,
// check whether that's true sheet-wide: are there REAL (non-test) EOJ
// rows for other claims, and do any of them have Details populated?
// This answers "is the schema gap universal, or specific to old/test
// rows" using actual data instead of assumption.
// ============================================================

function diagnoseEojTimelineAcrossAllClaims() {
  Logger.log('========================================================');
  Logger.log('diagnoseEojTimelineAcrossAllClaims — sheet-wide EOJ scan');
  Logger.log('========================================================');

  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.timeline);

  if (!sheet) {
    Logger.log('Sheet "' + CLAIM_SHEET_NAMES.timeline + '" not found.');
    return { found: false };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : [];
  const idx = {};
  headers.forEach(function(h, i) { idx[String(h).trim()] = i; });

  Logger.log('Total rows (incl. header): ' + values.length);
  Logger.log('Headers: ' + JSON.stringify(headers));

  const sourceCol = idx['Source'];
  const eventTypeCol = idx['Event Type'];
  const detailsCol = idx['Details'];
  const claimIdCol = idx['Claim ID'];
  const jobNumberCol = idx['Job Number'];
  const actorCol = idx['Actor'];
  const dateCol = idx['Date'];
  const summaryCol = idx['Summary'];

  Logger.log('Column indexes — Source:' + sourceCol + ' EventType:' + eventTypeCol +
    ' Details:' + detailsCol + ' ClaimID:' + claimIdCol + ' JobNumber:' + jobNumberCol);

  if (sourceCol === undefined) {
    Logger.log('*** No "Source" column found — cannot scan by Source === "EOJ". Stopping. ***');
    return { found: true, sourceColumnPresent: false };
  }

  let eojSourceCount = 0;
  let eojSourceWithDetails = 0;
  const eojByClaim = {};
  const realEojSamples = [];
  const testEojSamples = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const sourceVal = String(row[sourceCol] || '');
    if (sourceVal.toLowerCase() !== 'eoj') { continue; }

    eojSourceCount++;
    const detailsVal = detailsCol !== undefined ? String(row[detailsCol] || '') : '';
    if (detailsVal.trim()) { eojSourceWithDetails++; }

    const claimId = claimIdCol !== undefined ? String(row[claimIdCol] || '') : '';
    const jobNumber = jobNumberCol !== undefined ? String(row[jobNumberCol] || '') : '';

    eojByClaim[claimId] = (eojByClaim[claimId] || 0) + 1;

    const record = {
      sheetRow: r + 1,
      claimId: claimId,
      jobNumber: jobNumber,
      eventType: eventTypeCol !== undefined ? row[eventTypeCol] : '',
      actor: actorCol !== undefined ? row[actorCol] : '',
      date: dateCol !== undefined ? row[dateCol] : '',
      summary: summaryCol !== undefined ? row[summaryCol] : '',
      detailsPresent: !!detailsVal.trim(),
      detailsPreview: detailsVal.slice(0, 160)
    };

    if (jobNumber === 'DIAG-001') {
      if (testEojSamples.length < 5) { testEojSamples.push(record); }
    } else if (realEojSamples.length < 20) {
      realEojSamples.push(record);
    }
  }

  const distinctClaimsWithEoj = Object.keys(eojByClaim).filter(function(c) { return c; });

  Logger.log('--- EOJ-sourced rows (Source === "EOJ") sheet-wide ---');
  Logger.log('Total EOJ-sourced rows: ' + eojSourceCount);
  Logger.log('EOJ-sourced rows with non-empty Details: ' + eojSourceWithDetails);
  Logger.log('Distinct Claim_IDs with at least one EOJ-sourced row: ' + distinctClaimsWithEoj.length);
  Logger.log('Claim_ID -> EOJ row count: ' + JSON.stringify(eojByClaim));

  Logger.log('--- Sample REAL (Job Number != "DIAG-001") EOJ rows (up to 20) ---');
  Logger.log(JSON.stringify(realEojSamples, null, 2));

  Logger.log('--- Sample TEST (Job Number === "DIAG-001") EOJ rows (up to 5) ---');
  Logger.log(JSON.stringify(testEojSamples, null, 2));

  const summary = {
    totalSheetRows: values.length - 1,
    eojSourceCount: eojSourceCount,
    eojSourceWithDetails: eojSourceWithDetails,
    distinctClaimsWithEoj: distinctClaimsWithEoj.length,
    eojByClaim: eojByClaim,
    realEojSampleCount: realEojSamples.length,
    testEojSampleCount: testEojSamples.length
  };

  Logger.log('--- SUMMARY ---');
  Logger.log(JSON.stringify(summary, null, 2));

  return summary;
}