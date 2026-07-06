

/**
 * Phase 9
 * Claim External Link Service
 */
var EXTERNAL_LINK_CACHE_SECONDS = 60;

function getClaimExternalLinks(claimId) {
  if (!claimId) {
    throw new Error('claimId is required');
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = 'externalLinks:' + claimId;

  try {
    var cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  var links = getExternalLinksForClaim_(claimId);

  var result = {
    claimId: claimId,
    totalLinks: links.length,
    links: links,
    missingLinks: determineMissingLinks_(links)
  };

  try {
    cache.put(cacheKey, JSON.stringify(result), EXTERNAL_LINK_CACHE_SECONDS);
  } catch (e) {}

  return result;
}

function getExternalLinksForClaim_(claimId) {
  try {
    var sheet = SpreadsheetApp
      .openById(CLAIMS_DATABASE_SPREADSHEET_ID)
      .getSheetByName(CLAIM_SHEET_NAMES.externalLinks || 'External_Links');

    if (!sheet) {
      return [];
    }

    var values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return [];
    }

    var headerRowIndex = findExternalLinkHeaderRowIndex_(values);
    var headers = values[headerRowIndex];
    var matchingKeys = buildExternalLinkMatchingKeys_(claimId);
    var links = [];

    values.slice(headerRowIndex + 1)
      .map(function(row) {
        var record = {};

        headers.forEach(function(header, index) {
          if (header) {
            record[String(header).trim()] = row[index];
          }
        });

        return record;
      })
      .filter(function(record) {
        return recordMatchesExternalLinkClaim_(record, matchingKeys);
      })
      .forEach(function(record) {
        links = links.concat(buildExternalLinksFromRecord_(record));
      });

    return dedupeExternalLinks_(links);
  } catch (error) {
    Logger.log('External links unavailable: ' + error);
    return [];
  }
}

function findExternalLinkHeaderRowIndex_(values) {
  for (var rowIndex = 0; rowIndex < Math.min(values.length, 10); rowIndex++) {
    var normalizedHeaders = values[rowIndex].map(function(value) {
      return normalizeExternalLinkHeaderName_(value);
    });

    if (normalizedHeaders.indexOf('claimid') !== -1 ||
        normalizedHeaders.indexOf('jobnumber') !== -1 ||
        normalizedHeaders.indexOf('url') !== -1 ||
        normalizedHeaders.indexOf('linktype') !== -1) {
      return rowIndex;
    }
  }

  return 0;
}

function buildExternalLinkMatchingKeys_(claimId) {
  var keys = {};
  var rawClaimId = String(claimId || '').trim();

  if (rawClaimId) {
    keys[rawClaimId] = true;
    keys[rawClaimId.replace(/^CLM-/, '')] = true;
  }

  return keys;
}

function recordMatchesExternalLinkClaim_(record, matchingKeys) {
  return [
    getExternalLinkValue_(record, ['Claim_ID', 'Claim ID', 'claimId']),
    getExternalLinkValue_(record, ['Job_Number', 'Job Number', 'jobNumber']),
    getExternalLinkValue_(record, ['Claim_Number', 'Claim Number', 'claimNumber'])
  ].some(function(value) {
    return !!matchingKeys[String(value || '').trim()];
  });
}

function buildExternalLinksFromRecord_(record) {
  var links = [];
  var canonicalUrl = getExternalLinkValue_(record, ['URL', 'Url', 'url']);
  var canonicalType = getExternalLinkValue_(record, [
    'Link_Type',
    'Link Type',
    'Type',
    'linkType'
  ]);
  var canonicalLabel = getExternalLinkValue_(record, [
    'Label',
    'Link_Label',
    'Link Label',
    'Name',
    'label'
  ]);

  if (canonicalUrl) {
    links.push(buildExternalLink_(canonicalType, canonicalLabel, canonicalUrl));
  }

  getExternalLinkWideColumnMappings_().forEach(function(mapping) {
    var url = getExternalLinkValue_(record, mapping.keys);

    if (url) {
      links.push(buildExternalLink_(mapping.linkType, mapping.label, url));
    }
  });

  return links.filter(function(link) {
    return !!link.url;
  });
}

function getExternalLinkWideColumnMappings_() {
  return [
    {
      linkType: 'Drive',
      label: 'Google Drive Folder',
      keys: ['Drive Folder', 'Google Drive', 'Google_Drive_URL', 'Claim_Folder_URL', 'Claim Folder URL', 'Folder_URL', 'Drive_URL']
    },
    {
      linkType: 'Fusion',
      label: 'Fusion File',
      keys: ['Fusion_File_URL', 'Fusion File URL', 'Fusion URL', 'Fusion_URL', 'Fusion']
    },
    {
      linkType: 'XactAnalysis',
      label: 'XactAnalysis',
      keys: ['XactAnalysis', 'XactAnalysis_URL', 'Xact Analysis URL', 'XactAnalysis URL']
    },
    {
      linkType: 'Xactimate',
      label: 'Xactimate',
      keys: ['Xactimate', 'Xactimate_URL', 'Xactimate URL']
    },
    {
      linkType: 'Symbility',
      label: 'Symbility',
      keys: ['Symbility', 'Symbility_URL', 'Symbility URL']
    },
    {
      linkType: 'ClaimX',
      label: 'ClaimX',
      keys: ['ClaimX', 'ClaimX_URL', 'ClaimX URL', 'Claim X URL']
    },
    {
      linkType: 'Other',
      label: 'Operational Link',
      keys: ['Other Links', 'Other_Link_URL', 'Other URL', 'Other_URL']
    }
  ];
}

function buildExternalLink_(linkType, label, url) {
  var normalizedType = normalizeExternalLinkType_(linkType || label);

  return {
    linkType: normalizedType,
    label: getFriendlyExternalLinkLabel_(normalizedType, label),
    url: String(url || '').trim(),
    status: 'Active'
  };
}

function normalizeExternalLinkType_(value) {
  var normalized = String(value || '').toLowerCase();

  if (normalized.indexOf('drive') !== -1 || normalized.indexOf('folder') !== -1) {
    return 'Drive';
  }

  if (normalized.indexOf('fusion') !== -1) {
    return 'Fusion';
  }

  if (normalized.indexOf('xactanalysis') !== -1 || normalized.indexOf('xact analysis') !== -1) {
    return 'XactAnalysis';
  }

  if (normalized.indexOf('xactimate') !== -1) {
    return 'Xactimate';
  }

  if (normalized.indexOf('symbility') !== -1) {
    return 'Symbility';
  }

  if (normalized.indexOf('claimx') !== -1 || normalized.indexOf('claim x') !== -1) {
    return 'ClaimX';
  }

  return value ? String(value).trim() : 'Other';
}

function getFriendlyExternalLinkLabel_(linkType, label) {
  var friendlyLabels = {
    Drive: 'Google Drive Folder',
    Fusion: 'Fusion File',
    XactAnalysis: 'XactAnalysis',
    Xactimate: 'Xactimate',
    Symbility: 'Symbility',
    ClaimX: 'ClaimX',
    Other: 'Operational Link'
  };

  return friendlyLabels[linkType] || String(label || linkType || 'Operational Link').trim();
}

function getExternalLinkValue_(record, keys) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    if (record[key] !== null && record[key] !== undefined && String(record[key]).trim() !== '') {
      return String(record[key]).trim();
    }
  }

  return '';
}

function dedupeExternalLinks_(links) {
  var seen = {};

  return links.filter(function(link) {
    var key = [
      String(link.linkType || '').toLowerCase(),
      String(link.url || '').toLowerCase()
    ].join('|');

    if (!link.url || seen[key]) {
      return false;
    }

    seen[key] = true;
    return true;
  });
}

function normalizeExternalLinkHeaderName_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function determineMissingLinks_(links) {
  var required = [
    'Drive',
    'Fusion'
  ];

  var existing = links.map(function(link) {
    return String(normalizeExternalLinkType_(link.linkType || '') || '').toLowerCase();
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
