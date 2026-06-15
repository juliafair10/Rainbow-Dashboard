/**
 * Condition management service.
 * Rainbow Phase 4 - Claim Foundation
 */

function addCondition(claimId, conditionType, details) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  if (!conditionType) {
    return validationErrorResponse(['Condition type is required.']);
  }

  if (CLAIM_CONDITION_TYPES.indexOf(conditionType) === -1) {
    return validationErrorResponse(['Unknown condition: ' + conditionType]);
  }

  const existing = getActiveConditionsForPersistence_(claimId);
  const duplicate = existing.find(function(c) {
    const existingType = getConditionPersistenceValue_(c, ['Condition_Type', 'Condition Type', 'Type']);
    return String(existingType || '') === String(conditionType || '');
  });

  if (duplicate) {
    return successResponse({
      condition: duplicate,
      created: false
    }, 'Condition already active.');
  }

  const now = nowIso();

  const condition = {
    Condition_ID: generateId(CLAIM_ID_PREFIXES.condition),
    Claim_ID: claimId,
    Condition_Type: conditionType,
    Condition_Status: 'Active',
    Opened_At: now,
    Closed_At: '',
    Source_System: (details && details.Source_System) || CLAIM_SERVICE.name,
    Source_Record_ID: (details && details.Source_Record_ID) || '',
    Reason: (details && details.Reason) || '',
    Follow_Up_Date: (details && details.Follow_Up_Date) || '',
    Owner_Area: (details && details.Owner_Area) || '',
    Notes: (details && details.Notes) || '',
    Created_At: now,
    Updated_At: now
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.conditions, condition);

  try {
    updateClaim(claimId, {
      Last_Condition_Update_At: now
    });
  } catch (error) {
    writeServiceLog('addCondition.updateClaim', 'Warning', 'Condition was written, but claim metadata update failed.', {
      claimId: claimId,
      conditionId: condition.Condition_ID,
      conditionType: condition.Condition_Type,
      message: error && error.message ? error.message : String(error)
    });
  }

  try {
    appendTimelineEvent(claimId, {
      Event_Type: 'Condition Added',
      Summary: conditionType,
      Detail: condition.Reason,
      Source_System: condition.Source_System,
      Source_Record_ID: condition.Source_Record_ID,
      Related_Workflow: 'Condition Management',
      Is_Meaningful_Activity: true
    });
  } catch (error) {
    writeServiceLog('addCondition.appendTimelineEvent', 'Warning', 'Condition was written, but timeline event append failed.', {
      claimId: claimId,
      conditionId: condition.Condition_ID,
      conditionType: condition.Condition_Type,
      message: error && error.message ? error.message : String(error)
    });
  }

  writeServiceLog('addCondition', 'Success', 'Condition added.', {
    claimId: claimId,
    sourceSystem: condition.Source_System,
    sourceRecordId: condition.Source_Record_ID,
    conditionId: condition.Condition_ID,
    conditionType: condition.Condition_Type
  });

  return successResponse({
    condition: condition,
    appendResult: appendResult,
    created: true
  }, 'Condition added successfully.');
}

function resolveCondition(conditionId) {
  if (!conditionId) {
    return validationErrorResponse(['Condition_ID is required.']);
  }

  const now = nowIso();

  const result = updateRowByKey(
    CLAIM_SHEET_NAMES.conditions,
    'Condition_ID',
    conditionId,
    {
      Condition_Status: 'Resolved',
      Closed_At: now,
      Updated_At: now
    }
  );

  writeServiceLog('resolveCondition', result.success ? 'Success' : 'Not Found', result.message, {
    sourceSystem: CLAIM_SERVICE.name,
    sourceRecordId: conditionId
  });

  return result;
}

function getActiveConditions(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.conditions, {
    Claim_ID: claimId
  });

  const active = rows.filter(function(row) {
    return row.Condition_Status === 'Active';
  });

  return successResponse({
    claimId: claimId,
    conditions: active,
    count: active.length
  }, 'Active conditions retrieved.');
}

function hasCondition(claimId, conditionType) {
  const active = getActiveConditions(claimId);

  if (!active.success) {
    return false;
  }

  return active.data.conditions.some(function(c) {
    return c.Condition_Type === conditionType;
  });
}

function testAddCondition() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    return claimLookup;
  }

  return addCondition(
    claimLookup.data.claim.Claim_ID,
    'Coverage Pending',
    {
      Reason: 'ConditionService test condition.',
      Source_System: 'claims-service test',
      Source_Record_ID: 'TEST-CONDITION-001',
      Owner_Area: 'Intake',
      Notes: 'Test condition created during Phase 4 Claim Foundation build.'
    }
  );
}

function testGetActiveConditions() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    return claimLookup;
  }

  return getActiveConditions(claimLookup.data.claim.Claim_ID);
}

function testDirectConditionAppend() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    return claimLookup;
  }

  const now = nowIso();
  const condition = {
    Condition_ID: generateId(CLAIM_ID_PREFIXES.condition),
    Claim_ID: claimLookup.data.claim.Claim_ID,
    Condition_Type: 'Coverage Pending',
    Condition_Status: 'Active',
    Opened_At: now,
    Closed_At: '',
    Source_System: 'claims-service direct test',
    Source_Record_ID: 'TEST-DIRECT-CONDITION-001',
    Reason: 'Direct condition append test.',
    Follow_Up_Date: '',
    Owner_Area: 'Intake',
    Notes: 'This bypasses addCondition to verify Claim_Conditions sheet writing.',
    Created_At: now,
    Updated_At: now
  };

  return appendRow(CLAIM_SHEET_NAMES.conditions, condition);
}

function testConditionHeaders() {
  return successResponse({
    sheetName: CLAIM_SHEET_NAMES.conditions,
    headers: getHeaders(CLAIM_SHEET_NAMES.conditions)
  }, 'Condition sheet headers retrieved.');
}

function testHardWriteConditionRow() {
  const now = nowIso();
  const condition = {
    Condition_ID: generateId(CLAIM_ID_PREFIXES.condition),
    Claim_ID: 'CLM-20260605-821496',
    Condition_Type: 'Coverage Pending',
    Condition_Status: 'Active',
    Opened_At: now,
    Closed_At: '',
    Source_System: 'claims-service hard write test',
    Source_Record_ID: 'TEST-HARD-CONDITION-001',
    Reason: 'Hard write condition test.',
    Follow_Up_Date: '',
    Owner_Area: 'Intake',
    Notes: 'This bypasses claim lookup and verifies direct Claim_Conditions writing.',
    Created_At: now,
    Updated_At: now
  };

  const result = appendRow(CLAIM_SHEET_NAMES.conditions, condition);

  writeServiceLog('testHardWriteConditionRow', 'Success', 'Hard condition write test completed.', {
    claimId: condition.Claim_ID,
    sourceSystem: condition.Source_System,
    sourceRecordId: condition.Source_Record_ID,
    conditionId: condition.Condition_ID,
    appendResult: result
  });

  return result;
}
function getActiveConditionsForPersistence_(claimId) {
  const rows = getConditionPersistenceRows_(CLAIM_SHEET_NAMES.conditions);

  return rows.filter(function(row) {
    const rowClaimId = getConditionPersistenceValue_(row, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']);
    const status = getConditionPersistenceValue_(row, ['Condition_Status', 'Condition Status', 'Status', 'ConditionStatus']);

    return String(rowClaimId || '') === String(claimId || '')
      && String(status || '').toLowerCase() === 'active';
  });
}

function getConditionPersistenceRows_(sheetName) {
  const ss = getConditionPersistenceSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headerRowIndex = findConditionPersistenceHeaderRowIndex_(values);
  const headers = values[headerRowIndex];

  return values.slice(headerRowIndex + 1).filter(function(row) {
    return row.some(function(cell) {
      return cell !== '' && cell !== null;
    });
  }).map(function(row) {
    const record = {};

    headers.forEach(function(header, index) {
      if (header) {
        record[String(header)] = row[index];
      }
    });

    return record;
  });
}

function findConditionPersistenceHeaderRowIndex_(values) {
  const maxRowsToInspect = Math.min(values.length, 10);

  for (let rowIndex = 0; rowIndex < maxRowsToInspect; rowIndex++) {
    const normalizedHeaders = values[rowIndex].map(function(value) {
      return normalizeConditionPersistenceValue_(value);
    });

    const hasClaimId = normalizedHeaders.indexOf('claimid') !== -1;
    const hasConditionType = normalizedHeaders.indexOf('conditiontype') !== -1;
    const hasConditionStatus = normalizedHeaders.indexOf('conditionstatus') !== -1;
    const hasConditionId = normalizedHeaders.indexOf('conditionid') !== -1;

    if (hasClaimId && (hasConditionType || hasConditionStatus || hasConditionId)) {
      return rowIndex;
    }
  }

  return 0;
}

function getConditionPersistenceSpreadsheet_() {
  const spreadsheetId = typeof CONFIG !== 'undefined' && CONFIG.CLAIMS_DATABASE_SPREADSHEET_ID
    ? CONFIG.CLAIMS_DATABASE_SPREADSHEET_ID
    : CLAIM_FOUNDATION_SPREADSHEET_ID;

  return SpreadsheetApp.openById(spreadsheetId);
}

function getConditionPersistenceValue_(record, possibleKeys) {
  for (let i = 0; i < possibleKeys.length; i++) {
    const key = possibleKeys[i];
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }

  const normalizedRecord = {};

  Object.keys(record).forEach(function(key) {
    normalizedRecord[normalizeConditionPersistenceValue_(key)] = record[key];
  });

  for (let j = 0; j < possibleKeys.length; j++) {
    const normalizedKey = normalizeConditionPersistenceValue_(possibleKeys[j]);
    if (normalizedRecord[normalizedKey] !== undefined && normalizedRecord[normalizedKey] !== null && normalizedRecord[normalizedKey] !== '') {
      return normalizedRecord[normalizedKey];
    }
  }

  return '';
}

function normalizeConditionPersistenceValue_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function testConditionPersistenceWriteSafety() {
  const result = addCondition('CLM-26A-0034-WTR', 'Coverage Pending', {
    Reason: 'Condition persistence safety test. This verifies condition writing does not fail when Claims sheet uses display headers.',
    Source_System: 'claims-service condition persistence test',
    Source_Record_ID: 'TEST-CONDITION-PERSISTENCE-SAFETY',
    Owner_Area: 'Office Operations',
    Notes: 'Created during Phase 8B.5 condition persistence hardening.'
  });

  Logger.log('CONDITION_PERSISTENCE_WRITE_SAFETY ' + JSON.stringify(result));
  return result;
}

function testResolveConditionPersistenceSafetyRow() {
  const result = resolveCondition('CON-20260615-746657');
  Logger.log('CONDITION_PERSISTENCE_CLEANUP ' + JSON.stringify(result));
  return result;
}