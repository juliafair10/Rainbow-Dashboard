

/**
 * External link management service.
 * Rainbow Phase 4 - Claim Foundation
 */

function addExternalLink(claimId, payload) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const claimLookup = lookupClaim({ Claim_ID: claimId });
  if (!claimLookup.success) {
    return notFoundResponse('Claim not found.', { claimId: claimId });
  }

  const now = nowIso();
  const label = normalizeString(payload.Label || payload.Link_Name || payload.Link_Type || '');

  const link = {
    External_Link_ID: generateId(CLAIM_ID_PREFIXES.externalLink),
    Claim_ID: claimId,
    Financial_Track_ID: normalizeString(payload.Financial_Track_ID || payload.financialTrackId || ''),
    Link_Type: normalizeString(payload.Link_Type || payload.linkType || ''),
    URL: normalizeString(payload.URL || payload.url || ''),
    Label: label,
    Created_At: now,
    Updated_At: now,
    Notes: normalizeString(payload.Notes || payload.notes || '')
  };

  const result = appendRow(CLAIM_SHEET_NAMES.externalLinks, link);

  appendTimelineEvent(claimId, {
    Event_Type: 'External Link Added',
    Summary: link.Label,
    Detail: link.URL,
    Source_System: normalizeString(payload.Source_System || payload.sourceSystem || CLAIM_SERVICE.name),
    Source_Record_ID: link.External_Link_ID,
    Related_Financial_Track_ID: link.Financial_Track_ID,
    Related_Workflow: 'External Link Management',
    Is_Meaningful_Activity: true
  });

  writeServiceLog('addExternalLink', 'Success', 'External link added.', {
    claimId: claimId,
    sourceSystem: normalizeString(payload.Source_System || payload.sourceSystem || CLAIM_SERVICE.name),
    sourceRecordId: link.External_Link_ID,
    linkType: link.Link_Type,
    label: link.Label
  });

  return successResponse({
    externalLink: link,
    appendResult: result
  }, 'External link added successfully.');
}

function getExternalLinksForClaim(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.externalLinks, {
    Claim_ID: claimId
  });

  return successResponse({
    claimId: claimId,
    links: rows,
    count: rows.length
  }, 'External links retrieved.');
}

function getExternalLinksForFinancialTrack(financialTrackId) {
  if (!financialTrackId) {
    return validationErrorResponse(['Financial_Track_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.externalLinks, {
    Financial_Track_ID: financialTrackId
  });

  return successResponse({
    financialTrackId: financialTrackId,
    links: rows,
    count: rows.length
  }, 'Financial track external links retrieved.');
}

function updateExternalLink(externalLinkId, updates) {
  if (!externalLinkId) {
    return validationErrorResponse(['External_Link_ID is required.']);
  }

  const cleanUpdates = normalizeExternalLinkUpdates_(updates || {});
  cleanUpdates.Updated_At = nowIso();

  return updateRowByKey(
    CLAIM_SHEET_NAMES.externalLinks,
    'External_Link_ID',
    externalLinkId,
    cleanUpdates
  );
}

function normalizeExternalLinkUpdates_(updates) {
  const normalized = {};
  const raw = updates || {};

  Object.keys(raw).forEach(function(key) {
    const value = raw[key];

    if (value === undefined) {
      return;
    }

    switch (key) {
      case 'financialTrackId':
      case 'Financial_Track_ID':
        normalized.Financial_Track_ID = normalizeString(value);
        break;

      case 'linkType':
      case 'Link_Type':
        normalized.Link_Type = normalizeString(value);
        break;

      case 'url':
      case 'URL':
        normalized.URL = normalizeString(value);
        break;

      case 'label':
      case 'Link_Name':
      case 'Label':
        normalized.Label = normalizeString(value);
        break;

      case 'notes':
      case 'Notes':
        normalized.Notes = normalizeString(value);
        break;

      default:
        normalized[key] = value;
    }
  });

  return normalized;
}

// ---------------------------------------------------------------------------
// External_Links Claim_ID Association
// ---------------------------------------------------------------------------
// Insurance Intake writes wide-format rows to External_Links keyed by Job
// Number / Claim Number, with Claim_ID blank (Intake doesn't know Rainbow
// Claim_IDs). These functions backfill Claim_ID onto those rows so they are
// fully linked to their Claims row.
//
// Rules enforced here:
//   - Never overwrite a non-blank Claim_ID
//   - Never create new rows
//   - Never touch any column other than Claim_ID / Claim ID
//   - Never modify insurance-intake-automation
// ---------------------------------------------------------------------------

/**
 * Normalize an External_Links header name for resilient comparison.
 * Mirrors ClaimExternalLinkService.normalizeExternalLinkHeaderName_.
 * @param {*} value
 * @returns {string}
 */
function normalizeElhName_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Scan the first 10 rows of External_Links sheet data to find the header row.
 * Mirrors ClaimExternalLinkService.findExternalLinkHeaderRowIndex_.
 * @param {Array<Array>} values - raw sheet values from getDataRange().getValues()
 * @returns {number} zero-based row index of the header row
 */
function findElhHeaderRowIndex_(values) {
  for (var i = 0; i < Math.min(values.length, 10); i++) {
    var normalized = values[i].map(function(v) { return normalizeElhName_(v); });
    if (normalized.indexOf('claimid')     !== -1 ||
        normalized.indexOf('jobnumber')   !== -1 ||
        normalized.indexOf('url')         !== -1 ||
        normalized.indexOf('linktype')    !== -1) {
      return i;
    }
  }
  return 0;
}

/**
 * Build a column-index map for the External_Links sheet.
 * Returns -1 for any column not found.
 * @param {Array} headers - raw header row values
 * @returns {{ claimId: number, jobNumber: number, claimNumber: number }}
 */
function buildElhColumnIndexMap_(headers) {
  var normalized = headers.map(function(h) { return normalizeElhName_(h); });
  return {
    claimId:     normalized.indexOf('claimid'),
    jobNumber:   normalized.indexOf('jobnumber'),
    claimNumber: normalized.indexOf('claimnumber')
  };
}

/**
 * Normalize an identifier for comparison (uppercase, collapse whitespace).
 * @param {*} value
 * @returns {string}
 */
function normalizeElhKey_(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Associates a Claim_ID to matching External_Links rows where Claim_ID is
 * blank. Matches rows by Job_Number OR Claim_Number (either or both provided).
 * Does NOT overwrite non-blank Claim_IDs.
 * Does NOT append new rows.
 *
 * @param {string}  claimId     Rainbow Claim_ID to write (e.g. CLM-20260626-XXXXXX)
 * @param {string}  jobNumber   Job number to match against (optional if claimNumber provided)
 * @param {string}  claimNumber Claim number to match against (optional if jobNumber provided)
 * @param {boolean} dryRun      If true, no writes are performed; proposals are returned only
 * @returns {Object} { success, dryRun, rowsChecked, rowsMatched, rowsUpdated,
 *                     rowsSkippedExistingClaimId, proposals }
 */
function associateClaimIdToExternalLinkRows(claimId, jobNumber, claimNumber, dryRun) {
  var cleanClaimId    = String(claimId    || '').trim();
  var cleanJobNumber  = normalizeElhKey_(jobNumber);
  var cleanClaimNum   = normalizeElhKey_(claimNumber);

  if (!cleanClaimId) {
    return { success: false, message: 'claimId is required.' };
  }

  if (!cleanJobNumber && !cleanClaimNum) {
    return { success: false, message: 'At least one of jobNumber or claimNumber is required.' };
  }

  var sheet = SpreadsheetApp
    .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
    .getSheetByName(CLAIM_SHEET_NAMES.externalLinks);

  if (!sheet) {
    return { success: false, message: 'External_Links sheet not found.' };
  }

  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return {
      success: true, dryRun: !!dryRun,
      rowsChecked: 0, rowsMatched: 0, rowsUpdated: 0,
      rowsSkippedExistingClaimId: 0, proposals: []
    };
  }

  var headerRowIndex = findElhHeaderRowIndex_(values);
  var colMap = buildElhColumnIndexMap_(values[headerRowIndex]);

  if (colMap.claimId === -1) {
    return { success: false, message: 'Claim_ID / Claim ID column not found in External_Links sheet.' };
  }

  var dataRows = values.slice(headerRowIndex + 1);
  var rowsChecked = 0;
  var rowsMatched = 0;
  var rowsUpdated = 0;
  var rowsSkippedExistingClaimId = 0;
  var proposals = [];

  dataRows.forEach(function(row, relativeIndex) {
    rowsChecked++;

    var existingClaimId = String(row[colMap.claimId] || '').trim();

    // Never overwrite a non-blank Claim_ID.
    if (existingClaimId) {
      rowsSkippedExistingClaimId++;
      return;
    }

    var rowJobNumber  = colMap.jobNumber  !== -1 ? normalizeElhKey_(row[colMap.jobNumber])  : '';
    var rowClaimNum   = colMap.claimNumber !== -1 ? normalizeElhKey_(row[colMap.claimNumber]) : '';

    var jobMatch   = !!(cleanJobNumber && rowJobNumber  && rowJobNumber  === cleanJobNumber);
    var claimMatch = !!(cleanClaimNum  && rowClaimNum   && rowClaimNum   === cleanClaimNum);

    if (!jobMatch && !claimMatch) {
      return;
    }

    rowsMatched++;

    // Sheet row number: 1-based index.
    // headerRowIndex (0-based) + 1 to get to first data row (1-based) + relativeIndex (0-based).
    var sheetRowNumber = headerRowIndex + 2 + relativeIndex;

    proposals.push({
      sheetRow:       sheetRowNumber,
      rowJobNumber:   rowJobNumber,
      rowClaimNumber: rowClaimNum,
      matchedBy:      jobMatch ? 'jobNumber' : 'claimNumber',
      claimIdToWrite: cleanClaimId
    });

    if (!dryRun) {
      sheet.getRange(sheetRowNumber, colMap.claimId + 1).setValue(cleanClaimId);
      rowsUpdated++;
    }
  });

  if (!dryRun && rowsUpdated > 0) {
    SpreadsheetApp.flush();
  }

  return {
    success: true,
    dryRun:                    !!dryRun,
    rowsChecked:               rowsChecked,
    rowsMatched:               rowsMatched,
    rowsUpdated:               dryRun ? 0 : rowsUpdated,
    rowsSkippedExistingClaimId: rowsSkippedExistingClaimId,
    proposals:                 proposals
  };
}

// ---------------------------------------------------------------------------
// Batch backfill
// ---------------------------------------------------------------------------

/**
 * Dry-run preview: shows which External_Links rows would have Claim_ID
 * written, without making any changes.
 */
function previewBackfillExternalLinkClaimIds() {
  return runExternalLinkClaimIdBackfill_(true);
}

/**
 * Backfills Claim_IDs onto External_Links rows where Claim_ID is blank
 * and Job_Number or Claim_Number matches a known Claims row.
 * Reads both sheets once; writes only to blank Claim_ID cells.
 */
function backfillExternalLinkClaimIds() {
  return runExternalLinkClaimIdBackfill_(false);
}

/**
 * @private
 * Core batch backfill logic.
 * @param {boolean} dryRun
 */
function runExternalLinkClaimIdBackfill_(dryRun) {
  var ss = SpreadsheetApp.openById(CLAIMS_DATABASE_SPREADSHEET_ID);

  // ── Read Claims sheet ───────────────────────────────────────────────────
  var claimsSheet = ss.getSheetByName(CLAIM_SHEET_NAMES.claims);

  if (!claimsSheet) {
    return { success: false, message: 'Claims sheet not found.' };
  }

  var claimsValues = claimsSheet.getDataRange().getValues();

  if (claimsValues.length < 2) {
    return { success: false, message: 'Claims sheet is empty.' };
  }

  var claimsNormalizedHeaders = claimsValues[0].map(function(h) {
    return normalizeElhName_(h);
  });

  var claimsClaimIdCol     = claimsNormalizedHeaders.indexOf('claimid');
  var claimsJobNumberCol   = claimsNormalizedHeaders.indexOf('jobnumber');
  var claimsClaimNumberCol = claimsNormalizedHeaders.indexOf('claimnumber');

  if (claimsClaimIdCol === -1) {
    return { success: false, message: 'Claim_ID column not found in Claims sheet.' };
  }

  var claimsChecked  = 0;
  var eligibleClaims = [];

  claimsValues.slice(1).forEach(function(row) {
    claimsChecked++;

    var claimId     = String(row[claimsClaimIdCol]     || '').trim();
    var jobNumber   = claimsJobNumberCol   !== -1 ? normalizeElhKey_(row[claimsJobNumberCol])   : '';
    var claimNumber = claimsClaimNumberCol !== -1 ? normalizeElhKey_(row[claimsClaimNumberCol]) : '';

    if (claimId && (jobNumber || claimNumber)) {
      eligibleClaims.push({
        claimId:     claimId,
        jobNumber:   jobNumber,
        claimNumber: claimNumber
      });
    }
  });

  // ── Build lookup indexes from Claims rows ───────────────────────────────
  var byJobNumber   = {};
  var byClaimNumber = {};

  eligibleClaims.forEach(function(c) {
    if (c.jobNumber)   { byJobNumber[c.jobNumber]     = c; }
    if (c.claimNumber) { byClaimNumber[c.claimNumber] = c; }
  });

  // ── Read External_Links sheet ───────────────────────────────────────────
  var elSheet = ss.getSheetByName(CLAIM_SHEET_NAMES.externalLinks);

  if (!elSheet) {
    return { success: false, message: 'External_Links sheet not found.' };
  }

  var elValues = elSheet.getDataRange().getValues();

  if (elValues.length < 2) {
    return {
      success: true, dryRun: dryRun, generatedAt: new Date().toISOString(),
      claimsChecked: claimsChecked, eligibleClaims: eligibleClaims.length,
      externalLinkRowsChecked: 0, rowsEligible: 0, rowsUpdated: 0,
      rowsSkippedExistingClaimId: 0, sampleProposals: []
    };
  }

  var elHeaderRowIndex = findElhHeaderRowIndex_(elValues);
  var elColMap         = buildElhColumnIndexMap_(elValues[elHeaderRowIndex]);

  if (elColMap.claimId === -1) {
    return { success: false, message: 'Claim_ID / Claim ID column not found in External_Links sheet.' };
  }

  var elDataRows   = elValues.slice(elHeaderRowIndex + 1);
  var elRowsChecked = 0;
  var rowsEligible  = 0;
  var rowsUpdated   = 0;
  var rowsSkippedExistingClaimId = 0;
  var proposals     = [];

  elDataRows.forEach(function(row, relativeIndex) {
    elRowsChecked++;

    var existingClaimId = String(row[elColMap.claimId] || '').trim();

    if (existingClaimId) {
      rowsSkippedExistingClaimId++;
      return;
    }

    var rowJobNumber  = elColMap.jobNumber  !== -1 ? normalizeElhKey_(row[elColMap.jobNumber])  : '';
    var rowClaimNum   = elColMap.claimNumber !== -1 ? normalizeElhKey_(row[elColMap.claimNumber]) : '';

    var matchedClaim = null;
    var matchedBy    = '';

    if (rowJobNumber && byJobNumber[rowJobNumber]) {
      matchedClaim = byJobNumber[rowJobNumber];
      matchedBy    = 'jobNumber';
    } else if (rowClaimNum && byClaimNumber[rowClaimNum]) {
      matchedClaim = byClaimNumber[rowClaimNum];
      matchedBy    = 'claimNumber';
    }

    if (!matchedClaim) {
      return;
    }

    rowsEligible++;

    var sheetRowNumber = elHeaderRowIndex + 2 + relativeIndex;

    proposals.push({
      sheetRow:       sheetRowNumber,
      rowJobNumber:   rowJobNumber,
      rowClaimNumber: rowClaimNum,
      matchedBy:      matchedBy,
      claimIdToWrite: matchedClaim.claimId
    });

    if (!dryRun) {
      elSheet.getRange(sheetRowNumber, elColMap.claimId + 1).setValue(matchedClaim.claimId);
      rowsUpdated++;
    }
  });

  if (!dryRun && rowsUpdated > 0) {
    SpreadsheetApp.flush();
  }

  var summary = {
    success:                    true,
    dryRun:                     dryRun,
    generatedAt:                new Date().toISOString(),
    claimsChecked:              claimsChecked,
    eligibleClaims:             eligibleClaims.length,
    externalLinkRowsChecked:    elRowsChecked,
    rowsEligible:               rowsEligible,
    rowsUpdated:                dryRun ? 0 : rowsUpdated,
    rowsSkippedExistingClaimId: rowsSkippedExistingClaimId,
    sampleProposals:            proposals.slice(0, 10)
  };

  Logger.log(
    '[ExternalLinkClaimIdBackfill] ' +
    (dryRun ? 'PREVIEW' : 'RUN') +
    ': claimsChecked=' + claimsChecked +
    ' eligible=' + eligibleClaims.length +
    ' elRows=' + elRowsChecked +
    ' rowsEligible=' + rowsEligible +
    ' rowsUpdated=' + (dryRun ? '(dryRun)' : rowsUpdated) +
    ' skippedExistingClaimId=' + rowsSkippedExistingClaimId
  );

  return summary;
}

// ---------------------------------------------------------------------------

function testAddFusionLink() {
  return addExternalLink('CLM-20260605-821496', {
    Link_Type: 'Fusion',
    Label: 'Fusion Claim File',
    URL: 'https://fusion.example.com/claim/123',
    Source_System: 'claims-service test',
    Notes: 'Test Fusion link.'
  });
}

function testAddXactimateLink() {
  return addExternalLink('CLM-20260605-821496', {
    Link_Type: 'Xactimate',
    Label: 'Xactimate Estimate',
    URL: 'https://xactimate.example.com/estimate/123',
    Source_System: 'claims-service test',
    Notes: 'Test Xactimate link.'
  });
}

function testHardWriteExternalLinkRow() {
  const now = nowIso();

  const link = {
    External_Link_ID: generateId(CLAIM_ID_PREFIXES.externalLink),
    Claim_ID: 'CLM-20260605-821496',
    Financial_Track_ID: '',
    Link_Type: 'Fusion',
    URL: 'https://fusion.example.com/claim/123',
    Label: 'Fusion Claim File',
    Created_At: now,
    Updated_At: now,
    Notes: 'Hard write external link test.'
  };

  return appendRow(CLAIM_SHEET_NAMES.externalLinks, link);
}

function testGetExternalLinks() {
  return getExternalLinksForClaim('CLM-20260605-821496');
}