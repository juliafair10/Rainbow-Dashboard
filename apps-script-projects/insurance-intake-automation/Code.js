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
        extractInsuranceClaimNumber_: typeof extractInsuranceClaimNumber_
      },
      config: {
        gmailQuery: CONFIG.gmailQuery,
        intakeLabel: CONFIG.intakeLabel,
        processedLabel: CONFIG.processedLabel,
        errorLabel: CONFIG.errorLabel,
        needsReviewLabel: CONFIG.needsReviewLabel,
        duplicateLabel: CONFIG.duplicateLabel
      }
    }
  };
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