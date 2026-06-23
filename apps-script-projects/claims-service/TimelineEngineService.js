

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

function rebuildTimelineDerivedFieldsForActiveClaims(limit) {
  ensureTimelineEngineClaimsColumn_('Last_Meaningful_Activity_At');

  const claims = ClaimsQueryService.getAllClaimSummaries({ includeTerminal: false }) || [];
  const maxClaims = limit || claims.length;
  const results = [];
  let rebuiltCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  claims.slice(0, maxClaims).forEach(function(claim) {
    const claimId = claim.claimId || claim.Claim_ID || '';

    if (!claimId) {
      skippedCount++;
      return;
    }

    try {
      const rebuildResult = rebuildTimelineDerivedFieldsForClaim_(claimId);
      const success = !!(rebuildResult && rebuildResult.success);

      if (success) {
        rebuiltCount++;
      } else {
        failedCount++;
      }

      results.push({
        claimId: claimId,
        success: success,
        message: rebuildResult && rebuildResult.message ? rebuildResult.message : '',
        lastMeaningfulActivityAt: rebuildResult && rebuildResult.data && rebuildResult.data.row
          ? rebuildResult.data.row.Last_Meaningful_Activity_At || ''
          : ''
      });
    } catch (error) {
      failedCount++;
      results.push({
        claimId: claimId,
        success: false,
        message: error && error.message ? error.message : String(error)
      });
    }
  });

  return successResponse({
    totalActiveClaims: claims.length,
    processedClaims: Math.min(maxClaims, claims.length),
    rebuiltCount: rebuiltCount,
    skippedCount: skippedCount,
    failedCount: failedCount,
    sampleResults: results.slice(0, 10)
  }, 'Timeline derived fields rebuilt for active claims.');
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