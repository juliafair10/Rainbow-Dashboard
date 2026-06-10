/****
 * HealthEngineService
 *
 * Phase 7
 * Operational Health Engine
 *
 * Current scope:
 * - gather health inputs
 * - evaluate basic health
 * - apply health to Claims sheet
 *
 * Future phases:
 * - history tracking
 * - suppression rules
 * - overrides
 * - escalation persistence
 */

function evaluateClaimHealth(claimId) {
  try {
    const targetClaimId = claimId || getFirstClaimIdForHealthTest_();
    const inputs = gatherHealthInputs_(targetClaimId);

    const result = {
      claimId: targetClaimId,
      healthLevel: determineHealthLevel_(inputs),
      healthReason: determineHealthReason_(inputs),
      lifecycleState: inputs.lifecycleState,
      ownershipArea: inputs.ownershipArea,
      activeConditions: inputs.activeConditions,
      lastMeaningfulActivityAt: inputs.lastMeaningfulActivityAt,
      evaluatedAt: nowIso()
    };

    return successResponse(
      result,
      'Claim health evaluated successfully.'
    );

  } catch (error) {
    writeServiceLog(
      'evaluateClaimHealth',
      'Error',
      error.message,
      {
        claimId: claimId || '',
        error: error
      }
    );

    const response = errorResponse(
      'Failed to evaluate claim health.',
      {
        message: error.message,
        stack: error.stack
      }
    );

    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }
}

function applyClaimHealth(claimId) {
  try {
    const targetClaimId = claimId || getFirstClaimIdForHealthTest_();
    const evaluation = evaluateClaimHealth(targetClaimId);

    if (!evaluation.success) {
      return evaluation;
    }

    const evaluatedAt = evaluation.data.evaluatedAt || nowIso();

    const updateResult = updateClaim(targetClaimId, {
      Operational_Health: evaluation.data.healthLevel,
      Health_Reason: evaluation.data.healthReason,
      Health_Updated_At: evaluatedAt
    });

    if (!updateResult.success) {
      return updateResult;
    }

    const response = successResponse({
      claimId: targetClaimId,
      healthLevel: evaluation.data.healthLevel,
      healthReason: evaluation.data.healthReason,
      healthUpdatedAt: evaluatedAt,
      updateResult: updateResult
    }, 'Claim health applied successfully.');

    Logger.log(JSON.stringify(response, null, 2));
    return response;

  } catch (error) {
    writeServiceLog(
      'applyClaimHealth',
      'Error',
      error.message,
      {
        claimId: claimId || '',
        error: error
      }
    );

    const response = errorResponse(
      'Failed to apply claim health.',
      {
        message: error.message,
        stack: error.stack
      }
    );

    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }
}

function gatherHealthInputs_(claimId) {
  const claims = getRows(CLAIM_SHEET_NAMES.claims);
  const claim = claims.find(function(row) {
    return row.Claim_ID === claimId;
  });

  if (!claim) {
    throw new Error('Claim not found: ' + claimId);
  }

  const conditions = getRows(CLAIM_SHEET_NAMES.conditions);
  const activeConditions = conditions.filter(function(condition) {
    return condition.Claim_ID === claimId &&
      condition.Condition_Type &&
      condition.Condition_Status &&
      String(condition.Condition_Status).toLowerCase() !== 'closed' &&
      String(condition.Condition_Status).toLowerCase() !== 'resolved';
  });

  return {
    claimId: claimId,
    claim: claim,

    lifecycleState: claim.Lifecycle_State || '',
    ownershipArea: claim.Ownership_Area || '',

    activeConditions: activeConditions,

    operationalHealth: claim.Operational_Health || 'Healthy',

    lastMeaningfulActivityAt:
      claim.Last_Meaningful_Activity_At || '',

    lastEOJAt:
      claim.Last_EOJ_At || '',

    lastPaymentAt:
      claim.Last_Payment_At || '',

    lastRevisionAt:
      claim.Last_Revision_At || '',

    lastCarrierActivityAt:
      claim.Last_Carrier_Activity_At || '',

    lastFollowUpAt:
      claim.Last_Follow_Up_At || ''
  };
}

function determineHealthLevel_(inputs) {

  if (
    inputs.lifecycleState === 'Operationally Complete' ||
    inputs.lifecycleState === 'Not Sold'
  ) {
    return 'Healthy';
  }

  if (hasActiveCondition_(inputs, 'Monitoring Active')) {
    const monitoringCondition = getActiveCondition_(inputs, 'Monitoring Active');

    if (!monitoringCondition.Follow_Up_Date) {
      return 'At Risk';
    }
  }

  if (hasActiveCondition_(inputs, 'Positive Asbestos Result')) {
    return 'Attention Soon';
  }

  if (hasActiveCondition_(inputs, 'Carrier Revision Requested')) {
    return 'Attention Soon';
  }

  if (hasActiveCondition_(inputs, 'Coverage Pending')) {
    const coverageCondition = getActiveCondition_(inputs, 'Coverage Pending');
    const daysOpen = daysSince_(coverageCondition.Opened_At);

    if (daysOpen >= HEALTH_CONFIG.staleAtRiskDays) {
      return 'At Risk';
    }

    if (daysOpen >= HEALTH_CONFIG.coverageFollowupDays) {
      return 'Attention Soon';
    }
  }

  return 'Healthy';
}

function determineHealthReason_(inputs) {

  if (
    inputs.lifecycleState === 'Operationally Complete'
  ) {
    return 'Claim is operationally complete.';
  }

  if (
    inputs.lifecycleState === 'Not Sold'
  ) {
    return 'Claim was not sold.';
  }

  if (hasActiveCondition_(inputs, 'Monitoring Active')) {
    const monitoringCondition = getActiveCondition_(inputs, 'Monitoring Active');

    if (!monitoringCondition.Follow_Up_Date) {
      return 'Monitoring is active, but no follow-up or next monitoring date is scheduled.';
    }

    return 'Monitoring is active with a scheduled follow-up date.';
  }

  if (hasActiveCondition_(inputs, 'Positive Asbestos Result')) {
    return 'Positive asbestos result requires abatement coordination.';
  }

  if (hasActiveCondition_(inputs, 'Carrier Revision Requested')) {
    return 'Carrier revision has been requested and requires action.';
  }

  if (hasActiveCondition_(inputs, 'Coverage Pending')) {
    const coverageCondition = getActiveCondition_(inputs, 'Coverage Pending');
    const daysOpen = daysSince_(coverageCondition.Opened_At);

    if (daysOpen >= HEALTH_CONFIG.staleAtRiskDays) {
      return 'Coverage has been pending beyond the At Risk threshold.';
    }

    if (daysOpen >= HEALTH_CONFIG.coverageFollowupDays) {
      return 'Coverage has been pending long enough to need follow-up soon.';
    }

    return 'Coverage is pending within the expected follow-up window.';
  }

  return 'No active health-driving condition requires attention.';
}

function hasActiveCondition_(inputs, conditionType) {
  return !!getActiveCondition_(inputs, conditionType);
}

function getActiveCondition_(inputs, conditionType) {
  return (inputs.activeConditions || []).find(function(condition) {
    return condition.Condition_Type === conditionType;
  }) || null;
}

function daysSince_(isoDate) {
  if (!isoDate) {
    return 0;
  }

  const date = new Date(isoDate);

  if (isNaN(date.getTime())) {
    return 0;
  }

  const now = new Date();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((now.getTime() - date.getTime()) / millisecondsPerDay);
}

function getFirstClaimIdForHealthTest_() {
  const claims = getRows(CLAIM_SHEET_NAMES.claims);

  if (!claims.length || !claims[0].Claim_ID) {
    throw new Error('No claims available for health evaluation.');
  }

  return claims[0].Claim_ID;
}

function testEvaluateClaimHealth() {
  const response = evaluateClaimHealth();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testApplyClaimHealth() {
  const response = applyClaimHealth();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}