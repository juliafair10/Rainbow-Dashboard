

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

/**
 * Claims Service intake adapter for Insurance Intake external links.
 *
 * Accepts the wide-format payload produced by insurance-intake-automation
 * and upserts it into the existing External_Links wide schema. This keeps
 * Claims Service as the canonical writer without changing the current sheet
 * structure during the migration.
 *
 * @param {Object} payload Intake link payload from insurance-intake-automation.
 * @returns {Object} Structured service response.
 */
function saveIntakeExternalLinks(payload) {
  payload = payload || {};

  const cleanPayload = normalizeIntakeExternalLinksPayload_(payload);
  const warnings = [];

  if (!cleanPayload.claimId && !cleanPayload.jobNumber && !cleanPayload.claimNumber) {
    return validationErrorResponse(['At least one identifier is required: claimId, jobNumber, or claimNumber.']);
  }

  if (cleanPayload.nonBlankLinkTypes.length === 0) {
    warnings.push('No external link URLs were provided. No External_Links row was created or updated.');
    writeServiceLog('saveIntakeExternalLinks', 'Skipped', 'No intake external links provided.', {
      claimId: cleanPayload.claimId,
      jobNumber: cleanPayload.jobNumber,
      claimNumber: cleanPayload.claimNumber,
      source: cleanPayload.source
    });

    return successResponse({
      mode: 'wide-upsert',
      wroteToDatabase: false,
      claimId: cleanPayload.claimId,
      jobNumber: cleanPayload.jobNumber,
      claimNumber: cleanPayload.claimNumber,
      carrier: cleanPayload.carrier,
      submittedLinks: cleanPayload.submittedLinks,
      linkTypesReceived: cleanPayload.nonBlankLinkTypes,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      matchedRow: null,
      warnings: warnings
    }, 'No external link URLs were provided.');
  }

  const ss = SpreadsheetApp.openById(CLAIMS_DATABASE_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.externalLinks);

  if (!sheet) {
    return errorResponse('External_Links sheet not found.', {
      sheetName: CLAIM_SHEET_NAMES.externalLinks
    });
  }

  const values = sheet.getDataRange().getValues();
  const headerRowIndex = values.length ? findElhHeaderRowIndex_(values) : 0;
  const headers = values.length ? values[headerRowIndex] : [];
  const columnMap = buildIntakeExternalLinksWideColumnMap_(headers);

  const requiredColumnKeys = ['claimId', 'jobNumber', 'claimNumber'];
  const missingIdentityColumns = requiredColumnKeys.filter(function(key) {
    return columnMap[key] === -1;
  });

  if (missingIdentityColumns.length === requiredColumnKeys.length) {
    return errorResponse('External_Links sheet is missing identity columns.', {
      missingIdentityColumns: missingIdentityColumns,
      headers: headers
    });
  }

  const rowPayload = buildIntakeExternalLinksWideRowPayload_(cleanPayload, columnMap);
  const matchedRow = findMatchingIntakeExternalLinksWideRow_(values, headerRowIndex, columnMap, cleanPayload);
  const allowCreate = payload.allowCreate !== false && payload.preventCreate !== true;

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let changedColumns = [];
  let sheetRowNumber = null;

  if (matchedRow) {
    sheetRowNumber = matchedRow.sheetRowNumber;
    changedColumns = updateIntakeExternalLinksWideRow_(sheet, sheetRowNumber, values[matchedRow.rowIndex], rowPayload, columnMap);

    if (changedColumns.length > 0) {
      updatedCount = 1;
    } else {
      skippedCount = 1;
    }
  } else if (allowCreate) {
    const newRow = headers.map(function() { return ''; });

    Object.keys(rowPayload).forEach(function(key) {
      const columnIndex = columnMap[key];
      if (columnIndex !== -1 && rowPayload[key]) {
        newRow[columnIndex] = rowPayload[key];
      }
    });

    sheet.appendRow(newRow);
    sheetRowNumber = sheet.getLastRow();
    createdCount = 1;
    changedColumns = Object.keys(rowPayload).filter(function(key) {
      return columnMap[key] !== -1 && !!rowPayload[key];
    });
  } else {
    skippedCount = 1;
    warnings.push('Shadow mode: no matching row found, so no row was created.');
  }

  if (createdCount || updatedCount) {
    SpreadsheetApp.flush();
  }

  writeServiceLog('saveIntakeExternalLinks', createdCount ? 'Created' : (updatedCount ? 'Updated' : 'Skipped'), 'Intake external links wide upsert completed.', {
    claimId: cleanPayload.claimId,
    jobNumber: cleanPayload.jobNumber,
    claimNumber: cleanPayload.claimNumber,
    carrier: cleanPayload.carrier,
    source: cleanPayload.source,
    linkTypesReceived: cleanPayload.nonBlankLinkTypes.join(', '),
    createdCount: createdCount,
    updatedCount: updatedCount,
    skippedCount: skippedCount,
    sheetRowNumber: sheetRowNumber,
    changedColumns: changedColumns.join(', ')
  });

  return successResponse({
    mode: 'wide-upsert',
    wroteToDatabase: !!(createdCount || updatedCount),
    claimId: cleanPayload.claimId,
    jobNumber: cleanPayload.jobNumber,
    claimNumber: cleanPayload.claimNumber,
    carrier: cleanPayload.carrier,
    submittedLinks: cleanPayload.submittedLinks,
    linkTypesReceived: cleanPayload.nonBlankLinkTypes,
    createdCount: createdCount,
    updatedCount: updatedCount,
    skippedCount: skippedCount,
    matchedRow: matchedRow ? {
      sheetRowNumber: matchedRow.sheetRowNumber,
      matchedBy: matchedRow.matchedBy
    } : null,
    sheetRowNumber: sheetRowNumber,
    changedColumns: changedColumns,
    allowCreate: allowCreate,
    warnings: warnings
  }, createdCount ? 'Intake external links row created.' : (updatedCount ? 'Intake external links row updated.' : 'Intake external links row already current.'));
}

function normalizeIntakeExternalLinksPayload_(payload) {
  const submittedLinks = {
    fusionUrl: normalizeString(payload.fusionUrl || payload.Fusion_URL || payload['Fusion URL'] || ''),
    fusionJobId: normalizeString(payload.fusionJobId || payload.Fusion_Job_ID || payload['Fusion Job ID'] || ''),
    driveFolder: normalizeString(payload.driveFolder || payload.driveFolderUrl || payload.Drive_Folder || payload['Drive Folder'] || ''),
    xactAnalysis: normalizeString(payload.xactAnalysis || payload.XactAnalysis || payload.Xactimate || payload['XactAnalysis'] || ''),
    symbility: normalizeString(payload.symbility || payload.Symbility || ''),
    claimX: normalizeString(payload.claimX || payload.ClaimX || ''),
    otherLinks: normalizeString(payload.otherLinks || payload.Other_Links || payload['Other Links'] || '')
  };

  return {
    claimId: normalizeString(payload.claimId || payload.Claim_ID || payload['Claim ID'] || ''),
    jobNumber: normalizeString(payload.jobNumber || payload.Job_Number || payload['Job Number'] || ''),
    claimNumber: normalizeString(payload.claimNumber || payload.Claim_Number || payload['Claim Number'] || ''),
    carrier: normalizeString(payload.carrier || payload.Carrier || ''),
    source: normalizeString(payload.source || payload.Source_System || payload.Source || 'Insurance Intake'),
    submittedLinks: submittedLinks,
    nonBlankLinkTypes: Object.keys(submittedLinks).filter(function(key) {
      return !!submittedLinks[key];
    })
  };
}

function buildIntakeExternalLinksWideColumnMap_(headers) {
  const normalized = headers.map(function(header) {
    return normalizeElhName_(header);
  });

  return {
    claimId: normalized.indexOf('claimid'),
    jobNumber: normalized.indexOf('jobnumber'),
    fusionUrl: normalized.indexOf('fusionurl'),
    fusionJobId: normalized.indexOf('fusionjobid'),
    driveFolder: normalized.indexOf('drivefolder'),
    xactAnalysis: normalized.indexOf('xactanalysis'),
    symbility: normalized.indexOf('symbility'),
    claimX: normalized.indexOf('claimx'),
    otherLinks: normalized.indexOf('otherlinks'),
    claimNumber: normalized.indexOf('claimnumber'),
    carrier: normalized.indexOf('carrier')
  };
}

function buildIntakeExternalLinksWideRowPayload_(cleanPayload, columnMap) {
  const rowPayload = {
    claimId: cleanPayload.claimId,
    jobNumber: cleanPayload.jobNumber,
    fusionUrl: cleanPayload.submittedLinks.fusionUrl,
    fusionJobId: cleanPayload.submittedLinks.fusionJobId,
    driveFolder: cleanPayload.submittedLinks.driveFolder,
    xactAnalysis: cleanPayload.submittedLinks.xactAnalysis,
    symbility: cleanPayload.submittedLinks.symbility,
    claimX: cleanPayload.submittedLinks.claimX,
    otherLinks: cleanPayload.submittedLinks.otherLinks,
    claimNumber: cleanPayload.claimNumber,
    carrier: cleanPayload.carrier
  };

  Object.keys(rowPayload).forEach(function(key) {
    if (columnMap[key] === -1) {
      delete rowPayload[key];
    }
  });

  return rowPayload;
}

function findMatchingIntakeExternalLinksWideRow_(values, headerRowIndex, columnMap, cleanPayload) {
  const cleanClaimId = normalizeElhKey_(cleanPayload.claimId);
  const cleanJobNumber = normalizeElhKey_(cleanPayload.jobNumber);
  const cleanClaimNumber = normalizeElhKey_(cleanPayload.claimNumber);

  for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const rowClaimId = columnMap.claimId !== -1 ? normalizeElhKey_(row[columnMap.claimId]) : '';
    const rowJobNumber = columnMap.jobNumber !== -1 ? normalizeElhKey_(row[columnMap.jobNumber]) : '';
    const rowClaimNumber = columnMap.claimNumber !== -1 ? normalizeElhKey_(row[columnMap.claimNumber]) : '';

    if (cleanClaimId && rowClaimId && cleanClaimId === rowClaimId) {
      return {
        rowIndex: rowIndex,
        sheetRowNumber: rowIndex + 1,
        matchedBy: 'claimId'
      };
    }

    if (cleanJobNumber && rowJobNumber && cleanJobNumber === rowJobNumber) {
      return {
        rowIndex: rowIndex,
        sheetRowNumber: rowIndex + 1,
        matchedBy: 'jobNumber'
      };
    }

    if (cleanClaimNumber && rowClaimNumber && cleanClaimNumber === rowClaimNumber) {
      return {
        rowIndex: rowIndex,
        sheetRowNumber: rowIndex + 1,
        matchedBy: 'claimNumber'
      };
    }
  }

  return null;
}

function updateIntakeExternalLinksWideRow_(sheet, sheetRowNumber, existingRow, rowPayload, columnMap) {
  const changedColumns = [];

  Object.keys(rowPayload).forEach(function(key) {
    const columnIndex = columnMap[key];
    const nextValue = rowPayload[key];

    if (columnIndex === -1 || !nextValue) {
      return;
    }

    const currentValue = normalizeString(existingRow[columnIndex] || '');

    if (currentValue === nextValue) {
      return;
    }

    sheet.getRange(sheetRowNumber, columnIndex + 1).setValue(nextValue);
    changedColumns.push(key);
  });

  return changedColumns;
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
// Enrich Claims.Claim_Number from External_Links.Claim Number
// ---------------------------------------------------------------------------

/**
 * Dry-run preview: shows which Claims rows would have Claim_Number updated
 * from External_Links, without making any changes.
 */
function previewEnrichClaimNumbersFromExternalLinks() {
  return runEnrichClaimNumbersFromExternalLinks_(true);
}

/**
 * Apply: writes real insurance claim numbers to Claims rows where:
 *   - Claim_Number is blank or equals Job_Number (fallback)
 *   - External_Links has a real Claim Number for the same Job_Number
 * Only the Claim_Number cell is touched per row.
 * Flushes once at the end.
 *
 * After running this, call previewBackfillExternalLinkClaimIds() and
 * backfillExternalLinkClaimIds() to pick up any improved EL matches.
 */
function enrichClaimNumbersFromExternalLinks() {
  return runEnrichClaimNumbersFromExternalLinks_(false);
}

/**
 * @private
 * Core logic for enriching Claims.Claim_Number from External_Links.Claim Number.
 * @param {boolean} dryRun
 */
function runEnrichClaimNumbersFromExternalLinks_(dryRun) {
  var ss = SpreadsheetApp.openById(CLAIMS_DATABASE_SPREADSHEET_ID);

  // ── Read External_Links sheet ─────────────────────────────────────────────
  var elSheet = ss.getSheetByName(CLAIM_SHEET_NAMES.externalLinks);

  if (!elSheet) {
    return { success: false, message: 'External_Links sheet not found.' };
  }

  var elValues = elSheet.getDataRange().getValues();

  if (elValues.length < 2) {
    return { success: false, message: 'External_Links sheet has no data rows.' };
  }

  var elHeaderRowIndex = findElhHeaderRowIndex_(elValues);
  var elColMap         = buildElhColumnIndexMap_(elValues[elHeaderRowIndex]);

  if (elColMap.jobNumber === -1) {
    return { success: false, message: 'Job Number / Job_Number column not found in External_Links sheet.' };
  }

  if (elColMap.claimNumber === -1) {
    return {
      success: false,
      message: 'Claim Number column not found in External_Links sheet. ' +
               'Run ensureExternalLinksClaimNumberColumn() in insurance-intake-automation first.'
    };
  }

  // ── Build External_Links lookup: jobNumber → { claimNumber } ─────────────
  // Conflict detection: two rows with same jobNumber but different claimNumbers → skip both.
  var elByJobNumber  = {};  // normalizedJobNumber → rawClaimNumber string
  var elConflicts    = {};  // normalizedJobNumber → { first, second }
  var elRowsChecked  = 0;

  elValues.slice(elHeaderRowIndex + 1).forEach(function(row) {
    elRowsChecked++;

    var jobNum   = normalizeElhKey_(row[elColMap.jobNumber]);
    var claimNum = String(row[elColMap.claimNumber] || '').trim();

    if (!jobNum || !claimNum) {
      return;
    }

    // Skip if claimNum equals jobNum (fallback contamination in External_Links).
    if (normalizeElhKey_(claimNum) === jobNum) {
      return;
    }

    if (elConflicts[jobNum]) {
      // Already conflicted — ignore further rows.
      return;
    }

    if (elByJobNumber[jobNum]) {
      // Second row for same job number.
      if (normalizeElhKey_(elByJobNumber[jobNum]) !== normalizeElhKey_(claimNum)) {
        // Disagreement → conflict; remove entry.
        elConflicts[jobNum] = {
          first:  elByJobNumber[jobNum],
          second: claimNum
        };
        delete elByJobNumber[jobNum];
      }
      // Exact match → keep existing entry (idempotent, no change needed).
      return;
    }

    elByJobNumber[jobNum] = claimNum;
  });

  // ── Read Claims sheet ─────────────────────────────────────────────────────
  var claimsSheet = ss.getSheetByName(CLAIM_SHEET_NAMES.claims);

  if (!claimsSheet) {
    return { success: false, message: 'Claims sheet not found.' };
  }

  var claimsValues = claimsSheet.getDataRange().getValues();

  if (claimsValues.length < 2) {
    return { success: false, message: 'Claims sheet has no data rows.' };
  }

  var colMap = buildClaimsColumnMap_(claimsValues);

  if (colMap.claimNumber === -1) {
    return { success: false, message: 'Claim_Number column not found in Claims sheet.' };
  }

  if (colMap.jobNumber === -1) {
    return { success: false, message: 'Job_Number column not found in Claims sheet.' };
  }

  // ── Scan Claims rows, build proposals ────────────────────────────────────
  var claimsChecked               = 0;
  var fallbackClaimNumbersFound   = 0;
  var skippedNoJobNumber          = 0;
  var skippedNotFallback          = 0;
  var skippedNoElRow              = 0;
  var skippedConflict             = 0;
  var proposals                   = [];

  claimsValues.slice(1).forEach(function(row, relativeIndex) {
    claimsChecked++;

    var jobNumber           = normalizeElhKey_(row[colMap.jobNumber]);
    var currentClaimNumber  = String(row[colMap.claimNumber] || '').trim();
    var claimId             = colMap.claimId !== -1 ? String(row[colMap.claimId] || '').trim() : '';
    var customerName        = colMap.customerName !== -1 ? String(row[colMap.customerName] || '').trim() : '';
    var normCurrentClaim    = normalizeElhKey_(currentClaimNumber);

    // Guard 1: require Job_Number.
    if (!jobNumber) {
      skippedNoJobNumber++;
      return;
    }

    // Guard 2: current Claim_Number must be blank or equal to Job_Number (fallback).
    var isFallback = !currentClaimNumber || (normCurrentClaim === jobNumber);

    if (!isFallback) {
      skippedNotFallback++;
      return;
    }

    fallbackClaimNumbersFound++;

    // Guard 3: must have a non-conflicted External_Links entry for this job number.
    if (elConflicts[jobNumber]) {
      skippedConflict++;
      return;
    }

    if (!elByJobNumber[jobNumber]) {
      skippedNoElRow++;
      return;
    }

    // The EL entry was already filtered for blank and equals-job-number at build time.
    var proposedClaimNumber = elByJobNumber[jobNumber];

    // Sheet row is 1-based: row 1 is header, first data row is 2.
    var sheetRowNumber = relativeIndex + 2;

    proposals.push({
      sheetRow:            sheetRowNumber,
      claimId:             claimId,
      jobNumber:           jobNumber,
      currentClaimNumber:  currentClaimNumber,
      proposedClaimNumber: proposedClaimNumber,
      customerName:        customerName
    });
  });

  // ── Apply writes (real run only) ──────────────────────────────────────────
  var rowsUpdated = 0;

  if (!dryRun) {
    proposals.forEach(function(p) {
      claimsSheet.getRange(p.sheetRow, colMap.claimNumber + 1).setValue(p.proposedClaimNumber);
      rowsUpdated++;
    });

    if (rowsUpdated > 0) {
      SpreadsheetApp.flush();
    }
  }

  var summary = {
    success:                        true,
    dryRun:                         dryRun,
    generatedAt:                    new Date().toISOString(),
    claimsChecked:                  claimsChecked,
    fallbackClaimNumbersFound:      fallbackClaimNumbersFound,
    externalLinkRowsChecked:        elRowsChecked,
    jobNumbersWithStoredClaimNumbers: Object.keys(elByJobNumber).length,
    eligibleUpdates:                proposals.length,
    conflicts:                      Object.keys(elConflicts).length,
    rowsUpdated:                    dryRun ? 0 : rowsUpdated,
    skippedNoJobNumber:             skippedNoJobNumber,
    skippedNotFallback:             skippedNotFallback,
    skippedNoElRow:                 skippedNoElRow,
    skippedConflict:                skippedConflict,
    sampleProposals:                proposals.slice(0, 10)
  };

  Logger.log(
    '[EnrichClaimNumbersFromExternalLinks] ' +
    (dryRun ? 'PREVIEW' : 'RUN') +
    ': claimsChecked=' + claimsChecked +
    ' fallback=' + fallbackClaimNumbersFound +
    ' elRows=' + elRowsChecked +
    ' elJobsWithClaimNumbers=' + Object.keys(elByJobNumber).length +
    ' eligible=' + proposals.length +
    ' conflicts=' + Object.keys(elConflicts).length +
    ' rowsUpdated=' + (dryRun ? '(dryRun)' : rowsUpdated) +
    ' skippedNotFallback=' + skippedNotFallback +
    ' skippedNoElRow=' + skippedNoElRow +
    ' skippedConflict=' + skippedConflict
  );

  return summary;
}

// ---------------------------------------------------------------------------
// Carrier enrichment: External_Links → Claims
// ---------------------------------------------------------------------------

/**
 * For every Claims row where Carrier is blank and Job_Number matches an
 * External_Links row that carries a non-blank Carrier value, writes the
 * carrier name into the Claims row.
 *
 * Safety guards (mirrors step 4 pattern):
 *   - Never overwrites a non-blank Claims.Carrier value.
 *   - Skips Claims rows where Job_Number is blank.
 *   - Skips EL rows where Carrier is blank.
 *   - Conflict detection: if two EL rows for the same job number disagree on
 *     carrier, both are excluded.
 *
 * @param {boolean} [dryRun=false]
 * @returns {Object} enrichment summary
 */
function runEnrichClaimFieldsFromExternalLinks_(dryRun) {
  var ss = SpreadsheetApp.openById(CLAIMS_DATABASE_SPREADSHEET_ID);

  // ── Read External_Links sheet ─────────────────────────────────────────────
  var elSheet = ss.getSheetByName(CLAIM_SHEET_NAMES.externalLinks);

  if (!elSheet) {
    return { success: false, message: 'External_Links sheet not found.' };
  }

  var elValues = elSheet.getDataRange().getValues();

  if (elValues.length < 2) {
    return { success: true, message: 'External_Links sheet has no data rows.', rowsUpdated: 0, eligibleUpdates: 0 };
  }

  var elHeaderRowIndex = findElhHeaderRowIndex_(elValues);
  var elHeaders        = elValues[elHeaderRowIndex].map(function(h) { return String(h || '').trim().toLowerCase(); });
  var elColMap         = buildElhColumnIndexMap_(elValues[elHeaderRowIndex]);

  // Find the Carrier column in External_Links (written by insurance-intake-automation Fix B).
  var elCarrierCol = elHeaders.indexOf('carrier');

  if (elCarrierCol === -1) {
    // Carrier column not yet present — Fix B has not run or the sheet predates it.
    // Return gracefully so the morning automation is not blocked.
    Logger.log('[EnrichClaimFields] Carrier column not found in External_Links — skipping carrier enrichment.');
    return { success: true, message: 'Carrier column not found in External_Links; no enrichment performed.', rowsUpdated: 0, eligibleUpdates: 0 };
  }

  if (elColMap.jobNumber === -1) {
    return { success: false, message: 'Job Number column not found in External_Links sheet.' };
  }

  // ── Build EL lookup: normalizedJobNumber → carrier ────────────────────────
  // Conflict: two rows with same job number but different carrier values → skip both.
  var elByJobNumber  = {};   // normalizedJobNumber → carrierString
  var elConflicts    = {};   // normalizedJobNumber → true

  elValues.slice(elHeaderRowIndex + 1).forEach(function(row) {
    var jobNum  = normalizeElhKey_(row[elColMap.jobNumber]);
    var carrier = String(row[elCarrierCol] || '').trim();

    if (!jobNum || !carrier) {
      return;
    }

    if (elConflicts[jobNum]) {
      return;
    }

    if (elByJobNumber[jobNum]) {
      if (elByJobNumber[jobNum].toUpperCase() !== carrier.toUpperCase()) {
        elConflicts[jobNum] = true;
        delete elByJobNumber[jobNum];
      }
      // Exact match (case-insensitive) → keep existing; no conflict.
      return;
    }

    elByJobNumber[jobNum] = carrier;
  });

  // ── Read Claims sheet ─────────────────────────────────────────────────────
  var claimsSheet = ss.getSheetByName(CLAIM_SHEET_NAMES.claims);

  if (!claimsSheet) {
    return { success: false, message: 'Claims sheet not found.' };
  }

  var claimsValues = claimsSheet.getDataRange().getValues();

  if (claimsValues.length < 2) {
    return { success: true, message: 'Claims sheet has no data rows.', rowsUpdated: 0, eligibleUpdates: 0 };
  }

  // Build a column map that includes Carrier in addition to the standard fields.
  var claimsHeaders = claimsValues[0].map(function(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  });

  var claimsColMap = {
    claimId:      claimsHeaders.indexOf('claimid'),
    jobNumber:    claimsHeaders.indexOf('jobnumber'),
    customerName: claimsHeaders.indexOf('customername'),
    carrier:      claimsHeaders.indexOf('carrier')
  };

  if (claimsColMap.jobNumber === -1) {
    return { success: false, message: 'Job_Number column not found in Claims sheet.' };
  }

  if (claimsColMap.carrier === -1) {
    return { success: false, message: 'Carrier column not found in Claims sheet.' };
  }

  // ── Scan Claims rows, build proposals ─────────────────────────────────────
  var claimsChecked      = 0;
  var skippedNoJobNumber = 0;
  var skippedHasCarrier  = 0;
  var skippedNoElRow     = 0;
  var skippedConflict    = 0;
  var proposals          = [];

  claimsValues.slice(1).forEach(function(row, relativeIndex) {
    claimsChecked++;

    var jobNumber       = normalizeElhKey_(row[claimsColMap.jobNumber]);
    var currentCarrier  = String(row[claimsColMap.carrier] || '').trim();
    var claimId         = claimsColMap.claimId !== -1 ? String(row[claimsColMap.claimId] || '').trim() : '';
    var customerName    = claimsColMap.customerName !== -1 ? String(row[claimsColMap.customerName] || '').trim() : '';

    if (!jobNumber) {
      skippedNoJobNumber++;
      return;
    }

    // Guard: never overwrite an existing carrier value.
    if (currentCarrier) {
      skippedHasCarrier++;
      return;
    }

    if (elConflicts[jobNumber]) {
      skippedConflict++;
      return;
    }

    if (!elByJobNumber[jobNumber]) {
      skippedNoElRow++;
      return;
    }

    // Sheet row is 1-based: row 1 is header, first data row is 2.
    proposals.push({
      sheetRow:        relativeIndex + 2,
      claimId:         claimId,
      jobNumber:       jobNumber,
      customerName:    customerName,
      proposedCarrier: elByJobNumber[jobNumber]
    });
  });

  // ── Apply writes (live run only) ──────────────────────────────────────────
  var rowsUpdated = 0;

  if (!dryRun) {
    proposals.forEach(function(p) {
      claimsSheet.getRange(p.sheetRow, claimsColMap.carrier + 1).setValue(p.proposedCarrier);
      rowsUpdated++;
    });

    if (rowsUpdated > 0) {
      SpreadsheetApp.flush();
    }
  }

  var summary = {
    success:                  true,
    dryRun:                   dryRun,
    generatedAt:              new Date().toISOString(),
    claimsChecked:            claimsChecked,
    elJobsWithCarrier:        Object.keys(elByJobNumber).length,
    eligibleUpdates:          proposals.length,
    conflicts:                Object.keys(elConflicts).length,
    rowsUpdated:              dryRun ? 0 : rowsUpdated,
    skippedNoJobNumber:       skippedNoJobNumber,
    skippedHasCarrier:        skippedHasCarrier,
    skippedNoElRow:           skippedNoElRow,
    skippedConflict:          skippedConflict,
    sampleProposals:          proposals.slice(0, 10)
  };

  Logger.log(
    '[EnrichClaimFields] ' + (dryRun ? 'PREVIEW' : 'RUN') +
    ': claimsChecked=' + claimsChecked +
    ' eligible=' + proposals.length +
    ' conflicts=' + Object.keys(elConflicts).length +
    ' rowsUpdated=' + (dryRun ? '(dryRun)' : rowsUpdated) +
    ' skippedHasCarrier=' + skippedHasCarrier +
    ' skippedNoElRow=' + skippedNoElRow
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

function testSaveIntakeExternalLinks_createOrSkip() {
  const result = saveIntakeExternalLinks({
    claimId: 'CLM-TEST-STUB',
    jobNumber: 'TEST-JOB-001',
    claimNumber: 'TEST-CLAIM-001',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Test',
    driveFolderUrl: 'https://drive.google.com/drive/folders/test',
    fusionUrl: 'https://example.com/fusion/test',
    xactAnalysis: 'https://example.com/xact/test'
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSaveIntakeExternalLinks_duplicateLink() {
  const first = saveIntakeExternalLinks({
    claimId: 'CLM-TEST-DUPE',
    jobNumber: 'TEST-JOB-DUPE',
    claimNumber: 'TEST-CLAIM-DUPE',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Duplicate Test',
    driveFolderUrl: 'https://drive.google.com/drive/folders/dupe',
    fusionUrl: 'https://example.com/fusion/dupe'
  });

  const second = saveIntakeExternalLinks({
    claimId: 'CLM-TEST-DUPE',
    jobNumber: 'TEST-JOB-DUPE',
    claimNumber: 'TEST-CLAIM-DUPE',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Duplicate Test',
    driveFolderUrl: 'https://drive.google.com/drive/folders/dupe',
    fusionUrl: 'https://example.com/fusion/dupe'
  });

  const result = {
    first: first,
    second: second,
    passed: !!(
      second &&
      second.success === true &&
      second.data &&
      second.data.createdCount === 0 &&
      second.data.updatedCount === 0 &&
      second.data.skippedCount === 1
    )
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSaveIntakeExternalLinks_missingClaimIdButClaimNumberPresent() {
  const result = saveIntakeExternalLinks({
    jobNumber: 'TEST-JOB-NO-CLAIM-ID',
    claimNumber: 'TEST-CLAIM-NO-CLAIM-ID',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Missing Claim ID Test',
    driveFolderUrl: 'https://drive.google.com/drive/folders/no-claim-id',
    fusionUrl: 'https://example.com/fusion/no-claim-id'
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSaveIntakeExternalLinks_missingUrl() {
  const result = saveIntakeExternalLinks({
    claimId: 'CLM-TEST-MISSING-URL',
    jobNumber: 'TEST-JOB-MISSING-URL',
    claimNumber: 'TEST-CLAIM-MISSING-URL',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Missing URL Test'
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSaveIntakeExternalLinks_updateExistingLink() {
  const seed = saveIntakeExternalLinks({
    claimId: 'CLM-TEST-UPDATE',
    jobNumber: 'TEST-JOB-UPDATE',
    claimNumber: 'TEST-CLAIM-UPDATE',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Update Test',
    driveFolderUrl: 'https://drive.google.com/drive/folders/update',
    fusionUrl: 'https://example.com/fusion/update-v1'
  });

  const update = saveIntakeExternalLinks({
    claimId: 'CLM-TEST-UPDATE',
    jobNumber: 'TEST-JOB-UPDATE',
    claimNumber: 'TEST-CLAIM-UPDATE',
    carrier: 'Test Carrier',
    source: 'Insurance Intake Update Test',
    driveFolderUrl: 'https://drive.google.com/drive/folders/update',
    fusionUrl: 'https://example.com/fusion/update-v2',
    xactAnalysis: 'https://example.com/xact/update-v1'
  });

  const result = {
    seed: seed,
    update: update,
    passed: !!(
      update &&
      update.success === true &&
      update.data &&
      update.data.createdCount === 0 &&
      update.data.updatedCount === 1 &&
      update.data.changedColumns &&
      update.data.changedColumns.indexOf('fusionUrl') !== -1 &&
      update.data.changedColumns.indexOf('xactAnalysis') !== -1
    )
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSaveIntakeExternalLinks_route() {
  const response = routeClaimServiceRequest_({
    parameter: {
      action: 'saveIntakeExternalLinks'
    },
    postData: {
      contents: JSON.stringify({
        claimId: 'CLM-TEST-ROUTE',
        jobNumber: 'TEST-JOB-ROUTE',
        claimNumber: 'TEST-CLAIM-ROUTE',
        carrier: 'Test Carrier',
        source: 'Claims Service Route Test',
        driveFolderUrl: 'https://drive.google.com/drive/folders/route',
        fusionUrl: 'https://example.com/fusion/route'
      })
    }
  }, 'POST');

  const result = parseClaimsRouteTestResponse_(response);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}