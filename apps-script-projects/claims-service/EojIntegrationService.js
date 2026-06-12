/**
 * EOJ integration service.
 * Rainbow Phase 4 - Claim Foundation
 *
 * Consumes outputs from the EOJ Processing Engine and attaches them
 * to the Claim Foundation. Does not create calendar events, tasks,
 * or perform workflow automation.
 */

function processEojOutputs(claimId, eojOutputs) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const outputs = eojOutputs || {};
  const results = {
    timelineEvents: 0,
    conditions: 0,
    alerts: 0,
    ownershipChanges: 0
  };

  (outputs.timelineEvents || []).forEach(function(event) {
    appendTimelineEvent(claimId, event);
    results.timelineEvents++;
  });

  (outputs.conditions || []).forEach(function(condition) {
    addCondition(
      claimId,
      condition.Condition_Type,
      condition
    );
    results.conditions++;
  });

  (outputs.alerts || []).forEach(function(alert) {
    addAlert(
      claimId,
      alert.Alert_Type,
      alert
    );
    results.alerts++;
  });

  if (outputs.ownershipChange) {
    setOwnership(
      claimId,
      outputs.ownershipChange.Ownership_Area,
      outputs.ownershipChange.Primary_Owner,
      outputs.ownershipChange
    );

    results.ownershipChanges++;
  }

  updateClaim(claimId, {
    Last_EOJ_At: nowIso(),
    Last_Meaningful_Activity_At: nowIso()
  });

  writeServiceLog('processEojOutputs', 'Success', 'EOJ outputs processed.', {
    claimId: claimId,
    sourceSystem: 'eoj-processing-engine',
    results: results
  });

  return successResponse(results, 'EOJ outputs processed successfully.');
}

function attachEojTimelineEvent(claimId, event) {
  return appendTimelineEvent(claimId, event);
}

function attachEojCondition(claimId, conditionType, details) {
  return addCondition(claimId, conditionType, details);
}

function attachEojAlert(claimId, alertType, details) {
  return addAlert(claimId, alertType, details);
}

function updateClaimFromEoj(claimId, updates) {
  const payload = Object.assign({}, updates || {}, {
    Last_EOJ_At: nowIso(),
    Last_Meaningful_Activity_At: nowIso()
  });

  return updateClaim(claimId, payload);
}

function testProcessEojOutputs() {
  return processEojOutputs('CLM-20260605-821496', {
    timelineEvents: [{
      Event_Type: 'EOJ Submitted',
      Summary: 'Monitoring Visit Complete',
      Detail: 'EOJ integration test.',
      Source_System: 'eoj-processing-engine',
      Source_Record_ID: 'TEST-EOJ-001',
      Related_Workflow: 'EOJ',
      Is_Meaningful_Activity: true
    }],

    conditions: [{
      Condition_Type: 'Monitoring Active',
      Source_System: 'eoj-processing-engine',
      Source_Record_ID: 'TEST-EOJ-001',
      Reason: 'Monitoring visit recorded.'
    }],

    alerts: [],

    ownershipChange: {
      Ownership_Area: 'Field Operations',
      Primary_Owner: 'Blake',
      Source_System: 'eoj-processing-engine',
      Source_Record_ID: 'TEST-EOJ-001',
      Trigger_Event: 'EOJ processed.'
    }
  });
}

function cleanupNonCanonicalEojPhotoAlerts() {
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
  const alertTypeIndex = headers.indexOf('Alert_Type');

  if (alertTypeIndex === -1) {
    return errorResponse('Alert_Type column not found in Claim_Alerts.', {
      headers: headers
    });
  }

  const removedRows = [];

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const row = values[rowIndex];
    const alertType = row[alertTypeIndex];

    if (alertType === 'Missing EOJ Photos') {
      const sheetRowNumber = rowIndex + 1;
      removedRows.push(sheetRowNumber);
      sheet.deleteRow(sheetRowNumber);
    }
  }

  return successResponse({
    removedCount: removedRows.length,
    removedRows: removedRows.reverse()
  }, 'Non-canonical EOJ photo alerts cleaned successfully.');
}

function testCleanupNonCanonicalEojPhotoAlerts() {
  const response = cleanupNonCanonicalEojPhotoAlerts();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}