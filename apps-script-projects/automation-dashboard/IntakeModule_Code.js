/***************************************
 * INSURANCE INTAKE AUTOMATION
 *
 * Dashboard-compatible standalone web app automation.
 ***************************************/

function authorizeTodoistUrlFetch() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('TODOIST_API_TOKEN') || 'authorization-check-only';

  const response = UrlFetchApp.fetch('https://api.todoist.com/api/v1/sync', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token
    },
    payload: JSON.stringify({
      sync_token: '*',
      resource_types: ['projects']
    }),
    muteHttpExceptions: true
  });

  Logger.log('Todoist UrlFetch authorization check complete. HTTP ' + response.getResponseCode());
}


function Intake_doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'process') {
    return Intake_jsonResponse(processInsuranceIntake());
  }

  if (action === 'diagnostics') {
    return Intake_jsonResponse(getInsuranceIntakeDiagnostics());
  }

  if (action === 'testTodoist') {
    return Intake_jsonResponse(testTodoistConnection());
  }

  if (action === 'listTodoistProjects') {
    return Intake_jsonResponse(listTodoistProjects());
  }

  if (action === 'processAsbestos') {
    return Intake_jsonResponse(processAsbestosAttachments());
  }

  if (action === 'cleanupAsbestosLabels') {
    return Intake_jsonResponse(cleanupProcessedAsbestosLabels());
  }

  // Temporary backward-compatible aliases while the dashboard and labels are being updated.
  if (action === 'processEmsl') {
    return Intake_jsonResponse(processAsbestosAttachments());
  }

  if (action === 'cleanupEmslLabels') {
    return Intake_jsonResponse(cleanupProcessedAsbestosLabels());
  }

  if (action === 'processItel') {
    return Intake_jsonResponse(processItelAttachments());
  }

  if (action === 'cleanupItelLabels') {
    return Intake_jsonResponse(cleanupProcessedItelLabels());
  }

  if (action === 'queueHealth') {
    return Intake_jsonResponse(getQueueHealth());
  }

  if (action === 'queueHealthAsbestos') {
    return Intake_jsonResponse(getAsbestosQueueHealth());
  }

  if (action === 'queueHealthItel') {
    return Intake_jsonResponse(getItelQueueHealth());
  }

  if (action === 'queueHealthInsuranceIntake') {
    return Intake_jsonResponse(getInsuranceIntakeQueueHealth());
  }

  if (action === 'inspectPendingClaimFolders') {
    return Intake_jsonResponse(inspectPendingClaimFolders());
  }

  if (action === 'inspectAsbestosPendingClaimFolders') {
    return Intake_jsonResponse(inspectAsbestosPendingClaimFolders());
  }

  if (action === 'inspectItelPendingClaimFolders') {
    return Intake_jsonResponse(inspectItelPendingClaimFolders());
  }

  if (action === 'retryWorkflow') {
    return Intake_jsonResponse(retryWorkflow(e && e.parameter ? e.parameter.workflow : ''));
  }

  if (action === 'retryInsuranceIntake') {
    return Intake_jsonResponse(retryWorkflow('insuranceIntake'));
  }

  if (action === 'retryAsbestos') {
    return Intake_jsonResponse(retryWorkflow('asbestos'));
  }

  if (action === 'retryItel') {
    return Intake_jsonResponse(retryWorkflow('itel'));
  }

  if (action === 'setupRetryLabels') {
    return Intake_jsonResponse(setupRetryLabels());
  }

  if (action === 'setupRetryTriggers') {
    return Intake_jsonResponse(setupRetryTriggers());
  }

  if (action === 'deleteRetryTriggers') {
    return Intake_jsonResponse(deleteRetryTriggers());
  }

  return Intake_jsonResponse({
    status: 'Success',
    message: INTAKE_CONFIG.automationName + ' web app is live.',
    result: {
      availableActions: ['process', 'diagnostics', 'testTodoist', 'listTodoistProjects', 'processAsbestos', 'cleanupAsbestosLabels', 'processItel', 'cleanupItelLabels', 'queueHealth', 'queueHealthAsbestos', 'queueHealthItel', 'queueHealthInsuranceIntake', 'inspectPendingClaimFolders', 'inspectAsbestosPendingClaimFolders', 'inspectItelPendingClaimFolders', 'retryWorkflow', 'retryInsuranceIntake', 'retryAsbestos', 'retryItel', 'setupRetryLabels', 'setupRetryTriggers', 'deleteRetryTriggers'],
      query: INTAKE_CONFIG.gmailQuery
    }
  });
}

function getInsuranceIntakeDiagnostics() {
  return {
    status: 'Success',
    message: 'Insurance Intake diagnostics checked.',
    result: {
      automation: INTAKE_CONFIG.automationName,
      phase: INTAKE_CONFIG.phase,
      checkedAt: new Date(),
      helperFunctions: {
        parseInsuranceIntakeThread: typeof parseInsuranceIntakeThread,
        applyInsuranceIntakeLabels_: typeof applyInsuranceIntakeLabels_,
        detectThreadAttachments_: typeof detectThreadAttachments_,
        updateAttachmentSummary_: typeof updateAttachmentSummary_,
        claimFolderMapHasDuplicate_: typeof claimFolderMapHasDuplicate_,
        checkOrCreateClaimFolder_: typeof checkOrCreateClaimFolder_,
        appendClaimFolderMapRow_: typeof appendClaimFolderMapRow_,
        createOrSkipCalendarDraft_: typeof createOrSkipCalendarDraft_,
        buildInsuranceCalendarTitle_: typeof buildInsuranceCalendarTitle_,
        findHeaderIndex_: typeof findHeaderIndex_,
        isCopyEligibleInsuranceAttachment_: typeof isCopyEligibleInsuranceAttachment_,
        normalizeInsuranceIntakeText_: typeof normalizeInsuranceIntakeText_,
        extractInsuranceClaimNumber_: typeof extractInsuranceClaimNumber_,
        extractInsurancePlatformLinks_: typeof extractInsurancePlatformLinks_,
        saveInsuranceIntakeExternalLinks_: typeof saveInsuranceIntakeExternalLinks_,
        buildInsuranceIntakeExternalLinks_: typeof buildInsuranceIntakeExternalLinks_,
        upsertInsuranceIntakeWideExternalLinks_: typeof upsertInsuranceIntakeWideExternalLinks_,
        getInsuranceIntakeClaimFoundationSpreadsheetId_: typeof getInsuranceIntakeClaimFoundationSpreadsheetId_
      },
      config: {
        gmailQuery: INTAKE_CONFIG.gmailQuery,
        intakeLabel: INTAKE_CONFIG.intakeLabel,
        processedLabel: INTAKE_CONFIG.processedLabel,
        errorLabel: INTAKE_CONFIG.errorLabel,
        needsReviewLabel: INTAKE_CONFIG.needsReviewLabel,
        duplicateLabel: INTAKE_CONFIG.duplicateLabel,
        claimFoundationSpreadsheetId: getInsuranceIntakeClaimFoundationSpreadsheetId_(),
        hasClaimFoundationSpreadsheetId: !!getInsuranceIntakeClaimFoundationSpreadsheetId_(),
        claimsServiceExternalLinksShadowMode: isClaimsServiceExternalLinksShadowEnabled_(),
        claimsServiceExternalLinksPrimaryMode: isClaimsServiceExternalLinksPrimaryEnabled_(),
        hasClaimsServiceWebAppUrl: !!getClaimsServiceWebAppUrl_()
      }
    }
  };
}

function testLogInsuranceIntakeDiagnostics() {
  const result = getInsuranceIntakeDiagnostics();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function processInsuranceIntake() {
  const startedAt = new Date();

  const summary = {
    foundCount: 0,
    parsedCount: 0,
    processedCount: 0,
    sheetRowsAdded: 0,
    duplicatesSkipped: 0,
    warnings: 0,
    errors: 0,
    threadsWithAttachments: 0,
    totalAttachmentsDetected: 0,
    copyEligibleAttachments: 0,
    reviewNeededAttachments: 0,
    skippedAttachments: 0
  };

  const items = [];

  try {
    const threads = GmailApp.search(INTAKE_CONFIG.gmailQuery, 0, INTAKE_CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        duplicate: false,
        sheetUpdated: false,
        warnings: [],
        errors: []
      };

      try {
        const claimData = parseInsuranceIntakeThread(thread);
        summary.parsedCount++;

        itemResult.subject = claimData.subject;
        itemResult.claimNumber = claimData.claimNumber;
        itemResult.customerName = claimData.customerName;
        const attachmentResult = detectThreadAttachments_(thread);
        itemResult.attachmentResult = attachmentResult;
        updateAttachmentSummary_(summary, attachmentResult);

        if (!claimData.claimNumber) {
          itemResult.status = 'needs_review_missing_claim_number';
          itemResult.warnings.push('No claim number could be extracted.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.needsReviewLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Needs-review label update failed: ' + labelResult.error);
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        const duplicateCheck = claimFolderMapHasDuplicate_(claimData, thread);

        if (duplicateCheck.duplicate) {
          itemResult.duplicate = true;
          itemResult.duplicateReason = duplicateCheck.reason;
          itemResult.existingRowNumber = duplicateCheck.rowNumber;

          const labelPlan = duplicateCheck.reason === 'gmail_thread_id_exists'
            ? {
                add: [INTAKE_CONFIG.processedLabel],
                remove: [INTAKE_CONFIG.intakeLabel]
              }
            : {
                add: [INTAKE_CONFIG.duplicateLabel],
                remove: [INTAKE_CONFIG.intakeLabel]
              };

          const labelResult = applyInsuranceIntakeLabels_(thread, labelPlan);
          itemResult.labelResult = labelResult;

          if (duplicateCheck.reason === 'gmail_thread_id_exists') {
            itemResult.status = labelResult.success ? 'already_logged_marked_processed' : 'already_logged_label_warning';
          } else {
            itemResult.status = labelResult.success ? 'duplicate_skipped' : 'duplicate_label_warning';
          }

          if (!labelResult.success) {
            itemResult.warnings.push('Duplicate label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.duplicatesSkipped++;
          items.push(itemResult);
          continue;
        }

        const folderResult = checkOrCreateClaimFolder_(claimData);

        if (!folderResult.success) {
          itemResult.status = 'folder_check_failed';
          itemResult.folderResult = folderResult;
          itemResult.errors.push(folderResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.errorLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const calendarResult = createOrSkipCalendarDraft_(claimData, folderResult, thread);
        itemResult.calendarResult = calendarResult;

        if (!calendarResult.success) {
          itemResult.status = 'calendar_event_failed';
          itemResult.errors.push(calendarResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.errorLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const todoistResult = createOrSkipTodoistIntakeTask_(claimData, folderResult, thread);
        itemResult.todoistResult = todoistResult;

        if (!todoistResult.success) {
          itemResult.status = 'todoist_task_failed';
          itemResult.errors.push(todoistResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.errorLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const sheetResult = appendClaimFolderMapRow_(claimData, folderResult, thread);

        itemResult.folderResult = folderResult;
        itemResult.sheetResult = sheetResult;
        itemResult.sheetUpdated = sheetResult.sheetUpdated;

        const externalLinkResult = saveInsuranceIntakeExternalLinks_(claimData, folderResult);
        itemResult.externalLinkResult = externalLinkResult;

        if (externalLinkResult.warning) {
          itemResult.warnings.push(externalLinkResult.warning);
          summary.warnings++;
        }

        if (externalLinkResult.claimsServiceShadowResult && externalLinkResult.claimsServiceShadowResult.warning) {
          itemResult.warnings.push(externalLinkResult.claimsServiceShadowResult.warning);
          summary.warnings++;
        }

        if (!sheetResult.success) {
          itemResult.status = 'sheet_update_failed';
          itemResult.errors.push(sheetResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.errorLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        if (sheetResult.dryRun) {
          itemResult.status = 'dry_run_sheet_append_skipped';
        } else {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.processedLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.status = 'processed_with_label_warning';
            itemResult.warnings.push('Processed label update failed: ' + labelResult.error);
            summary.warnings++;
          } else {
            itemResult.status = 'processed';
          }

          summary.processedCount++;
          summary.sheetRowsAdded++;
        }

        items.push(itemResult);
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);

        try {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.errorLabel],
            remove: [INTAKE_CONFIG.intakeLabel]
          });

          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Error label update failed: ' + labelResult.error);
            summary.warnings++;
          }
        } catch (labelError) {
          itemResult.warnings.push('Error label update threw an exception: ' + labelError.message);
          summary.warnings++;
        }

        summary.errors++;
        items.push(itemResult);
      }
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildPhase4CMessage_(summary),
      result: {
        automation: INTAKE_CONFIG.automationName,
        phase: INTAKE_CONFIG.phase,
        dryRun: INTAKE_CONFIG.dryRun,
        query: INTAKE_CONFIG.gmailQuery,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        items: items
      }
    };
  } catch (error) {
    summary.errors++;

    return {
      status: 'Error',
      message: error.message,
      result: {
        automation: INTAKE_CONFIG.automationName,
        phase: INTAKE_CONFIG.phase,
        dryRun: INTAKE_CONFIG.dryRun,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function saveInsuranceIntakeExternalLinks_(claimData, folderResult) {
  const linksToSave = buildInsuranceIntakeExternalLinks_(claimData, folderResult);

  if (!linksToSave.length) {
    return {
      status: 'Skipped',
      success: true,
      savedCount: 0,
      message: 'No intake external links found to save.'
    };
  }

  const claimsServicePayload = buildClaimsServiceExternalLinksPayload_(claimData, folderResult, linksToSave);
  const useClaimsServicePrimary = isClaimsServiceExternalLinksPrimaryEnabled_();
  const useClaimsServiceShadow = isClaimsServiceExternalLinksShadowEnabled_();

  if (useClaimsServicePrimary) {
    const claimsServiceResult = callClaimsServiceSaveIntakeExternalLinks_(claimsServicePayload);

    if (claimsServiceResult && claimsServiceResult.ok) {
      return {
        status: 'Success',
        success: true,
        savedCount: getClaimsServiceSavedCount_(claimsServiceResult),
        primaryWriter: 'claims-service',
        claimsServiceResult: claimsServiceResult,
        linksFound: linksToSave
      };
    }

    const fallbackResult = saveInsuranceIntakeExternalLinksDirect_(claimData, linksToSave);
    fallbackResult.primaryWriter = 'direct-fallback';
    fallbackResult.claimsServiceFallbackReason = claimsServiceResult ? claimsServiceResult.error : 'Claims Service returned no result.';
    fallbackResult.warning = (fallbackResult.warning ? fallbackResult.warning + ' ' : '') + 'Claims Service external-link write failed; direct fallback was used.';
    fallbackResult.claimsServiceResult = claimsServiceResult;
    return fallbackResult;
  }

  const directWriteResult = saveInsuranceIntakeExternalLinksDirect_(claimData, linksToSave);

  if (useClaimsServiceShadow) {
    const shadowPayload = Object.assign({}, claimsServicePayload, {
      shadowMode: true,
      allowCreate: false
    });
    const claimsServiceResult = callClaimsServiceSaveIntakeExternalLinks_(shadowPayload);
    directWriteResult.primaryWriter = 'direct';
    directWriteResult.claimsServiceShadowResult = buildClaimsServiceShadowSummary_(claimsServiceResult);
    directWriteResult.claimsServiceShadowPayload = buildClaimsServiceShadowPayloadSummary_(shadowPayload);
  }

  return directWriteResult;
}

function saveInsuranceIntakeExternalLinksDirect_(claimData, linksToSave) {
  const spreadsheetId = getInsuranceIntakeClaimFoundationSpreadsheetId_();

  if (!spreadsheetId) {
    return {
      status: 'Skipped',
      success: true,
      savedCount: 0,
      warning: 'External_Links not saved because claim foundation spreadsheet ID is not configured.',
      linksFound: linksToSave
    };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName('External_Links');

    if (!sheet) {
      return {
        status: 'Skipped',
        success: true,
        savedCount: 0,
        warning: 'External_Links sheet was not found in configured claim foundation spreadsheet.',
        linksFound: linksToSave
      };
    }

    const result = upsertInsuranceIntakeWideExternalLinks_(sheet, claimData, linksToSave);

    return {
      status: 'Success',
      success: true,
      savedCount: result.savedCount,
      rowNumber: result.rowNumber,
      linksSaved: result.linksSaved
    };
  } catch (err) {
    return {
      status: 'Skipped',
      success: true,
      savedCount: 0,
      warning: 'External_Links save failed: ' + err.message,
      linksFound: linksToSave
    };
  }
}

function buildClaimsServiceExternalLinksPayload_(claimData, folderResult, linksToSave) {
  const claimId = String(claimData && claimData.claimId || '').trim();
  const jobNumber = String(claimData && claimData.rainbowJobNumber || '').trim();
  const rawClaimNumber = String(claimData && claimData.claimNumber || '').trim();
  // Parity guard (Phase 11C): the direct-write path suppresses a job-number
  // fallback via isRealIntakeClaimNumber_. Apply the same guard before sending
  // the payload so Claims Service never receives a job number masquerading as a
  // Claim Number. The request contract is otherwise unchanged.
  const claimNumber = isRealIntakeClaimNumber_(rawClaimNumber, jobNumber) ? rawClaimNumber : '';
  const carrier = String(claimData && claimData.carrier || '').trim();

  const payload = {
    claimId: claimId,
    Claim_ID: claimId,
    'Claim ID': claimId,
    jobNumber: jobNumber,
    Job_Number: jobNumber,
    'Job Number': jobNumber,
    claimNumber: claimNumber,
    Claim_Number: claimNumber,
    'Claim Number': claimNumber,
    carrier: carrier,
    Carrier: carrier,
    source: 'Insurance Intake',
    Source: 'Insurance Intake',
    driveFolderUrl: getInsuranceIntakeFolderUrl_(folderResult)
  };

  linksToSave.forEach(function(link) {
    const normalizedType = String(link && link.linkType || '').trim().toLowerCase();
    const url = String(link && link.url || '').trim();

    if (!url) {
      return;
    }

    if (normalizedType.indexOf('fusion') !== -1) {
      payload.fusionUrl = url;
    } else if (normalizedType.indexOf('xact') !== -1 || normalizedType === 'xa') {
      payload.xactAnalysis = url;
    } else if (normalizedType.indexOf('symbility') !== -1) {
      payload.symbility = url;
    } else if (normalizedType.indexOf('claimx') !== -1 || normalizedType.indexOf('claim x') !== -1) {
      payload.claimX = url;
    } else if (normalizedType.indexOf('drive') !== -1 || normalizedType.indexOf('folder') !== -1) {
      payload.driveFolderUrl = url;
    } else if (!payload.otherLinks) {
      payload.otherLinks = url;
    }
  });

  return payload;
}

function callClaimsServiceSaveIntakeExternalLinks_(payload) {
  const serviceUrl = getClaimsServiceWebAppUrl_();

  if (!serviceUrl) {
    return {
      ok: false,
      statusCode: 0,
      response: null,
      error: 'Claims Service web app URL is not configured.'
    };
  }

  try {
    const response = UrlFetchApp.fetch(serviceUrl + '?action=saveIntakeExternalLinks', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const text = response.getContentText() || '';
    let parsed = null;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (parseError) {
      return {
        ok: false,
        statusCode: statusCode,
        responseText: text,
        response: null,
        error: 'Claims Service returned malformed JSON: ' + parseError.message
      };
    }

    const ok = statusCode >= 200 && statusCode < 300 && !!parsed && parsed.success !== false;

    return {
      ok: ok,
      statusCode: statusCode,
      response: parsed,
      error: ok ? '' : (parsed && parsed.message ? parsed.message : 'Claims Service returned HTTP ' + statusCode)
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: 0,
      response: null,
      error: err.message
    };
  }
}

function getClaimsServiceWebAppUrl_() {
  const props = PropertiesService.getScriptProperties();
  const configuredPropertyName = INTAKE_CONFIG.claimsService && INTAKE_CONFIG.claimsService.webAppUrlProperty
    ? INTAKE_CONFIG.claimsService.webAppUrlProperty
    : 'CLAIMS_SERVICE_WEB_APP_URL';

  return String(props.getProperty(configuredPropertyName) ||
    props.getProperty('RAINBOW_CLAIMS_SERVICE_WEB_APP_URL') ||
    (INTAKE_CONFIG.claimsService && INTAKE_CONFIG.claimsService.fallbackWebAppUrl ? INTAKE_CONFIG.claimsService.fallbackWebAppUrl : '') ||
    '').trim();
}

function isClaimsServiceExternalLinksShadowEnabled_() {
  if (!INTAKE_CONFIG.claimsService || INTAKE_CONFIG.claimsService.enabled === false) {
    return false;
  }

  const props = PropertiesService.getScriptProperties();
  const override = String(props.getProperty('CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE') || '').trim().toLowerCase();

  if (override === 'true') return true;
  if (override === 'false') return false;

  return INTAKE_CONFIG.claimsService.externalLinksShadowMode === true;
}

function isClaimsServiceExternalLinksPrimaryEnabled_() {
  if (!INTAKE_CONFIG.claimsService || INTAKE_CONFIG.claimsService.enabled === false) {
    return false;
  }

  const props = PropertiesService.getScriptProperties();
  const override = String(props.getProperty('USE_CLAIMS_SERVICE_EXTERNAL_LINKS') || '').trim().toLowerCase();

  if (override === 'true') return true;
  if (override === 'false') return false;

  return INTAKE_CONFIG.claimsService.externalLinksPrimaryMode === true;
}

function buildClaimsServiceShadowSummary_(claimsServiceResult) {
  if (!claimsServiceResult) {
    return {
      ok: false,
      warning: 'Claims Service shadow write returned no result.'
    };
  }

  const summary = {
    ok: claimsServiceResult.ok,
    statusCode: claimsServiceResult.statusCode,
    error: claimsServiceResult.error || '',
    responseStatus: claimsServiceResult.response && claimsServiceResult.response.status,
    responseSuccess: claimsServiceResult.response && claimsServiceResult.response.success,
    message: claimsServiceResult.response && claimsServiceResult.response.message,
    errors: claimsServiceResult.response && claimsServiceResult.response.errors,
    data: claimsServiceResult.response && claimsServiceResult.response.data,
    fullResponse: claimsServiceResult.response
  };

  if (!claimsServiceResult.ok) {
    summary.warning = 'Claims Service shadow external-link write failed: ' + (claimsServiceResult.error || 'Unknown error');
  }

  return summary;
}

function buildClaimsServiceShadowPayloadSummary_(payload) {
  return {
    claimId: payload && payload.claimId,
    jobNumber: payload && payload.jobNumber,
    claimNumber: payload && payload.claimNumber,
    carrier: payload && payload.carrier,
    driveFolderUrl: payload && payload.driveFolderUrl,
    fusionUrl: payload && payload.fusionUrl,
    xactAnalysis: payload && payload.xactAnalysis,
    symbility: payload && payload.symbility,
    claimX: payload && payload.claimX,
    otherLinks: payload && payload.otherLinks,
    shadowMode: payload && payload.shadowMode,
    allowCreate: payload && payload.allowCreate
  };
}

function getClaimsServiceSavedCount_(claimsServiceResult) {
  const data = claimsServiceResult && claimsServiceResult.response && claimsServiceResult.response.data;

  if (!data) {
    return 0;
  }

  return Number(data.createdCount || 0) + Number(data.updatedCount || 0);
}

function buildInsuranceIntakeExternalLinks_(claimData, folderResult) {
  const links = [];
  const platformLinks = claimData && Array.isArray(claimData.platformLinks) ? claimData.platformLinks : [];

  platformLinks.forEach(function(link) {
    if (!link || !link.url || !link.linkType) {
      return;
    }

    links.push({
      linkType: link.linkType,
      url: link.url
    });
  });

  const folderUrl = getInsuranceIntakeFolderUrl_(folderResult);

  if (folderUrl) {
    links.push({
      linkType: 'Drive Folder',
      url: folderUrl
    });
  }

  return links;
}

function getInsuranceIntakeFolderUrl_(folderResult) {
  if (!folderResult) {
    return '';
  }

  if (folderResult.folderUrl) return folderResult.folderUrl;
  if (folderResult.url) return folderResult.url;
  if (folderResult.claimFolderUrl) return folderResult.claimFolderUrl;

  const folderId = folderResult.folderId || folderResult.claimFolderId || folderResult.id || '';

  if (folderId) {
    return 'https://drive.google.com/drive/folders/' + folderId;
  }

  return '';
}

function getInsuranceIntakeClaimFoundationSpreadsheetId_() {
  const props = PropertiesService.getScriptProperties();

  return props.getProperty('RAINBOW_CLAIM_FOUNDATION_SPREADSHEET_ID') ||
    props.getProperty('CLAIM_FOUNDATION_SPREADSHEET_ID') ||
    props.getProperty('RAINBOW_CLAIMS_DATABASE_SPREADSHEET_ID') ||
    (typeof INTAKE_CONFIG !== 'undefined' && INTAKE_CONFIG.claimFoundationSpreadsheetId ? INTAKE_CONFIG.claimFoundationSpreadsheetId : '') ||
    '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';
}

function upsertInsuranceIntakeWideExternalLinks_(sheet, claimData, linksToSave) {
  const values = sheet.getDataRange().getValues();

  if (!values.length) {
    throw new Error('External_Links sheet has no header row.');
  }

  const headers = values[0].map(function(header) {
    return String(header || '').trim();
  });
  const columnMap = buildInsuranceIntakeExternalLinkColumnMap_(headers);
  const jobNumber = String(claimData.rainbowJobNumber || '').trim();
  const claimId = String(claimData.claimId || '').trim();
  const claimNumber = String(claimData.claimNumber || '').trim();
  const carrier = String(claimData.carrier || '').trim();

  // Auto-ensure Claim Number column header exists. Idempotent: skips if already present.
  if (columnMap.claimNumber === -1) {
    const newColIndex = headers.length;
    sheet.getRange(1, newColIndex + 1).setValue('Claim Number');
    headers.push('Claim Number');
    columnMap.claimNumber = newColIndex;
  }

  // Auto-ensure Carrier column header exists. Idempotent: skips if already present.
  if (columnMap.carrier === -1) {
    const newColIndex = headers.length;
    sheet.getRange(1, newColIndex + 1).setValue('Carrier');
    headers.push('Carrier');
    columnMap.carrier = newColIndex;
  }

  // Guard: only write claim number if it is a real insurance claim number (not a fallback).
  const isRealClaimNumber = isRealIntakeClaimNumber_(claimNumber, jobNumber);

  let rowNumber = findInsuranceIntakeExternalLinkRow_(values, columnMap, {
    claimId: claimId,
    jobNumber: jobNumber,
    claimNumber: claimNumber
  });
  let rowCreated = false;

  if (!rowNumber) {
    const newRow = headers.map(function(header, index) {
      if (index === columnMap.claimId) return claimId;
      if (index === columnMap.jobNumber) return jobNumber || claimNumber;
      if (index === columnMap.claimNumber && isRealClaimNumber) return claimNumber;
      if (index === columnMap.carrier && carrier) return carrier;
      return '';
    });

    sheet.appendRow(newRow);
    rowNumber = sheet.getLastRow();
    rowCreated = true;
  }

  const saved = [];

  linksToSave.forEach(function(link) {
    const columnIndex = getInsuranceIntakeExternalLinkColumnIndex_(columnMap, link.linkType);

    if (columnIndex === -1 || !link.url) {
      return;
    }

    const range = sheet.getRange(rowNumber, columnIndex + 1);
    const existingValue = String(range.getValue() || '').trim();

    if (!existingValue) {
      range.setValue(link.url);
      saved.push(link);
    }
  });

  // For existing rows: write claim number to Claim Number column if blank and number is real.
  // For new rows: already written via appendRow above; skip to avoid redundant write.
  let claimNumberWritten = rowCreated && isRealClaimNumber;
  let claimNumberSkippedReason = '';

  if (!rowCreated && isRealClaimNumber && columnMap.claimNumber !== -1) {
    const claimNumberRange = sheet.getRange(rowNumber, columnMap.claimNumber + 1);
    const existingClaimNumber = String(claimNumberRange.getValue() || '').trim();

    if (!existingClaimNumber) {
      claimNumberRange.setValue(claimNumber);
      claimNumberWritten = true;
    } else {
      claimNumberSkippedReason = 'existing_value_preserved';
    }
  } else if (!isRealClaimNumber) {
    claimNumberSkippedReason = claimNumber ? 'fallback_equals_job_number' : 'blank_claim_number';
  }

  // For existing rows: write carrier to Carrier column if blank and carrier is non-empty.
  // For new rows: already written via appendRow above; skip to avoid redundant write.
  let carrierWritten = rowCreated && !!carrier;

  if (!rowCreated && carrier && columnMap.carrier !== -1) {
    const carrierRange = sheet.getRange(rowNumber, columnMap.carrier + 1);
    const existingCarrier = String(carrierRange.getValue() || '').trim();

    if (!existingCarrier) {
      carrierRange.setValue(carrier);
      carrierWritten = true;
    }
  }

  return {
    rowNumber: rowNumber,
    savedCount: saved.length,
    linksSaved: saved,
    claimNumberWritten: claimNumberWritten,
    claimNumberSkippedReason: claimNumberSkippedReason,
    carrierWritten: carrierWritten
  };
}

function buildInsuranceIntakeExternalLinkColumnMap_(headers) {
  const normalized = headers.map(function(header) {
    return String(header || '').trim().toLowerCase();
  });

  return {
    claimId: normalized.indexOf('claim id'),
    jobNumber: normalized.indexOf('job number'),
    claimNumber: normalized.indexOf('claim number'),
    carrier: normalized.indexOf('carrier'),
    fusionUrl: normalized.indexOf('fusion url'),
    driveFolder: normalized.indexOf('drive folder'),
    xactAnalysis: normalized.indexOf('xactanalysis'),
    symbility: normalized.indexOf('symbility'),
    claimX: normalized.indexOf('claimx')
  };
}

function findInsuranceIntakeExternalLinkRow_(values, columnMap, identity) {
  const claimIdKey = normalizeInsuranceIntakeLinkKey_(identity.claimId);
  const jobNumberKey = normalizeInsuranceIntakeLinkKey_(identity.jobNumber);
  const claimNumberKey = normalizeInsuranceIntakeLinkKey_(identity.claimNumber);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const rowClaimId = columnMap.claimId !== -1 ? normalizeInsuranceIntakeLinkKey_(row[columnMap.claimId]) : '';
    const rowJobNumber = columnMap.jobNumber !== -1 ? normalizeInsuranceIntakeLinkKey_(row[columnMap.jobNumber]) : '';
    const rowClaimNumber = columnMap.claimNumber !== -1 ? normalizeInsuranceIntakeLinkKey_(row[columnMap.claimNumber]) : '';

    if (claimIdKey && rowClaimId && rowClaimId === claimIdKey) {
      return rowIndex + 1;
    }

    if (jobNumberKey && rowJobNumber && rowJobNumber === jobNumberKey) {
      return rowIndex + 1;
    }

    if (claimNumberKey && rowClaimNumber && rowClaimNumber === claimNumberKey) {
      return rowIndex + 1;
    }

    // Legacy fallback: before Claim Number was added, some rows stored claim
    // numbers in Job Number. Keep this compatibility during migration.
    if (claimNumberKey && rowJobNumber && rowJobNumber === claimNumberKey) {
      return rowIndex + 1;
    }
  }

  return 0;
}

function getInsuranceIntakeExternalLinkColumnIndex_(columnMap, linkType) {
  const normalized = String(linkType || '').trim().toLowerCase();

  if (normalized.indexOf('symbility') !== -1) return columnMap.symbility;
  if (normalized.indexOf('xact') !== -1 || normalized === 'xa') return columnMap.xactAnalysis;
  if (normalized.indexOf('claimx') !== -1 || normalized.indexOf('claim x') !== -1) return columnMap.claimX;
  if (normalized.indexOf('drive') !== -1 || normalized.indexOf('folder') !== -1) return columnMap.driveFolder;
  if (normalized.indexOf('fusion') !== -1) return columnMap.fusionUrl;

  return -1;
}

function normalizeInsuranceIntakeLinkKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^clm-/, '')
    .replace(/\.0$/, '');
}

function testParseInsurancePlatformLinks() {
  const sample = 'Click here to view the claim latest activity: https://www.symbility.net/Claims/JournalEntryList.aspx?r=abc123\nView detailed information for this assignment in XactAnalysis. https://www.xactanalysis.com/apps/assignment?id=123';
  const result = extractInsurancePlatformLinks_(sample);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testSaveInsuranceIntakeExternalLinks() {
  const claimData = {
    claimId: 'TEST-INSURANCE-INTAKE-LINKS',
    rainbowJobNumber: 'TEST-INSURANCE-INTAKE-LINKS',
    claimNumber: 'TEST-INSURANCE-INTAKE-LINKS',
    platformLinks: [
      {
        linkType: 'Symbility',
        url: 'https://www.symbility.net/Claims/JournalEntryList.aspx?r=test-insurance-intake-links'
      },
      {
        linkType: 'XactAnalysis',
        url: 'https://www.xactanalysis.com/apps/assignment?id=test-insurance-intake-links'
      }
    ]
  };

  const folderResult = {
    success: true,
    folderId: 'test-folder-id-insurance-intake-links'
  };

  const result = saveInsuranceIntakeExternalLinks_(claimData, folderResult);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function testClaimsServiceSaveIntakeExternalLinksBridge() {
  const claimData = {
    claimId: 'CLM-TEST-INTAKE-BRIDGE',
    rainbowJobNumber: 'TEST-JOB-INTAKE-BRIDGE',
    claimNumber: 'TEST-CLAIM-INTAKE-BRIDGE',
    carrier: 'Test Carrier',
    platformLinks: [
      {
        linkType: 'Fusion',
        url: 'https://example.com/fusion/intake-bridge'
      },
      {
        linkType: 'XactAnalysis',
        url: 'https://example.com/xact/intake-bridge'
      }
    ]
  };

  const folderResult = {
    success: true,
    folderUrl: 'https://drive.google.com/drive/folders/intake-bridge'
  };

  const linksToSave = buildInsuranceIntakeExternalLinks_(claimData, folderResult);
  const payload = buildClaimsServiceExternalLinksPayload_(claimData, folderResult, linksToSave);
  const result = callClaimsServiceSaveIntakeExternalLinks_(payload);

  Logger.log(JSON.stringify({
    payload: payload,
    result: result
  }, null, 2));

  return {
    status: result.ok ? 'Success' : 'Error',
    success: result.ok,
    payload: payload,
    result: result
  };
}

function testInsuranceIntakeExternalLinksShadowOrder() {
  const claimData = {
    claimId: '',
    rainbowJobNumber: '',
    claimNumber: 'TEST-CLAIM-SHADOW-ORDER-' + new Date().getTime(),
    carrier: 'Test Carrier',
    platformLinks: []
  };

  const folderResult = {
    success: true,
    folderUrl: 'https://drive.google.com/drive/folders/shadow-order'
  };

  const linksToSave = buildInsuranceIntakeExternalLinks_(claimData, folderResult);
  const payload = buildClaimsServiceExternalLinksPayload_(claimData, folderResult, linksToSave);
  const result = saveInsuranceIntakeExternalLinks_(claimData, folderResult);

  Logger.log(JSON.stringify({
    payload: payload,
    result: result
  }, null, 2));

  return {
    payload: payload,
    result: result
  };
}

/**
 * Returns true if claimNumber is a real insurance claim number —
 * i.e. non-blank and NOT equal (normalized) to rainbowJobNumber.
 *
 * parseInsuranceIntakeThread() sets claimNumber = fusionJobNumber as a
 * fallback when no real claim number can be extracted. We must not
 * write that fallback value into the Claim Number column.
 */
function isRealIntakeClaimNumber_(claimNumber, rainbowJobNumber) {
  var cleanClaim = String(claimNumber || '').trim();

  if (!cleanClaim) {
    return false;
  }

  var normClaim = cleanClaim.toUpperCase().replace(/\s+/g, '');
  var normJob = String(rainbowJobNumber || '').trim().toUpperCase().replace(/\s+/g, '');

  // If rainbowJobNumber is blank we cannot confirm it's a fallback — allow write.
  if (!normJob) {
    return true;
  }

  return normClaim !== normJob;
}

/**
 * Ensures the Claim Number column header exists in External_Links.
 * Safe to run multiple times — idempotent.
 * Only touches row 1 (the header row) if the column is missing.
 * Never modifies data rows, never writes link values.
 *
 * Returns an object with:
 *   success            — whether the operation completed without error
 *   status             — 'already_exists' | 'column_added'
 *   claimNumberColumn  — 1-based column index of Claim Number (before and after)
 *   headersBefore      — header row as it was when the function ran
 *   headersAfter       — header row after any change (same as before if no change needed)
 */
function ensureExternalLinksClaimNumberColumn() {
  const spreadsheetId = getInsuranceIntakeClaimFoundationSpreadsheetId_();

  if (!spreadsheetId) {
    const result = {
      success: false,
      status: 'missing_spreadsheet_id',
      message: 'Claim Foundation spreadsheet ID is not configured.'
    };
    Logger.log('[ensureExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('External_Links');

  if (!sheet) {
    const result = {
      success: false,
      status: 'sheet_not_found',
      message: 'External_Links sheet not found in configured spreadsheet.'
    };
    Logger.log('[ensureExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    const result = {
      success: false,
      status: 'sheet_empty',
      message: 'External_Links sheet has no columns.'
    };
    Logger.log('[ensureExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  const headerRow = headerRange.getValues()[0].map(function(h) { return String(h || '').trim(); });
  const normalized = headerRow.map(function(h) { return h.toLowerCase(); });
  const existingIdx = normalized.indexOf('claim number');

  if (existingIdx !== -1) {
    const result = {
      success: true,
      status: 'already_exists',
      claimNumberColumn: existingIdx + 1,
      headersBefore: headerRow,
      headersAfter: headerRow
    };
    Logger.log('[ensureExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  // Column is missing — append it to row 1 only.
  const newColumnIndex = lastColumn + 1;
  sheet.getRange(1, newColumnIndex).setValue('Claim Number');

  const headersAfter = headerRow.concat(['Claim Number']);

  const result = {
    success: true,
    status: 'column_added',
    claimNumberColumn: newColumnIndex,
    headersBefore: headerRow,
    headersAfter: headersAfter
  };
  Logger.log('[ensureExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
  return result;
}

/**
 * Preview the state of the Claim Number column in External_Links.
 * Run this to confirm the column is present (or not) before deploying.
 * Logs the result and returns it.
 */
function previewExternalLinksClaimNumberColumn() {
  const spreadsheetId = getInsuranceIntakeClaimFoundationSpreadsheetId_();

  if (!spreadsheetId) {
    const result = { success: false, message: 'Claim Foundation spreadsheet ID not configured.' };
    Logger.log('[previewExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('External_Links');

  if (!sheet) {
    const result = { success: false, message: 'External_Links sheet not found in configured spreadsheet.' };
    Logger.log('[previewExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  const values = sheet.getDataRange().getValues();

  if (!values.length) {
    const result = { success: false, message: 'External_Links sheet is empty.' };
    Logger.log('[previewExternalLinksClaimNumberColumn] ' + JSON.stringify(result));
    return result;
  }

  const headerRow = values[0].map(function(h) { return String(h || '').trim(); });
  const normalizedHeaders = headerRow.map(function(h) { return h.toLowerCase(); });
  const claimNumberColIdx = normalizedHeaders.indexOf('claim number');
  const jobNumberColIdx = normalizedHeaders.indexOf('job number');
  const claimIdColIdx = normalizedHeaders.indexOf('claim id');

  const sampleRows = [];

  for (var i = 1; i < Math.min(values.length, 6); i++) {
    const row = values[i];
    sampleRows.push({
      rowNumber: i + 1,
      claimId: claimIdColIdx !== -1 ? String(row[claimIdColIdx] || '').trim() : '(col not found)',
      jobNumber: jobNumberColIdx !== -1 ? String(row[jobNumberColIdx] || '').trim() : '(col not found)',
      claimNumber: claimNumberColIdx !== -1 ? String(row[claimNumberColIdx] || '').trim() : '(col not present)'
    });
  }

  const result = {
    success: true,
    generatedAt: new Date().toISOString(),
    claimNumberColumnExists: claimNumberColIdx !== -1,
    claimNumberColumnIndex: claimNumberColIdx !== -1 ? claimNumberColIdx + 1 : null,
    totalColumns: headerRow.length,
    totalDataRows: values.length - 1,
    headers: headerRow,
    sampleRows: sampleRows
  };

  Logger.log('[previewExternalLinksClaimNumberColumn] ' + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Verifies the fallback guard logic without touching any sheets or Gmail.
 * All test cases run in-memory. Run this after deploying to confirm
 * isRealIntakeClaimNumber_ behaves correctly.
 */
function testInsuranceIntakeClaimNumberPersistence() {
  const testCases = [
    {
      label: 'Real claim number',
      claimNumber: 'INS-2025-999888',
      rainbowJobNumber: 'R25001',
      expectedReal: true
    },
    {
      label: 'Fallback: claimNumber === rainbowJobNumber',
      claimNumber: 'R25001',
      rainbowJobNumber: 'R25001',
      expectedReal: false
    },
    {
      label: 'Fallback: case-insensitive match',
      claimNumber: 'r25001',
      rainbowJobNumber: 'R25001',
      expectedReal: false
    },
    {
      label: 'Fallback: whitespace-normalized match',
      claimNumber: 'R 25001',
      rainbowJobNumber: 'R25001',
      expectedReal: false
    },
    {
      label: 'Blank claim number',
      claimNumber: '',
      rainbowJobNumber: 'R25001',
      expectedReal: false
    },
    {
      label: 'Blank rainbowJobNumber — cannot confirm fallback, allow write',
      claimNumber: 'INS-2025-888777',
      rainbowJobNumber: '',
      expectedReal: true
    },
    {
      label: 'Both blank',
      claimNumber: '',
      rainbowJobNumber: '',
      expectedReal: false
    }
  ];

  const results = testCases.map(function(tc) {
    const isReal = isRealIntakeClaimNumber_(tc.claimNumber, tc.rainbowJobNumber);
    const passed = isReal === tc.expectedReal;
    return {
      label: tc.label,
      claimNumber: tc.claimNumber,
      rainbowJobNumber: tc.rainbowJobNumber,
      isReal: isReal,
      expectedReal: tc.expectedReal,
      passed: passed
    };
  });

  const allPassed = results.every(function(r) { return r.passed; });
  const passedCount = results.filter(function(r) { return r.passed; }).length;

  Logger.log('[testInsuranceIntakeClaimNumberPersistence] allPassed=' + allPassed +
    ' (' + passedCount + '/' + results.length + ')');
  Logger.log(JSON.stringify(results, null, 2));

  return {
    success: true,
    allPassed: allPassed,
    passedCount: passedCount,
    failedCount: results.length - passedCount,
    results: results
  };
}

function testLogProcessInsuranceIntake() {
  const result = processInsuranceIntake();
  Logger.log('PROCESS_INSURANCE_INTAKE_START');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('PROCESS_INSURANCE_INTAKE_END');
  return result;
}

function buildPhase4CMessage_(summary) {
  return 'Phase ' + INTAKE_CONFIG.phase + ' insurance intake found ' + summary.foundCount +
    ' thread(s), parsed ' + summary.parsedCount +
    ', processed ' + summary.processedCount +
    ', added ' + summary.sheetRowsAdded +
    ' sheet row(s), skipped ' + summary.duplicatesSkipped +
    ' duplicate(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
}

function Intake_jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}