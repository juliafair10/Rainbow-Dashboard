

/**
 * Claim identity and matching service.
 * Rainbow Phase 4 - Claim Foundation
 */

function findClaimById(claimId) {
  return lookupClaim({ Claim_ID: claimId });
}

function findClaimByClaimNumber(claimNumber) {
  return lookupClaim({ Claim_Number: claimNumber });
}

function findClaimByFolderId(folderId) {
  return lookupClaim({ Claim_Folder_ID: folderId });
}

function findClaimByEmailThreadId(threadId) {
  return lookupClaim({ Source_Email_Thread_ID: threadId });
}

function findClaimByDisplayNameAndNumber(displayName, claimNumber) {
  return lookupClaim({
    Display_Name: displayName,
    Claim_Number: claimNumber
  });
}

function matchOrCreateClaim(payload) {
  const normalized = normalizeClaimData(payload || {});

  if (normalized.Claim_Folder_ID) {
    const folderMatch = findClaimByFolderId(normalized.Claim_Folder_ID);
    if (folderMatch.success) {
      return folderMatch;
    }
  }

  if (normalized.Source_Email_Thread_ID) {
    const threadMatch = findClaimByEmailThreadId(normalized.Source_Email_Thread_ID);
    if (threadMatch.success) {
      return threadMatch;
    }
  }

  if (normalized.Display_Name && normalized.Claim_Number) {
    const identityMatch = findClaimByDisplayNameAndNumber(
      normalized.Display_Name,
      normalized.Claim_Number
    );

    if (identityMatch.success) {
      return identityMatch;
    }
  }

  if (normalized.Claim_Number) {
    const claimNumberMatch = findClaimByClaimNumber(normalized.Claim_Number);
    if (claimNumberMatch.success) {
      return claimNumberMatch;
    }
  }

  return createClaim(normalized);
}

function testClaimIdentityService() {
  return findClaimByDisplayNameAndNumber(
    'CLAIRE JACKSON',
    '26N-0127-MLD'
  );
}