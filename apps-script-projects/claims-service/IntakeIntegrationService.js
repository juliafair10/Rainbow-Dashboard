

/**
 * Intake integration service.
 * Rainbow Phase 4 - Claim Foundation
 *
 * Connects Insurance Intake outputs into the Claim Foundation.
 * Does not redesign or replace the existing Insurance Intake Automation.
 */

function processIntakeClaim(payload) {
  const normalized = normalizeIntakeClaimPayload_(payload || {});
  const validation = validateIntakeClaimPayload_(normalized);

  if (!validation.success) {
    writeServiceLog('processIntakeClaim', 'Validation Error', 'Intake claim failed validation.', {
      sourceSystem: normalized.Source_System || 'insurance-intake-automation',
      sourceRecordId: normalized.Source_Email_Thread_ID || '',
      error: validation.errors
    });
    return validation;
  }

  const claimResult = matchOrCreateClaim({
    Claim_Number: normalized.Claim_Number,
    Display_Name: normalized.Display_Name,
    Property_Address: normalized.Property_Address,
    Carrier: normalized.Carrier,
    Adjuster_Name: normalized.Adjuster_Name,
    Adjuster_Email: normalized.Adjuster_Email,
    Policy_Number: normalized.Policy_Number,
    Loss_Date: normalized.Loss_Date,
    Date_Received: normalized.Date_Received,
    Source_System: normalized.Source_System,
    Source_Email_Thread_ID: normalized.Source_Email_Thread_ID,
    Claim_Folder_ID: normalized.Claim_Folder_ID,
    Claim_Folder_URL: normalized.Claim_Folder_URL,
    Lifecycle_State: 'Intake',
    Ownership_Area: 'Intake',
    Primary_Owner: normalized.Primary_Owner || 'Julia',
    Notes: normalized.Notes
  });

  if (!claimResult.success) {
    return claimResult;
  }

  const claim = claimResult.data.claim || claimResult.data.financialTrack || claimResult.data;
  const claimId = claim.Claim_ID;

  if (!claimId) {
    return errorResponse('Intake integration could not determine Claim_ID.', {
      claimResult: claimResult
    });
  }

  updateClaim(claimId, {
    Claim_Number: normalized.Claim_Number,
    Display_Name: normalized.Display_Name,
    Property_Address: normalized.Property_Address,
    Carrier: normalized.Carrier,
    Adjuster_Name: normalized.Adjuster_Name,
    Adjuster_Email: normalized.Adjuster_Email,
    Policy_Number: normalized.Policy_Number,
    Loss_Date: normalized.Loss_Date,
    Date_Received: normalized.Date_Received,
    Source_System: normalized.Source_System,
    Source_Email_Thread_ID: normalized.Source_Email_Thread_ID,
    Claim_Folder_ID: normalized.Claim_Folder_ID,
    Claim_Folder_URL: normalized.Claim_Folder_URL,
    Ownership_Area: 'Intake',
    Primary_Owner: normalized.Primary_Owner || 'Julia',
    Notes: normalized.Notes
  });

  appendTimelineEvent(claimId, {
    Event_Type: 'Intake Processed',
    Event_Source: normalized.Source_System,
    Source_System: normalized.Source_System,
    Source_Record_ID: normalized.Source_Email_Thread_ID,
    Summary: normalized.Claim_Label || buildClaimLabel_(normalized.Display_Name, normalized.Claim_Number),
    Detail: 'Insurance Intake connected this claim to the Claim Foundation.',
    Actor: normalized.Primary_Owner || 'Julia',
    Related_Workflow: 'Insurance Intake',
    Is_Meaningful_Activity: true
  });

  if (normalized.Claim_Folder_URL) {
    addExternalLink(claimId, {
      Link_Type: 'Google Drive Claim Folder',
      Label: 'Claim Folder',
      URL: normalized.Claim_Folder_URL,
      Source_System: normalized.Source_System,
      Notes: 'Claim folder linked from Insurance Intake.'
    });
  }

  if (normalized.Create_Main_Estimate_Track === true) {
    createMainEstimateTrack(claimId, {
      Carrier: normalized.Carrier,
      Source_System: normalized.Source_System,
      Notes: 'Main estimate track created from Insurance Intake.'
    });
  }

  writeServiceLog('processIntakeClaim', 'Success', 'Intake claim processed into Claim Foundation.', {
    claimId: claimId,
    sourceSystem: normalized.Source_System,
    sourceRecordId: normalized.Source_Email_Thread_ID,
    claimNumber: normalized.Claim_Number,
    displayName: normalized.Display_Name
  });

  return successResponse({
    claimId: claimId,
    claim: lookupClaim({ Claim_ID: claimId }).data.claim,
    created: claimResult.data.created === true
  }, 'Intake claim processed successfully.');
}

function normalizeIntakeClaimPayload_(payload) {
  const normalized = Object.assign({}, payload || {});

  normalized.Claim_Number = normalizeClaimNumber(
    normalized.Claim_Number || normalized.claimNumber || normalized.claim_number || ''
  );

  normalized.Display_Name = normalizeString(
    normalized.Display_Name || normalized.displayName || normalized.display_name || normalized.Customer_Name || normalized.customerName || ''
  );

  normalized.Claim_Label = buildClaimLabel_(normalized.Display_Name, normalized.Claim_Number);

  normalized.Property_Address = normalizeString(
    normalized.Property_Address || normalized.propertyAddress || normalized.property_address || ''
  );

  normalized.Carrier = normalizeString(normalized.Carrier || normalized.carrier || '');
  normalized.Adjuster_Name = normalizeString(normalized.Adjuster_Name || normalized.adjusterName || '');
  normalized.Adjuster_Email = normalizeString(normalized.Adjuster_Email || normalized.adjusterEmail || '');
  normalized.Policy_Number = normalizeString(normalized.Policy_Number || normalized.policyNumber || '');
  normalized.Loss_Date = normalizeString(normalized.Loss_Date || normalized.lossDate || '');
  normalized.Date_Received = normalizeString(normalized.Date_Received || normalized.dateReceived || nowIso());
  normalized.Source_System = normalizeString(normalized.Source_System || normalized.sourceSystem || 'insurance-intake-automation');
  normalized.Source_Email_Thread_ID = normalizeString(normalized.Source_Email_Thread_ID || normalized.sourceEmailThreadId || normalized.gmailThreadId || '');
  normalized.Claim_Folder_ID = normalizeString(normalized.Claim_Folder_ID || normalized.claimFolderId || '');
  normalized.Claim_Folder_URL = normalizeString(normalized.Claim_Folder_URL || normalized.claimFolderUrl || '');
  normalized.Primary_Owner = normalizeString(normalized.Primary_Owner || normalized.primaryOwner || 'Julia');
  normalized.Notes = normalizeString(normalized.Notes || normalized.notes || '');
  normalized.Create_Main_Estimate_Track = normalized.Create_Main_Estimate_Track === true || normalized.createMainEstimateTrack === true;

  return normalized;
}

function validateIntakeClaimPayload_(payload) {
  const errors = [];

  if (!payload.Claim_Number) {
    errors.push('Claim_Number is required.');
  }

  if (!payload.Display_Name) {
    errors.push('Display_Name is required.');
  }

  if (errors.length > 0) {
    return validationErrorResponse(errors);
  }

  return successResponse({ valid: true }, 'Intake claim payload is valid.');
}

function testProcessIntakeClaim() {
  return processIntakeClaim({
    Claim_Number: 'INTAKE-TEST-001',
    Display_Name: 'TEST INTAKE CLAIM',
    Property_Address: '456 Intake Test Road',
    Carrier: 'Test Carrier',
    Adjuster_Name: 'Test Adjuster',
    Adjuster_Email: 'adjuster@example.com',
    Source_System: 'insurance-intake-automation test',
    Source_Email_Thread_ID: 'TEST-INTAKE-THREAD-001',
    Claim_Folder_ID: 'TEST-DRIVE-FOLDER-ID-001',
    Claim_Folder_URL: 'https://drive.google.com/drive/folders/test-folder-id',
    Primary_Owner: 'Julia',
    Notes: 'Test intake claim created during Phase 4 Claim Foundation build.',
    Create_Main_Estimate_Track: true
  });
}