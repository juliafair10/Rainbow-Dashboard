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