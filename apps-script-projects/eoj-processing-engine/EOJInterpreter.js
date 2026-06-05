
function interpretBasicEOJ_(parsed, row, runId) {
  const outputId = Utilities.getUuid();
  const processedAt = new Date();

  const technician = firstNonBlank_(
    getNestedValue_(parsed, ['technician']),
    getNestedValue_(parsed, ['Technician']),
    getNestedValue_(parsed, ['submittedBy']),
    row.technician
  );

  const jobName = firstNonBlank_(
    getNestedValue_(parsed, ['jobName']),
    getNestedValue_(parsed, ['Job_Name']),
    getNestedValue_(parsed, ['job', 'name']),
    row.jobName
  );

  const claimNumber = firstNonBlank_(
    getNestedValue_(parsed, ['claimNumber']),
    getNestedValue_(parsed, ['Claim_Number']),
    getNestedValue_(parsed, ['claim', 'number']),
    row.claimNumber
  );

  const customerName = firstNonBlank_(
    getNestedValue_(parsed, ['customerName']),
    getNestedValue_(parsed, ['Customer_Name']),
    getNestedValue_(parsed, ['customer', 'name']),
    row.customerName
  );

  const propertyAddress = firstNonBlank_(
    getNestedValue_(parsed, ['propertyAddress']),
    getNestedValue_(parsed, ['Property_Address']),
    getNestedValue_(parsed, ['property', 'address']),
    row.propertyAddress
  );

  const visitDate = firstNonBlank_(
    getNestedValue_(parsed, ['visitDate']),
    getNestedValue_(parsed, ['Visit_Date']),
    getNestedValue_(parsed, ['visit', 'date']),
    row.visitDate
  );

  const visitType = firstNonBlank_(
    getNestedValue_(parsed, ['visitType']),
    getNestedValue_(parsed, ['Visit_Type']),
    getNestedValue_(parsed, ['visit', 'type']),
    row.visitType
  );

  const reviewReasons = [];
  if (!jobName) reviewReasons.push('Missing job name');
  if (!claimNumber) reviewReasons.push('Missing claim number');

  const timelineEvent = {
    event_type: 'EOJ Submitted',
    source: 'EOJ_Log',
    eoj_id: row.eojId,
    technician,
    job_name: jobName,
    claim_number: claimNumber,
    customer_name: customerName,
    property_address: propertyAddress,
    visit_date: stringifyDateSafe_(visitDate),
    visit_type: visitType,
    created_at: processedAt.toISOString()
  };

  const conditionOutput = buildConditionOutput_(parsed);
  const alertOutput = buildAlertOutput_(parsed, reviewReasons);
  const followUpOutput = buildFollowUpOutput_(parsed);
  const equipmentOutput = buildEquipmentOutput_(parsed);
  const reviewOutput = {
    review_needed: reviewReasons.length > 0,
    reasons: reviewReasons
  };

  return {
    outputId,
    eojId: row.eojId,
    runId,
    processedAt,
    technician,
    jobName,
    claimNumber,
    customerName,
    propertyAddress,
    visitDate,
    visitType,
    timelineEvent,
    conditionOutput,
    alertOutput,
    followUpOutput,
    equipmentOutput,
    reviewOutput,
    rawParsed: parsed,
    status: CONFIG.STATUS.PROCESSED,
    notes: 'Session 1 basic EOJ interpretation completed.'
  };
}

function buildConditionOutput_(parsed) {
  return {
    monitoring_active: booleanFromAny_(
      getNestedValue_(parsed, ['monitoringActive']),
      getNestedValue_(parsed, ['monitoring', 'active'])
    ),
    asbestos_testing_pending: booleanFromAny_(
      getNestedValue_(parsed, ['asbestosTestNeeded']),
      getNestedValue_(parsed, ['asbestos', 'testNeeded']),
      getNestedValue_(parsed, ['asbestos', 'testingNeeded'])
    ),
    itel_sample_needed: booleanFromAny_(
      getNestedValue_(parsed, ['itelSampleNeeded']),
      getNestedValue_(parsed, ['itel', 'sampleNeeded'])
    )
  };
}

function buildAlertOutput_(parsed, reviewReasons) {
  return {
    review_needed: reviewReasons.length > 0,
    missing_claim_number: reviewReasons.includes('Missing claim number'),
    missing_job_name: reviewReasons.includes('Missing job name'),
    missing_eoj_payload: !parsed
  };
}

function buildFollowUpOutput_(parsed) {
  const followUps = firstNonBlank_(
    getNestedValue_(parsed, ['followUps']),
    getNestedValue_(parsed, ['follow_ups']),
    getNestedValue_(parsed, ['followUp']),
    []
  );

  return {
    follow_ups: Array.isArray(followUps) ? followUps : [followUps]
  };
}

function buildEquipmentOutput_(parsed) {
  const equipment = firstNonBlank_(
    getNestedValue_(parsed, ['equipment']),
    getNestedValue_(parsed, ['equipmentItems']),
    getNestedValue_(parsed, ['equipment', 'items']),
    []
  );

  return {
    equipment_items: Array.isArray(equipment) ? equipment : [equipment]
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
    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim();
      if (['yes', 'true', 'needed', 'required', 'active'].includes(normalized)) return true;
    }
  }
  return false;
}

function stringifyDateSafe_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return value || '';
}