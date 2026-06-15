/**
 * Alert management service.
 * Rainbow Phase 4 - Claim Foundation
 */

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
    Severity: (details && details.Severity) || 'Medium',
    Source_System: (details && details.Source_System) || CLAIM_SERVICE.name,
    Source_Record_ID: (details && details.Source_Record_ID) || '',
    Reason: (details && details.Reason) || '',
    Recommended_Action: (details && details.Recommended_Action) || '',
    Owner_Area: (details && details.Owner_Area) || '',
    Created_At: now,
    Resolved_At: '',
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

function resolveAlert(alertId) {
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
      Resolved_At: now
    }
  );

  writeServiceLog('resolveAlert', result.success ? 'Success' : 'Not Found', result.message, {
    sourceSystem: CLAIM_SERVICE.name,
    sourceRecordId: alertId
  });

  return result;
}

function getActiveAlerts(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.alerts, {
    Claim_ID: claimId
  });

  const active = rows.filter(function(row) {
    return row.Alert_Status === 'Active';
  });

  return successResponse({
    claimId: claimId,
    alerts: active,
    count: active.length
  }, 'Active alerts retrieved.');
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

  const claims = getAlertPersistenceRows_(getAlertPersistenceSheetName_('claims'));
  const activeClaims = claims.filter(function(claim) {
    return isAlertPersistenceActiveClaim_(claim);
  });

  const results = {
    status: 'Success',
    dryRun: dryRun,
    activeClaimsEvaluated: activeClaims.length,
    alertsProposed: 0,
    alertsWritten: 0,
    skippedExistingAlerts: 0,
    skippedClaims: 0,
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
        quiet: options.quiet === true
      });
      const data = claimResult && claimResult.data ? claimResult.data : claimResult;

      results.alertsProposed += Number(data.alertsProposed || 0);
      results.alertsWritten += Number(data.alertsWritten || 0);
      results.skippedExistingAlerts += Number(data.skippedExistingAlerts || 0);

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
  return successResponse(results, 'Alert persistence reconciliation complete.');
}

function reconcileClaimAlerts(claimId, options) {
  options = options || {};
  const dryRun = options.dryRun !== false;

  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const proposedAlerts = buildStructuredAlertsForClaim_(claimId);
  const activeAlerts = getActiveAlertsForAlertPersistence_(claimId);

  const newAlerts = proposedAlerts.filter(function(proposed) {
    return !activeAlerts.some(function(existing) {
      return String(existing.Alert_Type || '') === String(proposed.Alert_Type || '');
    });
  });

  let alertsWritten = 0;
  const writeResults = [];

  if (!dryRun) {
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
    newAlerts: newAlerts.length,
    skippedExistingAlerts: proposedAlerts.length - newAlerts.length,
    alertsWritten: alertsWritten,
    proposedAlerts: proposedAlerts,
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
    // Do not create a broad alert when no External_Links row is found.
    // At this stage, a missing row may mean the link table uses a different key
    // than Claim_ID. We only create specific missing-link alerts after a claim's
    // External_Links rows are positively matched.
    return proposed;
  }

  const hasXact = hasExternalLinkValue_(externalLinks, [
    'XactAnalysis',
    'Xact Analysis',
    'Xactimate',
    'Xactimate Link',
    'Xact URL',
    'XactAnalysis URL'
  ]);

  const hasSymbility = hasExternalLinkValue_(externalLinks, [
    'Symbility',
    'Symbility Link',
    'Symbility URL'
  ]);

  const hasClaimX = hasExternalLinkValue_(externalLinks, [
    'ClaimX',
    'ClaimX Link',
    'ClaimX URL',
    'ClaimX Video',
    'ClaimX Video Link'
  ]);

  if (!hasXact && !hasSymbility) {
    proposed.push(buildStructuredAlert_(claimId, {
      Alert_Type: 'Missing Xact/Symbility Link',
      Severity: 'Medium',
      Source_System: 'claims-service alert persistence',
      Source_Record_ID: 'External_Links:' + claimId,
      Reason: 'Neither XactAnalysis/Xactimate nor Symbility link is populated for this active claim.',
      Recommended_Action: 'Add the XactAnalysis, Xactimate, or Symbility link to External_Links.',
      Owner_Area: 'Office Operations',
      Notes: 'Generated from structured External_Links data only.'
    }));
  }

  if (!hasClaimX) {
    proposed.push(buildStructuredAlert_(claimId, {
      Alert_Type: 'Missing ClaimX Link/Video',
      Severity: 'Low',
      Source_System: 'claims-service alert persistence',
      Source_Record_ID: 'External_Links:' + claimId,
      Reason: 'ClaimX link/video is not populated for this active claim.',
      Recommended_Action: 'Add the ClaimX link/video when available, or leave unresolved if not required for this claim.',
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
  const claims = getAlertPersistenceRows_(getAlertPersistenceSheetName_('claims'));
  const claim = claims.find(function(row) {
    const rowClaimId = getAlertPersistenceValue_(row, ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId']);
    return String(rowClaimId || '') === String(claimId || '');
  });

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
      && String(status || '').toLowerCase() === 'active';
  });
}

function addAlertForPersistence_(claimId, proposedAlert) {
  const now = nowIso();

  const alert = {
    Alert_ID: generateId(CLAIM_ID_PREFIXES.alert),
    Claim_ID: claimId,
    Alert_Type: proposedAlert.Alert_Type,
    Alert_Status: 'Active',
    Severity: proposedAlert.Severity || 'Medium',
    Source_System: proposedAlert.Source_System || 'claims-service alert persistence',
    Source_Record_ID: proposedAlert.Source_Record_ID || '',
    Reason: proposedAlert.Reason || '',
    Recommended_Action: proposedAlert.Recommended_Action || '',
    Owner_Area: proposedAlert.Owner_Area || '',
    Created_At: now,
    Resolved_At: '',
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