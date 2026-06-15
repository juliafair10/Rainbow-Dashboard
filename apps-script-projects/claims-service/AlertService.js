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


function testAlertClaimLookup() {
  return lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });
}

function testGetActiveAlerts() {
  return getActiveAlerts('CLM-20260605-821496');
}


function cleanupClaimAlertTestRows() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.alerts);

  if (!sheet) {
    return errorResponse('Claim_Alerts sheet not found.', {
      sheetName: CLAIM_SHEET_NAMES.alerts
    });
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return successResponse({
      removedCount: 0,
      removedRows: []
    }, 'No alert rows found to clean.');
  }

  const headers = values[0];
  const sourceSystemIndex = headers.indexOf('Source_System');
  const sourceRecordIdIndex = headers.indexOf('Source_Record_ID');
  const reasonIndex = headers.indexOf('Reason');
  const recommendedActionIndex = headers.indexOf('Recommended_Action');

  if (sourceSystemIndex === -1 || sourceRecordIdIndex === -1 || reasonIndex === -1 || recommendedActionIndex === -1) {
    return errorResponse('Required alert cleanup columns not found.', {
      headers: headers
    });
  }

  const removedRows = [];

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const row = values[rowIndex];
    const sourceSystem = row[sourceSystemIndex];
    const sourceRecordId = row[sourceRecordIdIndex];
    const reason = row[reasonIndex];
    const recommendedAction = row[recommendedActionIndex];

    const isClaimAlertTest = sourceSystem === 'claims-service hard write test'
      || sourceSystem === 'claims-service test'
      || sourceRecordId === 'TEST-HARD-ALERT-001'
      || sourceRecordId === 'TEST-ALERT-001'
      || reason === 'Hard write alert test.'
      || reason === 'AlertService test alert.'
      || recommendedAction === 'Verify Claim_Alerts direct write.'
      || recommendedAction === 'Review missing EOJ.';

    if (isClaimAlertTest) {
      const sheetRowNumber = rowIndex + 1;
      removedRows.push(sheetRowNumber);
      sheet.deleteRow(sheetRowNumber);
    }
  }

  return successResponse({
    removedCount: removedRows.length,
    removedRows: removedRows.reverse()
  }, 'Claim alert test rows cleaned successfully.');
}

function testCleanupClaimAlertTestRows() {
  const response = cleanupClaimAlertTestRows();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testAlertHeaders() {
  return successResponse({
    sheetName: CLAIM_SHEET_NAMES.alerts,
    headers: getHeaders(CLAIM_SHEET_NAMES.alerts)
  }, 'Alert sheet headers retrieved.');
}