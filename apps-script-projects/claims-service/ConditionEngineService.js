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
    return addConditionFromEngine_(claimId, conditionName, 'Condition Engine');
  });

  const removeResults = toRemove.map(function(conditionName) {
    return removeConditionFromEngine_(claimId, conditionName, 'Condition Engine');
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

/**
 * Revision request/completion sub-signals (later-stage-evidence follow-up,
 * 2026-07-01)
 *
 * The shared content classifier (deriveRawTimelineActivityType_) only has
 * one 'Revision' bucket, keyed to request-flavored language ("revisions
 * requested", "please review for revisions", ...). It has no vocabulary at
 * all for revision *completion/submission* language ("I have made the
 * requested changes and uploaded the estimate for review"), so those notes
 * fall through to whatever bucket happens to match next - often
 * 'Insurance Review' purely because the word "estimate" appears, which is
 * incidental, not a signal that carrier/insurance review activity actually
 * occurred. That gap is exactly why the live diagnostic reported no
 * revision-completion evidence for CLM-26A-0043-WTR even though the note
 * is right there in the timeline.
 *
 * These two narrow, additive checks run directly against an activity's raw
 * classification text (independent of the shared bucket) so this file can
 * tell "someone requested changes" apart from "someone submitted changes"
 * without touching deriveRawTimelineActivityType_ itself - which also
 * drives Last_Revision_At in TimelineEngineService.js and must not change
 * behavior there.
 */
function isRevisionRequestText_(rawText) {
  return rawText.indexOf('REVISIONS REQUESTED') !== -1 ||
    rawText.indexOf('PLEASE REVIEW FOR REVISIONS') !== -1 ||
    rawText.indexOf('REQUESTED BELOW') !== -1;
}

function isRevisionCompletionText_(rawText) {
  return rawText.indexOf('MADE THE REQUESTED CHANGES') !== -1 ||
    rawText.indexOf('UPLOADED THE ESTIMATE') !== -1 ||
    rawText.indexOf('REVISIONS COMPLETE') !== -1 ||
    rawText.indexOf('REVISION COMPLETE') !== -1 ||
    rawText.indexOf('RESUBMITTED') !== -1 ||
    rawText.indexOf('RE-SUBMITTED') !== -1 ||
    rawText.indexOf('CHANGES UPLOADED') !== -1;
}

/**
 * evaluateConditionResolutionRecommendation_ (Phase 5, strengthened for the
 * later-stage-evidence fix, 2026-07-01 - and its field-mapping/vocabulary
 * follow-up, same day)
 *
 * Recommends resolving an open Revision Active condition when genuine
 * (non-echoed) timeline evidence shows: the latest genuine revision
 * request/completion activity is older than the latest genuine
 * payment/accounting activity, that payment/accounting activity occurred
 * after the revision activity, and no genuine newer revision *request*
 * exists after that payment/accounting activity. Read-only - never calls
 * resolveCondition or mutates Claim_Conditions.
 */
function evaluateConditionResolutionRecommendation_(claimId, condition) {
  const notApplicable = {
    recommendedConditionResolution: false,
    resolutionRecommendationReason: '',
    confidence: 'low',
    latestGenuineRevisionEventAt: '',
    latestPaymentOrAccountingEventAt: '',
    newerRevisionRequestAfterPayment: false
  };

  if (!condition || condition.Condition_Type !== 'Revision Active') {
    return notApplicable;
  }

  const activitiesResult = synthesizeClaimActivities(claimId);
  if (!activitiesResult.success) {
    return {
      recommendedConditionResolution: false,
      resolutionRecommendationReason: 'Unable to synthesize claim activity for resolution review.',
      confidence: 'low',
      latestGenuineRevisionEventAt: '',
      latestPaymentOrAccountingEventAt: '',
      newerRevisionRequestAfterPayment: false
    };
  }

  // Quoted/Echoed Note Guard (health pipeline repair - later-stage evidence
  // fix): activities synthesized from the raw-timeline fallback path carry
  // isQuotedEcho/genuineEffectiveDate flags (see
  // TimelineSynthesisService.js). A row flagged as a quoted echo of an
  // older message is excluded here from acting as new revision or
  // payment/accounting evidence - it is still visible in the claim's
  // timeline, just not trusted for this chronology comparison. Activities
  // from the grouped-synthesis path don't carry these flags and default to
  // "not an echo" (isQuotedEcho undefined => treated as false).
  function activityEffectiveDate_(activity) {
    return activity.genuineEffectiveDate || activity.endDate || activity.startDate || 0;
  }
  function activityRawText_(activity) {
    return String(activity.rawText || '');
  }
  function isRevisionRequestActivity_(activity) {
    return activity.activityType === 'Revision' && !isRevisionCompletionText_(activityRawText_(activity));
  }
  function isRevisionCompletionActivity_(activity) {
    return isRevisionCompletionText_(activityRawText_(activity)) || isRevisionRequestText_(activityRawText_(activity));
  }
  function isGenuinePaymentOrApprovalActivity_(activity) {
    // Exclude a completion/request note that happened to land in the
    // Payment/Insurance Review bucket from also counting as approval
    // evidence for itself.
    return (activity.activityType === 'Payment' || activity.activityType === 'Insurance Review') &&
      !isRevisionCompletionText_(activityRawText_(activity)) &&
      !isRevisionRequestText_(activityRawText_(activity));
  }

  const genuineActivities = (activitiesResult.data.activities || []).filter(function(activity) {
    return activity.isQuotedEcho !== true;
  });

  const activities = genuineActivities.slice().sort(function(a, b) {
    return new Date(activityEffectiveDate_(a)).getTime() - new Date(activityEffectiveDate_(b)).getTime();
  });

  const conditionOpenedAt = condition.Opened_At ? new Date(condition.Opened_At) : null;

  const relevantActivities = activities.filter(function(activity) {
    if (!conditionOpenedAt || isNaN(conditionOpenedAt.getTime())) {
      return true;
    }
    const activityDate = new Date(activityEffectiveDate_(activity));
    return !isNaN(activityDate.getTime()) && activityDate.getTime() >= conditionOpenedAt.getTime();
  });

  // "Revision activity" for the purpose of finding the anchor point and
  // populating latestGenuineRevisionEventAt covers BOTH a request (the
  // classifier's own 'Revision' bucket, minus anything that's actually
  // completion language) AND a completion/submission note (which the
  // shared classifier often mis-buckets, hence the dedicated text check).
  const revisionActivities = relevantActivities.filter(function(activity) {
    return isRevisionRequestActivity_(activity) || isRevisionCompletionActivity_(activity);
  });
  const paymentActivities = relevantActivities.filter(isGenuinePaymentOrApprovalActivity_);

  const latestGenuineRevisionEventAt = revisionActivities.length
    ? activityEffectiveDate_(revisionActivities[revisionActivities.length - 1])
    : '';
  const latestPaymentOrAccountingEventAt = paymentActivities.length
    ? activityEffectiveDate_(paymentActivities[paymentActivities.length - 1])
    : '';

  // Does any genuine revision REQUEST (not completion) occur after the
  // latest genuine payment/accounting activity? Computed directly over the
  // full (condition-scoped) relevant-activity sequence, independent of the
  // "last revision before this" logic below, since this is the exact
  // question the diagnostic needs answered either way.
  let lastPaymentIndex = -1;
  relevantActivities.forEach(function(activity, index) {
    if (isGenuinePaymentOrApprovalActivity_(activity)) {
      lastPaymentIndex = index;
    }
  });
  const newerRevisionRequestAfterPayment = lastPaymentIndex !== -1 && relevantActivities.some(function(activity, index) {
    return index > lastPaymentIndex && isRevisionRequestActivity_(activity);
  });

  let lastRevisionIndex = -1;
  relevantActivities.forEach(function(activity, index) {
    if (isRevisionRequestActivity_(activity) || isRevisionCompletionActivity_(activity)) {
      lastRevisionIndex = index;
    }
  });

  const baseFields = {
    latestGenuineRevisionEventAt: latestGenuineRevisionEventAt,
    latestPaymentOrAccountingEventAt: latestPaymentOrAccountingEventAt,
    newerRevisionRequestAfterPayment: newerRevisionRequestAfterPayment
  };

  if (lastRevisionIndex === -1) {
    return Object.assign({
      recommendedConditionResolution: false,
      resolutionRecommendationReason: 'No genuine revision completion/submission activity found since the condition opened.',
      confidence: 'low'
    }, baseFields);
  }

  const activitiesAfterLastRevision = relevantActivities.slice(lastRevisionIndex + 1);

  // Only a REQUEST re-opens the loop - a completion/submission note found
  // later (there shouldn't be one, since lastRevisionIndex already points
  // at the latest of either) would not disqualify the recommendation.
  const hasNewerRevisionRequest = activitiesAfterLastRevision.some(isRevisionRequestActivity_);

  if (hasNewerRevisionRequest) {
    return Object.assign({
      recommendedConditionResolution: false,
      resolutionRecommendationReason: 'Newer genuine revision request exists after the most recent revision activity.',
      confidence: 'low'
    }, baseFields);
  }

  const approvalActivity = activitiesAfterLastRevision.find(isGenuinePaymentOrApprovalActivity_);

  if (!approvalActivity) {
    return Object.assign({
      recommendedConditionResolution: false,
      resolutionRecommendationReason: 'No genuine payment or approval activity found after the last revision submission.',
      confidence: 'low'
    }, baseFields);
  }

  return Object.assign({
    recommendedConditionResolution: true,
    resolutionRecommendationReason: 'Revision activity appears complete and payment/approval activity (' +
      approvalActivity.activityType + ') genuinely occurred after the last revision event, with no newer genuine revision request since.',
    confidence: 'medium'
  }, baseFields);
}

/**
 * debugConditionResolutionEvidenceForClaim_ (later-stage-evidence follow-up,
 * 2026-07-01)
 *
 * Read-only debug/diagnostic aid, not part of the health or condition
 * pipeline. Prints every candidate timeline row for a claim's open
 * Revision Active condition, in chronology order, with the exact fields
 * requested for the live-bug investigation: event id, event timestamp,
 * event type, the raw Event_Type value ("event category" - this schema has
 * no distinct Event_Category column, noted below), summary, the exact
 * detail/body text used for classification, the synthesized activity type,
 * isQuotedOrEchoed, isRevisionRequest, isRevisionCompletion,
 * isPaymentOrAccounting, and excludedReason for any row that didn't make it
 * into the recommendation's relevant-activity set.
 */
function debugConditionResolutionEvidenceForClaim_(claimId, conditionOverride) {
  const condition = conditionOverride || (function() {
    const conditions = getRows(CLAIM_SHEET_NAMES.conditions).filter(function(row) {
      return row.Claim_ID === claimId &&
        row.Condition_Type === 'Revision Active' &&
        String(row.Condition_Status || '').toLowerCase() !== 'closed' &&
        String(row.Condition_Status || '').toLowerCase() !== 'resolved';
    });
    return conditions.length ? conditions[0] : null;
  })();

  if (!condition) {
    const noConditionResult = { claimId: claimId, note: 'No open Revision Active condition found for this claim.' };
    Logger.log(JSON.stringify(noConditionResult, null, 2));
    return noConditionResult;
  }

  const activitiesResult = synthesizeClaimActivities(claimId);
  if (!activitiesResult.success) {
    const failureResult = { claimId: claimId, note: 'synthesizeClaimActivities failed.', result: activitiesResult };
    Logger.log(JSON.stringify(failureResult, null, 2));
    return failureResult;
  }

  function activityEffectiveDate_(activity) {
    return activity.genuineEffectiveDate || activity.endDate || activity.startDate || 0;
  }
  function activityRawText_(activity) {
    return String(activity.rawText || '');
  }

  const conditionOpenedAt = condition.Opened_At ? new Date(condition.Opened_At) : null;

  const rows = (activitiesResult.data.activities || [])
    .slice()
    .sort(function(a, b) {
      return new Date(activityEffectiveDate_(a)).getTime() - new Date(activityEffectiveDate_(b)).getTime();
    })
    .map(function(activity) {
      const sourceEvent = (activity.events && activity.events[0]) || {};
      const effectiveDate = activityEffectiveDate_(activity);
      const rawText = activityRawText_(activity);
      const isQuotedOrEchoed = activity.isQuotedEcho === true;
      const isPaymentOrAccounting = (activity.activityType === 'Payment' || activity.activityType === 'Insurance Review') &&
        !isRevisionCompletionText_(rawText) && !isRevisionRequestText_(rawText);
      const isRevisionRequest = activity.activityType === 'Revision' && !isRevisionCompletionText_(rawText);
      const isRevisionCompletion = isRevisionCompletionText_(rawText) || isRevisionRequestText_(rawText);

      let excludedReason = '';
      if (isQuotedOrEchoed) {
        excludedReason = 'Excluded: flagged as a quoted/echoed reply fragment, not a new event.';
      } else if (conditionOpenedAt && !isNaN(conditionOpenedAt.getTime())) {
        const effectiveDateObj = new Date(effectiveDate);
        if (isNaN(effectiveDateObj.getTime()) || effectiveDateObj.getTime() < conditionOpenedAt.getTime()) {
          excludedReason = 'Excluded: effective date is before the condition\'s Opened_At.';
        }
      }

      return {
        eventId: sourceEvent.Timeline_Event_ID || sourceEvent.Event_ID || sourceEvent['Event ID'] || '',
        eventTimestamp: effectiveDate,
        eventType: sourceEvent.Event_Type || sourceEvent['Event Type'] || '',
        eventCategory: sourceEvent.Event_Category || sourceEvent['Event Category'] || '(no Event_Category column in this schema - Event_Type shown above is the closest equivalent)',
        summary: sourceEvent.Summary || '',
        classificationText: rawText,
        synthesizedActivityType: activity.activityType,
        isQuotedOrEchoed: isQuotedOrEchoed,
        isRevisionRequest: isRevisionRequest,
        isRevisionCompletion: isRevisionCompletion,
        isPaymentOrAccounting: isPaymentOrAccounting,
        excludedReason: excludedReason
      };
    });

  const result = {
    claimId: claimId,
    conditionId: condition.Condition_ID || '',
    conditionOpenedAt: condition.Opened_At || '',
    rowCount: rows.length,
    rows: rows
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testDebugConditionResolutionEvidenceForKnownClaim() {
  return debugConditionResolutionEvidenceForClaim_('CLM-26A-0043-WTR');
}

function addConditionFromEngine_(claimId, conditionName, source) {
  if (!claimId || !conditionName) {
    return validationErrorResponse(['Claim_ID and conditionName are required to add a condition.']);
  }
  return appendConditionEngineFallbackRow_(claimId, conditionName, 'Active', source || 'ConditionEngineService');
}

function removeConditionFromEngine_(claimId, conditionName, source) {
  if (!claimId || !conditionName) {
    return validationErrorResponse(['Claim_ID and conditionName are required to remove a condition.']);
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
    // Phase 4 (health pipeline repair): reuses the same
    // resolveConditionFollowUpDate_ helper ConditionService.addCondition
    // uses, so both condition-creation paths default Revision Active the
    // same way. This engine-driven path has no caller-supplied date to
    // preserve (reconcileClaimConditions doesn't pass one through), so it
    // only ever produces the Revision Active default or empty.
    Follow_Up_Date: status === 'Active' ? resolveConditionFollowUpDate_(conditionName, {}) : '',
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

function runMorningConditionReconciliation_() {
  // Phase 1 (health pipeline repair): called from
  // MorningAutomationService.runMorningIntelligence() (itself invoked by
  // runRainbowMorningAutomation()) so condition
  // reconciliation runs automatically instead of only from manual test
  // functions. reconcileClaimConditions() only ever adds conditions that
  // aren't already active (see the "toRemove" policy in
  // reconcileClaimConditions() above), so repeated runs are idempotent -
  // re-running this against an unchanged claim produces no new rows.
  //
  // batchReconcileClaimConditions()/reconcileAllClaimConditions() already
  // return a well-formed successResponse/errorResponse, so this wrapper
  // passes that result through unchanged (it does not re-wrap it in an
  // unconditional successResponse) so a genuine reconciliation failure is
  // correctly reported as a failed morning automation step.
  return batchReconcileClaimConditions();
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

const CONDITION_AUDIT_SHEET_NAME = 'Condition_Audit';
const CONDITION_AUDIT_HEADERS = [
  'Audit_ID',
  'Claim_ID',
  'Job_Number',
  'Customer_Name',
  'Current_Health',
  'Engine_Conditions',
  'Likely_Conditions',
  'Missing_Conditions',
  'Evidence_Text',
  'Audit_Result',
  'Audited_At'
];

const CONDITION_AUDIT_RULES = [
  {
    conditionName: 'Coverage Pending',
    phrases: ['COVERAGE PENDING', 'PENDING COVERAGE', 'WAITING ON COVERAGE', 'COVERAGE REVIEW'],
    negativePhrases: ['COVERAGE APPROVED', 'COVERAGE ACCEPTED', 'DENIAL RECEIVED']
  },
  {
    conditionName: 'Estimate Under Review',
    phrases: ['ESTIMATE UNDER REVIEW', 'ESTIMATE REVIEW', 'REVIEWING ESTIMATE', 'ESTIMATE SUBMITTED'],
    negativePhrases: ['ESTIMATE APPROVED', 'APPROVED ESTIMATE', 'REVIEW ACCEPTED']
  },
  {
    conditionName: 'Carrier Revision Requested',
    phrases: ['CARRIER REVISION REQUESTED', 'CARRIER REQUESTED REVISION', 'PLEASE REVIEW FOR REVISIONS', 'REVISIONS REQUESTED BELOW'],
    negativePhrases: ['REVISION SUBMITTED', 'REVISION COMPLETE', 'REVIEW ACCEPTED']
  },
  {
    conditionName: 'Revision Active',
    phrases: ['REVISION ACTIVE', 'REVISION SUBMITTED', 'REVISION REQUESTED', 'REVISIONS REQUESTED'],
    negativePhrases: ['REVISION ACCEPTED', 'REVISION COMPLETE', 'REVIEW ACCEPTED']
  },
  {
    conditionName: 'Supplement Under Review',
    phrases: ['SUPPLEMENT UNDER REVIEW', 'SUPPLEMENT SUBMITTED', 'SUPPLEMENT REVIEW'],
    negativePhrases: ['SUPPLEMENT APPROVED', 'SUPPLEMENT ACCEPTED', 'REVIEW ACCEPTED']
  },
  {
    conditionName: 'Waiting on Payment',
    phrases: ['WAITING ON PAYMENT', 'PAYMENT PENDING', 'PENDING PAYMENT', 'CHECK PENDING'],
    negativePhrases: ['PAYMENT RECEIVED', 'CHECK RECEIVED']
  },
  {
    conditionName: 'Monitoring Active',
    phrases: ['MONITORING ACTIVE', 'MONITORING VISIT', 'MONITORING SCHEDULED', 'EQUIPMENT MONITORING'],
    negativePhrases: ['MONITORING COMPLETE', 'FINAL MONITOR', 'PICKED UP EQUIPMENT', 'EQUIPMENT PICKUP', 'DRYING COMPLETE']
  },
  {
    conditionName: 'Waiting on Lab Results',
    phrases: ['WAITING ON LAB', 'WAITING ON LAB RESULTS', 'PENDING LAB RESULTS', 'LAB RESULTS PENDING'],
    negativePhrases: ['LAB RESULTS RECEIVED', 'RESULTS RECEIVED']
  },
  {
    conditionName: 'Positive Asbestos Result',
    phrases: ['POSITIVE ASBESTOS RESULT', 'ASBESTOS POSITIVE', 'TESTED POSITIVE FOR ASBESTOS'],
    negativePhrases: ['FALSE POSITIVE', 'NEGATIVE ASBESTOS', 'NO ASBESTOS']
  },
  {
    conditionName: 'Abatement Required',
    phrases: ['ABATEMENT REQUIRED', 'SCHEDULE ABATEMENT', 'ABATEMENT NEEDED', 'COORDINATE ABATEMENT'],
    negativePhrases: ['ABATEMENT COMPLETE', 'ABATEMENT COMPLETED']
  },
  {
    conditionName: 'Waiting on Customer Decision',
    phrases: ['WAITING ON CUSTOMER', 'CUSTOMER DECISION', 'WAITING FOR CUSTOMER DECISION', 'CUSTOMER TO DECIDE'],
    negativePhrases: ['CUSTOMER APPROVED', 'CUSTOMER DECLINED', 'CUSTOMER SCHEDULED']
  },
  {
    conditionName: 'Source of Loss Unresolved',
    phrases: ['SOURCE OF LOSS UNRESOLVED', 'CAUSE OF LOSS UNRESOLVED', 'SOURCE OF LOSS UNKNOWN', 'CAUSE OF LOSS UNKNOWN'],
    negativePhrases: ['SOURCE OF LOSS CONFIRMED', 'CAUSE OF LOSS CONFIRMED']
  }
];

function runConditionAudit() {
  try {
    const auditedAt = nowIso();
    const claims = findConditionEngineClaimsRows_();
    const activeClaims = claims.filter(function(claim) {
      return isConditionAuditActiveClaim_(claim);
    });

    const auditRows = [];
    const summary = {
      activeClaimsAudited: 0,
      matches: 0,
      possibleMissingConditions: 0,
      noSignal: 0,
      conditionCounts: {},
      topMissingConditions: {}
    };

    activeClaims.forEach(function(claim) {
      const row = buildConditionAuditRow_(claim, auditedAt);
      auditRows.push(row);
      updateConditionAuditSummary_(summary, row);
    });

    summary.activeClaimsAudited = auditRows.length;
    summary.topMissingConditions = sortConditionAuditCountMap_(summary.topMissingConditions);

    writeConditionAuditRows_(auditRows);

    const response = successResponse({
      summary: summary,
      auditSheetName: CONDITION_AUDIT_SHEET_NAME,
      rowsWritten: auditRows.length
    }, 'Condition audit completed.');

    Logger.log('CONDITION_AUDIT_SUMMARY ' + JSON.stringify(summary));
    return response;
  } catch (error) {
    const response = errorResponse('Condition audit failed.', {
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ''
    });

    Logger.log(JSON.stringify(response, null, 2));
    return response;
  }
}

function buildConditionAuditRow_(claim, auditedAt) {
  const claimId = getConditionEngineClaimIdFromRow_(claim);
  const jobNumber = getConditionEngineJobNumberFromRow_(claim);
  const customerName = getConditionAuditCustomerName_(claim);
  const currentHealth = getConditionAuditCurrentHealth_(claim);
  const evaluationResult = evaluateClaimConditions(claimId);
  const activitiesResult = synthesizeClaimActivities(claimId);
  const engineConditions = evaluationResult.success ? evaluationResult.data.recommendedConditions || [] : [];
  const activities = activitiesResult.success ? activitiesResult.data.activities || [] : [];
  const textItems = getConditionAuditSearchableTextItems_(activities);
  const likelyResult = findConditionAuditLikelyConditions_(textItems);
  const likelyConditions = likelyResult.likelyConditions;
  const missingConditions = likelyConditions.filter(function(conditionName) {
    return engineConditions.indexOf(conditionName) === -1;
  });
  let auditResult = 'No Signal';

  if (likelyConditions.length > 0 && missingConditions.length > 0) {
    auditResult = 'Possible Missing Condition';
  } else if (likelyConditions.length > 0) {
    auditResult = 'Match';
  }

  return {
    Audit_ID: generateId('CNA'),
    Claim_ID: claimId,
    Job_Number: jobNumber,
    Customer_Name: customerName,
    Current_Health: currentHealth,
    Engine_Conditions: engineConditions.join(', '),
    Likely_Conditions: likelyConditions.join(', '),
    Missing_Conditions: missingConditions.join(', '),
    Evidence_Text: formatConditionAuditEvidence_(likelyResult.evidenceByCondition, missingConditions.length ? missingConditions : likelyConditions),
    Audit_Result: auditResult,
    Audited_At: auditedAt
  };
}

function isConditionAuditActiveClaim_(claim) {
  if (!getConditionEngineClaimIdFromRow_(claim)) {
    return false;
  }

  const isActive = String(getConditionEngineValueFromRow_(claim, ['Is_Active', 'Is Active'])).toLowerCase();
  const isNotSold = String(getConditionEngineValueFromRow_(claim, ['Is_Not_Sold', 'Is Not Sold'])).toLowerCase();
  const isComplete = String(getConditionEngineValueFromRow_(claim, ['Is_Operationally_Complete', 'Is Operationally Complete'])).toLowerCase();
  const lifecycleState = String(getConditionEngineLifecycleStateFromRow_(claim)).trim();

  if (isActive === 'false' || isNotSold === 'true' || isComplete === 'true') {
    return false;
  }

  return lifecycleState !== 'Operationally Complete' && lifecycleState !== 'Not Sold';
}

function getConditionAuditCustomerName_(claim) {
  return getConditionEngineValueFromRow_(claim, [
    'Customer_Name',
    'Customer Name',
    'Display_Name',
    'Display Name',
    'Claim_Label',
    'Claim Label'
  ]);
}

function getConditionAuditCurrentHealth_(claim) {
  return getConditionEngineValueFromRow_(claim, [
    'Health Status',
    'Health_Status',
    'Operational_Health',
    'Health_Level',
    'Health Level'
  ]) || 'Healthy';
}

function getConditionAuditSearchableTextItems_(activities) {
  const items = [];

  (activities || []).forEach(function(activity) {
    addConditionAuditTextItem_(items, [
      activity.activityType,
      activity.activityLabel,
      activity.summary
    ]);

    (activity.events || []).forEach(function(event) {
      addConditionAuditTextItem_(items, [
        event.Event_Type,
        event.Summary,
        event.Detail,
        event.Related_Workflow,
        event.Event_Category,
        event.Source_System,
        event.Event_Source
      ]);
    });
  });

  return items;
}

function addConditionAuditTextItem_(items, parts) {
  const text = (parts || []).map(function(part) {
    return String(part || '').trim();
  }).filter(function(part) {
    return part !== '';
  }).join(' | ');

  if (text) {
    items.push(text);
  }
}

function findConditionAuditLikelyConditions_(textItems) {
  const likelyConditions = [];
  const evidenceByCondition = {};

  CONDITION_AUDIT_RULES.forEach(function(rule) {
    const match = findConditionAuditRuleMatch_(textItems, rule);
    if (!match) {
      return;
    }

    likelyConditions.push(rule.conditionName);
    evidenceByCondition[rule.conditionName] = match.evidence;
  });

  return {
    likelyConditions: likelyConditions,
    evidenceByCondition: evidenceByCondition
  };
}

function findConditionAuditRuleMatch_(textItems, rule) {
  for (let i = 0; i < (textItems || []).length; i++) {
    const text = String(textItems[i] || '');
    const upperText = text.toUpperCase();
    const matchedPhrase = (rule.phrases || []).find(function(phrase) {
      return upperText.indexOf(String(phrase || '').toUpperCase()) !== -1;
    });

    if (!matchedPhrase) {
      continue;
    }

    const hasNegative = (rule.negativePhrases || []).some(function(phrase) {
      return upperText.indexOf(String(phrase || '').toUpperCase()) !== -1;
    });

    if (hasNegative) {
      continue;
    }

    return {
      phrase: matchedPhrase,
      evidence: buildConditionAuditExcerpt_(text, matchedPhrase)
    };
  }

  return null;
}

function buildConditionAuditExcerpt_(text, phrase) {
  const sourceText = String(text || '').replace(/\s+/g, ' ').trim();
  const upperText = sourceText.toUpperCase();
  const upperPhrase = String(phrase || '').toUpperCase();
  const index = upperText.indexOf(upperPhrase);

  if (index === -1) {
    return sourceText.slice(0, 180);
  }

  const start = Math.max(0, index - 70);
  const end = Math.min(sourceText.length, index + upperPhrase.length + 90);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < sourceText.length ? '...' : '';

  return prefix + sourceText.slice(start, end) + suffix;
}

function formatConditionAuditEvidence_(evidenceByCondition, conditionNames) {
  return (conditionNames || []).map(function(conditionName) {
    const evidence = evidenceByCondition[conditionName] || '';
    return evidence ? conditionName + ': ' + evidence : '';
  }).filter(function(value) {
    return value !== '';
  }).join(' || ').slice(0, 900);
}

function updateConditionAuditSummary_(summary, row) {
  if (row.Audit_Result === 'Match') {
    summary.matches++;
  } else if (row.Audit_Result === 'Possible Missing Condition') {
    summary.possibleMissingConditions++;
  } else {
    summary.noSignal++;
  }

  splitConditionAuditList_(row.Likely_Conditions).forEach(function(conditionName) {
    summary.conditionCounts[conditionName] = (summary.conditionCounts[conditionName] || 0) + 1;
  });

  splitConditionAuditList_(row.Missing_Conditions).forEach(function(conditionName) {
    summary.topMissingConditions[conditionName] = (summary.topMissingConditions[conditionName] || 0) + 1;
  });
}

function splitConditionAuditList_(value) {
  return String(value || '').split(',').map(function(item) {
    return item.trim();
  }).filter(function(item) {
    return item !== '';
  });
}

function sortConditionAuditCountMap_(countMap) {
  const sorted = {};

  Object.keys(countMap || {}).sort(function(a, b) {
    return countMap[b] - countMap[a] || a.localeCompare(b);
  }).forEach(function(key) {
    sorted[key] = countMap[key];
  });

  return sorted;
}

function writeConditionAuditRows_(auditRows) {
  const ss = getClaimFoundationSpreadsheet_();
  let sheet = ss.getSheetByName(CONDITION_AUDIT_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONDITION_AUDIT_SHEET_NAME);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, CONDITION_AUDIT_HEADERS.length).setValues([CONDITION_AUDIT_HEADERS]);

  if (auditRows.length > 0) {
    const values = auditRows.map(function(row) {
      return valuesFromObject_(CONDITION_AUDIT_HEADERS, row);
    });

    sheet.getRange(2, 1, values.length, CONDITION_AUDIT_HEADERS.length).setValues(values);
  }

  sheet.setFrozenRows(1);
}

function testRunConditionAudit() {
  const response = runConditionAudit();
  const summary = response && response.success && response.data ? response.data.summary : response;

  Logger.log('CONDITION_AUDIT_TEST_SUMMARY ' + JSON.stringify(summary, null, 2));
  return response;
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
