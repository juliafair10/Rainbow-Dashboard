

function getClaimsList(lensId, options) {
  options = normalizeClaimsWorkspaceOptions_(lensId, options);
  lensId = options.lensId || 'all';

  var claims = ClaimsLensService.getClaimsForLens(lensId, options);
  var stream = ClaimsStreamService.buildClaimsStream(claims, lensId, options);

  return {
    lensId: lensId,
    lensName: getClaimsLensName_(lensId),
    generatedAt: new Date().toISOString(),
    totalCount: claims.length,
    groups: stream.groups,
    filtersApplied: buildClaimsWorkspaceFiltersApplied_(lensId, options),
    routeContext: buildClaimsWorkspaceRouteContext_(options),
    sortApplied: stream.sortApplied,
    warnings: stream.warnings
  };
}

function getClaimsWorkspace(options) {
  options = normalizeClaimsWorkspaceOptions_(options && (options.lensId || options.lens), options);

  return {
    generatedAt: new Date().toISOString(),
    defaultLensId: 'all',
    activeLensId: options.lensId || 'all',
    routeContext: buildClaimsWorkspaceRouteContext_(options),
    availableLenses: [
      {
        lensId: 'all',
        lensName: 'All Claims'
      },
      {
        lensId: 'needsAttention',
        lensName: 'Needs Attention'
      },
      {
        lensId: 'waitingOnInsurance',
        lensName: 'Waiting on Insurance'
      },
      {
        lensId: 'missingEoj',
        lensName: 'Missing EOJ'
      },
      {
        lensId: 'paidMonitoring',
        lensName: 'Paid / Monitoring'
      },
      {
        lensId: 'closed',
        lensName: 'Closed'
      }
    ],
    claimsList: getClaimsList(options.lensId || 'all', options)
  };
}

function normalizeClaimsWorkspaceOptions_(lensId, options) {
  if (typeof lensId === 'object' && !options) {
    options = lensId;
    lensId = options && (options.lensId || options.lens || options.claimsLens);
  }

  options = Object.assign({}, options || {});

  options.lensId = normalizeClaimsWorkspaceValue_(
    lensId ||
    options.lensId ||
    options.lens ||
    options.claimsLens ||
    'all'
  ) || 'all';
  options.page = normalizeClaimsWorkspaceValue_(options.page || '');
  options.ownershipArea = normalizeClaimsWorkspaceValue_(options.ownershipArea || options.ownership || '');
  options.conditionType = normalizeClaimsWorkspaceValue_(options.conditionType || options.condition || '');
  options.claimId = normalizeClaimsWorkspaceValue_(options.claimId || options.claim || '');
  options.compliance = normalizeClaimsWorkspaceValue_(options.compliance || options.complianceType || '');
  options.routeSource = normalizeClaimsWorkspaceValue_(options.routeSource || '');

  return options;
}

function buildClaimsWorkspaceFiltersApplied_(lensId, options) {
  return {
    lensId: lensId || 'all',
    excludeTerminal: lensId !== 'closed' && !options.claimId,
    ownershipArea: options.ownershipArea || '',
    conditionType: options.conditionType || '',
    claimId: options.claimId || '',
    compliance: options.compliance || ''
  };
}

function buildClaimsWorkspaceRouteContext_(options) {
  return {
    page: options.page || '',
    routeSource: options.routeSource || '',
    lensId: options.lensId || 'all',
    ownershipArea: options.ownershipArea || '',
    conditionType: options.conditionType || '',
    claimId: options.claimId || '',
    compliance: options.compliance || '',
    hasRouteFilters: !!(
      options.ownershipArea ||
      options.conditionType ||
      options.claimId ||
      options.compliance ||
      (options.lensId && options.lensId !== 'all')
    )
  };
}

function normalizeClaimsWorkspaceValue_(value) {
  if (typeof normalizeString === 'function') {
    return normalizeString(value);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

function getClaimsLensName_(lensId) {
  var names = {
    all: 'All Claims',
    needsAttention: 'Needs Attention',
    waitingOnInsurance: 'Waiting on Insurance',
    missingEoj: 'Missing EOJ',
    paidMonitoring: 'Paid / Monitoring',
    closed: 'Closed'
  };

  return names[lensId] || 'All Claims';
}

function testClaimsWorkspaceAllClaims() {
  var result = getClaimsList('all', {});

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function testClaimsWorkspaceLensCounts() {
  var lensIds = [
    'all',
    'needsAttention',
    'waitingOnInsurance',
    'missingEoj',
    'paidMonitoring',
    'closed'
  ];

  var results = lensIds.map(function(lensId) {
    var list = getClaimsList(lensId, {});

    return {
      lensId: lensId,
      lensName: list.lensName,
      totalCount: list.totalCount,
      groupCount: list.groups.length,
      groups: list.groups.map(function(group) {
        return {
          groupId: group.groupId,
          groupLabel: group.groupLabel,
          count: group.claims.length
        };
      })
    };
  });

  Logger.log(JSON.stringify(results, null, 2));

  return results;
}

function testClaimsWorkspaceRouteFilters() {
  var claims = ClaimsLensService.getClaimsForLens('all', {});
  var sampleClaim = claims.find(function(claim) {
    return claim.claimId;
  });
  var ownershipClaim = claims.find(function(claim) {
    return claim.ownershipArea;
  });
  var conditionClaim = claims.find(function(claim) {
    return (claim.activeConditions || []).length > 0;
  });

  var ownershipArea = ownershipClaim ? ownershipClaim.ownershipArea : '';
  var conditionType = conditionClaim
    ? getClaimsWorkspaceTestConditionType_(conditionClaim.activeConditions[0])
    : '';
  var claimId = sampleClaim ? sampleClaim.claimId : '';

  var lensRoute = getClaimsList('needsAttention', {
    page: 'claims',
    routeSource: 'test'
  });
  var ownershipRoute = getClaimsList('all', {
    page: 'claims',
    ownership: ownershipArea,
    routeSource: 'test'
  });
  var conditionRoute = getClaimsList('all', {
    page: 'claims',
    condition: conditionType,
    routeSource: 'test'
  });
  var claimRoute = getClaimsList('all', {
    page: 'claims',
    claimId: claimId,
    routeSource: 'test'
  });

  var result = {
    lensRoute: summarizeClaimsWorkspaceRouteTest_(lensRoute),
    ownershipRoute: summarizeClaimsWorkspaceRouteTest_(ownershipRoute),
    conditionRoute: summarizeClaimsWorkspaceRouteTest_(conditionRoute),
    claimRoute: summarizeClaimsWorkspaceRouteTest_(claimRoute),
    samples: {
      ownershipArea: ownershipArea,
      conditionType: conditionType,
      claimId: claimId
    }
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function testClaimsWorkspaceRouteConsumption() {
  return testClaimsWorkspaceRouteFilters();
}

function summarizeClaimsWorkspaceRouteTest_(list) {
  return {
    lensId: list.lensId,
    totalCount: list.totalCount,
    filtersApplied: list.filtersApplied,
    routeContext: list.routeContext
  };
}

function getClaimsWorkspaceTestConditionType_(condition) {
  if (!condition || typeof condition !== 'object') {
    return condition || '';
  }

  return condition.Condition_Type ||
    condition.Condition_Name ||
    condition.conditionType ||
    condition.conditionName ||
    condition.Name ||
    '';
}

var ClaimsWorkspaceService = {
  getClaimsWorkspace: getClaimsWorkspace,
  getClaimsList: getClaimsList,
  testClaimsWorkspaceAllClaims: testClaimsWorkspaceAllClaims,
  testClaimsWorkspaceLensCounts: testClaimsWorkspaceLensCounts,
  testClaimsWorkspaceRouteFilters: testClaimsWorkspaceRouteFilters,
  testClaimsWorkspaceRouteConsumption: testClaimsWorkspaceRouteConsumption
};
