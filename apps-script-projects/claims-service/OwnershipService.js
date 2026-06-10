

/**
 * Ownership management service.
 * Rainbow Phase 4 - Claim Foundation
 */

function setOwnership(claimId, ownershipArea, primaryOwner, details) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  if (!ownershipArea) {
    return validationErrorResponse(['Ownership_Area is required.']);
  }

  if (CLAIM_OWNERSHIP_AREAS.indexOf(ownershipArea) === -1) {
    return validationErrorResponse(['Ownership_Area is not valid: ' + ownershipArea]);
  }

  const now = nowIso();
  const currentOwnership = getCurrentOwnership(claimId);

  if (currentOwnership.success && currentOwnership.data.currentOwnership) {
    const current = currentOwnership.data.currentOwnership;

    if (current.Ownership_Area === ownershipArea && current.Primary_Owner === primaryOwner) {
      return successResponse({
        ownership: current,
        changed: false
      }, 'Ownership is already current.');
    }

    updateRowByKey(
      CLAIM_SHEET_NAMES.ownershipHistory,
      'Ownership_Record_ID',
      current.Ownership_Record_ID,
      {
        Ended_At: now
      }
    );
  }

  const ownershipRecord = {
    Ownership_Record_ID: generateId(CLAIM_ID_PREFIXES.ownership),
    Claim_ID: claimId,
    Ownership_Area: ownershipArea,
    Primary_Owner: primaryOwner || '',
    Started_At: now,
    Ended_At: '',
    Trigger_Event: (details && details.Trigger_Event) || '',
    Source_System: (details && details.Source_System) || CLAIM_SERVICE.name,
    Source_Record_ID: (details && details.Source_Record_ID) || '',
    Notes: (details && details.Notes) || ''
  };

  const appendResult = appendRow(CLAIM_SHEET_NAMES.ownershipHistory, ownershipRecord);

  updateClaim(claimId, {
    Ownership_Area: ownershipArea,
    Primary_Owner: primaryOwner || ''
  });

  appendTimelineEvent(claimId, {
    Event_Type: 'Ownership Updated',
    Summary: ownershipArea,
    Detail: ownershipRecord.Notes || ownershipRecord.Trigger_Event,
    Source_System: ownershipRecord.Source_System,
    Source_Record_ID: ownershipRecord.Source_Record_ID,
    Actor: primaryOwner || 'System',
    Related_Workflow: 'Ownership Management',
    Is_Meaningful_Activity: true
  });

  writeServiceLog('setOwnership', 'Success', 'Ownership updated.', {
    claimId: claimId,
    sourceSystem: ownershipRecord.Source_System,
    sourceRecordId: ownershipRecord.Source_Record_ID,
    ownershipRecordId: ownershipRecord.Ownership_Record_ID,
    ownershipArea: ownershipArea,
    primaryOwner: primaryOwner || '',
    appendResult: appendResult
  });

  return successResponse({
    ownership: ownershipRecord,
    appendResult: appendResult,
    changed: true
  }, 'Ownership updated successfully.');
}

function getCurrentOwnership(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.ownershipHistory, {
    Claim_ID: claimId
  });

  const activeRows = rows.filter(function(row) {
    return !row.Ended_At;
  });

  if (activeRows.length === 0) {
    return successResponse({
      claimId: claimId,
      currentOwnership: null
    }, 'No current ownership record found.');
  }

  activeRows.sort(function(a, b) {
    const aDate = new Date(a.Started_At || 0).getTime();
    const bDate = new Date(b.Started_At || 0).getTime();
    return bDate - aDate;
  });

  return successResponse({
    claimId: claimId,
    currentOwnership: activeRows[0]
  }, 'Current ownership retrieved.');
}

function getOwnershipHistory(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.ownershipHistory, {
    Claim_ID: claimId
  });

  rows.sort(function(a, b) {
    const aDate = new Date(a.Started_At || 0).getTime();
    const bDate = new Date(b.Started_At || 0).getTime();
    return bDate - aDate;
  });

  return successResponse({
    claimId: claimId,
    ownershipHistory: rows,
    count: rows.length
  }, 'Ownership history retrieved.');
}

function testSetOwnership() {
  return setOwnership('CLM-20260605-821496', 'Field Operations', 'Blake', {
    Trigger_Event: 'OwnershipService test transfer.',
    Source_System: 'claims-service test',
    Source_Record_ID: 'TEST-OWNERSHIP-001',
    Notes: 'Test ownership transfer during Phase 4 Claim Foundation build.'
  });
}

function testGetCurrentOwnership() {
  return getCurrentOwnership('CLM-20260605-821496');
}

function testGetOwnershipHistory() {
  return getOwnershipHistory('CLM-20260605-821496');
}