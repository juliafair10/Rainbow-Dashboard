/**
 * LifecycleEngineService
 * Rainbow Phase 6 - Lifecycle Engine
 *
 * Converts timeline/synthesized activity into a deterministic claim lifecycle state.
 * This service evaluates lifecycle only. It does not calculate health.
 */

const LIFECYCLE_STATES = {
  intake: 'Intake',
  activeWork: 'Active Work',
  insuranceResolution: 'Insurance Resolution',
  administrativeCloseout: 'Administrative Closeout',
  operationallyComplete: 'Operationally Complete',
  notSold: 'Not Sold'
};

function evaluateLifecycleState(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to evaluate lifecycle state.']);
  }

  const claimResult = getClaimById_(claimId);
  if (!claimResult.success) {
    return claimResult;
  }

  const activitiesResult = synthesizeClaimActivities(claimId);
  if (!activitiesResult.success) {
    return activitiesResult;
  }

  const claim = claimResult.data.claim;
  const activities = activitiesResult.data.activities || [];
  const evaluation = evaluateLifecycleFromActivities_(claim, activities);

  return successResponse(evaluation, 'Lifecycle state evaluated successfully.');
}

function evaluateLifecycleTransition(claimId) {
  const evaluationResult = evaluateLifecycleState(claimId);
  if (!evaluationResult.success) {
    return evaluationResult;
  }

  const evaluation = evaluationResult.data;
  const previousState = evaluation.previousState || '';
  const lifecycleState = evaluation.lifecycleState || '';

  return successResponse({
    claimId: claimId,
    previousState: previousState,
    lifecycleState: lifecycleState,
    transitionTriggered: previousState !== lifecycleState,
    reason: evaluation.reason,
    signals: evaluation.signals
  }, 'Lifecycle transition evaluated successfully.');
}

function applyLifecycleTransition(claimId) {
  const transitionResult = evaluateLifecycleTransition(claimId);
  if (!transitionResult.success) {
    return transitionResult;
  }

  const transition = transitionResult.data;

  if (!transition.transitionTriggered) {
    return successResponse(transition, 'No lifecycle transition required.');
  }

  const updateResult = updateClaim(claimId, {
    Lifecycle_State: transition.lifecycleState,
    Lifecycle_Updated_At: nowIso()
  });

  if (!updateResult.success) {
    return updateResult;
  }

  recordLifecycleTransition(claimId, transition.previousState, transition.lifecycleState, transition.reason);

  return successResponse({
    claimId: claimId,
    previousState: transition.previousState,
    lifecycleState: transition.lifecycleState,
    transitionTriggered: true,
    reason: transition.reason
  }, 'Lifecycle transition applied successfully.');
}

function recordLifecycleTransition(claimId, previousState, newState, reason) {
  return appendTimelineEvent(claimId, {
    Event_Type: 'Lifecycle Transition',
    Event_Source: 'LifecycleEngineService',
    Source_System: 'claims-service',
    Source_Record_ID: claimId,
    Summary: previousState + ' → ' + newState,
    Detail: reason || '',
    Actor: 'System',
    Related_Workflow: 'Lifecycle Engine',
    Is_Meaningful_Activity: true,
    Event_Category: 'Lifecycle',
    Display_Priority: 'normal',
    Visibility: 'primary',
    Updates_Last_Activity: true,
    Created_By: 'LifecycleEngineService'
  });
}

function evaluateLifecycleFromActivities_(claim, activities) {
  const previousState = claim.Lifecycle_State || claim.lifecycleState || LIFECYCLE_STATES.intake;
  const signals = getLifecycleSignals_(claim, activities);
  let lifecycleState = LIFECYCLE_STATES.intake;
  let reason = 'Claim remains in intake until operational activity indicates progression.';

  if (signals.notSold) {
    lifecycleState = LIFECYCLE_STATES.notSold;
    reason = 'Claim is marked not sold.';
  } else if (signals.allWorkComplete && signals.allPaymentsResolved) {
    lifecycleState = LIFECYCLE_STATES.operationallyComplete;
    reason = 'Operational work is complete and payments appear resolved.';
  } else if (signals.waitingOnPayment || signals.paymentActivity) {
    lifecycleState = LIFECYCLE_STATES.administrativeCloseout;
    reason = 'Claim has moved into payment or administrative closeout activity.';
  } else if ((signals.fieldWorkActivity || signals.monitoringActivity || signals.eojActivity) && !signals.allWorkComplete) {
    lifecycleState = LIFECYCLE_STATES.activeWork;
    reason = 'Claim has active field work, monitoring, or EOJ activity that has not been completed.';
  } else if (signals.revisionActivity || signals.carrierActivity || signals.coverageOrEstimateActivity) {
    lifecycleState = LIFECYCLE_STATES.insuranceResolution;
    reason = 'Claim has insurance, carrier, estimate, revision, or payment-resolution activity after field work.';
  } else if (signals.intakeActivity) {
    lifecycleState = LIFECYCLE_STATES.intake;
    reason = 'Claim has intake activity but no field or insurance-resolution activity yet.';
  }

  return {
    claimId: claim.Claim_ID,
    previousState: previousState,
    lifecycleState: lifecycleState,
    transitionTriggered: previousState !== lifecycleState,
    reason: reason,
    signals: signals
  };
}

function getLifecycleSignals_(claim, activities) {
  const text = getLifecycleActivityText_(activities);

  return {
    intakeActivity: text.indexOf('INTAKE') !== -1 || text.indexOf('CLAIM FOLDER') !== -1,
    fieldWorkActivity: text.indexOf('FIELD WORK') !== -1 || text.indexOf('INSPECTION') !== -1 || text.indexOf('DEMO') !== -1 || text.indexOf('DRYING') !== -1,
    monitoringActivity: text.indexOf('MONITORING') !== -1,
    eojActivity: text.indexOf('EOJ') !== -1,
    revisionActivity: text.indexOf('REVISION SUBMITTED') !== -1 || text.indexOf('REVISION REQUESTED') !== -1 || text.indexOf('REVISION ACTIVITY') !== -1 || text.indexOf('SUPPLEMENT UNDER REVIEW') !== -1,
    carrierActivity: text.indexOf('CARRIER') !== -1 || text.indexOf('INSURANCE') !== -1,
    coverageOrEstimateActivity: text.indexOf('COVERAGE') !== -1 || text.indexOf('ESTIMATE') !== -1,
    paymentActivity: text.indexOf('PAYMENT') !== -1 || text.indexOf('REMITTANCE') !== -1,
    waitingOnPayment: text.indexOf('WAITING ON PAYMENT') !== -1,
    allWorkComplete: text.indexOf('WORK COMPLETE') !== -1 || text.indexOf('FIELD WORK COMPLETED') !== -1,
    allPaymentsResolved: text.indexOf('PAYMENT RECONCILED') !== -1 || text.indexOf('PAYMENT RESOLVED') !== -1,
    notSold: String(claim.Lifecycle_State || '').toUpperCase() === 'NOT SOLD' || String(claim.Status || '').toUpperCase() === 'NOT SOLD'
  };
}

function getLifecycleActivityText_(activities) {
  const parts = [];

  (activities || []).forEach(function(activity) {
    parts.push(activity.activityType || '');
    parts.push(activity.activityLabel || '');
    parts.push(activity.summary || '');

    (activity.events || []).forEach(function(event) {
      parts.push(event.Event_Type || '');
      parts.push(event.Summary || '');
      parts.push(event.Detail || '');
      parts.push(event.Related_Workflow || '');
      parts.push(event.Event_Category || '');
    });
  });

  return parts.join(' | ').toUpperCase();
}

function getClaimById_(claimId) {
  const claimLookup = lookupClaim({ Claim_ID: claimId });

  if (claimLookup && claimLookup.success) {
    return successResponse({
      claim: claimLookup.data.claim
    }, 'Claim found.');
  }

  const claims = typeof findConditionEngineClaimsRows_ === 'function'
    ? findConditionEngineClaimsRows_()
    : [];

  const fallbackClaim = (claims || []).find(function(claim) {
    return getConditionEngineClaimIdFromRow_(claim) === claimId;
  });

  if (!fallbackClaim) {
    return validationErrorResponse([
      'Claim not found by Claim_ID: ' + claimId,
      'Primary lookup message: ' + (claimLookup && claimLookup.message ? claimLookup.message : '')
    ]);
  }

  return successResponse({
    claim: fallbackClaim
  }, 'Claim found by lifecycle fallback row lookup.');
}

function testEvaluateLifecycle() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = evaluateLifecycleState(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testEvaluateLifecycleTransition() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = evaluateLifecycleTransition(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testApplyLifecycleTransition() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = applyLifecycleTransition(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testLifecycleEngineBatchReadiness() {
  const claims = typeof findConditionEngineClaimsRows_ === 'function'
    ? findConditionEngineClaimsRows_()
    : [];

  if (!claims || !claims.length) {
    return validationErrorResponse(['Unable to load claims for lifecycle batch readiness test.']);
  }
  const activeClaims = claims.filter(function(claim) {
    const state = String(getConditionEngineLifecycleStateFromRow_(claim)).trim();
    return state !== 'Operationally Complete' && state !== 'Not Sold';
  });

  const stateCounts = {};
  const samples = activeClaims.slice(0, 10).map(function(claim) {
    const claimId = getConditionEngineClaimIdFromRow_(claim);
    const jobNumber = getConditionEngineJobNumberFromRow_(claim);
    const result = evaluateLifecycleState(claimId);
    const lifecycleState = result.success ? result.data.lifecycleState : 'Error';

    stateCounts[lifecycleState] = (stateCounts[lifecycleState] || 0) + 1;

    return {
      claimId: claimId,
      jobNumber: jobNumber,
      previousState: result.success ? result.data.previousState : '',
      lifecycleState: lifecycleState,
      transitionTriggered: result.success ? result.data.transitionTriggered : false,
      reason: result.success ? result.data.reason : '',
      signals: result.success ? result.data.signals : null,
      success: result.success,
      message: result.message || '',
      errors: result.errors || [],
      rawStatus: result.status || ''
    };
  });

  const response = successResponse({
    totalClaimRows: claims.length,
    activeClaimRows: activeClaims.length,
    sampledClaimRows: samples.length,
    sampledStateCounts: stateCounts,
    sampleEvaluations: samples
  }, 'Lifecycle Engine batch readiness checked.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}