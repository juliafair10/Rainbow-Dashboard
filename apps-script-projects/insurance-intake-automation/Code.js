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


function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'process') {
    return jsonResponse(processInsuranceIntake());
  }

  if (action === 'diagnostics') {
    return jsonResponse(getInsuranceIntakeDiagnostics());
  }

  if (action === 'testTodoist') {
    return jsonResponse(testTodoistConnection());
  }

  if (action === 'listTodoistProjects') {
    return jsonResponse(listTodoistProjects());
  }

  if (action === 'processAsbestos') {
    return jsonResponse(processAsbestosAttachments());
  }

  if (action === 'cleanupAsbestosLabels') {
    return jsonResponse(cleanupProcessedAsbestosLabels());
  }

  // Temporary backward-compatible aliases while the dashboard and labels are being updated.
  if (action === 'processEmsl') {
    return jsonResponse(processAsbestosAttachments());
  }

  if (action === 'cleanupEmslLabels') {
    return jsonResponse(cleanupProcessedAsbestosLabels());
  }

  if (action === 'processItel') {
    return jsonResponse(processItelAttachments());
  }

  if (action === 'cleanupItelLabels') {
    return jsonResponse(cleanupProcessedItelLabels());
  }

  if (action === 'queueHealth') {
    return jsonResponse(getQueueHealth());
  }

  if (action === 'queueHealthAsbestos') {
    return jsonResponse(getAsbestosQueueHealth());
  }

  if (action === 'queueHealthItel') {
    return jsonResponse(getItelQueueHealth());
  }

  if (action === 'queueHealthInsuranceIntake') {
    return jsonResponse(getInsuranceIntakeQueueHealth());
  }

  if (action === 'inspectPendingClaimFolders') {
    return jsonResponse(inspectPendingClaimFolders());
  }

  if (action === 'inspectAsbestosPendingClaimFolders') {
    return jsonResponse(inspectAsbestosPendingClaimFolders());
  }

  if (action === 'inspectItelPendingClaimFolders') {
    return jsonResponse(inspectItelPendingClaimFolders());
  }

  if (action === 'retryWorkflow') {
    return jsonResponse(retryWorkflow(e && e.parameter ? e.parameter.workflow : ''));
  }

  if (action === 'retryInsuranceIntake') {
    return jsonResponse(retryWorkflow('insuranceIntake'));
  }

  if (action === 'retryAsbestos') {
    return jsonResponse(retryWorkflow('asbestos'));
  }

  if (action === 'retryItel') {
    return jsonResponse(retryWorkflow('itel'));
  }

  if (action === 'setupRetryLabels') {
    return jsonResponse(setupRetryLabels());
  }

  if (action === 'setupRetryTriggers') {
    return jsonResponse(setupRetryTriggers());
  }

  if (action === 'deleteRetryTriggers') {
    return jsonResponse(deleteRetryTriggers());
  }

  return jsonResponse({
    status: 'Success',
    message: CONFIG.automationName + ' web app is live.',
    result: {
      availableActions: ['process', 'diagnostics', 'testTodoist', 'listTodoistProjects', 'processAsbestos', 'cleanupAsbestosLabels', 'processItel', 'cleanupItelLabels', 'queueHealth', 'queueHealthAsbestos', 'queueHealthItel', 'queueHealthInsuranceIntake', 'inspectPendingClaimFolders', 'inspectAsbestosPendingClaimFolders', 'inspectItelPendingClaimFolders', 'retryWorkflow', 'retryInsuranceIntake', 'retryAsbestos', 'retryItel', 'setupRetryLabels', 'setupRetryTriggers', 'deleteRetryTriggers'],
      query: CONFIG.gmailQuery
    }
  });
}

function getInsuranceIntakeDiagnostics() {
  return {
    status: 'Success',
    message: 'Insurance Intake diagnostics checked.',
    result: {
      automation: CONFIG.automationName,
      phase: CONFIG.phase,
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
        gmailQuery: CONFIG.gmailQuery,
        intakeLabel: CONFIG.intakeLabel,
        processedLabel: CONFIG.processedLabel,
        errorLabel: CONFIG.errorLabel,
        needsReviewLabel: CONFIG.needsReviewLabel,
        duplicateLabel: CONFIG.duplicateLabel,
        claimFoundationSpreadsheetId: getInsuranceIntakeClaimFoundationSpreadsheetId_(),
        hasClaimFoundationSpreadsheetId: !!getInsuranceIntakeClaimFoundationSpreadsheetId_()
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
    const threads = GmailApp.search(CONFIG.gmailQuery, 0, CONFIG.maxThreadsPerRun);
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
            add: [CONFIG.needsReviewLabel],
            remove: [CONFIG.intakeLabel]
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
                add: [CONFIG.processedLabel],
                remove: [CONFIG.intakeLabel]
              }
            : {
                add: [CONFIG.duplicateLabel],
                remove: [CONFIG.intakeLabel]
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
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
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
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
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
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
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

        if (!sheetResult.success) {
          itemResult.status = 'sheet_update_failed';
          itemResult.errors.push(sheetResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
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
            add: [CONFIG.processedLabel],
            remove: [CONFIG.intakeLabel]
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
            add: [CONFIG.errorLabel],
            remove: [CONFIG.intakeLabel]
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
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        dryRun: CONFIG.dryRun,
        query: CONFIG.gmailQuery,
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
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        dryRun: CONFIG.dryRun,
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
    (typeof CONFIG !== 'undefined' && CONFIG.claimFoundationSpreadsheetId ? CONFIG.claimFoundationSpreadsheetId : '') ||
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
  let rowNumber = findInsuranceIntakeExternalLinkRow_(values, columnMap, {
    claimId: claimId,
    jobNumber: jobNumber,
    claimNumber: claimNumber
  });

  if (!rowNumber) {
    const newRow = headers.map(function(header, index) {
      if (index === columnMap.claimId) return claimId;
      if (index === columnMap.jobNumber) return jobNumber || claimNumber;
      return '';
    });

    sheet.appendRow(newRow);
    rowNumber = sheet.getLastRow();
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

  return {
    rowNumber: rowNumber,
    savedCount: saved.length,
    linksSaved: saved
  };
}

function buildInsuranceIntakeExternalLinkColumnMap_(headers) {
  const normalized = headers.map(function(header) {
    return String(header || '').trim().toLowerCase();
  });

  return {
    claimId: normalized.indexOf('claim id'),
    jobNumber: normalized.indexOf('job number'),
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

    if ((claimIdKey && rowClaimId === claimIdKey) ||
        (jobNumberKey && rowJobNumber === jobNumberKey) ||
        (claimNumberKey && rowJobNumber === claimNumberKey)) {
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

function testLogProcessInsuranceIntake() {
  const result = processInsuranceIntake();
  Logger.log('PROCESS_INSURANCE_INTAKE_START');
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log('PROCESS_INSURANCE_INTAKE_END');
  return result;
}

function buildPhase4CMessage_(summary) {
  return 'Phase ' + CONFIG.phase + ' insurance intake found ' + summary.foundCount +
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

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}