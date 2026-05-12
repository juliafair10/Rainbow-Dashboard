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
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbxXVe8Lg1d7Da0RdR5nJujatv2bg4hkP8OjJrktzyDlB5L30QJnk4JU9ZDzPJD5CkudJA/exec'
    },
    {
      id: 'insurance-intake-automation',
      name: 'Insurance Intake Automation',
      category: 'Insurance / Gmail / Todoist',
      dashboardRole: 'business',
      mainFunction: 'processInsuranceIntake',
      action: 'process',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'asbestos-attachment-intake',
      name: 'Asbestos Attachment Intake',
      category: 'Vendor Attachments / Gmail / Drive',
      dashboardRole: 'business',
      mainFunction: 'processAsbestosAttachments',
      action: 'processAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'itel-attachment-intake',
      name: 'Itel Attachment Intake',
      category: 'Vendor Attachments / Gmail / Drive',
      dashboardRole: 'business',
      mainFunction: 'processItelAttachments',
      action: 'processItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'phase-4f-queue-health',
      name: 'Phase 4F Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getQueueHealth',
      action: 'queueHealth',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'asbestos-queue-health',
      name: 'Asbestos Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getAsbestosQueueHealth',
      action: 'queueHealthAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'itel-queue-health',
      name: 'Itel Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getItelQueueHealth',
      action: 'queueHealthItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'inspect-asbestos-pending-claim-folders',
      name: 'Inspect Asbestos Pending Folders',
      category: 'Recovery / Inspection',
      dashboardRole: 'operations',
      mainFunction: 'inspectAsbestosPendingClaimFolders',
      action: 'inspectAsbestosPendingClaimFolders',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'inspect-itel-pending-claim-folders',
      name: 'Inspect Itel Pending Folders',
      category: 'Recovery / Inspection',
      dashboardRole: 'operations',
      mainFunction: 'inspectItelPendingClaimFolders',
      action: 'inspectItelPendingClaimFolders',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'retry-insurance-intake',
      name: 'Retry Insurance Intake',
      category: 'Recovery / Retry',
      dashboardRole: 'operations',
      mainFunction: 'retryWorkflow',
      action: 'retryInsuranceIntake',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'retry-asbestos-intake',
      name: 'Retry Asbestos',
      category: 'Recovery / Retry',
      dashboardRole: 'operations',
      mainFunction: 'retryWorkflow',
      action: 'retryAsbestos',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'retry-itel-intake',
      name: 'Retry Itel',
      category: 'Recovery / Retry',
      dashboardRole: 'operations',
      mainFunction: 'retryWorkflow',
      action: 'retryItel',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'setup-retry-triggers',
      name: 'Setup Scheduled Retry Triggers',
      category: 'Recovery / Retry Operations',
      dashboardRole: 'operations',
      mainFunction: 'setupRetryTriggers',
      action: 'setupRetryTriggers',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'delete-retry-triggers',
      name: 'Delete Scheduled Retry Triggers',
      category: 'Recovery / Retry Operations',
      dashboardRole: 'operations',
      mainFunction: 'deleteRetryTriggers',
      action: 'deleteRetryTriggers',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
    },
    {
      id: 'insurance-intake-queue-health',
      name: 'Insurance Intake Queue Health',
      category: 'Operations / Monitoring',
      dashboardRole: 'monitoring',
      mainFunction: 'getInsuranceIntakeQueueHealth',
      action: 'queueHealthInsuranceIntake',
      webAppUrl: 'https://script.google.com/a/macros/rbwatl.com/s/AKfycbz5lkcTtcxvi9UnKgN0lUS0c7V_4Bld7IZhnTVa9n1xN30pwDXiWcnVPQAxkmVeAKGeAw/exec'
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

function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(DASHBOARD_CONFIG.dashboardTitle)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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