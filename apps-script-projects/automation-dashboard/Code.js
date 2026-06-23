const DASHBOARD_CONFIG = {
  dashboardTitle: 'Automation Dashboard',
  logSpreadsheetName: 'Automation Run Log',
  logSheetName: 'Runs',
  automations: [
    {
      id: 'claim-folder-automation',
      name: 'Claim Folder Automation',
      category: 'Claims / Gmail',
      dashboardRole: 'business',
      mainFunction: 'processGmailLabels',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbxU3gezv9qcXA7LiNP5e7KD2pOvSaW5cAG4Jjk1nY-Uy8LE5Bibdclef2pSE1cHPndoyw/exec'
    },
    {
      id: 'add-new-job-to-calendar',
      name: 'Add New Job to Calendar',
      category: 'Calendar / Gmail',
      dashboardRole: 'business',
      mainFunction: 'processEmailsToCalendar',
      action: 'process',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbxXVe8Lg1d7Da0RdR5nJujatv2bg4hkP8OjJrktzyDlB5L30QJnk4JU9ZDzPJD5CkudJA/exec'
    },
    {
      id: 'insurance-intake-automation',
      name: 'Insurance Intake Automation',
      category: 'Insurance / Gmail / Todoist',
      dashboardRole: 'business',
      mainFunction: 'processInsuranceIntake',
      action: 'process',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'asbestos-attachment-intake',
      name: 'Asbestos Attachment Intake',
      category: 'Vendor Attachments / Gmail / Drive',
      dashboardRole: 'business',
      mainFunction: 'processAsbestosAttachments',
      action: 'processAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'itel-attachment-intake',
      name: 'Itel Attachment Intake',
      category: 'Vendor Attachments / Gmail / Drive',
      dashboardRole: 'business',
      mainFunction: 'processItelAttachments',
      action: 'processItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'phase-4f-queue-health',
      name: 'Phase 4F Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getQueueHealth',
      action: 'queueHealth',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'asbestos-queue-health',
      name: 'Asbestos Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getAsbestosQueueHealth',
      action: 'queueHealthAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'itel-queue-health',
      name: 'Itel Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getItelQueueHealth',
      action: 'queueHealthItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'inspect-asbestos-pending-claim-folders',
      name: 'Inspect Asbestos Pending Folders',
      category: 'Recovery / Inspection',
      dashboardRole: 'operations',
      mainFunction: 'inspectAsbestosPendingClaimFolders',
      action: 'inspectAsbestosPendingClaimFolders',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'inspect-itel-pending-claim-folders',
      name: 'Inspect Itel Pending Folders',
      category: 'Recovery / Inspection',
      dashboardRole: 'operations',
      mainFunction: 'inspectItelPendingClaimFolders',
      action: 'inspectItelPendingClaimFolders',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'retry-insurance-intake',
      name: 'Retry Insurance Intake',
      category: 'Recovery / Retry',
      dashboardRole: 'operations',
      mainFunction: 'retryWorkflow',
      action: 'retryInsuranceIntake',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'retry-asbestos-intake',
      name: 'Retry Asbestos',
      category: 'Recovery / Retry',
      dashboardRole: 'operations',
      mainFunction: 'retryWorkflow',
      action: 'retryAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'retry-itel-intake',
      name: 'Retry Itel',
      category: 'Recovery / Retry',
      dashboardRole: 'operations',
      mainFunction: 'retryWorkflow',
      action: 'retryItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'setup-retry-triggers',
      name: 'Setup Scheduled Retry Triggers',
      category: 'Recovery / Retry Operations',
      dashboardRole: 'operations',
      mainFunction: 'setupRetryTriggers',
      action: 'setupRetryTriggers',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'delete-retry-triggers',
      name: 'Delete Scheduled Retry Triggers',
      category: 'Recovery / Retry Operations',
      dashboardRole: 'operations',
      mainFunction: 'deleteRetryTriggers',
      action: 'deleteRetryTriggers',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'insurance-intake-queue-health',
      name: 'Insurance Intake Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getInsuranceIntakeQueueHealth',
      action: 'queueHealthInsuranceIntake',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbwshKDgCg6BeP7CHMDr--lXcM9jUuM78A5XBHT8EVyBdzjjrniQNudmjzf4ahhQuhwW4g/exec'
    },
    {
      id: 'revision-intake-queue-health',
      name: 'Revision Intake Queue Health',
      category: 'Operations / Monitoring / Revisions',
      dashboardRole: 'monitoring',
      mainFunction: 'getRevisionIntakeQueueHealth',
      action: 'queueHealth',
      webAppUrl: 'https://script.google.com/macros/s/AKfycbzkylsv4ZcIEtr8glyk77ik5Jq9I4Mo9ORySzluNisZzjmT5ag6J1Q8_V7CeC35vqxs/exec'
    },
    {
      id: 'revision-todoist-review-needed',
      name: 'Revision Todoist Review Needed',
      category: 'Operations / Monitoring / Revisions',
      dashboardRole: 'operations',
      mainFunction: 'listRevisionTodoistReviewNeeded',
      action: 'listTodoistReviewNeeded',
      webAppUrl: 'https://script.google.com/macros/s/AKfycbzkylsv4ZcIEtr8glyk77ik5Jq9I4Mo9ORySzluNisZzjmT5ag6J1Q8_V7CeC35vqxs/exec'
    },
    {
      id: 'revision-intake-process',
      name: 'Process Revision Intake',
      category: 'Revision Intake / Processing',
      dashboardRole: 'business',
      mainFunction: 'processRevisionIntake',
      action: 'process',
      webAppUrl: 'https://script.google.com/macros/s/AKfycbzkylsv4ZcIEtr8glyk77ik5Jq9I4Mo9ORySzluNisZzjmT5ag6J1Q8_V7CeC35vqxs/exec'
    },
    {
      id: 'revision-enrich-claim-data',
      name: 'Enrich Revision Claim Data',
      category: 'Revision Intake / Enrichment',
      dashboardRole: 'operations',
      mainFunction: 'enrichRevisionClaimData',
      action: 'enrichFromClaimFolders',
      webAppUrl: 'https://script.google.com/macros/s/AKfycbzkylsv4ZcIEtr8glyk77ik5Jq9I4Mo9ORySzluNisZzjmT5ag6J1Q8_V7CeC35vqxs/exec'
    },
    {
      id: 'revision-reclassify-existing',
      name: 'Reclassify Existing Revisions',
      category: 'Revision Intake / Learning',
      dashboardRole: 'operations',
      mainFunction: 'reclassifyExistingRevisions',
      action: 'reclassifyExisting',
      webAppUrl: 'https://script.google.com/macros/s/AKfycbzkylsv4ZcIEtr8glyk77ik5Jq9I4Mo9ORySzluNisZzjmT5ag6J1Q8_V7CeC35vqxs/exec'
    },
    {
      id: 'revision-refresh-todoist-tasks',
      name: 'Refresh Revision Todoist Tasks',
      category: 'Revision Intake / Todoist',
      dashboardRole: 'operations',
      mainFunction: 'refreshRevisionTodoistTasks',
      action: 'refreshTodoistTasks',
      webAppUrl: 'https://script.google.com/macros/s/AKfycbzkylsv4ZcIEtr8glyk77ik5Jq9I4Mo9ORySzluNisZzjmT5ag6J1Q8_V7CeC35vqxs/exec'
    }
  ]
};

const DASHBOARD_SECTIONS = [
  {
    id: 'operations',
    name: 'Operations',
    description: 'Daily operational controls, queue health, recovery, and inspection tools.',
    order: 1
  },
  {
    id: 'automations',
    name: 'Automations',
    description: 'Active workflow automations that process Gmail, Drive, Calendar, and job data.',
    order: 2
  },
  {
    id: 'reports',
    name: 'Reports',
    description: 'Reporting workflows and future report automation placeholders.',
    order: 3
  },
  {
    id: 'system',
    name: 'System',
    description: 'Logs, deployment support, diagnostics, and platform utilities.',
    order: 4
  }
];

const PLACEHOLDER_WORKFLOWS = [
  {
    id: 'clarence-bonus-report',
    name: 'Clarence Bonus Report',
    section: 'reports',
    category: 'Monthly Reporting',
    dashboardRole: 'placeholder',
    status: 'Planned',
    frequency: 'Monthly',
    description: 'Future workflow for consolidating QB and Fusion exports into monthly Rainbow reporting outputs.',
    plannedCapabilities: [
      'Import QB export',
      'Import Fusion export',
      'Consolidate matched jobs',
      'Write monthly Google Sheet tab',
      'Generate Excel and HTML reports',
      'Create Todoist reminders'
    ]
  },
  {
    id: 'monthly-consolidation-report',
    name: 'Monthly Consolidation Report',
    section: 'reports',
    category: 'Monthly Reporting',
    dashboardRole: 'placeholder',
    status: 'Planned',
    frequency: 'Monthly',
    description: 'Future monthly reporting workflow for consolidated job and financial activity reporting.',
    plannedCapabilities: [
      'Import monthly exports',
      'Normalize report data',
      'Generate summary metrics',
      'Upload report outputs'
    ]
  },
  {
    id: 'open-jobs-activity-report',
    name: 'Open Jobs Activity Report',
    section: 'reports',
    category: 'Job Intelligence',
    dashboardRole: 'placeholder',
    status: 'Planned',
    frequency: 'Daily / Weekly',
    description: 'Future workflow that scans daily open jobs emails and identifies jobs with no recent activity or weekly status exceptions.',
    plannedCapabilities: [
      'Scan Gmail for daily open jobs email',
      'Extract spreadsheet attachment rows',
      'Apply configurable no-activity thresholds',
      'Apply status exception rules',
      'Generate daily and weekly watchlists',
      'Optionally create Todoist follow-ups'
    ]
  },
  {
    id: 'production-metrics-report',
    name: 'Production Metrics',
    section: 'reports',
    category: 'Performance Reporting',
    dashboardRole: 'placeholder',
    status: 'Planned',
    frequency: 'Future',
    description: 'Future reporting workflow for production volume, activity, and team performance metrics.',
    plannedCapabilities: [
      'Collect production data',
      'Calculate performance metrics',
      'Render dashboard summaries'
    ]
  },
  {
    id: 'job-profitability-report',
    name: 'Job Profitability',
    section: 'reports',
    category: 'Financial Reporting',
    dashboardRole: 'placeholder',
    status: 'Planned',
    frequency: 'Future',
    description: 'Future reporting workflow for profitability review and job-level financial analysis.',
    plannedCapabilities: [
      'Collect job financial data',
      'Calculate profitability metrics',
      'Generate exception lists'
    ]
  },
  {
    id: 'eoj-completion-audit',
    name: 'EOJ Completion Audit',
    section: 'operations',
    category: 'EOJ / Compliance',
    dashboardRole: 'placeholder',
    status: 'Planned',
    frequency: 'Daily',
    description: 'Future operational audit that scans yesterday’s calendar jobs and identifies missing EOJ submissions.',
    plannedCapabilities: [
      'Scan yesterday’s Google Calendar entries',
      'Extract job identifiers',
      'Compare against EOJ submissions',
      'List missing EOJs',
      'Optionally create follow-up tasks'
    ]
  }
];

const AUTOMATION_REGISTRY_DEFAULTS = {
  section: 'automations',
  dashboardRole: 'business',
  featured: false,
  order: 100,
  capabilities: {
    process: false,
    retry: false,
    inspect: false,
    queueHealth: false,
    report: false,
    system: false,
    placeholder: false
  }
};

const AUTOMATION_REGISTRY = {
  'insurance-intake-automation': {
    section: 'automations',
    featured: true,
    order: 10,
    capabilities: {
      process: true,
      retry: true,
      inspect: true,
      queueHealth: true
    }
  },
  'asbestos-attachment-intake': {
    section: 'automations',
    featured: true,
    order: 20,
    capabilities: {
      process: true,
      retry: true,
      inspect: true,
      queueHealth: true
    }
  },
  'itel-attachment-intake': {
    section: 'automations',
    featured: true,
    order: 30,
    capabilities: {
      process: true,
      retry: true,
      inspect: true,
      queueHealth: true
    }
  },
  'claim-folder-automation': {
    section: 'automations',
    featured: false,
    order: 40,
    capabilities: {
      process: true
    }
  },
  'add-new-job-to-calendar': {
    section: 'automations',
    featured: false,
    order: 50,
    capabilities: {
      process: true
    }
  },
  'phase-4f-queue-health': {
    section: 'operations',
    featured: false,
    order: 100,
    capabilities: {
      process: false,
      queueHealth: true
    }
  },
  'insurance-intake-queue-health': {
    section: 'operations',
    featured: false,
    order: 110,
    capabilities: {
      process: false,
      queueHealth: true
    }
  },
  'revision-intake-queue-health': {
    section: 'operations',
    featured: false,
    order: 115,
    capabilities: {
      process: false,
      queueHealth: true
    }
  },
  'revision-todoist-review-needed': {
    section: 'operations',
    featured: false,
    order: 116,
    capabilities: {
      process: false,
      inspect: true
    }
  },
  'revision-intake-process': {
    section: 'automations',
    featured: true,
    order: 35,
    capabilities: {
      process: true,
      queueHealth: true
    }
  },
  'revision-enrich-claim-data': {
    section: 'operations',
    featured: false,
    order: 117,
    capabilities: {
      process: false,
      inspect: true
    }
  },
  'revision-reclassify-existing': {
    section: 'operations',
    featured: false,
    order: 118,
    capabilities: {
      process: false,
      inspect: true
    }
  },
  'revision-refresh-todoist-tasks': {
    section: 'operations',
    featured: false,
    order: 119,
    capabilities: {
      process: false,
      retry: true
    }
  },
  'asbestos-queue-health': {
    section: 'operations',
    featured: false,
    order: 120,
    capabilities: {
      process: false,
      queueHealth: true
    }
  },
  'itel-queue-health': {
    section: 'operations',
    featured: false,
    order: 130,
    capabilities: {
      process: false,
      queueHealth: true
    }
  },
  'inspect-asbestos-pending-claim-folders': {
    section: 'operations',
    featured: false,
    order: 200,
    capabilities: {
      process: false,
      inspect: true
    }
  },
  'inspect-itel-pending-claim-folders': {
    section: 'operations',
    featured: false,
    order: 210,
    capabilities: {
      process: false,
      inspect: true
    }
  },
  'retry-insurance-intake': {
    section: 'automations',
    featured: false,
    order: 300,
    capabilities: {
      process: false,
      retry: true
    }
  },
  'retry-asbestos-intake': {
    section: 'automations',
    featured: false,
    order: 310,
    capabilities: {
      process: false,
      retry: true
    }
  },
  'retry-itel-intake': {
    section: 'automations',
    featured: false,
    order: 320,
    capabilities: {
      process: false,
      retry: true
    }
  },
  'setup-retry-triggers': {
    section: 'operations',
    featured: false,
    order: 400,
    capabilities: {
      process: false,
      retry: true,
      system: true
    }
  },
  'delete-retry-triggers': {
    section: 'operations',
    featured: false,
    order: 410,
    capabilities: {
      process: false,
      retry: true,
      system: true
    }
  }
};

const AUTOMATION_REGISTRY_RULES = [
  {
    match: 'insurance',
    section: 'automations',
    featured: true,
    order: 10,
    capabilities: {
      process: true,
      retry: true,
      inspect: true,
      queueHealth: true
    }
  },
  {
    match: 'asbestos',
    section: 'automations',
    featured: true,
    order: 20,
    capabilities: {
      process: true,
      retry: true,
      inspect: true,
      queueHealth: true
    }
  },
  {
    match: 'itel',
    section: 'automations',
    featured: true,
    order: 30,
    capabilities: {
      process: true,
      retry: true,
      inspect: true,
      queueHealth: true
    }
  },
  {
    match: 'claim',
    section: 'automations',
    featured: false,
    order: 40,
    capabilities: {
      process: true,
      retry: false,
      inspect: false,
      queueHealth: false
    }
  },
  {
    match: 'calendar',
    section: 'automations',
    featured: false,
    order: 50,
    capabilities: {
      process: true,
      retry: false,
      inspect: false,
      queueHealth: false
    }
  },
  {
    match: 'queue-health',
    section: 'operations',
    featured: false,
    order: 200,
    capabilities: {
      process: false,
      retry: false,
      inspect: false,
      queueHealth: true
    }
  },
  {
    match: 'inspect',
    section: 'operations',
    featured: false,
    order: 210,
    capabilities: {
      process: false,
      retry: false,
      inspect: true,
      queueHealth: false
    }
  },
  {
    match: 'retry',
    section: 'automations',
    featured: false,
    order: 220,
    capabilities: {
      process: false,
      retry: true,
      inspect: false,
      queueHealth: false
    }
  },
  {
    match: 'report',
    section: 'reports',
    featured: false,
    order: 300,
    capabilities: {
      process: false,
      retry: false,
      inspect: false,
      queueHealth: false,
      report: true
    }
  }
];

const STATUS = {
  SUCCESS: 'Success',
  ERROR: 'Error',
  NOT_RUN: 'Not Run'
};

const FETCH_TIMEOUT_MS = 30000;

const CLAIMS_SERVICE_URL_FALLBACK = 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbzrsk0ixP_q0jrkDtXyXeTo7NjspbQvgRVC4m7XUWTam3CIkfF0oazo5NYYRhuDw5Pr3Q/exec';
const INTAKE_SOURCE_SERVICE_ID = 'insurance-intake-automation';
const INTAKE_OPERATIONAL_LINK_SHEET_NAME = 'External_Links';
const INTAKE_OPERATIONAL_LINK_RECENT_DAYS = 60;
const INTAKE_OPERATIONAL_LINK_MAX_CLAIMS = 30;
const INTAKE_OPERATIONAL_LINK_TYPES = [
  {
    id: 'fusion',
    storageValue: 'Fusion',
    missingLabel: 'Missing Fusion Link',
    actionLabel: 'Add Fusion Link',
    displayLabel: 'Fusion Link',
    matchValues: ['fusion', 'fusionfile', 'fusionlink']
  },
  {
    id: 'xact',
    storageValue: 'XactAnalysis/Symbility',
    missingLabel: 'Missing XA/Symbility Link',
    actionLabel: 'Add XA/Symbility Link',
    displayLabel: 'XA/Symbility Link',
    matchValues: ['xact', 'xactanalysis', 'xactimate', 'symbility', 'xactsymbility', 'xactanalysissymbility']
  },
  {
    id: 'claimx',
    storageValue: 'ClaimX',
    missingLabel: 'Missing ClaimX Link',
    actionLabel: 'Add ClaimX Link',
    displayLabel: 'ClaimX Link',
    matchValues: ['claimx'],
    allstateOnly: true
  }
];

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

function doGet(e) {
  const action = e && e.parameter ? String(e.parameter.action || '') : '';
  const view = e && e.parameter ? String(e.parameter.view || '') : '';

  if (action === 'getHomepageSummary' || action === 'getHomepageData') {
    return jsonResponse_(getHomepageSummary());
  }

  if (action === 'testHomepageService') {
    return jsonResponse_(testHomepageService_());
  }

  if (action === 'testHomepageOperationalIntelligence') {
    return jsonResponse_(testHomepageOperationalIntelligence());
  }

  if (action === 'getHomepagePriorityFeed') {
    return jsonResponse_(getHomepagePriorityFeed());
  }

  if (action === 'getHomepageComplianceSummary') {
    return jsonResponse_(getHomepageComplianceSummary());
  }

  if (action === 'getIntakeWorkspaceSummary') {
    return jsonResponse_(getIntakeWorkspaceSummary());
  }

  if (action === 'getIntakeAuditHistory') {
    return jsonResponse_(getIntakeAuditHistory());
  }

  if (action === 'testIntakeOperationalLinkEnrichmentShape') {
    return jsonResponse_(testIntakeOperationalLinkEnrichmentShape());
  }

  if (view === 'homepageShell' || view === 'homepage') {
    return HtmlService
      .createTemplateFromFile('HomepageShell')
      .evaluate()
      .setTitle('Rainbow Homepage')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (view === 'claimShell') {
    return renderClaimsShell_(e, 'Rainbow Claims Workspace');
  }

  if (view === 'intake') {
    return HtmlService
      .createTemplateFromFile('IntakeView')
      .evaluate()
      .setTitle('Rainbow Intake Workspace')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(DASHBOARD_CONFIG.dashboardTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderClaimsShell_(e, title) {
  const params = e && e.parameter ? e.parameter : {};
  const template = HtmlService.createTemplateFromFile('ClaimsShell');

  template.initialRouteContext = {
    view: String(params.view || 'claimShell'),
    lensId: String(params.lensId || params.lens || 'all'),
    ownership: String(params.ownership || params.ownershipArea || ''),
    ownershipArea: String(params.ownershipArea || params.ownership || ''),
    condition: String(params.condition || params.conditionType || ''),
    conditionType: String(params.conditionType || params.condition || ''),
    claimId: String(params.claimId || ''),
    compliance: String(params.compliance || '')
  };

  return template
    .evaluate()
    .setTitle(title || 'Rainbow Claims Workspace')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function testHomepageService_() {
  try {
    const payload = getHomepageSummary();
    const data = payload && payload.data ? payload.data : payload || {};

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      diagnostics: {
        hasPayload: !!payload,
        hasData: !!data,
        kpiCount: data.kpis && typeof data.kpis === 'object' ? Object.keys(data.kpis).length : 0,
        todayPriorityCount: Array.isArray(data.todayPriorities) ? data.todayPriorities.length : 0,
        todayScheduleCount: Array.isArray(data.todaySchedule) ? data.todaySchedule.length : 0,
        becomingStaleCount: Array.isArray(data.becomingStale) ? data.becomingStale.length : 0,
        recentActivityCount: Array.isArray(data.recentActivity) ? data.recentActivity.length : 0,
        operationalAlertCount: Array.isArray(data.operationalAlerts) ? data.operationalAlerts.length : 0,
        hasClaimSummary: !!data.claimSummary,
        hasSystemStatus: !!data.systemStatus
      },
      payload: payload
    };
  } catch (err) {
    return {
      success: false,
      generatedAt: new Date().toISOString(),
      error: err && err.message ? err.message : String(err)
    };
  }
}


function getHomepageData_() {
  const payload = getHomepageSummary();
  return payload && payload.data ? payload.data : payload || {};
}

function getHomepagePriorityFeed() {
  const data = getHomepageData_();

  return {
    status: 'Success',
    success: true,
    generatedAt: new Date().toISOString(),
    data: {
      priorityFeed: data.todayPriorities || data.priorityFeed || [],
      count: Array.isArray(data.todayPriorities)
        ? data.todayPriorities.length
        : (Array.isArray(data.priorityFeed) ? data.priorityFeed.length : 0)
    }
  };
}


function getHomepageComplianceSummary() {
  const data = getHomepageData_();
  const complianceActions = data.complianceActions || data.openComplianceActions || [];

  return {
    status: 'Success',
    success: true,
    generatedAt: new Date().toISOString(),
    data: {
      complianceSummary: data.complianceSummary || {},
      complianceActions: complianceActions,
      openComplianceActionCount: Array.isArray(complianceActions) ? complianceActions.length : 0
    }
  };
}

function getClaimsWorkspacePageData(options) {
  const routeOptions = options || {};

  return fetchClaimsServiceJson_('getClaimsWorkspace', {
    lensId: routeOptions.lensId || routeOptions.lens || 'all',
    lens: routeOptions.lens || routeOptions.lensId || 'all',
    ownership: routeOptions.ownership || routeOptions.ownershipArea || '',
    ownershipArea: routeOptions.ownershipArea || routeOptions.ownership || '',
    condition: routeOptions.condition || routeOptions.conditionType || '',
    conditionType: routeOptions.conditionType || routeOptions.condition || '',
    claimId: routeOptions.claimId || '',
    compliance: routeOptions.compliance || ''
  });
}

function getClaimDetailPageData(claimId) {
  return fetchClaimsServiceJson_('getClaimDetail', {
    claimId: claimId || ''
  });
}

function fetchClaimsServiceJson_(action, params) {
  const serviceUrl = getClaimsServiceUrl_();

  if (!serviceUrl) {
    return {
      status: 'Error',
      success: false,
      message: 'CLAIMS_SERVICE_URL is not configured.',
      action: action,
      generatedAt: new Date().toISOString()
    };
  }

  const url = buildAutomationUrl_(serviceUrl, Object.assign({
    action: action
  }, params || {}));

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
      timeout: FETCH_TIMEOUT_MS
    });

    const responseCode = response.getResponseCode();
    const text = response.getContentText();

    if (responseCode < 200 || responseCode >= 300) {
      return {
        status: 'Error',
        success: false,
        message: 'Claims service returned HTTP ' + responseCode,
        responseCode: responseCode,
        bodyPreview: truncate_(text, 1000),
        action: action,
        generatedAt: new Date().toISOString()
      };
    }

    return JSON.parse(text);
  } catch (err) {
    return {
      status: 'Error',
      success: false,
      message: err && err.message ? err.message : String(err),
      action: action,
      generatedAt: new Date().toISOString()
    };
  }
}

function getClaimsServiceUrl_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredUrl = properties.getProperty('CLAIMS_SERVICE_URL');

  return configuredUrl || CLAIMS_SERVICE_URL_FALLBACK;
}

function testClaimsWorkspaceDataBridge() {
  const claimsWorkspaceResponse = getClaimsWorkspacePageData({ lensId: 'all' });
  const claimDetailResponse = getClaimDetailPageData('CLM-26A-0052-WTR');

  const result = {
    status: 'Success',
    claimsServiceUrlConfigured: !!getClaimsServiceUrl_(),
    claimsServiceUrlSource: PropertiesService.getScriptProperties().getProperty('CLAIMS_SERVICE_URL') ? 'Script Properties' : 'Fallback Constant',
    claimsWorkspaceReturned: !!claimsWorkspaceResponse,
    claimsWorkspaceStatus: claimsWorkspaceResponse && claimsWorkspaceResponse.status ? claimsWorkspaceResponse.status : '',
    claimsWorkspaceSuccess: claimsWorkspaceResponse && claimsWorkspaceResponse.success !== undefined ? claimsWorkspaceResponse.success : '',
    claimsWorkspaceMessage: claimsWorkspaceResponse && claimsWorkspaceResponse.message ? claimsWorkspaceResponse.message : '',
    claimsWorkspaceKeys: claimsWorkspaceResponse && typeof claimsWorkspaceResponse === 'object' ? Object.keys(claimsWorkspaceResponse) : [],
    claimsWorkspaceTotalCount: claimsWorkspaceResponse && claimsWorkspaceResponse.claimsList
      ? claimsWorkspaceResponse.claimsList.totalCount
      : null,
    claimDetailReturned: !!claimDetailResponse,
    claimDetailStatus: claimDetailResponse && claimDetailResponse.status ? claimDetailResponse.status : '',
    claimDetailSuccess: claimDetailResponse && claimDetailResponse.success !== undefined ? claimDetailResponse.success : '',
    claimDetailMessage: claimDetailResponse && claimDetailResponse.message ? claimDetailResponse.message : '',
    claimDetailKeys: claimDetailResponse && typeof claimDetailResponse === 'object' ? Object.keys(claimDetailResponse) : [],
    claimDetailClaimId: claimDetailResponse && claimDetailResponse.claimId
      ? claimDetailResponse.claimId
      : '',
    generatedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function getIntakeWorkspaceSummary() {
  const generatedAt = new Date().toISOString();
  const queueHealthResponse = fetchIntakeServiceJson_('queueHealth');
  const insuranceQueueHealthResponse = fetchIntakeServiceJson_('queueHealthInsuranceIntake');
  const diagnosticsResponse = fetchIntakeServiceJson_('diagnostics');
  const pendingInspectionResponse = fetchIntakeServiceJson_('inspectPendingClaimFolders');
  const auditState = getIntakeAuditState_();

  const queueResult = queueHealthResponse && queueHealthResponse.result
    ? queueHealthResponse.result
    : {};
  const queueWorkflows = queueResult.workflows || {};
  const insuranceWorkflow = queueWorkflows.insuranceIntake
    || getWorkflowHealthFromSingleQueueResponse_(insuranceQueueHealthResponse);
  const asbestosWorkflow = queueWorkflows.asbestos || {};
  const itelWorkflow = queueWorkflows.itel || {};

  const workflows = {
    insuranceIntake: normalizeIntakeWorkflowHealth_('insuranceIntake', insuranceWorkflow, 'Insurance Intake'),
    asbestos: normalizeIntakeWorkflowHealth_('asbestos', asbestosWorkflow, 'Asbestos Attachment Intake'),
    itel: normalizeIntakeWorkflowHealth_('itel', itelWorkflow, 'Itel Attachment Intake')
  };

  const pendingClaimFolders = normalizePendingClaimFolderInspection_(pendingInspectionResponse, auditState);
  const operationalLinkEnrichment = getIntakeOperationalLinkEnrichment_(auditState);
  const unresolvedItems = buildIntakeUnresolvedItems_(workflows, pendingClaimFolders, auditState)
    .concat(operationalLinkEnrichment.unresolvedItems || []);
  const actionableWorkflows = applyIntakeActionableCountsToWorkflows_(workflows, unresolvedItems);
  const workspaceTotals = calculateIntakeWorkspaceTotals_(actionableWorkflows, pendingClaimFolders, unresolvedItems);
  const sourceUnavailable = !isSuccessfulIntakeResponse_(queueHealthResponse);
  const workspaceStatus = sourceUnavailable
    ? 'Unavailable'
    : calculateIntakeWorkspaceHealth_(unresolvedItems);

  const workspaceHealth = {
    status: workspaceStatus,
    message: buildIntakeWorkspaceHealthMessage_(workspaceStatus, workspaceTotals),
    queueCount: workspaceTotals.queueCount,
    activeQueueCount: workspaceTotals.queueCount,
    pendingReviewCount: workspaceTotals.reviewCount,
    reviewCount: workspaceTotals.reviewCount,
    errorCount: workspaceTotals.errorCount,
    duplicateCount: workspaceTotals.duplicateCount,
    retryBacklogCount: workspaceTotals.retryBacklogCount,
    pendingClaimFolderCount: workspaceTotals.pendingClaimFolderCount,
    retryLimitReachedCount: workspaceTotals.retryLimitReachedCount,
    missingOperationalLinkCount: workspaceTotals.missingOperationalLinkCount,
    lastCheckedAt: workspaceTotals.lastCheckedAt || queueResult.finishedAt || queueResult.startedAt || generatedAt
  };

  return {
    status: sourceUnavailable ? 'Error' : 'Success',
    success: !sourceUnavailable,
    generatedAt: generatedAt,
    sourceService: INTAKE_SOURCE_SERVICE_ID,
    sourceServiceUrlConfigured: !!getIntakeSourceServiceUrl_(),
    workspaceHealth: workspaceHealth,
    workflows: actionableWorkflows,
    unresolvedItems: unresolvedItems,
    recentlyProcessed: buildIntakeRecentlyProcessedClaims_(operationalLinkEnrichment.visibilityItems || []),
    availableActions: buildIntakeWorkspaceActions_(),
    diagnostics: normalizeIntakeDiagnostics_(diagnosticsResponse),
    pendingClaimFolders: pendingClaimFolders,
    operationalLinkEnrichment: operationalLinkEnrichment,
    audit: {
      reviewedCount: auditState.records.filter(function(record) {
        return record.actionType === 'reviewed';
      }).length,
      ignoredCount: auditState.records.filter(function(record) {
        return record.actionType === 'ignored';
      }).length,
      recentRecords: auditState.records.slice(Math.max(auditState.records.length - 8, 0))
    },
    sourceResponses: {
      queueHealth: summarizeIntakeSourceResponse_(queueHealthResponse),
      insuranceQueueHealth: summarizeIntakeSourceResponse_(insuranceQueueHealthResponse),
      diagnostics: summarizeIntakeSourceResponse_(diagnosticsResponse),
      pendingClaimFolders: summarizeIntakeSourceResponse_(pendingInspectionResponse)
    }
  };
}

function runIntakeWorkspaceProcess() {
  try {
    const runResult = runAutomation(INTAKE_SOURCE_SERVICE_ID);
    const status = runResult && runResult.lastStatus ? runResult.lastStatus : STATUS.SUCCESS;

    return {
      status: status,
      success: status !== STATUS.ERROR,
      generatedAt: new Date().toISOString(),
      sourceService: INTAKE_SOURCE_SERVICE_ID,
      action: 'process',
      message: runResult && runResult.message ? runResult.message : 'Intake process completed.',
      result: runResult
    };
  } catch (err) {
    return {
      status: STATUS.ERROR,
      success: false,
      generatedAt: new Date().toISOString(),
      sourceService: INTAKE_SOURCE_SERVICE_ID,
      action: 'process',
      message: err && err.message ? err.message : String(err)
    };
  }
}

function saveIntakeOperationalLink(payload) {
  const linkPayload = payload || {};
  const claimId = String(linkPayload.claimId || '').trim();
  const linkTypeConfig = getIntakeOperationalLinkTypeConfig_(linkPayload.linkType);
  const url = String(linkPayload.url || '').trim();
  const timestamp = new Date().toISOString();
  const createdBy = getIntakeAuditUser_();

  if (!claimId) {
    return {
      status: 'Error',
      success: false,
      message: 'claimId is required.',
      generatedAt: timestamp
    };
  }

  if (!linkTypeConfig) {
    return {
      status: 'Error',
      success: false,
      message: 'Unsupported operational link type.',
      generatedAt: timestamp
    };
  }

  if (!/^https?:\/\//i.test(url)) {
    return {
      status: 'Error',
      success: false,
      message: 'Operational link URL must begin with https:// or http://.',
      generatedAt: timestamp
    };
  }

  const context = getIntakeExternalLinksContext_();

  if (!context.available) {
    return {
      status: 'Error',
      success: false,
      message: context.message || 'External_Links is unavailable.',
      generatedAt: timestamp
    };
  }

  const existingLink = findIntakeActiveExternalLink_(context.records, {
    claimId: claimId,
    claimNumber: String(linkPayload.claimNumber || '').trim(),
    jobNumber: String(linkPayload.jobNumber || '').trim()
  }, linkTypeConfig);

  if (existingLink) {
    return {
      status: 'Duplicate',
      success: false,
      message: linkTypeConfig.displayLabel + ' already exists for this claim.',
      claimId: claimId,
      linkType: linkTypeConfig.storageValue,
      generatedAt: timestamp,
      existingLink: {
        url: existingLink.url || '',
        linkType: existingLink.linkType || ''
      }
    };
  }

  const appendResult = appendIntakeExternalLink_(context, {
    claimId: claimId,
    claimNumber: String(linkPayload.claimNumber || '').trim(),
    linkType: linkTypeConfig.storageValue,
    linkTypeId: linkTypeConfig.id,
    label: linkTypeConfig.displayLabel,
    url: url,
    source: 'Intake Workspace',
    createdAt: timestamp,
    createdBy: createdBy,
    status: 'Active',
    isActive: true,
    notes: 'Operational link added from Intake Workspace.'
  });

  recordIntakeOperationalLinkAudit_({
    claimId: claimId,
    linkType: linkTypeConfig.storageValue,
    url: url,
    source: 'Intake Workspace',
    issueKey: 'operational-link-added|' + claimId + '|' + linkTypeConfig.id + '|' + timestamp,
    issueTitle: linkTypeConfig.displayLabel + ' added'
  });

  const alertReconciliation = reconcileClaimAlertsAfterIntakeLinkSave_(claimId);

  return {
    status: 'Success',
    success: true,
    message: linkTypeConfig.displayLabel + ' saved to External_Links.',
    claimId: claimId,
    linkType: linkTypeConfig.storageValue,
    generatedAt: timestamp,
    rowNumber: appendResult.rowNumber,
    alertReconciliation: alertReconciliation
  };
}

function reconcileClaimAlertsAfterIntakeLinkSave_(claimId) {
  if (!claimId) {
    return {
      status: 'Skipped',
      success: false,
      message: 'No claimId was provided for alert reconciliation.'
    };
  }

  try {
    const response = fetchClaimsServiceJson_('reconcileClaimAlerts', {
      claimId: claimId,
      dryRun: 'false',
      source: 'intake-operational-link-save'
    });

    return response || {
      status: 'Unknown',
      success: false,
      message: 'Claims service did not return a reconciliation response.'
    };
  } catch (err) {
    return {
      status: 'Error',
      success: false,
      message: err && err.message ? err.message : String(err)
    };
  }
}

function buildIntakeRecentlyProcessedClaims_(visibilityItems) {
  return (visibilityItems || [])
    .slice(0, 8)
    .map(function(item) {
      return {
        claimId: item.claimId || '',
        claimNumber: item.claimNumber || '',
        jobNumber: item.jobNumber || '',
        displayName: item.displayName || item.customerName || item.claimId || '',
        customerName: item.customerName || '',
        lifecycleState: item.lifecycleState || '',
        ownershipArea: item.ownershipArea || '',
        lastActivityAt: item.lastActivityAt || '',
        hasMissingOperationalLinks: !!item.hasMissingOperationalLinks,
        missingLinkTypes: item.missingLinkTypes || [],
        resolvedLinkTypes: item.resolvedLinkTypes || []
      };
    });
}

function fetchIntakeServiceJson_(action, params) {
  const serviceUrl = getIntakeSourceServiceUrl_();

  if (!serviceUrl) {
    return {
      status: 'Error',
      success: false,
      message: 'Insurance intake service URL is not configured.',
      action: action,
      generatedAt: new Date().toISOString()
    };
  }

  try {
    validateAutomationUrl_(serviceUrl);

    const url = buildAutomationUrl_(serviceUrl, Object.assign({
      action: action,
      source: 'automation-dashboard-intake-workspace'
    }, params || {}));
    const response = fetchWithRedirects_(url);
    const responseCode = response.getResponseCode();
    const text = response.getContentText();

    if (responseCode < 200 || responseCode >= 300) {
      return {
        status: 'Error',
        success: false,
        message: 'Insurance intake service returned HTTP ' + responseCode,
        responseCode: responseCode,
        bodyPreview: truncate_(text, 1000),
        action: action,
        generatedAt: new Date().toISOString()
      };
    }

    return JSON.parse(text);
  } catch (err) {
    return {
      status: 'Error',
      success: false,
      message: err && err.message ? err.message : String(err),
      action: action,
      generatedAt: new Date().toISOString()
    };
  }
}

function getIntakeSourceServiceUrl_() {
  const automation = getIntakeSourceAutomation_();
  return automation ? automation.webAppUrl : '';
}

function getIntakeSourceAutomation_() {
  return DASHBOARD_CONFIG.automations.find(function(automation) {
    return automation.id === INTAKE_SOURCE_SERVICE_ID;
  }) || null;
}

function getIntakeOperationalLinkEnrichment_(auditState) {
  try {
    const claims = getIntakeOperationalLinkCandidateClaims_();
    const linksContext = getIntakeExternalLinksContext_();

    if (!linksContext.available) {
      return {
        status: 'Unavailable',
        success: false,
        message: linksContext.message || 'External_Links could not be read.',
        checkedAt: new Date().toISOString(),
        unresolvedItems: [],
        visibilityItems: [],
        missingLinkCount: 0,
        candidateCount: claims.length,
        candidateClaimCount: claims.length,
        missingFusionCount: 0,
        missingXactCount: 0,
        actualExternalLinkHeaders: linksContext.headers || [],
        externalLinkHeaders: linksContext.headers || [],
        resolvedHeaderMap: linksContext.resolvedHeaderMap || {}
      };
    }

    const unresolvedItems = [];
    const visibilityItems = [];
    const missingCounts = {
      fusion: 0,
      xact: 0,
      claimx: 0
    };

    claims.forEach(function(claim) {
      const missingTypes = INTAKE_OPERATIONAL_LINK_TYPES.filter(function(linkTypeConfig) {
        return isIntakeOperationalLinkTypeRequiredForClaim_(linkTypeConfig, claim)
          && !findIntakeActiveExternalLink_(linksContext.records, claim, linkTypeConfig);
      });
      const resolvedTypes = INTAKE_OPERATIONAL_LINK_TYPES.filter(function(linkTypeConfig) {
        return isIntakeOperationalLinkTypeRequiredForClaim_(linkTypeConfig, claim)
          && !!findIntakeActiveExternalLink_(linksContext.records, claim, linkTypeConfig);
      });

      missingTypes.forEach(function(linkTypeConfig) {
        if (missingCounts.hasOwnProperty(linkTypeConfig.id)) {
          missingCounts[linkTypeConfig.id]++;
        }
      });

      const visibilityItem = Object.assign({}, claim, {
        missingLinkTypes: missingTypes.map(function(linkTypeConfig) {
          return buildIntakeOperationalLinkTypePayload_(linkTypeConfig);
        }),
        resolvedLinkTypes: resolvedTypes.map(function(linkTypeConfig) {
          return buildIntakeOperationalLinkTypePayload_(linkTypeConfig);
        }),
        hasMissingOperationalLinks: missingTypes.length > 0
      });
      visibilityItems.push(visibilityItem);

      if (!missingTypes.length) {
        return;
      }

      const issueKey = buildIntakeOperationalLinkIssueKey_(claim.claimId, missingTypes);

      if (isIntakeIssueClearedByAudit_(auditState, issueKey)) {
        return;
      }

      unresolvedItems.push({
        id: issueKey,
        issueType: 'missing-operational-link',
        filterType: 'missing-operational-link',
        title: missingTypes.length === 1 ? missingTypes[0].missingLabel : 'Missing Operational Links',
        severity: 'warning',
        count: missingTypes.length,
        message: 'Operational links stabilize the claim record; they do not block intake processing.',
        sourceWorkflow: 'claimFoundation',
        sourceWorkflowName: 'Claim Foundation',
        issueKey: issueKey,
        claimId: claim.claimId,
        claimNumber: claim.claimNumber,
        jobNumber: claim.jobNumber,
        displayName: claim.displayName,
        customerName: claim.customerName,
        carrierName: claim.carrierName,
        isAllstate: claim.isAllstate,
        lifecycleState: claim.lifecycleState,
        ownershipArea: claim.ownershipArea,
        lastActivityAt: claim.lastActivityAt,
        canReview: false,
        canIgnore: false,
        missingLinkTypes: missingTypes.map(function(linkTypeConfig) {
          return buildIntakeOperationalLinkTypePayload_(linkTypeConfig);
        }),
        resolvedLinkTypes: resolvedTypes.map(function(linkTypeConfig) {
          return buildIntakeOperationalLinkTypePayload_(linkTypeConfig);
        }),
        detailItems: [],
        workflows: [{
          key: 'claimFoundation',
          name: 'Claim Foundation',
          count: missingTypes.length,
          health: 'Warning'
        }]
      });
    });

    return {
      status: 'Success',
      success: true,
      checkedAt: new Date().toISOString(),
      unresolvedItems: unresolvedItems,
      visibilityItems: visibilityItems.slice(0, 10),
      missingLinkCount: unresolvedItems.reduce(function(total, item) {
        return total + normalizeIntakeMetricCount_(item.count);
      }, 0),
      candidateCount: claims.length,
      candidateClaimCount: claims.length,
      missingFusionCount: missingCounts.fusion,
      missingXactCount: missingCounts.xact,
      missingClaimXCount: missingCounts.claimx,
      externalLinkCount: linksContext.records.length,
      actualExternalLinkHeaders: linksContext.headers,
      externalLinkHeaders: linksContext.headers,
      resolvedHeaderMap: linksContext.resolvedHeaderMap
    };
  } catch (err) {
    return {
      status: 'Error',
      success: false,
      message: err && err.message ? err.message : String(err),
      checkedAt: new Date().toISOString(),
      unresolvedItems: [],
      visibilityItems: [],
      missingLinkCount: 0,
      candidateCount: 0,
      candidateClaimCount: 0,
      missingFusionCount: 0,
      missingXactCount: 0
    };
  }
}

function testIntakeOperationalLinkEnrichmentShape() {
  const enrichment = getIntakeOperationalLinkEnrichment_(getIntakeAuditState_());
  const unresolvedItems = enrichment.unresolvedItems || [];
  const visibilityItems = enrichment.visibilityItems || [];

  return {
    status: enrichment.status,
    success: enrichment.success,
    message: enrichment.message || '',
    checkedAt: enrichment.checkedAt || new Date().toISOString(),
    candidateCount: enrichment.candidateCount || enrichment.candidateClaimCount || 0,
    missingFusionCount: enrichment.missingFusionCount || 0,
    missingXactCount: enrichment.missingXactCount || 0,
    missingClaimXCount: enrichment.missingClaimXCount || 0,
    missingLinkCount: enrichment.missingLinkCount || 0,
    actualExternalLinkHeaders: enrichment.actualExternalLinkHeaders || enrichment.externalLinkHeaders || [],
    resolvedHeaderMap: enrichment.resolvedHeaderMap || {},
    unresolvedItemCount: unresolvedItems.length,
    sampleUnresolvedItems: unresolvedItems.slice(0, 5).map(function(item) {
      return {
        issueType: item.issueType || '',
        claimId: item.claimId || '',
        claimNumber: item.claimNumber || '',
        displayName: item.displayName || '',
        carrierName: item.carrierName || '',
        isAllstate: !!item.isAllstate,
        missingLinkTypes: (item.missingLinkTypes || []).map(function(linkType) {
          return linkType.id || linkType.storageValue || '';
        }),
        resolvedLinkTypes: (item.resolvedLinkTypes || []).map(function(linkType) {
          return linkType.id || linkType.storageValue || '';
        })
      };
    }),
    sampleVisibilityItems: visibilityItems.slice(0, 5).map(function(item) {
      return {
        claimId: item.claimId || '',
        claimNumber: item.claimNumber || '',
        displayName: item.displayName || '',
        carrierName: item.carrierName || '',
        isAllstate: !!item.isAllstate,
        hasMissingOperationalLinks: !!item.hasMissingOperationalLinks,
        missingLinkTypes: (item.missingLinkTypes || []).map(function(linkType) {
          return linkType.id || linkType.storageValue || '';
        }),
        resolvedLinkTypes: (item.resolvedLinkTypes || []).map(function(linkType) {
          return linkType.id || linkType.storageValue || '';
        })
      };
    })
  };
}

function isIntakeOperationalLinkTypeRequiredForClaim_(linkTypeConfig, claim) {
  if (!linkTypeConfig) {
    return false;
  }

  if (linkTypeConfig.allstateOnly) {
    return !!(claim && claim.isAllstate);
  }

  return true;
}

function isIntakeAllstateClaim_(claim) {
  const carrierText = [
    claim && claim.Intake_Carrier,
    claim && claim.Carrier,
    claim && claim.Insurance_Carrier,
    claim && claim.Insurance_Company,
    claim && claim.Company
  ].join(' ').toLowerCase();

  return carrierText.indexOf('allstate') !== -1;
}

function getIntakeOperationalLinkCandidateClaims_() {
  const rows = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims);
  const cutoffTime = Date.now() - (INTAKE_OPERATIONAL_LINK_RECENT_DAYS * 24 * 60 * 60 * 1000);

  return rows
    .map(function(row) {
      const claim = normalizeHomepageClaim_(row);
      claim.Intake_Carrier = getHomepageValue_(row, [
        'Carrier',
        'Insurance Carrier',
        'Insurance_Carrier',
        'Insurance Company',
        'Insurance_Company',
        'Company',
        'Carrier_Name',
        'Carrier Name',
        'Insurance',
        'Insurer'
      ]);
      return claim;
    })
    .filter(function(claim) {
      if (!isHomepageActiveClaim_(claim)) {
        return false;
      }

      const activityTime = getIntakeClaimActivityTime_(claim);
      return activityTime === 0 || activityTime >= cutoffTime;
    })
    .map(function(claim) {
      return {
        claimId: claim.Claim_ID || '',
        claimNumber: preserveIntakeClaimNumber_(claim.Claim_Number || claim.Job_Number || ''),
        jobNumber: preserveIntakeClaimNumber_(claim.Job_Number || claim.Claim_Number || ''),
        displayName: getHomepageClaimDisplayName_(claim),
        customerName: claim.Customer_Name || '',
        carrierName: claim.Intake_Carrier || '',
        isAllstate: isIntakeAllstateClaim_(claim),
        lifecycleState: claim.Lifecycle_State || '',
        ownershipArea: claim.Ownership_Area || '',
        lastActivityAt: claim.Last_Meaningful_Activity_Date || claim.Updated_At || claim.Created_At || '',
        activityTime: getIntakeClaimActivityTime_(claim)
      };
    })
    .filter(function(claim) {
      return !!claim.claimId;
    })
    .sort(function(a, b) {
      return (b.activityTime || 0) - (a.activityTime || 0);
    })
    .slice(0, INTAKE_OPERATIONAL_LINK_MAX_CLAIMS);
}

function preserveIntakeClaimNumber_(value) {
  const rawValue = String(value === undefined || value === null ? '' : value).trim();

  if (!rawValue) {
    return '';
  }

  const normalizedValue = rawValue.replace(/\.0$/, '');

  if (/^\d{9}$/.test(normalizedValue)) {
    return '0' + normalizedValue;
  }

  return normalizedValue;
}

function getIntakeClaimActivityTime_(claim) {
  const value = claim.Last_Meaningful_Activity_Date || claim.Updated_At || claim.Created_At || '';
  const parsed = value ? new Date(value) : null;

  if (parsed && !isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  return 0;
}

function buildIntakeOperationalLinkIssueKey_(claimId, missingTypes) {
  return [
    'missing-operational-link',
    claimId || '',
    (missingTypes || []).map(function(linkTypeConfig) {
      return linkTypeConfig.id;
    }).sort().join('+')
  ].join('|');
}

function buildIntakeOperationalLinkTypePayload_(linkTypeConfig) {
  return {
    id: linkTypeConfig.id,
    storageValue: linkTypeConfig.storageValue,
    missingLabel: linkTypeConfig.missingLabel,
    actionLabel: linkTypeConfig.actionLabel,
    displayLabel: linkTypeConfig.displayLabel
  };
}

function getIntakeOperationalLinkTypeConfig_(linkType) {
  const normalized = normalizeIntakeLinkTypeValue_(linkType);

  return INTAKE_OPERATIONAL_LINK_TYPES.find(function(linkTypeConfig) {
    if (normalizeIntakeLinkTypeValue_(linkTypeConfig.id) === normalized) {
      return true;
    }

    if (normalizeIntakeLinkTypeValue_(linkTypeConfig.storageValue) === normalized) {
      return true;
    }

    return linkTypeConfig.matchValues.indexOf(normalized) !== -1;
  }) || null;
}

function getIntakeExternalLinksContext_() {
  const spreadsheet = SpreadsheetApp.openById(HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(INTAKE_OPERATIONAL_LINK_SHEET_NAME);

  if (!sheet) {
    return {
      available: false,
      message: INTAKE_OPERATIONAL_LINK_SHEET_NAME + ' sheet was not found.',
      records: [],
      headers: []
    };
  }

  const values = sheet.getDataRange().getValues();

  if (!values.length) {
    return {
      available: false,
      message: INTAKE_OPERATIONAL_LINK_SHEET_NAME + ' has no header row.',
      sheet: sheet,
      records: [],
      headers: []
    };
  }

  const headerRowIndex = findIntakeExternalLinksHeaderRowIndex_(values);
  const headers = values[headerRowIndex].map(function(header) {
    return String(header || '').trim();
  });
  const resolvedHeaderMap = getIntakeExternalLinkResolvedHeaderMap_(headers);
  const wideLinkColumns = getIntakeWideExternalLinkColumnMap_(headers);
  resolvedHeaderMap.wideLinkColumns = wideLinkColumns;
  const wideRows = normalizeIntakeWideExternalLinkRows_(values, headerRowIndex, resolvedHeaderMap);
  const normalizedRecords = values.slice(headerRowIndex + 1)
    .filter(function(row) {
      return row.some(function(value) {
        return value !== '' && value !== null;
      });
    })
    .map(function(row) {
      return normalizeIntakeExternalLinkRecord_(headers, row, resolvedHeaderMap);
    });
  const usesWideSchema = isIntakeWideExternalLinksSchema_(resolvedHeaderMap, wideLinkColumns);
  const records = usesWideSchema
    ? buildIntakeWideExternalLinkRecords_(wideRows, wideLinkColumns)
    : normalizedRecords;
  const requiredFields = ['claimId', 'linkType', 'url'];
  const missingRequiredFields = usesWideSchema ? [] : requiredFields.filter(function(fieldName) {
    return !resolvedHeaderMap[fieldName] || resolvedHeaderMap[fieldName].index === -1;
  });

  if (missingRequiredFields.length) {
    return {
      available: false,
      message: INTAKE_OPERATIONAL_LINK_SHEET_NAME + ' is missing required headers: ' + missingRequiredFields.join(', ') + '. Actual headers: ' + headers.join(', '),
      sheet: sheet,
      records: records,
      headers: headers,
      resolvedHeaderMap: resolvedHeaderMap,
      headerRowIndex: headerRowIndex,
      layout: usesWideSchema ? 'wide' : 'normalized',
      wideRows: wideRows,
      wideLinkColumns: wideLinkColumns
    };
  }

  return {
    available: true,
    sheet: sheet,
    headerRowIndex: headerRowIndex,
    headers: headers,
    resolvedHeaderMap: resolvedHeaderMap,
    layout: usesWideSchema ? 'wide' : 'normalized',
    wideRows: wideRows,
    wideLinkColumns: wideLinkColumns,
    records: records
  };
}

function findIntakeExternalLinksHeaderRowIndex_(values) {
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
    const headers = values[rowIndex].map(function(header) {
      return String(header || '').trim();
    });
    const resolvedHeaderMap = getIntakeExternalLinkResolvedHeaderMap_(headers);
    const score = ['claimId', 'linkType', 'url'].reduce(function(total, fieldName) {
      return total + (resolvedHeaderMap[fieldName] && resolvedHeaderMap[fieldName].index !== -1 ? 1 : 0);
    }, 0);

    if (score === 3) {
      return rowIndex;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = rowIndex;
    }
  }

  return bestRowIndex;
}

function normalizeIntakeExternalLinkRecord_(headers, row, resolvedHeaderMap) {
  return {
    raw: headers.reduce(function(record, header, index) {
      if (header) {
        record[header] = row[index];
      }
      return record;
    }, {}),
    claimId: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'claimId'),
    claimNumber: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'claimNumber'),
    linkType: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'linkType'),
    url: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'url'),
    source: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'source'),
    createdAt: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'createdAt'),
    createdBy: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'createdBy'),
    status: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'status'),
    isActive: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'isActive')
  };
}

function getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, fieldName) {
  const resolvedHeader = resolvedHeaderMap && resolvedHeaderMap[fieldName];
  const index = resolvedHeader ? resolvedHeader.index : -1;

  return index === -1 || index === undefined ? '' : row[index];
}

function findIntakeExternalLinkHeaderIndex_(headers, fieldName) {
  const resolvedHeaderMap = getIntakeExternalLinkResolvedHeaderMap_(headers);
  return resolvedHeaderMap[fieldName] ? resolvedHeaderMap[fieldName].index : -1;
}

function getIntakeExternalLinkResolvedHeaderMap_(headers) {
  const aliasesByField = getIntakeExternalLinkHeaderAliases_();
  const fieldNames = Object.keys(aliasesByField);
  const resolvedHeaderMap = {};

  fieldNames.forEach(function(fieldName) {
    const normalizedAliases = aliasesByField[fieldName].map(normalizeIntakeHeaderKey_);
    resolvedHeaderMap[fieldName] = {
      index: -1,
      header: ''
    };

    for (let index = 0; index < headers.length; index++) {
      if (normalizedAliases.indexOf(normalizeIntakeHeaderKey_(headers[index])) !== -1) {
        resolvedHeaderMap[fieldName] = {
          index: index,
          header: headers[index]
        };
        break;
      }
    }
  });

  return resolvedHeaderMap;
}

function getIntakeWideExternalLinkColumnMap_(headers) {
  const aliasesByField = getIntakeWideExternalLinkHeaderAliases_();
  const fieldNames = Object.keys(aliasesByField);
  const wideLinkColumns = {};

  fieldNames.forEach(function(fieldName) {
    const normalizedAliases = aliasesByField[fieldName].map(normalizeIntakeHeaderKey_);
    wideLinkColumns[fieldName] = {
      index: -1,
      header: ''
    };

    for (let index = 0; index < headers.length; index++) {
      if (normalizedAliases.indexOf(normalizeIntakeHeaderKey_(headers[index])) !== -1) {
        wideLinkColumns[fieldName] = {
          index: index,
          header: headers[index]
        };
        break;
      }
    }
  });

  return wideLinkColumns;
}

function getIntakeWideExternalLinkHeaderAliases_() {
  return {
    fusionUrl: ['Fusion URL', 'Fusion_URL', 'Fusion Link', 'Fusion_Link', 'Fusion'],
    fusionJobId: ['Fusion Job ID', 'Fusion_Job_ID', 'Fusion ID', 'Fusion_ID'],
    driveFolder: ['Drive Folder', 'Drive_Folder', 'Google Drive Folder', 'Google_Drive_Folder'],
    xactAnalysisUrl: ['XactAnalysis', 'Xact Analysis', 'XactAnalysis URL', 'XactAnalysis_URL', 'Xact URL', 'Xact_URL', 'Xact Link', 'Xact_Link'],
    symbilityUrl: ['Symbility', 'Symbility URL', 'Symbility_URL', 'Symbility Link', 'Symbility_Link'],
    claimXUrl: ['ClaimX', 'ClaimX URL', 'ClaimX_URL', 'ClaimX Link', 'ClaimX_Link'],
    otherLinks: ['Other Links', 'Other_Links', 'Other Link', 'Other_Link']
  };
}

function isIntakeWideExternalLinksSchema_(resolvedHeaderMap, wideLinkColumns) {
  const hasClaimId = !!(resolvedHeaderMap.claimId && resolvedHeaderMap.claimId.index !== -1);
  const hasFusionColumn = !!(wideLinkColumns.fusionUrl && wideLinkColumns.fusionUrl.index !== -1);
  const hasXactColumn = !!(
    wideLinkColumns.xactAnalysisUrl && wideLinkColumns.xactAnalysisUrl.index !== -1
    || wideLinkColumns.symbilityUrl && wideLinkColumns.symbilityUrl.index !== -1
  );

  return hasClaimId && (hasFusionColumn || hasXactColumn);
}

function normalizeIntakeWideExternalLinkRows_(values, headerRowIndex, resolvedHeaderMap) {
  return values.slice(headerRowIndex + 1)
    .map(function(row, rowIndex) {
      return {
        rowNumber: headerRowIndex + rowIndex + 2,
        row: row,
        claimId: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'claimId'),
        claimNumber: getIntakeExternalLinkCellValue_(row, resolvedHeaderMap, 'claimNumber')
      };
    })
    .filter(function(rowRecord) {
      return rowRecord.claimId || rowRecord.claimNumber || rowRecord.row.some(function(value) {
        return value !== '' && value !== null;
      });
    });
}

function buildIntakeWideExternalLinkRecords_(wideRows, wideLinkColumns) {
  const linkColumns = [
    { fieldName: 'fusionUrl', linkType: 'Fusion' },
    { fieldName: 'xactAnalysisUrl', linkType: 'XactAnalysis' },
    { fieldName: 'symbilityUrl', linkType: 'Symbility' },
    { fieldName: 'claimXUrl', linkType: 'ClaimX' }
  ];
  const records = [];

  (wideRows || []).forEach(function(rowRecord) {
    linkColumns.forEach(function(column) {
      const resolvedColumn = wideLinkColumns[column.fieldName] || {};
      const columnIndex = resolvedColumn.index;

      if (columnIndex === -1 || columnIndex === undefined) {
        return;
      }

      const url = rowRecord.row[columnIndex];

      if (!url) {
        return;
      }

      records.push({
        raw: {},
        claimId: rowRecord.claimId,
        claimNumber: rowRecord.claimNumber,
        linkType: column.linkType,
        url: url,
        source: '',
        createdAt: '',
        createdBy: '',
        status: 'Active',
        isActive: true,
        rowNumber: rowRecord.rowNumber,
        header: resolvedColumn.header
      });
    });
  });

  return records;
}

function findIntakeExternalLinkFieldForHeader_(header) {
  const aliasesByField = getIntakeExternalLinkHeaderAliases_();
  const normalizedHeader = normalizeIntakeHeaderKey_(header);
  const fieldNames = Object.keys(aliasesByField);

  for (let index = 0; index < fieldNames.length; index++) {
    const fieldName = fieldNames[index];
    const normalizedAliases = aliasesByField[fieldName].map(normalizeIntakeHeaderKey_);

    if (normalizedAliases.indexOf(normalizedHeader) !== -1) {
      return fieldName;
    }
  }

  return '';
}

function getIntakeExternalLinkHeaderAliases_() {
  return {
    id: ['External_Link_ID', 'External Link ID', 'Link_ID', 'Link ID', 'ID'],
    claimId: ['Claim_ID', 'Claim ID', 'ClaimId', 'claimId', 'Claim', 'Claim_Key', 'Claim Key'],
    claimNumber: ['Claim_Number', 'Claim Number', 'Job_Number', 'Job Number', 'JobNumber', 'Job Number'],
    linkType: ['linkType', 'LinkType', 'Link_Type', 'Link Type', 'External_Link_Type', 'External Link Type', 'externalLinkType', 'ExternalLinkType', 'Type', 'System', 'External_System', 'External System', 'Link_System', 'Link System', 'Platform', 'Tool', 'Link_Category', 'Link Category'],
    label: ['Label', 'Link_Label', 'Link Label', 'Display_Name', 'Display Name', 'Name'],
    url: ['url', 'URL', 'Url', 'Link', 'linkUrl', 'LinkUrl', 'Link_URL', 'Link URL', 'External_URL', 'External URL', 'External_Link', 'External Link', 'External_Link_URL', 'External Link URL'],
    source: ['Source', 'Source_System', 'Source System', 'Created_Source', 'Created Source'],
    createdAt: ['Created_At', 'Created At', 'Timestamp', 'Added_At', 'Added At'],
    createdBy: ['Created_By', 'Created By', 'Actor', 'Added_By', 'Added By', 'User'],
    updatedAt: ['Updated_At', 'Updated At', 'Modified_At', 'Modified At'],
    status: ['Status', 'Link_Status', 'Link Status', 'Active_Status', 'Active Status'],
    isActive: ['Is_Active', 'Is Active', 'Active'],
    notes: ['Notes', 'Note', 'Description']
  };
}

function appendIntakeExternalLink_(context, linkRecord) {
  if (context.layout === 'wide') {
    return writeIntakeWideExternalLink_(context, linkRecord);
  }

  const headers = context.headers || [];
  const row = headers.map(function(header) {
    const fieldName = findIntakeExternalLinkFieldForHeader_(header);

    if (fieldName === 'id') {
      return Utilities.getUuid();
    }

    if (fieldName === 'claimId') {
      return linkRecord.claimId;
    }

    if (fieldName === 'claimNumber') {
      return linkRecord.claimNumber;
    }

    if (fieldName === 'linkType') {
      return linkRecord.linkType;
    }

    if (fieldName === 'label') {
      return linkRecord.label;
    }

    if (fieldName === 'url') {
      return linkRecord.url;
    }

    if (fieldName === 'source') {
      return linkRecord.source;
    }

    if (fieldName === 'createdAt') {
      return linkRecord.createdAt;
    }

    if (fieldName === 'createdBy') {
      return linkRecord.createdBy;
    }

    if (fieldName === 'updatedAt') {
      return linkRecord.createdAt;
    }

    if (fieldName === 'status') {
      return linkRecord.status;
    }

    if (fieldName === 'isActive') {
      return linkRecord.isActive;
    }

    if (fieldName === 'notes') {
      return linkRecord.notes;
    }

    return '';
  });

  context.sheet.appendRow(row);

  return {
    rowNumber: context.sheet.getLastRow()
  };
}

function writeIntakeWideExternalLink_(context, linkRecord) {
  const targetColumn = getIntakeWideExternalLinkTargetColumn_(context, linkRecord);

  if (!targetColumn || targetColumn.index === -1 || targetColumn.index === undefined) {
    throw new Error('External_Links does not have a writable column for ' + linkRecord.linkType + '.');
  }

  const claimIdKey = normalizeIntakeClaimKey_(linkRecord.claimId);
  const existingRow = (context.wideRows || []).find(function(rowRecord) {
    return normalizeIntakeClaimKey_(rowRecord.claimId) === claimIdKey;
  });

  if (existingRow) {
    const existingValue = existingRow.row[targetColumn.index];

    if (existingValue) {
      throw new Error(linkRecord.label + ' already exists for this claim.');
    }

    context.sheet.getRange(existingRow.rowNumber, targetColumn.index + 1).setValue(linkRecord.url);

    return {
      rowNumber: existingRow.rowNumber,
      columnNumber: targetColumn.index + 1
    };
  }

  const headers = context.headers || [];
  const row = headers.map(function(header, index) {
    if (context.resolvedHeaderMap.claimId && context.resolvedHeaderMap.claimId.index === index) {
      return linkRecord.claimId;
    }

    if (context.resolvedHeaderMap.claimNumber && context.resolvedHeaderMap.claimNumber.index === index) {
      return linkRecord.claimNumber;
    }

    if (targetColumn.index === index) {
      return linkRecord.url;
    }

    return '';
  });

  context.sheet.appendRow(row);

  return {
    rowNumber: context.sheet.getLastRow(),
    columnNumber: targetColumn.index + 1
  };
}

function getIntakeWideExternalLinkTargetColumn_(context, linkRecord) {
  const wideLinkColumns = context.wideLinkColumns || {};
  const linkTypeConfig = getIntakeOperationalLinkTypeConfig_(linkRecord.linkTypeId || linkRecord.linkType);

  if (!linkTypeConfig) {
    return null;
  }

  if (linkTypeConfig.id === 'fusion') {
    return wideLinkColumns.fusionUrl || null;
  }

  if (linkTypeConfig.id === 'xact') {
    if (wideLinkColumns.xactAnalysisUrl && wideLinkColumns.xactAnalysisUrl.index !== -1) {
      return wideLinkColumns.xactAnalysisUrl;
    }

    return wideLinkColumns.symbilityUrl || null;
  }

  if (linkTypeConfig.id === 'claimx') {
    return wideLinkColumns.claimXUrl || null;
  }

  return null;
}

function getIntakeExternalLinkFieldForHeader_(header) {
  return findIntakeExternalLinkFieldForHeader_(header);
}

function findIntakeActiveExternalLink_(records, claim, linkTypeConfig) {
  const claimKeys = buildIntakeClaimMatchKeys_(claim);

  return (records || []).find(function(record) {
    if (!intakeExternalLinkMatchesClaim_(record, claimKeys)) {
      return false;
    }

    if (!record.url) {
      return false;
    }

    if (!isIntakeExternalLinkActive_(record)) {
      return false;
    }

    return isIntakeExternalLinkTypeMatch_(record.linkType, linkTypeConfig);
  }) || null;
}

function intakeExternalLinkMatchesClaim_(record, claimKeys) {
  const recordKeys = buildIntakeClaimMatchKeys_(record || {});

  return Object.keys(recordKeys).some(function(key) {
    return !!claimKeys[key];
  });
}

function isIntakeExternalLinkActive_(record) {
  const activeValue = String(record.isActive || '').trim().toLowerCase();
  const statusValue = String(record.status || '').trim().toLowerCase();

  if (activeValue === 'false' || activeValue === 'no' || activeValue === 'inactive') {
    return false;
  }

  if (statusValue === 'inactive' || statusValue === 'deleted' || statusValue === 'archived' || statusValue === 'closed') {
    return false;
  }

  return true;
}

function isIntakeExternalLinkTypeMatch_(linkType, linkTypeConfig) {
  const normalizedLinkType = normalizeIntakeLinkTypeValue_(linkType);

  if (!normalizedLinkType || !linkTypeConfig) {
    return false;
  }

  if (normalizeIntakeLinkTypeValue_(linkTypeConfig.storageValue) === normalizedLinkType) {
    return true;
  }

  return linkTypeConfig.matchValues.indexOf(normalizedLinkType) !== -1;
}

function buildIntakeClaimMatchKeys_(claim) {
  const values = [];

  if (claim && typeof claim === 'object') {
    values.push(claim.claimId, claim.claimNumber, claim.jobNumber);
  } else {
    values.push(claim);
  }

  return values.reduce(function(keys, value) {
    const normalizedValue = normalizeIntakeClaimKey_(value);

    if (!normalizedValue) {
      return keys;
    }

    keys[normalizedValue] = true;

    const preservedClaimNumber = preserveIntakeClaimNumber_(normalizedValue);
    if (preservedClaimNumber && preservedClaimNumber !== normalizedValue) {
      keys[preservedClaimNumber] = true;
    }

    if (normalizedValue.indexOf('clm-') === 0) {
      keys[normalizedValue.replace(/^clm-/, '')] = true;
    } else if (/^[0-9a-z-]+$/.test(normalizedValue)) {
      keys['clm-' + normalizedValue] = true;
    }

    return keys;
  }, {});
}

function normalizeIntakeClaimKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.0$/, '');
}

function normalizeIntakeLinkTypeValue_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeIntakeHeaderKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getWorkflowHealthFromSingleQueueResponse_(response) {
  return response && response.result && response.result.workflowHealth
    ? response.result.workflowHealth
    : {};
}

function normalizeIntakeWorkflowHealth_(key, workflowHealth, fallbackName) {
  const source = workflowHealth || {};
  const metrics = source.metrics || {};

  return {
    key: key,
    name: source.workflow || fallbackName || key,
    health: normalizeIntakeHealth_(source.health || ''),
    checkedAt: source.checkedAt || '',
    readOnly: source.readOnly !== false,
    queueCount: normalizeIntakeMetricCount_(metrics.activeQueueCount),
    activeQueueCount: normalizeIntakeMetricCount_(metrics.activeQueueCount),
    processedCount: normalizeIntakeMetricCount_(metrics.processedCount),
    pendingReviewCount: normalizeIntakeMetricCount_(metrics.reviewCount),
    reviewCount: normalizeIntakeMetricCount_(metrics.reviewCount),
    errorCount: normalizeIntakeMetricCount_(metrics.errorCount),
    duplicateCount: normalizeIntakeMetricCount_(metrics.duplicateCount),
    retryReadyCount: normalizeIntakeMetricCount_(metrics.retryReadyCount),
    retryInProgressCount: normalizeIntakeMetricCount_(metrics.retryInProgressCount),
    retryBlockedCount: normalizeIntakeMetricCount_(metrics.retryBlockedCount),
    retryRecoveredCount: normalizeIntakeMetricCount_(metrics.retryRecoveredCount),
    retryBacklogCount: normalizeIntakeMetricCount_(metrics.retryBacklogCount),
    retryLimitReachedCount: normalizeIntakeMetricCount_(metrics.retryLimitReachedCount),
    pendingClaimFolderCount: normalizeIntakeMetricCount_(metrics.pendingClaimFolderCount),
    cleanupBacklogCount: normalizeIntakeMetricCount_(metrics.cleanupBacklogCount),
    staleThreadCount: normalizeIntakeMetricCount_(metrics.staleThreadCount),
    queries: source.queries || {}
  };
}

function normalizePendingClaimFolderInspection_(response, auditState) {
  const result = response && response.result ? response.result : {};
  const summary = result.summary || {};
  const asbestosItems = result.asbestos && Array.isArray(result.asbestos.items)
    ? result.asbestos.items
    : [];
  const itelItems = result.itel && Array.isArray(result.itel.items)
    ? result.itel.items
    : [];
  const allItems = asbestosItems.concat(itelItems);

  const normalizedItems = allItems.map(function(item) {
    const sourceWorkflow = getIntakePendingFolderWorkflowKey_(item);
    const issueKey = buildIntakePendingFolderIssueKey_(item, sourceWorkflow);
    const disposition = getIntakeAuditDispositionForIssue_(auditState, issueKey);
    const claimId = item.claimId || '';
    const claimNumber = preserveIntakeClaimNumber_(item.claimNumber || '');

    return {
      issueType: 'pending-claim-folder',
      issueKey: issueKey,
      sourceWorkflow: sourceWorkflow,
      workflow: item.workflow || getIntakeWorkflowDisplayName_(sourceWorkflow),
      vendor: item.vendor || '',
      threadId: item.threadId || '',
      subject: item.subject || '',
      claimId: claimId,
      claimNumber: claimNumber,
      displayName: item.displayName || item.customerName || claimId || claimNumber || '',
      customerName: item.customerName || '',
      lastMessageDate: item.lastMessageDate || '',
      lastSender: item.lastSender || '',
      status: item.status || '',
      claimMatchStatus: getIntakePendingClaimMatchStatus_(item),
      recommendedNextStep: item.recommendedNextStep || '',
      readOnly: item.readOnly !== false,
      canReview: true,
      canIgnore: true,
      auditDisposition: disposition ? disposition.actionType : '',
      auditRecord: disposition || null,
      isCleared: isIntakeIssueClearedByAudit_(auditState, issueKey)
    };
  });
  const actionableItems = normalizedItems.filter(function(item) {
    return !item.isCleared;
  });

  return {
    status: response && response.status ? response.status : '',
    message: response && response.message ? response.message : '',
    pendingCount: actionableItems.length,
    sourcePendingCount: normalizeIntakeMetricCount_(summary.pendingCount || allItems.length),
    asbestosPendingCount: actionableItems.filter(function(item) {
      return item.sourceWorkflow === 'asbestos';
    }).length,
    itelPendingCount: actionableItems.filter(function(item) {
      return item.sourceWorkflow === 'itel';
    }).length,
    checkedAt: result.finishedAt || result.startedAt || '',
    items: actionableItems,
    allItems: normalizedItems,
    groups: buildIntakePendingFolderGroups_(actionableItems)
  };
}

function getIntakePendingFolderWorkflowKey_(item) {
  const workflowText = String((item && item.workflow) || '').toLowerCase();
  const vendorText = String((item && item.vendor) || '').toLowerCase();

  if (workflowText.indexOf('asbestos') !== -1 || vendorText.indexOf('asbestos') !== -1) {
    return 'asbestos';
  }

  if (workflowText.indexOf('itel') !== -1 || vendorText.indexOf('itel') !== -1) {
    return 'itel';
  }

  return 'insuranceIntake';
}

function buildIntakePendingFolderIssueKey_(item, sourceWorkflow) {
  return [
    'pending-claim-folder',
    sourceWorkflow || getIntakePendingFolderWorkflowKey_(item),
    item && item.threadId ? item.threadId : '',
    item && item.claimNumber ? preserveIntakeClaimNumber_(item.claimNumber) : '',
    item && item.subject ? item.subject : ''
  ].join('|');
}

function getIntakePendingClaimMatchStatus_(item) {
  if (item && item.claimId) {
    return 'Claim linked';
  }

  if (item && item.claimNumber) {
    return 'Claim number parsed';
  }

  return 'No claim match';
}

function buildIntakePendingFolderGroups_(items) {
  const groupKeys = ['insuranceIntake', 'asbestos', 'itel'];

  return groupKeys.map(function(key) {
    const groupItems = (items || []).filter(function(item) {
      return item.sourceWorkflow === key;
    });

    return {
      key: key,
      name: getIntakeWorkflowDisplayName_(key),
      count: groupItems.length,
      items: groupItems
    };
  });
}

function getIntakeWorkflowDisplayName_(workflowKey) {
  if (workflowKey === 'asbestos') {
    return 'Asbestos';
  }

  if (workflowKey === 'itel') {
    return 'Itel';
  }

  if (workflowKey === 'insuranceIntake') {
    return 'Insurance Intake';
  }

  return workflowKey || 'Workflow';
}

function calculateIntakeWorkspaceTotals_(workflows, pendingClaimFolders, unresolvedItems) {
  const totals = {
    queueCount: 0,
    reviewCount: 0,
    errorCount: 0,
    duplicateCount: 0,
    retryBacklogCount: 0,
    pendingClaimFolderCount: 0,
    retryLimitReachedCount: 0,
    missingOperationalLinkCount: 0,
    lastCheckedAt: ''
  };

  Object.keys(workflows || {}).forEach(function(key) {
    const workflow = workflows[key] || {};

    totals.queueCount += normalizeIntakeMetricCount_(workflow.queueCount);
    totals.lastCheckedAt = getLaterIntakeTimestamp_(totals.lastCheckedAt, workflow.checkedAt);
  });

  (unresolvedItems || []).forEach(function(item) {
    if (item.issueType === 'needs-review') {
      totals.reviewCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'error') {
      totals.errorCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'duplicate') {
      totals.duplicateCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'retry-backlog') {
      totals.retryBacklogCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'pending-claim-folder') {
      totals.pendingClaimFolderCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'retry-limit-reached') {
      totals.retryLimitReachedCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'missing-operational-link') {
      totals.missingOperationalLinkCount += normalizeIntakeMetricCount_(item.count);
    }
  });

  totals.lastCheckedAt = getLaterIntakeTimestamp_(
    totals.lastCheckedAt,
    pendingClaimFolders ? pendingClaimFolders.checkedAt : ''
  );

  return totals;
}

function buildIntakeUnresolvedItems_(workflows, pendingClaimFolders, auditState) {
  const definitions = [
    {
      id: 'needs-review',
      title: 'Needs Review',
      metric: 'reviewCount',
      severity: 'warning',
      message: 'Queue items are waiting for human review.',
      canIgnore: true
    },
    {
      id: 'error',
      title: 'Error',
      metric: 'errorCount',
      severity: 'critical',
      message: 'Queue items are labeled as errors in the source service.',
      canIgnore: false
    },
    {
      id: 'duplicate',
      title: 'Duplicate',
      metric: 'duplicateCount',
      severity: 'warning',
      message: 'Potential duplicate intake items are waiting in the source service.',
      canIgnore: true
    },
    {
      id: 'retry-backlog',
      title: 'Retry backlog',
      metric: 'retryBacklogCount',
      severity: 'warning',
      message: 'Retry-ready, retry-in-progress, or retry-blocked items are still open.',
      canIgnore: true
    },
    {
      id: 'pending-claim-folder',
      title: 'Pending Claim Folder',
      metric: 'pendingClaimFolderCount',
      severity: 'warning',
      message: 'Vendor attachment items are waiting on claim folder matching.',
      canIgnore: true
    },
    {
      id: 'retry-limit-reached',
      title: 'Retry Limit Reached',
      metric: 'retryLimitReachedCount',
      severity: 'critical',
      message: 'Retry limit reached labels are present in the source service.',
      canIgnore: false
    }
  ];

  const items = [];

  Object.keys(workflows || {}).forEach(function(workflowKey) {
    const workflow = workflows[workflowKey] || {};

    definitions.forEach(function(definition) {
      let count = normalizeIntakeMetricCount_(workflow[definition.metric]);
      let detailItems = [];

      if (definition.id === 'pending-claim-folder') {
        detailItems = pendingClaimFolders && pendingClaimFolders.items
          ? pendingClaimFolders.items.filter(function(item) {
              return item.sourceWorkflow === workflowKey;
            })
          : [];
        count = detailItems.length;
      }

      if (count <= 0) {
        return;
      }

      const issueKey = buildIntakeMetricIssueKey_(definition.id, workflowKey, count);

      if (isIntakeIssueClearedByAudit_(auditState, issueKey)) {
        return;
      }

      items.push({
        id: issueKey,
        issueType: definition.id,
        filterType: definition.id,
        title: definition.title,
        severity: definition.severity,
        count: count,
        message: definition.message,
        sourceWorkflow: workflowKey,
        sourceWorkflowName: workflow.name || getIntakeWorkflowDisplayName_(workflowKey),
        issueKey: issueKey,
        claimId: '',
        displayName: '',
        customerName: '',
        canReview: true,
        canIgnore: definition.canIgnore,
        detailItems: detailItems,
        workflows: [{
          key: workflowKey,
          name: workflow.name || getIntakeWorkflowDisplayName_(workflowKey),
          count: count,
          health: workflow.health || ''
        }]
      });
    });
  });

  return items;
}

function buildIntakeMetricIssueKey_(issueType, sourceWorkflow, count) {
  return [
    issueType || '',
    sourceWorkflow || '',
    'count',
    normalizeIntakeMetricCount_(count)
  ].join('|');
}

function applyIntakeActionableCountsToWorkflows_(workflows, unresolvedItems) {
  const workflowCopies = {};

  Object.keys(workflows || {}).forEach(function(key) {
    const workflow = workflows[key] || {};
    workflowCopies[key] = Object.assign({}, workflow, {
      pendingReviewCount: 0,
      reviewCount: 0,
      errorCount: 0,
      duplicateCount: 0,
      retryBacklogCount: 0,
      pendingClaimFolderCount: 0,
      retryLimitReachedCount: 0
    });
  });

  (unresolvedItems || []).forEach(function(item) {
    const workflowKey = item.sourceWorkflow || '';
    const workflow = workflowCopies[workflowKey];

    if (!workflow) {
      return;
    }

    if (item.issueType === 'needs-review') {
      workflow.pendingReviewCount += normalizeIntakeMetricCount_(item.count);
      workflow.reviewCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'error') {
      workflow.errorCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'duplicate') {
      workflow.duplicateCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'retry-backlog') {
      workflow.retryBacklogCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'pending-claim-folder') {
      workflow.pendingClaimFolderCount += normalizeIntakeMetricCount_(item.count);
    } else if (item.issueType === 'retry-limit-reached') {
      workflow.retryLimitReachedCount += normalizeIntakeMetricCount_(item.count);
    }
  });

  Object.keys(workflowCopies).forEach(function(key) {
    workflowCopies[key].health = calculateIntakeWorkflowHealthFromActionableCounts_(workflowCopies[key]);
  });

  return workflowCopies;
}

function calculateIntakeWorkflowHealthFromActionableCounts_(workflow) {
  if (
    normalizeIntakeMetricCount_(workflow.errorCount) > 0
    || normalizeIntakeMetricCount_(workflow.retryLimitReachedCount) > 0
  ) {
    return 'Critical';
  }

  if (
    normalizeIntakeMetricCount_(workflow.reviewCount) > 0
    || normalizeIntakeMetricCount_(workflow.duplicateCount) > 0
    || normalizeIntakeMetricCount_(workflow.retryBacklogCount) > 0
    || normalizeIntakeMetricCount_(workflow.pendingClaimFolderCount) > 0
  ) {
    return 'Warning';
  }

  return 'Healthy';
}

function buildIntakeIssueWorkflowBreakdown_(workflows, metric) {
  return Object.keys(workflows || {})
    .map(function(key) {
      const workflow = workflows[key] || {};
      const count = normalizeIntakeMetricCount_(workflow[metric]);

      return {
        key: key,
        name: workflow.name || key,
        count: count,
        health: workflow.health || ''
      };
    })
    .filter(function(item) {
      return item.count > 0;
    });
}

function buildIntakeWorkspaceActions_() {
  return [
    {
      id: 'open-claims-workspace',
      label: 'Open Claims Workspace',
      kind: 'navigation',
      route: '?view=claimShell&lensId=needsAttention',
      enabled: true
    },
    {
      id: 'refresh-queue-health',
      label: 'Run Queue Health refresh',
      kind: 'read',
      enabled: true
    },
    {
      id: 'run-intake',
      label: 'Run Intake',
      kind: 'process',
      endpointAction: 'process',
      enabled: true,
      confirmation: 'This runs the existing insurance-intake-automation process endpoint. It may create Todoist tasks, Calendar drafts, and source-service label updates.'
    },
    {
      id: 'resolve-issue',
      label: 'Resolve',
      kind: 'future-resolution',
      enabled: false
    }
  ];
}

function normalizeIntakeDiagnostics_(response) {
  const result = response && response.result ? response.result : {};

  return {
    status: response && response.status ? response.status : '',
    message: response && response.message ? response.message : '',
    automation: result.automation || '',
    phase: result.phase || '',
    checkedAt: result.checkedAt || '',
    helperFunctions: result.helperFunctions || {},
    config: result.config || {}
  };
}

function summarizeIntakeSourceResponse_(response) {
  return {
    status: response && response.status ? response.status : '',
    success: isSuccessfulIntakeResponse_(response),
    message: response && response.message ? response.message : '',
    action: response && response.action ? response.action : '',
    responseCode: response && response.responseCode ? response.responseCode : ''
  };
}

function isSuccessfulIntakeResponse_(response) {
  const status = response && response.status ? String(response.status).toLowerCase() : '';
  return status === 'success' || response && response.success === true;
}

function buildIntakeWorkspaceHealthMessage_(status, totals) {
  if (status === 'Unavailable') {
    return 'Insurance intake service could not be reached.';
  }

  const unresolvedCount = normalizeIntakeMetricCount_(totals.reviewCount)
    + normalizeIntakeMetricCount_(totals.errorCount)
    + normalizeIntakeMetricCount_(totals.duplicateCount)
    + normalizeIntakeMetricCount_(totals.retryBacklogCount)
    + normalizeIntakeMetricCount_(totals.pendingClaimFolderCount)
    + normalizeIntakeMetricCount_(totals.retryLimitReachedCount)
    + normalizeIntakeMetricCount_(totals.missingOperationalLinkCount);

  if (unresolvedCount === 0) {
    return 'No unresolved intake issues.';
  }

  return unresolvedCount + ' unresolved intake queue signal' + (unresolvedCount === 1 ? '' : 's') + '.';
}

function calculateIntakeWorkspaceHealth_(unresolvedItems) {
  const healthValues = (unresolvedItems || []).map(function(item) {
    return item && item.severity === 'critical' ? 'Critical' : 'Warning';
  });

  if (healthValues.indexOf('Critical') !== -1) {
    return 'Critical';
  }

  if (healthValues.indexOf('Warning') !== -1) {
    return 'Warning';
  }

  if (healthValues.indexOf('Unavailable') !== -1) {
    return 'Unavailable';
  }

  return 'Healthy';
}

function normalizeIntakeHealth_(value) {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'critical') {
    return 'Critical';
  }

  if (normalized === 'warning') {
    return 'Warning';
  }

  if (normalized === 'healthy' || normalized === 'success') {
    return 'Healthy';
  }

  return value ? String(value) : 'Unavailable';
}

function normalizeIntakeMetricCount_(value) {
  const numberValue = Number(value || 0);

  if (isNaN(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

function getLaterIntakeTimestamp_(firstValue, secondValue) {
  if (!firstValue) {
    return secondValue || '';
  }

  if (!secondValue) {
    return firstValue || '';
  }

  const firstDate = new Date(firstValue);
  const secondDate = new Date(secondValue);

  if (isNaN(firstDate.getTime())) {
    return secondValue;
  }

  if (isNaN(secondDate.getTime())) {
    return firstValue;
  }

  return secondDate.getTime() > firstDate.getTime() ? secondValue : firstValue;
}

function testIntakeWorkspaceSummaryShape() {
  const summary = getIntakeWorkspaceSummary();

  return {
    status: summary.status,
    success: summary.success,
    sourceService: summary.sourceService,
    workspaceHealth: summary.workspaceHealth,
    workflowKeys: summary.workflows ? Object.keys(summary.workflows) : [],
    unresolvedItemCount: summary.unresolvedItems ? summary.unresolvedItems.length : 0,
    actionCount: summary.availableActions ? summary.availableActions.length : 0,
    generatedAt: new Date().toISOString()
  };
}



function getDashboardData() {
  const automations = buildDashboardAutomations_();

  return {
    title: DASHBOARD_CONFIG.dashboardTitle,
    sections: buildDashboardSections_(automations),
    automations: automations,
    placeholderWorkflows: PLACEHOLDER_WORKFLOWS,
    operationsSummary: buildOperationsSummary_(automations)
  };
}

function getDashboardShellData() {
  const automations = buildDashboardAutomations_();

  return {
    title: DASHBOARD_CONFIG.dashboardTitle,
    sections: buildDashboardSections_(automations),
    automations: automations,
    placeholderWorkflows: PLACEHOLDER_WORKFLOWS
  };
}

function getOperationsSummaryData() {
  const automations = buildDashboardAutomations_();

  return buildOperationsSummary_(automations);
}

function buildDashboardAutomations_() {
  const properties = PropertiesService.getScriptProperties();

  return DASHBOARD_CONFIG.automations.map(function (automation) {
    const saved = getSavedStatus_(automation.id, properties);
    const registry = buildAutomationRegistryEntry_(automation);
    const normalizedResponse = normalizeOperationalResponse_(automation, saved, registry);

    return {
      id: automation.id,
      name: automation.name,
      category: automation.category,
      dashboardRole: registry.dashboardRole,
      section: registry.section,
      featured: registry.featured,
      order: registry.order,
      capabilities: registry.capabilities,
      mainFunction: automation.mainFunction,
      action: automation.action || 'process',
      lastRunTime: saved.lastRunTime || '',
      lastStatus: saved.lastStatus || STATUS.NOT_RUN,
      lastMessage: saved.lastMessage || 'This automation has not run from the dashboard yet.',
      lastRawResponse: saved.lastRawResponse || '',
      normalizedResponse: normalizedResponse
    };
  });
}


function buildAutomationRegistryEntry_(automation) {
  const explicitEntry = AUTOMATION_REGISTRY[automation.id] || null;
  const matchingRule = explicitEntry ? null : findAutomationRegistryRule_(automation);
  const registrySource = explicitEntry || matchingRule || {};
  const baseCapabilities = Object.assign({}, AUTOMATION_REGISTRY_DEFAULTS.capabilities);
  const registryCapabilities = registrySource.capabilities || {};

  return {
    section: registrySource.section || AUTOMATION_REGISTRY_DEFAULTS.section,
    dashboardRole: registrySource.dashboardRole || automation.dashboardRole || AUTOMATION_REGISTRY_DEFAULTS.dashboardRole,
    featured: typeof registrySource.featured === 'boolean'
      ? registrySource.featured
      : AUTOMATION_REGISTRY_DEFAULTS.featured,
    order: typeof registrySource.order === 'number'
      ? registrySource.order
      : AUTOMATION_REGISTRY_DEFAULTS.order,
    capabilities: Object.assign(baseCapabilities, registryCapabilities)
  };
}

function normalizeOperationalResponse_(automation, saved, registry) {
  const parsed = parseAutomationResponse_(saved.lastRawResponse || '');
  const result = parsed && parsed.result ? parsed.result : {};
  const capabilities = registry.capabilities || {};

  return {
    automationId: automation.id,
    automationName: automation.name,
    action: automation.action || 'process',
    section: registry.section,
    status: saved.lastStatus || STATUS.NOT_RUN,
    message: saved.lastMessage || 'This automation has not run from the dashboard yet.',
    lastRunTime: saved.lastRunTime || '',
    responseType: getOperationalResponseType_(capabilities),
    capabilities: capabilities,
    metrics: buildOperationalMetrics_(result, capabilities),
    diagnostics: buildOperationalDiagnostics_(parsed, result),
    rawResult: result
  };
}

function getOperationalResponseType_(capabilities) {
  if (capabilities.process) {
    return 'process';
  }

  if (capabilities.queueHealth) {
    return 'queueHealth';
  }

  if (capabilities.inspect) {
    return 'inspection';
  }

  if (capabilities.system) {
    return 'system';
  }

  if (capabilities.retry) {
    return 'retry';
  }

  if (capabilities.report) {
    return 'report';
  }

  return 'unknown';
}

function buildOperationalMetrics_(result, capabilities) {
  if (!result || typeof result !== 'object') {
    return {};
  }

  if (capabilities.queueHealth) {
    return {
      overallHealth: result.overallHealth || '',
      workflowCount: result.workflows ? Object.keys(result.workflows).length : 0,
      checkedAt: result.finishedAt || result.startedAt || ''
    };
  }

  if (capabilities.inspect) {
    const items = result.items || result.pendingClaimFolders || [];

    return {
      foundCount: Number(result.foundCount || items.length || 0),
      itemCount: items.length || 0
    };
  }

  if (capabilities.retry) {
    return {
      retryCount: Number(result.retryCount || result.retriedCount || result.processedCount || 0),
      errorCount: Number(result.errorCount || 0),
      warningCount: Number(result.warningCount || 0)
    };
  }

  return {
    foundCount: Number(result.foundCount || 0),
    processedCount: Number(result.processedCount || 0),
    errorCount: Number(result.errorCount || 0),
    warningCount: Number(result.warningCount || 0)
  };
}

function buildOperationalDiagnostics_(parsed, result) {
  if (!parsed) {
    return {
      hasParsedResponse: false,
      warnings: [],
      errors: []
    };
  }

  return {
    hasParsedResponse: true,
    warnings: result && result.warnings ? result.warnings : [],
    errors: result && result.errors ? result.errors : []
  };
}

function findAutomationRegistryRule_(automation) {
  const searchableText = [
    automation.id,
    automation.name,
    automation.category,
    automation.mainFunction,
    automation.action
  ].join(' ').toLowerCase();

  return AUTOMATION_REGISTRY_RULES.find(function(rule) {
    return searchableText.indexOf(String(rule.match || '').toLowerCase()) !== -1;
  }) || null;
}

function buildDashboardSections_(automations) {
  return DASHBOARD_SECTIONS
    .slice()
    .sort(function(a, b) {
      return a.order - b.order;
    })
    .map(function(section) {
      const activeAutomations = automations
        .filter(function(automation) {
          return getAutomationSectionId_(automation) === section.id;
        })
        .sort(function(a, b) {
          return (a.order || 100) - (b.order || 100);
        });

      const placeholderWorkflows = PLACEHOLDER_WORKFLOWS.filter(function(workflow) {
        return workflow.section === section.id;
      });

      return {
        id: section.id,
        name: section.name,
        description: section.description,
        order: section.order,
        activeAutomationCount: activeAutomations.length,
        placeholderWorkflowCount: placeholderWorkflows.length,
        activeAutomations: activeAutomations,
        placeholderWorkflows: placeholderWorkflows
      };
    });
}

function getAutomationSectionId_(automation) {
  if (automation.section) {
    return automation.section;
  }
  const role = automation.dashboardRole || 'business';
  const category = String(automation.category || '').toLowerCase();

  if (role === 'monitoring' || role === 'operations') {
    return 'operations';
  }

  if (category.indexOf('report') !== -1) {
    return 'reports';
  }

  if (category.indexOf('system') !== -1 || category.indexOf('deployment') !== -1) {
    return 'system';
  }

  return 'automations';
}

function buildOperationsSummary_(automations) {
  const watchedAutomations = automations.filter(function(automation) {
    return automation.dashboardRole === 'monitoring' || automation.dashboardRole === 'operations';
  });

  const watchedAutomationIds = watchedAutomations.map(function(automation) {
    return automation.id;
  });

  const statusCounts = watchedAutomations.reduce(function(counts, automation) {
    const status = automation.lastStatus || STATUS.NOT_RUN;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  const failedAutomations = watchedAutomations.filter(function(automation) {
    return automation.lastStatus === STATUS.ERROR;
  });

  const lastRunTimes = watchedAutomations
    .map(function(automation) {
      return automation.lastRunTime || '';
    })
    .filter(function(lastRunTime) {
      return lastRunTime !== '';
    })
    .sort();

  const queueHealthAutomation = automations.find(function(automation) {
    return automation.id === 'phase-4f-queue-health';
  });

  const queueHealthSummary = buildQueueHealthSummaryFromAutomation_(queueHealthAutomation);

  return {
    title: 'Phase 4F Operations Summary',
    watchedCount: watchedAutomations.length,
    successCount: statusCounts[STATUS.SUCCESS] || 0,
    errorCount: statusCounts[STATUS.ERROR] || 0,
    notRunCount: statusCounts[STATUS.NOT_RUN] || 0,
    overallStatus: queueHealthSummary && queueHealthSummary.overallHealth
      ? normalizeQueueHealthToDashboardStatus_(queueHealthSummary.overallHealth)
      : (failedAutomations.length > 0 ? STATUS.ERROR : STATUS.SUCCESS),
    latestRunTime: lastRunTimes.length > 0 ? lastRunTimes[lastRunTimes.length - 1] : '',
    failedAutomations: failedAutomations.map(function(automation) {
      return {
        id: automation.id,
        name: automation.name,
        lastMessage: automation.lastMessage
      };
    }),
    watchedAutomationIds: watchedAutomationIds,
    queueHealth: queueHealthSummary
  };
}

function buildQueueHealthSummaryFromAutomation_(automation) {
  if (!automation || !automation.lastRawResponse) {
    return null;
  }

  const parsed = parseAutomationResponse_(automation.lastRawResponse);

  if (!parsed || !parsed.result || !parsed.result.workflows) {
    return null;
  }

  const workflows = parsed.result.workflows;
  const workflowSummaries = {};
  const totals = {
    pendingClaimFolderCount: 0,
    retryReadyCount: 0,
    retryInProgressCount: 0,
    retryBlockedCount: 0,
    retryLimitReachedCount: 0,
    retryBacklogCount: 0,
    errorCount: 0,
    reviewCount: 0
  };

  Object.keys(workflows).forEach(function(workflowKey) {
    const workflow = workflows[workflowKey];
    const metrics = workflow.metrics || {};

    workflowSummaries[workflowKey] = {
      name: workflow.workflow || workflowKey,
      health: workflow.health || '',
      pendingClaimFolderCount: Number(metrics.pendingClaimFolderCount || 0),
      retryReadyCount: Number(metrics.retryReadyCount || 0),
      retryInProgressCount: Number(metrics.retryInProgressCount || 0),
      retryBlockedCount: Number(metrics.retryBlockedCount || 0),
      retryLimitReachedCount: Number(metrics.retryLimitReachedCount || 0),
      retryBacklogCount: Number(metrics.retryBacklogCount || 0),
      errorCount: Number(metrics.errorCount || 0),
      reviewCount: Number(metrics.reviewCount || 0)
    };

    totals.pendingClaimFolderCount += workflowSummaries[workflowKey].pendingClaimFolderCount;
    totals.retryReadyCount += workflowSummaries[workflowKey].retryReadyCount;
    totals.retryInProgressCount += workflowSummaries[workflowKey].retryInProgressCount;
    totals.retryBlockedCount += workflowSummaries[workflowKey].retryBlockedCount;
    totals.retryLimitReachedCount += workflowSummaries[workflowKey].retryLimitReachedCount;
    totals.retryBacklogCount += workflowSummaries[workflowKey].retryBacklogCount;
    totals.errorCount += workflowSummaries[workflowKey].errorCount;
    totals.reviewCount += workflowSummaries[workflowKey].reviewCount;
  });

  return {
    overallHealth: parsed.result.overallHealth || '',
    checkedAt: parsed.result.finishedAt || parsed.result.startedAt || '',
    totals: totals,
    workflows: workflowSummaries
  };
}

function normalizeQueueHealthToDashboardStatus_(health) {
  const value = String(health || '').toLowerCase().trim();

  if (value === 'critical') {
    return STATUS.ERROR;
  }

  return STATUS.SUCCESS;
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

      if (parsed && parsed.status) {
        status = normalizeStatus_(parsed.status);
        message = buildAutomationResultMessage_(automation, parsed);
      } else if (parsed) {
        status = STATUS.SUCCESS;
        message = buildAutomationResultMessage_(automation, parsed);
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
    message: message,
    durationMs: durationMs,
    rawResponse: rawResponse
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

    if (!automation.dashboardRole) {
      automation.dashboardRole = 'business';
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
    properties.setProperty(prefix + 'LAST_RAW_RESPONSE', truncate_(record.rawResponse, 20000));
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
      lastMessage: properties.getProperty(prefix + 'LAST_MESSAGE'),
      lastRawResponse: properties.getProperty(prefix + 'LAST_RAW_RESPONSE')
    };
  } catch (err) {
    Logger.log('ERROR: Failed to get saved status - ' + err.message);
    return {
      lastRunTime: null,
      lastStatus: STATUS.NOT_RUN,
      lastMessage: 'Error loading status',
      lastRawResponse: ''
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

function buildAutomationResultMessage_(automation, parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return 'Automation completed.';
  }

  if (parsed.message) {
    return parsed.message;
  }

  if (automation && automation.id === 'revision-intake-queue-health') {
    return [
      Number(parsed.openCount || 0) + ' open',
      Number(parsed.errorCount || 0) + ' errors',
      Number(parsed.todoistReviewNeededCount || 0) + ' Todoist review',
      Number(parsed.learningRulesCount || 0) + ' learning rules'
    ].join(' · ');
  }

  if (automation && automation.id === 'revision-todoist-review-needed') {
    const records = parsed.records || [];
    const count = Number(parsed.count || records.length || 0);

    if (count === 0) {
      return 'No Todoist tasks need review';
    }

    const firstRecord = records[0] || {};
    const firstSummary = [
      firstRecord.customerName || 'Customer Name Needed',
      firstRecord.claimNumber || 'Claim # needed'
    ].join(' - ');

    return count + ' task' + (count === 1 ? ' needs' : 's need') + ' human review · ' + firstSummary;
  }

  if (automation && automation.id === 'revision-intake-process') {
    return [
      Number(parsed.createdCount || parsed.processedCount || 0) + ' created',
      Number(parsed.skippedCount || 0) + ' skipped',
      Number(parsed.errorCount || 0) + ' errors'
    ].join(' · ');
  }

  if (automation && automation.id === 'revision-enrich-claim-data') {
    return [
      Number(parsed.enrichedCount || 0) + ' enriched',
      Number(parsed.unchangedCount || 0) + ' unchanged',
      Number((parsed.errors || []).length || parsed.errorCount || 0) + ' errors'
    ].join(' · ');
  }

  if (automation && automation.id === 'revision-reclassify-existing') {
    return [
      Number(parsed.updatedCount || 0) + ' updated',
      Number(parsed.unchangedCount || 0) + ' unchanged'
    ].join(' · ');
  }

  if (automation && automation.id === 'revision-refresh-todoist-tasks') {
    return [
      Number(parsed.refreshedCount || 0) + ' refreshed',
      Number(parsed.skippedCount || 0) + ' skipped',
      Number(parsed.errorCount || 0) + ' errors'
    ].join(' · ');
  }

  if (parsed.action === 'queueHealth') {
    return [
      Number(parsed.openCount || 0) + ' open',
      Number(parsed.errorCount || 0) + ' errors'
    ].join(' · ');
  }

  if (parsed.status) {
    return parsed.status;
  }

  return JSON.stringify(parsed) || 'Automation completed.';
}

function parseAutomationResponse_(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(text);

    if (!parsed.status) {
      Logger.log('WARN: Response missing status field: ' + text);
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
    'MM/dd/yy hh:mm:ss a'
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
  Logger.log('✓ Found ' + PLACEHOLDER_WORKFLOWS.length + ' placeholder workflow(s)');

  const shellData = getDashboardShellData();
  const operationsSummary = getOperationsSummaryData();

  Logger.log('✓ Dashboard shell sections: ' + shellData.sections.length);
  Logger.log('✓ Dashboard shell automations: ' + shellData.automations.length);
  Logger.log('✓ Operations watched count: ' + operationsSummary.watchedCount);

  shellData.automations.forEach(function(automation) {
    Logger.log('  - ' + automation.name + ' (' + automation.id + ')');
    Logger.log('    Action: ' + (automation.action || 'process'));
    Logger.log('    Dashboard role: ' + (automation.dashboardRole || 'business'));
    Logger.log('    Section: ' + automation.section);
    Logger.log('    Featured: ' + automation.featured);
    Logger.log('    Order: ' + automation.order);
    Logger.log('    Capabilities: ' + JSON.stringify(automation.capabilities));
    Logger.log('    Response Type: ' + automation.normalizedResponse.responseType);

    const configuredAutomation = DASHBOARD_CONFIG.automations.find(function(item) {
      return item.id === automation.id;
    });

    Logger.log('    URL: ' + (configuredAutomation ? configuredAutomation.webAppUrl : 'Not configured'));
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

function getHomepageShellUrl() {
  const baseUrl = ScriptApp.getService().getUrl();
  const homepageUrl = baseUrl + '?view=homepage';

  Logger.log('Homepage URL: ' + homepageUrl);

  return homepageUrl;
}

function testHomepageShellRoute() {
  const url = getHomepageShellUrl();

  Logger.log('Homepage URL: ' + url);

  return {
    status: 'Success',
    homepageUrl: url,
    generatedAt: new Date().toISOString()
  };
}

function testClaimsShellRoute() {
  const baseUrl = ScriptApp.getService().getUrl();

  const result = {
    status: 'Success',
    claimWorkspaceUrl: baseUrl + '?view=claimShell&v=1',
    coveragePendingUrl: baseUrl + '?view=claimShell&condition=Coverage%20Pending&v=1',
    claimShellUrl: baseUrl + '?view=claimShell&claimId=CLM-26A-0052-WTR&v=1',
    generatedAt: new Date().toISOString()
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}
