/**
 * Alert management service.
 * Rainbow Phase 4 - Claim Foundation
 */

const ALERT_GOVERNANCE_ALERT_COLUMNS = [
  'Alert_ID',
  'Claim_ID',
  'Alert_Type',
  'Alert_Status',
  'Status',
  'Severity',
  'Source_System',
  'Source_Record_ID',
  'Reason',
  'Recommended_Action',
  'Owner_Area',
  'Created_At',
  'Resolved_At',
  'Resolution_Reason',
  'Dismissed_At',
  'Dismissed_By',
  'Dismissed_Reason',
  'Suppressed_By_Rule',
  'Suppression_Reason',
  'Notes'
];

const ALERT_RULES_SHEET_NAME = 'Alert_Rules';
const ALERT_RULE_COLUMNS = [
  'Rule_ID',
  'Rule_Status',
  'Alert_Type',
  'Applies_To_Field',
  'Applies_To_Value',
  'Action',
  'Reason',
  'Created_At',
  'Updated_At'
];

const CLOSED_ALERT_STATUSES = {
  dismissed: true,
  resolved: true,
  suppressed: true,
  closed: true,
  complete: true,
  completed: true
};

function addAlert(claimId, alertType, details) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  if (!alertType) {
    return validationErrorResponse(['Alert type is required.']);
  }

  const now = nowIso();

  const alert = {
    Alert_ID: generateId(CLAIM_ID_PREFIXES.alert),
    Claim_ID: claimId,
    Alert_Type: alertType,
    Alert_Status: 'Active',
    Status: 'Active',
    Severity: (details && details.Severity) || 'Medium',
    Source_System: (details && details.Source_System) || CLAIM_SERVICE.name,
    Source_Record_ID: (details && details.Source_Record_ID) || '',
    Reason: (details && details.Reason) || '',
    Recommended_Action: (details && details.Recommended_Action) || '',
    Owner_Area: (details && details.Owner_Area) || '',
    Created_At: now,
    Resolved_At: '',
    Resolution_Reason: '',
    Dismissed_At: '',
    Dismissed_By: '',
    Dismissed_Reason: '',
    Suppressed_By_Rule: '',
    Suppression_Reason: '',
    Notes: (details && details.Notes) || ''
  };

  const result = appendRow(CLAIM_SHEET_NAMES.alerts, alert);

  updateClaim(claimId, {
    Last_Alert_Update_At: now
  });

  appendTimelineEvent(claimId, {
    Event_Type: 'Alert Added',
    Summary: alertType,
    Detail: alert.Reason,
    Source_System: alert.Source_System,
    Source_Record_ID: alert.Source_Record_ID,
    Related_Workflow: 'Alert Management',
    Is_Meaningful_Activity: true
  });

  writeServiceLog('addAlert', 'Success', 'Alert added.', {
    claimId: claimId,
    sourceSystem: alert.Source_System,
    sourceRecordId: alert.Source_Record_ID,
    alertId: alert.Alert_ID,
    alertType: alert.Alert_Type,
    appendResult: result
  });

  return successResponse({
    alert: alert,
    appendResult: result
  }, 'Alert added successfully.');
}

function resolveAlert(alertId, reason) {
  if (!alertId) {
    return validationErrorResponse(['Alert_ID is required.']);
  }

  const now = nowIso();

  const result = updateRowByKey(
    CLAIM_SHEET_NAMES.alerts,
    'Alert_ID',
    alertId,
    {
      Alert_Status: 'Resolved',
      Status: 'Resolved',
      Resolved_At: now,
      Resolution_Reason: reason || 'Alert resolved.'
    }
  );

  writeServiceLog('resolveAlert', result.success ? 'Success' : 'Not Found', result.message, {
    sourceSystem: CLAIM_SERVICE.name,
    sourceRecordId: alertId
  });

  return result;
}

function dismissAlert(alertId, reason, dismissedBy) {
  if (!alertId) {
    return validationErrorResponse(['Alert_ID is required.']);
  }

  ensureAlertGovernanceSchema();

  const now = nowIso();
  const result = updateRowByKey(
    CLAIM_SHEET_NAMES.alerts,
    'Alert_ID',
    alertId,
    {
      Alert_Status: 'Dismissed',
      Status: 'Dismissed',
      Dismissed_At: now,
      Dismissed_By: dismissedBy || CLAIM_SERVICE.name,
      Dismissed_Reason: reason || 'Alert dismissed.',
      Resolved_At: '',
      Updated_At: now
    }
  );

  writeServiceLog('dismissAlert', result.success ? 'Success' : 'Not Found', result.message, {
    sourceSystem: CLAIM_SERVICE.name,
    sourceRecordId: alertId,
    reason: reason || ''
  });

  return result;
}

function dismissAlertsByClaimAndType(claimId, alertType, reason, dismissedBy) {
  if (!claimId || !alertType) {
    return validationErrorResponse(['Claim_ID and alertType are required.']);
  }

  ensureAlertGovernanceSchema();

  const sheet = getSheet(CLAIM_SHEET_NAMES.alerts);
  const headers = getHeaders(CLAIM_SHEET_NAMES.alerts);
  const lastRow = sheet.getLastRow();
  const now = nowIso();
  const result = {
    claimId: claimId,
    alertType: alertType,
    dismissedCount: 0,
    dismissedAlertIds: []
  };

  if (lastRow < 2) {
    return successResponse(result, 'No alerts available to dismiss.');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const indexes = {
    alertId: headers.indexOf('Alert_ID'),
    claimId: headers.indexOf('Claim_ID'),
    alertType: headers.indexOf('Alert_Type'),
    alertStatus: headers.indexOf('Alert_Status'),
    status: headers.indexOf('Status'),
    dismissedAt: headers.indexOf('Dismissed_At'),
    dismissedBy: headers.indexOf('Dismissed_By'),
    dismissedReason: headers.indexOf('Dismissed_Reason'),
    updatedAt: headers.indexOf('Updated_At')
  };

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowClaimId = row[indexes.claimId];
    const rowAlertType = row[indexes.alertType];
    const rowStatus = indexes.status !== -1 && row[indexes.status] ? row[indexes.status] : row[indexes.alertStatus];

    if (String(rowClaimId || '') !== String(claimId || '') ||
        String(rowAlertType || '') !== String(alertType || '') ||
        !isOpenAlertStatus_(rowStatus)) {
      continue;
    }

    if (indexes.alertStatus !== -1) row[indexes.alertStatus] = 'Dismissed';
    if (indexes.status !== -1) row[indexes.status] = 'Dismissed';
    if (indexes.dismissedAt !== -1) row[indexes.dismissedAt] = now;
    if (indexes.dismissedBy !== -1) row[indexes.dismissedBy] = dismissedBy || CLAIM_SERVICE.name;
    if (indexes.dismissedReason !== -1) row[indexes.dismissedReason] = reason || 'Alert dismissed.';
    if (indexes.updatedAt !== -1) row[indexes.updatedAt] = now;

    sheet.getRange(i + 2, 1, 1, headers.length).setValues([row]);
    result.dismissedCount++;
    result.dismissedAlertIds.push(indexes.alertId !== -1 ? row[indexes.alertId] : '');
  }

  writeServiceLog('dismissAlertsByClaimAndType', 'Success', 'Alerts dismissed by claim and type.', {
    claimId: claimId,
    alertType: alertType,
    reason: reason || '',
    result: result
  });

  return successResponse(result, 'Alerts dismissed by claim and type.');
}

function getActiveAlerts(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.alerts, {
    Claim_ID: claimId
  });

  const active = rows.filter(function(row) {
    return isOpenAlertStatus_(row.Alert_Status || row.Status);
  });

  return successResponse({
    claimId: claimId,
    alerts: active,
    count: active.length
  }, 'Active alerts retrieved.');
}

function isOpenAlertStatus_(status) {
  const normalized = String(status || 'Active').trim().toLowerCase();
  return !CLOSED_ALERT_STATUSES[normalized];
}

function ensureAlertGovernanceSchema() {
  const results = {
    alertColumns: ensureSheetColumns_(CLAIM_SHEET_NAMES.alerts, ALERT_GOVERNANCE_ALERT_COLUMNS),
    alertRulesSheet: ensureAlertRulesSheet_()
  };

  writeServiceLog('ensureAlertGovernanceSchema', 'Success', 'Alert governance schema verified.', {
    results: results
  });

  return successResponse(results, 'Alert governance schema verified.');
}

function ensureAlertRulesSheet_() {
  const ss = getAlertPersistenceSpreadsheet_();
  let sheet = ss.getSheetByName(ALERT_RULES_SHEET_NAME);
  let created = false;

  if (!sheet) {
    sheet = ss.insertSheet(ALERT_RULES_SHEET_NAME);
    created = true;
  }

  const existingHeaders = sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) {
      return String(header || '').trim();
    })
    : [];

  if (!existingHeaders.some(function(header) { return header !== ''; })) {
    sheet.getRange(1, 1, 1, ALERT_RULE_COLUMNS.length).setValues([ALERT_RULE_COLUMNS]);
  } else {
    ALERT_RULE_COLUMNS.forEach(function(header) {
      if (existingHeaders.indexOf(header) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      }
    });
  }

  sheet.setFrozenRows(1);

  return {
    sheetName: ALERT_RULES_SHEET_NAME,
    created: created,
    headers: ALERT_RULE_COLUMNS
  };
}

function getActiveAlertRules() {
  ensureAlertRulesSheet_();

  const rows = getAlertPersistenceRows_(ALERT_RULES_SHEET_NAME);
  return rows.filter(function(rule) {
    const status = getAlertPersistenceValue_(rule, ['Rule_Status', 'Rule Status', 'Status']);
    return String(status || '').toLowerCase() === 'active';
  });
}

function shouldSuppressAlert(alertCandidate, claim) {
  const rule = getAlertSuppressionRule_(alertCandidate, claim);
  return !!rule;
}

function getAlertSuppressionReason(alertCandidate, claim) {
  const rule = getAlertSuppressionRule_(alertCandidate, claim);

  if (!rule) {
    return '';
  }

  return getAlertPersistenceValue_(rule, ['Reason']) || 'Suppressed by alert governance rule.';
}

function getAlertSuppressionRule_(alertCandidate, claim) {
  const rules = getActiveAlertRules();
  return getAlertSuppressionRuleFromList_(alertCandidate, claim, rules);
}

function getAlertSuppressionRuleFromList_(alertCandidate, claim, rules) {
  const allowRule = getMatchingAlertGovernanceRuleFromList_(alertCandidate, claim, 'Allow', rules);
  if (allowRule) {
    return null;
  }

  return getMatchingAlertGovernanceRuleFromList_(alertCandidate, claim, 'Suppress', rules);
}

function getMatchingAlertGovernanceRuleFromList_(alertCandidate, claim, action, rules) {
  const candidateType = String(alertCandidate && alertCandidate.Alert_Type || '').trim();
  const normalizedAction = String(action || '').toLowerCase();

  return (rules || []).find(function(rule) {
    const ruleAction = String(getAlertPersistenceValue_(rule, ['Action']) || '').trim().toLowerCase();
    const ruleAlertType = String(getAlertPersistenceValue_(rule, ['Alert_Type', 'Alert Type']) || '').trim();

    if (ruleAction !== normalizedAction) {
      return false;
    }

    if (ruleAlertType && ruleAlertType !== candidateType) {
      return false;
    }

    return alertGovernanceRuleMatchesClaim_(rule, claim);
  }) || null;
}

function alertGovernanceRuleMatchesClaim_(rule, claim) {
  const appliesToField = String(getAlertPersistenceValue_(rule, ['Applies_To_Field', 'Applies To Field']) || '').trim();
  const appliesToValue = String(getAlertPersistenceValue_(rule, ['Applies_To_Value', 'Applies To Value']) || '').trim();

  if (appliesToField.toLowerCase() === 'all') {
    return true;
  }

  const claimValue = getAlertGovernanceClaimFieldValue_(claim, appliesToField);
  return normalizeAlertGovernanceMatchValue_(claimValue) === normalizeAlertGovernanceMatchValue_(appliesToValue);
}

function getAlertGovernanceClaimFieldValue_(claim, appliesToField) {
  const normalizedField = normalizeAlertPersistenceValue_(appliesToField);

  if (normalizedField === 'carrier') {
    return getAlertPersistenceValue_(claim, ['Carrier']);
  }

  if (normalizedField === 'claimnumber') {
    return getAlertPersistenceValue_(claim, ['Claim_Number', 'Claim Number']);
  }

  if (normalizedField === 'jobnumber') {
    return getAlertPersistenceValue_(claim, ['Job_Number', 'Job Number', 'JobNumber']);
  }

  if (normalizedField === 'claimid') {
    return getAlertPersistenceValue_(claim, ['Claim_ID', 'Claim ID', 'ClaimId']);
  }

  return getAlertPersistenceValue_(claim, [appliesToField]);
}

function normalizeAlertGovernanceMatchValue_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildLibertyMutualClaimXSuppressionRule_() {
  const now = nowIso();
  return {
    Rule_ID: 'RULE-LIBERTY-MUTUAL-CLAIMX-SUPPRESS',
    Rule_Status: 'Active',
    Alert_Type: 'Missing ClaimX Link/Video',
    Applies_To_Field: 'Carrier',
    Applies_To_Value: 'Liberty Mutual',
    Action: 'Suppress',
    Reason: 'Liberty Mutual jobs do not require ClaimX links.',
    Created_At: now,
    Updated_At: now
  };
}

/**
 * Rainbow Phase 8B.5A — Alert persistence reconciliation.
 *
 * These functions deliberately create alerts only from structured data sources.
 * Historical notes are not used to create alerts here.
 */

function runAlertPersistencePreview() {
  return reconcileAllClaimAlerts({ dryRun: true });
}

function runAlertPersistenceWrite() {
  return reconcileAllClaimAlerts({ dryRun: false });
}

/**
 * rebuildHomepageOperationalAlerts
 *
 * Re-evaluates every active claim against External_Links and writes any
 * missing alert rows to Claim_Alerts.  Call this after any claim backfill
 * (e.g. enrichBootstrappedClaimNumbersFromDailyOpenJobs) to ensure the
 * homepage operational-alert counts reflect all active claims.
 *
 * For bootstrapped claims with no External_Links row, a
 * "Missing Operational Links Record" alert is written.  This alert is
 * automatically resolved on the next reconcile run once an External_Links
 * row is present (because normalizeStructuredLinkAlertType_ maps it to the
 * structured type 'missing-operational-links-record').
 *
 * Returns the full reconcileAllClaimAlerts result object.
 */
function previewRebuildHomepageOperationalAlerts() {
  const response = reconcileAllClaimAlerts({ dryRun: true, quiet: true });
  const data = response && response.data ? response.data : response;

  const proposedTypes = data.proposedAlertTypes || {};

  // Count "Missing Operational Links Record" proposals (bootstrapped claims with no EL row)
  const missingOperationalLinksRecordProposed = Object.keys(proposedTypes).reduce(function(n, type) {
    return String(type).toLowerCase() === 'missing operational links record' ? n + proposedTypes[type] : n;
  }, 0);

  // Count "Missing XA/Symbility Link" proposals (claims with EL row but no XA/Symbility URL)
  const missingXaSymbilityProposed = Object.keys(proposedTypes).reduce(function(n, type) {
    const t = String(type).toLowerCase();
    return (t === 'missing xa/symbility link' || t === 'missing xact/symbility link') ? n + proposedTypes[type] : n;
  }, 0);

  const summary = {
    dryRun: true,
    activeClaimsEvaluated: data.activeClaimsEvaluated,
    alertsProposed: data.alertsProposed,
    alertsSuppressed: data.alertsSuppressed,
    // Breakdown by type
    missingOperationalLinksRecordProposed: missingOperationalLinksRecordProposed,
    missingXaSymbilityProposed: missingXaSymbilityProposed,
    // data.newAlerts is the per-claim-aggregated count of proposals with no matching
    // existing open alert — i.e. what would actually be written.
    // This is correct in dryRun because reconcileClaimAlerts computes newAlerts.length
    // before the !dryRun guard, while alertsWritten is gated behind !dryRun and stays 0.
    newAlertsWouldBeWritten: data.newAlerts,
    skippedExistingAlerts: data.skippedExistingAlerts,
    proposedAlertTypeBreakdown: proposedTypes,
    errors: data.errors || [],
    sample: data.sample || []
  };

  Logger.log('REBUILD_HOMEPAGE_OPERATIONAL_ALERTS_PREVIEW ' + JSON.stringify(summary, null, 2));
  return successResponse(summary, 'Homepage operational alerts rebuild preview complete.');
}

function rebuildHomepageOperationalAlerts() {
  const response = reconcileAllClaimAlerts({ dryRun: false, quiet: true });
  const data = response && response.data ? response.data : response;

  const summary = {
    dryRun: false,
    activeClaimsEvaluated: data.activeClaimsEvaluated,
    alertsProposed: data.alertsProposed,
    alertsSuppressed: data.alertsSuppressed,
    alertsWritten: data.alertsWritten,
    skippedExistingAlerts: data.skippedExistingAlerts,
    staleAlertsResolved: data.staleStructuredAlertsResolved,
    errors: data.errors || []
  };

  Logger.log('REBUILD_HOMEPAGE_OPERATIONAL_ALERTS ' + JSON.stringify(summary, null, 2));
  return successResponse(summary, 'Homepage operational alerts rebuilt. Refresh the homepage to see updated counts.');
}

function testAlertPersistencePreview() {
  const response = runAlertPersistencePreview();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testAlertPersistenceWrite() {
  const response = runAlertPersistenceWrite();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testAlertPersistenceWriteCompact() {
  const response = reconcileAllClaimAlerts({
    dryRun: false,
    quiet: true
  });

  const data = response && response.data ? response.data : response;
  const summary = {
    status: data.status,
    dryRun: data.dryRun,
    activeClaimsEvaluated: data.activeClaimsEvaluated,
    alertsProposed: data.alertsProposed,
    alertsSuppressed: data.alertsSuppressed,
    alertsWritten: data.alertsWritten,
    skippedExistingAlerts: data.skippedExistingAlerts,
    skippedClaims: data.skippedClaims,
    errorCount: data.errors ? data.errors.length : 0,
    errors: data.errors || []
  };

  Logger.log('ALERT_PERSISTENCE_WRITE_SUMMARY ' + JSON.stringify(summary));
  return successResponse(summary, 'Compact alert persistence write summary.');
}

function testAlertPersistencePreviewCompact() {
  const response = reconcileAllClaimAlerts({
    dryRun: true,
    quiet: true
  });

  const data = response && response.data ? response.data : response;
  const summary = {
    status: data.status,
    dryRun: data.dryRun,
    activeClaimsEvaluated: data.activeClaimsEvaluated,
    alertsProposed: data.alertsProposed,
    alertsSuppressed: data.alertsSuppressed,
    alertsWritten: data.alertsWritten,
    skippedExistingAlerts: data.skippedExistingAlerts,
    skippedClaims: data.skippedClaims,
    errorCount: data.errors ? data.errors.length : 0,
    errors: data.errors || []
  };

  Logger.log('ALERT_PERSISTENCE_PREVIEW_SUMMARY ' + JSON.stringify(summary));
  return successResponse(summary, 'Compact alert persistence preview summary.');
}

function testReconcileSingleClaimAlerts() {
  const response = reconcileClaimAlerts('CLM-20260605-821496', { dryRun: true });
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function previewClaimAlerts(claimId) {
  return reconcileClaimAlerts(claimId, { dryRun: true });
}

function reconcileAllClaimAlerts(options) {
  options = options || {};
  const dryRun = options.dryRun !== false;

  ensureAlertGovernanceSchema();
  const activeRules = getActiveAlertRules();
  const claims = getAlertPersistenceRows_(getAlertPersistenceSheetName_('claims'));
  const activeClaims = claims.filter(function(claim) {
    return isAlertPersistenceActiveClaim_(claim);
  });

  const results = {
    status: 'Success',
    dryRun: dryRun,
    activeClaimsEvaluated: activeClaims.length,
    alertsProposed: 0,
    alertsSuppressed: 0,
    newAlerts: 0,                     // alerts that would be (or were) written — reliable in both dryRun and live
    alertsWritten: 0,                 // only non-zero in live runs
    staleStructuredAlertsResolved: 0, // stale alerts auto-resolved because their conditions are now satisfied
    skippedExistingAlerts: 0,
    skippedClaims: 0,
    proposedAlertTypes: {}, // {Alert_Type: count} across all claims
    errors: [],
    sample: []
  };

  activeClaims.forEach(function(claim) {
    const claimId = getAlertPersistenceValue_(claim, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']);

    if (!claimId) {
      results.skippedClaims++;
      return;
    }

    try {
      const claimResult = reconcileClaimAlerts(claimId, {
        dryRun: dryRun,
        quiet: options.quiet === true,
        schemaReady: true,
        activeRules: activeRules
      });
      const data = claimResult && claimResult.data ? claimResult.data : claimResult;

      results.alertsProposed += Number(data.alertsProposed || 0);
      results.alertsSuppressed += Number(data.alertsSuppressed || 0);
      results.newAlerts += Number(data.newAlerts || 0);
      results.alertsWritten += Number(data.alertsWritten || 0);
      results.staleStructuredAlertsResolved += Number(data.staleStructuredAlertsResolved || 0);
      results.skippedExistingAlerts += Number(data.skippedExistingAlerts || 0);

      // Accumulate per-type counts from this claim's proposed alerts
      if (data.proposedAlerts && data.proposedAlerts.length) {
        data.proposedAlerts.forEach(function(alert) {
          const alertType = String(alert.Alert_Type || 'Unknown');
          results.proposedAlertTypes[alertType] = (results.proposedAlertTypes[alertType] || 0) + 1;
        });
      }

      if (results.sample.length < 10 && data.proposedAlerts && data.proposedAlerts.length) {
        data.proposedAlerts.slice(0, 10 - results.sample.length).forEach(function(alert) {
          results.sample.push(alert);
        });
      }
    } catch (error) {
      results.errors.push({
        claimId: claimId,
        message: error && error.message ? error.message : String(error)
      });
    }
  });

  if (options.quiet !== true) {
    Logger.log(JSON.stringify(results, null, 2));
  }

  if (results.alertsSuppressed > 0) {
    writeServiceLog('reconcileAllClaimAlerts.suppression', 'Success', 'Alert governance suppressed proposed alerts.', {
      alertsSuppressed: results.alertsSuppressed
    });
  }

  return successResponse(results, 'Alert persistence reconciliation complete.');
}

function reconcileClaimAlerts(claimId, options) {
  options = options || {};
  const dryRun = options.dryRun !== false;

  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  if (options.schemaReady !== true) {
    ensureAlertGovernanceSchema();
  }

  const claim = getAlertPersistenceClaimById_(claimId) || {};
  const activeRules = options.activeRules || getActiveAlertRules();
  const proposedAlerts = buildStructuredAlertsForClaim_(claimId);
  const suppressionResults = [];
  const unsuppressedAlerts = proposedAlerts.filter(function(proposed) {
    const suppressRule = getAlertSuppressionRuleFromList_(proposed, claim, activeRules);

    if (!suppressRule) {
      return true;
    }

    suppressionResults.push({
      claimId: claimId,
      alertType: proposed.Alert_Type,
      ruleId: getAlertPersistenceValue_(suppressRule, ['Rule_ID', 'Rule ID']),
      reason: getAlertPersistenceValue_(suppressRule, ['Reason']) || 'Suppressed by alert governance rule.'
    });

    return false;
  });
  const activeAlerts = getActiveAlertsForAlertPersistence_(claimId);
  const staleStructuredAlerts = getStaleStructuredLinkAlerts_(activeAlerts, unsuppressedAlerts);

  const newAlerts = unsuppressedAlerts.filter(function(proposed) {
    const proposedStructuredType = normalizeStructuredLinkAlertType_(proposed.Alert_Type || '');

    return !activeAlerts.some(function(existing) {
      const existingStructuredType = normalizeStructuredLinkAlertType_(existing.Alert_Type || '');

      if (proposedStructuredType || existingStructuredType) {
        return proposedStructuredType && existingStructuredType && existingStructuredType === proposedStructuredType;
      }

      return String(existing.Alert_Type || '') === String(proposed.Alert_Type || '');
    });
  });

  let alertsWritten = 0;
  let staleStructuredAlertsResolved = 0;
  const writeResults = [];
  const staleResolveResults = [];

  if (!dryRun) {
    staleStructuredAlerts.forEach(function(alert) {
      const alertId = getAlertPersistenceValue_(alert, ['Alert_ID', 'Alert ID']);
      if (!alertId) {
        return;
      }

      const resolveResult = resolveAlert(alertId, 'Structured External_Links data now satisfies this alert.');
      staleResolveResults.push(resolveResult);

      if (resolveResult && resolveResult.success) {
        staleStructuredAlertsResolved++;
      }
    });

    newAlerts.forEach(function(alert) {
      const writeResult = addAlertForPersistence_(claimId, alert);

      writeResults.push(writeResult);

      if (writeResult && writeResult.success) {
        alertsWritten++;
      }
    });
  }

  const result = {
    claimId: claimId,
    dryRun: dryRun,
    alertsProposed: proposedAlerts.length,
    alertsSuppressed: suppressionResults.length,
    newAlerts: newAlerts.length,
    skippedExistingAlerts: unsuppressedAlerts.length - newAlerts.length,
    staleStructuredAlerts: staleStructuredAlerts.length,
    staleStructuredAlertsResolved: staleStructuredAlertsResolved,
    alertsWritten: alertsWritten,
    proposedAlerts: proposedAlerts,
    suppressionResults: suppressionResults,
    staleResolveResults: staleResolveResults,
    writeResults: writeResults
  };

  if (options.quiet !== true) {
    Logger.log(JSON.stringify(result, null, 2));
  }
  return successResponse(result, 'Claim alert reconciliation complete.');
}

function buildStructuredAlertsForClaim_(claimId) {
  const proposed = [];
  const externalLinks = getExternalLinksForAlertPersistence_(claimId);

  if (!externalLinks.length) {
    // No External_Links row was found for this claim by either Claim_ID or
    // Job_Number.  getExternalLinksForAlertPersistence_ already attempts both
    // lookups, so a miss here means the claim genuinely has no intake record —
    // typically a claim bootstrapped from a Daily Open Jobs report or another
    // data source that bypasses the normal insurance-intake workflow.
    //
    // Flag it as "Missing Operational Links Record" so the homepage operational
    // alerts reflect all active claims, not only those that went through intake.
    // reconcileClaimAlerts() will suppress this alert for any claim covered by
    // an active Alert_Rules suppression rule before writing to Claim_Alerts.
    proposed.push(buildStructuredAlert_(claimId, {
      Alert_Type: 'Missing Operational Links Record',
      Severity: 'Medium',
      Source_System: 'claims-service alert persistence',
      Source_Record_ID: 'External_Links:' + claimId,
      Reason: 'No External_Links row found for this claim by Claim_ID or Job_Number. ' +
              'The claim was likely bootstrapped without completing insurance intake.',
      Recommended_Action: 'Process the insurance intake email or manually add an ' +
                          'External_Links record for this claim.',
      Owner_Area: 'Office Operations',
      Notes: 'Generated from structured External_Links data only.'
    }));
    return proposed;
  }

  const hasXact = hasExternalLinkValue_(externalLinks, [
    'XactAnalysis',
    'Xact Analysis',
    'Xactimate',
    'Xactimate Link',
    'Xactimate_URL',
    'Xactimate URL',
    'XactAnalysis_URL',
    'XactAnalysis URL',
    'Xact URL',
    'XA'
  ]) || hasExternalLinkType_(externalLinks, [
    'XactAnalysis',
    'Xact Analysis',
    'Xactimate',
    'Xactimate Link',
    'Xactimate_URL',
    'Xactimate URL',
    'XactAnalysis_URL',
    'XactAnalysis URL',
    'Xact URL',
    'XA'
  ]);

  const hasSymbility = hasExternalLinkValue_(externalLinks, [
    'Symbility',
    'Symbility_URL',
    'Symbility URL',
    'Symbility Link'
  ]) || hasExternalLinkType_(externalLinks, [
    'Symbility',
    'Symbility_URL',
    'Symbility URL',
    'Symbility Link'
  ]);

  const hasClaimX = hasExternalLinkValue_(externalLinks, [
    'ClaimX',
    'ClaimX_URL',
    'ClaimX URL',
    'ClaimX Link',
    'ClaimX Video',
    'ClaimX Video Link'
  ]) || hasExternalLinkType_(externalLinks, [
    'ClaimX',
    'ClaimX_URL',
    'ClaimX URL',
    'ClaimX Link',
    'ClaimX Video',
    'ClaimX Video Link',
    'Claim X'
  ]);

  if (!hasXact && !hasSymbility) {
    proposed.push(buildStructuredAlert_(claimId, {
      Alert_Type: 'Missing XA/Symbility Link',
      Severity: 'Medium',
      Source_System: 'claims-service alert persistence',
      Source_Record_ID: 'External_Links:' + claimId,
      Reason: 'Neither XactAnalysis/Xactimate nor Symbility link is populated for this active claim.',
      Recommended_Action: 'Add the XactAnalysis, Xactimate, or Symbility link to External_Links.',
      Owner_Area: 'Office Operations',
      Notes: 'Generated from structured External_Links data only.'
    }));
  }

  if (isAllstateAlertPersistenceClaim_(claimId) && !hasClaimX) {
    proposed.push(buildStructuredAlert_(claimId, {
      Alert_Type: 'Missing ClaimX Link/Video',
      Severity: 'Low',
      Source_System: 'claims-service alert persistence',
      Source_Record_ID: 'External_Links:' + claimId,
      Reason: 'ClaimX link/video is not populated for this active Allstate claim.',
      Recommended_Action: 'Add the ClaimX link/video when available for this Allstate claim.',
      Owner_Area: 'Office Operations',
      Notes: 'Generated from structured External_Links data only.'
    }));
  }

  return proposed;
}

function buildStructuredAlert_(claimId, fields) {
  return {
    Claim_ID: claimId,
    Alert_Type: fields.Alert_Type,
    Severity: fields.Severity || 'Medium',
    Source_System: fields.Source_System || 'claims-service alert persistence',
    Source_Record_ID: fields.Source_Record_ID || '',
    Reason: fields.Reason || '',
    Recommended_Action: fields.Recommended_Action || '',
    Owner_Area: fields.Owner_Area || '',
    Notes: fields.Notes || ''
  };
}

function getExternalLinksForAlertPersistence_(claimId) {
  const sheetName = getAlertPersistenceSheetName_('externalLinks');
  const rows = getAlertPersistenceRows_(sheetName);
  const claimJobNumber = getJobNumberForAlertPersistenceClaim_(claimId);

  return rows.filter(function(row) {
    const rowClaimId = getAlertPersistenceValue_(row, [
      'Claim_ID',
      'Claim ID',
      'ClaimId',
      'claimId',
      'Claim_Record_ID',
      'Claim Record ID',
      'Claim_Record_Id',
      'Related_Claim_ID',
      'Related Claim ID',
      'Parent_Claim_ID',
      'Parent Claim ID'
    ]);

    const rowJobNumber = getAlertPersistenceValue_(row, [
      'Job_Number',
      'Job Number',
      'JobNumber',
      'jobNumber'
    ]);

    return String(rowClaimId || '') === String(claimId || '')
      || (!!claimJobNumber && String(rowJobNumber || '') === String(claimJobNumber || ''));
  });
}

function getJobNumberForAlertPersistenceClaim_(claimId) {
  const claim = getAlertPersistenceClaimById_(claimId);

  if (!claim) {
    return '';
  }

  return getAlertPersistenceValue_(claim, [
    'Job_Number',
    'Job Number',
    'JobNumber',
    'jobNumber'
  ]);
}

function getAlertPersistenceClaimById_(claimId) {
  const claims = getAlertPersistenceRows_(getAlertPersistenceSheetName_('claims'));

  return claims.find(function(row) {
    const rowClaimId = getAlertPersistenceValue_(row, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']);
    return String(rowClaimId || '') === String(claimId || '');
  }) || null;
}

function hasExternalLinkValue_(externalLinks, possibleColumns) {
  const normalizedColumns = possibleColumns.map(function(column) {
    return normalizeAlertPersistenceValue_(column);
  });

  return externalLinks.some(function(link) {
    const normalizedRecord = {};

    Object.keys(link).forEach(function(key) {
      normalizedRecord[normalizeAlertPersistenceValue_(key)] = link[key];
    });

    return normalizedColumns.some(function(normalizedColumn) {
      const value = normalizedRecord[normalizedColumn];
      return value !== undefined && value !== null && String(value).trim() !== '';
    });
  });
}

function testAlertPersistenceSourceDiagnostics() {
  const claimsSheetName = getAlertPersistenceSheetName_('claims');
  const linksSheetName = getAlertPersistenceSheetName_('externalLinks');
  const alertsSheetName = getAlertPersistenceSheetName_('alerts');

  const claims = getAlertPersistenceRows_(claimsSheetName);
  const links = getAlertPersistenceRows_(linksSheetName);
  const alerts = getAlertPersistenceRows_(alertsSheetName);

  const claimSample = claims.slice(0, 5).map(function(row) {
    return {
      Claim_ID: getAlertPersistenceValue_(row, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']),
      Display_Name: getAlertPersistenceValue_(row, ['Display_Name', 'Display Name', 'Customer_Name', 'Customer Name']),
      Lifecycle_State: getAlertPersistenceValue_(row, ['Lifecycle_State', 'Lifecycle State', 'Current_Lifecycle_State', 'Current Lifecycle State']),
      rawKeys: Object.keys(row)
    };
  });

  const linkSample = links.slice(0, 10).map(function(row) {
    return {
      Claim_ID: getAlertPersistenceValue_(row, [
        'Claim_ID',
        'Claim ID',
        'ClaimId',
        'claimId',
        'Claim_Record_ID',
        'Claim Record ID',
        'Claim_Record_Id',
        'Related_Claim_ID',
        'Related Claim ID',
        'Parent_Claim_ID',
        'Parent Claim ID'
      ]),
      Job_Number: getAlertPersistenceValue_(row, ['Job_Number', 'Job Number', 'JobNumber', 'jobNumber']),
      Fusion_URL: getAlertPersistenceValue_(row, ['Fusion URL', 'Fusion_URL', 'FusionURL']),
      XactAnalysis: getAlertPersistenceValue_(row, ['XactAnalysis', 'Xact Analysis']),
      Symbility: getAlertPersistenceValue_(row, ['Symbility']),
      ClaimX: getAlertPersistenceValue_(row, ['ClaimX', 'ClaimX Link', 'ClaimX URL']),
      rawKeys: Object.keys(row)
    };
  });

  const linkTypes = {
    rowsWithFusionUrl: 0,
    rowsWithXactAnalysis: 0,
    rowsWithSymbility: 0,
    rowsWithClaimX: 0
  };

  links.forEach(function(row) {
    if (getAlertPersistenceValue_(row, ['Fusion URL', 'Fusion_URL', 'FusionURL'])) linkTypes.rowsWithFusionUrl++;
    if (getAlertPersistenceValue_(row, ['XactAnalysis', 'Xact Analysis'])) linkTypes.rowsWithXactAnalysis++;
    if (getAlertPersistenceValue_(row, ['Symbility'])) linkTypes.rowsWithSymbility++;
    if (getAlertPersistenceValue_(row, ['ClaimX', 'ClaimX Link', 'ClaimX URL'])) linkTypes.rowsWithClaimX++;
  });

  const result = {
    status: 'Success',
    sheetNames: {
      claims: claimsSheetName,
      externalLinks: linksSheetName,
      alerts: alertsSheetName
    },
    rowCounts: {
      claims: claims.length,
      externalLinks: links.length,
      alerts: alerts.length
    },
    claimSample: claimSample,
    linkSample: linkSample,
    linkTypes: linkTypes
  };

  Logger.log(JSON.stringify(result, null, 2));
  return successResponse(result, 'Alert persistence source diagnostics complete.');
}

function testAlertPersistenceExternalLinksRawRows() {
  const ss = getAlertPersistenceSpreadsheet_();
  const sheetName = getAlertPersistenceSheetName_('externalLinks');
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  const maxRows = Math.min(sheet.getLastRow(), 20);
  const maxColumns = Math.min(sheet.getLastColumn(), 20);
  const values = sheet.getRange(1, 1, maxRows, maxColumns).getValues();

  const result = {
    status: 'Success',
    sheetName: sheetName,
    lastRow: sheet.getLastRow(),
    lastColumn: sheet.getLastColumn(),
    rawRows: values.map(function(row, index) {
      return {
        rowNumber: index + 1,
        values: row
      };
    })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return successResponse(result, 'External_Links raw row diagnostic complete.');
}

function hasExternalLinkType_(externalLinks, allowedTypes) {
  const normalizedAllowed = allowedTypes.map(function(type) {
    return normalizeAlertPersistenceValue_(type);
  });

  return externalLinks.some(function(link) {
    const linkType = getAlertPersistenceValue_(link, [
      'Link_Type',
      'Link Type',
      'Type',
      'Link_Name',
      'Link Name'
    ]);

    const linkUrl = getAlertPersistenceValue_(link, [
      'URL',
      'Url',
      'Link_URL',
      'Link URL',
      'Value',
      'External_URL',
      'External URL'
    ]);

    if (!linkUrl) {
      return false;
    }

    return normalizedAllowed.indexOf(normalizeAlertPersistenceValue_(linkType)) !== -1;
  });
}

function isAlertPersistenceActiveClaim_(claim) {
  const lifecycleState = getAlertPersistenceValue_(claim, [
    'Lifecycle_State',
    'Lifecycle State',
    'Current_Lifecycle_State',
    'Current Lifecycle State'
  ]);

  const status = getAlertPersistenceValue_(claim, [
    'Claim_Status',
    'Claim Status',
    'Status'
  ]);

  const lifecycle = String(lifecycleState || status || '').trim();

  return lifecycle !== 'Operationally Complete'
    && lifecycle !== 'Not Sold'
    && lifecycle !== 'Closed'
    && lifecycle !== 'Complete'
    && lifecycle !== 'Completed';
}

function getAlertPersistenceRows_(sheetName) {
  const ss = getAlertPersistenceSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing sheet: ' + sheetName);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headerRowIndex = findAlertPersistenceHeaderRowIndex_(values);
  const headers = values[headerRowIndex];

  return values.slice(headerRowIndex + 1).filter(function(row) {
    return row.some(function(cell) {
      return cell !== '' && cell !== null;
    });
  }).map(function(row) {
    const record = {};

    headers.forEach(function(header, index) {
      if (header) {
        record[String(header)] = row[index];
      }
    });

    return record;
  });
}

function findAlertPersistenceHeaderRowIndex_(values) {
  const maxRowsToInspect = Math.min(values.length, 10);

  for (let rowIndex = 0; rowIndex < maxRowsToInspect; rowIndex++) {
    const normalizedHeaders = values[rowIndex].map(function(value) {
      return normalizeAlertPersistenceValue_(value);
    });

    const hasClaimId = normalizedHeaders.indexOf('claimid') !== -1;
    const hasJobNumber = normalizedHeaders.indexOf('jobnumber') !== -1;
    const hasAlertType = normalizedHeaders.indexOf('alerttype') !== -1;
    const hasLinkType = normalizedHeaders.indexOf('linktype') !== -1;
    const hasLifecycleState = normalizedHeaders.indexOf('lifecyclestate') !== -1;
    const hasDisplayName = normalizedHeaders.indexOf('displayname') !== -1;
    const hasCustomerName = normalizedHeaders.indexOf('customername') !== -1;
    const hasFusionUrl = normalizedHeaders.indexOf('fusionurl') !== -1;
    const hasXactAnalysis = normalizedHeaders.indexOf('xactanalysis') !== -1;

    if (hasClaimId && (hasAlertType || hasLinkType || hasLifecycleState || hasDisplayName || hasCustomerName || hasJobNumber || hasFusionUrl || hasXactAnalysis)) {
      return rowIndex;
    }
  }

  return 0;
}

function getAlertPersistenceSpreadsheet_() {
  const spreadsheetId = typeof CONFIG !== 'undefined' && CONFIG.CLAIMS_DATABASE_SPREADSHEET_ID
    ? CONFIG.CLAIMS_DATABASE_SPREADSHEET_ID
    : CLAIM_FOUNDATION_SPREADSHEET_ID;

  return SpreadsheetApp.openById(spreadsheetId);
}

function getAlertPersistenceSheetName_(key) {
  if (typeof CLAIM_SHEET_NAMES !== 'undefined') {
    if (key === 'claims' && CLAIM_SHEET_NAMES.claims) return CLAIM_SHEET_NAMES.claims;
    if (key === 'externalLinks' && CLAIM_SHEET_NAMES.externalLinks) return CLAIM_SHEET_NAMES.externalLinks;
    if (key === 'alerts' && CLAIM_SHEET_NAMES.alerts) return CLAIM_SHEET_NAMES.alerts;
  }

  if (key === 'claims') return 'Claims';
  if (key === 'externalLinks') return 'External_Links';
  if (key === 'alerts') return 'Claim_Alerts';

  throw new Error('Unknown alert persistence sheet key: ' + key);
}

function getAlertPersistenceValue_(record, possibleKeys) {
  for (let i = 0; i < possibleKeys.length; i++) {
    const key = possibleKeys[i];
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key];
    }
  }

  const normalizedRecord = {};

  Object.keys(record).forEach(function(key) {
    normalizedRecord[normalizeAlertPersistenceValue_(key)] = record[key];
  });

  for (let j = 0; j < possibleKeys.length; j++) {
    const normalizedKey = normalizeAlertPersistenceValue_(possibleKeys[j]);
    if (normalizedRecord[normalizedKey] !== undefined && normalizedRecord[normalizedKey] !== null && normalizedRecord[normalizedKey] !== '') {
      return normalizedRecord[normalizedKey];
    }
  }

  return '';
}

function normalizeAlertPersistenceValue_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}


function testAlertClaimLookup() {
  return lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });
}

function testGetActiveAlerts() {
  return getActiveAlerts('CLM-20260605-821496');
}


function cleanupClaimAlertTestRows() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.alerts);

  if (!sheet) {
    return errorResponse('Claim_Alerts sheet not found.', {
      sheetName: CLAIM_SHEET_NAMES.alerts
    });
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return successResponse({
      removedCount: 0,
      removedRows: []
    }, 'No alert rows found to clean.');
  }

  const headers = values[0];
  const sourceSystemIndex = headers.indexOf('Source_System');
  const sourceRecordIdIndex = headers.indexOf('Source_Record_ID');
  const reasonIndex = headers.indexOf('Reason');
  const recommendedActionIndex = headers.indexOf('Recommended_Action');

  if (sourceSystemIndex === -1 || sourceRecordIdIndex === -1 || reasonIndex === -1 || recommendedActionIndex === -1) {
    return errorResponse('Required alert cleanup columns not found.', {
      headers: headers
    });
  }

  const removedRows = [];

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const row = values[rowIndex];
    const sourceSystem = row[sourceSystemIndex];
    const sourceRecordId = row[sourceRecordIdIndex];
    const reason = row[reasonIndex];
    const recommendedAction = row[recommendedActionIndex];

    const isClaimAlertTest = sourceSystem === 'claims-service hard write test'
      || sourceSystem === 'claims-service test'
      || sourceRecordId === 'TEST-HARD-ALERT-001'
      || sourceRecordId === 'TEST-ALERT-001'
      || reason === 'Hard write alert test.'
      || reason === 'AlertService test alert.'
      || recommendedAction === 'Verify Claim_Alerts direct write.'
      || recommendedAction === 'Review missing EOJ.';

    if (isClaimAlertTest) {
      const sheetRowNumber = rowIndex + 1;
      removedRows.push(sheetRowNumber);
      sheet.deleteRow(sheetRowNumber);
    }
  }

  return successResponse({
    removedCount: removedRows.length,
    removedRows: removedRows.reverse()
  }, 'Claim alert test rows cleaned successfully.');
}

function testCleanupClaimAlertTestRows() {
  const response = cleanupClaimAlertTestRows();
  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function testAlertHeaders() {
  return successResponse({
    sheetName: CLAIM_SHEET_NAMES.alerts,
    headers: getHeaders(CLAIM_SHEET_NAMES.alerts)
  }, 'Alert sheet headers retrieved.');
}

function getActiveAlertsForAlertPersistence_(claimId) {
  const rows = getAlertPersistenceRows_(getAlertPersistenceSheetName_('alerts'));

  return rows.filter(function(row) {
    const rowClaimId = getAlertPersistenceValue_(row, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']);
    const status = getAlertPersistenceValue_(row, ['Alert_Status', 'Alert Status', 'Status', 'AlertStatus']);

    return String(rowClaimId || '') === String(claimId || '')
      && isOpenAlertStatus_(status);
  });
}

function addAlertForPersistence_(claimId, proposedAlert) {
  const now = nowIso();

  const alert = {
    Alert_ID: generateId(CLAIM_ID_PREFIXES.alert),
    Claim_ID: claimId,
    Alert_Type: proposedAlert.Alert_Type,
    Alert_Status: 'Active',
    Status: 'Active',
    Severity: proposedAlert.Severity || 'Medium',
    Source_System: proposedAlert.Source_System || 'claims-service alert persistence',
    Source_Record_ID: proposedAlert.Source_Record_ID || '',
    Reason: proposedAlert.Reason || '',
    Recommended_Action: proposedAlert.Recommended_Action || '',
    Owner_Area: proposedAlert.Owner_Area || '',
    Created_At: now,
    Resolved_At: '',
    Resolution_Reason: '',
    Dismissed_At: '',
    Dismissed_By: '',
    Dismissed_Reason: '',
    Suppressed_By_Rule: '',
    Suppression_Reason: '',
    Notes: proposedAlert.Notes || ''
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.alerts, alert);

  writeServiceLog('addAlertForPersistence', 'Success', 'Alert persisted without claim header update.', {
    claimId: claimId,
    alertType: alert.Alert_Type,
    sourceSystem: alert.Source_System,
    sourceRecordId: alert.Source_Record_ID,
    appendResult: appendResult
  });

  return successResponse({
    alert: alert,
    appendResult: appendResult
  }, 'Alert persisted successfully.');
}

function testAlertRulesSheetSetup() {
  const response = ensureAlertGovernanceSchema();
  Logger.log('ALERT_RULES_SHEET_SETUP ' + JSON.stringify(response, null, 2));
  return response;
}

function testSuppressClaimXForLibertyMutualRule() {
  ensureAlertGovernanceSchema();

  const rule = ensureAlertGovernanceRule_(buildLibertyMutualClaimXSuppressionRule_());
  const claim = {
    Claim_ID: 'TEST-LIBERTY-MUTUAL-CLAIM',
    Claim_Number: 'TEST-CLAIM-NUMBER',
    Job_Number: 'TEST-JOB-NUMBER',
    Carrier: 'Liberty Mutual'
  };
  const alertCandidate = {
    Claim_ID: claim.Claim_ID,
    Alert_Type: 'Missing ClaimX Link/Video'
  };

  const result = {
    rule: rule,
    shouldSuppress: shouldSuppressAlert(alertCandidate, claim),
    suppressionReason: getAlertSuppressionReason(alertCandidate, claim)
  };

  Logger.log('ALERT_RULE_LIBERTY_MUTUAL_TEST ' + JSON.stringify(result, null, 2));
  return successResponse(result, 'Liberty Mutual ClaimX suppression rule tested.');
}

function testDismissAlertLifecycle() {
  ensureAlertGovernanceSchema();

  const claimId = getFirstAlertGovernanceTestClaimId_();
  if (!claimId) {
    return validationErrorResponse(['No active claim was available for alert dismissal test.']);
  }

  const createResult = addAlertForPersistence_(claimId, {
    Alert_Type: 'Governance Test Alert',
    Severity: 'Low',
    Source_System: 'claims-service alert governance test',
    Source_Record_ID: 'TEST-ALERT-GOVERNANCE-DISMISS',
    Reason: 'Temporary alert created to test dismissal lifecycle.',
    Recommended_Action: 'Dismiss this test alert.',
    Owner_Area: 'Office Operations',
    Notes: 'Safe test alert created by testDismissAlertLifecycle.'
  });

  if (!createResult.success) {
    return createResult;
  }

  const alertId = createResult.data.alert.Alert_ID;
  const dismissResult = dismissAlert(alertId, 'Alert governance dismissal lifecycle test.', 'testDismissAlertLifecycle');
  const activeAlerts = getActiveAlertsForAlertPersistence_(claimId).filter(function(alert) {
    return getAlertPersistenceValue_(alert, ['Alert_ID', 'Alert ID']) === alertId;
  });

  const result = {
    claimId: claimId,
    alertId: alertId,
    created: createResult.success,
    dismissed: dismissResult.success,
    stillOpenAfterDismissal: activeAlerts.length > 0,
    dismissResult: dismissResult
  };

  Logger.log('ALERT_DISMISS_LIFECYCLE_TEST ' + JSON.stringify(result, null, 2));
  return successResponse(result, 'Alert dismissal lifecycle tested.');
}

function testHomepageOpenAlertsAfterGovernance() {
  ensureAlertGovernanceSchema();

  const rows = getAlertPersistenceRows_(getAlertPersistenceSheetName_('alerts'));
  const countsByStatus = {};
  let openCount = 0;

  rows.forEach(function(row) {
    const status = getAlertPersistenceValue_(row, ['Alert_Status', 'Alert Status', 'Status', 'AlertStatus']) || 'Active';
    countsByStatus[status] = (countsByStatus[status] || 0) + 1;

    if (isOpenAlertStatus_(status)) {
      openCount++;
    }
  });

  const homepageSummary = typeof getHomepageClaimSummary === 'function'
    ? getHomepageClaimSummary()
    : null;

  const result = {
    totalAlertRows: rows.length,
    openAlertRowsAfterGovernance: openCount,
    countsByStatus: countsByStatus,
    homepageOpenAlertCount: homepageSummary && homepageSummary.success && homepageSummary.data
      ? homepageSummary.data.openAlertCount
      : null
  };

  Logger.log('HOMEPAGE_OPEN_ALERTS_AFTER_GOVERNANCE ' + JSON.stringify(result, null, 2));
  return successResponse(result, 'Homepage open alerts after governance checked.');
}

function auditActiveClaimCarrierData() {
  const claims = getAlertPersistenceRows_(getAlertPersistenceSheetName_('claims'));
  const activeClaims = claims.filter(function(claim) {
    return isAlertPersistenceActiveClaim_(claim);
  });

  const result = {
    totalActiveClaims: activeClaims.length,
    withCarrierPopulated: 0,
    blankCarrier: 0,
    carrierCounts: {},
    sampleClaimsWithBlankCarrier: [],
    sampleClaimsWhereCarrierContainsLiberty: []
  };

  activeClaims.forEach(function(claim) {
    const carrier = String(getAlertPersistenceValue_(claim, ['Carrier', 'Insurance_Carrier', 'Insurance Carrier']) || '').trim();
    const claimSummary = {
      claimId: getAlertPersistenceValue_(claim, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']),
      jobNumber: getAlertPersistenceValue_(claim, ['Job_Number', 'Job Number', 'JobNumber', 'jobNumber']),
      claimNumber: getAlertPersistenceValue_(claim, ['Claim_Number', 'Claim Number']),
      customerName: getAlertPersistenceValue_(claim, ['Customer_Name', 'Customer Name', 'Display_Name', 'Display Name']),
      lifecycleState: getAlertPersistenceValue_(claim, ['Lifecycle_State', 'Lifecycle State', 'Current_Lifecycle_State', 'Current Lifecycle State']),
      carrier: carrier
    };

    if (carrier) {
      result.withCarrierPopulated++;
      result.carrierCounts[carrier] = (result.carrierCounts[carrier] || 0) + 1;

      if (carrier.toLowerCase().indexOf('liberty') !== -1 &&
          result.sampleClaimsWhereCarrierContainsLiberty.length < 10) {
        result.sampleClaimsWhereCarrierContainsLiberty.push(claimSummary);
      }
      return;
    }

    result.blankCarrier++;
    if (result.sampleClaimsWithBlankCarrier.length < 10) {
      result.sampleClaimsWithBlankCarrier.push(claimSummary);
    }
  });

  result.carrierCounts = sortAlertGovernanceCountMap_(result.carrierCounts);

  Logger.log('ACTIVE_CLAIM_CARRIER_AUDIT ' + JSON.stringify(result, null, 2));
  return successResponse(result, 'Active claim carrier data audited.');
}

function testAuditActiveClaimCarrierData() {
  const response = auditActiveClaimCarrierData();
  Logger.log('ACTIVE_CLAIM_CARRIER_AUDIT_TEST ' + JSON.stringify(response, null, 2));
  return response;
}

function sortAlertGovernanceCountMap_(countMap) {
  const sorted = {};

  Object.keys(countMap || {}).sort(function(a, b) {
    return countMap[b] - countMap[a] || a.localeCompare(b);
  }).forEach(function(key) {
    sorted[key] = countMap[key];
  });

  return sorted;
}

function ensureAlertGovernanceRule_(rule) {
  ensureAlertRulesSheet_();

  const rows = getAlertPersistenceRows_(ALERT_RULES_SHEET_NAME);
  const existing = rows.find(function(row) {
    return getAlertPersistenceValue_(row, ['Rule_ID', 'Rule ID']) === rule.Rule_ID;
  });

  if (existing) {
    return {
      created: false,
      rule: existing
    };
  }

  const appendResult = appendRow(ALERT_RULES_SHEET_NAME, rule);

  return {
    created: true,
    rule: rule,
    appendResult: appendResult
  };
}

function getFirstAlertGovernanceTestClaimId_() {
  const claims = getAlertPersistenceRows_(getAlertPersistenceSheetName_('claims'));
  const activeClaim = claims.find(function(claim) {
    return isAlertPersistenceActiveClaim_(claim) &&
      getAlertPersistenceValue_(claim, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']);
  });

  return activeClaim
    ? getAlertPersistenceValue_(activeClaim, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId'])
    : '';
}

function getStaleStructuredLinkAlerts_(activeAlerts, proposedAlerts) {
  const proposedTypes = (proposedAlerts || []).reduce(function(types, alert) {
    const normalizedType = normalizeStructuredLinkAlertType_(alert.Alert_Type || '');
    if (normalizedType) {
      types[normalizedType] = true;
    }
    return types;
  }, {});

  return (activeAlerts || []).filter(function(alert) {
    const normalizedType = normalizeStructuredLinkAlertType_(alert.Alert_Type || '');
    return normalizedType && !proposedTypes[normalizedType];
  });
}

function normalizeStructuredLinkAlertType_(alertType) {
  const normalized = String(alertType || '').trim().toLowerCase();

  if (normalized === 'missing xact/symbility link' || normalized === 'missing xa/symbility link') {
    return 'missing-xa-symbility-link';
  }

  if (normalized === 'missing claimx link/video') {
    return 'missing-claimx-link-video';
  }

  // When a bootstrapped claim gains an External_Links row, the next
  // reconcileClaimAlerts run will propose specific link alerts instead.
  // This mapping ensures the stale "Missing Operational Links Record" alert
  // is resolved automatically at that point.
  if (normalized === 'missing operational links record') {
    return 'missing-operational-links-record';
  }

  return '';
}

function isAllstateAlertPersistenceClaim_(claimId) {
  const claim = getAlertPersistenceClaimById_(claimId) || {};
  const carrier = getAlertPersistenceValue_(claim, [
    'Carrier',
    'Insurance_Carrier',
    'Insurance Carrier',
    'Insurance_Company',
    'Insurance Company',
    'Company',
    'Carrier_Name',
    'Carrier Name',
    'Insurer'
  ]);

  return String(carrier || '').toLowerCase().indexOf('allstate') !== -1;
}

function testAllstateDetection_26N0103() {
  const claim = getAlertPersistenceClaimById_('CLM-26N-0103-WTR');

  const carrier = getAlertPersistenceValue_(claim || {}, [
    'Carrier',
    'Insurance_Carrier',
    'Insurance Carrier',
    'Insurance_Company',
    'Insurance Company',
    'Company',
    'Carrier_Name',
    'Carrier Name',
    'Insurer'
  ]);

  const result = {
    claimId: 'CLM-26N-0103-WTR',
    carrier: carrier,
    isAllstate: isAllstateAlertPersistenceClaim_('CLM-26N-0103-WTR')
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testReconcileClaimAlerts_26N0103() {
  const result = reconcileClaimAlerts('CLM-26N-0103-WTR', {
    dryRun: false
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testReconcileRafiAlerts() {
  const result = reconcileClaimAlerts('CLM-26A-0052-WTR', {
    dryRun: false
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function testReconcileRafi0822508719Alerts() {
  const result = reconcileClaimAlerts('CLM-26N-0133-CUS', {
    dryRun: false
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testDiagnoseRafi0822508719ExternalLinks() {
  const claimId = 'CLM-26N-0133-CUS';
  const claim = getAlertPersistenceClaimById_(claimId) || {};
  const jobNumber = getJobNumberForAlertPersistenceClaim_(claimId);
  const externalLinks = getExternalLinksForAlertPersistence_(claimId);

  const result = {
    claimId: claimId,
    jobNumber: jobNumber,
    claim: {
      Claim_ID: getAlertPersistenceValue_(claim, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']),
      Job_Number: getAlertPersistenceValue_(claim, ['Job_Number', 'Job Number', 'JobNumber', 'jobNumber']),
      Claim_Number: getAlertPersistenceValue_(claim, ['Claim_Number', 'Claim Number']),
      Customer_Name: getAlertPersistenceValue_(claim, ['Customer_Name', 'Customer Name', 'Display_Name', 'Display Name'])
    },
    matchedExternalLinkRows: externalLinks.length,
    externalLinks: externalLinks.map(function(link) {
      return {
        Claim_ID: getAlertPersistenceValue_(link, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId', 'Claim_Record_ID', 'Claim Record ID', 'Related_Claim_ID', 'Related Claim ID']),
        Job_Number: getAlertPersistenceValue_(link, ['Job_Number', 'Job Number', 'JobNumber', 'jobNumber']),
        Link_Type: getAlertPersistenceValue_(link, ['Link_Type', 'Link Type', 'Type', 'Link_Name', 'Link Name']),
        URL: getAlertPersistenceValue_(link, ['URL', 'Url', 'Link_URL', 'Link URL', 'Value', 'External_URL', 'External URL']),
        Fusion_URL: getAlertPersistenceValue_(link, ['Fusion_URL', 'Fusion URL', 'FusionURL']),
        XactAnalysis: getAlertPersistenceValue_(link, ['XactAnalysis', 'Xact Analysis', 'XactAnalysis_URL', 'XactAnalysis URL']),
        Xactimate_URL: getAlertPersistenceValue_(link, ['Xactimate_URL', 'Xactimate URL']),
        Symbility_URL: getAlertPersistenceValue_(link, ['Symbility_URL', 'Symbility URL', 'Symbility']),
        ClaimX_URL: getAlertPersistenceValue_(link, ['ClaimX_URL', 'ClaimX URL', 'ClaimX']),
        rawKeys: Object.keys(link)
      };
    })
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}