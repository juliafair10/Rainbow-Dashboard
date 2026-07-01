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
  let synthesizedActivities = correlateTimelineGroupsByRun_(activityGroups);

  if (shouldUseRawTimelineFallback_(synthesizedActivities)) {
    synthesizedActivities = synthesizeActivitiesFromRawTimeline_(claimId);
  }

  return successResponse({
    claimId: claimId,
    activityCount: synthesizedActivities.length,
    activities: synthesizedActivities
  }, 'Claim activities synthesized successfully.');
}

function synthesizeActivitiesFromRawTimeline_(claimId) {
  const timelineResult = getTimelineForClaim(claimId);

  if (!timelineResult.success) {
    return [];
  }

  const rawEvents = timelineResult.data.timeline || [];
  // Field-mapping fix (later-stage-evidence follow-up, 2026-07-01): see
  // normalizeRawTimelineEventForSynthesis_ below for why this mapping step
  // is required - getTimelineForClaim() can return rows keyed by the raw
  // (space-stripped) sheet headers (Date, Details, Source, Claim_ID, ...)
  // rather than the Event_Date/Detail/Event_Source names every function in
  // this file expects. Every event is normalized once here so
  // classification and date derivation both see the real values.
  const events = rawEvents.map(normalizeRawTimelineEventForSynthesis_);

  return events.map(function(event, index) {
    const activityType = deriveRawTimelineActivityType_(event);
    const label = deriveRawTimelineActivityLabel_(activityType, event);

    return {
      activityId: Utilities.getUuid(),
      activityType: activityType,
      activityLabel: label,
      priority: deriveRawTimelinePriority_(activityType, event),
      isMeaningful: isRawTimelineActivityMeaningful_(activityType, event),
      startDate: normalizeRawTimelineDate_(event.Event_Date || event.Created_At),
      endDate: normalizeRawTimelineDate_(event.Event_Date || event.Created_At),
      // Quoted/Echoed Note Guard (health pipeline repair, later-stage
      // evidence fix): flags rows that are themselves quotes of older
      // messages rather than new operational events. Never used to hide or
      // delete the row - only to keep it from being mistaken for new
      // revision/payment/etc. activity by chronology-sensitive logic.
      isQuotedEcho: isQuotedEchoEvent_(event, events),
      genuineEffectiveDate: getGenuineEffectiveDate_(event),
      // Exposed for diagnostics/debugging (later-stage-evidence follow-up):
      // the exact normalized text this event was classified from.
      rawText: getRawTimelineText_(event),
      claimId: event.Claim_ID || claimId,
      sourceGroups: 0,
      sourceEvents: 1,
      summary: label,
      groups: [],
      events: [rawEvents[index]]
    };
  });
}

/**
 * normalizeRawTimelineEventForSynthesis_ (later-stage-evidence follow-up,
 * 2026-07-01)
 *
 * Root cause of the live bug where evaluateConditionResolutionRecommendation_
 * found no payment/accounting or revision-completion evidence at all:
 * getTimelineForClaim() resolves rows through TimelineService.js, which can
 * return either of two shapes -
 *   - the primary lookup path (SheetService.findRows/getRows) normalizes
 *     the ACTUAL sheet headers ("Event ID", "Claim ID", "Date",
 *     "Event Type", "Details", "Source", ...) by stripping spaces, giving
 *     keys like Event_ID, Claim_ID, Date, Event_Type, Details, Source -
 *     NOT Event_Date / Detail / Event_Source.
 *   - the manual fallback path (getTimelineRowsForClaimFallback_) already
 *     maps into Event_Date / Detail / Event_Source / Claim_ID directly.
 * Every function below (getRawTimelineText_, deriveRawTimelineActivityType_,
 * the Quoted/Echoed Note Guard, date derivation) assumes the second shape.
 * Fed the first shape, event.Event_Date was always undefined, so every
 * synthesized activity's date silently defaulted to null - which then
 * failed any "at/after the condition opened" comparison and got the
 * activity filtered out entirely, even though the real timeline clearly
 * had the evidence. This normalizes either shape into the one every
 * downstream function expects, without changing those functions.
 */
function normalizeRawTimelineEventForSynthesis_(event) {
  return {
    Event_Type: event.Event_Type || event['Event Type'] || '',
    Event_Source: event.Event_Source || event.Source || event['Event Source'] || event['Source System'] || '',
    Source_System: event.Source_System || event['Source System'] || '',
    Summary: event.Summary || '',
    Detail: event.Detail || event.Details || event['Details'] || '',
    Related_Workflow: event.Related_Workflow || event['Related Workflow'] || '',
    Visibility: event.Visibility || '',
    Event_Date: event.Event_Date || event.Date || event['Event Date'] || event.date ||
      event.Created_At || event['Created At'] || '',
    Created_At: event.Created_At || event['Created At'] || '',
    Claim_ID: event.Claim_ID || event['Claim ID'] || ''
  };
}

/**
 * Quoted / Echoed Note Guard (health pipeline repair - later-stage evidence
 * fix, 2026-07-01)
 *
 * Historical-notes imports occasionally re-import an entire reply thread as
 * a single batch, stamping every quoted fragment inside it with the import
 * timestamp instead of that fragment's true original date. That produces
 * timeline rows that look like brand-new, later events but are actually
 * echoes of much older messages - which can fool any "did X happen after Y"
 * chronology check (e.g. "is there a newer revision request after
 * payment?").
 *
 * A row is treated as a quoted/echoed fragment - never deleted, never
 * hidden, still visible in the claim's timeline - when it carries one of
 * these signals:
 *   1. It embeds an explicit reply attribution ("By <name> On <date>"),
 *      the hallmark of a quoted reply.
 *   2. It embeds two or more distinguishable "On <date>" references,
 *      meaning it's stitching together multiple older statements into one
 *      later imported note.
 *   3. It shares its exact stored timestamp (to the second) with a sibling
 *      row in the same claim's timeline that itself matches signal 1 or 2 -
 *      i.e. it's part of the same batch re-import of a thread, even if this
 *      particular fragment has no date embedded in it.
 */
var QUOTED_REPLY_ATTRIBUTION_PATTERN_ = /\bBY\s+[A-Z0-9,'.\-\s]{2,60}?\s+ON\s+\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
var EMBEDDED_DATE_PATTERN_ = /\bON\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;

function getQuotedEchoSignals_(event) {
  const text = getRawTimelineText_(event);
  const attributionMatches = text.match(QUOTED_REPLY_ATTRIBUTION_PATTERN_) || [];
  const embeddedDateMatches = text.match(EMBEDDED_DATE_PATTERN_) || [];

  const embeddedDates = embeddedDateMatches.map(function(match) {
    const dateText = match.replace(/^.*ON\s+/, '');
    const parsed = new Date(dateText);
    return isNaN(parsed.getTime()) ? null : parsed;
  }).filter(function(d) { return d !== null; });

  return {
    hasReplyAttribution: attributionMatches.length > 0,
    embeddedDateCount: embeddedDateMatches.length,
    embeddedDates: embeddedDates
  };
}

function isQuotedEchoEvent_(event, siblingEvents) {
  const signals = getQuotedEchoSignals_(event);

  if (signals.hasReplyAttribution || signals.embeddedDateCount >= 2) {
    return true;
  }

  if (!siblingEvents || !siblingEvents.length) {
    return false;
  }

  const eventTimestamp = normalizeRawTimelineDate_(event.Event_Date || event.Created_At);
  if (!eventTimestamp) {
    return false;
  }

  return siblingEvents.some(function(sibling) {
    if (sibling === event) {
      return false;
    }

    const siblingTimestamp = normalizeRawTimelineDate_(sibling.Event_Date || sibling.Created_At);
    if (siblingTimestamp !== eventTimestamp) {
      return false;
    }

    const siblingSignals = getQuotedEchoSignals_(sibling);
    return siblingSignals.hasReplyAttribution || siblingSignals.embeddedDateCount >= 2;
  });
}

/**
 * For a row flagged as a quoted echo, its embedded "On <date>" attribution
 * is a better estimate of the fragment's true origin than the batch-import
 * timestamp stored on the row. Falls back to the stored date when no
 * embedded date is present (e.g. a same-batch sibling flagged only via the
 * timestamp-cluster rule).
 */
function getGenuineEffectiveDate_(event) {
  const signals = getQuotedEchoSignals_(event);

  if (signals.embeddedDates.length) {
    const mostRecentEmbedded = signals.embeddedDates.reduce(function(latest, d) {
      return (!latest || d.getTime() > latest.getTime()) ? d : latest;
    }, null);

    if (mostRecentEmbedded) {
      return mostRecentEmbedded.toISOString();
    }
  }

  return normalizeRawTimelineDate_(event.Event_Date || event.Created_At);
}

function deriveRawTimelineActivityType_(event) {
  const text = getRawTimelineText_(event);

  if (text.indexOf('MONITOR') !== -1) {
    return 'Monitoring';
  }

  if (
    text.indexOf('MITIGATION') !== -1 ||
    text.indexOf('DEMO') !== -1 ||
    text.indexOf('DRYWALL') !== -1 ||
    text.indexOf('FLOOD CUT') !== -1 ||
    text.indexOf('EQUIPMENT') !== -1 ||
    text.indexOf('INSPECTED LOSS') !== -1 ||
    text.indexOf('FIELD') !== -1
  ) {
    return 'Field Work';
  }

  if (
    text.indexOf('REVISION') !== -1 ||
    text.indexOf('REVISIONS REQUESTED') !== -1 ||
    text.indexOf('PLEASE REVIEW FOR REVISIONS') !== -1 ||
    text.indexOf('REQUESTED BELOW') !== -1
  ) {
    return 'Revision';
  }

  if (
    text.indexOf('REVIEW ACCEPTED') !== -1 ||
    text.indexOf('ESTIMATE') !== -1 ||
    text.indexOf('SUPPLEMENT') !== -1 ||
    text.indexOf('CARRIER') !== -1 ||
    text.indexOf('ADJUSTER') !== -1 ||
    text.indexOf('EMS:') !== -1
  ) {
    return 'Insurance Review';
  }

  if (
    text.indexOf('PAYMENT') !== -1 ||
    text.indexOf('PAID') !== -1 ||
    text.indexOf('CHECK') !== -1 ||
    text.indexOf('REMITTANCE') !== -1
  ) {
    return 'Payment';
  }

  if (
    text.indexOf('INTAKE') !== -1 ||
    text.indexOf('ASSIGNMENT') !== -1 ||
    text.indexOf('CUSTOMER CONTACT') !== -1 ||
    text.indexOf('SCHEDULE') !== -1
  ) {
    return 'Intake';
  }

  return 'General';
}

function deriveRawTimelineActivityLabel_(activityType, event) {
  if (activityType === 'Monitoring') return 'Monitoring Activity';
  if (activityType === 'Field Work') return 'Field Work Activity';
  if (activityType === 'Revision') return 'Revision Activity';
  if (activityType === 'Insurance Review') return 'Insurance Review Activity';
  if (activityType === 'Payment') return 'Payment Activity';
  if (activityType === 'Intake') return 'Intake Activity';

  return event.Event_Type || 'Timeline Activity';
}

function deriveRawTimelinePriority_(activityType, event) {
  if (activityType === 'Revision') return 'high';
  if (activityType === 'Payment') return 'high';
  if (activityType === 'Field Work') return 'normal';
  if (activityType === 'Insurance Review') return 'normal';
  return 'low';
}

function isRawTimelineActivityMeaningful_(activityType, event) {
  if (activityType !== 'General') {
    return true;
  }

  const text = getRawTimelineText_(event);
  return text.length > 120;
}

function normalizeRawTimelineDate_(dateValue) {
  if (!dateValue) {
    return null;
  }

  const parsed = new Date(dateValue);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function getRawTimelineText_(event) {
  return [
    event.Event_Type || '',
    event.Event_Source || '',
    event.Source_System || '',
    event.Summary || '',
    event.Detail || '',
    event.Related_Workflow || '',
    event.Visibility || ''
  ].join(' | ').toUpperCase();
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
          Summary: 'Missing EOJ',
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


function testSynthesizeKnownClaimActivities() {
  const claimId = 'CLM-26A-0034-WTR';
  const result = synthesizeClaimActivities(claimId);

  const response = successResponse({
    claimId: claimId,
    activityCount: result.success ? result.data.activityCount : 0,
    sampleActivity: result.success && result.data.activities.length ? result.data.activities[0] : null,
    result: result
  }, 'Known claim activity synthesis tested.');

  Logger.log(JSON.stringify(response, null, 2));
  return response;
}

function shouldUseRawTimelineFallback_(synthesizedActivities) {
  if (!synthesizedActivities || synthesizedActivities.length === 0) {
    return true;
  }

  return synthesizedActivities.every(function(activity) {
    const activityType = String(activity.activityType || '').trim();
    const isMeaningful = activity.isMeaningful === true;

    return activityType === 'General' && !isMeaningful;
  });
}