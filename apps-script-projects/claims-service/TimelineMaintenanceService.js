

/**
 * TimelineMaintenanceService
 * Rainbow Phase 5 - Step 3
 *
 * Backfills and reclassifies existing Claim_Timeline rows using TimelineEngineService
 * and TimelineRulesService. This service updates existing rows only. It must not
 * create duplicate timeline events.
 */

const TIMELINE_MAINTENANCE_DERIVED_COLUMNS = [
  'Event_Category',
  'Meaningful_Activity_Type',
  'Updates_Last_Activity',
  'Display_Priority',
  'Visibility',
  'Group_ID',
  'Group_Label',
  'Noise_Reason',
  'Created_By'
];

function rebuildTimelineDerivedFieldsForClaim(claimId) {
  if (!claimId) {
    return validationErrorResponse(['Claim_ID is required to rebuild timeline derived fields.']);
  }

  const sheetContext = getTimelineMaintenanceSheetContext_();
  const matchingRows = [];

  sheetContext.records.forEach(function(record) {
    if (record.rowObject.Claim_ID === claimId) {
      matchingRows.push(record);
    }
  });

  if (matchingRows.length === 0) {
    return successResponse({
      claimId: claimId,
      updatedCount: 0,
      skippedCount: 0
    }, 'No timeline rows found for claim.');
  }

  const result = rebuildTimelineRecords_(sheetContext, matchingRows);

  return successResponse({
    claimId: claimId,
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    rowsReviewed: matchingRows.length,
    updates: result.updates
  }, 'Timeline derived fields rebuilt for claim.');
}

function rebuildTimelineDerivedFieldsForAllClaims() {
  const sheetContext = getTimelineMaintenanceSheetContext_();
  const result = rebuildTimelineRecords_(sheetContext, sheetContext.records);

  return successResponse({
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    rowsReviewed: sheetContext.records.length,
    updates: result.updates
  }, 'Timeline derived fields rebuilt for all claims.');
}

function rebuildTimelineRecords_(sheetContext, records) {
  const result = {
    updatedCount: 0,
    skippedCount: 0,
    updates: []
  };

  records.forEach(function(record) {
    const classifiedRow = rebuildTimelineRow_(record.rowObject);
    const changedColumns = updateTimelineMaintenanceRow_(sheetContext, record.rowNumber, record.rowObject, classifiedRow);

    if (changedColumns.length > 0) {
      result.updatedCount++;
      result.updates.push({
        rowNumber: record.rowNumber,
        timelineEventId: record.rowObject.Timeline_Event_ID,
        claimId: record.rowObject.Claim_ID,
        eventType: record.rowObject.Event_Type,
        changedColumns: changedColumns
      });
    } else {
      result.skippedCount++;
    }
  });

  return result;
}

function rebuildTimelineRow_(timelineRow) {
  const classifiedRow = classifyTimelineEngineEvent_(timelineRow || {});

  return {
    Event_Category: classifiedRow.Event_Category || '',
    Meaningful_Activity_Type: classifiedRow.Meaningful_Activity_Type || '',
    Updates_Last_Activity: classifiedRow.Updates_Last_Activity,
    Display_Priority: classifiedRow.Display_Priority || '',
    Visibility: classifiedRow.Visibility || '',
    Group_ID: classifiedRow.Group_ID || '',
    Group_Label: classifiedRow.Group_Label || '',
    Noise_Reason: classifiedRow.Noise_Reason || '',
    Created_By: classifiedRow.Created_By || 'TimelineMaintenanceService'
  };
}

function updateTimelineMaintenanceRow_(sheetContext, rowNumber, originalRow, rebuiltRow) {
  const changedColumns = [];

  TIMELINE_MAINTENANCE_DERIVED_COLUMNS.forEach(function(columnName) {
    const columnNumber = sheetContext.headerMap[columnName];

    if (!columnNumber) {
      return;
    }

    const originalValue = originalRow[columnName];
    const rebuiltValue = rebuiltRow[columnName];

    if (String(originalValue) !== String(rebuiltValue)) {
      sheetContext.sheet.getRange(rowNumber, columnNumber).setValue(rebuiltValue);
      changedColumns.push(columnName);
    }
  });

  return changedColumns;
}

function getTimelineMaintenanceSheetContext_() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CLAIM_SHEET_NAMES.timeline);

  if (!sheet) {
    throw new Error('Claim_Timeline sheet not found.');
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 1 || lastColumn < 1) {
    throw new Error('Claim_Timeline sheet has no header row.');
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0];
  const headerMap = buildTimelineMaintenanceHeaderMap_(headers);

  const records = values.slice(1).map(function(row, index) {
    const rowObject = {};

    headers.forEach(function(header, headerIndex) {
      if (header) {
        rowObject[header] = row[headerIndex];
      }
    });

    return {
      rowNumber: index + 2,
      rowObject: rowObject
    };
  }).filter(function(record) {
    return record.rowObject.Timeline_Event_ID || record.rowObject.Claim_ID || record.rowObject.Event_Type;
  });

  return {
    sheet: sheet,
    headers: headers,
    headerMap: headerMap,
    records: records
  };
}

function buildTimelineMaintenanceHeaderMap_(headers) {
  const headerMap = {};

  headers.forEach(function(header, index) {
    if (header) {
      headerMap[header] = index + 1;
    }
  });

  return headerMap;
}

function testRebuildSingleTimelineRow() {
  const rebuiltRow = rebuildTimelineRow_({
    Timeline_Event_ID: 'TEST-TLE-001',
    Claim_ID: 'TEST-CLAIM',
    Event_Date: nowIso(),
    Event_Type: 'Inspection Completed',
    Event_Source: 'EOJ Processing Engine',
    Source_System: 'eoj-processing-engine',
    Summary: 'Initial inspection completed by technician.',
    Created_By: ''
  });

  Logger.log(JSON.stringify(rebuiltRow, null, 2));
  return rebuiltRow;
}

function testRebuildClaimTimeline() {
  const claimLookup = lookupClaim({
    Display_Name: 'CLAIRE JACKSON',
    Claim_Number: '26N-0127-MLD'
  });

  if (!claimLookup.success) {
    Logger.log(JSON.stringify(claimLookup, null, 2));
    return claimLookup;
  }

  const result = rebuildTimelineDerivedFieldsForClaim(claimLookup.data.claim.Claim_ID);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testRebuildAllClaimTimelines() {
  const result = rebuildTimelineDerivedFieldsForAllClaims();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}