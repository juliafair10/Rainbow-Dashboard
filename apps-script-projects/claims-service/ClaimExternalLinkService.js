

/**
 * Phase 9
 * Claim External Link Service
 */

function getClaimExternalLinks(claimId) {
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var links = getExternalLinksForClaim_(claimId);

  return {
    claimId: claimId,
    totalLinks: links.length,
    links: links,
    missingLinks: determineMissingLinks_(links)
  };
}

function getExternalLinksForClaim_(claimId) {
  try {
    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName('External Links');

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
          linkType: record['Link Type'] || '',
          label: record['Label'] || record['Link Type'] || '',
          url: record['URL'] || '',
          status: record['Status'] || 'Active'
        };
      });
  } catch (error) {
    Logger.log('External links unavailable: ' + error);
    return [];
  }
}

function determineMissingLinks_(links) {
  var required = [
    'Drive',
    'Fusion'
  ];

  var existing = links.map(function(link) {
    return String(link.linkType || '').toLowerCase();
  });

  return required.filter(function(type) {
    return existing.indexOf(type.toLowerCase()) === -1;
  });
}

function testClaimExternalLinks() {
  var claims = ClaimsQueryService.getAllClaimSummaries({});

  if (!claims.length) {
    throw new Error('No claims available for testing.');
  }

  var result = getClaimExternalLinks(claims[0].claimId);

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

var ClaimExternalLinkService = {
  getClaimExternalLinks: getClaimExternalLinks,
  testClaimExternalLinks: testClaimExternalLinks
};