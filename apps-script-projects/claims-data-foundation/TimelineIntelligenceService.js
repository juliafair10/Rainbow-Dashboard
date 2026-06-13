

/**
 * Phase 8.5F
 * Timeline Intelligence Service
 *
 * Initial goal:
 * Classify Timeline_Events from generic Note into operational event types.
 */

function testTimelineEventClassificationSample() {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Timeline_Events');

  if (!sheet) {
    throw new Error('Missing sheet: Timeline_Events');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 3) {
    Logger.log('No Timeline_Events records found.');
    return;
  }

  const sampleSize = Math.min(25, lastRow - 2);
  const rows = sheet.getRange(3, 1, sampleSize, 10).getValues();

  rows.forEach(function(row, index) {
    const summary = String(row[7] || '').trim();
    const details = String(row[8] || '').trim();
    const classification = classifyTimelineEventText_(summary, details);

    Logger.log(
      'Sample ' + (index + 1) +
      ' | Job: ' + row[2] +
      ' | Type: ' + classification.eventType +
      ' | Signal: ' + classification.signal +
      ' | Summary: ' + summary
    );
  });
}

function testClassifyTimelineEvents() {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Timeline_Events');

  if (!sheet) {
    throw new Error('Missing sheet: Timeline_Events');
  }

  const result = classifyTimelineEvents_(sheet);

  Logger.log('Timeline events classified: ' + result.updatedCount);
  Logger.log('Classification counts: ' + JSON.stringify(result.counts));
}

function classifyTimelineEvents_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 3) {
    return {
      updatedCount: 0,
      counts: {}
    };
  }

  const values = sheet.getRange(3, 1, lastRow - 2, 10).getValues();
  const counts = {};
  let updatedCount = 0;

  values.forEach(function(row) {
    const summary = String(row[7] || '').trim();
    const details = String(row[8] || '').trim();
    const classification = classifyTimelineEventText_(summary, details);

    row[5] = classification.eventType;
    counts[classification.eventType] = (counts[classification.eventType] || 0) + 1;
    updatedCount++;
  });

  sheet.getRange(3, 1, values.length, values[0].length).setValues(values);

  return {
    updatedCount: updatedCount,
    counts: counts
  };
}

function classifyTimelineEventText_(summary, details) {
  const text = normalizeTimelineText_([summary, details].join(' '));

  if (matchesAny_(text, [
    'payment',
    'paid',
    'check',
    'issued payment',
    'payment issued',
    'manual payment',
    'recoverable depreciation',
    'deductible',
    'invoice',
    'supplement payment',
    'received funds'
  ])) {
    return buildTimelineClassification_('Payment Activity', 'Financial movement or payment-related note');
  }

  if (matchesAny_(text, [
    'carrier',
    'adjuster',
    'examiner',
    'desk adjuster',
    'field adjuster',
    'allstate',
    'state farm',
    'usaa',
    'travelers',
    'farmers',
    'liberty mutual',
    'claim rep',
    'coverage',
    'approved',
    'approval',
    'denied',
    'denial',
    'estimate approval',
    'reviewed estimate approval',
    'review accepted'
  ])) {
    return buildTimelineClassification_('Carrier Activity', 'Insurance carrier or coverage-related note');
  }

  if (matchesAny_(text, [
    'insured',
    'homeowner',
    'customer',
    'client',
    'spoke with',
    'spoke to',
    'called',
    'left voicemail',
    'left vm',
    'emailed customer',
    'emailed insured',
    'texted',
    'customer advised',
    'homeowner advised',
    'customer contacted',
    'datecustomercontacted',
    'date customer contacted'
  ])) {
    return buildTimelineClassification_('Customer Contact', 'Customer communication or contact note');
  }

  if (matchesAny_(text, [
    'revision',
    'revise',
    'revised',
    'supplement',
    'estimate update',
    'estimate updated',
    'xactimate',
    'xact',
    'symbility',
    'clarence',
    'estimating',
    'estimate sent',
    'estimate submitted'
  ])) {
    return buildTimelineClassification_('Revision Activity', 'Estimate, supplement, or revision activity');
  }

  if (matchesAny_(text, [
    'scheduled',
    'schedule',
    'appointment',
    'appt',
    'calendar',
    'site visit',
    'inspection scheduled',
    'monitor scheduled',
    'return visit',
    'rescheduled',
    'target completion date'
  ])) {
    return buildTimelineClassification_('Scheduling Activity', 'Scheduling or appointment-related note');
  }

  if (matchesAny_(text, [
    'mitigation',
    'demo',
    'demolition',
    'drying',
    'dry out',
    'monitor',
    'equipment',
    'dehumidifier',
    'air mover',
    'moisture',
    'moisture reading',
    'site inspected',
    'inspection',
    'photos',
    'containment',
    'asbestos',
    'itel',
    'sample',
    'branch',
    'emsl',
    'dateworkstarted',
    'date work started',
    'leak',
    'water line',
    'water pipe',
    'water damage',
    'mold',
    'hvac',
    'cabinet analysis'
  ])) {
    return buildTimelineClassification_('Field Activity', 'Field work, inspection, mitigation, or vendor activity');
  }

  if (matchesAny_(text, [
    'uploaded',
    'upload',
    'document',
    'documents',
    'photos uploaded',
    'photos added',
    'forms',
    'signed',
    'cos',
    'certificate of completion',
    'esa',
    'contract',
    'email sent',
    'file notes',
    'note added',
    'plnar project',
    'portal link',
    'claimxperience link',
    'reviewer assigned'
  ])) {
    return buildTimelineClassification_('Documentation Activity', 'Document, photo, form, or file activity');
  }

  if (matchesAny_(text, [
    'system',
    'automated',
    'auto',
    'imported',
    'created by',
    'status changed',
    'task created',
    'task completed',
    'job was accepted',
    'office contacted',
    'office will accept',
    'assignment creation',
    'pending acceptance',
    'dispatched to rainbow'
  ])) {
    return buildTimelineClassification_('System Activity', 'System-generated or administrative activity');
  }

  return buildTimelineClassification_('Other', 'No specific operational category matched');
}

function normalizeTimelineText_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAny_(text, terms) {
  return terms.some(function(term) {
    return text.indexOf(String(term).toLowerCase()) !== -1;
  });
}

function buildTimelineClassification_(eventType, signal) {
  return {
    eventType: eventType,
    signal: signal
  };
}