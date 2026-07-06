function createOrSkipCalendarDraft_(claimData, folderResult, thread) {
  const result = {
    enabled: INTAKE_CONFIG.calendar && INTAKE_CONFIG.calendar.enabled === true,
    success: true,
    skipped: false,
    duplicate: false,
    eventId: '',
    eventTitle: '',
    eventStart: '',
    eventEnd: '',
    status: 'calendar_disabled',
    message: '',
    error: ''
  };

  if (!result.enabled) {
    result.skipped = true;
    result.message = 'Calendar creation is disabled.';
    return result;
  }

  try {
    const calendar = CalendarApp.getCalendarById(INTAKE_CONFIG.calendar.calendarId);

    if (!calendar) {
      result.success = false;
      result.status = 'calendar_not_found';
      result.error = 'Calendar not found: ' + INTAKE_CONFIG.calendar.calendarId;
      return result;
    }

    const claimNumber = String(claimData.claimNumber || '').trim();
    const customerName = String(claimData.customerName || claimData.insuredName || '').trim();

    if (!claimNumber || !customerName) {
      result.success = false;
      result.status = 'missing_calendar_required_fields';
      result.error = 'Missing customer name or claim number.';
      return result;
    }

    const eventTitle = buildInsuranceCalendarTitle_(claimData);
    result.eventTitle = eventTitle;

    const sourceDate = getCalendarDraftSourceDate_(thread);
    const startTime = new Date(sourceDate);
    startTime.setHours(INTAKE_CONFIG.calendar.startHour || 6, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + (INTAKE_CONFIG.calendar.durationHours || 1), 0, 0, 0);

    result.eventStart = startTime;
    result.eventEnd = endTime;

    const duplicateSearchStart = new Date(startTime);
    duplicateSearchStart.setDate(duplicateSearchStart.getDate() - (INTAKE_CONFIG.calendar.duplicateSearchDays || 30));

    const duplicateSearchEnd = new Date(startTime);
    duplicateSearchEnd.setDate(duplicateSearchEnd.getDate() + (INTAKE_CONFIG.calendar.duplicateSearchDays || 30));

    const duplicateEvents = calendar.getEvents(duplicateSearchStart, duplicateSearchEnd, {
      search: claimNumber
    }) || [];

    if (duplicateEvents.length > 0) {
      result.skipped = true;
      result.duplicate = true;
      result.status = 'calendar_duplicate_skipped';
      result.message = 'Calendar event already exists for claim ' + claimNumber + '.';
      return result;
    }

    if (INTAKE_CONFIG.dryRun) {
      result.skipped = true;
      result.status = 'dry_run_calendar_skipped';
      result.message = 'Dry run skipped calendar event creation.';
      return result;
    }

    const description = buildInsuranceCalendarDescription_(claimData, folderResult, thread);

    const event = calendar.createEvent(eventTitle, startTime, endTime, {
      description: description,
      location: claimData.lossAddress || ''
    });

    sendInsuranceCalendarReminderEmail_(claimData, eventTitle, startTime, folderResult);

    result.eventId = event.getId ? event.getId() : '';
    result.status = 'calendar_event_created';
    result.message = 'Created calendar event for claim ' + claimNumber + '.';

    return result;
  } catch (error) {
    result.success = false;
    result.status = 'calendar_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function buildInsuranceCalendarTitle_(claimData) {
  const customerName = String(claimData.customerName || claimData.insuredName || '').trim();
  const carrierAbbrev = getInsuranceCalendarCarrierAbbrev_(claimData);
  const lossInfo = classifyInsuranceCalendarLoss_(claimData);

  return '[DRAFT] ' + customerName.toUpperCase() + ' - ' + carrierAbbrev + ' - ' + lossInfo.emoji;
}

function buildInsuranceCalendarDescription_(claimData, folderResult, thread) {
  const lossInfo = classifyInsuranceCalendarLoss_(claimData);
  const lines = [
    'CLAIM DETAILS',
    '=============',
    '',
    'Claim #: ' + (claimData.claimNumber || ''),
    'Insured: ' + (claimData.customerName || claimData.insuredName || ''),
    'Phone: ' + (claimData.phone || ''),
    'Email: ' + (claimData.email || ''),
    'Loss Category: ' + lossInfo.category,
    'Loss Type: ' + (claimData.typeOfLoss || claimData.lossType || ''),
    'Date of Loss: ' + (claimData.dateOfLoss || ''),
    'Property: ' + (claimData.lossAddress || claimData.propertyAddress || ''),
    'Loss: ' + (claimData.lossDescription || ''),
    '',
    'Claim Folder:',
    folderResult && folderResult.folderUrl ? folderResult.folderUrl : '',
    '',
    'Thread ID: ' + (thread && thread.getId ? thread.getId() : '')
  ];

  if (claimData.claimxperienceLink || claimData.claimLink) {
    lines.push('', 'Claim Link:', claimData.claimxperienceLink || claimData.claimLink);
  }

  return lines.join('\n');
}

function getCalendarDraftSourceDate_(thread) {
  try {
    if (!thread || !thread.getMessages || typeof thread.getMessages !== 'function') {
      return new Date();
    }

    const messages = thread.getMessages() || [];

    if (messages.length === 0) {
      return new Date();
    }

    return messages[messages.length - 1].getDate() || new Date();
  } catch (error) {
    return new Date();
  }
}

function getInsuranceCalendarCarrierAbbrev_(claimData) {
  let carrierName = String(claimData.carrierAbbrev || claimData.carrier || claimData.carrierName || claimData.insuranceCarrier || '').trim();

  if (!carrierName) {
    return 'INS';
  }

  const abbrevs = {
    allstate: 'AS',
    'state farm': 'SF',
    geico: 'GEICO',
    progressive: 'PROG',
    'liberty mutual': 'LM',
    amica: 'AMICA',
    farmers: 'FARM',
    nationwide: 'NW',
    usaa: 'USAA',
    travelers: 'TRAV'
  };

  const lower = carrierName.toLowerCase();

  Object.keys(abbrevs).forEach(function(key) {
    if (lower.indexOf(key) !== -1) {
      carrierName = abbrevs[key];
    }
  });

  if (carrierName.length <= 6 && carrierName === carrierName.toUpperCase()) {
    return carrierName;
  }

  return carrierName
    .split(' ')
    .filter(Boolean)
    .map(function(word) {
      return word[0];
    })
    .join('')
    .toUpperCase()
    .substring(0, 3) || 'INS';
}

function classifyInsuranceCalendarLoss_(claimData) {
  const primaryText = [
    claimData.typeOfLoss,
    claimData.lossType,
    claimData.lossDescription,
    claimData.subject
  ].filter(Boolean).join(' ').toLowerCase();

  const moldWords = ['mold', 'mould', 'fungal', 'fungus', 'microbial', 'mildew'];
  const waterWords = [
    'water', 'plumbing', 'pipe', 'flood', 'leak', 'burst',
    'toilet', 'supply line', 'drain', 'sewer', 'roof leak',
    'dishwasher', 'washing machine', 'water heater', 'fridge', 'refrigerator'
  ];
  const fireWords = [
    'fire', 'smoke', 'soot', 'burn', 'burned',
    'electrical fire', 'kitchen fire', 'grease fire'
  ];

  if (containsInsuranceCalendarWord_(primaryText, waterWords)) {
    return { category: 'Water', emoji: '💧' };
  }

  if (containsInsuranceCalendarWord_(primaryText, fireWords)) {
    return { category: 'Fire', emoji: '🔥' };
  }

  if (containsInsuranceCalendarWord_(primaryText, moldWords)) {
    return { category: 'Mold', emoji: '🦠' };
  }

  return { category: 'Unknown', emoji: 'ℹ️' };
}

function containsInsuranceCalendarWord_(text, words) {
  return words.some(function(word) {
    return String(text || '').indexOf(word) !== -1;
  });
}

function sendInsuranceCalendarReminderEmail_(claimData, eventTitle, startTime, folderResult) {
  try {
    if (INTAKE_CONFIG.calendar && INTAKE_CONFIG.calendar.reminderEmailEnabled === false) {
      return;
    }

    const userEmail = Session.getActiveUser().getEmail();

    if (!userEmail) {
      return;
    }

    const lossInfo = classifyInsuranceCalendarLoss_(claimData);
    const subject = '⏰ Set Calendar Time: ' + eventTitle;
    let body = 'A new calendar draft event has been created:\n\n';

    body += 'Event: ' + eventTitle + '\n';
    body += 'Created: ' + formatInsuranceCalendarDate_(startTime) + '\n';
    body += 'Date of Loss: ' + (claimData.dateOfLoss || 'N/A') + '\n';
    body += 'Claim #: ' + (claimData.claimNumber || 'N/A') + '\n';
    body += 'Insured: ' + (claimData.customerName || claimData.insuredName || 'N/A') + '\n';
    body += 'Phone: ' + (claimData.phone || 'N/A') + '\n';
    body += 'Loss Category: ' + lossInfo.category + '\n\n';
    body += 'ACTION REQUIRED:\n';
    body += 'Please open your calendar and set the time for this appointment.\n\n';
    body += 'Event Details:\n';
    body += '- Property: ' + (claimData.lossAddress || claimData.propertyAddress || 'N/A') + '\n';
    body += '- Loss Type: ' + (claimData.typeOfLoss || claimData.lossType || 'N/A') + '\n';
    body += '- Loss Description: ' + (claimData.lossDescription || 'N/A') + '\n';

    if (folderResult && folderResult.folderUrl) {
      body += '\nClaim Folder:\n' + folderResult.folderUrl + '\n';
    }

    if (claimData.claimxperienceLink || claimData.claimLink) {
      body += '\nLink:\n' + (claimData.claimxperienceLink || claimData.claimLink) + '\n';
    }

    GmailApp.sendEmail(userEmail, subject, body);
  } catch (error) {
    Logger.log('ERROR sending calendar reminder email: ' + (error && error.message ? error.message : error.toString()));
  }
}

function formatInsuranceCalendarDate_(date) {
  if (!date || !(date instanceof Date)) {
    return 'N/A';
  }

  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
}

