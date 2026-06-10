

/**
 * External link management service.
 * Rainbow Phase 4 - Claim Foundation
 */

function addExternalLink(claimId, payload) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const claimLookup = lookupClaim({ Claim_ID: claimId });
  if (!claimLookup.success) {
    return notFoundResponse('Claim not found.', { claimId: claimId });
  }

  const now = nowIso();
  const label = normalizeString(payload.Label || payload.Link_Name || payload.Link_Type || '');

  const link = {
    External_Link_ID: generateId(CLAIM_ID_PREFIXES.externalLink),
    Claim_ID: claimId,
    Financial_Track_ID: normalizeString(payload.Financial_Track_ID || payload.financialTrackId || ''),
    Link_Type: normalizeString(payload.Link_Type || payload.linkType || ''),
    URL: normalizeString(payload.URL || payload.url || ''),
    Label: label,
    Created_At: now,
    Updated_At: now,
    Notes: normalizeString(payload.Notes || payload.notes || '')
  };

  const result = appendRow(CLAIM_SHEET_NAMES.externalLinks, link);

  appendTimelineEvent(claimId, {
    Event_Type: 'External Link Added',
    Summary: link.Label,
    Detail: link.URL,
    Source_System: normalizeString(payload.Source_System || payload.sourceSystem || CLAIM_SERVICE.name),
    Source_Record_ID: link.External_Link_ID,
    Related_Financial_Track_ID: link.Financial_Track_ID,
    Related_Workflow: 'External Link Management',
    Is_Meaningful_Activity: true
  });

  writeServiceLog('addExternalLink', 'Success', 'External link added.', {
    claimId: claimId,
    sourceSystem: normalizeString(payload.Source_System || payload.sourceSystem || CLAIM_SERVICE.name),
    sourceRecordId: link.External_Link_ID,
    linkType: link.Link_Type,
    label: link.Label
  });

  return successResponse({
    externalLink: link,
    appendResult: result
  }, 'External link added successfully.');
}

function getExternalLinksForClaim(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.externalLinks, {
    Claim_ID: claimId
  });

  return successResponse({
    claimId: claimId,
    links: rows,
    count: rows.length
  }, 'External links retrieved.');
}

function getExternalLinksForFinancialTrack(financialTrackId) {
  if (!financialTrackId) {
    return validationErrorResponse(['Financial_Track_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.externalLinks, {
    Financial_Track_ID: financialTrackId
  });

  return successResponse({
    financialTrackId: financialTrackId,
    links: rows,
    count: rows.length
  }, 'Financial track external links retrieved.');
}

function updateExternalLink(externalLinkId, updates) {
  if (!externalLinkId) {
    return validationErrorResponse(['External_Link_ID is required.']);
  }

  const cleanUpdates = normalizeExternalLinkUpdates_(updates || {});
  cleanUpdates.Updated_At = nowIso();

  return updateRowByKey(
    CLAIM_SHEET_NAMES.externalLinks,
    'External_Link_ID',
    externalLinkId,
    cleanUpdates
  );
}

function normalizeExternalLinkUpdates_(updates) {
  const normalized = {};
  const raw = updates || {};

  Object.keys(raw).forEach(function(key) {
    const value = raw[key];

    if (value === undefined) {
      return;
    }

    switch (key) {
      case 'financialTrackId':
      case 'Financial_Track_ID':
        normalized.Financial_Track_ID = normalizeString(value);
        break;

      case 'linkType':
      case 'Link_Type':
        normalized.Link_Type = normalizeString(value);
        break;

      case 'url':
      case 'URL':
        normalized.URL = normalizeString(value);
        break;

      case 'label':
      case 'Link_Name':
      case 'Label':
        normalized.Label = normalizeString(value);
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

function testAddFusionLink() {
  return addExternalLink('CLM-20260605-821496', {
    Link_Type: 'Fusion',
    Label: 'Fusion Claim File',
    URL: 'https://fusion.example.com/claim/123',
    Source_System: 'claims-service test',
    Notes: 'Test Fusion link.'
  });
}

function testAddXactimateLink() {
  return addExternalLink('CLM-20260605-821496', {
    Link_Type: 'Xactimate',
    Label: 'Xactimate Estimate',
    URL: 'https://xactimate.example.com/estimate/123',
    Source_System: 'claims-service test',
    Notes: 'Test Xactimate link.'
  });
}

function testHardWriteExternalLinkRow() {
  const now = nowIso();

  const link = {
    External_Link_ID: generateId(CLAIM_ID_PREFIXES.externalLink),
    Claim_ID: 'CLM-20260605-821496',
    Financial_Track_ID: '',
    Link_Type: 'Fusion',
    URL: 'https://fusion.example.com/claim/123',
    Label: 'Fusion Claim File',
    Created_At: now,
    Updated_At: now,
    Notes: 'Hard write external link test.'
  };

  return appendRow(CLAIM_SHEET_NAMES.externalLinks, link);
}

function testGetExternalLinks() {
  return getExternalLinksForClaim('CLM-20260605-821496');
}