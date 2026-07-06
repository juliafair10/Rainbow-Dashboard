const HOMEPAGE_SCHEDULE_CALENDAR_ID = '6aqe6hond86u044tgs868ouje8@group.calendar.google.com';
const HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';

const HOMEPAGE_CLAIM_SHEET_NAMES = {
  claims: 'Claims',
  timeline: 'Timeline_Events',
  conditions: 'Claim_Conditions',
  alerts: 'Claim_Alerts',
  complianceActions: 'Compliance_Actions',
  claimSummaries: 'Claim_Summaries',
  importLog: 'Import_Log'
};

function getHomepageClaimSummaryData() {
  const claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims).map(normalizeHomepageClaim_);
  const timeline = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.timeline).map(normalizeHomepageTimelineEvent_);
  const claimConditions = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.conditions).map(normalizeHomepageCondition_);
  const claimAlerts = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.alerts).map(normalizeHomepageAlert_);
  const complianceActions = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.complianceActions).map(normalizeHomepageComplianceAction_);
  const claimSummaries = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claimSummaries).map(normalizeHomepageClaimSummary_);
  const intakeAuditState = typeof getIntakeAuditState_ === 'function'
    ? getIntakeAuditState_()
    : { records: [], dispositionByIssueKey: {} };

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

  const activeConditions = claimConditions.filter(function(condition) {
    return homepageRecordMatchesActiveClaim_(condition, activeClaimIds) &&
      isHomepageOpenStatus_(condition.Condition_Status || condition.Status || condition.Action_Status);
  }).concat(getHomepageConditionsFromClaims_(activeClaims));

  const activeAlerts = claimAlerts.filter(function(alert) {
    return homepageRecordMatchesActiveClaim_(alert, activeClaimIds) &&
      isHomepageOpenStatus_(alert.Alert_Status || alert.Status || alert.Action_Status);
  }).concat(getHomepageAlertsFromClaims_(activeClaims)).filter(function(alert) {
    return !isHomepageAlertClearedByIntakeAudit_(alert, intakeAuditState);
  });

  return {
    generatedAt: new Date().toISOString(),
    activeClaimCount: activeClaims.length,
    openConditionCount: activeConditions.length,
    openAlertCount: activeAlerts.length,
    openComplianceActionCount: openComplianceActions.length,
    claimSummaryCount: claimSummaries.length,
    activeClaimSummaryCount: activeClaimSummaries.length,
    claimSummaryMetrics: getHomepageClaimSummaryMetrics_(activeClaimSummaries, activeClaims, timeline),
    kpis: {
      activeClaims: activeClaims.length,
      healthCounts: countHomepageHealthLevels_(activeClaims),
      needsAttention: countHomepageClaimsByHealth_(activeClaims, ['Attention Soon', 'At Risk', 'Escalated', 'Critical']),
      atRiskEscalated: countHomepageClaimsByHealth_(activeClaims, ['At Risk', 'Escalated', 'Critical']),
      atRisk: countHomepageClaimsByHealth_(activeClaims, ['At Risk']),
      escalated: countHomepageClaimsByHealth_(activeClaims, ['Escalated']),
      critical: countHomepageClaimsByHealth_(activeClaims, ['Critical']),
      followUpsDue: countHomepageDueFollowUps_(activeConditions, activeAlerts, openComplianceActions),
      waitingOnInsurance: countHomepageClaimsWithAnyCondition_(activeConditions, [
        'Coverage Pending',
        'Estimate Under Review',
        'Supplement Under Review',
        'Waiting on Payment'
      ]),
      monitoringActive: countHomepageClaimsWithAnyCondition_(activeConditions, ['Monitoring Active']),
      recentActivityClaims: countHomepageSummariesWithRecentActivity_(activeClaimSummaries, activeClaims, timeline),
      openComplianceActions: openComplianceActions.length,
      timelineEvents: sumHomepageTimelineEvents_(activeClaimSummaries)
    },
    todayPriorities: getHomepageTodayPriorities_(activeClaims, activeConditions, activeAlerts, openComplianceActions),
    todaySchedule: getHomepageTodaySchedule_(activeClaims, activeConditions, activeAlerts),
    becomingStale: getHomepageBecomingStale_(activeClaims, activeConditions, activeAlerts, activeClaimSummaries),
    recentActivity: getHomepageRecentActivity_(activeClaims, timeline),
    recentClaimSummaries: getHomepageRecentClaimSummaries_(activeClaims, activeConditions, activeAlerts, activeClaimSummaries),
    operationalAlerts: getHomepageOperationalAlerts_(activeClaims, activeAlerts),
    ownershipVisibility: getHomepageOwnershipVisibility_(activeClaims),
    conditionsVisibility: getHomepageConditionsVisibility_(activeConditions),
    complianceVisibility: getHomepageComplianceVisibility_(openComplianceActions),
    claimsOperationalAwareness: buildHomepageClaimsOperationalAwareness_(activeClaims, activeConditions, activeAlerts)
  };
}

function getHomepageClaimSummaryMetrics_(summaries, activeClaims, timeline) {
  return {
    recentActivityClaims: countHomepageSummariesWithRecentActivity_(summaries, activeClaims, timeline),
    timelineEvents: sumHomepageTimelineEvents_(summaries),
    openComplianceActions: sumHomepageOpenComplianceActions_(summaries)
  };
}

function countHomepageSummariesWithRecentActivity_(summaries, activeClaims, timeline) {
  // Build set of Claim_IDs that have at least one Timeline_Event row.
  // This catches bootstrapped claims that have historical notes / imported
  // activity but no Claim_Summaries row yet.
  var claimIdsWithTimeline = {};
  (timeline || []).forEach(function(event) {
    if (event.Claim_ID) {
      claimIdsWithTimeline[event.Claim_ID] = true;
    }
  });

  // Build lookup from whatever Claim_Summaries rows do exist.
  var summaryMap = {};
  (summaries || []).forEach(function(summary) {
    if (summary.Claim_ID) {
      summaryMap[summary.Claim_ID] = summary;
    }
    if (summary.Job_Number) {
      summaryMap[summary.Job_Number] = summary;
      summaryMap['CLM-' + summary.Job_Number] = summary;
    }
  });

  // When activeClaims is available, count every active claim that has ANY
  // activity signal — Timeline_Event, Last_Meaningful_Activity_Date on the
  // claim row, or a populated Claim_Summaries entry.  This prevents the count
  // from being artificially capped at the number of Claim_Summaries rows.
  if (activeClaims && activeClaims.length) {
    return activeClaims.filter(function(claim) {
      if (claim.Claim_ID && claimIdsWithTimeline[claim.Claim_ID]) {
        return true;
      }
      if (claim.Last_Meaningful_Activity_Date) {
        return true;
      }
      var summary = summaryMap[claim.Claim_ID] ||
                    summaryMap[claim.Job_Number] ||
                    {};
      return Boolean(summary.Last_Activity_Date || summary.Last_Activity_Summary);
    }).length;
  }

  // Fallback: original summary-only count (no activeClaims passed).
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

function getHomepageRecentClaimSummaries_(claims, conditions, alerts, summaries) {
  const summaryMap = buildHomepageClaimSummaryMap_(summaries || []);
  const conditionsByClaim = groupHomepageRecordsByClaim_(conditions || []);
  const alertsByClaim = groupHomepageRecordsByClaim_(alerts || []);

  return (claims || [])
    .map(function(claim) {
      const summary = getHomepageSummaryForClaim_(claim, summaryMap);
      const claimConditions = conditionsByClaim[claim.Claim_ID] || [];
      const claimAlerts = alertsByClaim[claim.Claim_ID] || [];
      const lastActivityDate = claim.Last_Meaningful_Activity_Date || summary.Last_Activity_Date || claim.Updated_At || '';
      const operationalSummary = buildHomepageOperationalClaimSnapshot_(claim, claimConditions, claimAlerts, summary);

      return {
        claimId: claim.Claim_ID || '',
        jobNumber: claim.Job_Number || '',
        customerName: claim.Customer_Name || claim.Display_Name || '',
        lastActivityDate: lastActivityDate,
        lastActivityType: summary.Last_Activity_Type || '',
        lastActivitySummary: operationalSummary,
        timelineEventCount: summary.Timeline_Event_Count || 0,
        openComplianceActions: summary.Open_Compliance_Actions || 0,
        lifecycleState: claim.Lifecycle_State || '',
        ownershipArea: claim.Ownership_Area || '',
        healthLevel: getHomepageClaimHealthLevel_(claim, 'Healthy'),
        activeConditionCount: claimConditions.length,
        openAlertCount: claimAlerts.length,
        targetWorkspace: 'claims',
        targetType: 'claim',
        targetId: claim.Claim_ID || '',
        targetRoute: buildHomepageTargetRoute_('claim', claim.Claim_ID || ''),
        sourceSection: 'recentClaimSummaries'
      };
    })
    .filter(function(item) {
      return !!item.claimId;
    })
    .sort(function(a, b) {
      return getHomepageSnapshotSortRank_(a) - getHomepageSnapshotSortRank_(b);
    })
    .slice(0, 8);
}

function buildHomepageClaimSummaryMap_(summaries) {
  return (summaries || []).reduce(function(map, summary) {
    if (summary.Claim_ID) {
      map[summary.Claim_ID] = summary;
    }

    if (summary.Job_Number) {
      map[summary.Job_Number] = summary;
      map['CLM-' + summary.Job_Number] = summary;
    }

    return map;
  }, {});
}

function getHomepageSummaryForClaim_(claim, summaryMap) {
  if (!claim || !summaryMap) {
    return {};
  }

  return summaryMap[claim.Claim_ID] ||
    summaryMap[claim.Job_Number] ||
    summaryMap['CLM-' + claim.Job_Number] ||
    {};
}

function groupHomepageRecordsByClaim_(records) {
  return (records || []).reduce(function(map, record) {
    const claimId = record.Claim_ID || '';

    if (!claimId) {
      return map;
    }

    if (!map[claimId]) {
      map[claimId] = [];
    }

    map[claimId].push(record);
    return map;
  }, {});
}

function buildHomepageOperationalClaimSnapshot_(claim, conditions, alerts, summary) {
  const parts = [];
  const lifecycleState = claim.Lifecycle_State || 'Active claim';
  const ownershipArea = claim.Ownership_Area || 'Unassigned';
  const healthLevel = getHomepageClaimHealthLevel_(claim, 'Healthy');
  const topConditions = (conditions || [])
    .map(function(condition) {
      return condition.Condition_Type || condition.Action_Title || '';
    })
    .filter(Boolean)
    .slice(0, 2);
  const topAlerts = (alerts || [])
    .map(function(alert) {
      return alert.Alert_Type || '';
    })
    .filter(Boolean)
    .slice(0, 1);
  const lastActivityType = summary && summary.Last_Activity_Type ? summary.Last_Activity_Type : '';
  const lastActivityDate = claim.Last_Meaningful_Activity_Date || (summary && summary.Last_Activity_Date ? summary.Last_Activity_Date : '') || claim.Updated_At || '';
  const parsedLastActivityTime = lastActivityDate ? new Date(lastActivityDate).getTime() : NaN;
  const calculatedDaysSinceActivity = !isNaN(parsedLastActivityTime)
    ? Math.max(0, Math.floor((new Date().getTime() - parsedLastActivityTime) / (1000 * 60 * 60 * 24)))
    : null;
  const daysSinceActivity = claim.Days_Since_Activity !== '' && claim.Days_Since_Activity !== undefined && claim.Days_Since_Activity !== null
    ? Number(claim.Days_Since_Activity)
    : calculatedDaysSinceActivity;

  parts.push(lifecycleState + ' · ' + ownershipArea + ' · ' + healthLevel);

  if (topConditions.length) {
    parts.push('Conditions: ' + topConditions.join(', '));
  } else {
    parts.push('No active conditions');
  }

  if (topAlerts.length) {
    parts.push('Alert: ' + topAlerts.join(', '));
  }

  if (daysSinceActivity !== null && !isNaN(daysSinceActivity)) {
    parts.push('Last meaningful activity: ' + daysSinceActivity + ' day' + (daysSinceActivity === 1 ? '' : 's') + ' ago');
  } else if (lastActivityType) {
    parts.push('Last activity: ' + lastActivityType);
  }

  return parts.join(' • ');
}

function getHomepageSnapshotSortRank_(item) {
  const healthRanks = {
    Critical: 1,
    Escalated: 5,
    'At Risk': 10,
    'Attention Soon': 20,
    Healthy: 40,
    'Not Evaluated': 50
  };
  const healthRank = healthRanks[item.healthLevel] || 50;
  const conditionRank = item.activeConditionCount ? 0 : 5;
  const alertRank = item.openAlertCount ? 0 : 5;
  const activityTime = item.lastActivityDate ? new Date(item.lastActivityDate).getTime() : 0;
  const recencyRank = activityTime ? Math.max(0, 10000000000000 - activityTime) / 100000000000 : 100;

  return healthRank + conditionRank + alertRank + recencyRank;
}

function getHomepageKpis() {
  return getHomepageClaimSummaryData().kpis;
}

/**
 * Homepage search endpoint.
 *
 * Reads the Claims sheet live and returns claims matching the query across
 * customer name, claim number, claim ID, job number, and property address.
 * The homepage search bar calls this via google.script.run and navigates to
 * the selected claim's Full Claim Workspace.
 */
function searchHomepageClaims(query) {
  var normalizedQuery = String(query || '').trim().toLowerCase();

  if (!normalizedQuery) {
    return { success: true, query: '', results: [] };
  }

  var claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims).map(normalizeHomepageClaim_);

  var results = claims.filter(function(claim) {
    var haystack = [
      claim.Customer_Name,
      claim.Display_Name,
      claim.Claim_Number,
      claim.Claim_ID,
      claim.Job_Number,
      claim.Property_Address
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.indexOf(normalizedQuery) !== -1;
  }).map(function(claim) {
    return {
      claimId: claim.Claim_ID || '',
      customerName: claim.Customer_Name || claim.Display_Name || '',
      claimNumber: claim.Claim_Number || '',
      jobNumber: claim.Job_Number || '',
      propertyAddress: claim.Property_Address || '',
      lifecycleState: claim.Lifecycle_State || '',
      healthLevel: getHomepageClaimHealthLevel_(claim, 'Not Evaluated'),
      isActive: isHomepageActiveClaim_(claim),
      displayLabel: getHomepageClaimDisplayName_(claim),
      targetRoute: buildHomepageTargetRoute_('claim', claim.Claim_ID || '')
    };
  }).filter(function(result) {
    return !!result.claimId;
  }).sort(function(a, b) {
    // Active claims first, then alphabetical by customer name.
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    return String(a.customerName).localeCompare(String(b.customerName));
  }).slice(0, 15);

  return {
    success: true,
    query: query,
    results: results
  };
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
    Claim_Conditions: ['Claim ID', 'Claim_ID', 'Condition Type', 'Condition_Type', 'Condition Status', 'Condition_Status'],
    Claim_Alerts: ['Claim ID', 'Claim_ID', 'Alert Type', 'Alert_Type', 'Alert Status', 'Alert_Status'],
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
    Health_Status: getHomepageValue_(row, ['Health Status', 'Health_Status']),
    Operational_Health: getHomepageValue_(row, ['Health Status', 'Health_Status', 'Operational_Health', 'Health_Level', 'Health Level']),
    Health_Level: getHomepageValue_(row, ['Health Status', 'Health_Status', 'Health_Level', 'Health Level', 'Operational_Health']),
    Health_Reason: getHomepageValue_(row, ['Health Reason', 'Health_Reason']),
    Conditions: getHomepageValue_(row, ['Conditions']),
    Alerts: getHomepageValue_(row, ['Alerts']),
    Last_Meaningful_Activity_Date: normalizeHomepageDateValue_(getHomepageValue_(row, [
      'Last_Meaningful_Activity_At',
      'Last Meaningful Activity At',
      'Last_Meaningful_Activity_Date',
      'Last Meaningful Activity Date',
      'Last Activity Date',
      'Last_Activity_Date'
    ])),
    Days_Since_Activity: getHomepageValue_(row, ['Days_Since_Activity', 'Days Since Activity']),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Created_At', 'Created At', 'Created Date'])),
    Updated_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Updated_At', 'Updated At', 'Last Updated'])),
    Is_Not_Sold: getHomepageValue_(row, ['Is_Not_Sold', 'Is Not Sold']),
    Is_Operationally_Complete: getHomepageValue_(row, ['Is_Operationally_Complete', 'Is Operationally Complete'])
  };
}


function normalizeHomepageTimelineEvent_(row) {
  return {
    Timeline_Event_ID: getHomepageValue_(row, [
      'Timeline_Event_ID',
      'Timeline Event ID',
      'Event ID',
      'Event_ID'
    ]),
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Event_Date: normalizeHomepageDateValue_(getHomepageValue_(row, [
      'Event_Date',
      'Event Date',
      'Date',
      'Activity Date',
      'Created Date',
      'Created_At',
      'Created At'
    ])),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, [
      'Created_At',
      'Created At',
      'Created Date'
    ])),
    Event_Type: getHomepageValue_(row, [
      'Event_Type',
      'Event Type',
      'Activity Type',
      'Activity Label',
      'Type'
    ]),
    Summary: getHomepageValue_(row, [
      'Summary',
      'Activity Label',
      'Description',
      'Note',
      'Notes'
    ]),
    Detail: getHomepageValue_(row, [
      'Detail',
      'Details',
      'Note',
      'Notes',
      'Description'
    ]),
    Source_System: getHomepageValue_(row, [
      'Source_System',
      'Source System',
      'Event_Source',
      'Event Source',
      'Source'
    ]),
    Event_Source: getHomepageValue_(row, [
      'Event_Source',
      'Event Source',
      'Source_System',
      'Source System',
      'Source'
    ]),
    Related_Workflow: getHomepageValue_(row, ['Related_Workflow', 'Related Workflow', 'Workflow']),
    Actor: getHomepageValue_(row, ['Actor', 'Owner', 'Primary Owner']),
    Category: getHomepageValue_(row, ['Category', 'Event Category', 'Event_Category']),
    Is_Meaningful_Activity: normalizeHomepageBoolean_(getHomepageValue_(row, [
      'Is_Meaningful_Activity',
      'Is Meaningful Activity',
      'Meaningful',
      'Updates_Last_Activity',
      'Updates Last Activity'
    ]))
  };
}

function normalizeHomepageCondition_(row) {
  const conditionType = getHomepageValue_(row, ['Condition_Type', 'Condition Type', 'Type', 'Condition']);
  const status = getHomepageValue_(row, ['Condition_Status', 'Condition Status', 'Status', 'Action_Status', 'Action Status']);
  const recommendedAction = getHomepageValue_(row, ['Recommended_Action', 'Recommended Action', 'Next_Action', 'Next Action', 'Required_Action', 'Required Action']);

  return {
    Condition_ID: getHomepageValue_(row, ['Condition_ID', 'Condition ID', 'ID']),
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Job_Number: getHomepageValue_(row, ['Job_Number', 'Job Number']),
    Claim_Number: getHomepageValue_(row, ['Claim_Number', 'Claim Number']),
    Condition_Type: conditionType,
    Condition_Status: status || 'Open',
    Action_Status: status || 'Open',
    Status: status || 'Open',
    Severity: getHomepageValue_(row, ['Severity', 'Priority']),
    Priority: getHomepageValue_(row, ['Priority', 'Severity']),
    Reason: getHomepageValue_(row, ['Reason', 'Description', 'Notes', 'Condition_Reason', 'Condition Reason']),
    Recommended_Action: recommendedAction,
    Follow_Up_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Follow_Up_Date', 'Follow Up Date', 'Next_Follow_Up_Date', 'Next Follow Up Date', 'Due Date'])),
    Due_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Due_Date', 'Due Date', 'Follow_Up_Date', 'Follow Up Date'])),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Created_At', 'Created At', 'Created Date'])),
    Updated_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Updated_At', 'Updated At', 'Last Updated']))
  };
}

function normalizeHomepageAlert_(row) {
  const alertType = getHomepageValue_(row, ['Alert_Type', 'Alert Type', 'Type', 'Alert']);
  const status = getHomepageValue_(row, ['Alert_Status', 'Alert Status', 'Status', 'Action_Status', 'Action Status']);
  const recommendedAction = getHomepageValue_(row, ['Recommended_Action', 'Recommended Action', 'Next_Action', 'Next Action', 'Required_Action', 'Required Action']);

  return {
    Alert_ID: getHomepageValue_(row, ['Alert_ID', 'Alert ID', 'ID']),
    Claim_ID: getHomepageValue_(row, ['Claim_ID', 'Claim ID']),
    Job_Number: getHomepageValue_(row, ['Job_Number', 'Job Number']),
    Claim_Number: getHomepageValue_(row, ['Claim_Number', 'Claim Number']),
    Alert_Type: alertType,
    Alert_Status: status || 'Open',
    Action_Status: status || 'Open',
    Status: status || 'Open',
    Severity: getHomepageValue_(row, ['Severity', 'Priority']),
    Priority: getHomepageValue_(row, ['Priority', 'Severity']),
    Reason: getHomepageValue_(row, ['Reason', 'Description', 'Notes', 'Alert_Reason', 'Alert Reason']),
    Recommended_Action: recommendedAction,
    Follow_Up_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Follow_Up_Date', 'Follow Up Date', 'Next_Follow_Up_Date', 'Next Follow Up Date', 'Due Date'])),
    Due_Date: normalizeHomepageDateValue_(getHomepageValue_(row, ['Due_Date', 'Due Date', 'Follow_Up_Date', 'Follow Up Date'])),
    Created_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Created_At', 'Created At', 'Created Date'])),
    Updated_At: normalizeHomepageDateValue_(getHomepageValue_(row, ['Updated_At', 'Updated At', 'Last Updated']))
  };
}

function isHomepageAlertClearedByIntakeAudit_(alert, auditState) {
  if (!alert || !auditState || !Array.isArray(auditState.records)) {
    return false;
  }

  const alertType = String(alert.Alert_Type || alert.Type || '').trim().toLowerCase();

  const supportedAlertTypes = {
    'missing xact/symbility link': true,
    'missing xa/symbility link': true
  };

  if (!supportedAlertTypes[alertType]) {
    return false;
  }

  const alertClaimId = String(alert.Claim_ID || '').trim();
  const alertClaimNumber = String(alert.Claim_Number || '').trim();
  const alertJobNumber = String(alert.Job_Number || '').trim();
  const alertClaimKeys = buildHomepageClaimMatchKeys_({
    claimId: alertClaimId,
    claimNumber: alertClaimNumber,
    jobNumber: alertJobNumber
  });
  const notRequiredClaimKeys = getHomepageEstimatePlatformNotRequiredClaimKeys_();

  if (Object.keys(alertClaimKeys).some(function(key) {
    return !!notRequiredClaimKeys[key];
  })) {
    return true;
  }

  return auditState.records.some(function(record) {
    if (!record || record.actionType !== 'link-added' || !record.url) {
      return false;
    }

    const linkType = String(record.linkType || '').trim().toLowerCase();
    const isXactOrSymbilityLink = linkType.indexOf('xact') !== -1 || linkType.indexOf('symbility') !== -1 || linkType.indexOf('xa') !== -1;

    if (!isXactOrSymbilityLink) {
      return false;
    }

    const recordClaimId = String(record.claimId || '').trim();

    return !!recordClaimId && (
      recordClaimId === alertClaimId ||
      recordClaimId === alertClaimNumber ||
      recordClaimId === alertJobNumber ||
      recordClaimId === String(alertClaimId || '').replace(/^CLM-/, '')
    );
  });
}

function getHomepageEstimatePlatformNotRequiredClaimKeys_() {
  const properties = PropertiesService.getScriptProperties();
  const propertyName = 'RAINBOW_ESTIMATE_PLATFORM_NOT_REQUIRED_CLAIMS';
  const existingValue = properties.getProperty(propertyName) || '[]';
  let claims = [];

  try {
    claims = JSON.parse(existingValue);
  } catch (err) {
    claims = [];
  }

  if (!Array.isArray(claims)) {
    claims = [];
  }

  return claims.reduce(function(keys, claimId) {
    const claimKeys = buildHomepageClaimMatchKeys_(claimId);
    Object.keys(claimKeys).forEach(function(key) {
      keys[key] = true;
    });
    return keys;
  }, {});
}

function buildHomepageClaimMatchKeys_(claim) {
  const values = [];

  if (claim && typeof claim === 'object') {
    values.push(claim.claimId, claim.claimNumber, claim.jobNumber, claim.Claim_ID, claim.Claim_Number, claim.Job_Number);
  } else {
    values.push(claim);
  }

  return values.reduce(function(keys, value) {
    const normalizedValue = normalizeHomepageClaimMatchKey_(value);

    if (!normalizedValue) {
      return keys;
    }

    keys[normalizedValue] = true;

    if (normalizedValue.indexOf('clm-') === 0) {
      keys[normalizedValue.replace(/^clm-/, '')] = true;
    } else if (/^[0-9a-z-]+$/.test(normalizedValue)) {
      keys['clm-' + normalizedValue] = true;
    }

    return keys;
  }, {});
}

function normalizeHomepageClaimMatchKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.0$/, '');
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
  // Prefer insurance claim number, fallback to job number
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

function normalizeHomepageHealthLevel_(healthLevel) {
  const normalized = String(healthLevel || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (normalized === 'healthy') return 'Healthy';
  if (normalized === 'attention soon') return 'Attention Soon';
  if (normalized === 'at risk') return 'At Risk';
  if (normalized === 'escalated') return 'Escalated';
  if (normalized === 'critical') return 'Critical';
  if (normalized === 'not evaluated') return 'Not Evaluated';

  return String(healthLevel || '').replace(/\s+/g, ' ').trim();
}

function getHomepageClaimHealthLevel_(claim, fallback) {
  if (!claim) {
    return fallback || 'Healthy';
  }

  return normalizeHomepageHealthLevel_(
    claim.Health_Status ||
    claim['Health Status'] ||
    claim.Health_Level ||
    claim['Health Level'] ||
    claim.Operational_Health ||
    fallback ||
    'Healthy'
  ) || (fallback || 'Healthy');
}

function countHomepageClaimsByHealth_(claims, healthLevels) {
  const levelMap = (healthLevels || []).reduce(function(map, level) {
    map[normalizeHomepageHealthLevel_(level)] = true;
    return map;
  }, {});

  const countedClaimIds = {};

  claims.forEach(function(claim) {
    const healthLevel = getHomepageClaimHealthLevel_(claim, 'Healthy');
    if (claim.Claim_ID && levelMap[healthLevel]) {
      countedClaimIds[claim.Claim_ID] = true;
    }
  });

  return Object.keys(countedClaimIds).length;
}

function countHomepageHealthLevels_(claims) {
  return (claims || []).reduce(function(counts, claim) {
    const healthLevel = getHomepageClaimHealthLevel_(claim, 'Not Evaluated');
    counts[healthLevel] = (counts[healthLevel] || 0) + 1;
    return counts;
  }, {});
}

function countHomepageDueFollowUps_(conditions, alerts, complianceActions) {
  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).getTime();
  const seenKeys = {};
  let count = 0;

  function countIfDue(record, sourceType) {
    const dueValue = record.Due_Date || record.Follow_Up_Date || '';
    if (!dueValue) {
      return;
    }

    const dueTime = new Date(dueValue).getTime();
    if (isNaN(dueTime) || dueTime > endOfToday) {
      return;
    }

    const key = (record.Claim_ID || record.Job_Number || '') + '|' + sourceType + '|' + dueValue + '|' + (record.Condition_Type || record.Alert_Type || record.Action_Title || record.Required_Action || '');
    if (seenKeys[key]) {
      return;
    }

    seenKeys[key] = true;
    count++;
  }

  (conditions || []).forEach(function(condition) {
    countIfDue(condition, 'condition');
  });

  (alerts || []).forEach(function(alert) {
    countIfDue(alert, 'alert');
  });

  (complianceActions || []).forEach(function(action) {
    countIfDue(action, 'compliance');
  });

  return count;
}
function isHomepageDueTodayOrOverdue_(dateValue) {
  if (!dateValue) {
    return false;
  }

  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).getTime();

  return parsed.getTime() <= endOfToday;
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

function buildHomepageClaimMap_(claims) {
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

  return claimMap;
}

function getHomepageClaimForRecord_(record, claimMap) {
  if (!record || !claimMap) {
    return {};
  }

  const claimId = String(record.Claim_ID || '');
  const jobNumber = String(record.Job_Number || '');
  const claimNumber = String(record.Claim_Number || '');

  return claimMap[claimId] ||
    claimMap[claimId.replace(/^CLM-/, '')] ||
    claimMap[jobNumber] ||
    claimMap['CLM-' + jobNumber] ||
    claimMap[claimNumber] ||
    {};
}

function isHomepageActionHealth_(healthLevel) {
  const normalized = normalizeHomepageHealthLevel_(healthLevel);

  return normalized === 'Attention Soon' ||
    normalized === 'At Risk' ||
    normalized === 'Escalated' ||
    normalized === 'Critical';
}

function getHomepageHealthPriorityRank_(healthLevel) {
  if (healthLevel === 'Critical') return 1;
  if (healthLevel === 'Escalated') return 5;
  if (healthLevel === 'At Risk') return 10;
  if (healthLevel === 'Attention Soon') return 20;
  return 50;
}

function getHomepageHealthPriorityTitle_(healthLevel) {
  if (healthLevel === 'Critical') return 'Critical claim needs immediate review';
  if (healthLevel === 'Escalated') return 'Escalated claim needs intervention';
  if (healthLevel === 'At Risk') return 'At-risk claim needs follow-up';
  if (healthLevel === 'Attention Soon') return 'Claim needs attention soon';
  return 'Claim needs review';
}

function getHomepageConditionPriority_(conditionType) {
  const priorities = {
    'Carrier Revision Requested': {
      title: 'Carrier revision response needed',
      rank: 12
    },
    'Positive Asbestos Result': {
      title: 'Positive asbestos result needs coordination',
      rank: 14
    },
    'Abatement Required': {
      title: 'Abatement coordination needed',
      rank: 18
    },
    'Revision Active': {
      title: 'Active revision needs follow-up cadence',
      rank: 22
    },
    'Waiting on Payment': {
      title: 'Payment follow-up may be needed',
      rank: 24
    },
    'Monitoring Active': {
      title: 'Monitoring follow-up is overdue',
      rank: 25
    },
    'Waiting on Lab Results': {
      title: 'Lab result follow-up may be needed',
      rank: 26
    },
    'Coverage Pending': {
      title: 'Coverage follow-up may be needed',
      rank: 28
    },
    'Estimate Under Review': {
      title: 'Estimate review follow-up may be needed',
      rank: 30
    },
    'Supplement Under Review': {
      title: 'Supplement review follow-up may be needed',
      rank: 32
    },
    'Waiting on Customer Decision': {
      title: 'Customer decision follow-up may be needed',
      rank: 34
    },
    'Source of Loss Unresolved': {
      title: 'Source of loss needs resolution',
      rank: 36
    },
    'Asbestos Testing Pending': {
      title: 'Asbestos testing follow-up may be needed',
      rank: 38
    }
  };

  return priorities[conditionType] || null;
}


function getHomepageAlertPriorityRank_(alertType, severity) {
  const severityRank = getHomepagePriorityRank_(severity);

  if (severityRank !== 50) {
    return severityRank;
  }

  const normalizedAlert = String(alertType || '').toLowerCase();

  if (normalizedAlert.indexOf('missing eoj') !== -1) return 18;
  if (normalizedAlert.indexOf('review') !== -1) return 22;
  if (normalizedAlert.indexOf('missing') !== -1) return 30;

  return 35;
}

function isHomepageTodayPriorityAlert_(alert) {
  const alertType = String(alert && alert.Alert_Type ? alert.Alert_Type : '').toLowerCase();

  const structuralMissingLinkAlerts = [
    'missing xact/symbility link',
    'missing claimx link/video',
    'missing fusion link',
    'missing operational links record'
  ];

  for (let i = 0; i < structuralMissingLinkAlerts.length; i++) {
    if (alertType === structuralMissingLinkAlerts[i]) {
      return false;
    }
  }

  return true;
}

function getHomepageTodayPriorities_(claims, conditions, alerts, complianceActions) {
  const claimMap = buildHomepageClaimMap_(claims);
  const priorities = [];
  const seenKeys = {};

  (claims || []).forEach(function(claim) {
    const healthLevel = getHomepageClaimHealthLevel_(claim, 'Healthy');

    if (!isHomepageActionHealth_(healthLevel)) {
      return;
    }

    const key = claim.Claim_ID + '|health|' + healthLevel;
    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    priorities.push({
      claimId: claim.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: healthLevel,
      title: getHomepageHealthPriorityTitle_(healthLevel),
      reason: claim.Health_Reason || claim.Days_Since_Activity ? String(claim.Health_Reason || '') : '',
      type: 'Health',
      conditionType: '',
      alertType: '',
      followUpDate: '',
      priorityRank: getHomepageHealthPriorityRank_(healthLevel),
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: claim.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', claim.Claim_ID || ''),
      sourceSection: 'todayPriorities'
    });
  });

  (conditions || []).forEach(function(condition) {
    const conditionPriority = getHomepageConditionPriority_(condition.Condition_Type);

    if (!conditionPriority) {
      return;
    }

    const key = condition.Claim_ID + '|condition|' + condition.Condition_Type;
    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    const claim = getHomepageClaimForRecord_(condition, claimMap);

    priorities.push({
      claimId: condition.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: getHomepageClaimHealthLevel_(claim, 'Healthy'),
      title: conditionPriority.title,
      reason: condition.Reason || '',
      type: 'Condition',
      conditionType: condition.Condition_Type || '',
      alertType: '',
      followUpDate: condition.Follow_Up_Date || '',
      priorityRank: conditionPriority.rank,
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: condition.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', condition.Claim_ID || ''),
      sourceSection: 'todayPriorities'
    });
  });

  (alerts || []).forEach(function(alert) {
    if (!isHomepageTodayPriorityAlert_(alert)) {
      return;
    }

    const key = alert.Claim_ID + '|alert|' + (alert.Alert_Type || '');

    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    const claim = getHomepageClaimForRecord_(alert, claimMap);

    priorities.push({
      claimId: alert.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: getHomepageClaimHealthLevel_(claim, 'Healthy'),
      title: alert.Alert_Type || 'Alert',
      reason: alert.Reason || '',
      type: 'Alert',
      conditionType: '',
      alertType: alert.Alert_Type || '',
      followUpDate: '',
      priorityRank: getHomepageAlertPriorityRank_(alert.Alert_Type, alert.Severity || alert.Priority),
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: alert.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', alert.Claim_ID || ''),
      sourceSection: 'todayPriorities'
    });
  });

  (complianceActions || []).forEach(function(action) {
    const dueDate = action.Due_Date || action.Follow_Up_Date || '';
    if (!isHomepageDueTodayOrOverdue_(dueDate)) {
      return;
    }

    const key = action.Claim_ID + '|compliance|' + (action.Compliance_Action_ID || action.Action_Title || action.Required_Action || '');

    if (seenKeys[key]) {
      return;
    }
    seenKeys[key] = true;

    const claim = getHomepageClaimForRecord_(action, claimMap);

    priorities.push({
      claimId: action.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || claim.Job_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: getHomepageClaimHealthLevel_(claim, 'Not Evaluated'),
      title: action.Action_Title || 'Open Compliance Action Due',
      reason: action.Required_Action || action.Reason || '',
      type: 'Compliance Action',
      conditionType: '',
      alertType: '',
      followUpDate: dueDate,
      priorityRank: getHomepagePriorityRank_(action.Priority || action.Severity),
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: action.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', action.Claim_ID || ''),
      sourceSection: 'todayPriorities'
    });
  });

  priorities.sort(function(a, b) {
    return (a.priorityRank || 999) - (b.priorityRank || 999);
  });

  return priorities.slice(0, 10);
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

function getHomepageBecomingStale_(claims, conditions, alerts, summaries) {
  const claimMap = buildHomepageClaimMap_(claims || []);
  const summaryMap = {};

  (summaries || []).forEach(function(summary) {
    if (summary.Claim_ID) {
      summaryMap[summary.Claim_ID] = summary;
    }
    if (summary.Job_Number) {
      summaryMap[summary.Job_Number] = summary;
      summaryMap['CLM-' + summary.Job_Number] = summary;
    }
  });

  const now = new Date().getTime();
  const staleCandidates = [];

  (claims || []).forEach(function(claim) {
    const healthLevel = getHomepageClaimHealthLevel_(claim, 'Healthy');
    const summary = summaryMap[claim.Claim_ID] || summaryMap[claim.Job_Number] || {};
    const lastActivityValue = claim.Last_Meaningful_Activity_Date || summary.Last_Activity_Date || claim.Updated_At || '';
    const lastActivityTime = lastActivityValue ? new Date(lastActivityValue).getTime() : NaN;
    const daysSinceActivity = !isNaN(lastActivityTime)
      ? Math.floor((now - lastActivityTime) / (1000 * 60 * 60 * 24))
      : Number(claim.Days_Since_Activity || 0);

    const hasOpenCondition = (conditions || []).some(function(condition) {
      return condition.Claim_ID === claim.Claim_ID;
    });

    const hasOpenAlert = (alerts || []).some(function(alert) {
      return alert.Claim_ID === claim.Claim_ID;
    });

    const isAlreadyUrgent = healthLevel === 'At Risk' || healthLevel === 'Escalated' || healthLevel === 'Critical';
    const isAttentionSoon = healthLevel === 'Attention Soon';
    const isHealthyButDrifting = healthLevel === 'Healthy' && daysSinceActivity >= 3 && !hasOpenCondition && !hasOpenAlert;

    if (!isAlreadyUrgent && !isAttentionSoon && !isHealthyButDrifting) {
      return;
    }

    staleCandidates.push({
      claimId: claim.Claim_ID || '',
      claimDisplayName: getHomepageClaimDisplayName_(claim),
      customerName: claim.Customer_Name || '',
      claimNumber: claim.Claim_Number || '',
      lifecycleState: claim.Lifecycle_State || '',
      ownershipArea: claim.Ownership_Area || '',
      primaryOwner: claim.Primary_Owner || '',
      healthLevel: healthLevel,
      healthReason: claim.Health_Reason || '',
      lastMeaningfulActivityDate: lastActivityValue || '',
      lastActivityType: summary.Last_Activity_Type || '',
      lastActivitySummary: summary.Last_Activity_Summary || '',
      daysSinceActivity: daysSinceActivity,
      staleReason: isHealthyButDrifting
        ? 'Healthy claim with no recent activity signal in 3+ days.'
        : (claim.Health_Reason || 'Claim health indicates attention may be needed soon.'),
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: claim.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', claim.Claim_ID || ''),
      sourceSection: 'becomingStale'
    });
  });

  return staleCandidates
    .sort(function(a, b) {
      return Number(b.daysSinceActivity || 0) - Number(a.daysSinceActivity || 0);
    })
    .slice(0, 8);
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

  // Collapse noisy duplicate EOJ activity. The EOJ interpreter writes both an
  // "EOJ Submitted" event and a visit-specific event per submission, so a single
  // claim can produce several near-identical EOJ rows. Keep only the most recent
  // EOJ event per claim; non-EOJ events pass through unchanged.
  const seenEojClaimIds = {};

  return (timeline || []).filter(function(event) {
    return event.Claim_ID && activeClaimIds[event.Claim_ID];
  }).sort(function(a, b) {
    const aDate = new Date(a.Event_Date || a.Created_At || 0).getTime();
    const bDate = new Date(b.Event_Date || b.Created_At || 0).getTime();
    return bDate - aDate;
  }).filter(function(event) {
    const haystack = String(event.Event_Type || '') + ' ' +
      String(event.Summary || '') + ' ' +
      String(event.Related_Workflow || '');

    if (haystack.toLowerCase().indexOf('eoj') === -1) {
      return true;
    }

    if (seenEojClaimIds[event.Claim_ID]) {
      return false;
    }

    seenEojClaimIds[event.Claim_ID] = true;
    return true;
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
      isMeaningful: event.Is_Meaningful_Activity === true ||
        event.Is_Meaningful_Activity === 'TRUE' ||
        String(event.Event_Type || '').toLowerCase() === 'historical note' ||
        String(event.Event_Type || '').toLowerCase() === 'removed from daily open jobs',
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: event.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', event.Claim_ID || ''),
      sourceSection: 'recentActivity'
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
      recommendedAction: alert.Recommended_Action || alert.Required_Action || '',
      createdAt: alert.Created_At || '',
      targetWorkspace: 'claims',
      targetType: 'claim',
      targetId: alert.Claim_ID || '',
      targetRoute: buildHomepageTargetRoute_('claim', alert.Claim_ID || ''),
      sourceSection: 'operationalAlerts'
    };
  });
}

function getHomepageOwnershipVisibility_(claims) {
  const ownershipAreas = ['Intake', 'Field Operations', 'Revision Management', 'Office Operations'];

  const summary = ownershipAreas.reduce(function(map, ownershipArea) {
    map[ownershipArea] = {
      ownershipArea: ownershipArea,
      activeClaimCount: 0,
      needsAttentionCount: 0,
      criticalCount: 0,
      escalatedCount: 0,
      atRiskCount: 0,
      targetWorkspace: 'claims',
      targetType: 'claimsFilter',
      targetId: ownershipArea,
      targetRoute: buildHomepageTargetRoute_('ownership', ownershipArea),
      sourceSection: 'ownershipVisibility'
    };
    return map;
  }, {});

  (claims || []).forEach(function(claim) {
    const ownershipArea = claim.Ownership_Area || 'Unassigned';

    if (!summary[ownershipArea]) {
      summary[ownershipArea] = {
        ownershipArea: ownershipArea,
        activeClaimCount: 0,
        needsAttentionCount: 0,
        criticalCount: 0,
        escalatedCount: 0,
        atRiskCount: 0,
        targetWorkspace: 'claims',
        targetType: 'claimsFilter',
        targetId: ownershipArea,
        targetRoute: buildHomepageTargetRoute_('ownership', ownershipArea),
        sourceSection: 'ownershipVisibility'
      };
    }

    const healthLevel = getHomepageClaimHealthLevel_(claim, 'Healthy');
    summary[ownershipArea].activeClaimCount++;

    if (['Attention Soon', 'At Risk', 'Escalated', 'Critical'].indexOf(healthLevel) !== -1) {
      summary[ownershipArea].needsAttentionCount++;
    }

    if (healthLevel === 'Critical') {
      summary[ownershipArea].criticalCount++;
    }

    if (healthLevel === 'Escalated') {
      summary[ownershipArea].escalatedCount++;
    }

    if (healthLevel === 'At Risk') {
      summary[ownershipArea].atRiskCount++;
    }
  });

  return Object.keys(summary).map(function(key) {
    return summary[key];
  }).sort(function(a, b) {
    if (a.needsAttentionCount !== b.needsAttentionCount) {
      return b.needsAttentionCount - a.needsAttentionCount;
    }

    return b.activeClaimCount - a.activeClaimCount;
  });
}

function getHomepageConditionsVisibility_(conditions) {
  const conditionTypes = [
    'Coverage Pending',
    'Estimate Under Review',
    'Supplement Under Review',
    'Waiting on Payment',
    'Revision Active',
    'Carrier Revision Requested',
    'Monitoring Active',
    'Positive Asbestos Result',
    'Abatement Required'
  ];

  const summary = conditionTypes.reduce(function(map, conditionType) {
    map[conditionType] = {
      conditionType: conditionType,
      openCount: 0,
      affectedClaimIds: {},
      targetWorkspace: 'claims',
      targetType: 'claimsFilter',
      targetId: conditionType,
      targetRoute: buildHomepageTargetRoute_('condition', conditionType),
      sourceSection: 'conditionsVisibility'
    };
    return map;
  }, {});

  (conditions || []).forEach(function(condition) {
    const conditionType = condition.Condition_Type || 'Other';

    if (!summary[conditionType]) {
      summary[conditionType] = {
        conditionType: conditionType,
        openCount: 0,
        affectedClaimIds: {},
        targetWorkspace: 'claims',
        targetType: 'claimsFilter',
        targetId: conditionType,
        targetRoute: buildHomepageTargetRoute_('condition', conditionType),
        sourceSection: 'conditionsVisibility'
      };
    }

    summary[conditionType].openCount++;

    if (condition.Claim_ID) {
      summary[conditionType].affectedClaimIds[condition.Claim_ID] = true;
    }
  });

  return Object.keys(summary).map(function(key) {
    const item = summary[key];
    return {
      conditionType: item.conditionType,
      openCount: item.openCount,
      affectedClaimCount: Object.keys(item.affectedClaimIds).length,
      targetWorkspace: item.targetWorkspace,
      targetType: item.targetType,
      targetId: item.targetId,
      targetRoute: item.targetRoute,
      sourceSection: item.sourceSection
    };
  }).filter(function(item) {
    return item.openCount > 0;
  }).sort(function(a, b) {
    return b.openCount - a.openCount;
  });
}

function getHomepageComplianceVisibility_(complianceActions) {
  const priorityCounts = {};
  const statusCounts = {};
  let criticalComplianceActionCount = 0;
  let overdueComplianceActionCount = 0;

  (complianceActions || []).forEach(function(action) {
    const priority = String(action.Priority || action.Severity || 'Unspecified').trim() || 'Unspecified';
    const status = String(action.Status || action.Action_Status || 'Open').trim() || 'Open';
    const dueDate = action.Due_Date || action.Follow_Up_Date || '';

    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    if (priority.toLowerCase() === 'critical') {
      criticalComplianceActionCount++;
    }

    if (dueDate && isHomepageDueTodayOrOverdue_(dueDate)) {
      overdueComplianceActionCount++;
    }
  });

  return {
    totalOpenComplianceActions: (complianceActions || []).length,
    criticalComplianceActionCount: criticalComplianceActionCount,
    overdueComplianceActionCount: overdueComplianceActionCount,
    priorityCounts: priorityCounts,
    statusCounts: statusCounts
  };
}

function buildHomepageTargetRoute_(targetType, targetId) {
  const encodedTargetId = encodeURIComponent(String(targetId || ''));

  if (targetType === 'claim') {
    return encodedTargetId ? '?view=claimShell&claimId=' + encodedTargetId : '?view=claimShell';
  }

  if (targetType === 'ownership') {
    return encodedTargetId ? '?view=claimShell&ownership=' + encodedTargetId : '?view=claimShell';
  }

  if (targetType === 'condition') {
    return encodedTargetId ? '?view=claimShell&condition=' + encodedTargetId : '?view=claimShell';
  }

  if (targetType === 'compliance') {
    return '?view=claimShell&compliance=' + (encodedTargetId || 'open');
  }

  return '?view=claimShell';
}

// ---------------------------------------------------------------------------
// Phase 4 Homepage Intelligence: claimsOperationalAwareness
//
// Builds a lightweight claimsOperationalAwareness object from data already
// fetched by getHomepageClaimSummaryData(). Zero additional Sheets reads.
//
// Mirrors the shape of ClaimsOperationalAwarenessService.buildClaimsOperationalAwareness_()
// but works from normalized homepage claim rows rather than enriched workspace
// stream objects. The counts and card logic are intentionally equivalent.
// ---------------------------------------------------------------------------

function buildHomepageClaimsOperationalAwareness_(activeClaims, activeConditions, activeAlerts) {
  activeClaims = activeClaims || [];
  activeConditions = activeConditions || [];
  activeAlerts = activeAlerts || [];

  var generatedAt = new Date().toISOString();

  // --- Build per-claim summary objects from in-memory homepage data ---
  var conditionsByClaim = {};
  activeConditions.forEach(function(condition) {
    var claimId = String(condition.Claim_ID || '');
    if (!claimId) {
      return;
    }
    if (!conditionsByClaim[claimId]) {
      conditionsByClaim[claimId] = [];
    }
    conditionsByClaim[claimId].push(condition.Condition_Type || '');
  });

  var alertsByClaim = {};
  activeAlerts.forEach(function(alert) {
    var claimId = String(alert.Claim_ID || '');
    if (!claimId) {
      return;
    }
    if (!alertsByClaim[claimId]) {
      alertsByClaim[claimId] = [];
    }
    alertsByClaim[claimId].push({
      alertType: String(alert.Alert_Type || ''),
      severity: String(alert.Severity || alert.Priority || '')
    });
  });

  var lightweightClaims = activeClaims.map(function(claim) {
    return buildHomepageLightweightClaimSummary_(claim, conditionsByClaim, alertsByClaim);
  });

  var summary = buildHomepageAwarenessSummary_(lightweightClaims);
  var priorityCards = buildHomepageAwarenessPriorityCards_(lightweightClaims);
  var priorityClaims = buildHomepageAwarenessPriorityClaims_(lightweightClaims);
  var followUps = buildHomepageAwarenessFollowUps_(lightweightClaims);
  var waitingOn = buildHomepageAwarenessWaitingOn_(lightweightClaims);
  var alerts = buildHomepageAwarenessAlerts_(lightweightClaims);

  return {
    generatedAt: generatedAt,
    summary: summary,
    priorityCards: priorityCards,
    priorityClaims: priorityClaims,
    followUps: followUps,
    waitingOn: waitingOn,
    alerts: alerts
  };
}

function buildHomepageLightweightClaimSummary_(claim, conditionsByClaim, alertsByClaim) {
  var claimId = String(claim.Claim_ID || '');
  var displayName = claim.Customer_Name || claim.Display_Name || claimId;
  var claimNumber = String(claim.Claim_Number || '');
  var jobNumber = String(claim.Job_Number || '');
  var lifecycleState = String(claim.Lifecycle_State || '');
  var ownershipArea = String(claim.Ownership_Area || '');
  var healthLevel = getHomepageClaimHealthLevel_(claim, 'Healthy');

  var claimConditionTypes = conditionsByClaim[claimId] || [];
  var claimAlerts = alertsByClaim[claimId] || [];

  var primaryCondition = buildHomepageAwarenessPrimaryCondition_(claimConditionTypes);
  var waitingOn = buildHomepageAwarenessWaitingOnForClaim_(claimConditionTypes, primaryCondition, ownershipArea);

  var lastActivityRaw = claim.Last_Meaningful_Activity_Date || claim.Updated_At || '';
  var daysSinceMeaningfulActivity = 0;
  if (lastActivityRaw) {
    var lastActivityTime = new Date(lastActivityRaw).getTime();
    if (!isNaN(lastActivityTime)) {
      daysSinceMeaningfulActivity = Math.floor((new Date().getTime() - lastActivityTime) / (1000 * 60 * 60 * 24));
    }
  }

  var staleRisk = daysSinceMeaningfulActivity > 14;
  var alertCount = claimAlerts.length;
  var highestAlertSeverity = '';

  if (claimAlerts.length > 0) {
    var severityRanks = { critical: 4, high: 3, medium: 2, low: 1 };
    var highestRank = 0;
    claimAlerts.forEach(function(a) {
      var sev = String(a.severity || '').toLowerCase();
      var rank = severityRanks[sev] || 0;
      if (rank > highestRank) {
        highestRank = rank;
        highestAlertSeverity = a.severity || '';
      }
    });
  }

  var isMissingEoj = claimAlerts.some(function(a) {
    return String(a.alertType || '').toLowerCase().indexOf('eoj') !== -1;
  });

  return {
    claimId: claimId,
    displayName: displayName,
    claimNumber: claimNumber,
    jobNumber: jobNumber,
    lifecycleState: lifecycleState,
    ownershipArea: ownershipArea,
    healthLevel: healthLevel,
    primaryCondition: primaryCondition,
    activeConditions: claimConditionTypes,
    waitingOn: waitingOn,
    operationalPriority: buildHomepageAwarenessOperationalPriority_(healthLevel),
    staleRisk: staleRisk,
    lastMeaningfulActivity: lastActivityRaw,
    daysSinceMeaningfulActivity: daysSinceMeaningfulActivity,
    alertCount: alertCount,
    highestAlertSeverity: highestAlertSeverity,
    isMissingEoj: isMissingEoj,
    operationalAlerts: claimAlerts
  };
}

function buildHomepageAwarenessPrimaryCondition_(conditionTypes) {
  var priorityOrder = [
    'Carrier Revision Requested',
    'Positive Asbestos Result',
    'Abatement Required',
    'Coverage Pending',
    'Estimate Under Review',
    'Supplement Under Review',
    'Revision Active',
    'Monitoring Active',
    'Waiting on Payment',
    'Asbestos Testing Pending',
    'Waiting on Lab Results',
    'Source of Loss Unresolved',
    'Waiting on Customer Decision'
  ];

  for (var i = 0; i < priorityOrder.length; i++) {
    if (conditionTypes.indexOf(priorityOrder[i]) !== -1) {
      return priorityOrder[i];
    }
  }

  return conditionTypes.length > 0 ? conditionTypes[0] : '';
}

function buildHomepageAwarenessWaitingOnForClaim_(conditionTypes, primaryCondition, ownershipArea) {
  var conditionText = conditionTypes.join(' | ').toLowerCase();
  var primaryLower = String(primaryCondition || '').toLowerCase();
  var combined = conditionText + ' | ' + primaryLower;

  if (combined.indexOf('coverage pending') !== -1 ||
      combined.indexOf('carrier revision') !== -1 ||
      combined.indexOf('estimate under review') !== -1 ||
      combined.indexOf('supplement under review') !== -1) {
    return 'Carrier';
  }

  if (combined.indexOf('asbestos') !== -1 ||
      combined.indexOf('lab results') !== -1) {
    return 'Lab';
  }

  if (combined.indexOf('waiting on customer') !== -1 ||
      combined.indexOf('customer decision') !== -1) {
    return 'Customer';
  }

  if (combined.indexOf('waiting on payment') !== -1) {
    return 'Accounting';
  }

  if (combined.indexOf('revision active') !== -1) {
    return 'Rainbow';
  }

  if (String(ownershipArea || '').toLowerCase().indexOf('field operations') !== -1 && conditionTypes.length === 0) {
    return 'Technician';
  }

  if (conditionTypes.length === 0) {
    return 'Nobody';
  }

  return 'Unknown';
}

function buildHomepageAwarenessOperationalPriority_(healthLevel) {
  if (healthLevel === 'Critical') {
    return 'Immediate';
  }
  if (healthLevel === 'Escalated') {
    return 'High';
  }
  if (healthLevel === 'At Risk') {
    return 'Normal';
  }
  if (healthLevel === 'Attention Soon') {
    return 'Low';
  }
  return 'Normal';
}

function buildHomepageAwarenessSummary_(claims) {
  claims = claims || [];

  var totalActiveClaims = 0;
  var needsAttentionCount = 0;
  var atRiskCount = 0;
  var escalatedCount = 0;
  var criticalCount = 0;
  var missingEojCount = 0;
  var waitingOnInsuranceCount = 0;
  var monitoringCount = 0;
  var openRequirementCount = 0;
  var operationalAlertCount = 0;

  claims.forEach(function(c) {
    totalActiveClaims++;
    var health = String(c.healthLevel || '').toLowerCase();

    if (health === 'attention soon' || health === 'at risk' || health === 'escalated' || health === 'critical') {
      needsAttentionCount++;
    }
    if (health === 'at risk') {
      atRiskCount++;
    }
    if (health === 'escalated') {
      escalatedCount++;
    }
    if (health === 'critical') {
      criticalCount++;
    }
    if (c.isMissingEoj) {
      missingEojCount++;
    }
    if (c.waitingOn === 'Carrier') {
      waitingOnInsuranceCount++;
    }
    if (String(c.primaryCondition || '').toLowerCase().indexOf('monitoring') !== -1) {
      monitoringCount++;
    }
    if ((c.alertCount || 0) > 0) {
      operationalAlertCount++;
    }
  });

  return {
    totalActiveClaims: totalActiveClaims,
    needsAttentionCount: needsAttentionCount,
    atRiskCount: atRiskCount,
    escalatedCount: escalatedCount,
    criticalCount: criticalCount,
    missingEojCount: missingEojCount,
    waitingOnInsuranceCount: waitingOnInsuranceCount,
    monitoringCount: monitoringCount,
    openRequirementCount: openRequirementCount,
    operationalAlertCount: operationalAlertCount
  };
}

function buildHomepageAwarenessPriorityCards_(claims) {
  claims = claims || [];

  return [
    buildHomepageAwarenessCard_(
      'critical-escalated',
      'Critical / Escalated',
      'critical',
      'Claims requiring immediate or escalated attention.',
      'needsAttention',
      '?view=claimShell&lensId=needsAttention',
      claims,
      function(c) {
        var h = String(c.healthLevel || '').toLowerCase();
        return h === 'critical' || h === 'escalated';
      }
    ),
    buildHomepageAwarenessCard_(
      'needs-attention',
      'Needs Attention',
      'high',
      'Claims with degraded health or immediate operational priority.',
      'needsAttention',
      '?view=claimShell&lensId=needsAttention',
      claims,
      function(c) {
        var h = String(c.healthLevel || '').toLowerCase();
        return h === 'attention soon' || h === 'at risk' || h === 'escalated' || h === 'critical';
      }
    ),
    buildHomepageAwarenessCard_(
      'follow-ups-due',
      'Follow-Ups Due',
      'medium',
      'Claims that are stale or have exceeded the 14-day follow-up threshold.',
      'needsAttention',
      '?view=claimShell&lensId=needsAttention',
      claims,
      function(c) {
        return c.staleRisk === true || (c.daysSinceMeaningfulActivity || 0) > 14;
      }
    ),
    buildHomepageAwarenessCard_(
      'waiting-on-insurance',
      'Waiting on Insurance',
      'high',
      'Claims waiting on carrier coverage, estimates, supplements, or payment.',
      'waitingOnInsurance',
      '?view=claimShell&lensId=waitingOnInsurance',
      claims,
      function(c) {
        if (c.waitingOn === 'Carrier') {
          return true;
        }
        var cond = String(c.primaryCondition || '').toLowerCase();
        return cond.indexOf('coverage') !== -1 ||
               cond.indexOf('supplement') !== -1 ||
               cond.indexOf('estimate') !== -1;
      }
    ),
    buildHomepageAwarenessCard_(
      'missing-eoj',
      'Missing EOJ',
      'high',
      'Claims with a missing EOJ alert.',
      'missingEoj',
      '?view=claimShell&lensId=missingEoj',
      claims,
      function(c) {
        return c.isMissingEoj === true;
      }
    ),
    buildHomepageAwarenessCard_(
      'monitoring-paid',
      'Monitoring / Paid',
      'info',
      'Claims in monitoring status or operationally complete.',
      'paidMonitoring',
      '?view=claimShell&lensId=paidMonitoring',
      claims,
      function(c) {
        var cond = String(c.primaryCondition || '').toLowerCase();
        var state = String(c.lifecycleState || '').toLowerCase();
        return cond.indexOf('monitoring active') !== -1 || state === 'operationally complete';
      }
    ),
    buildHomepageAwarenessCard_(
      'operational-alerts',
      'Operational Alerts',
      'medium',
      'Claims with one or more active operational alerts.',
      'needsAttention',
      '?view=claimShell&lensId=needsAttention',
      claims,
      function(c) {
        return (c.alertCount || 0) > 0;
      }
    )
  ];
}

function buildHomepageAwarenessCard_(id, label, severity, description, lensId, route, claims, filterFn) {
  var matched = claims.filter(filterFn);
  var preview = matched.slice(0, 3).map(function(c) {
    return {
      claimId: String(c.claimId || ''),
      displayName: String(c.displayName || ''),
      claimNumber: String(c.claimNumber || '')
    };
  });

  return {
    id: String(id || ''),
    label: String(label || ''),
    count: matched.length,
    severity: String(severity || 'info'),
    description: String(description || ''),
    lensId: String(lensId || ''),
    route: String(route || ''),
    itemsPreview: preview
  };
}

function buildHomepageAwarenessPriorityClaims_(claims) {
  claims = claims || [];

  var prioritized = claims.filter(function(c) {
    var h = String(c.healthLevel || '').toLowerCase();
    return h === 'critical' || h === 'escalated' || h === 'at risk' || h === 'attention soon' ||
           c.staleRisk === true ||
           (c.alertCount || 0) > 0;
  });

  prioritized.sort(function(a, b) {
    var rankA = buildHomepageAwarenessHealthRank_(a.healthLevel);
    var rankB = buildHomepageAwarenessHealthRank_(b.healthLevel);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return (b.daysSinceMeaningfulActivity || 0) - (a.daysSinceMeaningfulActivity || 0);
  });

  return prioritized.slice(0, 20).map(function(c) {
    return {
      claimId: String(c.claimId || ''),
      displayName: String(c.displayName || ''),
      claimNumber: String(c.claimNumber || ''),
      jobNumber: String(c.jobNumber || ''),
      lifecycleState: String(c.lifecycleState || ''),
      healthLevel: String(c.healthLevel || ''),
      ownershipArea: String(c.ownershipArea || ''),
      primaryCondition: String(c.primaryCondition || ''),
      waitingOn: String(c.waitingOn || 'Unknown'),
      operationalPriority: String(c.operationalPriority || 'Normal'),
      staleRisk: c.staleRisk === true,
      lastMeaningfulActivity: String(c.lastMeaningfulActivity || ''),
      daysSinceMeaningfulActivity: Number(c.daysSinceMeaningfulActivity || 0),
      nextAction: '',
      alertCount: Number(c.alertCount || 0),
      highestAlertSeverity: String(c.highestAlertSeverity || ''),
      route: c.claimId ? buildHomepageTargetRoute_('claim', c.claimId) : ''
    };
  });
}

function buildHomepageAwarenessFollowUps_(claims) {
  claims = claims || [];
  var dueToday = [];
  var overdue = [];
  var attentionSoon = [];

  claims.forEach(function(c) {
    if (!c.staleRisk && (c.daysSinceMeaningfulActivity || 0) <= 14) {
      return;
    }

    var days = c.daysSinceMeaningfulActivity || 0;
    var item = {
      claimId: String(c.claimId || ''),
      displayName: String(c.displayName || ''),
      claimNumber: String(c.claimNumber || ''),
      healthLevel: String(c.healthLevel || ''),
      daysSinceMeaningfulActivity: days,
      waitingOn: String(c.waitingOn || 'Unknown'),
      nextAction: ''
    };

    if (days > 21) {
      overdue.push(item);
    } else if (days > 14) {
      attentionSoon.push(item);
    } else {
      dueToday.push(item);
    }
  });

  return {
    dueToday: dueToday,
    overdue: overdue,
    attentionSoon: attentionSoon
  };
}

function buildHomepageAwarenessWaitingOn_(claims) {
  claims = claims || [];

  var groups = {
    carrier: [],
    customer: [],
    technician: [],
    accounting: [],
    lab: [],
    rainbow: [],
    unknown: []
  };

  claims.forEach(function(c) {
    var waitingOn = String(c.waitingOn || 'Unknown');
    var item = {
      claimId: String(c.claimId || ''),
      displayName: String(c.displayName || ''),
      claimNumber: String(c.claimNumber || ''),
      primaryCondition: String(c.primaryCondition || ''),
      healthLevel: String(c.healthLevel || '')
    };

    if (waitingOn === 'Carrier') {
      groups.carrier.push(item);
    } else if (waitingOn === 'Customer') {
      groups.customer.push(item);
    } else if (waitingOn === 'Technician') {
      groups.technician.push(item);
    } else if (waitingOn === 'Accounting') {
      groups.accounting.push(item);
    } else if (waitingOn === 'Lab') {
      groups.lab.push(item);
    } else if (waitingOn === 'Rainbow') {
      groups.rainbow.push(item);
    } else {
      groups.unknown.push(item);
    }
  });

  return groups;
}

function buildHomepageAwarenessAlerts_(claims) {
  claims = claims || [];

  var groups = {
    missingEoj: [],
    missingLinks: [],
    claimReviewNeeded: [],
    duplicateReviewNeeded: [],
    other: []
  };

  claims.forEach(function(c) {
    var alerts = Array.isArray(c.operationalAlerts) ? c.operationalAlerts : [];

    alerts.forEach(function(alert) {
      var alertType = String(alert.alertType || alert.Alert_Type || '').toLowerCase();
      var combined = alertType;
      var item = {
        claimId: String(c.claimId || ''),
        displayName: String(c.displayName || ''),
        claimNumber: String(c.claimNumber || ''),
        alertType: String(alert.alertType || alert.Alert_Type || ''),
        severity: String(alert.severity || alert.Severity || 'Medium')
      };

      if (combined.indexOf('eoj') !== -1) {
        groups.missingEoj.push(item);
      } else if (combined.indexOf('missing link') !== -1 || combined.indexOf('missing xa') !== -1 ||
                 combined.indexOf('missing fusion') !== -1 || combined.indexOf('missing claimx') !== -1) {
        groups.missingLinks.push(item);
      } else if (combined.indexOf('claim review') !== -1 || combined.indexOf('review needed') !== -1) {
        groups.claimReviewNeeded.push(item);
      } else if (combined.indexOf('duplicate') !== -1) {
        groups.duplicateReviewNeeded.push(item);
      } else {
        groups.other.push(item);
      }
    });
  });

  return groups;
}

function buildHomepageAwarenessHealthRank_(healthLevel) {
  var ranks = {
    'Critical': 1,
    'Escalated': 2,
    'At Risk': 3,
    'Attention Soon': 4,
    'Healthy': 5
  };

  return ranks[String(healthLevel || '')] || 5;
}

function testHomepageAlertDistribution() {
  const alerts = getHomepageSheetRows_('Claim_Alerts')
    .map(normalizeHomepageAlert_);

  const result = alerts.reduce(function(map, alert) {
    const type = alert.Alert_Type || 'Unknown';
    const status = alert.Alert_Status || alert.Status || 'Unknown';
    const key = type + ' | ' + status;

    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testHomepageClaimsTargetRoutes() {
  const result = {
    claimRoute: buildHomepageTargetRoute_('claim', 'CLM-26A-0052-WTR'),
    ownershipRoute: buildHomepageTargetRoute_('ownership', 'Field Operations'),
    conditionRoute: buildHomepageTargetRoute_('condition', 'Coverage Pending'),
    complianceRoute: buildHomepageTargetRoute_('compliance', 'open'),
    defaultRoute: buildHomepageTargetRoute_('', '')
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
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
  Logger.log('Health counts: ' + JSON.stringify(data.kpis.healthCounts || {}, null, 2));
  Logger.log('Follow-ups due: ' + data.kpis.followUpsDue);
  Logger.log('Today priorities count: ' + data.todayPriorities.length);
  Logger.log('Today schedule count: ' + data.todaySchedule.length);
  Logger.log('Becoming stale count: ' + data.becomingStale.length);
  Logger.log('Sample becoming stale: ' + JSON.stringify(data.becomingStale[0] || null, null, 2));
  Logger.log('Recent activity count: ' + data.recentActivity.length);
  Logger.log('Recent claim summaries count: ' + data.recentClaimSummaries.length);
  Logger.log('Operational alerts count: ' + data.operationalAlerts.length);
  Logger.log('Sample priority: ' + JSON.stringify(data.todayPriorities[0] || null, null, 2));
  Logger.log('First 5 priorities: ' + JSON.stringify(data.todayPriorities.slice(0, 5), null, 2));
  Logger.log('Sample recent activity: ' + JSON.stringify(data.recentActivity[0] || null, null, 2));
  Logger.log('First 5 recent activity dates: ' + JSON.stringify(data.recentActivity.slice(0, 5).map(function(activity) {
    return {
      claimId: activity.claimId,
      eventDate: activity.eventDate,
      eventType: activity.eventType,
      sourceSystem: activity.sourceSystem,
      isMeaningful: activity.isMeaningful
    };
  }), null, 2));
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

function testHomepageHealthFieldMappingForKnownClaims() {
  const targetClaimIds = {
    'CLM-26N-0103-WTR': true,
    'CLM-26A-0043-WTR': true
  };

  const rawClaims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims);
  const results = rawClaims.filter(function(row) {
    const claimId = getHomepageValue_(row, ['Claim_ID', 'Claim ID']);
    return targetClaimIds[claimId];
  }).map(function(row) {
    const normalized = normalizeHomepageClaim_(row);
    const healthLikeRawFields = {};

    Object.keys(row).forEach(function(key) {
      if (String(key || '').toLowerCase().indexOf('health') !== -1) {
        healthLikeRawFields[key] = row[key];
      }
    });

    return {
      claimId: normalized.Claim_ID,
      rawFields: {
        'Health Status': getHomepageValue_(row, ['Health Status']),
        Health_Status: getHomepageValue_(row, ['Health_Status']),
        Operational_Health: getHomepageValue_(row, ['Operational_Health']),
        Health_Level: getHomepageValue_(row, ['Health_Level']),
        'Health Level': getHomepageValue_(row, ['Health Level'])
      },
      normalizedFields: {
        Health_Level: normalized.Health_Level,
        Operational_Health: normalized.Operational_Health,
        Health_Reason: normalized.Health_Reason
      },
      healthLikeRawFields: healthLikeRawFields,
      kpiHealthValue: getHomepageClaimHealthLevel_(normalized, 'Healthy'),
      activeClaim: isHomepageActiveClaim_(normalized)
    };
  });

  Logger.log('HOMEPAGE_HEALTH_FIELD_MAPPING ' + JSON.stringify(results, null, 2));

  return results;
}

function testHomepageSourceInventory() {
  const ss = SpreadsheetApp.openById(HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  const inventory = ss.getSheets().map(function(sheet) {
    const values = sheet.getDataRange().getValues();
    const detectedHeaderRowIndex = values.length ? findHomepageHeaderRowIndex_(values, sheet.getName()) : 0;
    const detectedHeaders = values.length ? values[detectedHeaderRowIndex] : [];

    return {
      sheetName: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn(),
      detectedHeaderRow: detectedHeaderRowIndex + 1,
      dataRowsAfterDetectedHeader: Math.max(values.length - detectedHeaderRowIndex - 1, 0),
      firstRow: values.length ? values[0] : [],
      detectedHeaders: detectedHeaders
    };
  });

  Logger.log('Homepage source spreadsheet ID: ' + HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);
  Logger.log('Homepage source inventory: ' + JSON.stringify(inventory, null, 2));

  return inventory;
}


function testHomepageParsedSourceSamples() {
  const claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims).map(normalizeHomepageClaim_);
  const timeline = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.timeline).map(normalizeHomepageTimelineEvent_);
  const conditions = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.conditions).map(normalizeHomepageCondition_);
  const alerts = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.alerts).map(normalizeHomepageAlert_);
  const complianceActions = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.complianceActions).map(normalizeHomepageComplianceAction_);
  const summaries = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claimSummaries).map(normalizeHomepageClaimSummary_);

  const openComplianceActions = complianceActions.filter(function(action) {
    return isHomepageOpenStatus_(action.Action_Status || action.Status);
  });

  const result = {
    claims: {
      count: claims.length,
      sample: claims[0] || null
    },
    timeline: {
      count: timeline.length,
      sample: timeline[0] || null
    },
    conditions: {
      count: conditions.length,
      sample: conditions[0] || null
    },
    alerts: {
      count: alerts.length,
      sample: alerts[0] || null
    },
    complianceActions: {
      count: complianceActions.length,
      openCount: openComplianceActions.length,
      sample: complianceActions[0] || null,
      openSample: openComplianceActions[0] || null
    },
    claimSummaries: {
      count: summaries.length,
      sample: summaries[0] || null
    }
  };

  Logger.log('Homepage parsed source samples: ' + JSON.stringify(result, null, 2));

  return result;
}


function testHomepageOperationalAlertClaimIds() {
  const data = getHomepageClaimSummaryData();
  const result = data.operationalAlerts.map(function(alert) {
    return {
      claimId: alert.claimId,
      customerName: alert.customerName,
      claimNumber: alert.claimNumber,
      alertType: alert.alertType,
      reason: alert.reason
    };
  });

  Logger.log('HOMEPAGE_OPERATIONAL_ALERT_CLAIMS ' + JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------------------
// Diagnostic: cross-check all homepage count sources
// ---------------------------------------------------------------------------

/**
 * testHomepageClaimsCountConsistency
 *
 * Logs a side-by-side comparison of every data source that feeds the four
 * headline homepage counts.  Run this after any claim backfill to confirm
 * all metrics are internally consistent.
 *
 * Logged fields:
 *   activeClaimsCount                — direct Claims sheet count (source of truth)
 *   recentActivityClaimCount         — active claims with any activity signal
 *                                      (Timeline_Events OR Last_Meaningful_Activity_Date
 *                                       OR Claim_Summaries entry)
 *   timelineEventDistinctClaimIdCount — distinct active Claim_IDs in Timeline_Events
 *   activeClaimsWithNoSummaryRow     — claims missing from Claim_Summaries (stale cache)
 *   activeClaimsMissingXaSymbility   — open "Missing XA/Symbility" or "Missing
 *                                      Operational Links Record" alerts in Claim_Alerts
 *   openAlertCountByType             — all open alert types with counts
 *   sampleBootstrappedClaims         — first ≤10 claims with no Claim_Summaries row,
 *                                      showing whether each is included in recent-activity
 *                                      count and whether it has a missing-link alert
 */
function testHomepageClaimsCountConsistency() {
  var ss = SpreadsheetApp.openById(HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID);

  var claims = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claims).map(normalizeHomepageClaim_);
  var timeline = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.timeline).map(normalizeHomepageTimelineEvent_);
  var claimAlerts = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.alerts).map(normalizeHomepageAlert_);
  var claimSummaries = getHomepageSheetRows_(HOMEPAGE_CLAIM_SHEET_NAMES.claimSummaries).map(normalizeHomepageClaimSummary_);

  // Read External_Links directly for missing-links detection
  var elSheet = ss.getSheetByName('External_Links');
  var elClaimIds = {};
  if (elSheet) {
    var elValues = elSheet.getDataRange().getValues();
    if (elValues.length >= 2) {
      var elHeaders = elValues[0].map(function(h) { return String(h || '').trim(); });
      var elClaimIdIdx = elHeaders.indexOf('Claim_ID') !== -1 ? elHeaders.indexOf('Claim_ID') : elHeaders.indexOf('Claim ID');
      var elJobNumIdx  = elHeaders.indexOf('Job_Number') !== -1 ? elHeaders.indexOf('Job_Number') : elHeaders.indexOf('Job Number');
      elValues.slice(1).forEach(function(row) {
        var cid = elClaimIdIdx !== -1 ? String(row[elClaimIdIdx] || '').trim() : '';
        var jn  = elJobNumIdx  !== -1 ? String(row[elJobNumIdx]  || '').trim() : '';
        if (cid) elClaimIds[cid] = true;
        if (jn)  { elClaimIds[jn] = true; elClaimIds['CLM-' + jn] = true; }
      });
    }
  }

  var activeClaims = claims.filter(isHomepageActiveClaim_);

  var activeClaimIds = activeClaims.reduce(function(map, claim) {
    addHomepageClaimKeysToMap_(map, claim);
    return map;
  }, {});

  // Distinct active-claim Claim_IDs that appear in Timeline_Events
  var timelineClaimIds = {};
  timeline.forEach(function(event) {
    if (event.Claim_ID && activeClaimIds[event.Claim_ID]) {
      timelineClaimIds[event.Claim_ID] = true;
    }
  });

  // Open alerts scoped to active claims
  var openAlertsByType = {};
  var alertsByClaimId = {};
  claimAlerts.forEach(function(alert) {
    if (!homepageRecordMatchesActiveClaim_(alert, activeClaimIds)) { return; }
    if (!isHomepageOpenStatus_(alert.Alert_Status || alert.Status || alert.Action_Status)) { return; }
    var alertType = String(alert.Alert_Type || 'Unknown');
    openAlertsByType[alertType] = (openAlertsByType[alertType] || 0) + 1;
    if (alert.Claim_ID) {
      if (!alertsByClaimId[alert.Claim_ID]) { alertsByClaimId[alert.Claim_ID] = []; }
      alertsByClaimId[alert.Claim_ID].push(alertType);
    }
  });

  // Active claims with a missing-link alert (XA/Symbility or no EL record)
  var missingLinkAlertTypes = /xa|xact|symbility|operational links/i;
  var claimsWithMissingLinkAlert = Object.keys(alertsByClaimId).filter(function(claimId) {
    return alertsByClaimId[claimId].some(function(type) {
      return missingLinkAlertTypes.test(type);
    });
  });

  // Claim_Summaries coverage
  var summaryClaimIds = {};
  claimSummaries.forEach(function(summary) {
    if (summary.Claim_ID && activeClaimIds[summary.Claim_ID]) {
      summaryClaimIds[summary.Claim_ID] = true;
    }
    if (summary.Job_Number) {
      var synth = 'CLM-' + summary.Job_Number;
      if (activeClaimIds[synth]) { summaryClaimIds[synth] = true; }
      if (activeClaimIds[summary.Job_Number]) { summaryClaimIds[summary.Job_Number] = true; }
    }
  });

  var activeClaimsWithNoSummary = activeClaims.filter(function(claim) {
    return !summaryClaimIds[claim.Claim_ID];
  });

  // Active claims with no External_Links row
  var activeClaimsWithNoEl = activeClaims.filter(function(claim) {
    return !elClaimIds[claim.Claim_ID] &&
           !elClaimIds[claim.Job_Number] &&
           !(claim.Job_Number && elClaimIds['CLM-' + claim.Job_Number]);
  });

  // recentActivityClaims as the fixed logic would compute it
  var activeClaimSummaries = claimSummaries.filter(function(summary) {
    return homepageRecordMatchesActiveClaim_(summary, activeClaimIds);
  });
  var recentActivityCount = countHomepageSummariesWithRecentActivity_(activeClaimSummaries, activeClaims, timeline);

  // Sample bootstrapped claims (no Claim_Summaries row)
  var sampleBootstrapped = activeClaimsWithNoSummary.slice(0, 10).map(function(claim) {
    var hasTimeline  = !!(claim.Claim_ID && timelineClaimIds[claim.Claim_ID]);
    var hasActivity  = hasTimeline || !!claim.Last_Meaningful_Activity_Date;
    var alerts       = alertsByClaimId[claim.Claim_ID] || [];
    var hasMissingLinkAlert = alerts.some(function(t) { return missingLinkAlertTypes.test(t); });
    var hasElRow     = !!(elClaimIds[claim.Claim_ID] || elClaimIds[claim.Job_Number]);

    return {
      claimId:                     claim.Claim_ID,
      jobNumber:                   claim.Job_Number,
      customerName:                claim.Customer_Name,
      hasSummaryRow:               false,
      hasElRow:                    hasElRow,
      includedInRecentActivityCount: hasActivity,
      hasMissingLinkAlert:         hasMissingLinkAlert,
      alerts:                      alerts
    };
  });

  var result = {
    activeClaimsCount:                activeClaims.length,
    recentActivityClaimCount:         recentActivityCount,
    timelineEventDistinctClaimIdCount: Object.keys(timelineClaimIds).length,
    activeClaimsWithNoSummaryRow:     activeClaimsWithNoSummary.length,
    activeClaimsWithNoElRow:          activeClaimsWithNoEl.length,
    activeClaimsMissingLinkAlertCount: claimsWithMissingLinkAlert.length,
    openAlertCountByType:             openAlertsByType,
    sampleBootstrappedClaims:         sampleBootstrapped
  };

  Logger.log('HOMEPAGE_COUNT_CONSISTENCY ' + JSON.stringify(result, null, 2));
  return result;
}

function testHomepageEstimatePlatformNotRequiredSuppression() {
  const data = getHomepageClaimSummaryData();
  const result = {
    storedNotRequiredClaimKeys: getHomepageEstimatePlatformNotRequiredClaimKeys_(),
    operationalAlertCount: Array.isArray(data.operationalAlerts) ? data.operationalAlerts.length : 0,
    containsNeff: Array.isArray(data.operationalAlerts) ? data.operationalAlerts.some(function(alert) {
      return alert.claimId === 'CLM-26A-0040-TXT';
    }) : false,
    operationalAlerts: Array.isArray(data.operationalAlerts) ? data.operationalAlerts.map(function(alert) {
      return {
        claimId: alert.claimId,
        customerName: alert.customerName,
        claimNumber: alert.claimNumber,
        alertType: alert.alertType
      };
    }) : []
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
