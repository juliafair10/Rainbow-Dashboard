/**
 * TimelineIntelligenceService
 * Rainbow Phase 5 - Step 4
 *
 * Converts raw timeline events into operational activity groups.
 */

function buildTimelineActivityGroups(claimId) {
  const timelineResult = getTimelineForClaim(claimId);

  if (!timelineResult.success) {
    return timelineResult;
  }

  const timeline = timelineResult.data.timeline || [];
  const groupedEvents = {};

  timeline.forEach(function(event) {
    const groupKey = event.Group_ID || 'UNGROUPED';

    if (!groupedEvents[groupKey]) {
      groupedEvents[groupKey] = [];
    }

    groupedEvents[groupKey].push(event);
  });

  const activityGroups = Object.keys(groupedEvents).map(function(groupKey) {
    return buildTimelineActivityGroup_(groupedEvents[groupKey]);
  });

  return successResponse({
    claimId: claimId,
    groupCount: activityGroups.length,
    activityGroups: activityGroups
  }, 'Timeline activity groups built successfully.');
}

function buildTimelineActivityGroup_(events) {
  const sortedEvents = (events || []).slice().sort(function(a, b) {
    return new Date(a.Event_Date) - new Date(b.Event_Date);
  });

  return {
    activityLabel: generateActivityGroupLabel_(sortedEvents),
    eventCount: sortedEvents.length,
    priority: getActivityGroupPriority_(sortedEvents),
    isMeaningful: sortedEvents.some(function(e) {
      return e.Is_Meaningful_Activity === true || e.Is_Meaningful_Activity === 'TRUE';
    }),
    firstEventDate: sortedEvents.length ? sortedEvents[0].Event_Date : null,
    lastEventDate: sortedEvents.length ? sortedEvents[sortedEvents.length - 1].Event_Date : null,
    groupId: sortedEvents.length ? sortedEvents[0].Group_ID : '',
    category: sortedEvents.length ? sortedEvents[0].Event_Category : '',
    events: sortedEvents
  };
}

function generateActivityGroupLabel_(events) {
  const firstEvent = events && events.length ? events[0] : {};
  const category = firstEvent.Event_Category || 'General';

  const labelMap = {
    'Intake': 'Intake Processed',
    'Field Work': 'Field Work Activity',
    'Monitoring': 'Monitoring Visit Completed',
    'Condition': 'Condition Changed',
    'Alert': 'Alert Triggered',
    'Revision': 'Revision Activity',
    'Payment': 'Payment Activity',
    'Ownership': 'Ownership Change',
    'External Link': 'External Link Update',
    'Asbestos': 'Asbestos Activity',
    'Itel': 'Itel Activity',
    'System': 'System Activity',
    'EOJ': 'EOJ Activity'
  };

  return labelMap[category] || (category + ' Activity');
}

function getActivityGroupPriority_(events) {
  const priorities = (events || []).map(function(e) {
    return (e.Display_Priority || 'low').toLowerCase();
  });

  if (priorities.indexOf('critical') !== -1) return 'critical';
  if (priorities.indexOf('high') !== -1) return 'high';
  if (priorities.indexOf('normal') !== -1) return 'normal';
  return 'low';
}

function deriveLastMeaningfulActivityForClaim(claimId) {
  const timelineResult = getTimelineForClaim(claimId);

  if (!timelineResult.success) {
    return timelineResult;
  }

  const meaningfulEvents = (timelineResult.data.timeline || []).filter(function(event) {
    return event.Is_Meaningful_Activity === true || event.Is_Meaningful_Activity === 'TRUE';
  });

  meaningfulEvents.sort(function(a, b) {
    return new Date(b.Event_Date) - new Date(a.Event_Date);
  });

  const latest = meaningfulEvents[0] || null;

  return successResponse({
    claimId: claimId,
    lastMeaningfulActivity: latest
  }, 'Last meaningful activity derived successfully.');
}

function testGenerateActivityGroupLabel() {
  const result = generateActivityGroupLabel_([
    { Event_Category: 'Monitoring' }
  ]);

  Logger.log(result);
  return result;
}

function testLastMeaningfulActivity() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  const result = deriveLastMeaningfulActivityForClaim(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testBuildTimelineActivityGroups() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  const result = buildTimelineActivityGroups(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}