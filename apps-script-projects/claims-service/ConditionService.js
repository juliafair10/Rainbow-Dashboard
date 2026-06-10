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

  const existing = getActiveConditions(claimId);
  if (existing.success) {
    const duplicate = existing.data.conditions.find(function(c) {
      return c.Condition_Type === conditionType;
    });

    if (duplicate) {
      return successResponse({
        condition: duplicate,
        created: false
      }, 'Condition already active.');
    }
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

  updateClaim(claimId, {
    Last_Condition_Update_At: now
  });

  appendTimelineEvent(claimId, {
    Event_Type: 'Condition Added',
    Summary: conditionType,
    Detail: condition.Reason,
    Source_System: condition.Source_System,
    Source_Record_ID: condition.Source_Record_ID,
    Related_Workflow: 'Condition Management',
    Is_Meaningful_Activity: true
  });

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