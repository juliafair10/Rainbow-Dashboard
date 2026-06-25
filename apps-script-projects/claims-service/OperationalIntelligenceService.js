/**
 * OperationalIntelligenceService
 * Rainbow Phase 10 — Operational Intelligence Orchestrator
 *
 * Composes Rainbow's existing engines into one consistent operational
 * interpretation of a claim. This is NOT a rewrite of any engine.
 * It is a COMPOSITION layer that reads from already-fetched, in-memory
 * data only. No additional Sheets API calls are made here.
 *
 * Call order:
 *   1. Lifecycle  — read from claimFoundation (engine makes Sheets calls)
 *   2. Conditions — read from claimFoundation (engine makes Sheets calls)
 *   3. Ownership  — read from claimFoundation (engine makes Sheets calls)
 *   4. Health     — read from claimFoundation (engine makes Sheets calls)
 *   5. Alerts     — read from claimFoundation (engine manages its own sheet)
 *   6. Financial  — read from claimFoundation.financialTracks (already fetched)
 *   7. Timeline   — read from claimFoundation.timeline  (already fetched)
 *   8. Compose    — derive waitingOn, operationalPriority, staleRisk,
 *                   nextAction, operationalSummary
 *
 * SKIPPED ENGINES (all make their own Sheets API calls and cannot be
 * safely called here per-request without causing quota issues):
 *   - evaluateLifecycleState()     — calls getClaimById_() + synthesizeClaimActivities()
 *   - evaluateClaimConditions()    — calls findConditionEngineClaimsRows_() + synthesizeClaimActivities()
 *   - evaluateOwnership()          — calls evaluateLifecycleState() + findRows(conditions)
 *   - evaluateClaimHealth()        — calls findHealthEngineClaimsRows_() + getRows(conditions) + getRows(healthHistory)
 *   - reconcileClaimConditions()   — writes to sheets
 *   - addAlert() / resolveAlert()  — writes to sheets
 *
 * All values are read from the canonical claimFoundation object that
 * ClaimFoundationService already assembled from detail data.
 */

// ---------------------------------------------------------------------------
// Primary entry point
// ---------------------------------------------------------------------------

/**
 * buildOperationalIntelligence_
 *
 * @param {object} claimFoundation - the canonical object from buildClaimFoundation_()
 * @param {object} detail          - the fully-assembled detail object (for fallbacks)
 * @returns {object} operationalIntelligence
 */
function buildOperationalIntelligence_(claimFoundation, detail) {
  claimFoundation = claimFoundation || {};
  detail = detail || {};

  var claimId = claimFoundation.claimId || detail.claimId || '';

  // --- Step 1: Lifecycle (from claimFoundation — engine makes Sheets calls) ---
  var lifecycle = buildOILifecycle_(claimFoundation);

  // --- Step 2: Conditions (from claimFoundation — engine makes Sheets calls) ---
  var conditions = buildOIConditions_(claimFoundation);

  // --- Step 3: Ownership (from claimFoundation — engine makes Sheets calls) ---
  var ownership = buildOIOwnership_(claimFoundation);

  // --- Step 4: Health (from claimFoundation — engine makes Sheets calls) ---
  var health = buildOIHealth_(claimFoundation);

  // --- Step 5: Alerts (from claimFoundation — engine manages its own sheet) ---
  var alerts = buildOIAlerts_(claimFoundation);

  // --- Step 6: Requirements (from claimFoundation — already fetched) ---
  var requirements = buildOIRequirements_(claimFoundation);

  // --- Step 7: Financial Tracks (from claimFoundation — already fetched) ---
  var financialTracks = buildOIFinancialTracks_(claimFoundation);

  // --- Step 8: Timeline (from claimFoundation — already fetched) ---
  var timeline = buildOITimeline_(claimFoundation);

  // --- Step 9: Compose derived fields ---
  var waitingOn = buildOIWaitingOn_(conditions, ownership);
  var operationalPriority = buildOIOperationalPriority_(health, lifecycle);
  var staleRisk = buildOIStaleRisk_(health);
  var lastMeaningfulActivity = health.lastMeaningfulActivity || '';
  var nextAction = buildOINextAction_(claimFoundation, ownership, waitingOn, operationalPriority);
  var operationalSummary = buildOIOperationalSummary_(claimFoundation, lifecycle, health, ownership, conditions, waitingOn, nextAction);

  return {
    claimId: claimId,
    lifecycle: lifecycle,
    ownership: ownership,
    health: health,
    conditions: conditions,
    alerts: alerts,
    requirements: requirements,
    nextAction: nextAction,
    waitingOn: waitingOn,
    operationalPriority: operationalPriority,
    staleRisk: staleRisk,
    lastMeaningfulActivity: lastMeaningfulActivity,
    operationalSummary: operationalSummary,
    timeline: timeline,
    financialTracks: financialTracks
  };
}

// ---------------------------------------------------------------------------
// Step builders — each reads exclusively from in-memory claimFoundation
// ---------------------------------------------------------------------------

/**
 * Step 1: Lifecycle
 * Source: claimFoundation.lifecycle (populated by ClaimFoundationService from
 * claimHeader.lifecycleState / drawer.lifecycleState — no extra Sheets calls).
 */
function buildOILifecycle_(claimFoundation) {
  var lc = claimFoundation.lifecycle || {};

  return {
    state: buildOISafeString_(lc.state, 'Not recorded'),
    reason: buildOISafeString_(lc.reason, ''),
    confidence: buildOISafeString_(lc.confidence, ''),
    lastUpdated: buildOISafeString_(lc.lastUpdated, '')
  };
}

/**
 * Step 2: Conditions
 * Source: claimFoundation.conditions (populated by buildFoundationActiveConditions_
 * and buildFoundationPrimaryCondition_ — in-memory, no Sheets calls).
 */
function buildOIConditions_(claimFoundation) {
  var cond = claimFoundation.conditions || {};
  var activeConditions = Array.isArray(cond.active) ? cond.active : [];

  return {
    active: activeConditions,
    primaryCondition: buildOISafeString_(cond.primaryCondition, 'No active condition'),
    waitingOn: buildOISafeString_(cond.waitingOn, 'No active condition')
  };
}

/**
 * Step 3: Ownership
 * Source: claimFoundation.ownership (populated from claimHeader — in-memory).
 */
function buildOIOwnership_(claimFoundation) {
  var own = claimFoundation.ownership || {};

  return {
    area: buildOISafeString_(own.area, 'Not recorded'),
    primaryOwner: buildOISafeString_(own.primaryOwner, 'Not recorded'),
    ownerLabel: buildOISafeString_(own.ownerLabel, 'Unassigned'),
    reason: buildOISafeString_(own.reason, '')
  };
}

/**
 * Step 4: Health
 * Source: claimFoundation.health (populated from claimHeader and
 * buildFoundationDaysSinceActivity_ — in-memory).
 */
function buildOIHealth_(claimFoundation) {
  var h = claimFoundation.health || {};

  return {
    level: buildOISafeString_(h.level, 'Not rated'),
    reason: buildOISafeString_(h.reason, ''),
    priority: buildOISafeNumber_(h.priority, 5),
    lastMeaningfulActivity: buildOISafeString_(h.lastMeaningfulActivity, ''),
    daysSinceMeaningfulActivity: buildOISafeNumber_(h.daysSinceMeaningfulActivity, 0)
  };
}

/**
 * Step 5: Alerts
 * Source: claimFoundation.alerts (populated by buildFoundationActiveAlerts_ — in-memory).
 */
function buildOIAlerts_(claimFoundation) {
  var al = claimFoundation.alerts || {};
  var activeAlerts = Array.isArray(al.active) ? al.active : [];

  return {
    active: activeAlerts,
    count: buildOISafeNumber_(al.count, 0),
    highestSeverity: buildOISafeString_(al.highestSeverity, '')
  };
}

/**
 * Step 6: Requirements
 * Source: claimFoundation.requirements (populated by buildFoundationOpenRequirements_ — in-memory).
 */
function buildOIRequirements_(claimFoundation) {
  var req = claimFoundation.requirements || {};
  var openRequirements = Array.isArray(req.open) ? req.open : [];

  return {
    open: openRequirements,
    count: buildOISafeNumber_(req.count, openRequirements.length)
  };
}

/**
 * Step 7: Financial Tracks
 * Source: claimFoundation.financialTracks (fetched once by ClaimFinancialTrackService
 * in getClaimDetail — already in-memory).
 */
function buildOIFinancialTracks_(claimFoundation) {
  return Array.isArray(claimFoundation.financialTracks) ? claimFoundation.financialTracks : [];
}

/**
 * Step 8: Timeline
 * Source: claimFoundation.timeline (fetched once by getWorkspaceTimelineForClaim_
 * in getClaimDetail — already in-memory).
 */
function buildOITimeline_(claimFoundation) {
  var tl = claimFoundation.timeline || {};

  return {
    groups: Array.isArray(tl.groups) ? tl.groups : [],
    events: Array.isArray(tl.events) ? tl.events : []
  };
}

// ---------------------------------------------------------------------------
// Step 9: Derived field builders
// ---------------------------------------------------------------------------

/**
 * buildOIWaitingOn_
 *
 * Maps primaryCondition and ownershipArea into a canonical waitingOn value.
 *
 * Canonical values:
 *   'Carrier' | 'Customer' | 'Technician' | 'Accounting' | 'Lab'
 *   | 'Rainbow' | 'Nobody' | 'Unknown'
 */
function buildOIWaitingOn_(conditions, ownership) {
  var primaryCondition = buildOISafeString_(conditions.primaryCondition, '').toLowerCase();
  var ownerArea = buildOISafeString_(ownership.area, '').toLowerCase();
  var activeConditions = Array.isArray(conditions.active) ? conditions.active : [];

  // Build a concatenated string of all active condition labels for matching.
  var allConditionText = primaryCondition + ' | ' + activeConditions.map(function(c) {
    if (typeof c === 'string') {
      return c.toLowerCase();
    }
    if (c && typeof c === 'object') {
      return String(
        c.conditionType || c.Condition_Type || c.conditionName || c.Condition_Name || c.name || ''
      ).toLowerCase();
    }
    return '';
  }).join(' | ');

  // Carrier: coverage or carrier-related conditions
  if (allConditionText.indexOf('coverage pending') !== -1 ||
      allConditionText.indexOf('waiting on carrier') !== -1 ||
      allConditionText.indexOf('carrier revision') !== -1 ||
      allConditionText.indexOf('estimate under review') !== -1 ||
      allConditionText.indexOf('supplement under review') !== -1) {
    return 'Carrier';
  }

  // Lab: asbestos or lab results
  if (allConditionText.indexOf('asbestos') !== -1 ||
      allConditionText.indexOf('waiting on lab') !== -1 ||
      allConditionText.indexOf('lab results') !== -1) {
    return 'Lab';
  }

  // Customer: customer decision
  if (allConditionText.indexOf('waiting on customer') !== -1 ||
      allConditionText.indexOf('customer decision') !== -1) {
    return 'Customer';
  }

  // Accounting: payment
  if (allConditionText.indexOf('waiting on payment') !== -1) {
    return 'Accounting';
  }

  // Rainbow: active revision work owned by Rainbow
  if (allConditionText.indexOf('revision active') !== -1) {
    return 'Rainbow';
  }

  // Technician: field operations with no blocking condition
  if (ownerArea.indexOf('field operations') !== -1 && activeConditions.length === 0) {
    return 'Technician';
  }

  // Nobody: operationally clean
  if (activeConditions.length === 0 &&
      primaryCondition === 'no active condition' ||
      primaryCondition === '') {
    return 'Nobody';
  }

  return 'Unknown';
}

/**
 * buildOIOperationalPriority_
 *
 * Maps health level and lifecycle state to a canonical operationalPriority.
 *
 * Canonical values:
 *   'Immediate' | 'High' | 'Normal' | 'Low' | 'Monitoring'
 */
function buildOIOperationalPriority_(health, lifecycle) {
  var healthLevel = buildOISafeString_(health.level, '');
  var lifecycleState = buildOISafeString_(lifecycle.state, '');

  if (healthLevel === 'Critical') {
    return 'Immediate';
  }

  if (healthLevel === 'Escalated') {
    return 'High';
  }

  if (healthLevel === 'At Risk') {
    return 'Normal';
  }

  if (healthLevel === 'Attention Soon') {
    return 'Low';
  }

  if (healthLevel === 'Healthy' && lifecycleState === 'Operationally Complete') {
    return 'Monitoring';
  }

  return 'Normal';
}

/**
 * buildOIStaleRisk_
 *
 * Returns true when daysSinceMeaningfulActivity exceeds 14 days.
 * Uses the canonical claimFoundation value — no additional sheet reads.
 */
function buildOIStaleRisk_(health) {
  var days = buildOISafeNumber_(health.daysSinceMeaningfulActivity, 0);
  // 14-day threshold; aligns with HEALTH_CONFIG.staleAtRiskDays when available.
  return days > 14;
}

/**
 * buildOINextAction_
 *
 * Bridges claimFoundation.nextAction.label → operationalIntelligence.nextAction.title.
 * If a label is populated in claimFoundation, that is the source of truth.
 * Otherwise a fallback is derived from waitingOn and operationalPriority.
 */
function buildOINextAction_(claimFoundation, ownership, waitingOn, operationalPriority) {
  var foundationNextAction = claimFoundation.nextAction || {};
  var foundationLabel = buildOISafeString_(foundationNextAction.label, '');
  var hasFoundationLabel = foundationLabel && foundationLabel !== 'No recommended action';

  var title = '';
  var reason = '';
  var owner = '';
  var generatedBy = '';
  var priority = operationalPriority || 'Normal';
  var dueDate = '';

  if (hasFoundationLabel) {
    // Use the existing nextAction label from claimFoundation as the title.
    // .label → .title bridge: claimFoundation uses "label", OI output uses "title".
    title = foundationLabel;
    reason = buildOISafeString_(foundationNextAction.reason, '');
    owner = buildOISafeString_(foundationNextAction.owner, ownership.primaryOwner || ownership.area || '');
    generatedBy = 'claimFoundation';
  } else {
    // Derive a fallback next action from waitingOn context.
    title = buildOIFallbackNextActionTitle_(waitingOn, ownership);
    reason = buildOIFallbackNextActionReason_(waitingOn);
    owner = ownership.primaryOwner || ownership.area || '';
    generatedBy = 'orchestrator';
  }

  return {
    title: title || 'No recommended action',
    reason: reason || '',
    owner: owner || '',
    priority: priority,
    dueDate: dueDate,
    generatedBy: generatedBy
  };
}

/**
 * buildOIFallbackNextActionTitle_
 * Derives a plain-language next action title when claimFoundation has none.
 */
function buildOIFallbackNextActionTitle_(waitingOn, ownership) {
  if (waitingOn === 'Carrier') {
    return 'Follow up with carrier on pending insurance item';
  }
  if (waitingOn === 'Customer') {
    return 'Follow up with customer on pending decision';
  }
  if (waitingOn === 'Lab') {
    return 'Follow up on pending lab or asbestos results';
  }
  if (waitingOn === 'Accounting') {
    return 'Follow up on outstanding payment';
  }
  if (waitingOn === 'Rainbow') {
    return 'Complete active revision and submit response';
  }
  if (waitingOn === 'Technician') {
    return 'Coordinate field operations next step';
  }
  if (waitingOn === 'Nobody') {
    return 'Review claim for next operational step';
  }
  return 'Review claim status and determine next step';
}

/**
 * buildOIFallbackNextActionReason_
 * Returns a short reason string for orchestrator-derived next actions.
 */
function buildOIFallbackNextActionReason_(waitingOn) {
  if (waitingOn === 'Carrier') {
    return 'Active insurance condition requires carrier follow-up.';
  }
  if (waitingOn === 'Customer') {
    return 'Claim is waiting on a customer decision.';
  }
  if (waitingOn === 'Lab') {
    return 'Lab or asbestos results are pending.';
  }
  if (waitingOn === 'Accounting') {
    return 'Payment is outstanding and needs follow-up.';
  }
  if (waitingOn === 'Rainbow') {
    return 'Rainbow has an active revision to complete.';
  }
  if (waitingOn === 'Technician') {
    return 'Field operations owns the next step.';
  }
  return 'No specific next action was recorded. Review current claim state.';
}

/**
 * buildOIOperationalSummary_
 * Assembles a structured operational summary for this intelligence object.
 * Prefers existing text from claimFoundation.summary when available.
 */
function buildOIOperationalSummary_(claimFoundation, lifecycle, health, ownership, conditions, waitingOn, nextAction) {
  var foundationSummary = claimFoundation.summary || {};
  var existingText = buildOISafeString_(foundationSummary.operationalSummary, '');
  var existingSupportingText = buildOISafeString_(foundationSummary.supportingText, '');
  var existingFacts = Array.isArray(foundationSummary.facts) ? foundationSummary.facts : [];

  // Use existing facts if populated; otherwise derive them.
  var facts = existingFacts.length > 0 ? existingFacts : buildOIDefaultFacts_(lifecycle, health, ownership, conditions);

  // Use existing text if populated; otherwise derive a brief summary.
  var text = existingText || buildOIDefaultSummaryText_(lifecycle, health, waitingOn, nextAction);
  var supportingText = existingSupportingText || 'Assembled by OperationalIntelligenceService from canonical claim data.';

  return {
    text: text,
    supportingText: supportingText,
    facts: facts
  };
}

/**
 * buildOIDefaultFacts_
 * Returns a baseline set of operational facts when claimFoundation.summary.facts is empty.
 */
function buildOIDefaultFacts_(lifecycle, health, ownership, conditions) {
  return [
    { label: 'Lifecycle', value: lifecycle.state || 'Not recorded' },
    { label: 'Health', value: health.level || 'Not rated' },
    { label: 'Owner', value: ownership.ownerLabel || 'Unassigned' },
    { label: 'Primary condition', value: conditions.primaryCondition || 'No active condition' }
  ];
}

/**
 * buildOIDefaultSummaryText_
 * Returns a plain-language operational summary string when none exists.
 */
function buildOIDefaultSummaryText_(lifecycle, health, waitingOn, nextAction) {
  var parts = [];
  var lifecycleState = lifecycle.state || 'Not recorded';
  var healthLevel = health.level || 'Not rated';

  parts.push('This claim is currently in ' + lifecycleState + ' with health rated ' + healthLevel + '.');

  if (waitingOn && waitingOn !== 'Nobody' && waitingOn !== 'Unknown') {
    parts.push('Rainbow is waiting on ' + waitingOn + ' for the next step.');
  }

  if (nextAction && nextAction.title && nextAction.title !== 'No recommended action') {
    parts.push('Recommended next action: ' + nextAction.title + '.');
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Safe value helpers — never return undefined, null, or NaN
// ---------------------------------------------------------------------------

/**
 * Returns a safe string, substituting fallback for any blank / null / undefined value.
 */
function buildOISafeString_(value, fallback) {
  if (value === null || value === undefined) {
    return fallback !== undefined ? String(fallback) : '';
  }

  var text = String(value).trim();
  var lower = text.toLowerCase();

  if (!text || lower === 'undefined' || lower === 'null' || lower === 'nan') {
    return fallback !== undefined ? String(fallback) : '';
  }

  return text;
}

/**
 * Returns a safe number, substituting fallback for any non-numeric value.
 */
function buildOISafeNumber_(value, fallback) {
  if (value === null || value === undefined) {
    return typeof fallback === 'number' ? fallback : 0;
  }

  var n = Number(value);

  if (isNaN(n)) {
    return typeof fallback === 'number' ? fallback : 0;
  }

  return n;
}

// ---------------------------------------------------------------------------
// Service object
// ---------------------------------------------------------------------------

var OperationalIntelligenceService = {
  buildOperationalIntelligence_: buildOperationalIntelligence_
};
