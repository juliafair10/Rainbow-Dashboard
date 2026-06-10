

/**
 * ConditionEngineService
 * Rainbow Phase 6 - Condition Engine
 *
 * Evaluates active operational conditions from timeline/synthesized activity.
 * This service is deterministic and explainable. It does not calculate health.
 */

const CONDITION_ENGINE_CONDITIONS = {
  waitingOnCustomerDecision: 'Waiting on Customer Decision',
  sourceOfLossUnresolved: 'Source of Loss Unresolved',
  monitoringActive: 'Monitoring Active',
  asbestosTestingPending: 'Asbestos Testing Pending',
  waitingOnLabResults: 'Waiting on Lab Results',
  positiveAsbestosResult: 'Positive Asbestos Result',
  abatementRequired: 'Abatement Required',
  coveragePending: 'Coverage Pending',
  estimateUnderReview: 'Estimate Under Review',
  carrierRevisionRequested: 'Carrier Revision Requested',
  revisionActive: 'Revision Active',
  supplementUnderReview: 'Supplement Under Review',
  waitingOnPayment: 'Waiting on Payment'
};

function evaluateClaimConditions(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to evaluate conditions.']);
  }

  const claimResult = getConditionEngineClaimById_(claimId);
  if (!claimResult.success) {
    return claimResult;
  }

  const activitiesResult = synthesizeClaimActivities(claimId);
  if (!activitiesResult.success) {
    return activitiesResult;
  }

  const claim = claimResult.data.claim;
  const activities = activitiesResult.data.activities || [];
  const signals = getConditionSignals_(claim, activities);
  const recommendedConditions = deriveRecommendedConditions_(signals);

  return successResponse({
    claimId: claimId,
    recommendedConditions: recommendedConditions,
    signals: signals
  }, 'Claim conditions evaluated successfully.');
}

function reconcileClaimConditions(claimId) {
  const evaluationResult = evaluateClaimConditions(claimId);
  if (!evaluationResult.success) {
    return evaluationResult;
  }

  const recommendedConditions = evaluationResult.data.recommendedConditions || [];
  const activeConditions = getActiveConditionsForClaim_(claimId);
  const activeConditionNames = activeConditions.map(function(condition) {
    return getConditionEngineConditionName_(condition);
  }).filter(function(conditionName) {
    return conditionName !== '';
  });

  const toAdd = recommendedConditions.filter(function(conditionName) {
    return activeConditionNames.indexOf(conditionName) === -1;
  });

  // Phase 6 v1 safety rule:
  // Do not automatically remove active conditions just because the current
  // timeline does not re-detect them. Conditions should only be removed when
  // a clear resolution signal exists. Resolution-specific rules will be added
  // later after Condition Engine add/reconcile behavior is proven stable.
  const toRemove = [];

  const addResults = toAdd.map(function(conditionName) {
    return addCondition(claimId, conditionName, 'Condition Engine');
  });

  const removeResults = toRemove.map(function(conditionName) {
    return removeCondition(claimId, conditionName, 'Condition Engine');
  });

  return successResponse({
    claimId: claimId,
    recommendedConditions: recommendedConditions,
    activeConditionNames: activeConditionNames,
    added: toAdd,
    removed: toRemove,
    addResults: addResults,
    removeResults: removeResults,
    signals: evaluationResult.data.signals,
    removalPolicy: 'No automatic removals in Phase 6 v1 without explicit resolution signal.'
  }, 'Claim conditions reconciled successfully.');
}

function addCondition(claimId, conditionName, source) {
  if (!claimId || !conditionName) {
    return validationErrorResponse(['Claim_ID and conditionName are required to add a condition.']);
  }

  if (typeof addClaimCondition === 'function') {
    return addClaimCondition(claimId, {
      Condition_Name: conditionName,
      Condition_Source: source || 'ConditionEngineService',
      Status: 'Active',
      Started_At: nowIso(),
      Notes: 'Added by Condition Engine.'
    });
  }

  return appendConditionEngineFallbackRow_(claimId, conditionName, 'Active', source || 'ConditionEngineService');
}

function removeCondition(claimId, conditionName, source) {
  if (!claimId || !conditionName) {
    return validationErrorResponse(['Claim_ID and conditionName are required to remove a condition.']);
  }

  if (typeof resolveClaimCondition === 'function') {
    return resolveClaimCondition(claimId, conditionName, {
      Resolved_By: source || 'ConditionEngineService',
      Resolved_At: nowIso(),
      Resolution_Notes: 'Removed by Condition Engine.'
    });
  }

  return appendConditionEngineFallbackRow_(claimId, conditionName, 'Resolved', source || 'ConditionEngineService');
}

function deriveRecommendedConditions_(signals) {
  const conditions = [];

  if (signals.monitoringActive) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.monitoringActive);
  }

  if (signals.asbestosTestingPending) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.asbestosTestingPending);
  }

  if (signals.waitingOnLabResults) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.waitingOnLabResults);
  }

  if (signals.positiveAsbestosResult) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.positiveAsbestosResult);
  }

  if (signals.abatementRequired) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.abatementRequired);
  }

  if (signals.coveragePending) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.coveragePending);
  }

  if (signals.estimateUnderReview) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.estimateUnderReview);
  }

  if (signals.carrierRevisionRequested) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.carrierRevisionRequested);
  }

  if (signals.revisionActive) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.revisionActive);
  }

  if (signals.supplementUnderReview) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.supplementUnderReview);
  }

  if (signals.waitingOnPayment) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.waitingOnPayment);
  }

  if (signals.waitingOnCustomerDecision) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.waitingOnCustomerDecision);
  }

  if (signals.sourceOfLossUnresolved) {
    conditions.push(CONDITION_ENGINE_CONDITIONS.sourceOfLossUnresolved);
  }

  return conditions;
}

function getConditionSignals_(claim, activities) {
  const text = getConditionActivityText_(activities);

  return {
    monitoringActive: text.indexOf('MONITORING') !== -1 && text.indexOf('MONITORING COMPLETE') === -1,
    asbestosTestingPending: text.indexOf('ASBESTOS TESTING') !== -1 || text.indexOf('ASBESTOS TESTING PENDING') !== -1,
    waitingOnLabResults: text.indexOf('WAITING ON LAB') !== -1 || text.indexOf('LAB RESULTS') !== -1,
    positiveAsbestosResult: text.indexOf('POSITIVE ASBESTOS') !== -1,
    abatementRequired: text.indexOf('ABATEMENT REQUIRED') !== -1 || text.indexOf('SCHEDULE ABATEMENT') !== -1,
    coveragePending: text.indexOf('COVERAGE PENDING') !== -1,
    estimateUnderReview: text.indexOf('ESTIMATE UNDER REVIEW') !== -1 || text.indexOf('ESTIMATE REVIEW') !== -1,
    carrierRevisionRequested: text.indexOf('CARRIER REVISION REQUESTED') !== -1 || text.indexOf('CARRIER REQUESTED REVISION') !== -1,
    revisionActive: text.indexOf('REVISION ACTIVE') !== -1 || text.indexOf('REVISION SUBMITTED') !== -1 || text.indexOf('REVISION REQUESTED') !== -1,
    supplementUnderReview: text.indexOf('SUPPLEMENT UNDER REVIEW') !== -1 || text.indexOf('SUPPLEMENT SUBMITTED') !== -1,
    waitingOnPayment: text.indexOf('WAITING ON PAYMENT') !== -1 || text.indexOf('PAYMENT PENDING') !== -1,
    waitingOnCustomerDecision: text.indexOf('WAITING ON CUSTOMER') !== -1 || text.indexOf('CUSTOMER DECISION') !== -1,
    sourceOfLossUnresolved: text.indexOf('SOURCE OF LOSS UNRESOLVED') !== -1 || text.indexOf('CAUSE OF LOSS UNRESOLVED') !== -1
  };
}

function getConditionActivityText_(activities) {
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

function getActiveConditionsForClaim_(claimId) {
  const rows = findRows(CLAIM_SHEET_NAMES.conditions, {
    Claim_ID: claimId
  });

  return rows.filter(function(row) {
    const status = String(row.Status || row.Condition_Status || '').toUpperCase();
    return status === '' || status === 'ACTIVE';
  });
}

function getConditionEngineConditionName_(condition) {
  if (!condition) {
    return '';
  }

  return condition.Condition_Name ||
    condition.Condition_Type ||
    condition.Condition ||
    condition.conditionName ||
    '';
}

function isConditionEngineManagedCondition_(conditionName) {
  const managedConditions = Object.keys(CONDITION_ENGINE_CONDITIONS).map(function(key) {
    return CONDITION_ENGINE_CONDITIONS[key];
  });

  return managedConditions.indexOf(conditionName) !== -1;
}

function appendConditionEngineFallbackRow_(claimId, conditionName, status, source) {
  const row = {
    Condition_ID: generateId('CON'),
    Claim_ID: claimId,
    Condition_Name: conditionName,
    Status: status,
    Condition_Source: source || 'ConditionEngineService',
    Started_At: status === 'Active' ? nowIso() : '',
    Resolved_At: status === 'Resolved' ? nowIso() : '',
    Notes: status + ' by Condition Engine.',
    Created_At: nowIso(),
    Updated_At: nowIso()
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.conditions, row);

  appendTimelineEvent(claimId, {
    Event_Type: status === 'Active' ? 'Condition Added' : 'Condition Removed',
    Event_Source: 'ConditionEngineService',
    Source_System: 'claims-service',
    Source_Record_ID: row.Condition_ID,
    Summary: conditionName,
    Detail: status + ' by Condition Engine.',
    Actor: 'System',
    Related_Workflow: 'Condition Engine',
    Event_Category: 'Condition',
    Is_Meaningful_Activity: true,
    Updates_Last_Activity: true,
    Display_Priority: 'normal',
    Visibility: 'primary',
    Created_By: 'ConditionEngineService'
  });

  return successResponse({
    condition: row,
    appendResult: appendResult
  }, 'Condition ' + status.toLowerCase() + ' successfully.');
}

function getConditionEngineClaimById_(claimId) {
  const claimLookup = lookupClaim({ Claim_ID: claimId });

  if (!claimLookup.success) {
    return claimLookup;
  }

  return successResponse({
    claim: claimLookup.data.claim
  }, 'Claim found.');
}

function testEvaluateConditions() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = evaluateClaimConditions(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testReconcileConditions() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = reconcileClaimConditions(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testConditionSignals() {
  const sampleSignals = getConditionSignals_({}, [
    {
      activityType: 'Monitoring',
      activityLabel: 'Monitoring Visit Completed',
      summary: 'Monitoring Visit Completed',
      events: [
        {
          Event_Type: 'Condition Added',
          Summary: 'Monitoring Active',
          Detail: 'Monitoring visit recorded.',
          Event_Category: 'Condition'
        }
      ]
    }
  ]);

  Logger.log(JSON.stringify(sampleSignals, null, 2));
  return sampleSignals;
}