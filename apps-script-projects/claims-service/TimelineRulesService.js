

/**
 * TimelineRulesService
 * Rainbow Phase 5 - Timeline Engine Rules
 *
 * Owns Timeline_Event_Rules sheet creation, seeding, loading, and matching.
 * TimelineEngineService uses these rules to classify events before storage/display.
 */

const TIMELINE_RULES_SHEET_NAME = 'Timeline_Event_Rules';

const TIMELINE_RULE_COLUMNS = [
  'Rule_ID',
  'Is_Active',
  'Event_Type_Pattern',
  'Event_Category',
  'Is_Meaningful_Activity',
  'Updates_Last_Activity',
  'Display_Priority',
  'Visibility',
  'Grouping_Category',
  'Noise_Reason',
  'Notes',
  'Created_At',
  'Updated_At'
];

function ensureTimelineEventRulesSheet() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(TIMELINE_RULES_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(TIMELINE_RULES_SHEET_NAME);
  }

  const existingLastColumn = sheet.getLastColumn();
  const existingHeaders = existingLastColumn > 0
    ? sheet.getRange(1, 1, 1, existingLastColumn).getValues()[0]
    : [];

  if (existingHeaders.length === 0 || existingHeaders.join('').trim() === '') {
    sheet.getRange(1, 1, 1, TIMELINE_RULE_COLUMNS.length).setValues([TIMELINE_RULE_COLUMNS]);
  } else {
    const missingColumns = TIMELINE_RULE_COLUMNS.filter(function(columnName) {
      return existingHeaders.indexOf(columnName) === -1;
    });

    if (missingColumns.length > 0) {
      sheet.getRange(1, existingLastColumn + 1, 1, missingColumns.length).setValues([missingColumns]);
    }
  }

  return successResponse({
    sheetName: TIMELINE_RULES_SHEET_NAME,
    columns: TIMELINE_RULE_COLUMNS
  }, 'Timeline event rules sheet is ready.');
}

function seedTimelineEventRules() {
  ensureTimelineEventRulesSheet();

  const existingRules = loadTimelineRules_();
  const existingPatterns = existingRules.map(function(rule) {
    return normalizeString(rule.Event_Type_Pattern || '').toUpperCase();
  });

  const now = nowIso();
  const seedRules = getTimelineEventSeedRules_(now).filter(function(rule) {
    return existingPatterns.indexOf(normalizeString(rule.Event_Type_Pattern || '').toUpperCase()) === -1;
  });

  if (seedRules.length === 0) {
    return successResponse({
      addedCount: 0,
      existingCount: existingRules.length
    }, 'Timeline event rules already seeded.');
  }

  seedRules.forEach(function(rule) {
    appendRow(TIMELINE_RULES_SHEET_NAME, rule);
  });

  return successResponse({
    addedCount: seedRules.length,
    existingCount: existingRules.length,
    addedRules: seedRules
  }, 'Timeline event rules seeded successfully.');
}

function loadTimelineRules() {
  ensureTimelineEventRulesSheet();

  const rules = loadTimelineRules_();

  return successResponse({
    count: rules.length,
    rules: rules
  }, 'Timeline event rules loaded successfully.');
}

function loadTimelineRules_() {
  ensureTimelineEventRulesSheet();

  const rows = readTimelineRuleRows_();

  return rows.filter(function(rule) {
    return rule.Is_Active === true || rule.Is_Active === 'TRUE' || rule.Is_Active === 'true' || rule.Is_Active === 'Yes';
  });
}

function readTimelineRuleRows_() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TIMELINE_RULES_SHEET_NAME);

  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0];

  return values.slice(1).filter(function(row) {
    return row.join('').trim() !== '';
  }).map(function(row) {
    const record = {};

    headers.forEach(function(header, index) {
      if (header) {
        record[header] = row[index];
      }
    });

    return record;
  });
}

function findMatchingTimelineRule(event) {
  const rule = findMatchingTimelineRule_(event || {});

  if (!rule) {
    return successResponse({
      matched: false,
      rule: null
    }, 'No matching timeline rule found.');
  }

  return successResponse({
    matched: true,
    rule: rule
  }, 'Matching timeline rule found.');
}

function findMatchingTimelineRule_(event) {
  const eventType = normalizeString(event.Event_Type || event.eventType || '').toUpperCase();
  const sourceSystem = normalizeString(event.Source_System || event.sourceSystem || '').toUpperCase();
  const relatedWorkflow = normalizeString(event.Related_Workflow || event.relatedWorkflow || '').toUpperCase();
  const summary = normalizeString(event.Summary || event.summary || '').toUpperCase();

  const rules = loadTimelineRules_();

  const eventTypeMatch = findTimelineRuleByText_(rules, eventType);
  if (eventTypeMatch) {
    return eventTypeMatch;
  }

  const workflowMatch = findTimelineRuleByText_(rules, relatedWorkflow);
  if (workflowMatch) {
    return workflowMatch;
  }

  const summaryMatch = findTimelineRuleByText_(rules, summary);
  if (summaryMatch) {
    return summaryMatch;
  }

  const sourceSystemMatch = findTimelineRuleByText_(rules, sourceSystem);
  if (sourceSystemMatch) {
    return sourceSystemMatch;
  }

  return null;
}

function findTimelineRuleByText_(rules, text) {
  const searchText = normalizeString(text || '').toUpperCase();

  if (!searchText) {
    return null;
  }

  for (let i = 0; i < rules.length; i++) {
    const pattern = normalizeString(rules[i].Event_Type_Pattern || '').toUpperCase();

    if (pattern && searchText.indexOf(pattern) !== -1) {
      return rules[i];
    }
  }

  return null;
}

function applyTimelineRuleToEvent_(event) {
  const sourceEvent = event || {};
  const rule = findMatchingTimelineRule_(sourceEvent);

  if (!rule) {
    return sourceEvent;
  }

  return Object.assign({}, sourceEvent, {
    Event_Category: sourceEvent.Event_Category || rule.Event_Category || '',
    Is_Meaningful_Activity: sourceEvent.Is_Meaningful_Activity !== undefined
      ? sourceEvent.Is_Meaningful_Activity
      : parseTimelineRuleBoolean_(rule.Is_Meaningful_Activity),
    Updates_Last_Activity: sourceEvent.Updates_Last_Activity !== undefined
      ? sourceEvent.Updates_Last_Activity
      : parseTimelineRuleBoolean_(rule.Updates_Last_Activity),
    Display_Priority: sourceEvent.Display_Priority || rule.Display_Priority || '',
    Visibility: sourceEvent.Visibility || rule.Visibility || '',
    Noise_Reason: sourceEvent.Noise_Reason || rule.Noise_Reason || '',
    Group_Label: sourceEvent.Group_Label || rule.Grouping_Category || ''
  });
}

function parseTimelineRuleBoolean_(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 'Yes' || value === 'YES';
}

function getTimelineEventSeedRules_(now) {
  return [
    buildTimelineRule_('EOJ', 'EOJ', true, true, 'high', 'primary', 'EOJ', '', 'EOJ events are high-value operational activity.', now),
    buildTimelineRule_('Intake', 'Intake', true, true, 'normal', 'primary', 'Intake', '', 'Intake events are operational setup activity.', now),
    buildTimelineRule_('Claim Folder', 'Intake', true, true, 'normal', 'primary', 'Intake', '', 'Claim folder creation/matching is meaningful intake activity.', now),
    buildTimelineRule_('Inspection', 'Field Work', true, true, 'high', 'primary', 'Field Work', '', 'Inspection means operational work has begun.', now),
    buildTimelineRule_('Demo', 'Field Work', true, true, 'high', 'primary', 'Field Work', '', 'Demo activity is meaningful field work.', now),
    buildTimelineRule_('Drying', 'Field Work', true, true, 'high', 'primary', 'Field Work', '', 'Drying activity is meaningful field work.', now),
    buildTimelineRule_('Field Work', 'Field Work', true, true, 'high', 'primary', 'Field Work', '', 'General field work activity.', now),
    buildTimelineRule_('Operational Work', 'Field Work', true, true, 'high', 'primary', 'Field Work', '', 'Operational work events are meaningful field activity.', now),
    buildTimelineRule_('Monitoring', 'Monitoring', true, true, 'high', 'primary', 'Monitoring', '', 'Monitoring visits are meaningful activity.', now),
    buildTimelineRule_('Condition', 'Condition', true, true, 'normal', 'primary', 'Condition', '', 'Condition changes are operationally meaningful.', now),
    buildTimelineRule_('Alert', 'Alert', false, false, 'normal', 'secondary', 'Alert', '', 'Alerts are visible but not always last-activity-driving.', now),
    buildTimelineRule_('Alert Resolved', 'Alert', true, true, 'normal', 'primary', 'Alert', '', 'Resolving an alert is meaningful activity.', now),
    buildTimelineRule_('Revision', 'Revision', true, true, 'high', 'primary', 'Revision', '', 'Revision activity is meaningful negotiation activity.', now),
    buildTimelineRule_('Payment', 'Payment', true, true, 'high', 'primary', 'Payment', '', 'Payment activity is meaningful financial activity.', now),
    buildTimelineRule_('Remittance', 'Payment', true, true, 'high', 'primary', 'Payment', '', 'Remittance activity maps to payment history.', now),
    buildTimelineRule_('External Link', 'External Link', true, true, 'normal', 'primary', 'External Link', '', 'Adding operational links is meaningful enrichment.', now),
    buildTimelineRule_('Asbestos', 'Asbestos', true, true, 'high', 'primary', 'Asbestos', '', 'Asbestos workflow events are meaningful operational activity.', now),
    buildTimelineRule_('Itel', 'Itel', true, true, 'normal', 'primary', 'Itel', '', 'Itel workflow events are meaningful operational activity.', now),
    buildTimelineRule_('Ownership', 'Ownership', true, true, 'normal', 'primary', 'Ownership', '', 'Ownership changes are meaningful operational activity.', now),
    buildTimelineRule_('System Diagnostic', 'System', false, false, 'low', 'hidden', 'System', 'Diagnostic event.', 'Diagnostic events should not drive activity.', now),
    buildTimelineRule_('System Sync', 'System', false, false, 'low', 'system', 'System', 'System sync without confirmed operational change.', 'Sync events are usually low-level system activity.', now),
    buildTimelineRule_('Test', 'System', false, false, 'low', 'hidden', 'System', 'Test event.', 'Test events should not appear in primary timelines.', now)
  ];
}

function buildTimelineRule_(pattern, category, isMeaningful, updatesLastActivity, priority, visibility, groupingCategory, noiseReason, notes, now) {
  return {
    Rule_ID: generateId('TLR'),
    Is_Active: true,
    Event_Type_Pattern: pattern,
    Event_Category: category,
    Is_Meaningful_Activity: isMeaningful,
    Updates_Last_Activity: updatesLastActivity,
    Display_Priority: priority,
    Visibility: visibility,
    Grouping_Category: groupingCategory,
    Noise_Reason: noiseReason,
    Notes: notes,
    Created_At: now,
    Updated_At: now
  };
}

function testEnsureTimelineEventRulesSheet() {
  const result = ensureTimelineEventRulesSheet();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSeedTimelineEventRules() {
  const result = seedTimelineEventRules();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testLoadTimelineRules() {
  const result = loadTimelineRules();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testFindTimelineRule() {
  const result = findMatchingTimelineRule({
    Event_Type: 'EOJ Submitted',
    Source_System: 'eoj-processing-engine',
    Summary: 'Technician submitted EOJ.'
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testFindTimelineRuleFieldWork() {
  const result = findMatchingTimelineRule({
    Event_Type: 'Inspection Completed',
    Source_System: 'eoj-processing-engine',
    Summary: 'Initial inspection completed by technician.'
  });

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}