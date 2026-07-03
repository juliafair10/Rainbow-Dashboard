function interpretBasicEOJ_(parsed, row, runId) {
  const outputId = Utilities.getUuid();
  const processedAt = new Date();

  const base = buildBaseEOJContext_(parsed, row, processedAt);
  const equipmentOutput = buildEquipmentOutput_(parsed);
  const followUpOutput = buildFollowUpOutput_(parsed);
  const monitoringOutput = buildMonitoringOutput_(parsed);
  const asbestosOutput = buildAsbestosOutput_(parsed);
  const itelOutput = buildItelOutput_(parsed);
  const micaOutput = buildMicaOutput_(parsed);
  const jobStatusOutput = buildJobStatusOutput_(parsed);
  const reviewOutput = buildReviewOutput_(base, followUpOutput, asbestosOutput, itelOutput, monitoringOutput);
  const conditionOutput = buildConditionOutput_(monitoringOutput, asbestosOutput, itelOutput, parsed);
  const alertOutput = buildAlertOutput_(reviewOutput, followUpOutput, asbestosOutput, itelOutput);
  const timelineEvent = buildTimelineEvents_(base, parsed, equipmentOutput, followUpOutput, monitoringOutput, asbestosOutput, itelOutput, micaOutput);
  const operationalObjects = buildOperationalObjects_(base, timelineEvent, conditionOutput, alertOutput, followUpOutput, equipmentOutput, reviewOutput);

  return {
    outputId,
    eojId: row.eojId,
    runId,
    processedAt,
    technician: base.technician,
    jobName: base.jobName,
    claimNumber: base.claimNumber,
    claimId: base.claimId,
    customerName: base.customerName,
    propertyAddress: base.propertyAddress,
    visitDate: base.visitDate,
    visitType: base.visitType,
    timelineEvent,
    conditionOutput,
    alertOutput,
    followUpOutput,
    equipmentOutput,
    reviewOutput,
    micaOutput,
    jobStatusOutput,
    monitoringOutput,
    operationalObjects,
    rawParsed: parsed,
    status: CONFIG.STATUS.PROCESSED,
    notes: 'Phase 3.5 — EOJ Integration Hardening.'
  };
}

function buildBaseEOJContext_(parsed, row, processedAt) {
  return {
    eojId: row.eojId,
    processedAt,
    technician: firstNonBlank_(
      getNestedValue_(parsed, ['technician']),
      getNestedValue_(parsed, ['Technician']),
      getNestedValue_(parsed, ['submittedBy']),
      row.technician
    ),
    jobName: firstNonBlank_(
      getNestedValue_(parsed, ['jobName']),
      getNestedValue_(parsed, ['Job_Name']),
      getNestedValue_(parsed, ['job', 'name']),
      row.jobName
    ),
    claimNumber: firstNonBlank_(
      getNestedValue_(parsed, ['claimNumber']),
      getNestedValue_(parsed, ['Claim_Number']),
      getNestedValue_(parsed, ['claim', 'number']),
      row.claimNumber
    ),
    claimId: firstNonBlank_(
      getNestedValue_(parsed, ['claimId']),
      getNestedValue_(parsed, ['Claim_ID']),
      row.claimId
    ),
    customerName: firstNonBlank_(
      getNestedValue_(parsed, ['customerName']),
      getNestedValue_(parsed, ['Customer_Name']),
      getNestedValue_(parsed, ['customer', 'name']),
      row.customerName
    ),
    propertyAddress: firstNonBlank_(
      getNestedValue_(parsed, ['propertyAddress']),
      getNestedValue_(parsed, ['Property_Address']),
      getNestedValue_(parsed, ['property', 'address']),
      row.propertyAddress
    ),
    visitDate: firstNonBlank_(
      getNestedValue_(parsed, ['visitDate']),
      getNestedValue_(parsed, ['Visit_Date']),
      getNestedValue_(parsed, ['visit', 'date']),
      row.visitDate
    ),
    visitType: firstNonBlank_(
      getNestedValue_(parsed, ['visitType']),
      getNestedValue_(parsed, ['Visit_Type']),
      getNestedValue_(parsed, ['visit', 'type']),
      row.visitType
    )
  };
}

function buildTimelineEvents_(base, parsed, equipmentOutput, followUpOutput, monitoringOutput, asbestosOutput, itelOutput, micaOutput) {
  const events = [];

  // Phase F: Always write 'EOJ Submitted' as the canonical entry event.
  // HomepageDataService.buildHomepageRecentActivity_() filters for this type —
  // without it, inspection/monitoring visits never appear in Homepage Recent Activity.
  events.push(buildTimelineEvent_(base, 'EOJ Submitted', {
    visit_type:      base.visitType,
    job_status:      getNestedValue_(parsed, ['jobStatus']),
    work_performed:  getNestedValue_(parsed, ['workPerformed']),
    field_work_complete: booleanFromAny_(getNestedValue_(parsed, ['fieldWorkComplete']))
  }));

  // Visit-specific event — preserves full field detail separate from the entry event.
  events.push(buildTimelineEvent_(base, normalizeVisitEventType_(base.visitType), {
    work_performed:      getNestedValue_(parsed, ['workPerformed']),
    technician_notes:    getNestedValue_(parsed, ['technicianNotes']),
    other_visit_notes:   getNestedValue_(parsed, ['otherVisitNotes']),
    remaining_work:      getNestedValue_(parsed, ['remainingWork']),
    field_work_complete: booleanFromAny_(getNestedValue_(parsed, ['fieldWorkComplete']))
  }));

  if (booleanFromAny_(getNestedValue_(parsed, ['demoPerformed']))) {
    events.push(buildTimelineEvent_(base, 'Demo Performed', {
      work_performed: getNestedValue_(parsed, ['workPerformed'])
    }));
  }

  if (equipmentOutput.has_equipment_activity) {
    events.push(buildTimelineEvent_(base, 'Equipment Updated', equipmentOutput));
  }

  if (equipmentOutput.equipment_pickup_complete) {
    events.push(buildTimelineEvent_(base, 'Equipment Pickup Completed', equipmentOutput));
  }

  if (monitoringOutput.next_monitoring_required || monitoringOutput.monitoring_status || monitoringOutput.monitoring_notes) {
    events.push(buildTimelineEvent_(base, 'Monitoring Updated', monitoringOutput));
  }

  // Phase C: MICA/Mitigate timeline event — written whenever MICA activity is reported.
  if (micaOutput && micaOutput.has_mica_activity) {
    events.push(buildTimelineEvent_(base, 'Mitigate Status Updated', micaOutput));
  }

  if (followUpOutput.follow_up_required) {
    events.push(buildTimelineEvent_(base, 'Follow-Up Requested', followUpOutput));
  }

  if (asbestosOutput.testing_required) {
    events.push(buildTimelineEvent_(base, 'Asbestos Testing Requested', asbestosOutput));
  }

  if (asbestosOutput.samples_taken) {
    events.push(buildTimelineEvent_(base, 'Asbestos Samples Taken', asbestosOutput));
  }

  if (itelOutput.sample_required) {
    events.push(buildTimelineEvent_(base, 'Itel Sample Required', itelOutput));
  }

  return {
    event_count: events.length,
    primary_event_type: 'EOJ Submitted',
    events
  };
}

function buildTimelineEvent_(base, eventType, details) {
  return {
    event_type: eventType,
    source: 'EOJ_Log',
    eoj_id: base.eojId,
    technician: base.technician,
    job_name: base.jobName,
    claim_number: base.claimNumber,
    claim_id: base.claimId,
    customer_name: base.customerName,
    property_address: base.propertyAddress,
    visit_date: stringifyDateSafe_(base.visitDate),
    visit_type: base.visitType,
    created_at: base.processedAt.toISOString(),
    details: details || {}
  };
}

function buildOperationalObjects_(base, timelineEvent, conditionOutput, alertOutput, followUpOutput, equipmentOutput, reviewOutput) {
  const objects = [];

  timelineEvent.events.forEach(event => {
    objects.push(buildOperationalObject_(base, 'timeline_event', event.event_type, event.details, {
      source_event_type: event.event_type,
      confidence: 1
    }));
  });

  Object.keys(conditionOutput).forEach(conditionKey => {
    const conditionValue = conditionOutput[conditionKey];
    if (conditionValue === true) {
      objects.push(buildOperationalObject_(base, 'condition', conditionKey, {
        active: true,
        condition_key: conditionKey
      }, {
        confidence: 1
      }));
    }
  });

  if (alertOutput.follow_up_required) {
    objects.push(buildOperationalObject_(base, 'alert', 'Follow-Up Required', followUpOutput, {
      severity: 'attention',
      confidence: 1
    }));
  }

  if (alertOutput.asbestos_attention_needed) {
    objects.push(buildOperationalObject_(base, 'alert', 'Asbestos Attention Needed', {
      asbestos_attention_needed: true
    }, {
      severity: 'attention',
      confidence: 1
    }));
  }

  if (alertOutput.itel_attention_needed) {
    objects.push(buildOperationalObject_(base, 'alert', 'Itel Attention Needed', {
      itel_attention_needed: true
    }, {
      severity: 'attention',
      confidence: 1
    }));
  }

  if (equipmentOutput.has_equipment_activity) {
    objects.push(buildOperationalObject_(base, 'equipment_state_change', 'Equipment Updated', equipmentOutput, {
      confidence: 1
    }));
  }

  if (followUpOutput.follow_up_required) {
    objects.push(buildOperationalObject_(base, 'follow_up', 'Follow-Up Required', followUpOutput, {
      confidence: 1
    }));
  }

  if (reviewOutput.review_needed) {
    objects.push(buildOperationalObject_(base, 'review', 'EOJ Operational Review', reviewOutput, {
      severity: 'review',
      confidence: 1
    }));
  }

  return {
    object_count: objects.length,
    object_schema_version: 'EOJ_OPERATIONAL_OBJECTS_V1',
    objects
  };
}

function buildOperationalObject_(base, objectType, objectName, payload, options) {
  const safeOptions = options || {};

  return {
    object_id: Utilities.getUuid(),
    object_schema_version: 'RAINBOW_OPERATIONAL_OBJECT_V1',
    object_type: objectType,
    object_name: objectName,
    source_system: 'EOJ Processing Engine',
    source_type: 'EOJ',
    source_id: base.eojId,
    claim_number: base.claimNumber,
    claim_id: base.claimId,
    job_name: base.jobName,
    customer_name: base.customerName,
    property_address: base.propertyAddress,
    visit_date: stringifyDateSafe_(base.visitDate),
    visit_type: base.visitType,
    technician: base.technician,
    created_at: base.processedAt.toISOString(),
    confidence: safeOptions.confidence === undefined ? 1 : safeOptions.confidence,
    severity: safeOptions.severity || '',
    source_event_type: safeOptions.source_event_type || '',
    payload: payload || {}
  };
}

function normalizeVisitEventType_(visitType) {
  const normalized = String(visitType || '').toLowerCase().trim();

  if (normalized === 'inspection') return 'Inspection Completed';
  if (normalized === 'monitoring') return 'Monitoring Visit Completed';
  if (normalized === 'demo' || normalized === 'demolition') return 'Demo Visit Completed';
  if (normalized === 'pickup' || normalized === 'equipment pickup') return 'Equipment Pickup Visit Completed';
  if (normalized) return visitType + ' Completed';

  return 'EOJ Submitted';
}

function buildEquipmentOutput_(parsed) {
  const equipment = getNestedValue_(parsed, ['equipment', 'items']) || {};
  const equipmentBefore = {};
  const equipmentAdded = {};
  const equipmentRemoved = {};
  const equipmentAfter = {};

  Object.keys(equipment).forEach(key => {
    const item = equipment[key] || {};
    const label = item.label || key;

    equipmentBefore[key] = {
      label,
      count: numberFromAny_(item.onSiteBeforeVisit)
    };

    equipmentAdded[key] = {
      label,
      count: numberFromAny_(item.addedToday)
    };

    equipmentRemoved[key] = {
      label,
      count: numberFromAny_(item.removedToday)
    };

    equipmentAfter[key] = {
      label,
      count: numberFromAny_(item.onSiteAfterVisit)
    };
  });

  const totalAdded = sumEquipmentCounts_(equipmentAdded);
  const totalRemoved = sumEquipmentCounts_(equipmentRemoved);
  const totalAfter = sumEquipmentCounts_(equipmentAfter);
  const equipmentPickedUp = booleanFromAny_(getNestedValue_(parsed, ['equipmentPickedUp']));

  return {
    equipment_before: equipmentBefore,
    equipment_added: equipmentAdded,
    equipment_removed: equipmentRemoved,
    equipment_after: equipmentAfter,
    total_added: totalAdded,
    total_removed: totalRemoved,
    total_on_site_after_visit: totalAfter,
    equipment_still_needed: booleanFromAny_(getNestedValue_(parsed, ['equipmentStillNeeded'])),
    equipment_pickup_complete: equipmentPickedUp || (totalRemoved > 0 && totalAfter === 0),
    has_equipment_activity: totalAdded > 0 || totalRemoved > 0 || totalAfter > 0 || equipmentPickedUp,
    summary: firstNonBlank_(getNestedValue_(parsed, ['equipmentSummary']), getNestedValue_(parsed, ['equipment', 'notes']), '')
  };
}

function buildMonitoringOutput_(parsed) {
  return {
    next_monitoring_required: booleanFromAny_(getNestedValue_(parsed, ['nextMonitoringNeeded'])),
    next_monitoring_date: getNestedValue_(parsed, ['nextMonitoringDate']),
    next_monitoring_window: getNestedValue_(parsed, ['nextMonitoringWindow']),
    monitoring_status: getNestedValue_(parsed, ['monitoringStatus']),
    monitoring_notes: getNestedValue_(parsed, ['monitoringNotes']),
    monitoring_active: booleanFromAny_(getNestedValue_(parsed, ['nextMonitoringNeeded'])) || !!getNestedValue_(parsed, ['monitoringStatus'])
  };
}

function buildAsbestosOutput_(parsed) {
  const testNeeded = getNestedValue_(parsed, ['asbestosTestNeeded']);
  const samplesTaken = getNestedValue_(parsed, ['asbestosSamplesTaken']);

  return {
    testing_required: booleanFromAny_(testNeeded),
    handler: getNestedValue_(parsed, ['asbestosHandler']),
    samples_taken: booleanFromAny_(samplesTaken),
    sample_count: numberFromAny_(getNestedValue_(parsed, ['asbestosSampleCount'])),
    follow_up_description: getNestedValue_(parsed, ['asbestosFollowUpDescription'])
  };
}

function buildItelOutput_(parsed) {
  const flooringRemoved = booleanFromAny_(getNestedValue_(parsed, ['flooringRemoved']));
  const sampleStatus = getNestedValue_(parsed, ['itelSampleStatus']);

  return {
    flooring_removed: flooringRemoved,
    sample_required: flooringRemoved,
    sample_status: sampleStatus,
    notes: getNestedValue_(parsed, ['itelNotes'])
  };
}

function buildFollowUpOutput_(parsed) {
  return {
    follow_up_required: booleanFromAny_(getNestedValue_(parsed, ['followUpNeeded'])),
    assigned_to: getNestedValue_(parsed, ['followUpAssignedTo']),
    due_date: getNestedValue_(parsed, ['followUpDueDate']),
    description: getNestedValue_(parsed, ['followUpDescription']),
    waiting_on: getNestedValue_(parsed, ['waitingOn'])
  };
}

// Phase C: reads MICA/Mitigate status fields from the EOJ JSON payload.
// Internal field keys are 'MICA'; user-facing strings say 'Mitigate'.
function buildMicaOutput_(parsed) {
  var micaStatus      = getNestedValue_(parsed, ['micaStatus']);
  var delayReason     = getNestedValue_(parsed, ['micaDelayReason']);
  var expectedDate    = getNestedValue_(parsed, ['micaExpectedUpdateDate']);
  var planUpdated     = booleanFromAny_(getNestedValue_(parsed, ['mitigationPlanUpdated']));
  var planSummary     = getNestedValue_(parsed, ['mitigationPlanSummary']);

  return {
    mica_status:               micaStatus,
    mica_delay_reason:         delayReason,
    mica_expected_update_date: expectedDate,
    mitigation_plan_updated:   planUpdated,
    mitigation_plan_summary:   planSummary,
    // True when any MICA-related data was reported on this EOJ.
    has_mica_activity: !!(micaStatus || delayReason || planUpdated || planSummary || expectedDate)
  };
}

// Phase B: reads job status, work summary, and insurance summary from the EOJ JSON payload.
function buildJobStatusOutput_(parsed) {
  return {
    job_status:            getNestedValue_(parsed, ['jobStatus']),
    work_performed:        getNestedValue_(parsed, ['workPerformed']),
    for_insurance_summary: firstNonBlank_(
      getNestedValue_(parsed, ['forInsuranceSummary']),
      getNestedValue_(parsed, ['workSummaryForInsurance']),
      getNestedValue_(parsed, ['insuranceSummary'])
    )
  };
}

function buildConditionOutput_(monitoringOutput, asbestosOutput, itelOutput, parsed) {
  return {
    monitoring_active:        monitoringOutput.monitoring_active,
    next_monitoring_required: monitoringOutput.next_monitoring_required,
    asbestos_testing_pending: asbestosOutput.testing_required && !asbestosOutput.samples_taken,
    // Phase A: when samples are taken we're waiting on lab results — write that condition.
    waiting_on_lab_results:   asbestosOutput.samples_taken,
    itel_sample_needed:       itelOutput.sample_required,
    field_work_complete:      booleanFromAny_(getNestedValue_(parsed, ['fieldWorkComplete'])),
    equipment_still_needed:   booleanFromAny_(getNestedValue_(parsed, ['equipmentStillNeeded']))
  };
}

function buildAlertOutput_(reviewOutput, followUpOutput, asbestosOutput, itelOutput) {
  return {
    review_needed: reviewOutput.review_needed,
    follow_up_required: followUpOutput.follow_up_required,
    asbestos_attention_needed: asbestosOutput.testing_required,
    itel_attention_needed: itelOutput.sample_required,
    review_reasons: reviewOutput.reasons
  };
}

function buildReviewOutput_(base, followUpOutput, asbestosOutput, itelOutput, monitoringOutput) {
  const reasons = [];

  if (!base.jobName) reasons.push('Missing job name');
  if (!base.claimNumber) reasons.push('Missing claim number');
  if (!base.technician) reasons.push('Missing technician');
  if (!base.visitDate) reasons.push('Missing visit date');
  if (!base.visitType) reasons.push('Missing visit type');

  if (followUpOutput.follow_up_required && !followUpOutput.description) {
    reasons.push('Follow-up required but description is missing');
  }

  if (followUpOutput.follow_up_required && !followUpOutput.assigned_to) {
    reasons.push('Follow-up required but assigned person is missing');
  }

  if (followUpOutput.follow_up_required && !followUpOutput.due_date) {
    reasons.push('Follow-up required but due date is missing');
  }

  if (asbestosOutput.testing_required && !asbestosOutput.handler) {
    reasons.push('Asbestos testing required but handler is missing');
  }

  if (asbestosOutput.testing_required && asbestosOutput.handler === 'We are handling it' && !asbestosOutput.samples_taken && !asbestosOutput.follow_up_description) {
    reasons.push('Rainbow is handling asbestos testing but samples were not taken and no follow-up description was provided');
  }

  if (asbestosOutput.samples_taken && asbestosOutput.sample_count <= 0) {
    reasons.push('Asbestos samples marked taken but sample count is missing');
  }

  if (itelOutput.sample_required && !itelOutput.sample_status) {
    reasons.push('Flooring removed but Itel sample status is missing');
  }

  if (monitoringOutput.next_monitoring_required && !monitoringOutput.next_monitoring_date) {
    reasons.push('Next monitoring required but date is missing');
  }

  return {
    review_needed: reasons.length > 0,
    reasons,
    review_category: reasons.length > 0 ? 'EOJ Operational Review' : ''
  };
}

function getNestedValue_(object, path) {
  if (!object || !path || path.length === 0) {
    return '';
  }

  let current = object;
  for (let i = 0; i < path.length; i++) {
    if (current === null || current === undefined || current[path[i]] === undefined) {
      return '';
    }
    current = current[path[i]];
  }

  return current;
}

function firstNonBlank_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return '';
}

function booleanFromAny_() {
  for (let i = 0; i < arguments.length; i++) {
    const value = arguments[i];

    if (value === true) return true;
    if (typeof value === 'number') return value > 0;

    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim();
      if (['yes', 'true', 'needed', 'required', 'active', 'complete', 'completed'].includes(normalized)) return true;
      if (['no', 'false', 'not needed', 'not required', 'inactive'].includes(normalized)) return false;
    }
  }

  return false;
}

function numberFromAny_(value) {
  const numberValue = Number(value);
  return isNaN(numberValue) ? 0 : numberValue;
}

function sumEquipmentCounts_(equipmentMap) {
  return Object.keys(equipmentMap).reduce((sum, key) => {
    return sum + numberFromAny_(equipmentMap[key].count);
  }, 0);
}

function stringifyDateSafe_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return value || '';
}