const DASHBOARD_CONFIG = {
  dashboardTitle: 'Automation Dashboard',
  logSpreadsheetName: 'Automation Run Log',
  logSheetName: 'Runs',

  automations: [
    {
      id: 'claim-folder-automation',
      name: 'Claim Folder Automation',
      category: 'Claims / Gmail',
      mainFunction: 'processGmailLabels',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbxU3gezv9qcXA7LiNP5e7KD2pOvSaW5cAG4Jjk1nY-Uy8LE5Bibdclef2pSE1cHPndoyw/exec'
    },
    {
      id: 'add-new-job-to-calendar',
      name: 'Add New Job to Calendar',
      category: 'Calendar / Gmail',
      mainFunction: 'processEmailsToCalendar',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbxXVe8Lg1d7Da0RdR5nJujatv2bg4hkP8OjJrktzyDlB5L30QJnk4JU9ZDzPJD5CkudJA/exec'
    },
    {
      id: 'insurance-intake-automation',
      name: 'Insurance Intake Automation',
      category: 'Insurance / Gmail / Todoist',
      mainFunction: 'processInsuranceIntake',
      action: 'process',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'asbestos-attachment-intake',
      name: 'Asbestos Attachment Intake',
      category: 'Vendor Attachments / Gmail / Drive',
      mainFunction: 'processAsbestosAttachments',
      action: 'processAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'itel-attachment-intake',
      name: 'Itel Attachment Intake',
      category: 'Vendor Attachments / Gmail / Drive',
      mainFunction: 'processItelAttachments',
      action: 'processItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'phase-4f-queue-health',
      name: 'Phase 4F Queue Health',
      category: 'Operations / Monitoring',
      mainFunction: 'getQueueHealth',
      action: 'queueHealth',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'asbestos-queue-health',
      name: 'Asbestos Queue Health',
      category: 'Operations / Monitoring',
      mainFunction: 'getAsbestosQueueHealth',
      action: 'queueHealthAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'itel-queue-health',
      name: 'Itel Queue Health',
      category: 'Operations / Monitoring',
      mainFunction: 'getItelQueueHealth',
      action: 'queueHealthItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'retry-insurance-intake',
      name: 'Retry Insurance Intake',
      category: 'Recovery / Retry',
      mainFunction: 'retryWorkflow',
      action: 'retryInsuranceIntake',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'retry-asbestos-intake',
      name: 'Retry Asbestos',
      category: 'Recovery / Retry',
      mainFunction: 'retryWorkflow',
      action: 'retryAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'retry-itel-intake',
      name: 'Retry Itel',
      category: 'Recovery / Retry',
      mainFunction: 'retryWorkflow',
      action: 'retryItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'setup-retry-triggers',
      name: 'Setup Scheduled Retry Triggers',
      category: 'Recovery / Retry Operations',
      mainFunction: 'setupRetryTriggers',
      action: 'setupRetryTriggers',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'delete-retry-triggers',
      name: 'Delete Scheduled Retry Triggers',
      category: 'Recovery / Retry Operations',
      mainFunction: 'deleteRetryTriggers',
      action: 'deleteRetryTriggers',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    },
    {
      id: 'insurance-intake-queue-health',
      name: 'Insurance Intake Queue Health',
      category: 'Operations / Monitoring',
      mainFunction: 'getInsuranceIntakeQueueHealth',
      action: 'queueHealthInsuranceIntake',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzlnyEHz_YY-xklbciClyvtiM5y3jOofg13hloeHmL9voOQDpGsBY3Mv9u3Yaq64GSO6Q/exec'
    }
  ]
};

const STATUS = {
  SUCCESS: 'Success',
  ERROR: 'Error',
  NOT_RUN: 'Not Run'
};

const FETCH_TIMEOUT_MS = 30000;

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(DASHBOARD_CONFIG.dashboardTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDashboardData() {
  const properties = PropertiesService.getScriptProperties();

  const automations = DASHBOARD_CONFIG.automations.map(function (automation) {
    const saved = getSavedStatus_(automation.id, properties);

    return {
      id: automation.id,
      name: automation.name,
      category: automation.category,
      mainFunction: automation.mainFunction,
      action: automation.action || 'process',
      lastRunTime: saved.lastRunTime || '',
      lastStatus: saved.lastStatus || STATUS.NOT_RUN,
      lastMessage: saved.lastMessage || 'This automation has not run from the dashboard yet.'
    };
  });

  return {
    title: DASHBOARD_CONFIG.dashboardTitle,
    automations: automations
  };
}

function runAutomation(automationId) {
  const automation = DASHBOARD_CONFIG.automations.find(function (item) {
    return item.id === automationId;
  });

  if (!automation) {
    throw new Error('Unknown automation ID: ' + automationId);
  }

  const startedAt = new Date();
  let endedAt = null;
  let status = STATUS.ERROR;
  let message = '';
  let responseCode = '';
  let rawResponse = '';

  try {
    validateAutomationUrl_(automation.webAppUrl);

    const url = buildAutomationUrl_(automation.webAppUrl, {
      action: automation.action || 'process',
      source: 'dashboard',
      automationId: automation.id,
      runId: Utilities.getUuid()
    });

    const response = fetchWithRedirects_(url);

    endedAt = new Date();
    responseCode = response.getResponseCode();
    rawResponse = response.getContentText();

    if (responseCode < 200 || responseCode >= 300) {
      status = STATUS.ERROR;
      message = 'HTTP ' + responseCode + ': ' + truncate_(rawResponse, 500);
    } else {
      const parsed = parseAutomationResponse_(rawResponse);

      if (parsed && parsed.status && parsed.message) {
        status = normalizeStatus_(parsed.status);
        message = parsed.message;
      } else if (parsed) {
        status = STATUS.SUCCESS;
        message = JSON.stringify(parsed) || 'Automation completed.';
      } else {
        status = STATUS.SUCCESS;
        message = rawResponse || 'Automation completed.';
      }
    }
  } catch (err) {
    endedAt = new Date();
    status = STATUS.ERROR;
    message = err && err.message ? err.message : String(err);
  }

  const durationMs = endedAt.getTime() - startedAt.getTime();

  const runRecord = {
    timestamp: endedAt,
    automationId: automation.id,
    automationName: automation.name,
    category: automation.category,
    mainFunction: automation.mainFunction,
    status: status,
    message: message,
    startedAt: startedAt,
    endedAt: endedAt,
    durationMs: durationMs,
    responseCode: responseCode,
    rawResponse: rawResponse
  };

  appendRunLog_(runRecord);
  saveLatestStatus_(runRecord);

  return {
    id: automation.id,
    name: automation.name,
    category: automation.category,
    lastRunTime: formatDateTime_(endedAt),
    lastStatus: status,
    lastMessage: message,
    durationMs: durationMs
  };
}

function getRunLogUrl() {
  const spreadsheet = getOrCreateLogSpreadsheet_();
  return spreadsheet.getUrl();
}

function validateConfiguration_() {
  if (!DASHBOARD_CONFIG.automations || DASHBOARD_CONFIG.automations.length === 0) {
    throw new Error('No automations configured in DASHBOARD_CONFIG.');
  }

  DASHBOARD_CONFIG.automations.forEach(function(automation) {
    if (!automation.id || !automation.name || !automation.webAppUrl) {
      throw new Error('Automation missing required fields: id, name, webAppUrl');
    }

    if (!automation.action) {
      automation.action = 'process';
    }

    validateAutomationUrl_(automation.webAppUrl);
  });
}

function fetchWithRedirects_(url) {
  let currentUrl = url;
  const maxRedirects = 5;

  for (let i = 0; i < maxRedirects; i++) {
    const response = UrlFetchApp.fetch(currentUrl, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: false,
      timeout: FETCH_TIMEOUT_MS
    });

    const code = response.getResponseCode();

    if (code === 301 || code === 302 || code === 303 || code === 307 || code === 308) {
      const headers = response.getHeaders();
      const location = headers.Location || headers.location;

      if (!location) {
        return response;
      }

      Logger.log('Redirect ' + code + ' to: ' + location);
      currentUrl = location;
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects (>' + maxRedirects + ') while calling automation web app.');
}

function getOrCreateLogSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty('LOG_SPREADSHEET_ID');

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (err) {
      Logger.log('Previous log spreadsheet not found, creating new one: ' + err.message);
      properties.deleteProperty('LOG_SPREADSHEET_ID');
    }
  }

  const spreadsheet = SpreadsheetApp.create(DASHBOARD_CONFIG.logSpreadsheetName);
  properties.setProperty('LOG_SPREADSHEET_ID', spreadsheet.getId());

  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(DASHBOARD_CONFIG.logSheetName);
  setupLogSheet_(sheet);

  return spreadsheet;
}

function getLogSheet_() {
  const spreadsheet = getOrCreateLogSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(DASHBOARD_CONFIG.logSheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(DASHBOARD_CONFIG.logSheetName);
    setupLogSheet_(sheet);
  }

  ensureLogHeaders_(sheet);
  return sheet;
}

function setupLogSheet_(sheet) {
  sheet.clear();

  sheet.appendRow([
    'Timestamp',
    'Automation ID',
    'Automation Name',
    'Category',
    'Main Function',
    'Status',
    'Message',
    'Started At',
    'Ended At',
    'Duration MS',
    'HTTP Response Code',
    'Raw Response'
  ]);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 12);
}

function ensureLogHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    setupLogSheet_(sheet);
    return;
  }

  const firstCell = sheet.getRange(1, 1).getValue();

  if (firstCell !== 'Timestamp') {
    setupLogSheet_(sheet);
  }
}

function appendRunLog_(record) {
  try {
    const sheet = getLogSheet_();

    sheet.appendRow([
      formatDateTime_(record.timestamp),
      record.automationId,
      record.automationName,
      record.category,
      record.mainFunction,
      record.status,
      record.message,
      formatDateTime_(record.startedAt),
      formatDateTime_(record.endedAt),
      record.durationMs,
      record.responseCode,
      truncate_(record.rawResponse, 2000)
    ]);
  } catch (err) {
    Logger.log('ERROR: Failed to append run log - ' + err.message);
    Logger.log('Record: ' + JSON.stringify(record));
  }
}

function saveLatestStatus_(record) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const prefix = 'AUTOMATION_STATUS_' + record.automationId + '_';

    properties.setProperty(prefix + 'LAST_RUN_TIME', formatDateTime_(record.endedAt));
    properties.setProperty(prefix + 'LAST_STATUS', record.status);
    properties.setProperty(prefix + 'LAST_MESSAGE', truncate_(record.message, 1000));
  } catch (err) {
    Logger.log('ERROR: Failed to save status - ' + err.message);
  }
}

function getSavedStatus_(automationId, properties) {
  try {
    const prefix = 'AUTOMATION_STATUS_' + automationId + '_';

    return {
      lastRunTime: properties.getProperty(prefix + 'LAST_RUN_TIME'),
      lastStatus: properties.getProperty(prefix + 'LAST_STATUS'),
      lastMessage: properties.getProperty(prefix + 'LAST_MESSAGE')
    };
  } catch (err) {
    Logger.log('ERROR: Failed to get saved status - ' + err.message);
    return {
      lastRunTime: null,
      lastStatus: STATUS.NOT_RUN,
      lastMessage: 'Error loading status'
    };
  }
}

function buildAutomationUrl_(baseUrl, params) {
  const query = Object.keys(params)
    .map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    })
    .join('&');

  return baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') + query;
}

function validateAutomationUrl_(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Missing or invalid web app URL (not a string).');
  }

  if (url.indexOf('https://script.google.com/') !== 0) {
    throw new Error('Invalid web app URL. Must start with https://script.google.com/');
  }

  if (url.toUpperCase().indexOf('PASTE') !== -1) {
    throw new Error('Web app URL not configured (contains PASTE placeholder). Update DASHBOARD_CONFIG.');
  }

  if (url.length > 500) {
    throw new Error('Web app URL exceeds maximum length.');
  }
}

function parseAutomationResponse_(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(text);

    if (!parsed.status || !parsed.message) {
      Logger.log('WARN: Response missing required fields (status, message): ' + text);
      return null;
    }

    return parsed;
  } catch (err) {
    Logger.log('WARN: Failed to parse automation response as JSON: ' + text);
    return null;
  }
}

function normalizeStatus_(status) {
  const value = String(status || '').toLowerCase().trim();

  if (value === 'success' || value === 'ok' || value === 'completed') {
    return STATUS.SUCCESS;
  }

  if (value === 'error' || value === 'failed' || value === 'failure') {
    return STATUS.ERROR;
  }

  return status;
}

function formatDateTime_(date) {
  if (!date || !(date instanceof Date)) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss'
  );
}

function truncate_(value, maxLength) {
  const text = value === null || value === undefined ? '' : String(value);

  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + '...';
}

function testDashboardConfiguration() {
  Logger.log('=== DASHBOARD CONFIGURATION TEST ===');

  try {
    validateConfiguration_();
    Logger.log('✓ Configuration is valid');
  } catch (err) {
    Logger.log('✗ Configuration error: ' + err.message);
    return;
  }

  Logger.log('✓ Found ' + DASHBOARD_CONFIG.automations.length + ' automation(s)');

  DASHBOARD_CONFIG.automations.forEach(function(automation) {
    Logger.log('  - ' + automation.name + ' (' + automation.id + ')');
    Logger.log('    Action: ' + (automation.action || 'process'));
    Logger.log('    URL: ' + automation.webAppUrl);
  });

  Logger.log('✓ Log spreadsheet: ' + getOrCreateLogSpreadsheet_().getUrl());
  Logger.log('✓ Timeout: ' + FETCH_TIMEOUT_MS + 'ms');
}

function clearAllSavedStatuses() {
  const properties = PropertiesService.getScriptProperties();
  const allProps = properties.getProperties();

  let cleared = 0;
  Object.keys(allProps).forEach(function(key) {
    if (key.indexOf('AUTOMATION_STATUS_') === 0) {
      properties.deleteProperty(key);
      cleared++;
    }
  });

  Logger.log('Cleared ' + cleared + ' status properties');
}


function clearLegacyEmslDashboardStatus() {
  const properties = PropertiesService.getScriptProperties();
  const allProps = properties.getProperties();
  const legacyPrefix = 'AUTOMATION_STATUS_emsl-attachment-intake_';

  let cleared = 0;
  Object.keys(allProps).forEach(function(key) {
    if (key.indexOf(legacyPrefix) === 0) {
      properties.deleteProperty(key);
      cleared++;
    }
  });

  Logger.log('Cleared ' + cleared + ' legacy EMSL dashboard status properties');
}