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

    const updateResult = updateHealthEngineClaimRow_(targetClaimId, {
      'Health Status': evaluation.data.healthLevel,
      'Health Reason': evaluation.data.healthReason,
      'Last Updated': evaluatedAt
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


function getHealthEngineValueFromRow_(row, candidateKeys) {
  if (!row) return '';

  for (let i = 0; i < candidateKeys.length; i++) {
    const directValue = row[candidateKeys[i]];
    if (directValue !== undefined && directValue !== null && String(directValue).trim() !== '') {
      return String(directValue).trim();
    }
  }

  const normalizedCandidates = candidateKeys.map(function(key) {
    return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  });

  const rowKeys = Object.keys(row);
  for (let j = 0; j < rowKeys.length; j++) {
    const rowKey = rowKeys[j];
    const normalizedRowKey = String(rowKey).toLowerCase().replace(/[^a-z0-9]/g, '');

    if (normalizedCandidates.indexOf(normalizedRowKey) !== -1) {
      const value = row[rowKey];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }

  return '';
}

function getHealthEngineClaimIdFromRow_(claim) {
  return getHealthEngineValueFromRow_(claim, [
    'Claim_ID',
    'Claim ID',
    'ClaimId',
    'claimId',
    'Job_Number',
    'Job Number',
    'JobNumber',
    'Job No',
    'Job #'
  ]);
}

function getHealthEngineLifecycleStateFromRow_(claim) {
  return getHealthEngineValueFromRow_(claim, [
    'Lifecycle_State',
    'Lifecycle State',
    'Lifecycle',
    'Status',
    'Claim_Status',
    'Claim Status'
  ]);
}

function findHealthEngineClaimsRows_() {
  const sheet = getSheet(CLAIM_SHEET_NAMES.claims);
  const values = sheet.getDataRange().getValues();

  if (!values || values.length === 0) {
    return [];
  }

  let headerRowIndex = 0;

  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const normalizedHeaders = values[i].map(function(value) {
      return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    });

    if (normalizedHeaders.indexOf('claimid') !== -1 || normalizedHeaders.indexOf('jobnumber') !== -1) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = values[headerRowIndex].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(headerRowIndex + 1).filter(function(row) {
    return row.some(function(value) {
      return String(value || '').trim() !== '';
    });
  }).map(function(row) {
    const record = {};

    headers.forEach(function(header, index) {
      if (header) {
        record[header] = row[index];
      }
    });

    return record;
  });
}

function updateHealthEngineClaimRow_(claimId, updates) {
  const sheet = getSheet(CLAIM_SHEET_NAMES.claims);
  const values = sheet.getDataRange().getValues();

  if (!values || values.length === 0) {
    return errorResponse('Claims sheet is empty.');
  }

  let headerRowIndex = 0;

  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const normalizedHeaders = values[i].map(function(value) {
      return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    });

    if (normalizedHeaders.indexOf('claimid') !== -1 || normalizedHeaders.indexOf('jobnumber') !== -1) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = values[headerRowIndex].map(function(header) {
    return String(header || '').trim();
  });

  const claimIdCol = headers.findIndex(function(header) {
    return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'claimid';
  });

  if (claimIdCol === -1) {
    return errorResponse('Missing key column Claim ID in Claims.');
  }

  let targetRowIndex = -1;

  for (let r = headerRowIndex + 1; r < values.length; r++) {
    if (String(values[r][claimIdCol] || '').trim() === String(claimId || '').trim()) {
      targetRowIndex = r;
      break;
    }
  }

  if (targetRowIndex === -1) {
    return notFoundResponse('No matching claim found for health update.', {
      claimId: claimId
    });
  }

  Object.keys(updates || {}).forEach(function(updateKey) {
    const normalizedUpdateKey = String(updateKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const colIndex = headers.findIndex(function(header) {
      return String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedUpdateKey;
    });

    if (colIndex !== -1) {
      sheet.getRange(targetRowIndex + 1, colIndex + 1).setValue(updates[updateKey]);
    }
  });

  return successResponse({
    claimId: claimId,
    updates: updates
  }, 'Claim health row updated successfully.');
}

function batchApplyClaimHealth() {
  try {
    const claims = findHealthEngineClaimsRows_();
    const results = [];

    claims.forEach(function(claim) {
      const claimId = getHealthEngineClaimIdFromRow_(claim);
      const lifecycleState = getHealthEngineLifecycleStateFromRow_(claim);

      if (!claimId) {
        return;
      }

      if (lifecycleState === 'Operationally Complete' || lifecycleState === 'Not Sold') {
        return;
      }

      const result = applyClaimHealth(claimId);
      results.push({
        claimId: claimId,
        success: result.success,
        healthLevel: result.success ? result.data.healthLevel : '',
        message: result.message,
        errors: result.errors || []
      });
    });

    const response = successResponse({
      evaluatedCount: results.length,
      results: results.slice(0, 20)
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
  const claims = findHealthEngineClaimsRows_();
  const claim = claims.find(function(row) {
    return getHealthEngineClaimIdFromRow_(row) === claimId;
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

    lifecycleState: getHealthEngineLifecycleStateFromRow_(claim),
    ownershipArea: getHealthEngineValueFromRow_(claim, ['Ownership_Area', 'Ownership Area']),

    activeConditions: activeConditions,

    operationalHealth: getHealthEngineValueFromRow_(claim, ['Operational_Health', 'Health Status', 'Health_Status']) || 'Healthy',

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
  const claims = findHealthEngineClaimsRows_();

  if (!claims.length || !getHealthEngineClaimIdFromRow_(claims[0])) {
    throw new Error('No claims available for health evaluation.');
  }

  return getHealthEngineClaimIdFromRow_(claims[0]);
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

function testEvaluateMonitoringClaimHealth() {
  const response = evaluateClaimHealth('CLM-20260605-821496');
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testApplyMonitoringClaimHealth() {
  const response = applyClaimHealth('CLM-20260605-821496');
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

function getHomepageClaimSummary() {
  try {
    const claims = getRows(CLAIM_SHEET_NAMES.claims);
    const conditions = getRows(CLAIM_SHEET_NAMES.conditions);
    const alerts = getRows(CLAIM_SHEET_NAMES.alerts);
    const complianceActions = getHomepageComplianceActions_();

    const activeClaims = claims.filter(function(claim) {
      return isHomepageActiveClaim_(claim);
    });

    const activeClaimIds = activeClaims.reduce(function(map, claim) {
      if (claim.Claim_ID) {
        map[claim.Claim_ID] = true;
      }
      return map;
    }, {});

    const activeConditions = conditions.filter(function(condition) {
      return activeClaimIds[condition.Claim_ID] && isOpenStatus_(condition.Condition_Status);
    });

    const activeAlerts = alerts.filter(function(alert) {
      return activeClaimIds[alert.Claim_ID] && isOpenStatus_(alert.Alert_Status);
    });

    const activeComplianceActions = complianceActions.filter(function(action) {
      return activeClaimIds[action.Claim_ID] && isOpenStatus_(action.Status);
    });

    const kpis = {
      needsAttention: countClaimsByHealth_(activeClaims, ['Attention Soon', 'At Risk', 'Escalated', 'Critical']),
      atRisk: countClaimsByHealth_(activeClaims, ['At Risk']),
      escalated: countClaimsByHealth_(activeClaims, ['Escalated']),
      critical: countClaimsByHealth_(activeClaims, ['Critical']),
      waitingOnInsurance: countClaimsWithAnyCondition_(activeConditions, [
        'Coverage Pending',
        'Estimate Under Review',
        'Supplement Under Review',
        'Waiting on Payment'
      ]),
      monitoringActive: countClaimsWithAnyCondition_(activeConditions, ['Monitoring Active']),
      openComplianceActions: activeComplianceActions.length,
      criticalComplianceActions: countComplianceActionsByPriority_(activeComplianceActions, ['Critical']),
      overdueComplianceActions: countOverdueComplianceActions_(activeComplianceActions)
    };

    return successResponse({
      generatedAt: nowIso(),
      activeClaimCount: activeClaims.length,
      openConditionCount: activeConditions.length,
      openAlertCount: activeAlerts.length,
      openComplianceActionCount: activeComplianceActions.length,
      kpis: kpis,
      todayPriorities: buildHomepageTodayPriorities_(activeClaims, activeConditions, activeAlerts, activeComplianceActions),
      operationalAlerts: buildHomepageOperationalAlertsSummary_(activeAlerts, activeClaims),
      becomingStale: buildHomepageBecomingStale_(activeClaims),
      recentActivity: buildHomepageRecentActivity_(),
      ownershipVisibility: buildHomepageOwnershipVisibility_(activeClaims),
      conditionsVisibility: buildHomepageConditionsVisibility_(activeConditions),
      complianceVisibility: buildHomepageComplianceVisibility_(activeComplianceActions)
    }, 'Homepage claim summary generated successfully.');

  } catch (error) {
    writeServiceLog('getHomepageClaimSummary', 'Error', error.message, {
      error: error
    });

    return errorResponse('Failed to generate homepage claim summary.', {
      message: error.message,
      stack: error.stack
    });
  }
}

function isHomepageActiveClaim_(claim) {
  if (!claim || !claim.Claim_ID) {
    return false;
  }

  if (String(claim.Is_Active).toLowerCase() === 'false') {
    return false;
  }

  if (String(claim.Is_Not_Sold).toLowerCase() === 'true') {
    return false;
  }

  if (String(claim.Is_Operationally_Complete).toLowerCase() === 'true') {
    return false;
  }

  if (claim.Lifecycle_State === 'Not Sold' || claim.Lifecycle_State === 'Operationally Complete') {
    return false;
  }

  return true;
}

function isOpenStatus_(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized !== 'closed' &&
    normalized !== 'resolved' &&
    normalized !== 'dismissed' &&
    normalized !== 'suppressed' &&
    normalized !== 'complete' &&
    normalized !== 'completed';
}

function countClaimsByHealth_(claims, healthLevels) {
  const levelMap = (healthLevels || []).reduce(function(map, level) {
    map[level] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  claims.forEach(function(claim) {
    if (claim.Claim_ID && levelMap[claim.Operational_Health || 'Healthy']) {
      countedClaimIds[claim.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}

function countClaimsWithAnyCondition_(conditions, conditionTypes) {
  const typeMap = (conditionTypes || []).reduce(function(map, conditionType) {
    map[conditionType] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  conditions.forEach(function(condition) {
    if (condition.Claim_ID && typeMap[condition.Condition_Type]) {
      countedClaimIds[condition.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}

function testGetHomepageClaimSummary() {
  const response = getHomepageClaimSummary();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function buildHomepageOperationalAlertsSummary_(activeAlerts, activeClaims) {
  const claimById = buildHomepageClaimMap_(activeClaims);
  const severityCounts = {};
  const categoryCounts = {};

  const topAlerts = (activeAlerts || []).map(function(alert) {
    const severity = String(alert.Severity || 'Unspecified').trim() || 'Unspecified';
    const category = String(alert.Alert_Type || alert.Alert_Category || 'Operational Alert').trim() || 'Operational Alert';

    severityCounts[severity] = (severityCounts[severity] || 0) + 1;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    const claim = claimById[alert.Claim_ID] || {};

    return {
      claimId: alert.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      alertType: alert.Alert_Type || '',
      alertCategory: alert.Alert_Category || alert.Alert_Type || '',
      severity: severity,
      reason: alert.Reason || alert.Recommended_Action || '',
      openedAt: alert.Opened_At || alert.Created_At || '',
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: alert.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', alert.Claim_ID || ''),
      sourceSection: 'operationalAlerts',
      sortRank: getHomepageSeverityRank_(severity)
    };
  }).sort(function(a, b) {
    if (a.sortRank !== b.sortRank) {
      return a.sortRank - b.sortRank;
    }

    return String(a.claimDisplayName || '').localeCompare(String(b.claimDisplayName || ''));
  }).slice(0, 10).map(function(item) {
    delete item.sortRank;
    return item;
  });

  return {
    totalOpenAlerts: (activeAlerts || []).length,
    severityCounts: severityCounts,
    categoryCounts: categoryCounts,
    topAlerts: topAlerts
  };
}

function buildHomepageBecomingStale_(activeClaims) {
  const staleHealthLevels = {
    'Attention Soon': true,
    'At Risk': true,
    'Escalated': true,
    'Critical': true
  };

  return (activeClaims || []).filter(function(claim) {
    const healthLevel = claim.Operational_Health || 'Healthy';
    return staleHealthLevels[healthLevel];
  }).map(function(claim) {
    const lastActivity = claim.Last_Meaningful_Activity_At || claim.Last_Activity_Date || claim.Last_Updated || '';

    return {
      claimId: claim.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: claim.Operational_Health || 'Healthy',
      healthReason: claim.Health_Reason || '',
      lastMeaningfulActivityAt: lastActivity,
      daysSinceLastActivity: lastActivity ? daysSince_(lastActivity) : '',
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: claim.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', claim.Claim_ID || ''),
      sourceSection: 'becomingStale',
      sortRank: getHomepagePriorityRankForHealth_(claim.Operational_Health || 'Healthy')
    };
  }).sort(function(a, b) {
    if (a.sortRank !== b.sortRank) {
      return a.sortRank - b.sortRank;
    }

    return Number(b.daysSinceLastActivity || 0) - Number(a.daysSinceLastActivity || 0);
  }).slice(0, 10).map(function(item) {
    delete item.sortRank;
    return item;
  });
}

function buildHomepageRecentActivity_() {
  const timelineRows = getRows(CLAIM_SHEET_NAMES.timelineEvents || 'Timeline_Events');
  const meaningfulEventTypes = {
    'Lifecycle Transition': true,
    'Condition Added': true,
    'Condition Removed': true,
    'Alert Added': true,
    'Alert Removed': true,
    'EOJ Submitted': true,
    'EOJ Processed': true,
    'Payment Received': true,
    'Inspection Completed': true,
    'Intake Created': true,
    'Intake Processed': true,
    'Claim Folder Created': true,
    'External Link Added': true,
    'Ownership Changed': true,
    'Ownership Updated': true,
    'Financial Track Created': true,
    'Compliance Action Created': true,
    'Compliance Action Completed': true
  };

  return (timelineRows || []).filter(function(event) {
    const eventType = event.Event_Type || event.Timeline_Event_Type || event.Type || '';
    return meaningfulEventTypes[eventType] ||
      event.Is_Meaningful === true ||
      String(event.Is_Meaningful).toLowerCase() === 'true' ||
      isHomepageMeaningfulNoteEvent_(event);
  }).map(function(event) {
    const occurredAt = event.Occurred_At || event.Event_Date || event.Date || event.Created_At || '';

    return {
      claimId: event.Claim_ID || '',
      eventType: event.Event_Type || event.Timeline_Event_Type || event.Type || '',
      title: event.Title || event.Event_Title || event.Summary || event.Description || 'Operational activity',
      description: event.Description || event.Notes || '',
      occurredAt: occurredAt,
      source: event.Source || event.Created_By || '',
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: event.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', event.Claim_ID || ''),
      sourceSection: 'recentActivity',
      sortTime: occurredAt ? new Date(occurredAt).getTime() : 0
    };
  }).sort(function(a, b) {
    return Number(b.sortTime || 0) - Number(a.sortTime || 0);
  }).slice(0, 12).map(function(item) {
    delete item.sortTime;
    return item;
  });
}

function isHomepageMeaningfulNoteEvent_(event) {
  const eventType = String(event.Event_Type || event.Timeline_Event_Type || event.Type || '').trim();

  if (eventType !== 'Note') {
    return false;
  }

  const text = [
    event.Summary || '',
    event.Details || '',
    event.Source || '',
    event.Actor || ''
  ].join(' ').toLowerCase();

  const meaningfulPatterns = [
    'review accepted',
    'revision',
    'revisions requested',
    'action item created',
    'paid rainbow',
    'payment',
    'estimate',
    'inspection',
    'inspected',
    'mitigation completed',
    'cos',
    'source of loss',
    'carrier',
    'adjuster',
    'approved',
    'denied',
    'coverage',
    'supplement',
    'invoice',
    'remittance'
  ];

  return meaningfulPatterns.some(function(pattern) {
    return text.indexOf(pattern) !== -1;
  });
}

function buildHomepageOwnershipVisibility_(activeClaims) {
  const ownershipAreas = [
    'Intake',
    'Field Operations',
    'Revision Management',
    'Office Operations'
  ];

  const summary = ownershipAreas.reduce(function(map, ownershipArea) {
    map[ownershipArea] = {
      ownershipArea: ownershipArea,
      activeClaimCount: 0,
      needsAttentionCount: 0,
      criticalCount: 0,
      escalatedCount: 0,
      atRiskCount: 0,
      targetWorkspace: 'claims',
      targetType: 'claimsFilter',
      targetId: ownershipArea,
      targetRoute: buildHomepageTargetRoute_('ownership', ownershipArea),
      sourceSection: 'ownershipVisibility'
    };
    return map;
  }, {});

  (activeClaims || []).forEach(function(claim) {
    const ownershipArea = claim.Ownership_Area || 'Unassigned';

    if (!summary[ownershipArea]) {
      summary[ownershipArea] = {
        ownershipArea: ownershipArea,
        activeClaimCount: 0,
        needsAttentionCount: 0,
        criticalCount: 0,
        escalatedCount: 0,
        atRiskCount: 0,
        targetWorkspace: 'claims',
        targetType: 'claimsFilter',
        targetId: ownershipArea,
        targetRoute: buildHomepageTargetRoute_('ownership', ownershipArea),
        sourceSection: 'ownershipVisibility'
      };
    }

    const healthLevel = claim.Operational_Health || 'Healthy';
    summary[ownershipArea].activeClaimCount++;

    if (['Attention Soon', 'At Risk', 'Escalated', 'Critical'].indexOf(healthLevel) !== -1) {
      summary[ownershipArea].needsAttentionCount++;
    }

    if (healthLevel === 'Critical') {
      summary[ownershipArea].criticalCount++;
    }

    if (healthLevel === 'Escalated') {
      summary[ownershipArea].escalatedCount++;
    }

    if (healthLevel === 'At Risk') {
      summary[ownershipArea].atRiskCount++;
    }
  });

  return Object.keys(summary).map(function(key) {
    return summary[key];
  }).sort(function(a, b) {
    if (a.needsAttentionCount !== b.needsAttentionCount) {
      return b.needsAttentionCount - a.needsAttentionCount;
    }

    return b.activeClaimCount - a.activeClaimCount;
  });
}

function buildHomepageConditionsVisibility_(activeConditions) {
  const conditionTypes = [
    'Coverage Pending',
    'Estimate Under Review',
    'Supplement Under Review',
    'Waiting on Payment',
    'Revision Active',
    'Carrier Revision Requested',
    'Monitoring Active',
    'Positive Asbestos Result',
    'Abatement Required'
  ];

  const summary = conditionTypes.reduce(function(map, conditionType) {
    map[conditionType] = {
      conditionType: conditionType,
      openCount: 0,
      overdueFollowUpCount: 0,
      withoutFollowUpCount: 0,
      claimIds: [],
      targetWorkspace: 'claims',
      targetType: 'claimsFilter',
      targetId: conditionType,
      targetRoute: buildHomepageTargetRoute_('condition', conditionType),
      sourceSection: 'conditionsVisibility'
    };
    return map;
  }, {});

  (activeConditions || []).forEach(function(condition) {
    const conditionType = condition.Condition_Type || 'Other';

    if (!summary[conditionType]) {
      summary[conditionType] = {
        conditionType: conditionType,
        openCount: 0,
        overdueFollowUpCount: 0,
        withoutFollowUpCount: 0,
        claimIds: [],
        targetWorkspace: 'claims',
        targetType: 'claimsFilter',
        targetId: conditionType,
        targetRoute: buildHomepageTargetRoute_('condition', conditionType),
        sourceSection: 'conditionsVisibility'
      };
    }

    summary[conditionType].openCount++;

    if (condition.Claim_ID && summary[conditionType].claimIds.indexOf(condition.Claim_ID) === -1) {
      summary[conditionType].claimIds.push(condition.Claim_ID);
    }

    if (!condition.Follow_Up_Date) {
      summary[conditionType].withoutFollowUpCount++;
    }

    if (isConditionPastFollowUp_(condition)) {
      summary[conditionType].overdueFollowUpCount++;
    }
  });

  return Object.keys(summary).map(function(key) {
    const item = summary[key];
    return {
      conditionType: item.conditionType,
      openCount: item.openCount,
      affectedClaimCount: item.claimIds.length,
      overdueFollowUpCount: item.overdueFollowUpCount,
      withoutFollowUpCount: item.withoutFollowUpCount,
      targetWorkspace: item.targetWorkspace,
      targetType: item.targetType,
      targetId: item.targetId,
      targetRoute: item.targetRoute,
      sourceSection: item.sourceSection
    };
  }).filter(function(item) {
    return item.openCount > 0;
  }).sort(function(a, b) {
    if (a.overdueFollowUpCount !== b.overdueFollowUpCount) {
      return b.overdueFollowUpCount - a.overdueFollowUpCount;
    }

    return b.openCount - a.openCount;
  });
}

function buildHomepageComplianceVisibility_(activeComplianceActions) {
  const priorityCounts = {};
  const statusCounts = {};
  const overdueActions = [];
  const criticalActions = [];

  (activeComplianceActions || []).forEach(function(action) {
    const priority = String(action.Priority || 'Unspecified').trim() || 'Unspecified';
    const status = String(action.Status || 'Open').trim() || 'Open';
    const dueDate = action.Due_Date ? new Date(action.Due_Date) : null;
    const isOverdue = dueDate && !isNaN(dueDate.getTime()) && dueDate.getTime() < new Date().getTime();

    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const item = {
      claimId: action.Claim_ID || '',
      actionTitle: action.Action_Title || action.Required_Action || 'Compliance action',
      priority: priority,
      status: status,
      dueDate: action.Due_Date || '',
      sourceReport: action.Source_Report || '',
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: action.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', action.Claim_ID || ''),
      sourceSection: 'complianceVisibility'
    };

    if (isOverdue) {
      overdueActions.push(item);
    }

    if (priority.toLowerCase() === 'critical') {
      criticalActions.push(item);
    }
  });

  return {
    totalOpenComplianceActions: (activeComplianceActions || []).length,
    overdueComplianceActionCount: overdueActions.length,
    criticalComplianceActionCount: criticalActions.length,
    priorityCounts: priorityCounts,
    statusCounts: statusCounts,
    overdueActions: overdueActions.slice(0, 10),
    criticalActions: criticalActions.slice(0, 10)
  };
}

function buildHomepageClaimMap_(claims) {
  return (claims || []).reduce(function(map, claim) {
    if (claim.Claim_ID) {
      map[claim.Claim_ID] = claim;
    }
    return map;
  }, {});
}

function getHomepageSeverityRank_(severity) {
  const ranks = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
    unspecified: 5
  };

  return ranks[String(severity || '').toLowerCase()] || 5;
}

function buildHomepageTodayPriorities_(activeClaims, activeConditions, activeAlerts, activeComplianceActions) {
  const claimById = (activeClaims || []).reduce(function(map, claim) {
    if (claim.Claim_ID) {
      map[claim.Claim_ID] = claim;
    }
    return map;
  }, {});

  const priorities = [];

  (activeClaims || []).forEach(function(claim) {
    const healthLevel = claim.Operational_Health || 'Healthy';

    if (['Attention Soon', 'At Risk', 'Escalated', 'Critical'].indexOf(healthLevel) === -1) {
      return;
    }

    priorities.push(buildHomepagePriorityItem_(claim, null, {
      type: 'Health',
      title: healthLevel + ': ' + getHomepageClaimDisplayName_(claim),
      reason: claim.Health_Reason || 'Claim health requires operational attention.',
      priorityRank: getHomepagePriorityRankForHealth_(healthLevel)
    }));
  });

  (activeConditions || []).forEach(function(condition) {
    const claim = claimById[condition.Claim_ID];
    if (!claim) {
      return;
    }

    const conditionPriority = getHomepageConditionPriority_(condition);
    if (!conditionPriority) {
      return;
    }

    priorities.push(buildHomepagePriorityItem_(claim, condition, conditionPriority));
  });

  (activeAlerts || []).forEach(function(alert) {
    const claim = claimById[alert.Claim_ID];
    if (!claim) {
      return;
    }

    const alertPriority = getHomepageAlertPriority_(alert);
    if (!alertPriority) {
      return;
    }

    priorities.push(buildHomepagePriorityItem_(claim, null, alertPriority, alert));
  });

  (activeComplianceActions || []).forEach(function(action) {
    const claim = claimById[action.Claim_ID];
    if (!claim) {
      return;
    }

    const compliancePriority = getHomepageComplianceActionPriority_(action);
    if (!compliancePriority) {
      return;
    }

    priorities.push(buildHomepagePriorityItem_(claim, null, compliancePriority, null, action));
  });

  priorities.sort(function(a, b) {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }

    return String(a.claimDisplayName || '').localeCompare(String(b.claimDisplayName || ''));
  });

  return priorities.slice(0, 12);
}

function getHomepageConditionPriority_(condition) {
  const conditionType = condition.Condition_Type || '';
  const pastFollowUp = isConditionPastFollowUp_(condition);
  const hasFollowUp = !!condition.Follow_Up_Date;

  if (conditionType === 'Monitoring Active') {
    if (!hasFollowUp) {
      return {
        type: 'Condition',
        title: 'Monitoring needs next visit scheduled',
        reason: 'Monitoring is active, but no follow-up or next monitoring date is scheduled.',
        priorityRank: 30
      };
    }

    if (pastFollowUp) {
      return {
        type: 'Condition',
        title: 'Monitoring follow-up is overdue',
        reason: 'Monitoring is active and the scheduled follow-up date has passed.',
        priorityRank: 25
      };
    }

    return null;
  }

  if (conditionType === 'Carrier Revision Requested') {
    return {
      type: 'Condition',
      title: pastFollowUp ? 'Carrier revision response is overdue' : 'Carrier revision needs response',
      reason: pastFollowUp
        ? 'Carrier revision was requested and the follow-up date has passed.'
        : 'Carrier revision has been requested and requires action.',
      priorityRank: pastFollowUp ? 20 : 35
    };
  }

  if (conditionType === 'Positive Asbestos Result') {
    return {
      type: 'Condition',
      title: pastFollowUp ? 'Asbestos coordination is overdue' : 'Coordinate asbestos abatement',
      reason: pastFollowUp
        ? 'Positive asbestos result requires abatement coordination and the follow-up date has passed.'
        : 'Positive asbestos result requires abatement coordination.',
      priorityRank: pastFollowUp ? 20 : 35
    };
  }

  if (conditionType === 'Abatement Required') {
    if (pastFollowUp || !hasFollowUp) {
      return {
        type: 'Condition',
        title: pastFollowUp ? 'Abatement follow-up is overdue' : 'Abatement needs follow-up plan',
        reason: pastFollowUp
          ? 'Abatement is required and the follow-up date has passed.'
          : 'Abatement is required and should remain operationally visible.',
        priorityRank: pastFollowUp ? 20 : 40
      };
    }

    return null;
  }

  if (conditionType === 'Revision Active') {
    if (pastFollowUp || !hasFollowUp) {
      return {
        type: 'Condition',
        title: pastFollowUp ? 'Revision follow-up is overdue' : 'Revision needs follow-up cadence',
        reason: pastFollowUp
          ? 'Revision is active and the follow-up date has passed.'
          : 'Revision is active without a scheduled follow-up date.',
        priorityRank: pastFollowUp ? 25 : 45
      };
    }

    return null;
  }

  if (conditionType === 'Waiting on Payment') {
    if (pastFollowUp) {
      return {
        type: 'Condition',
        title: 'Payment follow-up is overdue',
        reason: 'Payment is still outstanding and the follow-up date has passed.',
        priorityRank: 25
      };
    }

    return null;
  }

  if (['Coverage Pending', 'Estimate Under Review', 'Supplement Under Review', 'Asbestos Testing Pending', 'Waiting on Lab Results', 'Source of Loss Unresolved', 'Waiting on Customer Decision'].indexOf(conditionType) !== -1) {
    if (pastFollowUp) {
      return {
        type: 'Condition',
        title: conditionType + ' follow-up is overdue',
        reason: conditionType + ' has a follow-up date that has passed.',
        priorityRank: 30
      };
    }
  }

  return null;
}

function getHomepageAlertPriority_(alert) {
  const alertType = alert.Alert_Type || 'Operational Alert';
  const severity = String(alert.Severity || '').toLowerCase();

  if (severity === 'critical') {
    return {
      type: 'Alert',
      title: alertType,
      reason: alert.Reason || alert.Recommended_Action || 'Critical operational alert requires attention.',
      priorityRank: 10
    };
  }

  if (severity === 'high') {
    return {
      type: 'Alert',
      title: alertType,
      reason: alert.Reason || alert.Recommended_Action || 'High-priority operational alert requires attention.',
      priorityRank: 30
    };
  }

  return null;
}

function buildHomepagePriorityItem_(claim, condition, priority, alert, complianceAction) {
  return {
    claimId: claim.Claim_ID || '',
    claimDisplayName: getHomepageClaimDisplayName_(claim),
    customerName: claim.Customer_Name || '',
    claimNumber: claim.Claim_Number || '',
    lifecycleState: claim.Lifecycle_State || '',
    ownershipArea: claim.Ownership_Area || '',
    primaryOwner: claim.Primary_Owner || '',
    healthLevel: claim.Operational_Health || 'Healthy',
    title: priority.title || 'Operational priority',
    reason: priority.reason || '',
    type: priority.type || '',
    conditionType: condition ? condition.Condition_Type || '' : '',
    alertType: alert ? alert.Alert_Type || '' : '',
    complianceActionTitle: complianceAction ? complianceAction.Action_Title || '' : '',
    compliancePriority: complianceAction ? complianceAction.Priority || '' : '',
    complianceDueDate: complianceAction ? complianceAction.Due_Date || '' : '',
    followUpDate: condition ? condition.Follow_Up_Date || '' : '',
    priorityRank: priority.priorityRank || 999,
    targetWorkspace: 'claims',
    targetType: 'claim',
    targetId: claim.Claim_ID || '',
    targetRoute: buildHomepageTargetRoute_('claim', claim.Claim_ID || ''),
    sourceSection: 'todayPriorities'
  };
}

function buildHomepageTargetRoute_(targetType, targetId) {
  const encodedTargetId = encodeURIComponent(String(targetId || ''));

  if (targetType === 'claim') {
    return encodedTargetId ? '/exec?page=claim&claimId=' + encodedTargetId : '/exec?page=claims';
  }

  if (targetType === 'ownership') {
    return encodedTargetId ? '/exec?page=claims&ownership=' + encodedTargetId : '/exec?page=claims';
  }

  if (targetType === 'condition') {
    return encodedTargetId ? '/exec?page=claims&condition=' + encodedTargetId : '/exec?page=claims';
  }

  if (targetType === 'compliance') {
    return encodedTargetId ? '/exec?page=claims&compliance=' + encodedTargetId : '/exec?page=claims';
  }

  return '/exec?page=claims';
}

function getHomepageClaimDisplayName_(claim) {
  if (!claim) {
    return 'Unknown claim';
  }

  const customerName = claim.Customer_Name || 'Unknown Customer';
  const claimNumber = claim.Claim_Number ? ' · ' + claim.Claim_Number : '';
  return customerName + claimNumber;
}

function getHomepagePriorityRankForHealth_(healthLevel) {
  const ranks = {
    'Critical': 5,
    'Escalated': 10,
    'At Risk': 20,
    'Attention Soon': 40,
    'Healthy': 999
  };

  return ranks[healthLevel] || 999;
}

function getHomepageComplianceActions_() {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName('Compliance_Actions');

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0].map(function(header) {
    return String(header || '').trim().replace(/\s+/g, '_');
  });

  return values.slice(1).filter(function(row) {
    return row.some(function(value) {
      return String(value || '').trim() !== '';
    });
  }).map(function(row) {
    const record = {};

    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    return record;
  });
}

function countComplianceActionsByPriority_(actions, priorities) {
  const priorityMap = (priorities || []).reduce(function(map, priority) {
    map[String(priority || '').toLowerCase()] = true;
    return map;
  }, {});

  return (actions || []).filter(function(action) {
    return priorityMap[String(action.Priority || '').toLowerCase()];
  }).length;
}

function countOverdueComplianceActions_(actions) {
  const now = new Date();

  return (actions || []).filter(function(action) {
    if (!action.Due_Date) {
      return false;
    }

    const dueDate = new Date(action.Due_Date);

    if (isNaN(dueDate.getTime())) {
      return false;
    }

    return dueDate.getTime() < now.getTime();
  }).length;
}

function getHomepageComplianceActionPriority_(action) {
  const priority = String(action.Priority || '').toLowerCase();
  const dueDate = action.Due_Date ? new Date(action.Due_Date) : null;
  const isOverdue = dueDate && !isNaN(dueDate.getTime()) && dueDate.getTime() < new Date().getTime();

  if (priority === 'critical' && isOverdue) {
    return {
      type: 'Compliance',
      title: 'Critical compliance action overdue',
      reason: action.Action_Title || action.Required_Action || 'Critical compliance action is overdue.',
      priorityRank: 15
    };
  }

  if (priority === 'critical') {
    return {
      type: 'Compliance',
      title: 'Critical compliance action open',
      reason: action.Action_Title || action.Required_Action || 'Critical compliance action is open.',
      priorityRank: 35
    };
  }

  if (isOverdue) {
    return {
      type: 'Compliance',
      title: 'Compliance action overdue',
      reason: action.Action_Title || action.Required_Action || 'Compliance action is overdue.',
      priorityRank: 40
    };
  }

  return null;
}

function testInspectComplianceActionStatusDistribution() {
  const actions = getHomepageComplianceActions_();
  const claims = getRows(CLAIM_SHEET_NAMES.claims);

  const activeClaimIds = claims.filter(function(claim) {
    return isHomepageActiveClaim_(claim);
  }).reduce(function(map, claim) {
    if (claim.Claim_ID) {
      map[claim.Claim_ID] = true;
    }
    return map;
  }, {});

  const statusCounts = {};
  const priorityCounts = {};
  let activeClaimActionCount = 0;
  let openActiveClaimActionCount = 0;

  actions.forEach(function(action) {
    const status = String(action.Status || '').trim() || '(blank)';
    const priority = String(action.Priority || '').trim() || '(blank)';

    statusCounts[status] = (statusCounts[status] || 0) + 1;
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

    if (activeClaimIds[action.Claim_ID]) {
      activeClaimActionCount++;

      if (isOpenStatus_(action.Status)) {
        openActiveClaimActionCount++;
      }
    }
  });

  const result = {
    status: 'Success',
    success: true,
    message: 'Compliance action status distribution inspected successfully.',
    data: {
      totalComplianceActions: actions.length,
      activeClaimActionCount: activeClaimActionCount,
      openActiveClaimActionCount: openActiveClaimActionCount,
      statusCounts: statusCounts,
      priorityCounts: priorityCounts,
      sampleActions: actions.slice(0, 10)
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testInspectTimelineEventTypes() {
  const events = getRows(CLAIM_SHEET_NAMES.timelineEvents || 'Timeline_Events');
  const eventTypeCounts = {};
  const meaningfulCounts = {};

  events.forEach(function(event) {
    const eventType = event.Event_Type || event.Timeline_Event_Type || event.Type || '(blank)';
    const isMeaningful = event.Is_Meaningful === true || String(event.Is_Meaningful).toLowerCase() === 'true';

    eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;

    if (isMeaningful) {
      meaningfulCounts[eventType] = (meaningfulCounts[eventType] || 0) + 1;
    }
  });

  const result = {
    status: 'Success',
    success: true,
    message: 'Timeline event type distribution inspected successfully.',
    data: {
      totalTimelineEvents: events.length,
      eventTypeCounts: eventTypeCounts,
      meaningfulCounts: meaningfulCounts,
      sampleEvents: events.slice(0, 10)
    }
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}