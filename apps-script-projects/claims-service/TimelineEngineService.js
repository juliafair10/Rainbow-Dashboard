

/**
 * TimelineEngineService
 * Rainbow Phase 5 - Timeline Engine
 *
 * Interprets, classifies, groups, and prepares stored timeline events.
 * TimelineService stores rows. TimelineEngineService decides meaning.
 *
 * Important Apps Script note:
 * Function names are global across files. Do not reuse TimelineService's
 * normalizeTimelineEvent_ helper name here.
 */

const TIMELINE_ENGINE = {
  visibility: {
    primary: 'primary',
    secondary: 'secondary',
    system: 'system',
    hidden: 'hidden'
  },
  priority: {
    critical: 'critical',
    high: 'high',
    normal: 'normal',
    low: 'low',
    hidden: 'hidden'
  }
};

function normalizeTimelineEngineEvent_(event) {
  const sourceEvent = event || {};

  return {
    Timeline_Event_ID: sourceEvent.Timeline_Event_ID || sourceEvent.timelineEventId || sourceEvent['Event ID'] || '',
    Claim_ID: sourceEvent.Claim_ID || sourceEvent.claimId || sourceEvent['Claim ID'] || '',
    Event_Date: sourceEvent.Event_Date || sourceEvent.eventDate || sourceEvent.Date || sourceEvent.date || sourceEvent.Created_At || nowIso(),
    Event_Category: normalizeString(sourceEvent.Event_Category || sourceEvent.eventCategory || ''),
    Event_Type: normalizeString(sourceEvent.Event_Type || sourceEvent.eventType || sourceEvent['Event Type'] || 'Claim Updated'),
    Event_Source: normalizeString(sourceEvent.Event_Source || sourceEvent.eventSource || sourceEvent.Source || sourceEvent.source || ''),
    Source_Record_ID: normalizeString(sourceEvent.Source_Record_ID || sourceEvent.sourceRecordId || sourceEvent['Event ID'] || ''),
    Source_Run_ID: normalizeString(sourceEvent.Source_Run_ID || sourceEvent.sourceRunId || ''),
    Source_System: normalizeString(sourceEvent.Source_System || sourceEvent.sourceSystem || sourceEvent.Source || sourceEvent.source || ''),
    Summary: normalizeString(sourceEvent.Summary || sourceEvent.summary || ''),
    Detail: normalizeString(sourceEvent.Detail || sourceEvent.detail || sourceEvent.Details || sourceEvent.details || ''),
    Actor: normalizeString(sourceEvent.Actor || sourceEvent.actor || ''),
    Related_Workflow: normalizeString(sourceEvent.Related_Workflow || sourceEvent.relatedWorkflow || ''),
    Related_Financial_Track_ID: normalizeString(sourceEvent.Related_Financial_Track_ID || sourceEvent.relatedFinancialTrackId || ''),
    Owner_Area: normalizeString(sourceEvent.Owner_Area || sourceEvent.ownerArea || ''),
    Related_Condition_ID: normalizeString(sourceEvent.Related_Condition_ID || sourceEvent.relatedConditionId || ''),
    Related_Alert_ID: normalizeString(sourceEvent.Related_Alert_ID || sourceEvent.relatedAlertId || ''),
    Related_EOJ_ID: normalizeString(sourceEvent.Related_EOJ_ID || sourceEvent.relatedEojId || ''),
    Related_External_Link_ID: normalizeString(sourceEvent.Related_External_Link_ID || sourceEvent.relatedExternalLinkId || ''),
    Is_Meaningful_Activity: sourceEvent.Is_Meaningful_Activity,
    Meaningful_Activity_Type: normalizeString(sourceEvent.Meaningful_Activity_Type || sourceEvent.meaningfulActivityType || ''),
    Updates_Last_Activity: sourceEvent.Updates_Last_Activity,
    Display_Priority: normalizeString(sourceEvent.Display_Priority || sourceEvent.displayPriority || ''),
    Visibility: normalizeString(sourceEvent.Visibility || sourceEvent.visibility || ''),
    Group_ID: normalizeString(sourceEvent.Group_ID || sourceEvent.groupId || ''),
    Group_Label: normalizeString(sourceEvent.Group_Label || sourceEvent.groupLabel || ''),
    Parent_Event_ID: normalizeString(sourceEvent.Parent_Event_ID || sourceEvent.parentEventId || ''),
    Is_Group_Parent: sourceEvent.Is_Group_Parent,
    Noise_Reason: normalizeString(sourceEvent.Noise_Reason || sourceEvent.noiseReason || ''),
    Created_At: sourceEvent.Created_At || nowIso(),
    Created_By: normalizeString(sourceEvent.Created_By || sourceEvent.createdBy || 'TimelineEngineService')
  };
}

function classifyTimelineEngineEvent_(event) {
  const normalizedEvent = normalizeTimelineEngineEvent_(event);
  const ruleEnhancedEvent = applyTimelineRuleToEvent_(normalizedEvent);

  ruleEnhancedEvent.Event_Category = ruleEnhancedEvent.Event_Category || getTimelineEventCategory_(ruleEnhancedEvent);
  ruleEnhancedEvent.Is_Meaningful_Activity = isMeaningfulTimelineActivity_(ruleEnhancedEvent);
  ruleEnhancedEvent.Updates_Last_Activity = shouldTimelineEventUpdateLastActivity_(ruleEnhancedEvent);
  ruleEnhancedEvent.Display_Priority = getTimelineDisplayPriority_(ruleEnhancedEvent);
  ruleEnhancedEvent.Visibility = getTimelineVisibility_(ruleEnhancedEvent);
  ruleEnhancedEvent.Meaningful_Activity_Type = ruleEnhancedEvent.Is_Meaningful_Activity
    ? ruleEnhancedEvent.Event_Type
    : '';
  ruleEnhancedEvent.Noise_Reason = ruleEnhancedEvent.Is_Meaningful_Activity
    ? ''
    : getTimelineNoiseReason_(ruleEnhancedEvent);
  ruleEnhancedEvent.Group_ID = ruleEnhancedEvent.Group_ID || getTimelineGroupingKey_(ruleEnhancedEvent);
  ruleEnhancedEvent.Group_Label = ruleEnhancedEvent.Group_Label || summarizeTimelineEvent_(ruleEnhancedEvent);

  return ruleEnhancedEvent;
}

function applyTimelineEventRules_(event) {
  return classifyTimelineEngineEvent_(event);
}

function getTimelineEventCategory_(event) {
  const eventType = normalizeString(event.Event_Type || '').toUpperCase();
  const relatedWorkflow = normalizeString(event.Related_Workflow || '').toUpperCase();
  const sourceSystem = normalizeString(event.Source_System || '').toUpperCase();

  if (
    eventType.indexOf('INTAKE') !== -1 ||
    eventType.indexOf('CLAIM_CREATED') !== -1 ||
    eventType.indexOf('CLAIM FOLDER') !== -1 ||
    eventType === 'INTAKE CREATED'
  ) {
    return 'Intake';
  }

  if (eventType.indexOf('EOJ') !== -1 || sourceSystem.indexOf('EOJ') !== -1) {
    return 'EOJ';
  }

  if (eventType.indexOf('MONITORING') !== -1) {
    return 'Monitoring';
  }

  if (eventType.indexOf('ASBESTOS') !== -1 || relatedWorkflow.indexOf('ASBESTOS') !== -1) {
    return 'Asbestos';
  }

  if (eventType.indexOf('ITEL') !== -1 || relatedWorkflow.indexOf('ITEL') !== -1) {
    return 'Itel';
  }

  if (eventType.indexOf('CONDITION') !== -1 || event.Related_Condition_ID) {
    return 'Condition';
  }

  if (eventType.indexOf('ALERT') !== -1 || event.Related_Alert_ID) {
    return 'Alert';
  }

  if (eventType.indexOf('OWNERSHIP') !== -1 || eventType.indexOf('OWNER') !== -1) {
    return 'Ownership';
  }

  if (eventType.indexOf('FINANCIAL') !== -1 || event.Related_Financial_Track_ID) {
    return 'Financial Track';
  }

  if (eventType.indexOf('REVISION') !== -1) {
    return 'Revision';
  }

  if (eventType.indexOf('PAYMENT') !== -1 || eventType.indexOf('REMITTANCE') !== -1) {
    return 'Payment';
  }

  if (eventType.indexOf('LINK') !== -1 || event.Related_External_Link_ID) {
    return 'External Link';
  }

  if (eventType.indexOf('DOCUMENT') !== -1 || eventType.indexOf('PHOTO') !== -1 || eventType.indexOf('ATTACHMENT') !== -1) {
    return 'Document';
  }

  if (eventType.indexOf('CONTACT') !== -1 || eventType.indexOf('RESPONSE') !== -1 || eventType.indexOf('NOTE') !== -1) {
    return 'Communication';
  }

  if (eventType.indexOf('REVIEW') !== -1) {
    return 'Review';
  }

  if (eventType.indexOf('SYSTEM') !== -1 || eventType.indexOf('SYNC') !== -1 || eventType.indexOf('DIAGNOSTIC') !== -1 || eventType.indexOf('TEST') !== -1) {
    return 'System';
  }

  return 'General';
}

function isMeaningfulTimelineActivity_(event) {
  if (!event) {
    return false;
  }

  if (event.Is_Meaningful_Activity === true || event.Is_Meaningful_Activity === 'TRUE') {
    return true;
  }

  if (event.Is_Meaningful_Activity === false || event.Is_Meaningful_Activity === 'FALSE') {
    return false;
  }

  const eventType = normalizeString(event.Event_Type || '').toUpperCase();
  const meaningfulTypes = [
    'CLAIM_CREATED',
    'CLAIM UPDATED',
    'CLAIM_UPDATED',
    'INTAKE CREATED',
    'INTAKE_CREATED',
    'INTAKE_PROCESSED',
    'CLAIM FOLDER CREATED',
    'CLAIM_FOLDER_CREATED',
    'CLAIM FOLDER MATCHED',
    'CLAIM_FOLDER_MATCHED',
    'INSPECTION COMPLETED',
    'INSPECTION_COMPLETED',
    'DEMO COMPLETED',
    'DEMO_COMPLETED',
    'FIELD_WORK_COMPLETED',
    'EOJ SUBMITTED',
    'EOJ_SUBMITTED',
    'EOJ_PROCESSED',
    'MONITORING VISIT COMPLETED',
    'MONITORING_VISIT_RECORDED',
    'MONITORING_COMPLETED',
    'CONDITION_ADDED',
    'CONDITION_RESOLVED',
    'ALERT_RESOLVED',
    'OWNERSHIP_TRANSFERRED',
    'FINANCIAL_TRACK_CREATED',
    'FINANCIAL_TRACK_APPROVED',
    'FINANCIAL_TRACK_CLOSED',
    'REVISION REQUESTED',
    'REVISION_REQUESTED',
    'REVISION SUBMITTED',
    'REVISION_SUBMITTED',
    'REVISION_RESPONSE_RECEIVED',
    'REVISION_APPROVED',
    'REVISION_CLOSED',
    'PAYMENT RECEIVED',
    'PAYMENT_RECEIVED',
    'PAYMENT_POSTED',
    'EXTERNAL_LINK_ADDED',
    'DOCUMENT_ADDED',
    'ATTACHMENT_ROUTED',
    'CARRIER RESPONSE',
    'CUSTOMER CONTACTED',
    'CUSTOMER_CONTACTED',
    'CARRIER_CONTACTED',
    'VENDOR_CONTACTED',
    'HISTORICAL NOTE'
  ];

  return meaningfulTypes.indexOf(eventType) !== -1;
}

function shouldTimelineEventUpdateLastActivity_(event) {
  if (!event) {
    return false;
  }

  if (event.Updates_Last_Activity === true || event.Updates_Last_Activity === 'TRUE') {
    return true;
  }

  if (event.Updates_Last_Activity === false || event.Updates_Last_Activity === 'FALSE') {
    return false;
  }

  return isMeaningfulTimelineActivity_(event);
}

function getTimelineDisplayPriority_(event) {
  if (!event) {
    return TIMELINE_ENGINE.priority.normal;
  }

  if (event.Display_Priority) {
    return event.Display_Priority;
  }

  const category = normalizeString(event.Event_Category || getTimelineEventCategory_(event));
  const eventType = normalizeString(event.Event_Type || '').toUpperCase();

  if (eventType.indexOf('ERROR') !== -1 || eventType.indexOf('CRITICAL') !== -1) {
    return TIMELINE_ENGINE.priority.critical;
  }

  if (['EOJ', 'Field Work', 'Monitoring', 'Revision', 'Payment'].indexOf(category) !== -1) {
    return TIMELINE_ENGINE.priority.high;
  }

  if (eventType === 'HISTORICAL NOTE') {
    return TIMELINE_ENGINE.priority.normal;
  }

  if (['Condition', 'Alert', 'Ownership', 'Financial Track', 'Intake'].indexOf(category) !== -1) {
    return TIMELINE_ENGINE.priority.normal;
  }

  if (category === 'System') {
    return TIMELINE_ENGINE.priority.low;
  }

  return TIMELINE_ENGINE.priority.normal;
}

function getTimelineVisibility_(event) {
  if (!event) {
    return TIMELINE_ENGINE.visibility.secondary;
  }

  if (event.Visibility) {
    return event.Visibility;
  }

  const category = normalizeString(event.Event_Category || getTimelineEventCategory_(event));
  const eventType = normalizeString(event.Event_Type || '').toUpperCase();

  if (eventType.indexOf('DIAGNOSTIC') !== -1 || eventType.indexOf('TEST') !== -1) {
    return TIMELINE_ENGINE.visibility.hidden;
  }

  if (category === 'System') {
    return TIMELINE_ENGINE.visibility.system;
  }

  if (normalizeString(event.Event_Type || '').toUpperCase() === 'HISTORICAL NOTE') {
    return TIMELINE_ENGINE.visibility.primary;
  }

  if (isMeaningfulTimelineActivity_(event)) {
    return TIMELINE_ENGINE.visibility.primary;
  }

  return TIMELINE_ENGINE.visibility.secondary;
}

function getTimelineGroupingKey_(event) {
  if (!event) {
    return '';
  }

  if (event.Group_ID) {
    return event.Group_ID;
  }

  const claimId = normalizeString(event.Claim_ID || 'NO_CLAIM');
  const sourceRunId = normalizeString(event.Source_Run_ID || 'NO_RUN');
  const sourceSystem = normalizeString(event.Source_System || event.Event_Source || 'NO_SOURCE');
  const category = normalizeString(event.Event_Category || getTimelineEventCategory_(event));
  const dateKey = formatTimelineDateKey_(event.Event_Date || event.Created_At || nowIso());

  if (sourceRunId !== 'NO_RUN') {
    return [claimId, sourceRunId, category].join('|');
  }

  return [claimId, sourceSystem, category, dateKey].join('|');
}

function groupTimelineEvents_(events) {
  const sourceEvents = Array.isArray(events) ? events : [];
  const groups = {};

  sourceEvents.forEach(function(event) {
    const classifiedEvent = classifyTimelineEngineEvent_(event);
    const groupId = classifiedEvent.Group_ID || getTimelineGroupingKey_(classifiedEvent);

    if (!groups[groupId]) {
      groups[groupId] = {
        groupId: groupId,
        groupLabel: classifiedEvent.Group_Label || summarizeTimelineEvent_(classifiedEvent),
        eventCategory: classifiedEvent.Event_Category,
        displayPriority: classifiedEvent.Display_Priority,
        events: []
      };
    }

    groups[groupId].events.push(classifiedEvent);
  });

  return Object.keys(groups).map(function(groupId) {
    return groups[groupId];
  });
}

function summarizeTimelineEvent_(event) {
  if (!event) {
    return '';
  }

  if (event.Summary) {
    return event.Summary;
  }

  const category = normalizeString(event.Event_Category || getTimelineEventCategory_(event));
  const eventType = normalizeString(event.Event_Type || 'Timeline Event');

  return category + ': ' + eventType;
}

function getTimelineNoiseReason_(event) {
  if (!event) {
    return 'No event provided.';
  }

  const eventType = normalizeString(event.Event_Type || '').toUpperCase();

  if (eventType.indexOf('DIAGNOSTIC') !== -1) {
    return 'Diagnostic event.';
  }

  if (eventType.indexOf('TEST') !== -1) {
    return 'Test event.';
  }

  if (eventType.indexOf('SYNC') !== -1) {
    return 'System sync without confirmed operational change.';
  }

  if (eventType.indexOf('RETRY') !== -1) {
    return 'Technical retry without confirmed operational change.';
  }

  return 'Does not meet meaningful activity rules.';
}

function deriveLastMeaningfulActivityForClaim_(claimId) {
  if (!claimId) {
    return null;
  }

  const timelineRows = getTimelineEngineRowsForClaim_(claimId);

  const meaningfulEvents = timelineRows
    .filter(function(event) {
      return !!event._Timeline_Source_Date;
    })
    .map(function(event) {
      const classified = classifyTimelineEngineEvent_(event);
      classified._Timeline_Source_Date = event._Timeline_Source_Date;
      return classified;
    })
    .filter(function(event) {
      return shouldTimelineEventUpdateLastActivity_(event);
    });

  meaningfulEvents.sort(function(a, b) {
    const aDate = normalizeTimelineEngineDate_(a._Timeline_Source_Date).getTime();
    const bDate = normalizeTimelineEngineDate_(b._Timeline_Source_Date).getTime();
    return bDate - aDate;
  });

  meaningfulEvents.forEach(function(event) {
    event.Event_Date = event._Timeline_Source_Date;
  });

  return meaningfulEvents.length > 0 ? meaningfulEvents[0] : null;
}

function getTimelineEngineRowsForClaim_(claimId) {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CLAIM_SHEET_NAMES.timeline || 'Timeline_Events');

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });

  const claimIdIndex = headers.indexOf('Claim ID');
  const legacyClaimIdIndex = headers.indexOf('Claim_ID');
  const jobNumberIndex = headers.indexOf('Job Number');
  const dateIndex = headers.indexOf('Date');
  const legacyDateIndex = headers.indexOf('Event_Date');
  const eventIdIndex = headers.indexOf('Event ID');
  const eventTypeIndex = headers.indexOf('Event Type');
  const sourceIndex = headers.indexOf('Source');
  const actorIndex = headers.indexOf('Actor');
  const summaryIndex = headers.indexOf('Summary');
  const detailsIndex = headers.indexOf('Details');
  const visibilityIndex = headers.indexOf('Visibility');

  return values.slice(1).filter(function(row) {
    const rowClaimId = claimIdIndex >= 0 ? String(row[claimIdIndex] || '').trim() : '';
    const legacyClaimId = legacyClaimIdIndex >= 0 ? String(row[legacyClaimIdIndex] || '').trim() : '';
    return rowClaimId === claimId || legacyClaimId === claimId;
  }).map(function(row) {
    const rawEventDate = dateIndex >= 0 ? row[dateIndex] : (legacyDateIndex >= 0 ? row[legacyDateIndex] : '');

    return {
      Timeline_Event_ID: eventIdIndex >= 0 ? row[eventIdIndex] : '',
      Claim_ID: claimId,
      Job_Number: jobNumberIndex >= 0 ? row[jobNumberIndex] : '',
      Event_Date: rawEventDate,
      _Timeline_Source_Date: rawEventDate,
      Event_Type: eventTypeIndex >= 0 ? row[eventTypeIndex] : '',
      Event_Source: sourceIndex >= 0 ? row[sourceIndex] : '',
      Source_System: sourceIndex >= 0 ? row[sourceIndex] : '',
      Source_Record_ID: eventIdIndex >= 0 ? row[eventIdIndex] : '',
      Summary: summaryIndex >= 0 ? row[summaryIndex] : '',
      Detail: detailsIndex >= 0 ? row[detailsIndex] : '',
      Actor: actorIndex >= 0 ? row[actorIndex] : '',
      Visibility: visibilityIndex >= 0 ? row[visibilityIndex] : ''
    };
  });
}

function normalizeTimelineEngineDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  if (!value) {
    return new Date(0);
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(0);
}


function rebuildTimelineDerivedFieldsForClaim_(claimId) {
  const lastMeaningfulActivity = deriveLastMeaningfulActivityForClaim_(claimId);

  if (!lastMeaningfulActivity) {
    return successResponse({
      claimId: claimId,
      lastMeaningfulActivity: null
    }, 'No meaningful timeline activity found for claim.');
  }

  ensureTimelineEngineClaimsColumn_('Last_Meaningful_Activity_At');
  return updateClaim(claimId, {
    Last_Meaningful_Activity_At: lastMeaningfulActivity.Event_Date
  });
}


function bulkRebuildTimelineDerivedFieldsForActiveClaims() {
  const startedAt = new Date();
  const spreadsheet = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
  const claimsSheet = spreadsheet.getSheetByName(CLAIM_SHEET_NAMES.claims || 'Claims');
  const timelineSheet = spreadsheet.getSheetByName(CLAIM_SHEET_NAMES.timeline || 'Timeline_Events');

  if (!claimsSheet) {
    return errorResponse('Claims sheet not found.', {
      sheetName: CLAIM_SHEET_NAMES.claims || 'Claims'
    });
  }

  if (!timelineSheet) {
    return errorResponse('Timeline sheet not found.', {
      sheetName: CLAIM_SHEET_NAMES.timeline || 'Timeline_Events'
    });
  }

  ensureTimelineEngineClaimsColumn_('Last_Meaningful_Activity_At');

  const claimsValues = claimsSheet.getDataRange().getValues();
  if (claimsValues.length < 2) {
    return successResponse({
      activeClaimCount: 0,
      updatedCount: 0,
      timelineRowsProcessed: 0,
      elapsedMs: new Date().getTime() - startedAt.getTime()
    }, 'No claim rows found for bulk timeline rebuild.');
  }

  const claimsHeaders = claimsSheet.getRange(1, 1, 1, claimsSheet.getLastColumn()).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });

  const claimIdIndex = getTimelineEngineHeaderIndex_(claimsHeaders, ['Claim_ID', 'Claim ID']);
  const lifecycleIndex = getTimelineEngineHeaderIndex_(claimsHeaders, ['Lifecycle_State', 'Lifecycle State']);
  const lastMeaningfulIndex = getTimelineEngineHeaderIndex_(claimsHeaders, [
    'Last_Meaningful_Activity_At',
    'Last Meaningful Activity At'
  ]);

  if (claimIdIndex === -1 || lastMeaningfulIndex === -1) {
    return errorResponse('Required Claims columns not found for bulk timeline rebuild.', {
      claimIdColumnFound: claimIdIndex !== -1,
      lastMeaningfulColumnFound: lastMeaningfulIndex !== -1,
      headers: claimsHeaders
    });
  }

  const activeClaimLookup = {};
  const activeClaimRows = [];

  for (var claimRowIndex = 1; claimRowIndex < claimsValues.length; claimRowIndex++) {
    const claimId = String(claimsValues[claimRowIndex][claimIdIndex] || '').trim();
    const lifecycleState = lifecycleIndex >= 0 ? String(claimsValues[claimRowIndex][lifecycleIndex] || '').trim() : '';

    if (!claimId || isTimelineEngineTerminalLifecycle_(lifecycleState)) {
      continue;
    }

    activeClaimLookup[claimId] = true;
    activeClaimRows.push({
      claimId: claimId,
      sheetRowNumber: claimRowIndex + 1,
      valuesIndex: claimRowIndex
    });
  }

  const latestMeaningfulByClaim = {};
  Object.keys(activeClaimLookup).forEach(function(claimId) {
    latestMeaningfulByClaim[claimId] = null;
  });

  const timelineValues = timelineSheet.getDataRange().getValues();
  const timelineHeaders = timelineValues.length
    ? timelineValues[0].map(function(header) { return String(header || '').trim(); })
    : [];

  const timelineClaimIdIndex = timelineHeaders.indexOf('Claim ID');
  const timelineLegacyClaimIdIndex = timelineHeaders.indexOf('Claim_ID');
  const timelineDateIndex = timelineHeaders.indexOf('Date');
  const timelineLegacyDateIndex = timelineHeaders.indexOf('Event_Date');
  const timelineEventIdIndex = timelineHeaders.indexOf('Event ID');
  const timelineEventTypeIndex = timelineHeaders.indexOf('Event Type');
  const timelineSourceIndex = timelineHeaders.indexOf('Source');
  const timelineActorIndex = timelineHeaders.indexOf('Actor');
  const timelineSummaryIndex = timelineHeaders.indexOf('Summary');
  const timelineDetailsIndex = timelineHeaders.indexOf('Details');
  const timelineVisibilityIndex = timelineHeaders.indexOf('Visibility');
  const timelineJobNumberIndex = timelineHeaders.indexOf('Job Number');

  for (var timelineRowIndex = 1; timelineRowIndex < timelineValues.length; timelineRowIndex++) {
    const row = timelineValues[timelineRowIndex];
    const rowClaimId = timelineClaimIdIndex >= 0 ? String(row[timelineClaimIdIndex] || '').trim() : '';
    const legacyClaimId = timelineLegacyClaimIdIndex >= 0 ? String(row[timelineLegacyClaimIdIndex] || '').trim() : '';
    const matchedClaimId = activeClaimLookup[rowClaimId] ? rowClaimId : (activeClaimLookup[legacyClaimId] ? legacyClaimId : '');

    if (!matchedClaimId) {
      continue;
    }

    const rawEventDate = timelineDateIndex >= 0
      ? row[timelineDateIndex]
      : (timelineLegacyDateIndex >= 0 ? row[timelineLegacyDateIndex] : '');
    const eventDate = normalizeTimelineEngineDate_(rawEventDate);

    if (!eventDate || eventDate.getTime() === 0) {
      continue;
    }

    const rawEventType = timelineEventTypeIndex >= 0 ? row[timelineEventTypeIndex] : '';
    const rawSummary = timelineSummaryIndex >= 0 ? row[timelineSummaryIndex] : '';

    if (!isBulkTimelineMeaningfulActivity_(rawEventType)) {
      continue;
    }

    const existing = latestMeaningfulByClaim[matchedClaimId];
    if (!existing || eventDate.getTime() > existing.date.getTime()) {
      latestMeaningfulByClaim[matchedClaimId] = {
        date: eventDate,
        rawDate: rawEventDate,
        eventType: normalizeString(rawEventType || 'Timeline Event'),
        summary: normalizeString(rawSummary || '')
      };
    }
  }

  const lastMeaningfulValues = claimsSheet.getRange(2, lastMeaningfulIndex + 1, claimsValues.length - 1, 1).getValues();
  let updatedCount = 0;
  const sampleResults = [];

  activeClaimRows.forEach(function(claimRow) {
    const latest = latestMeaningfulByClaim[claimRow.claimId];

    if (!latest) {
      return;
    }

    const localColumnIndex = claimRow.valuesIndex - 1;
    const currentValue = lastMeaningfulValues[localColumnIndex][0];
    const nextValue = latest.rawDate instanceof Date ? latest.rawDate.toISOString() : latest.rawDate;

    if (String(currentValue || '') !== String(nextValue || '')) {
      lastMeaningfulValues[localColumnIndex][0] = nextValue;
      updatedCount++;
    }

    if (sampleResults.length < 10) {
      sampleResults.push({
        claimId: claimRow.claimId,
        lastMeaningfulActivityAt: nextValue,
        eventType: latest.eventType,
        summary: latest.summary
      });
    }
  });

  claimsSheet.getRange(2, lastMeaningfulIndex + 1, claimsValues.length - 1, 1).setValues(lastMeaningfulValues);

  return successResponse({
    activeClaimCount: activeClaimRows.length,
    updatedCount: updatedCount,
    timelineRowsProcessed: Math.max(timelineValues.length - 1, 0),
    elapsedMs: new Date().getTime() - startedAt.getTime(),
    sampleResults: sampleResults
  }, 'Timeline derived fields rebuilt in bulk for active claims.');
}

function isBulkTimelineMeaningfulActivity_(eventType) {
  const normalizedEventType = normalizeString(eventType || '').toUpperCase();

  if (!normalizedEventType) {
    return false;
  }

  const meaningfulTypes = {
    'CLAIM_CREATED': true,
    'CLAIM UPDATED': true,
    'CLAIM_UPDATED': true,
    'INTAKE CREATED': true,
    'INTAKE_CREATED': true,
    'INTAKE_PROCESSED': true,
    'CLAIM FOLDER CREATED': true,
    'CLAIM_FOLDER_CREATED': true,
    'CLAIM FOLDER MATCHED': true,
    'CLAIM_FOLDER_MATCHED': true,
    'INSPECTION COMPLETED': true,
    'INSPECTION_COMPLETED': true,
    'DEMO COMPLETED': true,
    'DEMO_COMPLETED': true,
    'FIELD_WORK_COMPLETED': true,
    'EOJ SUBMITTED': true,
    'EOJ_SUBMITTED': true,
    'EOJ_PROCESSED': true,
    'MONITORING VISIT COMPLETED': true,
    'MONITORING_VISIT_RECORDED': true,
    'MONITORING_COMPLETED': true,
    'CONDITION_ADDED': true,
    'CONDITION_RESOLVED': true,
    'ALERT_RESOLVED': true,
    'OWNERSHIP_TRANSFERRED': true,
    'FINANCIAL_TRACK_CREATED': true,
    'FINANCIAL_TRACK_APPROVED': true,
    'FINANCIAL_TRACK_CLOSED': true,
    'REVISION REQUESTED': true,
    'REVISION_REQUESTED': true,
    'REVISION SUBMITTED': true,
    'REVISION_SUBMITTED': true,
    'REVISION_RESPONSE_RECEIVED': true,
    'REVISION_APPROVED': true,
    'REVISION_CLOSED': true,
    'PAYMENT RECEIVED': true,
    'PAYMENT_RECEIVED': true,
    'PAYMENT_POSTED': true,
    'EXTERNAL_LINK_ADDED': true,
    'DOCUMENT_ADDED': true,
    'ATTACHMENT_ROUTED': true,
    'CARRIER RESPONSE': true,
    'CUSTOMER CONTACTED': true,
    'CUSTOMER_CONTACTED': true,
    'CARRIER_CONTACTED': true,
    'VENDOR_CONTACTED': true,
    'HISTORICAL NOTE': true
  };

  return !!meaningfulTypes[normalizedEventType];
}

function rebuildTimelineDerivedFieldsForActiveClaims(limit) {
  return bulkRebuildTimelineDerivedFieldsForActiveClaims();
}

function getTimelineEngineHeaderIndex_(headers, possibleNames) {
  for (var i = 0; i < possibleNames.length; i++) {
    var index = headers.indexOf(possibleNames[i]);
    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function isTimelineEngineTerminalLifecycle_(lifecycleState) {
  const normalized = normalizeString(lifecycleState || '').toUpperCase();
  return normalized === 'OPERATIONALLY COMPLETE' ||
    normalized === 'NOT SOLD' ||
    normalized === 'CLOSED';
}

function ensureTimelineEngineClaimsColumn_(columnName) {
  const spreadsheet = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(CLAIM_SHEET_NAMES.claims || 'Claims');

  if (!sheet) {
    throw new Error('Claims sheet not found.');
  }

  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });

  if (headers.indexOf(columnName) !== -1) {
    return {
      added: false,
      columnName: columnName,
      columnIndex: headers.indexOf(columnName) + 1
    };
  }

  sheet.getRange(1, lastColumn + 1).setValue(columnName);

  return {
    added: true,
    columnName: columnName,
    columnIndex: lastColumn + 1
  };
}

function prepareTimelineForClaimWorkspace_(claimId) {
  const timelineResult = getTimelineForClaim(claimId);
  if (!timelineResult.success) {
    return timelineResult;
  }

  const classifiedEvents = timelineResult.data.timeline.map(function(event) {
    return classifyTimelineEngineEvent_(event);
  });

  return successResponse({
    claimId: claimId,
    count: classifiedEvents.length,
    groups: groupTimelineEvents_(classifiedEvents),
    events: classifiedEvents
  }, 'Timeline prepared for future claim workspace use.');
}

function formatTimelineDateKey_(dateValue) {
  const date = new Date(dateValue || nowIso());
  if (isNaN(date.getTime())) {
    return 'NO_DATE';
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function testTimelineEngine_() {
  const event = classifyTimelineEngineEvent_({
    Claim_ID: 'TEST-CLAIM',
    Event_Type: 'EOJ Submitted',
    Event_Source: 'EOJ Processing Engine',
    Source_System: 'eoj-processing-engine',
    Summary: 'Technician submitted EOJ.',
    Actor: 'Blake'
  });

  Logger.log(JSON.stringify(event, null, 2));
  return event;
}

function testTimelineEngineWithSampleEvents_() {
  const sampleEvents = [
    {
      Claim_ID: 'TEST-CLAIM',
      Event_Type: 'Intake Created',
      Event_Source: 'Insurance Intake',
      Source_System: 'insurance-intake-automation',
      Summary: 'Claim created from insurance intake.'
    },
    {
      Claim_ID: 'TEST-CLAIM',
      Event_Type: 'EOJ Submitted',
      Event_Source: 'EOJ Processing Engine',
      Source_System: 'eoj-processing-engine',
      Summary: 'EOJ submitted by technician.'
    },
    {
      Claim_ID: 'TEST-CLAIM',
      Event_Type: 'System Diagnostic',
      Event_Source: 'claims-service',
      Source_System: 'claims-service',
      Summary: 'Diagnostic test event.'
    },
    {
      Claim_ID: 'TEST-CLAIM',
      Event_Type: 'Payment Received',
      Event_Source: 'Future Remittance Processing',
      Source_System: 'remittance-processing-automation',
      Summary: 'Payment received from carrier.'
    },
    {
      Claim_ID: 'TEST-CLAIM',
      Event_Type: 'Inspection Completed',
      Event_Source: 'EOJ Processing Engine',
      Source_System: 'eoj-processing-engine',
      Summary: 'Initial inspection completed by technician.'
    }
  ];

  const classifiedEvents = sampleEvents.map(function(event) {
    return classifyTimelineEngineEvent_(event);
  });

  Logger.log(JSON.stringify(classifiedEvents, null, 2));
  return classifiedEvents;
}

function testTimelineGrouping_() {
  const events = [
    {
      Claim_ID: 'TEST-CLAIM',
      Source_Run_ID: 'RUN-001',
      Event_Type: 'Intake Created',
      Event_Source: 'Insurance Intake',
      Source_System: 'insurance-intake-automation',
      Summary: 'Claim created.'
    },
    {
      Claim_ID: 'TEST-CLAIM',
      Source_Run_ID: 'RUN-001',
      Event_Type: 'Claim Folder Created',
      Event_Source: 'Insurance Intake',
      Source_System: 'insurance-intake-automation',
      Summary: 'Claim folder created.'
    }
  ];

  const groupedEvents = groupTimelineEvents_(events);
  Logger.log(JSON.stringify(groupedEvents, null, 2));
  return groupedEvents;
}

function testLastMeaningfulActivityDerivation_() {
  const lastMeaningfulActivity = deriveLastMeaningfulActivityForClaim_('CLM-26A-0034-WTR');
  Logger.log(JSON.stringify(lastMeaningfulActivity, null, 2));
  return lastMeaningfulActivity;
}

function testTimelineEngine() {
  return testTimelineEngine_();
}

function testTimelineEngineWithSampleEvents() {
  return testTimelineEngineWithSampleEvents_();
}

function testTimelineGrouping() {
  return testTimelineGrouping_();
}


function testLastMeaningfulActivityDerivation() {
  var result = testLastMeaningfulActivityDerivation_();
  Logger.log(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testRebuildTimelineDerivedFields() {
  var result = rebuildTimelineDerivedFieldsForClaim_('CLM-26A-0034-WTR');
  Logger.log(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testTimelineRuleDrivenFieldWork() {
  const event = classifyTimelineEngineEvent_({
    Claim_ID: 'TEST-CLAIM',
    Event_Type: 'Inspection Completed',
    Event_Source: 'EOJ Processing Engine',
    Source_System: 'eoj-processing-engine',
    Summary: 'Initial inspection completed by technician.'
  });

  Logger.log(JSON.stringify(event, null, 2));
  return event;
}

function testRebuildTimelineDerivedFieldsForActiveClaims() {
  var result = rebuildTimelineDerivedFieldsForActiveClaims();
  Logger.log(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testBulkRebuildTimelineDerivedFieldsForActiveClaims() {
  var result = bulkRebuildTimelineDerivedFieldsForActiveClaims();
  Logger.log(JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  return result;
}