/**
 * Timeline event storage for claims-service.
 * Rainbow Phase 4 - Claim Foundation
 * Phase 5 integration: TimelineEngineService classifies stored events.
 */

function appendTimelineEvent(claimId, event) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to append a timeline event.']);
  }

  const claimLookup = lookupClaim({ Claim_ID: claimId });
  if (!claimLookup.success) {
    return notFoundResponse('Cannot append timeline event because claim was not found.', {
      claimId: claimId
    });
  }

  const normalizedEvent = classifyTimelineEngineEvent_(normalizeTimelineEvent_(claimId, event || {}));
  const appendResult = appendRow(CLAIM_SHEET_NAMES.timeline, normalizedEvent);

  if (normalizedEvent.Updates_Last_Activity === true || normalizedEvent.Updates_Last_Activity === 'TRUE') {
    updateClaim(claimId, {
      Last_Meaningful_Activity_At: normalizedEvent.Event_Date
    });
  }

  writeServiceLog('appendTimelineEvent', 'Success', 'Timeline event appended.', {
    claimId: claimId,
    sourceSystem: normalizedEvent.Source_System,
    sourceRecordId: normalizedEvent.Source_Record_ID,
    timelineEventId: normalizedEvent.Timeline_Event_ID
  });

  return successResponse({
    timelineEvent: normalizedEvent,
    appendResult: appendResult
  }, 'Timeline event appended successfully.');
}

function appendTimelineEvents(claimId, events) {
  if (!Array.isArray(events)) {
    return validationErrorResponse(['events must be an array.']);
  }

  const results = events.map(function(event) {
    return appendTimelineEvent(claimId, event);
  });

  const failures = results.filter(function(result) {
    return !result.success;
  });

  if (failures.length > 0) {
    return errorResponse('One or more timeline events failed to append.', {
      results: results,
      failures: failures
    });
  }

  return successResponse({
    count: results.length,
    results: results
  }, 'Timeline events appended successfully.');
}

function getTimelineForClaim(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to retrieve timeline.']);
  }

  const rows = findRows(CLAIM_SHEET_NAMES.timeline, {
    Claim_ID: claimId
  });

  rows.sort(function(a, b) {
    const aDate = new Date(a.Event_Date || a.Created_At || 0).getTime();
    const bDate = new Date(b.Event_Date || b.Created_At || 0).getTime();
    return bDate - aDate;
  });

  return successResponse({
    claimId: claimId,
    timeline: rows,
    count: rows.length
  }, 'Timeline retrieved successfully.');
}

function isMeaningfulActivity(event) {
  if (!event) {
    return false;
  }

  if (event.Is_Meaningful_Activity === true || event.Is_Meaningful_Activity === 'TRUE') {
    return true;
  }

  const meaningfulTypes = [
    'Intake Created',
    'EOJ Submitted',
    'Inspection Completed',
    'Monitoring Visit Completed',
    'Demo Completed',
    'Carrier Response',
    'Revision Submitted',
    'Payment Received',
    'Claim Updated'
  ];

  return meaningfulTypes.indexOf(event.Event_Type) !== -1;
}

function normalizeTimelineEvent_(claimId, event) {
  const now = nowIso();
  const eventType = normalizeString(event.Event_Type || event.eventType || 'Claim Updated');
  const eventSource = normalizeString(event.Event_Source || event.eventSource || event.Source_System || event.sourceSystem || CLAIM_SERVICE.name);
  const sourceSystem = normalizeString(event.Source_System || event.sourceSystem || eventSource || CLAIM_SERVICE.name);

  const normalizedEvent = {
    Timeline_Event_ID: event.Timeline_Event_ID || event.timelineEventId || generateId(CLAIM_ID_PREFIXES.timelineEvent),
    Claim_ID: claimId,
    Event_Date: event.Event_Date || event.eventDate || now,
    Event_Type: eventType,
    Event_Source: eventSource,
    Source_Record_ID: normalizeString(event.Source_Record_ID || event.sourceRecordId || ''),
    Source_System: sourceSystem,
    Summary: normalizeString(event.Summary || event.summary || ''),
    Detail: normalizeString(event.Detail || event.detail || ''),
    Actor: normalizeString(event.Actor || event.actor || ''),
    Related_Workflow: normalizeString(event.Related_Workflow || event.relatedWorkflow || ''),
    Related_Financial_Track_ID: normalizeString(event.Related_Financial_Track_ID || event.relatedFinancialTrackId || ''),
    Event_Category: normalizeString(event.Event_Category || event.eventCategory || ''),
    Source_Run_ID: normalizeString(event.Source_Run_ID || event.sourceRunId || ''),
    Owner_Area: normalizeString(event.Owner_Area || event.ownerArea || ''),
    Related_Condition_ID: normalizeString(event.Related_Condition_ID || event.relatedConditionId || ''),
    Related_Alert_ID: normalizeString(event.Related_Alert_ID || event.relatedAlertId || ''),
    Related_EOJ_ID: normalizeString(event.Related_EOJ_ID || event.relatedEojId || ''),
    Related_External_Link_ID: normalizeString(event.Related_External_Link_ID || event.relatedExternalLinkId || ''),
    Is_Meaningful_Activity: event.Is_Meaningful_Activity !== undefined
      ? event.Is_Meaningful_Activity
      : isMeaningfulActivity({ Event_Type: eventType }),
    Meaningful_Activity_Type: normalizeString(event.Meaningful_Activity_Type || event.meaningfulActivityType || ''),
    Updates_Last_Activity: event.Updates_Last_Activity !== undefined ? event.Updates_Last_Activity : '',
    Display_Priority: normalizeString(event.Display_Priority || event.displayPriority || ''),
    Visibility: normalizeString(event.Visibility || event.visibility || ''),
    Group_ID: normalizeString(event.Group_ID || event.groupId || ''),
    Group_Label: normalizeString(event.Group_Label || event.groupLabel || ''),
    Parent_Event_ID: normalizeString(event.Parent_Event_ID || event.parentEventId || ''),
    Is_Group_Parent: event.Is_Group_Parent !== undefined ? event.Is_Group_Parent : '',
    Noise_Reason: normalizeString(event.Noise_Reason || event.noiseReason || ''),
    Created_At: now,
    Created_By: normalizeString(event.Created_By || event.createdBy || 'TimelineService')
  };

  if (!normalizedEvent.Summary) {
    normalizedEvent.Summary = eventType;
  }

  return normalizedEvent;
}

function testAppendTimelineEvent() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    return claimLookup;
  }

  return appendTimelineEvent(claimLookup.data.claim.Claim_ID, {
    Event_Type: 'Intake Created',
    Event_Source: 'claims-service test',
    Source_System: 'claims-service test',
    Source_Record_ID: 'TEST-TIMELINE-001',
    Summary: 'Test intake timeline event created.',
    Detail: 'This verifies TimelineService can attach events to an existing claim.',
    Actor: 'System',
    Related_Workflow: 'Claim Foundation Test',
    Is_Meaningful_Activity: true
  });
}

function testGetTimelineForClaim() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = getTimelineForClaim(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}