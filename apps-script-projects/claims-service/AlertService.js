/**
 * Alert management service.
 * Rainbow Phase 4 - Claim Foundation
 */

function addAlert(claimId, alertType, details) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  if (!alertType) {
    return validationErrorResponse(['Alert type is required.']);
  }

  const now = nowIso();

  const alert = {
    Alert_ID: generateId(CLAIM_ID_PREFIXES.alert),
    Claim_ID: claimId,
    Alert_Type: alertType,
    Alert_Status: 'Active',
    Severity: (details && details.Severity) || 'Medium',
    Source_System: (details && details.Source_System) || CLAIM_SERVICE.name,
    Source_Record_ID: (details && details.Source_Record_ID) || '',
    Reason: (details && details.Reason) || '',
    Recommended_Action: (details && details.Recommended_Action) || '',
    Owner_Area: (details && details.Owner_Area) || '',
    Created_At: now,
    Resolved_At: '',
    Notes: (details && details.Notes) || ''
  };

  const result = appendRow(CLAIM_SHEET_NAMES.alerts, alert);

  updateClaim(claimId, {
    Last_Alert_Update_At: now
  });

  appendTimelineEvent(claimId, {
    Event_Type: 'Alert Added',
    Summary: alertType,
    Detail: alert.Reason,
    Source_System: alert.Source_System,
    Source_Record_ID: alert.Source_Record_ID,
    Related_Workflow: 'Alert Management',
    Is_Meaningful_Activity: true
  });

  writeServiceLog('addAlert', 'Success', 'Alert added.', {
    claimId: claimId,
    sourceSystem: alert.Source_System,
    sourceRecordId: alert.Source_Record_ID,
    alertId: alert.Alert_ID,
    alertType: alert.Alert_Type,
    appendResult: result
  });

  return successResponse({
    alert: alert,
    appendResult: result
  }, 'Alert added successfully.');
}

function resolveAlert(alertId) {
  if (!alertId) {
    return validationErrorResponse(['Alert_ID is required.']);
  }

  const now = nowIso();

  const result = updateRowByKey(
    CLAIM_SHEET_NAMES.alerts,
    'Alert_ID',
    alertId,
    {
      Alert_Status: 'Resolved',
      Resolved_At: now
    }
  );

  writeServiceLog('resolveAlert', result.success ? 'Success' : 'Not Found', result.message, {
    sourceSystem: CLAIM_SERVICE.name,
    sourceRecordId: alertId
  });

  return result;
}

function getActiveAlerts(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.alerts, {
    Claim_ID: claimId
  });

  const active = rows.filter(function(row) {
    return row.Alert_Status === 'Active';
  });

  return successResponse({
    claimId: claimId,
    alerts: active,
    count: active.length
  }, 'Active alerts retrieved.');
}

function testAddAlert() {
  return addAlert('CLM-20260605-821496', 'Missing EOJ', {
    Severity: 'High',
    Reason: 'AlertService test alert.',
    Recommended_Action: 'Review missing EOJ.',
    Owner_Area: 'Field Operations',
    Source_System: 'claims-service test',
    Source_Record_ID: 'TEST-ALERT-001',
    Notes: 'Test alert created during Phase 4 Claim Foundation build.'
  });
}

function testAlertClaimLookup() {
  return lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });
}

function testGetActiveAlerts() {
  return getActiveAlerts('CLM-20260605-821496');
}

function testHardWriteAlertRow() {
  const now = nowIso();
  const alert = {
    Alert_ID: generateId(CLAIM_ID_PREFIXES.alert),
    Claim_ID: 'CLM-20260605-821496',
    Alert_Type: 'Missing EOJ',
    Alert_Status: 'Active',
    Severity: 'High',
    Source_System: 'claims-service hard write test',
    Source_Record_ID: 'TEST-HARD-ALERT-001',
    Reason: 'Hard write alert test.',
    Recommended_Action: 'Verify Claim_Alerts direct write.',
    Owner_Area: 'Field Operations',
    Created_At: now,
    Resolved_At: '',
    Notes: 'This bypasses claim lookup and verifies direct Claim_Alerts writing.'
  };

  const result = appendRow(CLAIM_SHEET_NAMES.alerts, alert);

  writeServiceLog('testHardWriteAlertRow', 'Success', 'Hard alert write test completed.', {
    claimId: alert.Claim_ID,
    sourceSystem: alert.Source_System,
    sourceRecordId: alert.Source_Record_ID,
    alertId: alert.Alert_ID,
    appendResult: result
  });

  return result;
}

function testAlertHeaders() {
  return successResponse({
    sheetName: CLAIM_SHEET_NAMES.alerts,
    headers: getHeaders(CLAIM_SHEET_NAMES.alerts)
  }, 'Alert sheet headers retrieved.');
}