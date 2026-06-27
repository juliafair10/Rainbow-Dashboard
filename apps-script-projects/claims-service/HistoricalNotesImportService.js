var HistoricalNotesImportService = (function () {

  function testDryRunHistoricalNotesImport() {
    return runHistoricalNotesImport_(true);
  }

  function importLatestHistoricalNotes() {
    return runHistoricalNotesImport_(false);
  }

  function testDryRunNewHistoricalNotes() {
    return runHistoricalNotesImport_(true, { incremental: true });
  }

  function importNewHistoricalNotes() {
    return runHistoricalNotesImport_(false, { incremental: true });
  }

  function runHistoricalNotesImport_(dryRun, options) {
    options = options || {};
    var claims = TimelineImportHelpers.getActiveClaimSummaries();
    var indexes = TimelineImportHelpers.buildClaimLookupIndexes(claims);
    var existingIds = TimelineImportHelpers.loadExistingTimelineSourceRecordIds();

    var rows = getHistoricalNoteRows_();
    var incrementalState = options.incremental ? getHistoricalNotesTimelineImportState_() : null;

    if (options.incremental && incrementalState && incrementalState.lastEventDate) {
      rows = filterRowsAfterLastImportedDate_(rows, incrementalState.lastEventDate);
    }

    var results = {
      dryRun: dryRun === true,
      notesFound: rows.length,
      matched: 0,
      unmatched: 0,
      created: 0,
      duplicates: 0,
      sampleMatches: [],
      duplicateIds: [],
      mode: options.incremental ? 'incremental' : 'backfill',
      lastImportedEventId: incrementalState ? incrementalState.lastEventId : '',
      newRowsScanned: rows.length
    };
    var pendingEvents = [];

    rows.forEach(function (row) {
      var match = TimelineImportHelpers.matchHistoricalNoteRowToClaim(row, indexes);

      if (!match.claim) {
        results.unmatched++;
        return;
      }

      results.matched++;

      var jobNumber = getHistoricalNoteValue_(row, 'jobNumber', 'jobNumber');
      var eventDate = getHistoricalNoteValue_(row, 'noteDate', 'noteDate');
      var noteText = getHistoricalNoteValue_(row, 'noteText', 'noteText');
      var addedBy = getHistoricalNoteValue_(row, 'noteAuthor', 'noteAuthor');
      var noteId = getHistoricalNoteValue_(row, 'noteId', 'noteId');

      var sourceRecordId = noteId || TimelineImportHelpers.buildSourceRecordId([
        jobNumber,
        eventDate,
        noteText
      ]);

      var event = {
        eventDate: TimelineImportHelpers.normalizeImportedDate(eventDate),
        eventType: 'Historical Note',
        sourceSystem: 'Historical Notes',
        sourceRecordId: sourceRecordId,
        summary: TimelineImportHelpers.summarizeText(noteText, 140),
        detail: noteText,
        actor: addedBy || '',
        eventCategory: 'Operational Activity',
        isMeaningfulActivity: false,
        updatesLastActivity: false
      };

      var outcome;

      if (existingIds[sourceRecordId]) {
        results.duplicates++;

        if (results.duplicateIds.length < 25) {
          results.duplicateIds.push(sourceRecordId);
        }

        outcome = {
          status: 'duplicate'
        };
      } else {
        existingIds[sourceRecordId] = true;

        pendingEvents.push({
          claimId: match.claim.claimId || match.claim.Claim_ID,
          jobNumber: jobNumber,
          event: event
        });

        results.created++;

        outcome = {
          status: dryRun ? 'dryRun' : 'pending'
        };
      }

      if (results.sampleMatches.length < 10) {
        results.sampleMatches.push({
          claimId: match.claim.claimId || match.claim.Claim_ID,
          jobNumber: jobNumber,
          actor: addedBy,
          eventDate: eventDate,
          outcome: outcome.status
        });
      }
    });

    results.pendingEvents = pendingEvents.length;

    if (!dryRun && pendingEvents.length > 0) {
      results.rowsWritten = writeHistoricalTimelineEvents_(pendingEvents);
    }

    if (!dryRun && pendingEvents.length > 0) {
      var newestImported = getNewestPendingHistoricalEvent_(pendingEvents);
      if (newestImported) {
        saveHistoricalNotesTimelineImportState_(newestImported.event.sourceRecordId, newestImported.event.eventDate);
      }
    }

    return results;
  }

  function getHistoricalNotesTimelineImportState_() {
    return deriveHistoricalNotesTimelineImportState_();
  }

  function saveHistoricalNotesTimelineImportState_(eventId, eventDate) {
    var props = PropertiesService.getScriptProperties();

    if (eventId) {
      props.setProperty('HISTORICAL_NOTES_TIMELINE_LAST_EVENT_ID', String(eventId));
    }

    if (eventDate) {
      var normalizedDate = eventDate instanceof Date ? eventDate.toISOString() : String(eventDate);
      props.setProperty('HISTORICAL_NOTES_TIMELINE_LAST_EVENT_DATE', normalizedDate);
    }
  }

  function deriveHistoricalNotesTimelineImportState_() {
    var ss = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
    var sheet = ss.getSheetByName('Timeline_Events');

    if (!sheet || sheet.getLastRow() < 2) {
      return {
        lastEventId: '',
        lastEventDate: ''
      };
    }

    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(function(header) {
      return String(header || '').trim();
    });

    var eventIdIndex = headers.indexOf('Event ID');
    var dateIndex = headers.indexOf('Date');
    var sourceIndex = headers.indexOf('Source');

    var newest = {
      lastEventId: '',
      lastEventDate: ''
    };
    var newestDate = null;

    for (var i = 1; i < values.length; i++) {
      var source = sourceIndex >= 0 ? String(values[i][sourceIndex] || '').trim() : '';
      if (source !== 'Historical Notes') continue;

      var eventId = eventIdIndex >= 0 ? String(values[i][eventIdIndex] || '').trim() : '';
      var rawDate = dateIndex >= 0 ? values[i][dateIndex] : '';
      var eventDate = TimelineImportHelpers.normalizeImportedDate(rawDate);

      if (!eventId || !eventDate) continue;

      if (!newestDate || eventDate > newestDate) {
        newestDate = eventDate;
        newest.lastEventId = eventId;
        newest.lastEventDate = eventDate.toISOString();
      }
    }

    if (newest.lastEventId) {
      saveHistoricalNotesTimelineImportState_(newest.lastEventId, newest.lastEventDate);
    }

    return newest;
  }

  function filterRowsAfterLastImportedDate_(rows, lastEventDate) {
    var stateDate = TimelineImportHelpers.normalizeImportedDate(lastEventDate);

    if (!stateDate) {
      return rows;
    }

    return rows.filter(function(row) {
      var noteDate = TimelineImportHelpers.normalizeImportedDate(
        getHistoricalNoteValue_(row, 'noteDate', 'noteDate')
      );

      return noteDate && noteDate > stateDate;
    });
  }

  function getNewestPendingHistoricalEvent_(pendingEvents) {
    var newest = null;
    var newestDate = null;

    (pendingEvents || []).forEach(function(item) {
      var eventDate = TimelineImportHelpers.normalizeImportedDate(item.event && item.event.eventDate);
      if (!eventDate) return;

      if (!newestDate || eventDate > newestDate) {
        newestDate = eventDate;
        newest = item;
      }
    });

    return newest;
  }

  function getHistoricalNoteRows_() {
    var spreadsheet = SpreadsheetApp.openById('1El1gDoh8GHvMfj8aFbV7pEH34vddo0DD2azT6p4XsSQ');
    var sheet = spreadsheet.getSheetByName('Historical_Notes');

    if (!sheet) {
      throw new Error('Historical_Notes sheet not found in Historical Notes Archive.');
    }

    var values = sheet.getDataRange().getValues();

    if (!values || values.length < 2) {
      return [];
    }

    var headers = values[0];
    var rows = [];

    for (var i = 1; i < values.length; i++) {
      var row = {};

      for (var j = 0; j < headers.length; j++) {
        row[String(headers[j] || '').trim()] = values[i][j];
      }

      rows.push(row);
    }

    return rows;
  }

  function getHistoricalNoteValue_(row, normalizedKey, rawKey) {
    if (row && row[normalizedKey] !== undefined && row[normalizedKey] !== null && row[normalizedKey] !== '') {
      return row[normalizedKey];
    }

    if (row && row[rawKey] !== undefined && row[rawKey] !== null && row[rawKey] !== '') {
      return row[rawKey];
    }

    return '';
  }

  function writeHistoricalTimelineEvents_(pendingEvents) {
    var ss = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
    var sheet = ss.getSheetByName('Timeline_Events');

    if (!sheet) {
      throw new Error('Timeline_Events sheet not found.');
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    var rows = pendingEvents.map(function(item) {
      var event = item.event;

      var rowObject = {
        'Event ID': event.sourceRecordId,
        'Claim ID': item.claimId,
        'Job Number': item.jobNumber || '',
        'Date': event.eventDate,
        'Source': 'Historical Notes',
        'Event Type': 'Historical Note',
        'Actor': event.actor,
        'Summary': event.summary,
        'Details': event.detail,
        'Visibility': 'Internal'
      };

      return headers.map(function(header) {
        return rowObject.hasOwnProperty(header) ? rowObject[header] : '';
      });
    });

    if (rows.length === 0) {
      return 0;
    }

    sheet.getRange(
      sheet.getLastRow() + 1,
      1,
      rows.length,
      headers.length
    ).setValues(rows);

    return rows.length;
  }

  function diagnoseHistoricalNotesForJob(jobNumber) {
    var normalizedJobNumber = String(jobNumber || '').trim();
    var historicalRows = getHistoricalNoteRows_().filter(function(row) {
      return String(getHistoricalNoteValue_(row, 'jobNumber', 'jobNumber') || '').trim() === normalizedJobNumber;
    });

    historicalRows.sort(function(a, b) {
      var aDate = TimelineImportHelpers.normalizeImportedDate(getHistoricalNoteValue_(a, 'noteDate', 'noteDate')) || new Date(0);
      var bDate = TimelineImportHelpers.normalizeImportedDate(getHistoricalNoteValue_(b, 'noteDate', 'noteDate')) || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    var ss = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
    var timelineSheet = ss.getSheetByName('Timeline_Events');
    var timelineRows = [];

    if (timelineSheet && timelineSheet.getLastRow() > 1) {
      var values = timelineSheet.getDataRange().getValues();
      var headers = values[0].map(function(header) {
        return String(header || '').trim();
      });

      var eventIdIndex = headers.indexOf('Event ID');
      var claimIdIndex = headers.indexOf('Claim ID');
      var jobNumberIndex = headers.indexOf('Job Number');
      var dateIndex = headers.indexOf('Date');
      var sourceIndex = headers.indexOf('Source');
      var summaryIndex = headers.indexOf('Summary');
      var detailsIndex = headers.indexOf('Details');

      for (var i = 1; i < values.length; i++) {
        var rowJobNumber = jobNumberIndex >= 0 ? String(values[i][jobNumberIndex] || '').trim() : '';
        var rowClaimId = claimIdIndex >= 0 ? String(values[i][claimIdIndex] || '').trim() : '';

        if (rowJobNumber === normalizedJobNumber || rowClaimId.indexOf(normalizedJobNumber) !== -1) {
          timelineRows.push({
            eventId: eventIdIndex >= 0 ? values[i][eventIdIndex] : '',
            claimId: rowClaimId,
            jobNumber: rowJobNumber,
            date: dateIndex >= 0 ? values[i][dateIndex] : '',
            source: sourceIndex >= 0 ? values[i][sourceIndex] : '',
            summary: summaryIndex >= 0 ? values[i][summaryIndex] : '',
            details: detailsIndex >= 0 ? values[i][detailsIndex] : ''
          });
        }
      }
    }

    timelineRows.sort(function(a, b) {
      var aDate = TimelineImportHelpers.normalizeImportedDate(a.date) || new Date(0);
      var bDate = TimelineImportHelpers.normalizeImportedDate(b.date) || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

    var result = {
      jobNumber: normalizedJobNumber,
      historicalCount: historicalRows.length,
      timelineCount: timelineRows.length,
      newestHistoricalNotes: historicalRows.slice(0, 10).map(function(row) {
        return {
          noteId: getHistoricalNoteValue_(row, 'noteId', 'noteId'),
          noteDate: getHistoricalNoteValue_(row, 'noteDate', 'noteDate'),
          noteAuthor: getHistoricalNoteValue_(row, 'noteAuthor', 'noteAuthor'),
          noteText: TimelineImportHelpers.summarizeText(getHistoricalNoteValue_(row, 'noteText', 'noteText'), 180)
        };
      }),
      newestTimelineEvents: timelineRows.slice(0, 10)
    };

    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  return {
    testDryRunHistoricalNotesImport: testDryRunHistoricalNotesImport,
    importLatestHistoricalNotes: importLatestHistoricalNotes,
    testDryRunNewHistoricalNotes: testDryRunNewHistoricalNotes,
    importNewHistoricalNotes: importNewHistoricalNotes,
    diagnoseHistoricalNotesForJob: diagnoseHistoricalNotesForJob
  };
})();

function testDryRunHistoricalNotesImport() {
  return HistoricalNotesImportService.testDryRunHistoricalNotesImport();
}

function testDryRunHistoricalNotesImportLog() {
  var result = testDryRunHistoricalNotesImport();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testTimelineSheetAccess() {
  var ss = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
  var sheet = ss ? ss.getSheetByName('Timeline_Events') : null;

  var result = {
    spreadsheetName: ss ? ss.getName() : null,
    sheetFound: !!sheet,
    rowCount: sheet ? sheet.getLastRow() : 0
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function importLatestHistoricalNotes() {
  return HistoricalNotesImportService.importLatestHistoricalNotes();
}

function testDryRunNewHistoricalNotes() {
  var result = HistoricalNotesImportService.testDryRunNewHistoricalNotes();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function importNewHistoricalNotes() {
  return HistoricalNotesImportService.importNewHistoricalNotes();
}

function diagnoseHistoricalNotesForJob(jobNumber) {
  return HistoricalNotesImportService.diagnoseHistoricalNotesForJob(jobNumber);
}

function diagnoseHistoricalNotesFor26A0034() {
  return diagnoseHistoricalNotesForJob('26A-0034-WTR');
}

/**
 * testLatestHistoricalNotesImportVisibility()
 *
 * Diagnostic: samples the most recently imported historical notes and checks
 * whether each one is present in Timeline_Events and visible through
 * ClaimDetailService.getWorkspaceTimelineForClaim_.
 *
 * Run from the Apps Script editor after an import to verify end-to-end visibility.
 */
function testLatestHistoricalNotesImportVisibility() {
  Logger.log('=== testLatestHistoricalNotesImportVisibility ===');

  // Read Timeline_Events sheet directly for recently-written historical notes
  var ss = SpreadsheetApp.openById(CLAIM_SERVICE.spreadsheetId);
  var sheet = ss.getSheetByName('Timeline_Events');

  if (!sheet || sheet.getLastRow() < 2) {
    Logger.log('Timeline_Events sheet empty or not found');
    return { error: 'Timeline_Events sheet empty or not found' };
  }

  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function(h) { return String(h || '').trim(); });

  var eventIdIdx = headers.indexOf('Event ID');
  var claimIdIdx = headers.indexOf('Claim ID') !== -1 ? headers.indexOf('Claim ID') : headers.indexOf('Claim_ID');
  var jobNumIdx = headers.indexOf('Job Number') !== -1 ? headers.indexOf('Job Number') : headers.indexOf('Job_Number');
  var dateIdx = headers.indexOf('Date') !== -1 ? headers.indexOf('Date') : headers.indexOf('Event_Date');
  var sourceIdx = headers.indexOf('Source') !== -1 ? headers.indexOf('Source') : headers.indexOf('Event_Source');
  var typeIdx = headers.indexOf('Event Type') !== -1 ? headers.indexOf('Event Type') : headers.indexOf('Event_Type');
  var summaryIdx = headers.indexOf('Summary');

  // Collect all historical-note rows
  var noteRows = [];
  for (var i = 1; i < values.length; i++) {
    var rowSource = String(sourceIdx >= 0 ? values[i][sourceIdx] : '').trim().toLowerCase();
    var rowType = String(typeIdx >= 0 ? values[i][typeIdx] : '').trim().toLowerCase();
    var combined = rowSource + ' ' + rowType;

    if (combined.indexOf('historical') !== -1 || combined.indexOf('note') !== -1) {
      var rowDate = dateIdx >= 0 ? values[i][dateIdx] : '';
      noteRows.push({
        sheetRow: i + 1,
        noteId: eventIdIdx >= 0 ? String(values[i][eventIdIdx] || '').trim() : '',
        claimId: claimIdIdx >= 0 ? String(values[i][claimIdIdx] || '').trim() : '',
        jobNumber: jobNumIdx >= 0 ? String(values[i][jobNumIdx] || '').trim() : '',
        eventDate: rowDate,
        source: sourceIdx >= 0 ? String(values[i][sourceIdx] || '').trim() : '',
        eventType: typeIdx >= 0 ? String(values[i][typeIdx] || '').trim() : '',
        summary: summaryIdx >= 0 ? String(values[i][summaryIdx] || '').substring(0, 80) : ''
      });
    }
  }

  // Sort newest event date first (these are the "most recently dated" historical notes)
  noteRows.sort(function(a, b) {
    var aMs = a.eventDate instanceof Date ? a.eventDate.getTime() : new Date(a.eventDate || 0).getTime();
    var bMs = b.eventDate instanceof Date ? b.eventDate.getTime() : new Date(b.eventDate || 0).getTime();
    return bMs - aMs;
  });

  Logger.log('Total historical note rows in Timeline_Events: ' + noteRows.length);

  // Sample the 10 most recently dated historical notes
  var sample = noteRows.slice(0, 10);

  // For each, check visibility through ClaimDetailService
  var results = sample.map(function(note) {
    var verdict = 'UNKNOWN';
    var serviceEventsReturned = 0;
    var foundInService = false;

    if (note.claimId) {
      try {
        var timeline = getWorkspaceTimelineForClaim_(note.claimId);
        serviceEventsReturned = timeline.events.length;
        foundInService = timeline.events.some(function(evt) {
          var evtDate = String(evt.eventDate || evt.date || '');
          var noteDate = String(note.eventDate || '');
          var datesMatch = evtDate.indexOf(noteDate.substring(0, 10)) !== -1 ||
                           noteDate.indexOf(evtDate.substring(0, 10)) !== -1;
          var typeMatch = String(evt.eventType || '').toLowerCase().indexOf('historical') !== -1 ||
                          String(evt.source || '').toLowerCase().indexOf('historical') !== -1;
          return datesMatch && typeMatch;
        });
        verdict = foundInService ? 'VISIBLE' : 'HIDDEN (not in service payload)';
      } catch (e) {
        verdict = 'ERROR: ' + String(e.message || e).substring(0, 60);
      }
    } else {
      verdict = 'NO_CLAIM_ID (import write error — check Timeline_Events headers)';
    }

    return {
      noteId: note.noteId,
      jobNumber: note.jobNumber,
      claimId: note.claimId || '(empty)',
      eventDate: String(note.eventDate || '').substring(0, 10),
      source: note.source,
      presentInTimeline_Events: true,
      claimIdPopulated: !!note.claimId,
      serviceEventsReturned: serviceEventsReturned,
      visibleThroughClaimDetailService: foundInService,
      verdict: verdict,
      summary: note.summary
    };
  });

  Logger.log('--- Sample of 10 most recently dated historical notes ---');
  Logger.log(JSON.stringify(results, null, 2));

  var hiddenCount = results.filter(function(r) { return !r.visibleThroughClaimDetailService; }).length;
  var noClaimIdCount = results.filter(function(r) { return !r.claimIdPopulated; }).length;

  Logger.log('--- Summary ---');
  Logger.log('Sampled: ' + results.length + ' notes');
  Logger.log('Visible through service: ' + (results.length - hiddenCount));
  Logger.log('Hidden (not in service payload): ' + hiddenCount);
  Logger.log('Missing Claim_ID (write error): ' + noClaimIdCount);

  if (noClaimIdCount > 0) {
    Logger.log('ROOT CAUSE: Claim_ID not written — check Timeline_Events sheet header format vs writeHistoricalTimelineEvents_ keys');
  } else if (hiddenCount > 0) {
    Logger.log('ROOT CAUSE: Notes in sheet but not in service payload — likely event cap in getWorkspaceTimelineForClaim_');
  } else {
    Logger.log('OK: all sampled notes visible through ClaimDetailService');
  }

  return {
    totalHistoricalNoteRows: noteRows.length,
    sampled: results.length,
    visibleCount: results.length - hiddenCount,
    hiddenCount: hiddenCount,
    noClaimIdCount: noClaimIdCount,
    results: results
  };
}
