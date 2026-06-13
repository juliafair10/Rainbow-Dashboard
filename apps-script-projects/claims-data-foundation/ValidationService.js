

/**
 * Phase 8.5H
 * Data Foundation Validation
 */

function testDataFoundationValidation() {
  const ss = SpreadsheetApp.openById(CONFIG.database.spreadsheetId);

  const claimsSheet = ss.getSheetByName('Claims');
  const timelineSheet = ss.getSheetByName('Timeline_Events');
  const complianceSheet = ss.getSheetByName('Compliance_Actions');
  const summariesSheet = ss.getSheetByName('Claim_Summaries');

  const claims = claimsSheet.getRange(3, 1, Math.max(claimsSheet.getLastRow() - 2, 0), 14).getValues();
  const timeline = timelineSheet.getRange(3, 1, Math.max(timelineSheet.getLastRow() - 2, 0), 10).getValues();
  const compliance = complianceSheet.getRange(3, 1, Math.max(complianceSheet.getLastRow() - 2, 0), 9).getValues();
  const summaries = summariesSheet.getRange(3, 1, Math.max(summariesSheet.getLastRow() - 2, 0), 9).getValues();

  const claimIds = new Set();
  const duplicateClaimIds = [];

  claims.forEach(function(row) {
    const claimId = String(row[0] || '').trim();

    if (!claimId) {
      return;
    }

    if (claimIds.has(claimId)) {
      duplicateClaimIds.push(claimId);
    }

    claimIds.add(claimId);
  });

  let claimsWithTimeline = 0;
  let claimsWithoutTimeline = 0;

  claims.forEach(function(row) {
    const claimId = String(row[0] || '').trim();

    const eventCount = timeline.filter(function(eventRow) {
      return String(eventRow[1] || '').trim() === claimId;
    }).length;

    if (eventCount > 0) {
      claimsWithTimeline++;
    } else {
      claimsWithoutTimeline++;
    }
  });

  let claimsWithCompliance = 0;
  let claimsWithoutCompliance = 0;

  claims.forEach(function(row) {
    const claimId = String(row[0] || '').trim();

    const complianceCount = compliance.filter(function(actionRow) {
      return String(actionRow[1] || '').trim() === claimId;
    }).length;

    if (complianceCount > 0) {
      claimsWithCompliance++;
    } else {
      claimsWithoutCompliance++;
    }
  });

  const orphanTimelineEvents = timeline.filter(function(row) {
    return !claimIds.has(String(row[1] || '').trim());
  }).length;

  const orphanComplianceActions = compliance.filter(function(row) {
    return !claimIds.has(String(row[1] || '').trim());
  }).length;

  Logger.log('==============================');
  Logger.log('RAINBOW DATA FOUNDATION REPORT');
  Logger.log('==============================');
  Logger.log('Claims Total: ' + claims.length);
  Logger.log('Timeline Events Total: ' + timeline.length);
  Logger.log('Compliance Actions Total: ' + compliance.length);
  Logger.log('Claim Summaries Total: ' + summaries.length);
  Logger.log('');
  Logger.log('Claims With Timeline: ' + claimsWithTimeline);
  Logger.log('Claims Without Timeline: ' + claimsWithoutTimeline);
  Logger.log('');
  Logger.log('Claims With Compliance Actions: ' + claimsWithCompliance);
  Logger.log('Claims Without Compliance Actions: ' + claimsWithoutCompliance);
  Logger.log('');
  Logger.log('Duplicate Claim IDs: ' + duplicateClaimIds.length);
  Logger.log('Orphan Timeline Events: ' + orphanTimelineEvents);
  Logger.log('Orphan Compliance Actions: ' + orphanComplianceActions);
  Logger.log('==============================');
}