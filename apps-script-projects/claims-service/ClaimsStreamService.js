

function buildClaimsStream(claims, lensId, options) {
  claims = claims || [];
  lensId = lensId || 'all';
  options = options || {};

  var sortedClaims = claims.slice().sort(function(a, b) {
    var priorityDifference = getClaimPriorityRank_(a) - getClaimPriorityRank_(b);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return getComparableDate_(b) - getComparableDate_(a);
  });

  var groupedClaims = groupClaimsForLens_(sortedClaims, lensId);

  return {
    groups: groupedClaims,
    sortApplied: 'operational-priority-then-newest',
    warnings: []
  };
}

function groupClaimsForLens_(claims, lensId) {
  var groupMap = {};
  var groups = [];

  claims.forEach(function(claim) {
    var group = getClaimStreamGroup_(claim, lensId);

    if (!groupMap[group.groupId]) {
      groupMap[group.groupId] = {
        groupId: group.groupId,
        groupLabel: group.groupLabel,
        groupReason: group.groupReason,
        priorityRank: group.priorityRank,
        claims: []
      };
      groups.push(groupMap[group.groupId]);
    }

    groupMap[group.groupId].claims.push(claim);
  });

  return groups.sort(function(a, b) {
    return a.priorityRank - b.priorityRank;
  });
}

function getClaimStreamGroup_(claim, lensId) {
  if (lensId === 'closed') {
    return {
      groupId: 'closed',
      groupLabel: 'Closed / Historical',
      groupReason: 'Claims that are operationally complete, not sold, or otherwise historical.',
      priorityRank: 80
    };
  }

  if (hasHealth_(claim, 'Critical')) {
    return {
      groupId: 'critical',
      groupLabel: 'Critical',
      groupReason: 'Claims requiring immediate operational attention.',
      priorityRank: 10
    };
  }

  if (hasHealth_(claim, 'Escalated')) {
    return {
      groupId: 'escalated',
      groupLabel: 'Escalated',
      groupReason: 'Claims already escalated by the operational health engine.',
      priorityRank: 20
    };
  }

  if (hasHealth_(claim, 'At Risk')) {
    return {
      groupId: 'atRisk',
      groupLabel: 'At Risk',
      groupReason: 'Claims showing operational risk or missed cadence.',
      priorityRank: 30
    };
  }

  if (hasHealth_(claim, 'Attention Soon')) {
    return {
      groupId: 'attentionSoon',
      groupLabel: 'Attention Soon',
      groupReason: 'Claims that should be reviewed soon but are not yet escalated.',
      priorityRank: 40
    };
  }

  if (hasMissingOperationalItem_(claim)) {
    return {
      groupId: 'missingOperationalItem',
      groupLabel: 'Missing Required Operational Item',
      groupReason: 'Claims missing a visible operational requirement such as EOJ or required links.',
      priorityRank: 50
    };
  }

  if (isWaitingWithHealthyCadence_(claim)) {
    return {
      groupId: 'waitingHealthyCadence',
      groupLabel: 'Waiting with Healthy Cadence',
      groupReason: 'Claims waiting on external action while cadence remains acceptable.',
      priorityRank: 60
    };
  }

  return {
    groupId: 'healthyQuiet',
    groupLabel: 'Healthy / Quiet',
    groupReason: 'Claims with no current escalated operational need.',
    priorityRank: 70
  };
}

function getClaimPriorityRank_(claim) {
  return getClaimStreamGroup_(claim, 'all').priorityRank;
}

function hasHealth_(claim, healthLevel) {
  return String(claim.healthLevel || '').toLowerCase() === String(healthLevel || '').toLowerCase();
}

function hasMissingOperationalItem_(claim) {
  var alerts = claim.activeAlerts || [];
  var missingLinks = claim.missingLinks || [];

  return alerts.some(function(alert) {
    return String(alert).toLowerCase().indexOf('missing') !== -1;
  }) || missingLinks.length > 0;
}

function isWaitingWithHealthyCadence_(claim) {
  var conditions = claim.activeConditions || [];
  var healthLevel = String(claim.healthLevel || '').toLowerCase();

  var hasWaitingCondition = conditions.some(function(condition) {
    var normalized = String(condition).toLowerCase();
    return normalized.indexOf('waiting') !== -1 ||
           normalized.indexOf('review') !== -1 ||
           normalized.indexOf('pending') !== -1;
  });

  return hasWaitingCondition && (
    healthLevel === 'healthy' ||
    healthLevel === 'not evaluated' ||
    healthLevel === ''
  );
}

function getComparableDate_(claim) {
  var dateValue = claim.lastMeaningfulActivityDate || claim.createdDate || claim.lastUpdated;
  var date = new Date(dateValue || 0);

  if (isNaN(date.getTime())) {
    return new Date(0);
  }

  return date;
}

var ClaimsStreamService = {
  buildClaimsStream: buildClaimsStream
};