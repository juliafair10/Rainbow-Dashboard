function createOrSkipCalendarDraft_(claimData, folderResult, thread) {
  const result = {
    enabled: CONFIG.calendar && CONFIG.calendar.enabled === true,
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
    const calendar = CalendarApp.getCalendarById(CONFIG.calendar.calendarId);

    if (!calendar) {
      result.success = false;
      result.status = 'calendar_not_found';
      result.error = 'Calendar not found: ' + CONFIG.calendar.calendarId;
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

    const startTime = new Date();
    startTime.setHours(CONFIG.calendar.startHour || 6, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + (CONFIG.calendar.durationHours || 1));

    result.eventStart = startTime;
    result.eventEnd = endTime;

    const duplicateSearchStart = new Date(startTime);
    duplicateSearchStart.setDate(duplicateSearchStart.getDate() - (CONFIG.calendar.duplicateSearchDays || 30));

    const duplicateSearchEnd = new Date(startTime);
    duplicateSearchEnd.setDate(duplicateSearchEnd.getDate() + (CONFIG.calendar.duplicateSearchDays || 30));

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

    if (CONFIG.dryRun) {
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
  const claimNumber = String(claimData.claimNumber || '').trim();

  return 'DRAFT - ' + customerName + ' - ' + claimNumber;
}

function buildInsuranceCalendarDescription_(claimData, folderResult, thread) {
  return [
    'Claim Number: ' + (claimData.claimNumber || ''),
    'Customer: ' + (claimData.customerName || claimData.insuredName || ''),
    'Date of Loss: ' + (claimData.dateOfLoss || ''),
    'Type of Loss: ' + (claimData.typeOfLoss || ''),
    'Loss Address: ' + (claimData.lossAddress || ''),
    '',
    'Claim Folder:',
    folderResult && folderResult.folderUrl ? folderResult.folderUrl : '',
    '',
    'Thread ID: ' + (thread && thread.getId ? thread.getId() : '')
  ].join('\n');
}

