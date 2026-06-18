

/**
 * OwnershipEngineService
 * Rainbow Phase 6 - Ownership Engine
 *
 * Determines operational ownership from lifecycle state and active conditions.
 * This service is deterministic and explainable. It does not calculate health.
 */

const OWNERSHIP_AREAS = {
  intake: 'Intake',
  fieldOperations: 'Field Operations',
  revisionManagement: 'Revision Management',
  accountingOffice: 'Office Operations'
};

function evaluateOwnership(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to evaluate ownership.']);
  }

  const claimResult = getOwnershipEngineClaimById_(claimId);
  if (!claimResult.success) {
    return claimResult;
  }

  const lifecycleResult = evaluateLifecycleState(claimId);
  if (!lifecycleResult.success) {
    return lifecycleResult;
  }

  const conditions = getActiveOwnershipConditionsForClaim_(claimId);
  const ownershipEvaluation = evaluateOwnershipFromState_(claimResult.data.claim, lifecycleResult.data, conditions);

  return successResponse(ownershipEvaluation, 'Ownership evaluated successfully.');
}

function applyOwnershipTransition(claimId) {
  const ownershipResult = evaluateOwnership(claimId);
  if (!ownershipResult.success) {
    return ownershipResult;
  }

  const ownership = ownershipResult.data;

  if (!ownership.transitionTriggered) {
    return successResponse(ownership, 'No ownership transition required.');
  }

  const updateResult = updateClaim(claimId, {
    Ownership_Area: ownership.ownerArea,
    Owner_Updated_At: nowIso(),
    Updated_At: nowIso()
  });

  if (!updateResult.success) {
    return updateResult;
  }

  recordOwnershipChange(claimId, ownership.previousOwnerArea, ownership.ownerArea, ownership.reason);

  return successResponse({
    claimId: claimId,
    previousOwnerArea: ownership.previousOwnerArea,
    ownerArea: ownership.ownerArea,
    transitionTriggered: true,
    reason: ownership.reason,
    signals: ownership.signals
  }, 'Ownership transition applied successfully.');
}

function recordOwnershipChange(claimId, previousOwnerArea, newOwnerArea, reason) {
  return appendTimelineEvent(claimId, {
    Event_Type: 'Ownership Changed',
    Event_Source: 'OwnershipEngineService',
    Source_System: 'claims-service',
    Source_Record_ID: claimId,
    Summary: previousOwnerArea + ' → ' + newOwnerArea,
    Detail: reason || '',
    Actor: 'System',
    Related_Workflow: 'Ownership Engine',
    Event_Category: 'Ownership',
    Is_Meaningful_Activity: true,
    Updates_Last_Activity: true,
    Display_Priority: 'normal',
    Visibility: 'primary',
    Created_By: 'OwnershipEngineService'
  });
}

function evaluateOwnershipFromState_(claim, lifecycleEvaluation, activeConditions) {
  const previousOwnerArea = claim.Ownership_Area || claim.Owner_Area || claim.ownerArea || OWNERSHIP_AREAS.intake;
  const lifecycleState = lifecycleEvaluation.lifecycleState || claim.Lifecycle_State || '';
  const conditionNames = activeConditions.map(function(condition) {
    return getOwnershipConditionName_(condition);
  }).filter(function(conditionName) {
    return conditionName !== '';
  });

  const signals = getOwnershipSignals_(lifecycleState, conditionNames);
  let ownerArea = OWNERSHIP_AREAS.intake;
  let reason = 'Claim remains with Intake until field, revision, or accounting ownership is indicated.';

  if (signals.accountingOwned) {
    ownerArea = OWNERSHIP_AREAS.accountingOffice;
    reason = 'Claim is in administrative closeout or waiting on payment.';
  } else if (signals.revisionOwned) {
    ownerArea = OWNERSHIP_AREAS.revisionManagement;
    reason = 'Claim has active revision, supplement, or carrier revision activity.';
  } else if (signals.fieldOwned) {
    ownerArea = OWNERSHIP_AREAS.fieldOperations;
    reason = 'Claim has active field operations, monitoring, asbestos, lab, or abatement conditions.';
  } else if (signals.intakeOwned) {
    ownerArea = OWNERSHIP_AREAS.intake;
    reason = 'Claim is still in intake.';
  }

  return {
    claimId: claim.Claim_ID,
    previousOwnerArea: previousOwnerArea,
    ownerArea: ownerArea,
    transitionTriggered: previousOwnerArea !== ownerArea,
    reason: reason,
    lifecycleState: lifecycleState,
    activeConditions: conditionNames,
    signals: signals
  };
}

function getOwnershipSignals_(lifecycleState, conditionNames) {
  const state = String(lifecycleState || '').toUpperCase();
  const conditionText = (conditionNames || []).join(' | ').toUpperCase();

  return {
    intakeOwned: state === 'INTAKE',
    fieldOwned: state === 'ACTIVE WORK' ||
      conditionText.indexOf('MONITORING ACTIVE') !== -1 ||
      conditionText.indexOf('ASBESTOS TESTING PENDING') !== -1 ||
      conditionText.indexOf('WAITING ON LAB RESULTS') !== -1 ||
      conditionText.indexOf('POSITIVE ASBESTOS RESULT') !== -1 ||
      conditionText.indexOf('ABATEMENT REQUIRED') !== -1,
    revisionOwned: conditionText.indexOf('CARRIER REVISION REQUESTED') !== -1 ||
      conditionText.indexOf('REVISION ACTIVE') !== -1 ||
      conditionText.indexOf('SUPPLEMENT UNDER REVIEW') !== -1,
    accountingOwned: state === 'ADMINISTRATIVE CLOSEOUT' ||
      state === 'OPERATIONALLY COMPLETE' ||
      conditionText.indexOf('WAITING ON PAYMENT') !== -1
  };
}

function getActiveOwnershipConditionsForClaim_(claimId) {
  const rows = findRows(CLAIM_SHEET_NAMES.conditions, {
    Claim_ID: claimId
  });

  return rows.filter(function(row) {
    const status = String(row.Status || row.Condition_Status || '').toUpperCase();
    return status === '' || status === 'ACTIVE';
  });
}

function getOwnershipConditionName_(condition) {
  if (!condition) {
    return '';
  }

  return condition.Condition_Name ||
    condition.Condition_Type ||
    condition.Condition ||
    condition.conditionName ||
    '';
}

function getOwnershipEngineClaimById_(claimId) {
  const claimLookup = lookupClaim({ Claim_ID: claimId });

  if (!claimLookup.success) {
    return claimLookup;
  }

  return successResponse({
    claim: claimLookup.data.claim
  }, 'Claim found.');
}

function testEvaluateOwnership() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = evaluateOwnership(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testApplyOwnershipTransition() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = applyOwnershipTransition(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testOwnershipSignals() {
  const signals = getOwnershipSignals_('Active Work', [
    'Monitoring Active',
    'Coverage Pending'
  ]);

  Logger.log(JSON.stringify(signals, null, 2));
  return signals;
}

function testLookupClaimForOwnership() {
  const result = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
function testOwnershipDistribution() {
  const claims = getRows(CLAIM_SHEET_NAMES.claims);

  const result = claims.reduce(function(summary, claim) {
    const area = claim.Ownership_Area || '(blank)';
    summary[area] = (summary[area] || 0) + 1;
    return summary;
  }, {});

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testOwnershipEvaluationDistribution() {
  const claims = getRows(CLAIM_SHEET_NAMES.claims);

  const result = claims.reduce(function(summary, claim) {
    const claimId = claim.Claim_ID;
    const evaluation = evaluateOwnership(claimId);

    const currentArea = claim.Ownership_Area || '(blank)';
    const proposedArea = evaluation && evaluation.success && evaluation.data
      ? evaluation.data.ownerArea
      : '(evaluation failed)';

    const key = currentArea + ' -> ' + proposedArea;
    summary[key] = (summary[key] || 0) + 1;

    return summary;
  }, {});

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function applyOwnershipTransitionsForAllClaims() {
  const claims = getRows(CLAIM_SHEET_NAMES.claims);

  const result = claims.reduce(function(summary, claim) {
    const claimId = claim.Claim_ID;

    if (!claimId) {
      summary.skippedMissingClaimId++;
      return summary;
    }

    const ownershipResult = evaluateOwnership(claimId);

    if (!ownershipResult || !ownershipResult.success || !ownershipResult.data) {
      summary.failed++;
      return summary;
    }

    const ownership = ownershipResult.data;
    const currentArea = claim.Ownership_Area || '(blank)';
    const proposedArea = ownership.ownerArea || '';
    const transitionKey = currentArea + ' -> ' + proposedArea;

    summary.preview[transitionKey] = (summary.preview[transitionKey] || 0) + 1;

    if (!ownership.transitionTriggered) {
      summary.unchanged++;
      return summary;
    }

    const applyResult = applyOwnershipTransition(claimId);

    if (!applyResult || !applyResult.success) {
      summary.failed++;
      return summary;
    }

    summary.updated++;
    summary.applied[transitionKey] = (summary.applied[transitionKey] || 0) + 1;
    return summary;
  }, {
    totalClaims: claims.length,
    updated: 0,
    unchanged: 0,
    failed: 0,
    skippedMissingClaimId: 0,
    preview: {},
    applied: {}
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function applyOwnershipAreasDirectFast() {
  const claims = getRows(CLAIM_SHEET_NAMES.claims);
  const result = {
    totalClaims: claims.length,
    updated: 0,
    unchanged: 0,
    failed: 0,
    preview: {},
    failures: []
  };

  claims.forEach(function(claim) {
    const claimId = claim.Claim_ID;
    if (!claimId) {
      result.failed++;
      return;
    }

    const ownershipResult = evaluateOwnership(claimId);
    if (!ownershipResult || !ownershipResult.success || !ownershipResult.data) {
      result.failed++;
      result.failures.push({ claimId: claimId, message: 'Evaluation failed' });
      return;
    }

    const proposedArea = ownershipResult.data.ownerArea;
    const currentArea = claim.Ownership_Area || '';
    const key = currentArea + ' -> ' + proposedArea;
    result.preview[key] = (result.preview[key] || 0) + 1;

    if (currentArea === proposedArea) {
      result.unchanged++;
      return;
    }

    const updateResult = updateClaim(claimId, {
      Ownership_Area: proposedArea,
      Owner_Updated_At: nowIso(),
      Updated_At: nowIso()
    });

    if (!updateResult || !updateResult.success) {
      result.failed++;
      result.failures.push({ claimId: claimId, message: updateResult ? updateResult.message : 'Update failed' });
      return;
    }

    result.updated++;
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
