

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
      .getSheetByName('External_Links');

    if (!sheet) {
      return [];
    }

    var values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return [];
    }

    var headers = values[1];

    return values.slice(2)
      .map(function(row) {
        var record = {};

        headers.forEach(function(header, index) {
          record[header] = row[index];
        });

        return record;
      })
      .filter(function(record) {
        return String(record['Claim ID'] || '') === String(claimId)
          || String(record['Job Number'] || '') === String(claimId)
          || String(record['Job Number'] || '') === String(claimId).replace('CLM-', '');
      })
      .map(function(record) {
        var links = [];

        if (record['Drive Folder']) {
          links.push({
            linkType: 'Drive',
            label: 'Drive Folder',
            url: record['Drive Folder'],
            status: 'Active'
          });
        }

        if (record['Fusion URL']) {
          links.push({
            linkType: 'Fusion',
            label: 'Fusion',
            url: record['Fusion URL'],
            status: 'Active'
          });
        }

        if (record['XactAnalysis']) {
          links.push({
            linkType: 'XactAnalysis',
            label: 'XactAnalysis',
            url: record['XactAnalysis'],
            status: 'Active'
          });
        }

        if (record['Symbility']) {
          links.push({
            linkType: 'Symbility',
            label: 'Symbility',
            url: record['Symbility'],
            status: 'Active'
          });
        }

        if (record['ClaimX']) {
          links.push({
            linkType: 'ClaimX',
            label: 'ClaimX',
            url: record['ClaimX'],
            status: 'Active'
          });
        }

        if (record['Other Links']) {
          links.push({
            linkType: 'Other',
            label: 'Other Links',
            url: record['Other Links'],
            status: 'Active'
          });
        }

        return links;
      })
      .reduce(function(all, links) {
        return all.concat(links);
      }, []);
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