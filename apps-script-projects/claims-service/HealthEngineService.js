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
 * - record health history only when health level changes
 *
 * Future phases:
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
    const inputs = gatherHealthInputs_(targetClaimId);
    const previousHealthLevel = inputs.operationalHealth || '';
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

    const historyResult = recordHealthHistoryIfChanged_(
      targetClaimId,
      previousHealthLevel,
      evaluation.data,
      inputs,
      'applyClaimHealth'
    );

    const response = successResponse({
      claimId: targetClaimId,
      previousHealthLevel: previousHealthLevel,
      healthLevel: evaluation.data.healthLevel,
      healthReason: evaluation.data.healthReason,
      healthUpdatedAt: evaluatedAt,
      updateResult: updateResult,
      historyResult: historyResult
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
  return evaluateHealthDriver_(inputs).healthLevel;
}

function determineHealthReason_(inputs) {
  return evaluateHealthDriver_(inputs).healthReason;
}

function evaluateHealthDriver_(inputs) {
  if (inputs.lifecycleState === 'Operationally Complete') {
    return {
      healthLevel: 'Healthy',
      healthReason: 'Claim is operationally complete.',
      driver: 'Lifecycle_State'
    };
  }

  if (inputs.lifecycleState === 'Not Sold') {
    return {
      healthLevel: 'Healthy',
      healthReason: 'Claim was not sold.',
      driver: 'Lifecycle_State'
    };
  }

  const candidates = (inputs.activeConditions || []).map(function(condition) {
    return evaluateConditionHealth_(condition, inputs);
  }).filter(function(candidate) {
    return candidate !== null;
  });

  if (!candidates.length) {
    return {
      healthLevel: 'Healthy',
      healthReason: 'No active health-driving condition requires attention.',
      driver: 'None'
    };
  }

  candidates.sort(function(a, b) {
    const levelDifference = getHealthLevelRank_(b.healthLevel) - getHealthLevelRank_(a.healthLevel);

    if (levelDifference !== 0) {
      return levelDifference;
    }

    return getConditionSeverityRank_(a.conditionType) - getConditionSeverityRank_(b.conditionType);
  });

  return candidates[0];
}

function evaluateConditionHealth_(condition, inputs) {
  if (!condition || !condition.Condition_Type) {
    return null;
  }

  const conditionType = condition.Condition_Type;

  if (conditionType === 'Monitoring Active') {
    if (!condition.Follow_Up_Date) {
      return buildHealthDriver_('At Risk', 'Monitoring is active, but no follow-up or next monitoring date is scheduled.', conditionType);
    }

    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Monitoring is active and the scheduled follow-up date has passed.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Monitoring is active with a scheduled follow-up date.', conditionType);
  }

  if (conditionType === 'Positive Asbestos Result') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Positive asbestos result requires abatement coordination and the follow-up date has passed.', conditionType);
    }

    return buildHealthDriver_('Attention Soon', 'Positive asbestos result requires abatement coordination.', conditionType);
  }

  if (conditionType === 'Abatement Required') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Abatement is required and the follow-up date has passed.', conditionType);
    }

    return buildHealthDriver_('Attention Soon', 'Abatement is required and should remain operationally visible.', conditionType);
  }

  if (conditionType === 'Carrier Revision Requested') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Carrier revision was requested and the follow-up date has passed.', conditionType);
    }

    return buildHealthDriver_('Attention Soon', 'Carrier revision has been requested and requires action.', conditionType);
  }

  if (conditionType === 'Revision Active') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Revision is active and the follow-up date has passed.', conditionType);
    }

    if (isDateOlderThanDays_(inputs.lastRevisionAt || inputs.lastMeaningfulActivityAt, HEALTH_CONFIG.revisionStaleDays)) {
      return buildHealthDriver_('At Risk', 'Revision is active, but revision momentum appears stale.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Revision is active with recent activity or acceptable cadence.', conditionType);
  }

  if (conditionType === 'Supplement Under Review') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Supplement is under review and the follow-up date has passed.', conditionType);
    }

    if (daysSince_(condition.Opened_At) >= HEALTH_CONFIG.coverageFollowupDays) {
      return buildHealthDriver_('Attention Soon', 'Supplement has been under review long enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Supplement is under review within the expected follow-up window.', conditionType);
  }

  if (conditionType === 'Waiting on Payment') {
    const daysOpen = daysSince_(condition.Opened_At);

    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Payment is still outstanding and the follow-up date has passed.', conditionType);
    }

    if (daysOpen >= HEALTH_CONFIG.paymentAgingDays) {
      return buildHealthDriver_('Attention Soon', 'Payment has been outstanding long enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Waiting on payment within the expected payment window.', conditionType);
  }

  if (conditionType === 'Asbestos Testing Pending') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Asbestos testing is pending and the follow-up date has passed.', conditionType);
    }

    if (daysSince_(condition.Opened_At) >= HEALTH_CONFIG.coverageFollowupDays) {
      return buildHealthDriver_('Attention Soon', 'Asbestos testing has been pending long enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Asbestos testing is pending within the expected follow-up window.', conditionType);
  }

  if (conditionType === 'Waiting on Lab Results') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Lab results are still pending and the follow-up date has passed.', conditionType);
    }

    if (daysSince_(condition.Opened_At) >= HEALTH_CONFIG.coverageFollowupDays) {
      return buildHealthDriver_('Attention Soon', 'Lab results have been pending long enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Waiting on lab results within the expected follow-up window.', conditionType);
  }

  if (conditionType === 'Coverage Pending') {
    const daysOpen = daysSince_(condition.Opened_At);

    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Coverage is pending and the follow-up date has passed.', conditionType);
    }

    if (daysOpen >= HEALTH_CONFIG.staleAtRiskDays) {
      return buildHealthDriver_('At Risk', 'Coverage has been pending beyond the At Risk threshold.', conditionType);
    }

    if (daysOpen >= HEALTH_CONFIG.coverageFollowupDays) {
      return buildHealthDriver_('Attention Soon', 'Coverage has been pending long enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Coverage is pending within the expected follow-up window.', conditionType);
  }

  if (conditionType === 'Estimate Under Review') {
    const daysOpen = daysSince_(condition.Opened_At);

    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Estimate is under review and the follow-up date has passed.', conditionType);
    }

    if (daysOpen >= HEALTH_CONFIG.coverageFollowupDays) {
      return buildHealthDriver_('Attention Soon', 'Estimate has been under review long enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Estimate is under review within the expected follow-up window.', conditionType);
  }

  if (conditionType === 'Source of Loss Unresolved') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Source of loss remains unresolved and the follow-up date has passed.', conditionType);
    }

    return buildHealthDriver_('Attention Soon', 'Source of loss remains unresolved and needs attention soon.', conditionType);
  }

  if (conditionType === 'Waiting on Customer Decision') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Waiting on customer decision and the follow-up date has passed.', conditionType);
    }

    if (daysSince_(condition.Opened_At) >= HEALTH_CONFIG.staleAtRiskDays) {
      return buildHealthDriver_('Attention Soon', 'Waiting on customer decision has aged enough to need follow-up soon.', conditionType);
    }

    return buildHealthDriver_('Healthy', 'Waiting on customer decision within the expected follow-up window.', conditionType);
  }

  return null;
}

function buildHealthDriver_(healthLevel, healthReason, conditionType) {
  return {
    healthLevel: healthLevel,
    healthReason: healthReason,
    conditionType: conditionType,
    driver: conditionType
  };
}

function getHealthLevelRank_(healthLevel) {
  const ranks = {
    'Healthy': 1,
    'Attention Soon': 2,
    'At Risk': 3,
    'Escalated': 4,
    'Critical': 5
  };

  return ranks[healthLevel] || 0;
}

function getConditionSeverityRank_(conditionType) {
  const ranking = HEALTH_CONFIG.conditionSeverityRanking || [];
  const index = ranking.indexOf(conditionType);

  if (index === -1) {
    return 999;
  }

  return index;
}

function recordHealthHistoryIfChanged_(claimId, previousHealthLevel, evaluationData, inputs, triggeredBy) {
  const newHealthLevel = evaluationData.healthLevel || '';

  if (previousHealthLevel === newHealthLevel) {
    return {
      skipped: true,
      reason: 'Health level unchanged.',
      previousHealthLevel: previousHealthLevel,
      newHealthLevel: newHealthLevel
    };
  }

  const historyRecord = {
    Health_Record_ID: generateHealthRecordId_(),
    Claim_ID: claimId,
    Health_Level: newHealthLevel,
    Health_Reason: evaluationData.healthReason || '',
    Previous_Health_Level: previousHealthLevel || '',
    Evaluated_At: evaluationData.evaluatedAt || nowIso(),
    Triggered_By: triggeredBy || '',
    Is_Override: false,
    Override_Expires_At: '',
    Active_Conditions_Snapshot: stringifyJson(inputs.activeConditions || []),
    Lifecycle_State_At_Evaluation: inputs.lifecycleState || '',
    Ownership_Area_At_Evaluation: inputs.ownershipArea || '',
    Last_Meaningful_Activity_At_Evaluation: inputs.lastMeaningfulActivityAt || '',
    Notes: ''
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.healthHistory, historyRecord);

  return {
    skipped: false,
    healthRecordId: historyRecord.Health_Record_ID,
    previousHealthLevel: previousHealthLevel,
    newHealthLevel: newHealthLevel,
    appendResult: appendResult
  };
}

function generateHealthRecordId_() {
  const datePart = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMdd'
  );

  const randomPart = Math.floor(Math.random() * 900000) + 100000;

  return 'HLT-' + datePart + '-' + randomPart;
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

function isConditionPastFollowUp_(condition) {
  if (!condition || !condition.Follow_Up_Date) {
    return false;
  }

  const followUpDate = new Date(condition.Follow_Up_Date);

  if (isNaN(followUpDate.getTime())) {
    return false;
  }

  return followUpDate.getTime() < new Date().getTime();
}

function isDateOlderThanDays_(isoDate, thresholdDays) {
  if (!isoDate) {
    return true;
  }

  return daysSince_(isoDate) >= thresholdDays;
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