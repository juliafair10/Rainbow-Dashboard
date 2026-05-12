function setupRevisionSystem() {
  // Create spreadsheet
  const ss = SpreadsheetApp.create('Revision Intake State');

  // Get default sheet
  const sheet = ss.getSheets()[0];
  sheet.setName('RevisionTasks');

  // Headers
  const headers = [
    'revisionId',
    'claimNumber',
    'customerName',
    'source',
    'sourceThreadId',
    'sourceMessageId',
    'emailSubject',
    'emailFrom',
    'receivedAt',
    'classificationType',
    'summary',
    'owner',
    'priority',
    'status',
    'todoistTaskId',
    'todoistTaskUrl',
    'claimFolderUrl',
    'enrichmentSource',
    'createdAt',
    'updatedAt',
    'notes'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Freeze header row
  sheet.setFrozenRows(1);

  // Auto resize columns
  sheet.autoResizeColumns(1, headers.length);

  // Store spreadsheet ID in script properties
  PropertiesService.getScriptProperties().setProperty(
    'REVISION_SPREADSHEET_ID',
    ss.getId()
  );

  Logger.log('Spreadsheet Created');
  Logger.log(ss.getUrl());

  return {
    success: true,
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl()
  };
}

const CONFIG = {
  SPREADSHEET_ID: '1Evou7k1viMOQt3LNe1m3HlE9BpIadRIBDIsmjpKwcF0',
  SHEET_NAME: 'RevisionTasks',

  LABELS: {
    INTAKE: 'Revision Note',
    PROCESSED: 'Revision-Processed',
    ERROR: 'Revision-Error'
  },

  GMAIL_QUERY:
    'label:"Revision Note" -label:"Revision-Processed" -label:"Revision-Error"'
};

function processRevisionIntake() {
  const result = {
    workflow: 'revision-intake',
    action: 'processRevisionIntake',
    status: 'Success',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    foundCount: 0,
    processedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    records: [],
    errors: []
  };

  const threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, 25);

  result.foundCount = threads.length;

  const sheet = getRevisionSheet_();

  const intakeLabel =
    GmailApp.getUserLabelByName(CONFIG.LABELS.INTAKE);

  const processedLabel =
    GmailApp.getUserLabelByName(CONFIG.LABELS.PROCESSED);

  const errorLabel =
    GmailApp.getUserLabelByName(CONFIG.LABELS.ERROR);

  threads.forEach(thread => {
    try {
      const messages = thread.getMessages();

      const latestMessage =
        messages[messages.length - 1];

      const body =
        latestMessage.getPlainBody();

      const subject =
        latestMessage.getSubject();

      const claimNumber =
        extractClaimNumber_(subject + '\n' + body);

      const classification = classifyRevisionEmail_(
        subject,
        body
      );

      const revisionRecord = {
        revisionId: Utilities.getUuid(),
        claimNumber: claimNumber,
        customerName: '',
        source: detectSource_(latestMessage),
        sourceThreadId: thread.getId(),
        sourceMessageId: latestMessage.getId(),
        emailSubject: subject,
        emailFrom: latestMessage.getFrom(),
        receivedAt: latestMessage.getDate(),
        classificationType: classification.type,
        summary: summarizeText_(body),
        owner: classification.owner,
        priority: classification.priority,
        status: classification.status,
        todoistTaskId: '',
        todoistTaskUrl: '',
        claimFolderUrl: '',
        enrichmentSource: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: classification.reason
      };

      if (
        revisionExists_(
          sheet,
          revisionRecord.sourceMessageId
        )
      ) {
        result.skippedCount++;

        thread.addLabel(processedLabel);
        thread.removeLabel(intakeLabel);

        return;
      }

      appendRevisionRecord_(sheet, revisionRecord);

      thread.addLabel(processedLabel);
      thread.removeLabel(intakeLabel);

      result.processedCount++;
      result.records.push({
        revisionId: revisionRecord.revisionId,
        claimNumber: revisionRecord.claimNumber,
        subject: revisionRecord.emailSubject,
        classificationType: revisionRecord.classificationType,
        owner: revisionRecord.owner,
        priority: revisionRecord.priority,
        status: revisionRecord.status,
        notes: revisionRecord.notes
      });

    } catch (err) {
      result.errorCount++;

      result.errors.push({
        threadId: thread.getId(),
        error: err.message
      });

      thread.addLabel(errorLabel);
      thread.removeLabel(intakeLabel);
    }
  });

  if (result.errorCount > 0) {
    result.status = result.processedCount > 0 ? 'Partial Success' : 'Error';
  }

  result.finishedAt = new Date().toISOString();

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function getRevisionSheet_() {
  const ss =
    SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );

  const sheet = ss.getSheetByName(
    CONFIG.SHEET_NAME
  );

  if (!sheet) {
    throw new Error('Missing sheet tab: ' + CONFIG.SHEET_NAME);
  }

  return sheet;
}

function appendRevisionRecord_(sheet, record) {
  sheet.appendRow([
    record.revisionId,
    record.claimNumber,
    record.customerName,
    record.source,
    record.sourceThreadId,
    record.sourceMessageId,
    record.emailSubject,
    record.emailFrom,
    record.receivedAt,
    record.classificationType,
    record.summary,
    record.owner,
    record.priority,
    record.status,
    record.todoistTaskId || '',
    record.todoistTaskUrl || '',
    record.claimFolderUrl || '',
    record.enrichmentSource || '',
    record.createdAt,
    record.updatedAt,
    record.notes
  ]);
}

function revisionExists_(sheet, sourceMessageId) {
  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return false;
  }

  const headers = values[0];

  const messageIdCol =
    headers.indexOf('sourceMessageId');

  if (messageIdCol === -1) {
    throw new Error('Missing sourceMessageId column');
  }

  return values
    .slice(1)
    .some(
      row =>
        row[messageIdCol] === sourceMessageId
    );
}

function extractClaimNumber_(text) {
  const match =
    String(text).match(/\b\d{10}\b/);

  return match ? match[0] : '';
}

function summarizeText_(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 8000);
}

function detectSource_(message) {
  const from =
    String(message.getFrom()).toLowerCase();

  if (from.includes('xactware')) {
    return 'XactAnalysis';
  }

  if (from.includes('xactwire')) {
    return 'XactWire';
  }

  return 'Unknown';
}

function getRevisionQueueHealth() {
  const sheet = getRevisionSheet_();
  const rows = getRevisionRows_(sheet);

  const statusCounts = {
    NEW: 0,
    ASSIGNED: 0,
    WAITING: 0,
    COMPLETED: 0,
    ESCALATED: 0,
    ERROR: 0,
    SKIPPED: 0,
    OTHER: 0
  };

  rows.forEach(row => {
    const status = row.status || 'OTHER';

    if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
      statusCounts[status]++;
    } else {
      statusCounts.OTHER++;
    }
  });

  const result = {
    workflow: 'revision-intake',
    action: 'queueHealth',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    totalRecords: rows.length,
    statusCounts: statusCounts,
    openCount:
      statusCounts.NEW +
      statusCounts.ASSIGNED +
      statusCounts.WAITING +
      statusCounts.ESCALATED,
    errorCount: statusCounts.ERROR
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function getRevisionRows_(sheet) {
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];

  return values.slice(1).map(row => {
    const record = {};

    headers.forEach((header, index) => {
      record[header] = row[index];
    });

    return record;
  });
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'process') {
    return jsonResponse_(processRevisionIntake());
  }

  if (action === 'queueHealth') {
    return jsonResponse_(getRevisionQueueHealth());
  }

  if (action === 'listOpen') {
    return jsonResponse_(listRevisionQueue_('open'));
  }

  if (action === 'listWaiting') {
    return jsonResponse_(listRevisionQueue_('waiting'));
  }

  if (action === 'listEscalated') {
    return jsonResponse_(listRevisionQueue_('escalated'));
  }

  if (action === 'listUnclassified') {
    return jsonResponse_(listRevisionQueue_('unclassified'));
  }

  if (action === 'listSkipped') {
    return jsonResponse_(listRevisionQueue_('skipped'));
  }

  if (action === 'reclassifyExisting') {
    return jsonResponse_(reclassifyExistingRevisionRecords_());
  }

  if (action === 'createTodoistTasks') {
    return jsonResponse_(createTodoistTasksForEligibleRevisions_());
  }

  if (action === 'setupTodoistColumns') {
    return jsonResponse_(setupTodoistColumns_());
  }

  if (action === 'refreshTodoistTasks') {
    return jsonResponse_(refreshExistingTodoistTasks_());
  }

  if (action === 'enrichFromClaimFolders') {
    return jsonResponse_(enrichRevisionRecordsFromClaimFolders_());
  }

  if (action === 'listTodoistCollaborators') {
    return jsonResponse_(listTodoistCollaborators_());
  }

  if (action === 'setupTodoistAssignees') {
    return jsonResponse_(setupTodoistAssignees_());
  }

  return jsonResponse_({
    workflow: 'revision-intake',
    status: 'Ready',
    availableActions: [
      'process',
      'queueHealth',
      'listOpen',
      'listWaiting',
      'listEscalated',
      'listUnclassified',
      'listSkipped',
      'reclassifyExisting',
      'setupTodoistColumns',
      'createTodoistTasks',
      'refreshTodoistTasks',
      'enrichFromClaimFolders',
      'listTodoistCollaborators',
      'setupTodoistAssignees'
    ]
  });
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function classifyRevisionEmail_(subject, body) {
  const text = (
    String(subject || '') + '\n' + String(body || '')
  ).toLowerCase();

  const denialKeywords = [
    'no coverage',
    'denied',
    'coverage will not be forwarded',
    'claim withdrawn',
    'withdraw claim'
  ];

  const pendingKeywords = [
    'waiting on',
    'awaiting',
    'pending',
    'will provide update',
    'need to confirm',
    'not been determined'
  ];

  const approvalKeywords = [
    'coverage approved',
    'coverage confirmed',
    'coverage has been extended',
    'approved',
    'approval extended',
    'confirmed coverage',
    'can proceed',
    'ok to proceed',
    'okay to proceed',
    'appears to be coverage',
    'have coverage',
    'has coverage'
  ];

  const revisionKeywords = [
    'remove',
    'change',
    'modify',
    'upload',
    'reupload',
    're-upload',
    'reconnect',
    'reconnect estimate',
    'please reconnect',
    'close claim',
    'do you',
    'line 1',
    'line 2',
    'line 3',
    'line 17',
    'line 29',
    'line 36',
    'please revise',
    'revisions requested',
    'revision requested',
    'please address',
    'please provide',
    'please add',
    'please include',
    'please ensure',
    'please review',
    'please let me know once this is complete',
    'mica report is still missing',
    'mica report is missing',
    'missing from xa',
    'source of loss is missing',
    'source of loss to the mica report',
    'source of loss is documented',
    'correct to'
  ];

  const fyiKeywords = [
    'spoke with',
    'sp w/',
    'discussion',
    'documenting',
    'approved prior',
    'phone conversation',
    'thanks for the photos',
    'thank you for the photos',
    'photos received'
  ];

  if (
    text.includes('it hotline') &&
    (
      (
        text.includes('spoke with') &&
        text.includes('gave approval')
      ) ||
      (
        text.includes('received a call') &&
        text.includes('looking for approval') &&
        text.includes('approval extended')
      )
    )
  ) {
    return {
      type: 'FYI_SKIP',
      owner: '',
      priority: 'LOW',
      status: 'SKIPPED',
      reason: 'Detected IT hotline phone approval already handled/FYI language'
    };
  }

  if (containsKeyword_(text, denialKeywords)) {
    return {
      type: 'DENIAL_ESCALATION',
      owner: 'Management',
      priority: 'HIGH',
      status: 'ESCALATED',
      reason: 'Detected denial/escalation language'
    };
  }

  if (
    text.includes('pending audit review') ||
    text.includes('pending it review') ||
    text.includes('validate audit has returned exceptions') ||
    text.includes('please review the validate review report') ||
    text.includes('reconnect all final documents')
  ) {
    return {
      type: 'REVISION_REQUIRED',
      owner: 'Clarence',
      priority: 'HIGH',
      status: 'NEW',
      reason: 'Detected pending review with required estimate/audit action'
    };
  }

  if (containsKeyword_(text, pendingKeywords)) {
    return {
      type: 'PENDING_INFO',
      owner: 'Julia',
      priority: 'MEDIUM',
      status: 'WAITING',
      reason: 'Detected pending/awaiting information language'
    };
  }
  if (containsKeyword_(text, approvalKeywords)) {
    return {
      type: 'COVERAGE_APPROVAL',
      owner: 'Julia',
      priority: 'MEDIUM',
      status: 'NEW',
      reason: 'Detected coverage approval language'
    };
  }

  if (containsKeyword_(text, revisionKeywords)) {
    return {
      type: 'REVISION_REQUIRED',
      owner: 'Clarence',
      priority: 'HIGH',
      status: 'NEW',
      reason: 'Detected revision/action-required language'
    };
  }

  if (containsKeyword_(text, fyiKeywords)) {
    return {
      type: 'FYI_SKIP',
      owner: '',
      priority: 'LOW',
      status: 'SKIPPED',
      reason: 'Detected documentation/FYI language'
    };
  }

  return {
    type: 'UNCLASSIFIED',
    owner: '',
    priority: 'LOW',
    status: 'NEW',
    reason: 'No matching classification keywords found'
  };
}

function containsKeyword_(text, keywords) {
  return keywords.some(keyword =>
    text.includes(keyword)
  );
}

function listRevisionQueue_(queueType) {
  const sheet = getRevisionSheet_();
  const rows = getRevisionRows_(sheet);

  const filteredRows = rows
    .filter(row => matchesRevisionQueue_(row, queueType))
    .map(formatRevisionQueueRecord_);

  const result = {
    workflow: 'revision-intake',
    action: 'listRevisionQueue',
    queueType: queueType,
    status: 'Success',
    checkedAt: new Date().toISOString(),
    count: filteredRows.length,
    records: filteredRows
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function matchesRevisionQueue_(row, queueType) {
  const status = String(row.status || '').toUpperCase();
  const classificationType = String(row.classificationType || '').toUpperCase();

  if (queueType === 'open') {
    return [
      'NEW',
      'ASSIGNED',
      'WAITING',
      'ESCALATED'
    ].includes(status);
  }

  if (queueType === 'waiting') {
    return status === 'WAITING' || classificationType === 'PENDING_INFO';
  }

  if (queueType === 'escalated') {
    return status === 'ESCALATED' || classificationType === 'DENIAL_ESCALATION';
  }

  if (queueType === 'unclassified') {
    return classificationType === 'UNCLASSIFIED';
  }

  if (queueType === 'skipped') {
    return status === 'SKIPPED' || classificationType === 'FYI_SKIP';
  }

  return false;
}

function formatRevisionQueueRecord_(row) {
  return {
    revisionId: row.revisionId || '',
    claimNumber: row.claimNumber || '',
    customerName: row.customerName || '',
    source: row.source || '',
    emailSubject: row.emailSubject || '',
    emailFrom: row.emailFrom || '',
    receivedAt: formatDateForJson_(row.receivedAt),
    classificationType: row.classificationType || '',
    owner: row.owner || '',
    priority: row.priority || '',
    status: row.status || '',
    todoistTaskId: row.todoistTaskId || '',
    todoistTaskUrl: row.todoistTaskUrl || '',
    claimFolderUrl: row.claimFolderUrl || '',
    enrichmentSource: row.enrichmentSource || '',
    summary: row.summary || '',
    notes: row.notes || '',
    createdAt: formatDateForJson_(row.createdAt),
    updatedAt: formatDateForJson_(row.updatedAt)
  };
}

function formatDateForJson_(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }

  return String(value);
}

function reclassifyExistingRevisionRecords_() {
  const sheet = getRevisionSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    const emptyResult = {
      workflow: 'revision-intake',
      action: 'reclassifyExisting',
      status: 'Success',
      checkedAt: new Date().toISOString(),
      totalRecords: 0,
      updatedCount: 0,
      unchangedCount: 0,
      updates: []
    };

    Logger.log(JSON.stringify(emptyResult, null, 2));
    return emptyResult;
  }

  const headers = values[0];
  const columnMap = getHeaderColumnMap_(headers);

  requireColumns_(columnMap, [
    'revisionId',
    'emailSubject',
    'summary',
    'classificationType',
    'owner',
    'priority',
    'status',
    'notes',
    'updatedAt'
  ]);

  const result = {
    workflow: 'revision-intake',
    action: 'reclassifyExisting',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    totalRecords: values.length - 1,
    updatedCount: 0,
    unchangedCount: 0,
    updates: []
  };

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const subject = row[columnMap.emailSubject];
    const summary = row[columnMap.summary];
    const previousType = row[columnMap.classificationType];

    const classification = classifyRevisionEmail_(subject, summary);

    if (classification.type === previousType) {
      result.unchangedCount++;
      continue;
    }

    const sheetRow = rowIndex + 1;

    sheet.getRange(sheetRow, columnMap.classificationType + 1).setValue(classification.type);
    sheet.getRange(sheetRow, columnMap.owner + 1).setValue(classification.owner);
    sheet.getRange(sheetRow, columnMap.priority + 1).setValue(classification.priority);
    sheet.getRange(sheetRow, columnMap.status + 1).setValue(classification.status);
    sheet.getRange(sheetRow, columnMap.notes + 1).setValue(classification.reason);
    sheet.getRange(sheetRow, columnMap.updatedAt + 1).setValue(new Date());

    result.updatedCount++;
    result.updates.push({
      revisionId: row[columnMap.revisionId],
      previousType: previousType,
      newType: classification.type,
      status: classification.status,
      reason: classification.reason
    });
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function getHeaderColumnMap_(headers) {
  const columnMap = {};

  headers.forEach((header, index) => {
    columnMap[header] = index;
  });

  return columnMap;
}

function requireColumns_(columnMap, requiredColumns) {
  requiredColumns.forEach(columnName => {
    if (!Object.prototype.hasOwnProperty.call(columnMap, columnName)) {
      throw new Error('Missing required column: ' + columnName);
    }
  });
}

function setupTodoistColumns_() {
  const sheet = getRevisionSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  const requiredHeaders = [
    'todoistTaskId',
    'todoistTaskUrl',
    'claimFolderUrl',
    'enrichmentSource'
  ];

  const addedHeaders = [];

  requiredHeaders.forEach(header => {
    if (!headers.includes(header)) {
      const nextColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextColumn).setValue(header);
      addedHeaders.push(header);
    }
  });

  const result = {
    workflow: 'revision-intake',
    action: 'setupTodoistColumns',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    addedHeaders: addedHeaders
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function createTodoistTasksForEligibleRevisions_() {
  setupTodoistColumns_();

  const token = getTodoistToken_();
  const sheet = getRevisionSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      workflow: 'revision-intake',
      action: 'createTodoistTasks',
      status: 'Success',
      checkedAt: new Date().toISOString(),
      totalRecords: 0,
      createdCount: 0,
      skippedCount: 0,
      errorCount: 0,
      createdTasks: [],
      skipped: [],
      errors: []
    };
  }

  const headers = values[0];
  const columnMap = getHeaderColumnMap_(headers);

  requireColumns_(columnMap, [
    'revisionId',
    'claimNumber',
    'customerName',
    'classificationType',
    'summary',
    'owner',
    'priority',
    'status',
    'todoistTaskId',
    'todoistTaskUrl',
    'claimFolderUrl',
    'enrichmentSource',
    'updatedAt'
  ]);

  const result = {
    workflow: 'revision-intake',
    action: 'createTodoistTasks',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    totalRecords: values.length - 1,
    createdCount: 0,
    skippedCount: 0,
    errorCount: 0,
    createdTasks: [],
    skipped: [],
    errors: []
  };

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const record = rowToRecord_(headers, row);

    if (!isEligibleForTodoistTask_(record)) {
      result.skippedCount++;
      result.skipped.push({
        revisionId: record.revisionId || '',
        claimNumber: record.claimNumber || '',
        reason: 'Not eligible for Todoist task'
      });
      continue;
    }

    if (record.todoistTaskId) {
      result.skippedCount++;
      result.skipped.push({
        revisionId: record.revisionId || '',
        claimNumber: record.claimNumber || '',
        reason: 'Todoist task already exists'
      });
      continue;
    }

    try {
      const todoistTask = createTodoistTask_(token, record);
      const sheetRow = rowIndex + 1;

      const todoistTaskId = todoistTask.id || '';
      const todoistTaskUrl = todoistTask.url || getTodoistTaskUrl_(todoistTaskId);

      sheet.getRange(sheetRow, columnMap.todoistTaskId + 1).setValue(todoistTaskId);
      sheet.getRange(sheetRow, columnMap.todoistTaskUrl + 1).setValue(todoistTaskUrl);
      sheet.getRange(sheetRow, columnMap.status + 1).setValue('ASSIGNED');
      sheet.getRange(sheetRow, columnMap.updatedAt + 1).setValue(new Date());

      result.createdCount++;
      result.createdTasks.push({
        revisionId: record.revisionId || '',
        claimNumber: record.claimNumber || '',
        classificationType: record.classificationType || '',
        owner: record.owner || '',
        todoistTaskId: todoistTaskId,
        todoistTaskUrl: todoistTaskUrl
      });
    } catch (err) {
      result.errorCount++;
      result.errors.push({
        revisionId: record.revisionId || '',
        claimNumber: record.claimNumber || '',
        error: err.message
      });
    }
  }

  if (result.errorCount > 0) {
    result.status = result.createdCount > 0 ? 'Partial Success' : 'Error';
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function isEligibleForTodoistTask_(record) {
  const classificationType = String(record.classificationType || '').toUpperCase();
  const status = String(record.status || '').toUpperCase();

  if (status === 'COMPLETED' || status === 'SKIPPED' || status === 'ERROR') {
    return false;
  }

  return [
    'REVISION_REQUIRED',
    'PENDING_INFO',
    'COVERAGE_APPROVAL'
  ].includes(classificationType);
}

function createTodoistTask_(token, record) {
  const payload = buildTodoistTaskPayload_(record);

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/tasks', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('Todoist API error ' + responseCode + ': ' + responseText);
  }

  return JSON.parse(responseText);
}

function buildTodoistTaskPayload_(record) {
  const classificationType = String(record.classificationType || '').toUpperCase();
  const claimNumber = normalizeClaimNumber_(record.claimNumber);
  const customerName = String(record.customerName || '').trim() || 'Customer Name Needed';
  const owner = record.owner || 'Unassigned';
  const categoryLabel = getTodoistCategoryLabel_(classificationType);

  const content = [
    customerName,
    claimNumber ? claimNumber : 'Claim # Needed',
    categoryLabel
  ].join(' - ');

  const description = cleanTodoistDescription_(record.summary || '');

  const payload = {
    content: content,
    description: description,
    due_string: getTodoistDueString_(record),
    priority: getTodoistPriority_(record.priority),
    labels: getTodoistLabels_(record)
  };

  const projectId = PropertiesService.getScriptProperties().getProperty('TODOIST_PROJECT_ID');

  if (projectId) {
    payload.project_id = projectId;
  }

  const assigneeId = getTodoistAssigneeId_(owner);

  if (assigneeId) {
    payload.assignee_id = assigneeId;
  }

  return payload;
}

function getTodoistDueString_(record) {
  const classificationType = String(record.classificationType || '').toUpperCase();

  if (classificationType === 'REVISION_REQUIRED') {
    return 'in 2 days';
  }

  if (classificationType === 'PENDING_INFO') {
    return 'in 2 days';
  }

  if (classificationType === 'COVERAGE_APPROVAL') {
    return 'in 2 days';
  }

  return 'in 2 days';
}

function getTodoistPriority_(priority) {
  const value = String(priority || '').toUpperCase();

  if (value === 'HIGH') {
    return 1;
  }

  if (value === 'MEDIUM') {
    return 2;
  }

  if (value === 'LOW') {
    return 3;
  }

  return 4;
}

function getTodoistToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('TODOIST_API_TOKEN');

  if (!token) {
    throw new Error('Missing TODOIST_API_TOKEN in Script Properties');
  }

  return token;
}

function rowToRecord_(headers, row) {
  const record = {};

  headers.forEach((header, index) => {
    record[header] = row[index];
  });

  return record;
}

function authorizeTodoistAccess() {
  const token = getTodoistToken_();

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/projects', {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const result = {
    workflow: 'revision-intake',
    action: 'authorizeTodoistAccess',
    status: response.getResponseCode() >= 200 && response.getResponseCode() < 300 ? 'Success' : 'Error',
    responseCode: response.getResponseCode(),
    checkedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function getTodoistTaskUrl_(taskId) {
  if (!taskId) {
    return '';
  }

  return 'https://app.todoist.com/app/task/' + taskId;
}

function refreshExistingTodoistTasks_() {
  const token = getTodoistToken_();
  const sheet = getRevisionSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      workflow: 'revision-intake',
      action: 'refreshTodoistTasks',
      status: 'Success',
      checkedAt: new Date().toISOString(),
      refreshedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      refreshedTasks: [],
      skipped: [],
      errors: []
    };
  }

  const headers = values[0];
  const result = {
    workflow: 'revision-intake',
    action: 'refreshTodoistTasks',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    refreshedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    refreshedTasks: [],
    skipped: [],
    errors: []
  };

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const record = rowToRecord_(headers, row);

    if (!record.todoistTaskId) {
      result.skippedCount++;
      result.skipped.push({
        revisionId: record.revisionId || '',
        claimNumber: normalizeClaimNumber_(record.claimNumber),
        reason: 'No Todoist task ID'
      });
      continue;
    }

    try {
      const payload = buildTodoistTaskPayload_(record);
      updateTodoistTask_(token, record.todoistTaskId, payload);

      result.refreshedCount++;
      result.refreshedTasks.push({
        revisionId: record.revisionId || '',
        claimNumber: normalizeClaimNumber_(record.claimNumber),
        todoistTaskId: record.todoistTaskId,
        title: payload.content
      });
    } catch (err) {
      result.errorCount++;
      result.errors.push({
        revisionId: record.revisionId || '',
        claimNumber: normalizeClaimNumber_(record.claimNumber),
        todoistTaskId: record.todoistTaskId || '',
        error: err.message
      });
    }
  }

  if (result.errorCount > 0) {
    result.status = result.refreshedCount > 0 ? 'Partial Success' : 'Error';
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function updateTodoistTask_(token, taskId, payload) {
  const updatePayload = {
    content: payload.content,
    description: payload.description,
    due_string: payload.due_string,
    priority: payload.priority,
    labels: payload.labels
  };

  if (payload.assignee_id) {
    updatePayload.assignee_id = payload.assignee_id;
  }

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/tasks/' + taskId, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify(updatePayload),
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('Todoist update error ' + responseCode + ': ' + responseText);
  }
}

function normalizeClaimNumber_(claimNumber) {
  const raw = String(claimNumber || '').replace(/\D/g, '');

  if (!raw) {
    return '';
  }

  if (raw.length < 10) {
    return raw.padStart(10, '0');
  }

  return raw;
}

function getTodoistCategoryLabel_(classificationType) {
  if (classificationType === 'REVISION_REQUIRED') {
    return 'Revision Needed';
  }

  if (classificationType === 'PENDING_INFO') {
    return 'Follow Up Needed';
  }

  if (classificationType === 'COVERAGE_APPROVAL') {
    return 'Coverage Approved';
  }

  if (classificationType === 'DENIAL_ESCALATION') {
    return 'Review Needed';
  }

  return 'Review Needed';
}

function cleanTodoistDescription_(text) {
  let cleaned = String(text || '').trim();

  const noteMatch = cleaned.match(/note:\s*([\s\S]*)/i);

  if (noteMatch && noteMatch[1]) {
    cleaned = noteMatch[1].trim();
  }

  cleaned = cleaned
    .replace(/^-+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

function getTodoistActionSummary_(record) {
  const classificationType = String(record.classificationType || '').toUpperCase();

  if (classificationType === 'REVISION_REQUIRED') {
    return 'Action needed: Clarence should review and complete the requested estimate or documentation revision.';
  }

  if (classificationType === 'PENDING_INFO') {
    return 'Action needed: Julia should follow up on pending information or pending review status.';
  }

  if (classificationType === 'COVERAGE_APPROVAL') {
    return 'Action needed: Julia should confirm coverage approval and determine next operational step.';
  }

  if (classificationType === 'DENIAL_ESCALATION') {
    return 'Action needed: Management review required before work continues.';
  }

  return 'Action needed: Review this revision intake record.';
}

function getTodoistLabels_(record) {
  const labels = ['revision-intake'];
  const owner = String(record.owner || '').toLowerCase();
  const classificationType = String(record.classificationType || '').toLowerCase();

  if (owner) {
    labels.push('owner-' + owner.replace(/\s+/g, '-'));
  }

  if (classificationType) {
    labels.push(classificationType.replace(/_/g, '-'));
  }

  return labels;
}

function enrichRevisionRecordsFromClaimFolders_() {
  setupTodoistColumns_();

  const sheet = getRevisionSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      workflow: 'revision-intake',
      action: 'enrichFromClaimFolders',
      status: 'Success',
      checkedAt: new Date().toISOString(),
      totalRecords: 0,
      enrichedCount: 0,
      unchangedCount: 0,
      errors: []
    };
  }

  const headers = values[0];
  const columnMap = getHeaderColumnMap_(headers);

  requireColumns_(columnMap, [
    'revisionId',
    'claimNumber',
    'customerName',
    'emailSubject',
    'summary',
    'claimFolderUrl',
    'enrichmentSource',
    'updatedAt'
  ]);

  const result = {
    workflow: 'revision-intake',
    action: 'enrichFromClaimFolders',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    totalRecords: values.length - 1,
    enrichedCount: 0,
    unchangedCount: 0,
    errors: [],
    enriched: []
  };

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    try {
      const row = values[rowIndex];
      const record = rowToRecord_(headers, row);
      const enrichment = findClaimFolderEnrichment_(record);

      if (!enrichment || (!enrichment.claimNumber && !enrichment.customerName && !enrichment.claimFolderUrl)) {
        result.unchangedCount++;
        continue;
      }

      const sheetRow = rowIndex + 1;
      let changed = false;

      if (enrichment.claimNumber && !normalizeClaimNumber_(record.claimNumber)) {
        sheet.getRange(sheetRow, columnMap.claimNumber + 1).setValue(enrichment.claimNumber);
        changed = true;
      }

      if (enrichment.customerName && !String(record.customerName || '').trim()) {
        sheet.getRange(sheetRow, columnMap.customerName + 1).setValue(enrichment.customerName);
        changed = true;
      }

      if (enrichment.claimFolderUrl && !String(record.claimFolderUrl || '').trim()) {
        sheet.getRange(sheetRow, columnMap.claimFolderUrl + 1).setValue(enrichment.claimFolderUrl);
        changed = true;
      }

      if (changed) {
        sheet.getRange(sheetRow, columnMap.enrichmentSource + 1).setValue(enrichment.source);
        sheet.getRange(sheetRow, columnMap.updatedAt + 1).setValue(new Date());
        result.enrichedCount++;
        result.enriched.push({
          revisionId: record.revisionId || '',
          claimNumber: enrichment.claimNumber || normalizeClaimNumber_(record.claimNumber),
          customerName: enrichment.customerName || record.customerName || '',
          claimFolderUrl: enrichment.claimFolderUrl || '',
          source: enrichment.source
        });
      } else {
        result.unchangedCount++;
      }
    } catch (err) {
      result.errors.push({
        row: rowIndex + 1,
        error: err.message
      });
    }
  }

  if (result.errors.length > 0) {
    result.status = result.enrichedCount > 0 ? 'Partial Success' : 'Error';
  }

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function findClaimFolderEnrichment_(record) {
  const subject = String(record.emailSubject || '');
  const summary = String(record.summary || '');
  const currentClaimNumber = normalizeClaimNumber_(record.claimNumber);
  const subjectClaim = extractClaimNumberFromAnyFormat_(subject + '\n' + summary);
  const claimNumber = currentClaimNumber || subjectClaim;
  const subjectCustomer = extractCustomerNameFromSubject_(subject);

  if (claimNumber) {
    const logMatch = findClaimFolderLogMatch_(claimNumber);

    if (logMatch) {
      return {
        claimNumber: logMatch.claimNumber || claimNumber,
        customerName: subjectCustomer || logMatch.customerName,
        claimFolderUrl: logMatch.claimFolderUrl,
        source: 'Claim folder log'
      };
    }

    const folderMatch = findClaimFolderByClaimNumber_(claimNumber);

    if (folderMatch) {
      return {
        claimNumber: claimNumber,
        customerName: subjectCustomer || folderMatch.customerName,
        claimFolderUrl: folderMatch.url,
        source: 'Drive claim folder'
      };
    }
  }

  if (subjectCustomer || subjectClaim) {
    return {
      claimNumber: subjectClaim || claimNumber,
      customerName: subjectCustomer,
      claimFolderUrl: '',
      source: 'Email subject'
    };
  }

  return null;
}

function findClaimFolderByClaimNumber_(claimNumber) {
  const normalizedClaimNumber = normalizeClaimNumber_(claimNumber);

  if (!normalizedClaimNumber) {
    return null;
  }

  const searchTerms = [
    normalizedClaimNumber,
    String(Number(normalizedClaimNumber))
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  for (let index = 0; index < searchTerms.length; index++) {
    const searchTerm = searchTerms[index];
    const query = 'title contains "' + searchTerm + '" and mimeType = "application/vnd.google-apps.folder" and trashed = false';
    const folders = DriveApp.searchFolders(query);

    if (folders.hasNext()) {
      const folder = folders.next();
      const folderName = folder.getName();

      return {
        name: folderName,
        url: folder.getUrl(),
        customerName: extractCustomerNameFromFolderName_(folderName, normalizedClaimNumber)
      };
    }
  }

  return null;
}

function extractClaimNumberFromAnyFormat_(text) {
  const stringValue = String(text || '');
  const tenDigitMatch = stringValue.match(/\b\d{10}\b/);

  if (tenDigitMatch) {
    return tenDigitMatch[0];
  }

  const claimHashMatch = stringValue.match(/claim\s*#\s*(\d{6,10})/i);

  if (claimHashMatch) {
    return normalizeClaimNumber_(claimHashMatch[1]);
  }

  return '';
}

function extractCustomerNameFromSubject_(subject) {
  const match = String(subject || '').match(/\(([A-Z][A-Z\s.'-]+)\)/);

  if (!match) {
    return '';
  }

  return toTitleCase_(match[1].trim());
}

function extractCustomerNameFromFolderName_(folderName, claimNumber) {
  let name = String(folderName || '');

  if (claimNumber) {
    name = name.replace(claimNumber, '');
    name = name.replace(String(Number(claimNumber)), '');
  }

  name = name
    .replace(/claim/ig, '')
    .replace(/#/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 3) {
    return '';
  }

  return toTitleCase_(name);
}

function toTitleCase_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getTodoistAssigneeId_(owner) {
  const normalizedOwner = String(owner || '').trim().toUpperCase();

  if (normalizedOwner === 'JULIA') {
    return PropertiesService.getScriptProperties().getProperty('TODOIST_ASSIGNEE_JULIA_ID') || '';
  }

  if (normalizedOwner === 'CLARENCE') {
    return PropertiesService.getScriptProperties().getProperty('TODOIST_ASSIGNEE_CLARENCE_ID') || '';
  }

  return '';
}

function listTodoistCollaborators_() {
  const token = getTodoistToken_();
  const projectId = PropertiesService.getScriptProperties().getProperty('TODOIST_PROJECT_ID');

  if (!projectId) {
    throw new Error('Missing TODOIST_PROJECT_ID in Script Properties');
  }

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/projects/' + projectId + '/collaborators', {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('Todoist collaborators error ' + responseCode + ': ' + responseText);
  }

  const parsedResponse = JSON.parse(responseText);
  const normalizedCollaborators = normalizeTodoistCollaboratorsResponse_(parsedResponse);
  const collaboratorList = Array.isArray(normalizedCollaborators)
    ? normalizedCollaborators
    : Object.values(normalizedCollaborators || {});

  const result = {
    workflow: 'revision-intake',
    action: 'listTodoistCollaborators',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    projectId: projectId,
    responseShape: Array.isArray(parsedResponse) ? 'array' : 'object',
    responseKeys: Array.isArray(parsedResponse) ? [] : Object.keys(parsedResponse),
    collaboratorCount: collaboratorList.length,
    collaborators: collaboratorList.map(collaborator => ({
      id: collaborator.id || collaborator.user_id || collaborator.uid || '',
      name: collaborator.name || collaborator.full_name || collaborator.fullName || '',
      email: collaborator.email || ''
    })),
    rawPreview: responseText.slice(0, 1000)
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function normalizeTodoistCollaboratorsResponse_(parsedResponse) {
  if (Array.isArray(parsedResponse)) {
    return parsedResponse;
  }

  if (!parsedResponse || typeof parsedResponse !== 'object') {
    return [];
  }

  if (Array.isArray(parsedResponse.collaborators)) {
    return parsedResponse.collaborators;
  }

  if (Array.isArray(parsedResponse.users)) {
    return parsedResponse.users;
  }

  if (Array.isArray(parsedResponse.results)) {
    return parsedResponse.results;
  }

  if (Array.isArray(parsedResponse.items)) {
    return parsedResponse.items;
  }

  if (parsedResponse.collaborators && typeof parsedResponse.collaborators === 'object') {
    return Object.values(parsedResponse.collaborators);
  }

  if (parsedResponse.users && typeof parsedResponse.users === 'object') {
    return Object.values(parsedResponse.users);
  }

  return [];
}

function findClaimFolderLogMatch_(claimNumber) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('CLAIM_FOLDER_LOG_SPREADSHEET_ID');

  if (!spreadsheetId) {
    return null;
  }

  const normalizedClaimNumber = normalizeClaimNumber_(claimNumber);

  if (!normalizedClaimNumber) {
    return null;
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();

  for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
    const sheet = sheets[sheetIndex];
    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      continue;
    }

    const headers = values[0].map(header => String(header || '').trim());
    const headerMap = getFlexibleHeaderMap_(headers);
    const claimCol = findFirstExistingColumn_(headerMap, [
      'claimNumber',
      'claim number',
      'claim',
      'ClaimNumber',
      'Claim #',
      'claim #'
    ]);
    const nameCol = findFirstExistingColumn_(headerMap, [
      'customerName',
      'customer name',
      'customer',
      'insuredName',
      'insured name',
      'insured',
      'name'
    ]);
    const folderUrlCol = findFirstExistingColumn_(headerMap, [
      'claimFolderUrl',
      'claim folder url',
      'folderUrl',
      'folder url',
      'driveFolderUrl',
      'drive folder url',
      'url'
    ]);

    if (claimCol === -1) {
      continue;
    }

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const rowClaimNumber = normalizeClaimNumber_(row[claimCol]);

      if (rowClaimNumber !== normalizedClaimNumber) {
        continue;
      }

      return {
        claimNumber: rowClaimNumber,
        customerName: nameCol >= 0 ? toTitleCase_(row[nameCol]) : '',
        claimFolderUrl: folderUrlCol >= 0 ? String(row[folderUrlCol] || '').trim() : ''
      };
    }
  }

  return null;
}

function getFlexibleHeaderMap_(headers) {
  const map = {};

  headers.forEach((header, index) => {
    const rawHeader = String(header || '').trim();
    const normalizedHeader = normalizeHeaderName_(rawHeader);

    map[rawHeader] = index;
    map[normalizedHeader] = index;
  });

  return map;
}

function normalizeHeaderName_(header) {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function findFirstExistingColumn_(headerMap, candidateNames) {
  for (let index = 0; index < candidateNames.length; index++) {
    const candidate = candidateNames[index];
    const normalizedCandidate = normalizeHeaderName_(candidate);

    if (Object.prototype.hasOwnProperty.call(headerMap, candidate)) {
      return headerMap[candidate];
    }

    if (Object.prototype.hasOwnProperty.call(headerMap, normalizedCandidate)) {
      return headerMap[normalizedCandidate];
    }
  }

  return -1;
}

function authorizeDriveAccess() {
  const folders = DriveApp.searchFolders('trashed = false');
  const hasFolder = folders.hasNext();

  const result = {
    workflow: 'revision-intake',
    action: 'authorizeDriveAccess',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    driveAccessConfirmed: true,
    foundAtLeastOneFolder: hasFolder
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function setupTodoistAssignees_() {
  const properties = PropertiesService.getScriptProperties();

  properties.setProperty('TODOIST_ASSIGNEE_JULIA_ID', '58844832');
  properties.setProperty('TODOIST_ASSIGNEE_CLARENCE_ID', '58990561');

  const result = {
    workflow: 'revision-intake',
    action: 'setupTodoistAssignees',
    status: 'Success',
    checkedAt: new Date().toISOString(),
    assignees: {
      Julia: properties.getProperty('TODOIST_ASSIGNEE_JULIA_ID'),
      Clarence: properties.getProperty('TODOIST_ASSIGNEE_CLARENCE_ID')
    }
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function setupTodoistAssignees() {
  return setupTodoistAssignees_();
}
