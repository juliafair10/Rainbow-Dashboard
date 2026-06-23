const INTAKE_AUDIT_PROPERTY_KEY = 'INTAKE_AUDIT_RECORDS_V1';
const INTAKE_AUDIT_MAX_RECORDS = 500;

function markIntakeIssueReviewed(payload) {
  return recordIntakeAuditAction_('reviewed', payload || {});
}

function ignoreIntakeRecommendation(payload) {
  return recordIntakeAuditAction_('ignored', payload || {});
}

function recordIntakeOperationalLinkAudit_(payload) {
  return recordIntakeAuditAction_('link-added', payload || {});
}

function getIntakeAuditHistory() {
  return {
    status: 'Success',
    success: true,
    generatedAt: new Date().toISOString(),
    records: getIntakeAuditRecords_()
  };
}

function getIntakeAuditState_() {
  const records = getIntakeAuditRecords_();
  const dispositionByIssueKey = {};

  records.forEach(function(record) {
    if (!record || !record.issueKey || !record.actionType) {
      return;
    }

    dispositionByIssueKey[record.issueKey] = record;
  });

  return {
    records: records,
    dispositionByIssueKey: dispositionByIssueKey
  };
}

function getIntakeAuditDispositionForIssue_(auditState, issueKey) {
  if (!auditState || !auditState.dispositionByIssueKey || !issueKey) {
    return null;
  }

  return auditState.dispositionByIssueKey[issueKey] || null;
}

function isIntakeIssueClearedByAudit_(auditState, issueKey) {
  const disposition = getIntakeAuditDispositionForIssue_(auditState, issueKey);

  return !!(disposition && (
    disposition.actionType === 'reviewed'
    || disposition.actionType === 'ignored'
  ));
}

function recordIntakeAuditAction_(actionType, payload) {
  const normalizedActionType = String(actionType || '').trim();
  const issueKey = String(payload.issueKey || '').trim();

  if (!issueKey) {
    return {
      status: 'Error',
      success: false,
      message: 'issueKey is required.',
      generatedAt: new Date().toISOString()
    };
  }

  if (['reviewed', 'ignored', 'link-added'].indexOf(normalizedActionType) === -1) {
    return {
      status: 'Error',
      success: false,
      message: 'Unsupported intake audit action: ' + normalizedActionType,
      generatedAt: new Date().toISOString()
    };
  }

  const timestamp = new Date().toISOString();
  const user = getIntakeAuditUser_();
  const record = {
    auditId: Utilities.getUuid(),
    actionType: normalizedActionType,
    issueType: String(payload.issueType || '').trim(),
    sourceWorkflow: String(payload.sourceWorkflow || '').trim(),
    issueKey: issueKey,
    issueTitle: String(payload.issueTitle || payload.title || '').trim(),
    claimId: String(payload.claimId || '').trim(),
    linkType: String(payload.linkType || '').trim(),
    url: String(payload.url || '').trim(),
    source: String(payload.source || '').trim(),
    createdAt: timestamp
  };

  if (normalizedActionType === 'reviewed') {
    record.reviewedBy = user;
    record.reviewedAt = timestamp;
  }

  if (normalizedActionType === 'ignored') {
    record.ignoredBy = user;
    record.ignoredAt = timestamp;
  }

  if (normalizedActionType === 'link-added') {
    record.createdBy = user;
  }

  const records = getIntakeAuditRecords_();
  records.push(record);
  saveIntakeAuditRecords_(records.slice(Math.max(records.length - INTAKE_AUDIT_MAX_RECORDS, 0)));

  return {
    status: 'Success',
    success: true,
    message: buildIntakeAuditActionMessage_(normalizedActionType),
    generatedAt: timestamp,
    record: record
  };
}

function buildIntakeAuditActionMessage_(actionType) {
  if (actionType === 'ignored') {
    return 'Intake recommendation ignored in dashboard audit history.';
  }

  if (actionType === 'link-added') {
    return 'Operational link added from Intake Workspace.';
  }

  return 'Intake issue marked reviewed in dashboard audit history.';
}

function getIntakeAuditRecords_() {
  const properties = PropertiesService.getScriptProperties();
  const rawValue = properties.getProperty(INTAKE_AUDIT_PROPERTY_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    Logger.log('Failed to parse intake audit records: ' + err.message);
    return [];
  }
}

function saveIntakeAuditRecords_(records) {
  const safeRecords = Array.isArray(records) ? records : [];
  PropertiesService
    .getScriptProperties()
    .setProperty(INTAKE_AUDIT_PROPERTY_KEY, JSON.stringify(safeRecords));
}

function getIntakeAuditUser_() {
  try {
    const activeUser = Session.getActiveUser();
    const activeEmail = activeUser && activeUser.getEmail ? activeUser.getEmail() : '';

    if (activeEmail) {
      return activeEmail;
    }
  } catch (err) {
    Logger.log('Unable to read active audit user: ' + err.message);
  }

  try {
    const effectiveUser = Session.getEffectiveUser();
    const effectiveEmail = effectiveUser && effectiveUser.getEmail ? effectiveUser.getEmail() : '';

    if (effectiveEmail) {
      return effectiveEmail;
    }
  } catch (err2) {
    Logger.log('Unable to read effective audit user: ' + err2.message);
  }

  return 'unknown';
}
