

/**
 * TimelineSynthesisService
 * Rainbow Phase 5 - Step 5
 *
 * Converts Timeline Intelligence activity groups into higher-level
 * operational activities.
 */

function synthesizeClaimActivities(claimId) {
  const groupsResult = buildTimelineActivityGroups(claimId);

  if (!groupsResult.success) {
    return groupsResult;
  }

  const activityGroups = groupsResult.data.activityGroups || [];
  const synthesizedActivities = correlateTimelineGroupsByRun_(activityGroups);

  return successResponse({
    claimId: claimId,
    activityCount: synthesizedActivities.length,
    activities: synthesizedActivities
  }, 'Claim activities synthesized successfully.');
}

function correlateTimelineGroupsByRun_(activityGroups) {
  const sourceBuckets = {};
  const standaloneGroups = [];

  (activityGroups || []).forEach(function(group) {
    const synthesisKey = getTimelineSynthesisKey_(group);

    if (synthesisKey) {
      if (!sourceBuckets[synthesisKey]) {
        sourceBuckets[synthesisKey] = [];
      }

      sourceBuckets[synthesisKey].push(group);
    } else {
      standaloneGroups.push(group);
    }
  });

  const activities = [];

  Object.keys(sourceBuckets).forEach(function(key) {
    const bucketGroups = sourceBuckets[key];

    if (shouldSynthesizeTimelineBucket_(bucketGroups)) {
      activities.push(buildSynthesizedActivity_(bucketGroups));
    } else {
      bucketGroups.forEach(function(group) {
        activities.push(buildSynthesizedActivity_([group]));
      });
    }
  });

  standaloneGroups.forEach(function(group) {
    activities.push(buildSynthesizedActivity_([group]));
  });

  activities.sort(function(a, b) {
    return new Date(b.endDate || b.startDate || 0) - new Date(a.endDate || a.startDate || 0);
  });

  return activities;
}

function getTimelineSynthesisKey_(group) {
  const events = group.events || [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const sourceRecordId = event.Source_Record_ID || '';
    const sourceSystem = event.Source_System || event.Event_Source || '';
    const dateKey = formatSynthesisDateKey_(event.Event_Date || event.Created_At || '');

    if (sourceRecordId && sourceSystem && dateKey) {
      return [sourceSystem, sourceRecordId, dateKey].join('|');
    }
  }

  return '';
}

function shouldSynthesizeTimelineBucket_(groups) {
  const categories = getTimelineSynthesisCategories_(groups);

  if (categories.indexOf('EOJ') !== -1 && categories.indexOf('Condition') !== -1) {
    return true;
  }

  if (categories.indexOf('EOJ') !== -1 && categories.indexOf('Alert') !== -1) {
    return true;
  }

  if (categories.indexOf('Intake') !== -1 && categories.indexOf('External Link') !== -1) {
    return true;
  }

  if (groups.length > 1 && categories.indexOf('Payment') !== -1) {
    return true;
  }

  return false;
}

function getTimelineSynthesisCategories_(groups) {
  const categories = [];

  (groups || []).forEach(function(group) {
    if (group.category && categories.indexOf(group.category) === -1) {
      categories.push(group.category);
    }
  });

  return categories;
}

function formatSynthesisDateKey_(dateValue) {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);

  if (isNaN(date.getTime())) {
    return '';
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function buildSynthesizedActivity_(groups) {
  const sourceGroups = groups || [];
  const sourceEvents = [];

  sourceGroups.forEach(function(group) {
    (group.events || []).forEach(function(event) {
      sourceEvents.push(event);
    });
  });

  const primaryGroup = sourceGroups[0] || {};

  return {
    activityId: Utilities.getUuid(),
    activityType: deriveSynthesizedActivityType_(sourceGroups),
    activityLabel: deriveSynthesizedActivityLabel_(sourceGroups),
    priority: getSynthesizedActivityPriority_(sourceGroups),
    isMeaningful: isSynthesizedActivityMeaningful_(sourceGroups),
    startDate: getSynthesizedActivityStartDate_(sourceGroups),
    endDate: getSynthesizedActivityEndDate_(sourceGroups),
    claimId: sourceEvents.length ? sourceEvents[0].Claim_ID : '',
    sourceGroups: sourceGroups.length,
    sourceEvents: sourceEvents.length,
    summary: deriveSynthesizedActivityLabel_(sourceGroups),
    groups: sourceGroups,
    events: sourceEvents
  };
}

function getSynthesizedActivityPriority_(groups) {
  const priorities = (groups || []).map(function(group) {
    return (group.priority || 'low').toLowerCase();
  });

  if (priorities.indexOf('critical') !== -1) return 'critical';
  if (priorities.indexOf('high') !== -1) return 'high';
  if (priorities.indexOf('normal') !== -1) return 'normal';
  return 'low';
}

function isSynthesizedActivityMeaningful_(groups) {
  return (groups || []).some(function(group) {
    return group.isMeaningful === true;
  });
}

function getSynthesizedActivityStartDate_(groups) {
  const dates = [];

  (groups || []).forEach(function(group) {
    if (group.firstEventDate) {
      dates.push(new Date(group.firstEventDate));
    }
  });

  dates.sort(function(a, b) {
    return a.getTime() - b.getTime();
  });

  return dates.length ? dates[0].toISOString() : null;
}

function getSynthesizedActivityEndDate_(groups) {
  const dates = [];

  (groups || []).forEach(function(group) {
    if (group.lastEventDate) {
      dates.push(new Date(group.lastEventDate));
    }
  });

  dates.sort(function(a, b) {
    return b.getTime() - a.getTime();
  });

  return dates.length ? dates[0].toISOString() : null;
}

function deriveSynthesizedActivityType_(groups) {
  const categories = getTimelineSynthesisCategories_(groups);
  const summaryText = getTimelineSynthesisSummaryText_(groups);

  if (categories.indexOf('EOJ') !== -1 && summaryText.indexOf('MONITORING') !== -1) {
    return 'Monitoring';
  }

  if (categories.indexOf('EOJ') !== -1) {
    return 'Field Work';
  }

  if (categories.indexOf('Intake') !== -1) {
    return 'Intake';
  }

  if (categories.indexOf('Revision') !== -1) {
    return 'Revision';
  }

  if (categories.indexOf('Payment') !== -1) {
    return 'Payment';
  }

  if (categories.length > 0) {
    return categories[0];
  }

  return 'General';
}

function deriveSynthesizedActivityLabel_(groups) {
  const activityType = deriveSynthesizedActivityType_(groups);
  const categories = getTimelineSynthesisCategories_(groups);
  const summaryText = getTimelineSynthesisSummaryText_(groups);

  if (activityType === 'Monitoring') {
    return 'Monitoring Visit Completed';
  }

  if (activityType === 'Field Work' && categories.indexOf('EOJ') !== -1) {
    return 'Field Work Activity';
  }

  if (activityType === 'Intake') {
    return 'Intake Processed';
  }

  if (activityType === 'Revision') {
    return 'Revision Activity';
  }

  if (activityType === 'Payment') {
    return 'Payment Activity';
  }

  if (categories.indexOf('Alert') !== -1 && summaryText.indexOf('RESOLVED') !== -1) {
    return 'Alert Resolved';
  }

  const labels = {
    Alert: 'Alert Activity',
    Condition: 'Condition Activity',
    Ownership: 'Ownership Change',
    'External Link': 'External Link Update',
    Asbestos: 'Asbestos Activity',
    Itel: 'Itel Activity',
    System: 'System Activity'
  };

  return labels[activityType] || (activityType + ' Activity');
}

function getTimelineSynthesisSummaryText_(groups) {
  const parts = [];

  (groups || []).forEach(function(group) {
    if (group.activityLabel) {
      parts.push(group.activityLabel);
    }

    (group.events || []).forEach(function(event) {
      parts.push(event.Event_Type || '');
      parts.push(event.Summary || '');
      parts.push(event.Detail || '');
      parts.push(event.Related_Workflow || '');
    });
  });

  return parts.join(' | ').toUpperCase();
}

function testSynthesizeMonitoringActivity() {
  const result = buildSynthesizedActivity_([
    {
      category: 'Monitoring',
      activityLabel: 'Monitoring Visit Completed',
      priority: 'high',
      isMeaningful: true,
      firstEventDate: nowIso(),
      lastEventDate: nowIso(),
      events: [{ Claim_ID: 'TEST-CLAIM' }]
    }
  ]);

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSynthesizeClaimActivities() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  const result = synthesizeClaimActivities(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSynthesizeMonitoringBucket() {
  const now = nowIso();
  const result = buildSynthesizedActivity_([
    {
      category: 'EOJ',
      activityLabel: 'EOJ Activity',
      priority: 'high',
      isMeaningful: true,
      firstEventDate: now,
      lastEventDate: now,
      groupId: 'TEST|EOJ',
      events: [
        {
          Claim_ID: 'TEST-CLAIM',
          Event_Type: 'EOJ Submitted',
          Summary: 'Monitoring Visit Complete',
          Source_Record_ID: 'TEST-EOJ-001',
          Source_System: 'eoj-processing-engine',
          Event_Date: now
        }
      ]
    },
    {
      category: 'Condition',
      activityLabel: 'Condition Changed',
      priority: 'normal',
      isMeaningful: true,
      firstEventDate: now,
      lastEventDate: now,
      groupId: 'TEST|CONDITION',
      events: [
        {
          Claim_ID: 'TEST-CLAIM',
          Event_Type: 'Condition Added',
          Summary: 'Monitoring Active',
          Source_Record_ID: 'TEST-EOJ-001',
          Source_System: 'eoj-processing-engine',
          Event_Date: now
        }
      ]
    },
    {
      category: 'Alert',
      activityLabel: 'Alert Triggered',
      priority: 'normal',
      isMeaningful: false,
      firstEventDate: now,
      lastEventDate: now,
      groupId: 'TEST|ALERT',
      events: [
        {
          Claim_ID: 'TEST-CLAIM',
          Event_Type: 'Alert Added',
          Summary: 'Missing EOJ Photos',
          Source_Record_ID: 'TEST-EOJ-001',
          Source_System: 'eoj-processing-engine',
          Event_Date: now
        }
      ]
    }
  ]);

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}