

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

  normalized.Display_Name = normalizeString(
    normalized.Display_Name || normalized.displayName || normalized.display_name || normalized.Customer_Name || normalized.customerName || ''
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

      case 'displayName':
      case 'display_name':
      case 'Customer_Name':
      case 'customerName':
      case 'Display_Name':
        normalized.Display_Name = normalizeString(value);
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