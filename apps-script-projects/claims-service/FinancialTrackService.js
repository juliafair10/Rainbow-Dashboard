

/**
 * Financial track management service.
 * Rainbow Phase 4 - Claim Foundation
 *
 * Financial tracks represent estimates, supplements, and payment-bearing subtracks
 * within a single Claim Ecosystem. Supplements are not separate claims.
 */

function createFinancialTrack(claimId, payload) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const claimLookup = lookupClaim({ Claim_ID: claimId });
  if (!claimLookup.success) {
    return notFoundResponse('Cannot create financial track because claim was not found.', {
      claimId: claimId
    });
  }

  const normalized = normalizeFinancialTrackData_(payload || {});
  const validation = validateFinancialTrackPayload_(normalized);

  if (!validation.success) {
    writeServiceLog('createFinancialTrack', 'Validation Error', 'Financial track creation failed validation.', {
      claimId: claimId,
      sourceSystem: normalized.Source_System || CLAIM_SERVICE.name,
      error: validation.errors
    });
    return validation;
  }

  const existing = findFinancialTracksForClaim(claimId);
  if (existing.success) {
    const duplicate = existing.data.financialTracks.find(function(track) {
      return normalizeLower(track.Track_Type) === normalizeLower(normalized.Track_Type) &&
        normalizeLower(track.Track_Name) === normalizeLower(normalized.Track_Name);
    });

    if (duplicate) {
      return successResponse({
        financialTrack: duplicate,
        created: false
      }, 'Existing financial track found. No duplicate track was created.');
    }
  }

  const now = nowIso();

  const financialTrack = {
    Financial_Track_ID: generateId(CLAIM_ID_PREFIXES.financialTrack),
    Claim_ID: claimId,
    Track_Type: normalized.Track_Type,
    Track_Name: normalized.Track_Name,
    Fusion_File_URL: normalized.Fusion_File_URL || '',
    Xactimate_URL: normalized.Xactimate_URL || '',
    Symbility_URL: normalized.Symbility_URL || '',
    ClaimX_URL: normalized.ClaimX_URL || '',
    Status: normalized.Status || 'Open',
    Approval_State: normalized.Approval_State || 'Not Submitted',
    Payment_State: normalized.Payment_State || 'Unpaid',
    Amount_Estimated: normalized.Amount_Estimated || '',
    Amount_Approved: normalized.Amount_Approved || '',
    Amount_Paid: normalized.Amount_Paid || '',
    Carrier: normalized.Carrier || claimLookup.data.claim.Carrier || '',
    Created_At: now,
    Updated_At: now,
    Closed_At: '',
    Notes: normalized.Notes || ''
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.financialTracks, financialTrack);

  appendTimelineEvent(claimId, {
    Event_Type: 'Financial Track Created',
    Summary: financialTrack.Track_Name,
    Detail: financialTrack.Notes || financialTrack.Track_Type,
    Source_System: normalized.Source_System || CLAIM_SERVICE.name,
    Source_Record_ID: financialTrack.Financial_Track_ID,
    Related_Workflow: 'Financial Track Management',
    Related_Financial_Track_ID: financialTrack.Financial_Track_ID,
    Is_Meaningful_Activity: true
  });

  writeServiceLog('createFinancialTrack', 'Success', 'Financial track created.', {
    claimId: claimId,
    sourceSystem: normalized.Source_System || CLAIM_SERVICE.name,
    sourceRecordId: financialTrack.Financial_Track_ID,
    financialTrackId: financialTrack.Financial_Track_ID,
    trackType: financialTrack.Track_Type,
    trackName: financialTrack.Track_Name,
    appendResult: appendResult
  });

  return successResponse({
    financialTrack: financialTrack,
    appendResult: appendResult,
    created: true
  }, 'Financial track created successfully.');
}

function updateFinancialTrack(financialTrackId, updates) {
  if (!financialTrackId) {
    return validationErrorResponse(['Financial_Track_ID is required.']);
  }

  const cleanUpdates = normalizeFinancialTrackUpdates_(updates || {});
  cleanUpdates.Updated_At = nowIso();

  const result = updateRowByKey(
    CLAIM_SHEET_NAMES.financialTracks,
    'Financial_Track_ID',
    financialTrackId,
    cleanUpdates
  );

  writeServiceLog('updateFinancialTrack', result.success ? 'Success' : 'Not Found', result.message, {
    sourceSystem: CLAIM_SERVICE.name,
    sourceRecordId: financialTrackId,
    financialTrackId: financialTrackId,
    updates: cleanUpdates
  });

  return result;
}

function closeFinancialTrack(financialTrackId, reason) {
  if (!financialTrackId) {
    return validationErrorResponse(['Financial_Track_ID is required.']);
  }

  return updateFinancialTrack(financialTrackId, {
    Status: 'Closed',
    Closed_At: nowIso(),
    Notes: reason || ''
  });
}

function findFinancialTracksForClaim(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.financialTracks, {
    Claim_ID: claimId
  });

  rows.sort(function(a, b) {
    const aDate = new Date(a.Created_At || 0).getTime();
    const bDate = new Date(b.Created_At || 0).getTime();
    return bDate - aDate;
  });

  return successResponse({
    claimId: claimId,
    financialTracks: rows,
    count: rows.length
  }, 'Financial tracks retrieved.');
}

function createMainEstimateTrack(claimId, payload) {
  const trackPayload = Object.assign({}, payload || {}, {
    Track_Type: 'Main Estimate',
    Track_Name: (payload && payload.Track_Name) || 'Main Estimate'
  });

  return createFinancialTrack(claimId, trackPayload);
}

function createSupplementTrack(claimId, payload) {
  const trackPayload = Object.assign({}, payload || {}, {
    Track_Type: (payload && payload.Track_Type) || 'Supplement',
    Track_Name: (payload && payload.Track_Name) || 'Supplement'
  });

  return createFinancialTrack(claimId, trackPayload);
}

function normalizeFinancialTrackData_(payload) {
  const normalized = Object.assign({}, payload || {});

  normalized.Track_Type = normalizeString(normalized.Track_Type || normalized.trackType || 'Main Estimate');
  normalized.Track_Name = normalizeString(normalized.Track_Name || normalized.trackName || normalized.Track_Type || 'Main Estimate');
  normalized.Fusion_File_URL = normalizeString(normalized.Fusion_File_URL || normalized.fusionFileUrl || '');
  normalized.Xactimate_URL = normalizeString(normalized.Xactimate_URL || normalized.xactimateUrl || '');
  normalized.Symbility_URL = normalizeString(normalized.Symbility_URL || normalized.symbilityUrl || '');
  normalized.ClaimX_URL = normalizeString(normalized.ClaimX_URL || normalized.claimXUrl || '');
  normalized.Status = normalizeString(normalized.Status || normalized.status || 'Open');
  normalized.Approval_State = normalizeString(normalized.Approval_State || normalized.approvalState || 'Not Submitted');
  normalized.Payment_State = normalizeString(normalized.Payment_State || normalized.paymentState || 'Unpaid');
  normalized.Amount_Estimated = normalized.Amount_Estimated || normalized.amountEstimated || '';
  normalized.Amount_Approved = normalized.Amount_Approved || normalized.amountApproved || '';
  normalized.Amount_Paid = normalized.Amount_Paid || normalized.amountPaid || '';
  normalized.Carrier = normalizeString(normalized.Carrier || normalized.carrier || '');
  normalized.Source_System = normalizeString(normalized.Source_System || normalized.sourceSystem || CLAIM_SERVICE.name);
  normalized.Notes = normalizeString(normalized.Notes || normalized.notes || '');

  return normalized;
}

function normalizeFinancialTrackUpdates_(updates) {
  const normalized = {};
  const raw = updates || {};

  Object.keys(raw).forEach(function(key) {
    const value = raw[key];

    if (value === undefined) {
      return;
    }

    switch (key) {
      case 'trackType':
      case 'Track_Type':
        normalized.Track_Type = normalizeString(value);
        break;

      case 'trackName':
      case 'Track_Name':
        normalized.Track_Name = normalizeString(value);
        break;

      case 'fusionFileUrl':
      case 'Fusion_File_URL':
        normalized.Fusion_File_URL = normalizeString(value);
        break;

      case 'xactimateUrl':
      case 'Xactimate_URL':
        normalized.Xactimate_URL = normalizeString(value);
        break;

      case 'symbilityUrl':
      case 'Symbility_URL':
        normalized.Symbility_URL = normalizeString(value);
        break;

      case 'claimXUrl':
      case 'ClaimX_URL':
        normalized.ClaimX_URL = normalizeString(value);
        break;

      case 'status':
      case 'Status':
        normalized.Status = normalizeString(value);
        break;

      case 'approvalState':
      case 'Approval_State':
        normalized.Approval_State = normalizeString(value);
        break;

      case 'paymentState':
      case 'Payment_State':
        normalized.Payment_State = normalizeString(value);
        break;

      case 'amountEstimated':
      case 'Amount_Estimated':
        normalized.Amount_Estimated = value;
        break;

      case 'amountApproved':
      case 'Amount_Approved':
        normalized.Amount_Approved = value;
        break;

      case 'amountPaid':
      case 'Amount_Paid':
        normalized.Amount_Paid = value;
        break;

      case 'carrier':
      case 'Carrier':
        normalized.Carrier = normalizeString(value);
        break;

      case 'closedAt':
      case 'Closed_At':
        normalized.Closed_At = value;
        break;

      case 'notes':
      case 'Notes':
        normalized.Notes = normalizeString(value);
        break;

      default:
        normalized[key] = value;
    }
  });

  return normalized;
}

function validateFinancialTrackPayload_(payload) {
  const errors = [];

  if (!payload.Track_Type) {
    errors.push('Track_Type is required.');
  }

  if (!payload.Track_Name) {
    errors.push('Track_Name is required.');
  }

  if (errors.length > 0) {
    return validationErrorResponse(errors);
  }

  return successResponse({ valid: true }, 'Financial track payload is valid.');
}

function testCreateMainEstimateTrack() {
  return createMainEstimateTrack('CLM-20260605-821496', {
    Carrier: 'Test Carrier',
    Amount_Estimated: 1250,
    Source_System: 'claims-service test',
    Notes: 'Test main estimate financial track.'
  });
}

function testCreateSupplementTrack() {
  return createSupplementTrack('CLM-20260605-821496', {
    Track_Type: 'Mold Supplement',
    Track_Name: 'Mold Supplement',
    Carrier: 'Test Carrier',
    Amount_Estimated: 750,
    Approval_State: 'Under Review',
    Payment_State: 'Unpaid',
    Source_System: 'claims-service test',
    Notes: 'Test supplement financial track.'
  });
}

function testFindFinancialTracksForClaim() {
  return findFinancialTracksForClaim('CLM-20260605-821496');
}