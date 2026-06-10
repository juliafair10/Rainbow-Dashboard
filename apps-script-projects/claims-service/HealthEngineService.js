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
 * Current completed scope:
 * - suppression rules
 * - overrides
 * - escalation persistence
 * - batch evaluation
 */

function evaluateClaimHealth(claimId) {
  try {
    const targetClaimId = claimId || getFirstClaimIdForHealthTest_();
    const inputs = gatherHealthInputs_(targetClaimId);

    const healthDriver = evaluateHealthDriver_(inputs);
    const evaluatedAt = nowIso();

    const result = {
      claimId: targetClaimId,
      healthLevel: healthDriver.healthLevel,
      healthReason: healthDriver.healthReason,
      driver: healthDriver.driver || '',
      driverCondition: healthDriver.conditionType || '',
      suppressed: healthDriver.suppressed || false,
      suppressionReason: healthDriver.suppressionReason || '',
      daysInCurrentHealth: calculateDaysInCurrentHealth_(targetClaimId, inputs.operationalHealth),
      lifecycleState: inputs.lifecycleState,
      ownershipArea: inputs.ownershipArea,
      activeConditions: inputs.activeConditions,
      lastMeaningfulActivityAt: inputs.lastMeaningfulActivityAt,
      evaluatedAt: evaluatedAt
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
      driver: evaluation.data.driver || '',
      driverCondition: evaluation.data.driverCondition || '',
      suppressed: evaluation.data.suppressed || false,
      suppressionReason: evaluation.data.suppressionReason || '',
      daysInCurrentHealth: evaluation.data.daysInCurrentHealth || 0,
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

function applyHealthOverride(claimId, overrideLevel, reason, expiresAt, setBy) {
  try {
    const targetClaimId = claimId || getFirstClaimIdForHealthTest_();

    if (!CLAIM_HEALTH_LEVELS.includes(overrideLevel)) {
      throw new Error('Invalid override health level: ' + overrideLevel);
    }

    const overrideExpiresAt = expiresAt || calculateDefaultOverrideExpiry_();

    const updateResult = updateClaim(targetClaimId, {
      Health_Override: overrideLevel,
      Health_Override_Reason: reason || 'Manual health override applied.',
      Health_Override_Expires_At: overrideExpiresAt,
      Health_Override_Set_By: setBy || CLAIM_SERVICE.name
    });

    if (!updateResult.success) {
      return updateResult;
    }

    const applyResult = applyClaimHealth(targetClaimId);

    const response = successResponse({
      claimId: targetClaimId,
      overrideLevel: overrideLevel,
      overrideReason: reason || 'Manual health override applied.',
      overrideExpiresAt: overrideExpiresAt,
      setBy: setBy || CLAIM_SERVICE.name,
      updateResult: updateResult,
      applyResult: applyResult
    }, 'Health override applied successfully.');

    Logger.log(JSON.stringify(response, null, 2));
    return response;

  } catch (error) {
    writeServiceLog('applyHealthOverride', 'Error', error.message, {
      claimId: claimId || '',
      error: error
    });

    const response = errorResponse('Failed to apply health override.', {
      message: error.message,
      stack: error.stack
    });

    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }
}

function clearHealthOverride(claimId) {
  try {
    const targetClaimId = claimId || getFirstClaimIdForHealthTest_();

    const updateResult = updateClaim(targetClaimId, {
      Health_Override: '',
      Health_Override_Reason: '',
      Health_Override_Expires_At: '',
      Health_Override_Set_By: ''
    });

    if (!updateResult.success) {
      return updateResult;
    }

    const applyResult = applyClaimHealth(targetClaimId);

    const response = successResponse({
      claimId: targetClaimId,
      updateResult: updateResult,
      applyResult: applyResult
    }, 'Health override cleared successfully.');

    Logger.log(JSON.stringify(response, null, 2));
    return response;

  } catch (error) {
    writeServiceLog('clearHealthOverride', 'Error', error.message, {
      claimId: claimId || '',
      error: error
    });

    const response = errorResponse('Failed to clear health override.', {
      message: error.message,
      stack: error.stack
    });

    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }
}

function expireHealthOverrides() {
  try {
    const claims = getRows(CLAIM_SHEET_NAMES.claims);
    const now = new Date();
    const results = [];

    claims.forEach(function(claim) {
      if (!claim.Claim_ID || !claim.Health_Override || !claim.Health_Override_Expires_At) {
        return;
      }

      const expiresAt = new Date(claim.Health_Override_Expires_At);

      if (isNaN(expiresAt.getTime()) || expiresAt.getTime() >= now.getTime()) {
        return;
      }

      const clearResult = clearHealthOverride(claim.Claim_ID);
      results.push({
        claimId: claim.Claim_ID,
        expiredOverride: claim.Health_Override,
        expiredAt: claim.Health_Override_Expires_At,
        clearResult: clearResult
      });
    });

    const response = successResponse({
      expiredCount: results.length,
      results: results
    }, 'Expired health overrides processed successfully.');

    Logger.log(JSON.stringify(response, null, 2));
    return response;

  } catch (error) {
    writeServiceLog('expireHealthOverrides', 'Error', error.message, {
      error: error
    });

    const response = errorResponse('Failed to expire health overrides.', {
      message: error.message,
      stack: error.stack
    });

    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }
}

function batchApplyClaimHealth() {
  try {
    const claims = getRows(CLAIM_SHEET_NAMES.claims);
    const results = [];

    claims.forEach(function(claim) {
      if (!claim.Claim_ID) {
        return;
      }

      if (claim.Lifecycle_State === 'Operationally Complete' || claim.Lifecycle_State === 'Not Sold') {
        return;
      }

      const result = applyClaimHealth(claim.Claim_ID);
      results.push({
        claimId: claim.Claim_ID,
        success: result.success,
        healthLevel: result.success ? result.data.healthLevel : '',
        message: result.message
      });
    });

    const response = successResponse({
      evaluatedCount: results.length,
      results: results
    }, 'Batch claim health evaluation completed successfully.');

    Logger.log(JSON.stringify(response, null, 2));
    return response;

  } catch (error) {
    writeServiceLog('batchApplyClaimHealth', 'Error', error.message, {
      error: error
    });

    const response = errorResponse('Failed to batch apply claim health.', {
      message: error.message,
      stack: error.stack
    });

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

    healthOverride: claim.Health_Override || '',
    healthOverrideReason: claim.Health_Override_Reason || '',
    healthOverrideExpiresAt: claim.Health_Override_Expires_At || '',
    healthOverrideSetBy: claim.Health_Override_Set_By || '',

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
      driver: 'Lifecycle_State',
      suppressed: true,
      suppressionReason: 'Operationally complete claims are excluded from active health orchestration.'
    };
  }

  if (inputs.lifecycleState === 'Not Sold') {
    return {
      healthLevel: 'Healthy',
      healthReason: 'Claim was not sold.',
      driver: 'Lifecycle_State',
      suppressed: true,
      suppressionReason: 'Not Sold claims are excluded from active health orchestration.'
    };
  }

  const overrideDriver = evaluateHealthOverride_(inputs);
  if (overrideDriver) {
    return overrideDriver;
  }

  const candidates = (inputs.activeConditions || []).map(function(condition) {
    return evaluateConditionHealth_(condition, inputs);
  }).filter(function(candidate) {
    return candidate !== null;
  });

  if (!candidates.length) {
    return applyEscalationPersistence_(inputs, {
      healthLevel: 'Healthy',
      healthReason: 'No active health-driving condition requires attention.',
      driver: 'None',
      suppressed: false,
      suppressionReason: ''
    });
  }

  candidates.sort(function(a, b) {
    const levelDifference = getHealthLevelRank_(b.healthLevel) - getHealthLevelRank_(a.healthLevel);

    if (levelDifference !== 0) {
      return levelDifference;
    }

    return getConditionSeverityRank_(a.conditionType) - getConditionSeverityRank_(b.conditionType);
  });

  return applyEscalationPersistence_(inputs, candidates[0]);
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

    return buildSuppressedHealthDriver_('Healthy', 'Monitoring is active with a scheduled follow-up date.', conditionType, 'Future monitoring or follow-up date suppresses monitoring urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Attention Soon', 'Abatement is required and should remain operationally visible.', conditionType, 'Scheduled abatement follow-up prevents escalation for now.');
    }

    return buildHealthDriver_('Attention Soon', 'Abatement is required and should remain operationally visible.', conditionType);
  }

  if (conditionType === 'Carrier Revision Requested') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Carrier revision was requested and the follow-up date has passed.', conditionType);
    }

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Attention Soon', 'Carrier revision has been requested and requires action.', conditionType, 'Scheduled revision follow-up prevents escalation for now.');
    }

    return buildHealthDriver_('Attention Soon', 'Carrier revision has been requested and requires action.', conditionType);
  }

  if (conditionType === 'Revision Active') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Revision is active and the follow-up date has passed.', conditionType);
    }

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Revision is active with a scheduled follow-up date.', conditionType, 'Scheduled revision follow-up suppresses stale revision urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Supplement is under review within the expected follow-up window.', conditionType, 'Scheduled supplement follow-up suppresses review urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Waiting on payment with a scheduled follow-up date.', conditionType, 'Scheduled payment follow-up suppresses payment aging urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Asbestos testing is pending with a scheduled follow-up date.', conditionType, 'Scheduled asbestos testing follow-up suppresses urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Waiting on lab results with a scheduled follow-up date.', conditionType, 'Scheduled lab follow-up suppresses lab-results urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Coverage is pending with a scheduled follow-up date.', conditionType, 'Scheduled coverage follow-up suppresses coverage urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Estimate is under review with a scheduled follow-up date.', conditionType, 'Scheduled estimate follow-up suppresses estimate-review urgency.');
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

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Source of loss is unresolved with a scheduled follow-up date.', conditionType, 'Scheduled source-of-loss follow-up suppresses urgency.');
    }

    return buildHealthDriver_('Attention Soon', 'Source of loss remains unresolved and needs attention soon.', conditionType);
  }

  if (conditionType === 'Waiting on Customer Decision') {
    if (isConditionPastFollowUp_(condition)) {
      return buildHealthDriver_('At Risk', 'Waiting on customer decision and the follow-up date has passed.', conditionType);
    }

    if (condition.Follow_Up_Date) {
      return buildSuppressedHealthDriver_('Healthy', 'Waiting on customer decision with a scheduled follow-up date.', conditionType, 'Scheduled customer follow-up suppresses customer-decision urgency.');
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

function buildSuppressedHealthDriver_(healthLevel, healthReason, conditionType, suppressionReason) {
  const driver = buildHealthDriver_(healthLevel, healthReason, conditionType);
  driver.suppressed = true;
  driver.suppressionReason = suppressionReason || '';
  return driver;
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

function evaluateHealthOverride_(inputs) {
  if (!inputs.healthOverride) {
    return null;
  }

  if (!CLAIM_HEALTH_LEVELS.includes(inputs.healthOverride)) {
    return null;
  }

  if (inputs.healthOverrideExpiresAt) {
    const expiresAt = new Date(inputs.healthOverrideExpiresAt);

    if (!isNaN(expiresAt.getTime()) && expiresAt.getTime() < new Date().getTime()) {
      return null;
    }
  }

  return {
    healthLevel: inputs.healthOverride,
    healthReason: inputs.healthOverrideReason || 'Health manually overridden.',
    driver: 'Health_Override',
    conditionType: '',
    suppressed: true,
    suppressionReason: 'Manual health override is active.'
  };
}

function applyEscalationPersistence_(inputs, driver) {
  if (!driver || driver.suppressed) {
    return driver;
  }

  if (driver.healthLevel === 'At Risk') {
    const daysAtRisk = calculateDaysInCurrentHealth_(inputs.claimId, 'At Risk');

    if (daysAtRisk >= HEALTH_CONFIG.escalationPersistenceDays) {
      return {
        healthLevel: 'Escalated',
        healthReason: driver.healthReason + ' At Risk has persisted beyond the escalation window.',
        conditionType: driver.conditionType || '',
        driver: driver.driver || driver.conditionType || '',
        suppressed: false,
        suppressionReason: '',
        escalationSource: driver.healthLevel,
        daysInCurrentHealth: daysAtRisk
      };
    }
  }

  if (driver.healthLevel === 'Escalated') {
    const daysEscalated = calculateDaysInCurrentHealth_(inputs.claimId, 'Escalated');

    if (daysEscalated >= HEALTH_CONFIG.criticalPersistenceDays) {
      return {
        healthLevel: 'Critical',
        healthReason: driver.healthReason + ' Escalated health has persisted beyond the critical window.',
        conditionType: driver.conditionType || '',
        driver: driver.driver || driver.conditionType || '',
        suppressed: false,
        suppressionReason: '',
        escalationSource: driver.healthLevel,
        daysInCurrentHealth: daysEscalated
      };
    }
  }

  return driver;
}

function calculateDaysInCurrentHealth_(claimId, healthLevel) {
  if (!claimId || !healthLevel) {
    return 0;
  }

  const historyRows = getRows(CLAIM_SHEET_NAMES.healthHistory);
  const matchingRows = historyRows.filter(function(row) {
    return row.Claim_ID === claimId && row.Health_Level === healthLevel;
  });

  if (!matchingRows.length) {
    return 0;
  }

  matchingRows.sort(function(a, b) {
    return new Date(b.Evaluated_At).getTime() - new Date(a.Evaluated_At).getTime();
  });

  return daysSince_(matchingRows[0].Evaluated_At);
}

function calculateDefaultOverrideExpiry_() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + HEALTH_CONFIG.overrideDefaultExpiryDays);
  return expiresAt.toISOString();
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
    Is_Override: evaluationData.driver === 'Health_Override',
    Override_Expires_At: evaluationData.driver === 'Health_Override' ? inputs.healthOverrideExpiresAt || '' : '',
    Active_Conditions_Snapshot: stringifyJson(inputs.activeConditions || []),
    Lifecycle_State_At_Evaluation: inputs.lifecycleState || '',
    Ownership_Area_At_Evaluation: inputs.ownershipArea || '',
    Last_Meaningful_Activity_At_Evaluation: inputs.lastMeaningfulActivityAt || '',
    Notes: evaluationData.suppressionReason || ''
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

function testApplyHealthOverride() {
  const response = applyHealthOverride(
    null,
    'Attention Soon',
    'Test manual override for Phase 7 validation.',
    null,
    'Phase 7 Test'
  );

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testClearHealthOverride() {
  const response = clearHealthOverride();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testExpireHealthOverrides() {
  const response = expireHealthOverrides();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testBatchApplyClaimHealth() {
  const response = batchApplyClaimHealth();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}