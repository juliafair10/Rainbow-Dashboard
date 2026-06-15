const HOMEPAGE_SCHEDULE_CALENDAR_ID = '6aqe6hond86u044tgs868ouje8@group.calendar.google.com';
const HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';

const HOMEPAGE_CLAIM_SHEET_NAMES = {
  claims: 'Claims',
  timeline: 'Timeline_Events',
  complianceActions: 'Compliance_Actions',
  claimSummaries: 'Claim_Summaries',
  importLog: 'Import_Log'
};

function getHomepageClaimSummaryData() {
  const claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims).map(normalizeHomepageClaim_);
  const timeline = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.timeline).map(normalizeHomepageTimelineEvent_);
  const complianceActions = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.complianceActions).map(normalizeHomepageComplianceAction_);
  const claimSummaries = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claimSummaries).map(normalizeHomepageClaimSummary_);

  const activeClaims = claims.filter(function(claim) {
    return isHomepageActiveClaim_(claim);
  });

  const activeClaimIds = activeClaims.reduce(function(map, claim) {
    addHomepageClaimKeysToMap_(map, claim);
    return map;
  }, {});

  const activeClaimSummaries = claimSummaries.filter(function(summary) {
    return homepageRecordMatchesActiveClaim_(summary, activeClaimIds);
  });

  const openComplianceActions = complianceActions.filter(function(action) {
    return homepageRecordMatchesActiveClaim_(action, activeClaimIds) &&
      isHomepageOpenStatus_(action.Action_Status || action.Status);
  });

  const activeConditions = getHomepageConditionsFromClaims_(activeClaims);
  const activeAlerts = getHomepageAlertsFromClaims_(activeClaims);

  return {
    generatedAt: new Date().toISOString(),
    activeClaimCount: activeClaims.length,
    openConditionCount: activeConditions.length,
    openAlertCount: activeAlerts.length,
    openComplianceActionCount: openComplianceActions.length,
    claimSummaryCount: claimSummaries.length,
    activeClaimSummaryCount: activeClaimSummaries.length,
    claimSummaryMetrics: getHomepageClaimSummaryMetrics_(activeClaimSummaries),
    kpis: {
      needsAttention: countHomepageClaimsByHealth_(activeClaims, ['Attention Soon', 'At Risk', 'Escalated', 'Critical']),
      atRisk: countHomepageClaimsByHealth_(activeClaims, ['At Risk']),
      escalated: countHomepageClaimsByHealth_(activeClaims, ['Escalated']),
      critical: countHomepageClaimsByHealth_(activeClaims, ['Critical']),
      waitingOnInsurance: countHomepageClaimsWithAnyCondition_(activeConditions, [
        'Coverage Pending',
        'Estimate Under Review',
        'Supplement Under Review',
        'Waiting on Payment'
      ]),
      monitoringActive: countHomepageClaimsWithAnyCondition_(activeConditions, ['Monitoring Active']),
      recentActivityClaims: countHomepageSummariesWithRecentActivity_(activeClaimSummaries),
      openComplianceActions: sumHomepageOpenComplianceActions_(activeClaimSummaries),
      timelineEvents: sumHomepageTimelineEvents_(activeClaimSummaries)
    },
    todayPriorities: getHomepageTodayPriorities_(activeClaims, activeConditions, activeAlerts, openComplianceActions),
    todaySchedule: getHomepageTodaySchedule_(activeClaims, activeConditions, activeAlerts),
    becomingStale: getHomepageBecomingStale_(activeClaims, activeConditions, activeAlerts),
    recentActivity: getHomepageRecentActivity_(activeClaims, timeline),
    recentClaimSummaries: getHomepageRecentClaimSummaries_(activeClaimSummaries),
    operationalAlerts: getHomepageOperationalAlerts_(activeClaims, activeAlerts)
  };
}

function getHomepageClaimSummaryMetrics_(summaries) {
  return {
    recentActivityClaims: countHomepageSummariesWithRecentActivity_(summaries),
    timelineEvents: sumHomepageTimelineEvents_(summaries),
    openComplianceActions: sumHomepageOpenComplianceActions_(summaries)
  };
}

function countHomepageSummariesWithRecentActivity_(summaries) {
  return (summaries || []).filter(function(summary) {
    return Boolean(summary.Last_Activity_Date || summary.Last_Activity_Summary);
  }).length;
}

function sumHomepageTimelineEvents_(summaries) {
  return (summaries || []).reduce(function(total, summary) {
    return total + Number(summary.Timeline_Event_Count || 0);
  }, 0);
}

function sumHomepageOpenComplianceActions_(summaries) {
  return (summaries || []).reduce(function(total, summary) {
    return total + Number(summary.Open_Compliance_Actions || 0);
  }, 0);
}

function getHomepageRecentClaimSummaries_(summaries) {
  return (summaries || [])
    .filter(function(summary) {
      return Boolean(summary.Last_Activity_Date || summary.Last_Activity_Summary);
    })
    .sort(function(a, b) {
      return new Date(b.Last_Activity_Date || 0).getTime() - new Date(a.Last_Activity_Date || 0).getTime();
    })
    .slice(0, 8)
    .map(function(summary) {
      return {
        claimId: summary.Claim_ID || '',
        jobNumber: summary.Job_Number || '',
        customerName: summary.Customer_Name || '',
        lastActivityDate: summary.Last_Activity_Date || '',
        lastActivityType: summary.Last_Activity_Type || '',
        lastActivitySummary: summary.Last_Activity_Summary || '',
        timelineEventCount: summary.Timeline_Event_Count || 0,
        openComplianceActions: summary.Open_Compliance_Actions || 0,
        targetWorkspace: 'claims'
      };
    });
}

function getHomepageKpis() {
  return getHomepageClaimSummaryData().kpis;
}

function getHomepageSheetRows_(sheetName) {
  const ss = SpreadsheetApp.openById(HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Missing homepage source sheet: ' + sheetName);
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headerRowIndex = findHomepageHeaderRowIndex_(values, sheetName);
  const headers = values[headerRowIndex].map(function(header) {
    return String(header || '').trim();
  });

  return values.slice(headerRowIndex + 1).filter(function(row) {
    return row.some(function(value) {
      return value !== '' && value !== null;
    });
  }).map(function(row) {
    return headers.reduce(function(record, header, index) {
      if (header) {
        record[header] = row[index];
      }
      return record;
    }, {});
  });
}

function findHomepageHeaderRowIndex_(values, sheetName) {
  const expectedHeaderSets = {
    Claims: ['Claim ID', 'Claim_ID'],
    Timeline_Events: ['Claim ID', 'Claim_ID', 'Event Date', 'Event_Date'],
    Compliance_Actions: ['Claim ID', 'Claim_ID', 'Status', 'Action Status', 'Action_Status'],
    Claim_Summaries: ['Claim ID', 'Claim_ID', 'Summary', 'Claim Summary'],
    Import_Log: ['Import ID', 'Import_ID', 'Imported At', 'Imported_At']
  };

  const expectedHeaders = expectedHeaderSets[sheetName] || [];

  for (let rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
    const rowHeaders = values[rowIndex].map(function(header) {
      return String(header || '').trim();
    });

    const hasExpectedHeader = expectedHeaders.some(function(expectedHeader) {
      return rowHeaders.indexOf(expectedHeader) !== -1;
    });

    if (hasExpectedHeader) {
      return rowIndex;
    }
  }

  return 0;
}

function getHomepageValue_(record, keys) {
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (record.hasOwnProperty(key) && record[key] !== '' && record[key] !== null && record[key] !== undefined) {
      return record[key];
    }
  }
  return '';
}

function normalizeHomepageDateValue_(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return value;
}

function normalizeHomepageBoolean_(value) {
  return value === true || String(value || '').toLowerCase() === 'true' || String(value || '').toLowerCase() === 'yes';
}

function normalizeHomepageClaim_(row) {
  return {
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Claim_Number: getHomepageValue_(row, ['Claim_Number', 'Claim Number']),
    Job_Number: getHomepageValue_(row, ['Job_Number', 'Job Number']),
    Display_Name: getHomepageValue_(row, ['Display_Name', 'Display Name', 'Claim_Label', 'Claim Label']),
    Customer_Name: getHomepageValue_(row, ['Customer_Name', 'Customer Name', 'Display_Name', 'Display Name']),
    Property_Address: getHomepageValue_(row, ['Property_Address', 'Property Address', 'Address']),
    Lifecycle_State: getHomepageValue_(row, ['Lifecycle_State', 'Lifecycle State']),
    Ownership_Area: getHomepageValue_(row, ['Ownership_Area', 'Ownership Area']),
    Primary_Owner: getHomepageValue_(row, ['Primary_Owner', 'Primary Owner']),
    Operational_Health: getHomepageValue_(row, ['Operational_Health', 'Health_Level', 'Health Level', 'Health Status']),
    Health_Level: getHomepageValue_(row, ['Health_Level', 'Health Level', 'Operational_Health', 'Health Status']),
    Health_Reason: getHomepageValue_(row, ['Health_Reason', 'Health Reason']),
    Conditions: getHomepageValue_(row, ['Conditions']),
    Alerts: getHomepageValue_(row, ['Alerts']),
    Last_Meaningful_Activity_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Last_Meaningful_Activity_Date', 'Last Meaningful Activity Date', 'Last Activity Date'])),
    Days_Since_Activity: getHomepageValue_(row, ['Days_Since_Activity', 'Days Since Activity']),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Created_At', 'Created At', 'Created Date'])),
    Updated_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Updated_At', 'Updated At', 'Last Updated'])),
    Is_Not_Sold: getHomepageValue_(row, ['Is_Not_Sold', 'Is Not Sold']),
    Is_Operationally_Complete: getHomepageValue_(row, ['Is_Operationally_Complete', 'Is Operationally Complete'])
  };
}

function normalizeHomepageTimelineEvent_(row) {
  return {
    Timeline_Event_ID: getHomepageValue_(row, ['Timeline_Event_ID', 'Timeline Event ID', 'Event ID']),
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Event_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Event_Date', 'Event Date', 'Activity Date', 'Created Date'])),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Created_At', 'Created At', 'Created Date'])),
    Event_Type: getHomepageValue_(row, ['Event_Type', 'Event Type', 'Activity Type', 'Activity Label']),
    Summary: getHomepageValue_(row, ['Summary', 'Activity Label', 'Description']),
    Detail: getHomepageValue_(row, ['Detail', 'Details', 'Note', 'Notes']),
    Source_System: getHomepageValue_(row, ['Source_System', 'Source System', 'Event_Source', 'Event Source']),
    Event_Source: getHomepageValue_(row, ['Event_Source', 'Event Source', 'Source_System', 'Source System']),
    Related_Workflow: getHomepageValue_(row, ['Related_Workflow', 'Related Workflow', 'Workflow']),
    Actor: getHomepageValue_(row, ['Actor', 'Owner', 'Primary Owner']),
    Category: getHomepageValue_(row, ['Category', 'Event Category']),
    Is_Meaningful_Activity: normalizeHomepageBoolean_(getHomepageValue_(row, ['Is_Meaningful_Activity', 'Is Meaningful Activity', 'Meaningful']))
  };
}

function normalizeHomepageComplianceAction_(row) {
  const actionTitle = getHomepageValue_(row, ['Action Title', 'Action_Title', 'Condition_Type', 'Condition Type', 'Alert_Type', 'Alert Type', 'Action_Type', 'Action Type', 'Compliance Type']);
  const requiredAction = getHomepageValue_(row, ['Required Action', 'Required_Action', 'Recommended_Action', 'Recommended Action', 'Next Action']);
  const status = getHomepageValue_(row, ['Status', 'Condition_Status', 'Condition Status', 'Alert_Status', 'Alert Status', 'Action_Status', 'Action Status']);

  return {
    Compliance_Action_ID: getHomepageValue_(row, ['Compliance_Action_ID', 'Compliance Action ID', 'Action ID', 'Alert ID']),
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Job_Number: getHomepageValue_(row, ['Job_Number', 'Job Number']),
    Action_Title: actionTitle,
    Condition_Type: actionTitle,
    Alert_Type: actionTitle,
    Required_Action: requiredAction,
    Condition_Status: status,
    Alert_Status: status,
    Action_Status: status,
    Status: status,
    Severity: getHomepageValue_(row, ['Severity', 'Priority']),
    Priority: getHomepageValue_(row, ['Priority', 'Severity']),
    Reason: getHomepageValue_(row, ['Reason', 'Description', 'Notes', 'Required Action']),
    Recommended_Action: requiredAction,
    Follow_Up_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Follow_Up_Date', 'Follow Up Date', 'Due Date'])),
    Due_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Due Date', 'Due_Date', 'Follow_Up_Date', 'Follow Up Date'])),
    Completed_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Completed Date', 'Completed_Date'])),
    Loss_Address: getHomepageValue_(row, ['Loss Address', 'Loss_Address']),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Created_At', 'Created At', 'Created Date']))
  };
}

function normalizeHomepageClaimSummary_(row) {
  return {
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Job_Number: getHomepageValue_(row, ['Job_Number', 'Job Number']),
    Customer_Name: getHomepageValue_(row, ['Customer_Name', 'Customer Name']),
    Last_Activity_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Last Activity Date', 'Last_Activity_Date'])),
    Last_Activity_Type: getHomepageValue_(row, ['Last Activity Type', 'Last_Activity_Type']),
    Last_Activity_Summary: getHomepageValue_(row, ['Last Activity Summary', 'Last_Activity_Summary']),
    Timeline_Event_Count: Number(getHomepageValue_(row, ['Timeline Event Count', 'Timeline_Event_Count']) || 0),
    Open_Compliance_Actions: Number(getHomepageValue_(row, ['Open Compliance Actions', 'Open_Compliance_Actions']) || 0),
    Generated_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Generated Date', 'Generated_Date'])),
    Summary: getHomepageValue_(row, ['Last Activity Summary', 'Last_Activity_Summary', 'Summary', 'Claim Summary']),
    Next_Action: getHomepageValue_(row, ['Next_Action', 'Next Action']),
    Blockers: getHomepageValue_(row, ['Blockers']),
    Last_Updated: normalizeHomepageDateValue_(getHomepageValue_(row, ['Generated Date', 'Generated_Date', 'Last_Updated', 'Last Updated', 'Updated At']))
  };
}

function getHomepageClaimDisplayName_(claim) {
  if (!claim) {
    return 'Unknown Claim';
  }

  const name = claim.Customer_Name || claim.Display_Name || 'Unknown Customer';
  const number = claim.Claim_Number || claim.Job_Number || '';

  return number ? name + ' · ' + number : name;
}

function addHomepageClaimKeysToMap_(map, claim) {
  if (!claim) {
    return;
  }

  const claimId = String(claim.Claim_ID || '');
  const jobNumber = String(claim.Job_Number || '');
  const claimNumber = String(claim.Claim_Number || '');

  if (claimId) {
    map[claimId] = true;
    map[claimId.replace(/^CLM-/, '')] = true;
  }

  if (jobNumber) {
    map[jobNumber] = true;
    map['CLM-' + jobNumber] = true;
  }

  if (claimNumber) {
    map[claimNumber] = true;
  }
}

function homepageRecordMatchesActiveClaim_(record, activeClaimIds) {
  if (!record) {
    return false;
  }

  const claimId = String(record.Claim_ID || '');
  const jobNumber = String(record.Job_Number || '');
  const claimNumber = String(record.Claim_Number || '');

  return Boolean(
    activeClaimIds[claimId] ||
    activeClaimIds[claimId.replace(/^CLM-/, '')] ||
    activeClaimIds[jobNumber] ||
    activeClaimIds['CLM-' + jobNumber] ||
    activeClaimIds[claimNumber]
  );
}

function isHomepageActiveClaim_(claim) {
  if (!claim || !claim.Claim_ID) {
    return false;
  }

  if (String(claim.Is_Not_Sold).toLowerCase() === 'true') {
    return false;
  }

  if (String(claim.Is_Operationally_Complete).toLowerCase() === 'true') {
    return false;
  }

  if (claim.Lifecycle_State === 'Not Sold' || claim.Lifecycle_State === 'Operationally Complete') {
    return false;
  }

  return true;
}

function isHomepageOpenStatus_(status) {
  const normalized = String(status || '').toLowerCase();
  return normalized !== 'closed' && normalized !== 'resolved' && normalized !== 'complete' && normalized !== 'completed';
}

function countHomepageClaimsByHealth_(claims, healthLevels) {
  const levelMap = (healthLevels || []).reduce(function(map, level) {
    map[level] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  claims.forEach(function(claim) {
    if (claim.Claim_ID && levelMap[claim.Health_Level || claim.Operational_Health || 'Healthy']) {
      countedClaimIds[claim.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}

function countHomepageClaimsWithAnyCondition_(conditions, conditionTypes) {
  const typeMap = (conditionTypes || []).reduce(function(map, conditionType) {
    map[conditionType] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  conditions.forEach(function(condition) {
    if (condition.Claim_ID && typeMap[condition.Condition_Type]) {
      countedClaimIds[condition.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}

function getHomepageConditionsFromClaims_(claims) {
  return expandHomepageClaimListField_(claims, 'Conditions', 'Condition');
}

function getHomepageAlertsFromClaims_(claims) {
  return expandHomepageClaimListField_(claims, 'Alerts', 'Alert');
}

function expandHomepageClaimListField_(claims, fieldName, typeLabel) {
  const results = [];

  (claims || []).forEach(function(claim) {
    const rawValue = claim[fieldName] || '';

    parseHomepageListValue_(rawValue).forEach(function(value) {
      results.push({
        Claim_ID: claim.Claim_ID,
        Condition_Type: typeLabel === 'Condition' ? value : '',
        Alert_Type: typeLabel === 'Alert' ? value : '',
        Status: 'Open',
        Action_Status: 'Open',
        Severity: '',
        Reason: value,
        Recommended_Action: '',
        Created_At: claim.Updated_At || claim.Created_At || ''
      });
    });
  });

  return results;
}

function parseHomepageListValue_(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return String(value)
    .split(/[,;|\n]+/)
    .map(function(item) {
      return item.trim();
    })
    .filter(function(item) {
      return item !== '';
    });
}

function getHomepagePriorityRank_(priority) {
  const normalized = String(priority || '').toLowerCase();

  if (normalized === 'critical') return 5;
  if (normalized === 'high') return 10;
  if (normalized === 'medium') return 20;
  if (normalized === 'low') return 30;

  return 50;
}

function getHomepageTodayPriorities_(claims, conditions, alerts, complianceActions) {
  const claimMap = {};

  (claims || []).forEach(function(claim) {
    if (claim.Claim_ID) {
      claimMap[claim.Claim_ID] = claim;
      claimMap[String(claim.Claim_ID).replace(/^CLM-/, '')] = claim;
    }

    if (claim.Job_Number) {
      claimMap[claim.Job_Number] = claim;
      claimMap['CLM-' + claim.Job_Number] = claim;
    }

    if (claim.Claim_Number) {
      claimMap[claim.Claim_Number] = claim;
    }
  });

  const priorities = [];
  const seenKeys = {};

  (conditions || []).forEach(function(condition) {
    if (condition.Condition_Type !== 'Monitoring Active') {
      return;
    }

    const key = condition.Claim_ID + '|condition|' + condition.Condition_Type;
    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    const claim = claimMap[condition.Claim_ID] || {};

    priorities.push({
      claimId: condition.Claim_ID,
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: claim.Health_Level || claim.Operational_Health || 'Healthy',
      title: 'Monitoring follow-up is overdue',
      reason: condition.Reason || '',
      type: 'Condition',
      conditionType: condition.Condition_Type || '',
      alertType: '',
      followUpDate: condition.Follow_Up_Date || '',
      priorityRank: 25,
      targetWorkspace: 'claims'
    });
  });

  (alerts || []).forEach(function(alert) {
    const key = alert.Claim_ID + '|alert|' + (alert.Alert_Type || '');

    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    const claim = claimMap[alert.Claim_ID] || {};

    priorities.push({
      claimId: alert.Claim_ID,
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: claim.Health_Level || claim.Operational_Health || 'Healthy',
      title: alert.Alert_Type || 'Alert',
      reason: alert.Reason || '',
      type: 'Alert',
      conditionType: '',
      alertType: alert.Alert_Type || '',
      followUpDate: '',
      priorityRank: 30,
      targetWorkspace: 'claims'
    });
  });

  (complianceActions || []).forEach(function(action) {
    const key = action.Claim_ID + '|compliance|' + (action.Compliance_Action_ID || action.Action_Title || action.Required_Action || '');

    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    const claim = claimMap[action.Claim_ID] || claimMap[action.Job_Number] || claimMap[action.Claim_Number] || {};

    priorities.push({
      claimId: action.Claim_ID,
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || claim.Job_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: claim.Health_Level || claim.Operational_Health || 'Not Evaluated',
      title: action.Action_Title || 'Open Compliance Action',
      reason: action.Required_Action || action.Reason || '',
      type: 'Compliance Action',
      conditionType: '',
      alertType: '',
      followUpDate: action.Due_Date || action.Follow_Up_Date || '',
      priorityRank: getHomepagePriorityRank_(action.Priority || action.Severity),
      targetWorkspace: 'claims'
    });
  });

  priorities.sort(function(a, b) {
    return (a.priorityRank || 999) - (b.priorityRank || 999);
  });

  return priorities;
}

function getHomepageTodaySchedule_(claims, conditions, alerts) {
  const calendar = CalendarApp.getCalendarById(HOMEPAGE_SCHEDULE_CALENDAR_ID);

  if (!calendar) {
    return [];
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  return calendar.getEvents(startOfDay, endOfDay).map(function(event) {
    return {
      calendarId: HOMEPAGE_SCHEDULE_CALENDAR_ID,
      title: event.getTitle() || 'Calendar Event',
      startTime: event.getStartTime() ? event.getStartTime().toISOString() : '',
      endTime: event.getEndTime() ? event.getEndTime().toISOString() : '',
      location: event.getLocation() || '',
      isAllDayEvent: event.isAllDayEvent(),
      targetWorkspace: 'calendar'
    };
  }).sort(function(a, b) {
    return new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime();
  });
}

function getHomepageBecomingStale_(claims, conditions, alerts) {
  return [];
}

function getHomepageRecentActivity_(claims, timeline) {
  const activeClaimIds = {};
  const claimMap = {};

  (claims || []).forEach(function(claim) {
    if (claim.Claim_ID) {
      activeClaimIds[claim.Claim_ID] = true;
      claimMap[claim.Claim_ID] = claim;
    }
  });

  return (timeline || []).filter(function(event) {
    return event.Claim_ID && activeClaimIds[event.Claim_ID];
  }).sort(function(a, b) {
    const aDate = new Date(a.Event_Date || a.Created_At || 0).getTime();
    const bDate = new Date(b.Event_Date || b.Created_At || 0).getTime();
    return bDate - aDate;
  }).slice(0, 8).map(function(event) {
    const claim = claimMap[event.Claim_ID] || {};

    return {
      timelineEventId: event.Timeline_Event_ID || '',
      claimId: event.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      eventDate: event.Event_Date || event.Created_At || '',
      eventType: event.Event_Type || '',
      summary: event.Summary || event.Event_Type || 'Timeline activity',
      detail: event.Detail || '',
      sourceSystem: event.Source_System || event.Event_Source || '',
      relatedWorkflow: event.Related_Workflow || '',
      isMeaningful: event.Is_Meaningful_Activity === true || event.Is_Meaningful_Activity === 'TRUE',
      targetWorkspace: 'claims'
    };
  });
}

function getHomepageOperationalAlerts_(claims, alerts) {
  const claimMap = {};
  const seenKeys = {};

  (claims || []).forEach(function(claim) {
    if (claim.Claim_ID) {
      claimMap[claim.Claim_ID] = claim;
    }
  });

  return (alerts || []).filter(function(alert) {
    const key = alert.Claim_ID + '|alert|' + (alert.Alert_Type || '');
    if (seenKeys[key]) {
      return false;
    }
    seenKeys[key] = true;
    return true;
  }).map(function(alert) {
    const claim = claimMap[alert.Claim_ID] || {};

    return {
      claimId: alert.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      alertType: alert.Alert_Type || 'Alert',
      severity: alert.Severity || '',
      reason: alert.Reason || '',
      recommendedAction: alert.Recommended_Action || '',
      createdAt: alert.Created_At || '',
      targetWorkspace: 'claims'
    };
  });
}

function testGetHomepageClaimSummaryData() {
  const data = getHomepageClaimSummaryData();

  Logger.log('Homepage data generated at: ' + data.generatedAt);
  Logger.log('Active claim count: ' + data.activeClaimCount);
  Logger.log('Open condition count: ' + data.openConditionCount);
  Logger.log('Open alert count: ' + data.openAlertCount);
  Logger.log('Open compliance action count: ' + data.openComplianceActionCount);
  Logger.log('Active claim summary count: ' + data.activeClaimSummaryCount);
  Logger.log('Claim summary metrics: ' + JSON.stringify(data.claimSummaryMetrics, null, 2));
  Logger.log('KPIs: ' + JSON.stringify(data.kpis, null, 2));
  Logger.log('Today priorities count: ' + data.todayPriorities.length);
  Logger.log('Today schedule count: ' + data.todaySchedule.length);
  Logger.log('Becoming stale count: ' + data.becomingStale.length);
  Logger.log('Recent activity count: ' + data.recentActivity.length);
  Logger.log('Recent claim summaries count: ' + data.recentClaimSummaries.length);
  Logger.log('Operational alerts count: ' + data.operationalAlerts.length);
  Logger.log('Sample priority: ' + JSON.stringify(data.todayPriorities[0] || null, null, 2));
  Logger.log('First 5 priorities: ' + JSON.stringify(data.todayPriorities.slice(0, 5), null, 2));
  Logger.log('Sample recent activity: ' + JSON.stringify(data.recentActivity[0] || null, null, 2));
  Logger.log('Sample recent claim summary: ' + JSON.stringify(data.recentClaimSummaries[0] || null, null, 2));
  Logger.log('Sample operational alert: ' + JSON.stringify(data.operationalAlerts[0] || null, null, 2));

  return data;
}

function testHomepageClaimFiltering() {
  const claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims).map(normalizeHomepageClaim_);

  const included = [];
  const excluded = [];

  claims.forEach(function(claim) {
    const reasons = [];

    if (String(claim.Is_Not_Sold).toLowerCase() === 'true') {
      reasons.push('Is_Not_Sold');
    }

    if (String(claim.Is_Operationally_Complete).toLowerCase() === 'true') {
      reasons.push('Is_Operationally_Complete');
    }

    if (claim.Lifecycle_State === 'Not Sold') {
      reasons.push('Lifecycle=Not Sold');
    }

    if (claim.Lifecycle_State === 'Operationally Complete') {
      reasons.push('Lifecycle=Operationally Complete');
    }

    if (isHomepageActiveClaim_(claim)) {
      included.push({
        claimId: claim.Claim_ID,
        claimNumber: claim.Claim_Number,
        lifecycle: claim.Lifecycle_State,
        health: claim.Operational_Health
      });
    } else {
      excluded.push({
        claimId: claim.Claim_ID,
        claimNumber: claim.Claim_Number,
        lifecycle: claim.Lifecycle_State,
        reasons: reasons.join(', ')
      });
    }
  });

  Logger.log('TOTAL CLAIMS: ' + claims.length);
  Logger.log('INCLUDED: ' + included.length);
  Logger.log('EXCLUDED: ' + excluded.length);
  Logger.log('FIRST 10 INCLUDED: ' + JSON.stringify(included.slice(0, 10), null, 2));
  Logger.log('FIRST 20 EXCLUDED: ' + JSON.stringify(excluded.slice(0, 20), null, 2));

  return {
    total: claims.length,
    included: included.length,
    excluded: excluded.length
  };
}

function testHomepageSourceInventory() {
  const ss = SpreadsheetApp.openById(HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  const inventory = ss.getSheets().map(function(sheet) {
    const values = sheet.getDataRange().getValues();
    return {
      sheetName: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn(),
      dataRows: Math.max(values.length - 1, 0),
      headers: values.length ? values[0] : []
    };
  });

  Logger.log('Homepage source spreadsheet ID: ' + HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  Logger.log('Homepage source inventory: ' + JSON.stringify(inventory, null, 2));

  return inventory;
}
