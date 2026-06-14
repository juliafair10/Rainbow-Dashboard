/**
 * Phase 9
 * Claim Financial Track Service
 */

function getClaimFinancialTracks(claimId) {
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var tracks = getFinancialTracksForClaim_(claimId);

  return {
    claimId: claimId,
    totalTracks: tracks.length,
    tracks: tracks,
    hasActiveTracks: tracks.length > 0
  };
}

function getFinancialTracksForClaim_(claimId) {
  try {
    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName('Financial Tracks');

    if (!sheet) {
      return [];
    }

    var values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return [];
    }

    var headers = values[0];

    return values.slice(1)
      .map(function(row) {
        var record = {};

        headers.forEach(function(header, index) {
          record[header] = row[index];
        });

        return record;
      })
      .filter(function(record) {
        return String(record['Claim ID'] || '') === String(claimId);
      })
      .map(function(record) {
        return {
          trackId: record['Track ID'] || '',
          trackName: record['Track Name'] || '',
          fusionLink: record['Fusion Link'] || '',
          status: record['Status'] || '',
          approvalState: record['Approval State'] || '',
          paymentState: record['Payment State'] || ''
        };
      });
  } catch (error) {
    Logger.log('Financial tracks unavailable: ' + error);
    return [];
  }
}

function testClaimFinancialTracks() {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  if (!claims.length) {
    throw new Error('No claims available for testing.');
  }

  var result = getClaimFinancialTracks(claims[0].claimId);

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

var ClaimFinancialTrackService = {
  getClaimFinancialTracks: getClaimFinancialTracks,
  testClaimFinancialTracks: testClaimFinancialTracks
};
