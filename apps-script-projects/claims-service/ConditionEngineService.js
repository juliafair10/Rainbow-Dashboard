/****
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
      Condition_Type: conditionName,
      Condition_Status: 'Active',
      Condition_Name: conditionName,
      Condition_Source: source || 'ConditionEngineService',
      Status: 'Active',
      Opened_At: nowIso(),
      Started_At: nowIso(),
      Source_System: 'claims-service',
      Reason: 'Added by Condition Engine.',
      Notes: 'Added by Condition Engine.',
      Created_At: nowIso(),
      Updated_At: nowIso()
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
  const trustedText = getTrustedConditionActivityText_(activities);
  const recentText = getRecentConditionActivityText_(activities, 21);
  const structuredText = getStructuredConditionActivityText_(activities);

  const activeText = [trustedText, recentText, structuredText].join(' | ').toUpperCase();
  const explicitText = [trustedText, structuredText].join(' | ').toUpperCase();

  return {
    monitoringActive: hasConditionSignal_(activeText, [
      'MONITORING ACTIVE',
      'MONITORING VISIT',
      'MONITORING SCHEDULED',
      'EQUIPMENT MONITORING'
    ], [
      'MONITORING COMPLETE',
      'FINAL MONITOR',
      'PICKED UP EQUIPMENT',
      'EQUIPMENT PICKUP',
      'DRYING COMPLETE'
    ]),

    asbestosTestingPending: hasConditionSignal_(explicitText, [
      'ASBESTOS TESTING PENDING',
      'ASBESTOS TEST ORDERED',
      'ASBESTOS SAMPLE TAKEN',
      'WAITING ON ASBESTOS TESTING',
      'WAITING ON ASBESTOS INSPECTION'
    ], [
      'ASBESTOS CLEARED',
      'LAB RESULTS RECEIVED',
      'NEGATIVE ASBESTOS',
      'NO ASBESTOS'
    ]),

    waitingOnLabResults: hasConditionSignal_(activeText, [
      'WAITING ON LAB',
      'WAITING ON LAB RESULTS',
      'PENDING LAB RESULTS',
      'LAB RESULTS PENDING'
    ], [
      'LAB RESULTS RECEIVED',
      'RESULTS RECEIVED'
    ]),

    positiveAsbestosResult: hasConditionSignal_(explicitText, [
      'POSITIVE ASBESTOS RESULT',
      'ASBESTOS POSITIVE',
      'TESTED POSITIVE FOR ASBESTOS'
    ], [
      'FALSE POSITIVE',
      'NEGATIVE ASBESTOS',
      'NO ASBESTOS'
    ]),

    abatementRequired: hasConditionSignal_(explicitText, [
      'ABATEMENT REQUIRED',
      'SCHEDULE ABATEMENT',
      'ABATEMENT NEEDED',
      'COORDINATE ABATEMENT'
    ], [
      'ABATEMENT COMPLETE',
      'ABATEMENT COMPLETED'
    ]),

    coveragePending: hasConditionSignal_(activeText, [
      'COVERAGE PENDING',
      'PENDING COVERAGE',
      'WAITING ON COVERAGE',
      'COVERAGE REVIEW'
    ], [
      'COVERAGE APPROVED',
      'COVERAGE ACCEPTED',
      'DENIAL RECEIVED'
    ]),

    estimateUnderReview: hasConditionSignal_(activeText, [
      'ESTIMATE UNDER REVIEW',
      'ESTIMATE REVIEW',
      'REVIEWING ESTIMATE',
      'ESTIMATE SUBMITTED'
    ], [
      'REVIEW ACCEPTED',
      'ESTIMATE APPROVED',
      'APPROVED ESTIMATE'
    ]),

    carrierRevisionRequested: hasConditionSignal_(activeText, [
      'CARRIER REVISION REQUESTED',
      'CARRIER REQUESTED REVISION',
      'PLEASE REVIEW FOR REVISIONS',
      'REVISIONS REQUESTED BELOW'
    ], [
      'REVISION SUBMITTED',
      'REVISION COMPLETE',
      'REVIEW ACCEPTED'
    ]),

    revisionActive: hasConditionSignal_(activeText, [
      'REVISION ACTIVE',
      'REVISION SUBMITTED',
      'REVISION REQUESTED',
      'REVISIONS REQUESTED'
    ], [
      'REVISION ACCEPTED',
      'REVIEW ACCEPTED',
      'REVISION COMPLETE'
    ]),

    supplementUnderReview: hasConditionSignal_(activeText, [
      'SUPPLEMENT UNDER REVIEW',
      'SUPPLEMENT SUBMITTED',
      'SUPPLEMENT REVIEW'
    ], [
      'SUPPLEMENT APPROVED',
      'SUPPLEMENT ACCEPTED',
      'REVIEW ACCEPTED'
    ]),

    waitingOnPayment: hasConditionSignal_(activeText, [
      'WAITING ON PAYMENT',
      'PAYMENT PENDING',
      'PENDING PAYMENT',
      'CHECK PENDING'
    ], [
      'PAYMENT RECEIVED',
      'PAID',
      'CHECK RECEIVED'
    ]),

    waitingOnCustomerDecision: hasConditionSignal_(activeText, [
      'WAITING ON CUSTOMER',
      'CUSTOMER DECISION',
      'WAITING FOR CUSTOMER DECISION',
      'CUSTOMER TO DECIDE'
    ], [
      'CUSTOMER APPROVED',
      'CUSTOMER DECLINED',
      'CUSTOMER SCHEDULED'
    ]),

    sourceOfLossUnresolved: hasConditionSignal_(activeText, [
      'SOURCE OF LOSS UNRESOLVED',
      'CAUSE OF LOSS UNRESOLVED',
      'SOURCE OF LOSS UNKNOWN',
      'CAUSE OF LOSS UNKNOWN'
    ], [
      'SOURCE OF LOSS CONFIRMED',
      'CAUSE OF LOSS CONFIRMED'
    ])
  };
}

function hasConditionSignal_(text, positivePhrases, negativePhrases) {
  const normalizedText = String(text || '').toUpperCase();

  const hasPositive = (positivePhrases || []).some(function(phrase) {
    return normalizedText.indexOf(String(phrase || '').toUpperCase()) !== -1;
  });

  if (!hasPositive) {
    return false;
  }

  const hasNegative = (negativePhrases || []).some(function(phrase) {
    return normalizedText.indexOf(String(phrase || '').toUpperCase()) !== -1;
  });

  return !hasNegative;
}

function getTrustedConditionActivityText_(activities) {
  const parts = [];

  (activities || []).forEach(function(activity) {
    const activityType = String(activity.activityType || '').trim();
    const activityLabel = String(activity.activityLabel || '').trim();
    const summary = String(activity.summary || '').trim();

    if (activityType !== 'General') {
      parts.push(activityType);
      parts.push(activityLabel);
      parts.push(summary);
    }

    (activity.events || []).forEach(function(event) {
      const source = String(event.Event_Source || event.Source_System || '').toUpperCase();
      const category = String(event.Event_Category || '').toUpperCase();
      const eventType = String(event.Event_Type || '').toUpperCase();
      const relatedWorkflow = String(event.Related_Workflow || '').toUpperCase();

      const isStructuredSource = source.indexOf('EOJ') !== -1 ||
        source.indexOf('CONDITION') !== -1 ||
        source.indexOf('ALERT') !== -1 ||
        source.indexOf('COMPLIANCE') !== -1 ||
        source.indexOf('TODOIST') !== -1 ||
        category.indexOf('CONDITION') !== -1 ||
        eventType.indexOf('CONDITION') !== -1 ||
        relatedWorkflow.indexOf('CONDITION') !== -1;

      if (isStructuredSource) {
        parts.push(event.Event_Type || '');
        parts.push(event.Summary || '');
        parts.push(event.Detail || '');
        parts.push(event.Related_Workflow || '');
        parts.push(event.Event_Category || '');
      }
    });
  });

  return parts.join(' | ').toUpperCase();
}

function getRecentConditionActivityText_(activities, maxAgeDays) {
  const parts = [];
  const now = new Date().getTime();
  const maxAgeMs = Number(maxAgeDays || 21) * 24 * 60 * 60 * 1000;

  (activities || []).forEach(function(activity) {
    (activity.events || []).forEach(function(event) {
      const eventDate = getConditionEventDate_(event);

      if (!eventDate) {
        return;
      }

      const eventTime = eventDate.getTime();
      if (isNaN(eventTime) || now - eventTime > maxAgeMs) {
        return;
      }

      parts.push(event.Event_Type || '');
      parts.push(event.Summary || '');
      parts.push(event.Detail || '');
      parts.push(event.Related_Workflow || '');
      parts.push(event.Event_Category || '');
    });
  });

  return parts.join(' | ').toUpperCase();
}

function getStructuredConditionActivityText_(activities) {
  const parts = [];

  (activities || []).forEach(function(activity) {
    const activityType = String(activity.activityType || '').trim();

    if (activityType && activityType !== 'General') {
      parts.push(activity.activityType || '');
      parts.push(activity.activityLabel || '');
      parts.push(activity.summary || '');
    }
  });

  return parts.join(' | ').toUpperCase();
}

function getConditionEventDate_(event) {
  const candidates = [
    event.Event_Date,
    event.Created_At,
    event.Date,
    event.Activity_Date
  ];

  for (let i = 0; i < candidates.length; i++) {
    const value = candidates[i];
    if (!value) {
      continue;
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
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
    Condition_Type: conditionName,
    Condition_Status: status,
    Condition_Name: conditionName,
    Status: status,
    Condition_Source: source || 'ConditionEngineService',
    Opened_At: status === 'Active' ? nowIso() : '',
    Closed_At: status === 'Resolved' ? nowIso() : '',
    Started_At: status === 'Active' ? nowIso() : '',
    Resolved_At: status === 'Resolved' ? nowIso() : '',
    Source_System: 'claims-service',
    Reason: status + ' by Condition Engine.',
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
  const claims = findConditionEngineClaimsRows_();
  const normalizedClaimId = String(claimId || '').trim();

  const claim = claims.find(function(row) {
    return getConditionEngineClaimIdFromRow_(row) === normalizedClaimId;
  });

  if (!claim) {
    return notFoundResponse('No matching claim found.', {
      fieldName: 'Claim_ID',
      fieldValue: claimId
    });
  }

  return successResponse({
    claim: claim
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
          Event_Source: 'ConditionEngineService',
          Source_System: 'claims-service',
          Summary: 'Monitoring Active',
          Detail: 'Monitoring visit recorded.',
          Event_Category: 'Condition',
          Event_Date: nowIso()
        }
      ]
    }
  ]);

  Logger.log(JSON.stringify(sampleSignals, null, 2));
  return sampleSignals;
}

function getConditionEngineValueFromRow_(row, candidateKeys) {
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

function getConditionEngineClaimIdFromRow_(claim) {
  return getConditionEngineValueFromRow_(claim, [
    'Claim_ID',
    'Claim ID',
    'ClaimId',
    'claimId',
    'ID',
    'Id',
    'id',
    'Job_Number',
    'Job Number',
    'Job_Number__c',
    'JobNumber',
    'Job No',
    'Job #'
  ]);
}

function getConditionEngineLifecycleStateFromRow_(claim) {
  return getConditionEngineValueFromRow_(claim, [
    'Lifecycle_State',
    'Lifecycle State',
    'Lifecycle',
    'Status',
    'Claim_Status',
    'Claim Status'
  ]);
}

function getConditionEngineJobNumberFromRow_(claim) {
  return getConditionEngineValueFromRow_(claim, [
    'Job_Number',
    'Job Number',
    'JobNumber',
    'Job No',
    'Job #'
  ]);
}

function findConditionEngineClaimsRows_() {
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

function reconcileAllClaimConditions() {
  const claims = findConditionEngineClaimsRows_();
  if (claims.length > 0) {
    Logger.log('First claim row keys: ' + Object.keys(claims[0]).join(' | '));
    Logger.log('First claim row sample: ' + JSON.stringify(claims[0], null, 2));
  }

  const activeClaims = claims.filter(function(claim) {
    const state = String(getConditionEngineLifecycleStateFromRow_(claim)).trim();

    return state !== 'Operationally Complete' &&
           state !== 'Not Sold';
  });

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  activeClaims.forEach(function(claim) {
    try {
      const claimId = getConditionEngineClaimIdFromRow_(claim);
      const result = reconcileClaimConditions(claimId);

      results.push({
        claimId: getConditionEngineClaimIdFromRow_(claim) || 'UNKNOWN',
        jobNumber: getConditionEngineJobNumberFromRow_(claim),
        success: result.success,
        message: result.message || '',
        errors: result.errors || [],
        data: result.data || null
      });

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        Logger.log('Condition reconciliation failed for claim: ' + (getConditionEngineClaimIdFromRow_(claim) || 'UNKNOWN'));
        Logger.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      failureCount++;

      results.push({
        claimId: getConditionEngineClaimIdFromRow_(claim) || 'UNKNOWN',
        jobNumber: getConditionEngineJobNumberFromRow_(claim),
        success: false,
        error: error.toString(),
        stack: error.stack || ''
      });

      Logger.log('Exception during condition reconciliation for claim: ' + (getConditionEngineClaimIdFromRow_(claim) || 'UNKNOWN'));
      Logger.log(error.stack || error.toString());
    }
  });

  const response = successResponse({
    processedClaims: activeClaims.length,
    successCount: successCount,
    failureCount: failureCount,
    results: results.slice(0, 20)
  }, 'Condition reconciliation completed.');

  Logger.log(JSON.stringify(response, null, 2));

  return response;
}

function batchReconcileClaimConditions() {
  const result = reconcileAllClaimConditions();
  const data = result && result.data ? result.data : {};
  const sampleResults = data.results || [];

  let addedCount = 0;
  let skippedDuplicateCount = 0;

  sampleResults.forEach(function(item) {
    const itemData = item && item.data ? item.data : {};
    const added = itemData.added || [];
    const recommended = itemData.recommendedConditions || [];
    const active = itemData.activeConditionNames || [];

    addedCount += added.length;

    recommended.forEach(function(conditionName) {
      if (active.indexOf(conditionName) !== -1) {
        skippedDuplicateCount++;
      }
    });
  });

  const summary = {
    status: result && result.success ? 'Success' : 'Error',
    success: !!(result && result.success),
    processedClaims: data.processedClaims || 0,
    successCount: data.successCount || 0,
    failureCount: data.failureCount || 0,
    addedCount: addedCount,
    skippedDuplicateCount: skippedDuplicateCount,
    sampleResults: sampleResults,
    message: result && result.message ? result.message : 'Condition batch reconciliation completed.'
  };

  writeServiceLog('batchReconcileClaimConditions', summary.success ? 'Success' : 'Error', summary.message, summary);
  Logger.log('CONDITION_BATCH_RECONCILE_SUMMARY ' + JSON.stringify(summary));

  return successResponse(summary, 'Batch condition reconciliation completed.');
}

function testConditionEngineBatchReadiness() {
  const claims = findConditionEngineClaimsRows_();
  const activeClaims = claims.filter(function(claim) {
    const state = String(getConditionEngineLifecycleStateFromRow_(claim)).trim();
    return state !== 'Operationally Complete' && state !== 'Not Sold';
  });

  const samples = activeClaims.slice(0, 10).map(function(claim) {
    const claimId = getConditionEngineClaimIdFromRow_(claim);
    const result = evaluateClaimConditions(claimId);

    return {
      claimId: claimId,
      jobNumber: getConditionEngineJobNumberFromRow_(claim),
      success: result.success,
      recommendedConditions: result.success ? result.data.recommendedConditions : [],
      signals: result.success ? result.data.signals : null,
      message: result.message || '',
      errors: result.errors || []
    };
  });

  const response = successResponse({
    totalClaimRows: claims.length,
    activeClaimRows: activeClaims.length,
    sampleEvaluations: samples
  }, 'Condition Engine batch readiness checked.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testConditionEngineBatchReadinessCompact() {
  const claims = findConditionEngineClaimsRows_();
  const activeClaims = claims.filter(function(claim) {
    const state = String(getConditionEngineLifecycleStateFromRow_(claim)).trim();
    return state !== 'Operationally Complete' && state !== 'Not Sold';
  });

  const conditionCounts = {};
  const claimsWithConditions = [];
  const errors = [];

  activeClaims.forEach(function(claim) {
    const claimId = getConditionEngineClaimIdFromRow_(claim);
    const jobNumber = getConditionEngineJobNumberFromRow_(claim);

    if (!claimId) {
      errors.push({
        claimId: 'UNKNOWN',
        jobNumber: jobNumber,
        message: 'Missing claim id.'
      });
      return;
    }

    try {
      const result = evaluateClaimConditions(claimId);

      if (!result.success) {
        errors.push({
          claimId: claimId,
          jobNumber: jobNumber,
          message: result.message || 'Condition evaluation failed.',
          errors: result.errors || []
        });
        return;
      }

      const recommendedConditions = result.data.recommendedConditions || [];

      recommendedConditions.forEach(function(conditionName) {
        conditionCounts[conditionName] = (conditionCounts[conditionName] || 0) + 1;
      });

      if (recommendedConditions.length > 0) {
        claimsWithConditions.push({
          claimId: claimId,
          jobNumber: jobNumber,
          recommendedConditions: recommendedConditions,
          signals: result.data.signals || {}
        });
      }
    } catch (error) {
      errors.push({
        claimId: claimId,
        jobNumber: jobNumber,
        message: error && error.message ? error.message : String(error)
      });
    }
  });

  const summary = {
    status: 'Success',
    dryRun: true,
    totalClaimRows: claims.length,
    activeClaimRows: activeClaims.length,
    claimsWithRecommendedConditions: claimsWithConditions.length,
    totalRecommendedConditions: Object.keys(conditionCounts).reduce(function(total, key) {
      return total + conditionCounts[key];
    }, 0),
    conditionCounts: conditionCounts,
    sampleClaimsWithConditions: claimsWithConditions.slice(0, 10),
    errorCount: errors.length,
    errors: errors
  };

  Logger.log('CONDITION_ENGINE_BATCH_READINESS_SUMMARY ' + JSON.stringify(summary));
  return successResponse(summary, 'Compact Condition Engine batch readiness checked.');
}
function testConditionEngineHardenedSignalsForKnownClaim() {
  const claimId = 'CLM-26A-0034-WTR';
  const result = evaluateClaimConditions(claimId);

  const response = successResponse({
    claimId: claimId,
    recommendedConditions: result.success ? result.data.recommendedConditions : [],
    signals: result.success ? result.data.signals : null,
    result: result
  }, 'Hardened condition signal test completed.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}