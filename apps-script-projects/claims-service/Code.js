/**
 * claims-service
 * Rainbow Phase 4 — Claim Foundation
 *
 * Entry points only. Business logic belongs in the service files.
 */

function doGet(e) {
  return routeClaimServiceRequest_(e, 'GET');
}

function migrateClaimTimelinePhase5Columns() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Claim_Timeline');

  if (!sheet) {
    throw new Error('Claim_Timeline sheet not found.');
  }

  const requiredColumns = [
    'Event_Category',
    'Source_Run_ID',
    'Owner_Area',
    'Related_Condition_ID',
    'Related_Alert_ID',
    'Related_EOJ_ID',
    'Related_External_Link_ID',
    'Meaningful_Activity_Type',
    'Updates_Last_Activity',
    'Display_Priority',
    'Visibility',
    'Group_ID',
    'Group_Label',
    'Parent_Event_ID',
    'Is_Group_Parent',
    'Noise_Reason',
    'Created_By'
  ];

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const missingColumns = requiredColumns.filter(function(columnName) {
    return headers.indexOf(columnName) === -1;
  });

  if (missingColumns.length === 0) {
    Logger.log('Claim_Timeline already has all Phase 5 columns.');
    return {
      status: 'Success',
      message: 'No columns added. Claim_Timeline already has all Phase 5 columns.',
      addedColumns: []
    };
  }

  sheet.getRange(1, lastColumn + 1, 1, missingColumns.length).setValues([missingColumns]);

  Logger.log('Added Phase 5 Claim_Timeline columns: ' + missingColumns.join(', '));

  return {
    status: 'Success',
    message: 'Added missing Phase 5 Claim_Timeline columns.',
    addedColumns: missingColumns
  };
}

function doPost(e) {
  return routeClaimServiceRequest_(e, 'POST');
}

function routeClaimServiceRequest_(e, method) {
  try {
    const payload = parseRequestPayload_(e);
    const hasExplicitAction = !!(e && e.parameter && e.parameter.action);
    const action = hasExplicitAction ? e.parameter.action : 'healthCheck';

    if (!hasExplicitAction && isClaimsPageRouteRequest_(payload)) {
      return routeClaimsPageRequest_(payload);
    }

    switch (action) {
      case 'healthCheck':
        return jsonResponse_(successResponse({
          service: 'claims-service',
          method: method,
          spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID
        }, 'claims-service is reachable.'));

      case 'homepageClaimSummary':
        return jsonResponse_(getHomepageClaimSummary());

      case 'getClaimsWorkspace':
        return jsonResponse_(ClaimsWorkspaceService.getClaimsWorkspace(payload));

      case 'getClaimsList':
        return jsonResponse_(ClaimsWorkspaceService.getClaimsList(
          payload.lensId || payload.lens || (e.parameter && (e.parameter.lensId || e.parameter.lens)) || 'all',
          payload
        ));

      case 'getClaimDrawer':
        return jsonResponse_(
          ClaimDrawerService.getClaimDrawer(
            payload.claimId || (e.parameter && e.parameter.claimId)
          )
        );

      case 'getClaimDetail':
        return jsonResponse_(
          ClaimDetailService.getClaimDetail(
            payload.claimId || (e.parameter && e.parameter.claimId)
          )
        );

      case 'lookupClaim':
        return jsonResponse_(lookupClaim(payload));

      case 'createClaim':
        return jsonResponse_(createClaim(payload));

      case 'updateClaim':
        return jsonResponse_(updateClaim(payload.claimId, payload.updates || {}));

      case 'appendTimelineEvent':
        return jsonResponse_(appendTimelineEvent(payload.claimId, payload.event || {}));

      case 'upsertCondition':
        return jsonResponse_(upsertCondition(payload.claimId, payload.condition || {}));

      case 'resolveCondition':
        return jsonResponse_(closeCondition(payload.claimId, payload.conditionType, payload.reason || ''));

      case 'createAlert':
        return jsonResponse_(createAlert(payload.claimId, payload.alert || {}));

      case 'resolveAlert':
        return jsonResponse_(resolveAlert(payload.alertId, payload.reason || ''));

      case 'dismissAlert':
        return jsonResponse_(dismissAlert(
          payload.alertId,
          payload.reason || '',
          payload.dismissedBy || ''
        ));

      case 'dismissAlertsByClaimAndType':
        return jsonResponse_(dismissAlertsByClaimAndType(
          payload.claimId,
          payload.alertType,
          payload.reason || '',
          payload.dismissedBy || ''
        ));

      case 'createFinancialTrack':
        return jsonResponse_(createFinancialTrack(payload.claimId, payload.financialTrack || {}));

      case 'updateFinancialTrack':
        return jsonResponse_(updateFinancialTrack(payload.financialTrackId, payload.updates || {}));

      case 'attachExternalLink':
        return jsonResponse_(attachExternalLink(payload.claimId, payload.link || {}));

      case 'processEojOutputs':
        return jsonResponse_(processEojOutputs(payload));

      default:
        return jsonResponse_(errorResponse('Unknown action: ' + action, { action: action }));
    }
  } catch (error) {
    return jsonResponse_(errorResponse('claims-service request failed.', {
      error: String(error),
      stack: error && error.stack ? error.stack : ''
    }));
  }
}

function isClaimsPageRouteRequest_(payload) {
  const page = normalizeString(payload && payload.page).toLowerCase();

  return page === 'claims' || page === 'claim';
}

function routeClaimsPageRequest_(payload) {
  const routeOptions = buildClaimsWorkspaceRouteOptions_(payload);

  if (routeOptions.page === 'claim') {
    if (!routeOptions.claimId) {
      return jsonResponse_(validationErrorResponse(['claimId is required for claim page routes.']));
    }

    return jsonResponse_(ClaimDetailService.getClaimDetail(routeOptions.claimId));
  }

  return jsonResponse_(ClaimsWorkspaceService.getClaimsWorkspace(routeOptions));
}

function buildClaimsWorkspaceRouteOptions_(payload) {
  payload = payload || {};

  const lensId = normalizeString(
    payload.lensId ||
    payload.lens ||
    payload.claimsLens ||
    'all'
  );

  return {
    page: normalizeString(payload.page || 'claims').toLowerCase(),
    lensId: lensId || 'all',
    ownershipArea: normalizeString(payload.ownershipArea || payload.ownership || ''),
    conditionType: normalizeString(payload.conditionType || payload.condition || ''),
    claimId: normalizeString(payload.claimId || payload.claim || ''),
    compliance: normalizeString(payload.compliance || payload.complianceType || ''),
    routeSource: 'page'
  };
}

function testClaimsWorkspacePageRouting() {
  const workspaceResponse = routeClaimServiceRequest_({
    parameter: {
      page: 'claims',
      lensId: 'all'
    }
  }, 'GET');
  const workspacePayload = parseClaimsRouteTestResponse_(workspaceResponse);

  const explicitActionResponse = routeClaimServiceRequest_({
    parameter: {
      action: 'healthCheck',
      page: 'claims'
    }
  }, 'GET');
  const explicitActionPayload = parseClaimsRouteTestResponse_(explicitActionResponse);

  const result = {
    pageRoute: {
      activeLensId: workspacePayload.activeLensId || '',
      routeContext: workspacePayload.routeContext || {},
      totalCount: workspacePayload.claimsList ? workspacePayload.claimsList.totalCount : 0
    },
    explicitActionPreserved: !!(
      explicitActionPayload &&
      explicitActionPayload.success === true &&
      explicitActionPayload.data &&
      explicitActionPayload.data.service === 'claims-service'
    )
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function testClaimDetailRoute() {
  const claims = ClaimsQueryService.getAllClaimSummaries({});
  const claim = claims.find(function(item) {
    return item.claimId;
  });

  if (!claim) {
    throw new Error('No claim available for claim detail route test.');
  }

  const response = routeClaimServiceRequest_({
    parameter: {
      page: 'claim',
      claimId: claim.claimId
    }
  }, 'GET');
  const payload = parseClaimsRouteTestResponse_(response);

  const result = {
    requestedClaimId: claim.claimId,
    returnedClaimId: payload.claimId || '',
    claimHeaderClaimId: payload.claimHeader ? payload.claimHeader.claimId || '' : '',
    hasTimelineSection: !!payload.timelineSection,
    hasOperationalContext: !!payload.operationalContext
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function parseClaimsRouteTestResponse_(response) {
  if (response && typeof response.getContent === 'function') {
    return safeJsonParse(response.getContent(), {});
  }

  if (response && response.content) {
    return safeJsonParse(response.content, {});
  }

  return response || {};
}

function testListAllSheets() {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);

  const sheetNames = spreadsheet
    .getSheets()
    .map(sheet => sheet.getName());

  Logger.log(JSON.stringify(sheetNames, null, 2));

  return sheetNames;
}
