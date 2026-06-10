

/**
 * StateIntelligenceService
 * Rainbow Phase 6
 *
 * Orchestrates Lifecycle -> Conditions -> Ownership.
 */

function evaluateClaimStateIntelligence(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const lifecycleResult = evaluateLifecycleTransition(claimId);
  if (!lifecycleResult.success) {
    return lifecycleResult;
  }

  const conditionResult = reconcileClaimConditions(claimId);
  if (!conditionResult.success) {
    return conditionResult;
  }

  const ownershipResult = evaluateOwnership(claimId);
  if (!ownershipResult.success) {
    return ownershipResult;
  }

  return successResponse({
    claimId: claimId,
    lifecycle: lifecycleResult.data,
    conditions: {
      recommendedConditions: conditionResult.data.recommendedConditions,
      activeConditionNames: conditionResult.data.activeConditionNames,
      added: conditionResult.data.added,
      removed: conditionResult.data.removed
    },
    ownership: ownershipResult.data
  }, 'State intelligence evaluated successfully.');
}

function applyClaimStateIntelligence(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const lifecycleResult = applyLifecycleTransition(claimId);
  if (!lifecycleResult.success) {
    return lifecycleResult;
  }

  const conditionResult = reconcileClaimConditions(claimId);
  if (!conditionResult.success) {
    return conditionResult;
  }

  const ownershipResult = applyOwnershipTransition(claimId);
  if (!ownershipResult.success) {
    return ownershipResult;
  }

  return successResponse({
    claimId: claimId,
    lifecycle: lifecycleResult.data,
    conditions: {
      recommendedConditions: conditionResult.data.recommendedConditions,
      activeConditionNames: conditionResult.data.activeConditionNames,
      added: conditionResult.data.added,
      removed: conditionResult.data.removed
    },
    ownership: ownershipResult.data
  }, 'State intelligence applied successfully.');
}

function testEvaluateStateIntelligence() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = evaluateClaimStateIntelligence(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testApplyStateIntelligence() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = applyClaimStateIntelligence(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}