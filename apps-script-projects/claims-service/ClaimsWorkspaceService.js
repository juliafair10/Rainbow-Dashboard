

function getClaimsList(lensId, options) {
  lensId = lensId || 'all';
  options = options || {};

  var claims = ClaimsLensService.getClaimsForLens(lensId, options);
  var stream = ClaimsStreamService.buildClaimsStream(claims, lensId, options);

  return {
    lensId: lensId,
    lensName: getClaimsLensName_(lensId),
    generatedAt: new Date().toISOString(),
    totalCount: claims.length,
    groups: stream.groups,
    filtersApplied: {
      lensId: lensId,
      excludeTerminal: lensId !== 'closed'
    },
    sortApplied: stream.sortApplied,
    warnings: stream.warnings
  };
}

function getClaimsWorkspace(options) {
  options = options || {};

  return {
    generatedAt: new Date().toISOString(),
    defaultLensId: 'all',
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

var ClaimsWorkspaceService = {
  getClaimsWorkspace: getClaimsWorkspace,
  getClaimsList: getClaimsList,
  testClaimsWorkspaceAllClaims: testClaimsWorkspaceAllClaims,
  testClaimsWorkspaceLensCounts: testClaimsWorkspaceLensCounts
};