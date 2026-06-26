

/**
 * Core claim operations for claims-service.
 * Rainbow Phase 4 - Claim Foundation
 */

function createClaim(payload) {
  const normalized = normalizeClaimData(payload || {});
  const validation = validateClaimPayload(normalized);

  if (!validation.success) {
    writeServiceLog('createClaim', 'Validation Error', 'Claim creation failed validation.', {
      sourceSystem: normalized.Source_System || CLAIM_SERVICE.name,
      error: validation.errors
    });
    return validation;
  }

  const existing = lookupClaim({
    Claim_Number: normalized.Claim_Number,
    Display_Name: normalized.Display_Name
  });

  if (existing.success && existing.data && existing.data.claim) {
    return successResponse({
      claim: existing.data.claim,
      created: false
    }, 'Existing claim found. No duplicate claim was created.');
  }

  const now = nowIso();
  const claimId = generateId(CLAIM_ID_PREFIXES.claim);

  const claim = {
    Claim_ID: claimId,
    Claim_Number: normalized.Claim_Number,
    Job_Number: normalized.Job_Number || '',
    // Customer_Name is the live Claims sheet column (schema: CLAIM_FOUNDATION_SHEETS.Claims).
    // Display_Name is the internal key used by validateClaimPayload/lookupClaim.
    // Both are written so the row is populated regardless of which header the sheet uses.
    Customer_Name: normalized.Display_Name || '',
    Display_Name: normalized.Display_Name,
    Claim_Label: buildClaimLabel_(normalized.Display_Name, normalized.Claim_Number),
    Property_Address: normalized.Property_Address || '',
    Carrier: normalized.Carrier || '',
    Adjuster_Name: normalized.Adjuster_Name || '',
    Adjuster_Email: normalized.Adjuster_Email || '',
    Policy_Number: normalized.Policy_Number || '',
    Loss_Date: normalized.Loss_Date || '',
    Date_Received: normalized.Date_Received || now,
    Source_System: normalized.Source_System || CLAIM_SERVICE.name,
    Source_Email_Thread_ID: normalized.Source_Email_Thread_ID || '',
    Claim_Folder_ID: normalized.Claim_Folder_ID || '',
    Claim_Folder_URL: normalized.Claim_Folder_URL || '',
    Lifecycle_State: normalized.Lifecycle_State || 'Intake',
    Ownership_Area: normalized.Ownership_Area || 'Intake',
    Primary_Owner: normalized.Primary_Owner || '',
    Operational_Health: normalized.Operational_Health || 'Healthy',
    Health_Reason: normalized.Health_Reason || 'Initial claim health defaulted to Healthy.',
    Health_Updated_At: normalized.Health_Updated_At || now,
    Health_Override: normalized.Health_Override || '',
    Health_Override_Reason: normalized.Health_Override_Reason || '',
    Health_Override_Expires_At: normalized.Health_Override_Expires_At || '',
    Health_Override_Set_By: normalized.Health_Override_Set_By || '',
    Is_Active: normalized.Is_Active !== undefined ? normalized.Is_Active : true,
    Is_Not_Sold: normalized.Is_Not_Sold !== undefined ? normalized.Is_Not_Sold : false,
    Is_Operationally_Complete: normalized.Is_Operationally_Complete !== undefined ? normalized.Is_Operationally_Complete : false,
    Created_At: now,
    Updated_At: now,
    Owner_Updated_At: normalized.Owner_Updated_At || '',
    Last_Meaningful_Activity_At: normalized.Last_Meaningful_Activity_At || '',
    Last_EOJ_At: normalized.Last_EOJ_At || '',
    Last_Payment_At: normalized.Last_Payment_At || '',
    Last_Revision_At: normalized.Last_Revision_At || '',
    Last_Carrier_Activity_At: normalized.Last_Carrier_Activity_At || '',
    Last_Follow_Up_At: normalized.Last_Follow_Up_At || '',
    Last_Condition_Update_At: normalized.Last_Condition_Update_At || '',
    Last_Alert_Update_At: normalized.Last_Alert_Update_At || '',
    Notes: normalized.Notes || ''
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.claims, claim);

  writeServiceLog('createClaim', 'Success', 'Claim created.', {
    claimId: claimId,
    sourceSystem: claim.Source_System,
    sourceRecordId: claim.Source_Email_Thread_ID,
    claimLabel: claim.Claim_Label
  });

  return successResponse({
    claim: claim,
    appendResult: appendResult,
    created: true
  }, 'Claim created successfully.');
}

function updateClaim(claimId, updates) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to update a claim.']);
  }

  const cleanUpdates = normalizeClaimUpdates_(updates || {});
  cleanUpdates.Updated_At = nowIso();

  if (Object.prototype.hasOwnProperty.call(cleanUpdates, 'Display_Name') ||
      Object.prototype.hasOwnProperty.call(cleanUpdates, 'Claim_Number')) {
    const current = lookupClaim({ Claim_ID: claimId });
    const currentClaim = current.success && current.data ? current.data.claim : {};
    const displayName = cleanUpdates.Display_Name || currentClaim.Display_Name || '';
    const claimNumber = cleanUpdates.Claim_Number || currentClaim.Claim_Number || '';
    cleanUpdates.Claim_Label = buildClaimLabel_(displayName, claimNumber);
  }

  const result = updateRowByKey(
    CLAIM_SHEET_NAMES.claims,
    'Claim_ID',
    claimId,
    cleanUpdates
  );

  writeServiceLog('updateClaim', result.success ? 'Success' : 'Not Found', result.message, {
    claimId: claimId,
    sourceSystem: CLAIM_SERVICE.name,
    updates: cleanUpdates
  });

  return result;
}

function lookupClaim(criteria) {
  const normalizedCriteria = normalizeClaimLookupCriteria_(criteria || {});

  if (normalizedCriteria.Claim_ID) {
    return lookupClaimByExactField_('Claim_ID', normalizedCriteria.Claim_ID);
  }

  if (normalizedCriteria.Claim_Folder_ID) {
    return lookupClaimByExactField_('Claim_Folder_ID', normalizedCriteria.Claim_Folder_ID);
  }

  if (normalizedCriteria.Source_Email_Thread_ID) {
    return lookupClaimByExactField_('Source_Email_Thread_ID', normalizedCriteria.Source_Email_Thread_ID);
  }

  if (normalizedCriteria.Claim_Number && normalizedCriteria.Display_Name) {
    const rows = getRows(CLAIM_SHEET_NAMES.claims);
    const match = rows.find(function(row) {
      return normalizeClaimNumber(row.Claim_Number) === normalizedCriteria.Claim_Number &&
        normalizeLower(row.Display_Name) === normalizeLower(normalizedCriteria.Display_Name);
    });

    if (match) {
      return successResponse({ claim: match }, 'Claim found.');
    }
  }

  if (normalizedCriteria.Claim_Number) {
    return lookupClaimByNormalizedClaimNumber_(normalizedCriteria.Claim_Number);
  }

  return notFoundResponse('No matching claim found.', {
    criteria: criteria || {}
  });
}

function findOrCreateClaim(payload) {
  const normalized = normalizeClaimData(payload || {});
  const lookup = lookupClaim(normalized);

  if (lookup.success && lookup.data && lookup.data.claim) {
    return successResponse({
      claim: lookup.data.claim,
      created: false
    }, 'Existing claim found.');
  }

  const created = createClaim(normalized);

  if (!created.success) {
    return created;
  }

  return successResponse({
    claim: created.data.claim,
    created: true
  }, 'Claim created through findOrCreateClaim.');
}

function validateClaimPayload(payload) {
  const errors = [];

  if (!payload) {
    errors.push('Claim payload is required.');
  }

  if (!payload.Claim_Number) {
    errors.push('Claim_Number is required.');
  }

  if (!payload.Display_Name) {
    errors.push('Display_Name is required.');
  }

  if (payload.Lifecycle_State && CLAIM_LIFECYCLE_STATES.indexOf(payload.Lifecycle_State) === -1) {
    errors.push('Lifecycle_State is not valid: ' + payload.Lifecycle_State);
  }

  if (payload.Ownership_Area && CLAIM_OWNERSHIP_AREAS.indexOf(payload.Ownership_Area) === -1) {
    errors.push('Ownership_Area is not valid: ' + payload.Ownership_Area);
  }

  if (payload.Operational_Health && CLAIM_HEALTH_LEVELS.indexOf(payload.Operational_Health) === -1) {
    errors.push('Operational_Health is not valid: ' + payload.Operational_Health);
  }

  if (errors.length > 0) {
    return validationErrorResponse(errors);
  }

  return successResponse({ valid: true }, 'Claim payload is valid.');
}

function normalizeClaimData(payload) {
  const normalized = Object.assign({}, payload || {});

  normalized.Claim_Number = normalizeClaimNumber(
    normalized.Claim_Number || normalized.claimNumber || normalized.claim_number || ''
  );

  normalized.Job_Number = normalizeString(
    normalized.Job_Number || normalized.jobNumber || normalized.job_number || ''
  );

  // Accept all customer/display name input variants.
  // The live Claims sheet stores this as Customer_Name; Display_Name is the internal key.
  normalized.Display_Name = normalizeString(
    normalized.Display_Name ||
    normalized['Display Name'] ||
    normalized.displayName ||
    normalized.display_name ||
    normalized.Customer_Name ||
    normalized['Customer Name'] ||
    normalized.customerName ||
    normalized.customer_name ||
    ''
  );

  normalized.Claim_Label = buildClaimLabel_(normalized.Display_Name, normalized.Claim_Number);

  normalized.Property_Address = normalizeString(
    normalized.Property_Address || normalized.propertyAddress || normalized.property_address || ''
  );

  normalized.Carrier = normalizeString(normalized.Carrier || normalized.carrier || '');
  normalized.Adjuster_Name = normalizeString(normalized.Adjuster_Name || normalized.adjusterName || '');
  normalized.Adjuster_Email = normalizeString(normalized.Adjuster_Email || normalized.adjusterEmail || '');
  normalized.Policy_Number = normalizeString(normalized.Policy_Number || normalized.policyNumber || '');
  normalized.Source_System = normalizeString(normalized.Source_System || normalized.sourceSystem || CLAIM_SERVICE.name);
  normalized.Source_Email_Thread_ID = normalizeString(normalized.Source_Email_Thread_ID || normalized.sourceEmailThreadId || '');
  normalized.Claim_Folder_ID = normalizeString(normalized.Claim_Folder_ID || normalized.claimFolderId || '');
  normalized.Claim_Folder_URL = normalizeString(normalized.Claim_Folder_URL || normalized.claimFolderUrl || '');

  return normalized;
}

function normalizeClaimUpdates_(updates) {
  const normalized = {};
  const raw = updates || {};

  Object.keys(raw).forEach(function(key) {
    const value = raw[key];

    if (value === undefined) {
      return;
    }

    switch (key) {
      case 'claimNumber':
      case 'claim_number':
      case 'Claim_Number':
        normalized.Claim_Number = normalizeClaimNumber(value);
        break;

      case 'jobNumber':
      case 'job_number':
      case 'Job_Number':
        normalized.Job_Number = normalizeString(value);
        break;

      case 'displayName':
      case 'display_name':
      case 'Display Name':
      case 'Display_Name':
      case 'Customer_Name':
      case 'Customer Name':
      case 'customerName':
      case 'customer_name':
        normalized.Display_Name = normalizeString(value);
        normalized.Customer_Name = normalizeString(value);
        break;

      case 'propertyAddress':
      case 'property_address':
      case 'Property_Address':
        normalized.Property_Address = normalizeString(value);
        break;

      case 'carrier':
      case 'Carrier':
        normalized.Carrier = normalizeString(value);
        break;

      case 'adjusterName':
      case 'Adjuster_Name':
        normalized.Adjuster_Name = normalizeString(value);
        break;

      case 'adjusterEmail':
      case 'Adjuster_Email':
        normalized.Adjuster_Email = normalizeString(value);
        break;

      case 'policyNumber':
      case 'Policy_Number':
        normalized.Policy_Number = normalizeString(value);
        break;

      case 'sourceSystem':
      case 'Source_System':
        normalized.Source_System = normalizeString(value);
        break;

      case 'sourceEmailThreadId':
      case 'Source_Email_Thread_ID':
        normalized.Source_Email_Thread_ID = normalizeString(value);
        break;

      case 'claimFolderId':
      case 'Claim_Folder_ID':
        normalized.Claim_Folder_ID = normalizeString(value);
        break;

      case 'claimFolderUrl':
      case 'Claim_Folder_URL':
        normalized.Claim_Folder_URL = normalizeString(value);
        break;

      default:
        normalized[key] = value;
    }
  });

  return normalized;
}

function normalizeClaimLookupCriteria_(criteria) {
  const normalized = Object.assign({}, criteria || {});

  normalized.Claim_ID = normalizeString(normalized.Claim_ID || normalized.claimId || '');
  normalized.Claim_Number = normalizeClaimNumber(normalized.Claim_Number || normalized.claimNumber || '');
  normalized.Display_Name = normalizeString(normalized.Display_Name || normalized.displayName || normalized.Customer_Name || '');
  normalized.Claim_Folder_ID = normalizeString(normalized.Claim_Folder_ID || normalized.claimFolderId || '');
  normalized.Source_Email_Thread_ID = normalizeString(normalized.Source_Email_Thread_ID || normalized.sourceEmailThreadId || '');

  return normalized;
}

function lookupClaimByExactField_(fieldName, fieldValue) {
  const rows = findRows(CLAIM_SHEET_NAMES.claims, buildSingleFieldCriteria_(fieldName, fieldValue));

  if (rows.length === 0) {
    return notFoundResponse('No matching claim found.', {
      fieldName: fieldName,
      fieldValue: fieldValue
    });
  }

  if (rows.length > 1) {
    return successResponse({
      claim: rows[0],
      matches: rows,
      warning: 'Multiple claims matched. Returning first match.'
    }, 'Multiple claims found.');
  }

  return successResponse({ claim: rows[0] }, 'Claim found.');
}

function lookupClaimByNormalizedClaimNumber_(claimNumber) {
  const rows = getRows(CLAIM_SHEET_NAMES.claims);
  const matches = rows.filter(function(row) {
    return normalizeClaimNumber(row.Claim_Number) === claimNumber;
  });

  if (matches.length === 0) {
    return notFoundResponse('No matching claim found by Claim_Number.', {
      Claim_Number: claimNumber
    });
  }

  if (matches.length > 1) {
    return successResponse({
      claim: matches[0],
      matches: matches,
      warning: 'Multiple claims matched the same Claim_Number. Returning first match.'
    }, 'Multiple claims found by Claim_Number.');
  }

  return successResponse({ claim: matches[0] }, 'Claim found by Claim_Number.');
}

function buildSingleFieldCriteria_(fieldName, fieldValue) {
  const criteria = {};
  criteria[fieldName] = fieldValue;
  return criteria;
}

function buildClaimLabel_(displayName, claimNumber) {
  const cleanDisplayName = normalizeString(displayName);
  const cleanClaimNumber = normalizeClaimNumber(claimNumber);

  if (cleanDisplayName && cleanClaimNumber) {
    return cleanDisplayName + ' - ' + cleanClaimNumber;
  }

  return cleanDisplayName || cleanClaimNumber || '';
}

function repairClaimsIdentityHeaders() {
  const sheet = getSheet(CLAIM_SHEET_NAMES.claims);
  const headers = getHeaders(CLAIM_SHEET_NAMES.claims);

  const customerNameIndex = headers.indexOf('Customer_Name');
  const displayNameIndex = headers.indexOf('Display_Name');
  const claimLabelIndex = headers.indexOf('Claim_Label');

  if (displayNameIndex !== -1 && claimLabelIndex !== -1 && customerNameIndex === -1) {
    return successResponse({
      headers: headers
    }, 'Claims identity headers are already repaired.');
  }

  let repairedHeaders = headers.slice();

  if (customerNameIndex !== -1) {
    repairedHeaders[customerNameIndex] = 'Display_Name';
    if (repairedHeaders.indexOf('Claim_Label') === -1) {
      repairedHeaders.splice(customerNameIndex + 1, 0, 'Claim_Label');
    }
  } else if (displayNameIndex !== -1 && claimLabelIndex === -1) {
    repairedHeaders.splice(displayNameIndex + 1, 0, 'Claim_Label');
  } else if (displayNameIndex === -1) {
    repairedHeaders.splice(2, 0, 'Display_Name', 'Claim_Label');
  }

  sheet.getRange(1, 1, 1, repairedHeaders.length).setValues([repairedHeaders]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, repairedHeaders.length).setFontWeight('bold');
  sheet.autoResizeColumns(1, repairedHeaders.length);

  writeServiceLog('repairClaimsIdentityHeaders', 'Success', 'Claims identity headers repaired.', {
    sourceSystem: CLAIM_SERVICE.name,
    oldHeaders: headers,
    newHeaders: repairedHeaders
  });

  return successResponse({
    oldHeaders: headers,
    newHeaders: repairedHeaders
  }, 'Claims identity headers repaired successfully.');
}

// ---------------------------------------------------------------------------
// Claims Claim_ID Backfill
// ---------------------------------------------------------------------------
// Older Claims rows may have a blank Claim_ID (they existed before Claim_IDs
// were consistently written, or were imported from legacy systems).
// These functions assign stable, deterministic IDs to those rows.
//
// ID derivation priority:
//   1. CLM-{sanitized Job_Number}   (if Job_Number is populated)
//   2. CLM-{sanitized Claim_Number} (if Claim_Number is populated)
//
// "Sanitize" = trim, uppercase, keep only [A-Z0-9-], collapse runs of hyphens.
//
// Rules enforced:
//   - Never overwrite a non-blank Claim_ID.
//   - Never change any column other than Claim_ID.
//   - Skip rows where neither Job_Number nor Claim_Number is available.
//   - Detect collisions against already-existing Claim_IDs in the sheet
//     AND against IDs proposed for other rows in the same run.
// ---------------------------------------------------------------------------

/**
 * Sanitize a raw identifier value into a stable Claim_ID suffix.
 * Keeps uppercase alphanumeric and hyphens; collapses consecutive hyphens.
 * Returns '' if the result would be empty.
 * @param {*} value
 * @returns {string}
 */
function sanitizeClaimIdSuffix_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Derive a stable Claim_ID for a Claims row that currently has none.
 * Returns '' if no usable identifier is found.
 * @param {string} jobNumber
 * @param {string} claimNumber
 * @returns {string}
 */
function deriveStableClaimId_(jobNumber, claimNumber) {
  var jobSuffix   = sanitizeClaimIdSuffix_(jobNumber);
  var claimSuffix = sanitizeClaimIdSuffix_(claimNumber);

  if (jobSuffix)   { return 'CLM-' + jobSuffix; }
  if (claimSuffix) { return 'CLM-' + claimSuffix; }
  return '';
}

/**
 * Read the Claims sheet and return header-to-column-index map (0-based).
 * Uses normalised lower-alpha-numeric matching for header resilience.
 * @param {Array<Array>} values  raw values from getDataRange().getValues()
 * @returns {{ claimId: number, claimNumber: number, jobNumber: number, customerName: number }}
 */
function buildClaimsColumnMap_(values) {
  var headers = values[0].map(function(h) {
    return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  });

  return {
    claimId:      headers.indexOf('claimid'),
    claimNumber:  headers.indexOf('claimnumber'),
    jobNumber:    headers.indexOf('jobnumber'),
    customerName: headers.indexOf('customername')
  };
}

/**
 * Dry-run preview: scans Claims sheet, proposes stable Claim_IDs for rows
 * where Claim_ID is blank.  No writes are performed.
 * Logs and returns full diagnostics.
 */
function previewBackfillMissingClaimIds() {
  return runClaimIdBackfill_(true);
}

/**
 * Apply: writes stable Claim_IDs to Claims rows where Claim_ID is blank.
 * Only the Claim_ID cell is touched; all other columns are unchanged.
 */
function backfillMissingClaimIds() {
  return runClaimIdBackfill_(false);
}

/**
 * @private
 * Core logic for Claim_ID backfill.
 * @param {boolean} dryRun
 */
function runClaimIdBackfill_(dryRun) {
  var ss = SpreadsheetApp.openById(CLAIMS_DATABASE_SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.claims);

  if (!sheet) {
    return { success: false, message: 'Claims sheet not found.' };
  }

  var values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return { success: false, message: 'Claims sheet has no data rows.' };
  }

  var colMap = buildClaimsColumnMap_(values);

  if (colMap.claimId === -1) {
    return { success: false, message: 'Claim_ID column not found in Claims sheet.' };
  }

  if (colMap.claimNumber === -1 && colMap.jobNumber === -1) {
    return { success: false, message: 'Neither Claim_Number nor Job_Number column found; cannot derive IDs.' };
  }

  // ── First pass: collect all existing Claim_IDs ──────────────────────────
  var existingClaimIds = {};

  values.slice(1).forEach(function(row) {
    var id = String(row[colMap.claimId] || '').trim();
    if (id) {
      existingClaimIds[id.toUpperCase()] = true;
    }
  });

  // ── Second pass: build proposals ─────────────────────────────────────────
  var rowsChecked              = 0;
  var rowsMissingClaimId       = 0;
  var rowsSkippedNoIdentifiers = 0;
  var rowsSkippedCollision     = 0;
  var proposals                = [];
  var proposedIds              = {};   // collision guard within this run

  values.slice(1).forEach(function(row, relativeIndex) {
    rowsChecked++;

    var existingId  = String(row[colMap.claimId] || '').trim();

    // Skip rows that already have a Claim_ID.
    if (existingId) {
      return;
    }

    rowsMissingClaimId++;

    var jobNumber   = colMap.jobNumber   !== -1 ? String(row[colMap.jobNumber]   || '').trim() : '';
    var claimNumber = colMap.claimNumber !== -1 ? String(row[colMap.claimNumber] || '').trim() : '';
    var customerName = colMap.customerName !== -1 ? String(row[colMap.customerName] || '').trim() : '';

    var proposedId = deriveStableClaimId_(jobNumber, claimNumber);

    if (!proposedId) {
      rowsSkippedNoIdentifiers++;
      Logger.log('[ClaimIdBackfill] SKIP row ' + (relativeIndex + 2) +
        ': no Job_Number or Claim_Number available' +
        (customerName ? ' (customer: ' + customerName + ')' : ''));
      return;
    }

    // Collision check: existing sheet IDs and already-proposed IDs.
    if (existingClaimIds[proposedId.toUpperCase()] || proposedIds[proposedId.toUpperCase()]) {
      rowsSkippedCollision++;
      Logger.log('[ClaimIdBackfill] COLLISION row ' + (relativeIndex + 2) +
        ': proposed=' + proposedId + ' already exists; skipping row' +
        (customerName ? ' (customer: ' + customerName + ')' : ''));
      return;
    }

    // Sheet row number is 1-based: row 1 is header, first data row is 2.
    var sheetRowNumber = relativeIndex + 2;

    proposedIds[proposedId.toUpperCase()] = true;

    proposals.push({
      sheetRow:     sheetRowNumber,
      jobNumber:    jobNumber,
      claimNumber:  claimNumber,
      customerName: customerName,
      derivedFrom:  jobNumber ? 'jobNumber' : 'claimNumber',
      proposedId:   proposedId
    });
  });

  // ── Apply writes (real run only) ─────────────────────────────────────────
  var rowsWritten = 0;

  if (!dryRun) {
    proposals.forEach(function(p) {
      sheet.getRange(p.sheetRow, colMap.claimId + 1).setValue(p.proposedId);
      rowsWritten++;
    });

    if (rowsWritten > 0) {
      SpreadsheetApp.flush();
    }
  }

  var summary = {
    success:                  true,
    dryRun:                   dryRun,
    generatedAt:              new Date().toISOString(),
    rowsChecked:              rowsChecked,
    rowsMissingClaimId:       rowsMissingClaimId,
    rowsEligible:             proposals.length,
    rowsWritten:              dryRun ? 0 : rowsWritten,
    rowsSkippedNoIdentifiers: rowsSkippedNoIdentifiers,
    rowsSkippedCollision:     rowsSkippedCollision,
    sampleProposals:          proposals.slice(0, 10)
  };

  Logger.log(
    '[ClaimIdBackfill] ' + (dryRun ? 'PREVIEW' : 'RUN') +
    ': checked=' + rowsChecked +
    ' missingId=' + rowsMissingClaimId +
    ' eligible=' + proposals.length +
    ' written=' + (dryRun ? '(dryRun)' : rowsWritten) +
    ' skippedNoId=' + rowsSkippedNoIdentifiers +
    ' skippedCollision=' + rowsSkippedCollision
  );

  if (dryRun && proposals.length > 0) {
    Logger.log('[ClaimIdBackfill] PREVIEW — first ' +
      Math.min(10, proposals.length) + ' proposals:');
    proposals.slice(0, 10).forEach(function(p) {
      Logger.log('  row ' + p.sheetRow +
        ' | derivedFrom=' + p.derivedFrom +
        ' | jobNumber=' + p.jobNumber +
        ' | claimNumber=' + p.claimNumber +
        ' | customer=' + p.customerName +
        ' | proposedId=' + p.proposedId);
    });
  }

  return summary;
}

// ---------------------------------------------------------------------------

function testCreateClaim() {
  return createClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD',
    Property_Address: '123 Test Street',
    Carrier: 'Test Carrier',
    Source_System: 'claims-service test',
    Notes: 'Test claim created during Phase 4 Claim Foundation build.'
  });
}

function testLookupClaim() {
  return lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });
}


function repairClaireJacksonTestClaim() {
  return updateClaim('CLM-20260605-821496', {
    Claim_Number: '26N-0127-MLD',
    Display_Name: 'CLAIRE JACKSON',
    Property_Address: '123 Test Street',
    Carrier: 'Test Carrier',
    Source_System: 'claims-service test',
    Notes: 'Test claim repaired after sparse update fix.'
  });
}

function cleanupInsuranceIntakeTestClaimRows() {
  const testClaimId = 'CLM-20260610-751259';
  const testClaimNumber = 'INTAKE-TEST-001';
  const cleanupTargets = [
    { sheetName: CLAIM_SHEET_NAMES.timeline, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.conditions, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.alerts, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.ownershipHistory, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.financialTracks, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.externalLinks, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.healthHistory, matchColumns: ['Claim_ID'] },
    { sheetName: CLAIM_SHEET_NAMES.claims, matchColumns: ['Claim_ID', 'Claim_Number'] }
  ];

  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const results = [];

  cleanupTargets.forEach(function(target) {
    const sheet = ss.getSheetByName(target.sheetName);

    if (!sheet) {
      results.push({
        sheetName: target.sheetName,
        skipped: true,
        reason: 'Sheet not found.',
        removedCount: 0,
        removedRows: []
      });
      return;
    }

    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      results.push({
        sheetName: target.sheetName,
        skipped: false,
        removedCount: 0,
        removedRows: []
      });
      return;
    }

    const headers = values[0];
    const columnIndexes = target.matchColumns.map(function(columnName) {
      return {
        columnName: columnName,
        index: headers.indexOf(columnName)
      };
    }).filter(function(column) {
      return column.index !== -1;
    });

    if (columnIndexes.length === 0) {
      results.push({
        sheetName: target.sheetName,
        skipped: true,
        reason: 'No matching cleanup columns found.',
        removedCount: 0,
        removedRows: []
      });
      return;
    }

    const removedRows = [];

    for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
      const row = values[rowIndex];
      const shouldDelete = columnIndexes.some(function(column) {
        const value = row[column.index];
        return value === testClaimId || value === testClaimNumber;
      });

      if (shouldDelete) {
        const sheetRowNumber = rowIndex + 1;
        removedRows.push(sheetRowNumber);
        sheet.deleteRow(sheetRowNumber);
      }
    }

    results.push({
      sheetName: target.sheetName,
      skipped: false,
      removedCount: removedRows.length,
      removedRows: removedRows.reverse()
    });
  });

  const totalRemoved = results.reduce(function(total, result) {
    return total + (result.removedCount || 0);
  }, 0);

  return successResponse({
    testClaimId: testClaimId,
    testClaimNumber: testClaimNumber,
    totalRemoved: totalRemoved,
    results: results
  }, 'Insurance intake test claim rows cleaned successfully.');
}

function testCleanupInsuranceIntakeTestClaimRows() {
  const response = cleanupInsuranceIntakeTestClaimRows();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}