

/**
 * Phase 8.5G
 * Claim Summary Foundation
 *
 * Goal:
 * Build claim-level operational summaries from
 * Claims, Timeline_Events, and Compliance_Actions.
 */

function testClaimSummarySample() {
  const summaries = buildClaimSummaries_();

  const firstWithTimeline = summaries.find(function(summary) {
    return summary.timelineEventCount > 0;
  });

  const firstWithOpenActions = summaries.find(function(summary) {
    return summary.openComplianceActions > 0;
  });

  Logger.log('Claims Summarized: ' + summaries.length);
  Logger.log('First Summary: ' + JSON.stringify(summaries[0] || null));
  Logger.log('First Summary With Timeline: ' + JSON.stringify(firstWithTimeline || null));
  Logger.log('First Summary With Open Actions: ' + JSON.stringify(firstWithOpenActions || null));
}

function buildClaimSummaries_() {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);

  const claimsSheet = ss.getSheetByName('Claims');
  const timelineSheet = ss.getSheetByName('Timeline_Events');
  const complianceSheet = ss.getSheetByName('Compliance_Actions');

  if (!claimsSheet) throw new Error('Missing sheet: Claims');
  if (!timelineSheet) throw new Error('Missing sheet: Timeline_Events');
  if (!complianceSheet) throw new Error('Missing sheet: Compliance_Actions');

  const claims = claimsSheet.getRange(3, 1, Math.max(claimsSheet.getLastRow() - 2, 0), 14).getValues();
  const timeline = timelineSheet.getRange(3, 1, Math.max(timelineSheet.getLastRow() - 2, 0), 10).getValues();
  const compliance = complianceSheet.getRange(3, 1, Math.max(complianceSheet.getLastRow() - 2, 0), 10).getValues();

  return claims.map(function(row) {
    const claimId = String(row[0] || '').trim();
    const jobNumber = String(row[1] || '').trim();

    const claimEvents = timeline.filter(function(eventRow) {
      return String(eventRow[1] || '').trim() === claimId;
    });

    const claimActions = compliance.filter(function(actionRow) {
      return String(actionRow[1] || '').trim() === claimId;
    });

    const openActions = claimActions.filter(function(actionRow) {
      return String(actionRow[8] || '').indexOf('Completed') === -1;
    });

    const sortedEvents = claimEvents.sort(function(a, b) {
      return new Date(b[3]).getTime() - new Date(a[3]).getTime();
    });

    const latestEvent = sortedEvents.length ? sortedEvents[0] : null;

    return {
      claimId: claimId,
      jobNumber: jobNumber,
      customerName: row[3],
      lastActivityDate: latestEvent ? latestEvent[3] : '',
      lastActivityType: latestEvent ? latestEvent[5] : '',
      lastActivitySummary: latestEvent ? latestEvent[7] : '',
      openComplianceActions: openActions.length,
      timelineEventCount: claimEvents.length
    };
  });
}

function testWriteClaimSummaries() {
  const summaries = buildClaimSummaries_();

  Logger.log('Claim summaries generated: ' + summaries.length);

  writeClaimSummaries_(summaries);

  Logger.log('Claim_Summaries table written successfully.');
}

function writeClaimSummaries_(summaries) {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);
  const sheet = ss.getSheetByName('Claim_Summaries');

  if (!sheet) {
    throw new Error('Missing sheet: Claim_Summaries');
  }

  clearDataRows_(sheet);

  if (!summaries.length) {
    Logger.log('No claim summaries to write.');
    return;
  }

  const now = new Date();

  const rows = summaries.map(function(summary) {
    return [
      summary.claimId,
      summary.jobNumber,
      summary.customerName,
      summary.lastActivityDate,
      summary.lastActivityType,
      summary.lastActivitySummary,
      summary.timelineEventCount,
      summary.openComplianceActions,
      now
    ];
  });

  sheet.getRange(3, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log('Claim_Summaries rows written: ' + rows.length);
}