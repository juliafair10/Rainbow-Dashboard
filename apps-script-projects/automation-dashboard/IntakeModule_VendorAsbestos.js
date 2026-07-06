function getAsbestosWorkflowStateLabelsToRemove_() {
  return dedupeLabelNames_([
    INTAKE_CONFIG.asbestosIntakeLabel,
    INTAKE_CONFIG.asbestosNeedsReviewLabel,
    INTAKE_CONFIG.asbestosPendingClaimFolderLabel,
    INTAKE_CONFIG.asbestosErrorLabel,
    INTAKE_CONFIG.retryReadyLabel,
    INTAKE_CONFIG.retryInProgressLabel,
    INTAKE_CONFIG.retryBlockedLabel
  ]);
}

function processAsbestosAttachments() {
  const startedAt = new Date();

  const summary = {
    foundCount: 0,
    parsedCount: 0,
    processedCount: 0,
    folderReadyCount: 0,
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
    const threads = GmailApp.search(INTAKE_CONFIG.asbestosQuery, 0, INTAKE_CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        warnings: [],
        errors: []
      };

      try {
        const claimData = parseInsuranceIntakeThread(thread);
        summary.parsedCount++;

        itemResult.subject = claimData.subject;
        itemResult.claimNumber = claimData.claimNumber;
        itemResult.customerName = claimData.customerName;
        itemResult.extractionDebug = {
          claimNumber: claimData.claimNumber,
          customerName: claimData.customerName,
          source: 'parseInsuranceIntakeThread'
        };

        const attachmentResult = detectThreadAttachments_(thread);
        itemResult.attachmentResult = attachmentResult;
        updateAttachmentSummary_(summary, attachmentResult);

        let folderResult;

        if (!claimData.claimNumber) {
          folderResult = findExistingClaimFolderByLocationForVendor_(claimData, thread);
          itemResult.locationMatchResult = folderResult;

          if (!folderResult.success && claimData.customerName) {
            const customerFallbackResult = findExistingClaimFolderForVendor_(claimData, thread);
            itemResult.customerNameFallbackResult = customerFallbackResult;

            if (customerFallbackResult.success) {
              folderResult = customerFallbackResult;
            }
          }

          if (!folderResult.success) {
            itemResult.status = 'needs_review_missing_claim_number';

            const locationStatus = itemResult.locationMatchResult && itemResult.locationMatchResult.status
              ? itemResult.locationMatchResult.status
              : 'not_checked';
            const locationError = itemResult.locationMatchResult && itemResult.locationMatchResult.error
              ? itemResult.locationMatchResult.error
              : '';
            const customerStatus = itemResult.customerNameFallbackResult && itemResult.customerNameFallbackResult.status
              ? itemResult.customerNameFallbackResult.status
              : 'not_checked';
            const customerError = itemResult.customerNameFallbackResult && itemResult.customerNameFallbackResult.error
              ? itemResult.customerNameFallbackResult.error
              : '';

            itemResult.warnings.push(
              'No claim number could be extracted from Asbestos thread, and neither Location of Property nor customer-name fallback found a confident claim folder match. ' +
              'Location status: ' + locationStatus + '. ' + locationError + ' ' +
              'Customer fallback status: ' + customerStatus + '. ' + customerError
            );

            const labelResult = applyInsuranceIntakeLabels_(thread, {
              add: [INTAKE_CONFIG.asbestosNeedsReviewLabel],
              remove: [INTAKE_CONFIG.asbestosIntakeLabel]
            });

            thread.markUnread();
            itemResult.mailReadState = 'marked_unread';
            itemResult.labelResult = labelResult;

            if (!labelResult.success) {
              itemResult.warnings.push('Asbestos needs-review label update failed: ' + labelResult.error);
              summary.warnings++;
            }

            summary.warnings++;
            items.push(itemResult);
            continue;
          }

          claimData.claimNumber = folderResult.jobNumber || '';
          claimData.customerName = folderResult.customerName || claimData.customerName || '';
          claimData.insuredName = claimData.customerName;
          claimData.lossAddress = folderResult.locationOfProperty || claimData.lossAddress || '';
          itemResult.claimNumber = claimData.claimNumber;
          itemResult.customerName = claimData.customerName;
          itemResult.warnings.push('Matched Asbestos thread to claim folder by fallback matching because claim number was missing.');
          summary.warnings++;
        } else {
          folderResult = findExistingClaimFolderForVendor_(claimData, thread);
        }
        itemResult.folderResult = folderResult;

        if (!folderResult.success) {
          itemResult.status = folderResult.status || 'folder_check_failed';
          itemResult.errors.push(folderResult.error);

          const folderFailureLabel = folderResult.status === 'pending_claim_folder' || folderResult.status === 'vendor_claim_folder_not_found'
            ? INTAKE_CONFIG.asbestosPendingClaimFolderLabel
            : INTAKE_CONFIG.asbestosErrorLabel;

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [folderFailureLabel],
            remove: [INTAKE_CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos folder-status label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const asbestosSubfolderResult = checkOrCreateVendorSubfolder_(folderResult.folderId, INTAKE_CONFIG.asbestosSubfolderName);
        itemResult.asbestosSubfolderResult = asbestosSubfolderResult;

        if (!asbestosSubfolderResult.success) {
          itemResult.status = 'asbestos_subfolder_check_failed';
          itemResult.errors.push(asbestosSubfolderResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.asbestosErrorLabel],
            remove: [INTAKE_CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        summary.folderReadyCount++;

        const asbestosCopyResult = copyEligibleAttachments_({
          workflow: 'Asbestos Attachment Intake',
          vendor: 'Asbestos',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: asbestosSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentCopyResult = asbestosCopyResult;

        if (!asbestosCopyResult.success) {
          itemResult.warnings.push('Asbestos attachment copy update failed: ' + asbestosCopyResult.error);
          summary.warnings++;
        }

        const asbestosLogResult = appendAttachmentLogRows_({
          workflow: 'Asbestos Attachment Intake',
          vendor: 'Asbestos',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: asbestosSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentLogResult = asbestosLogResult;

        if (!asbestosLogResult.success) {
          itemResult.warnings.push('Asbestos attachment log update failed: ' + asbestosLogResult.error);
          summary.warnings++;
        }

        const asbestosManifestResult = writeAttachmentManifest_({
          workflow: 'Asbestos Attachment Intake',
          vendor: 'Asbestos',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: asbestosSubfolderResult,
          attachmentResult: attachmentResult,
          copyResult: asbestosCopyResult,
          logResult: asbestosLogResult
        });
        itemResult.attachmentManifestResult = asbestosManifestResult;

        if (!asbestosManifestResult.success) {
          itemResult.warnings.push('Asbestos attachment manifest update failed: ' + asbestosManifestResult.error);
          summary.warnings++;
        }

        if (attachmentResult.attachmentCount <= 0) {
          itemResult.status = 'needs_review_no_attachments';
          itemResult.warnings.push('No Asbestos attachments were detected.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.asbestosNeedsReviewLabel],
            remove: [INTAKE_CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        itemResult.status = 'asbestos_attachments_detected_folder_ready';

        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [INTAKE_CONFIG.asbestosProcessedLabel],
          remove: getAsbestosWorkflowStateLabelsToRemove_()
        });

        thread.markRead();
        itemResult.mailReadState = 'marked_read';
        itemResult.labelResult = labelResult;

        if (!labelResult.success) {
          itemResult.status = 'asbestos_detected_with_label_warning';
          itemResult.warnings.push('Asbestos processed label update failed: ' + labelResult.error);
          summary.warnings++;
        }

        summary.processedCount++;
        items.push(itemResult);
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);

        try {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [INTAKE_CONFIG.asbestosErrorLabel],
            remove: [INTAKE_CONFIG.asbestosIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Asbestos error label update failed: ' + labelResult.error);
            summary.warnings++;
          }
        } catch (labelError) {
          itemResult.warnings.push('Asbestos error label update threw an exception: ' + labelError.message);
          summary.warnings++;
        }

        summary.errors++;
        items.push(itemResult);
      }
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildAsbestosAttachmentMessage_(summary),
      result: {
        automation: INTAKE_CONFIG.automationName,
        phase: INTAKE_CONFIG.phase,
        workflow: 'Asbestos Attachment Intake',
        dryRun: INTAKE_CONFIG.dryRun,
        query: INTAKE_CONFIG.asbestosQuery,
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
        workflow: 'Asbestos Attachment Intake',
        dryRun: INTAKE_CONFIG.dryRun,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function cleanupProcessedAsbestosLabels() {
  const startedAt = new Date();
  const query = 'label:Asbestos label:"Asbestos/Processed/Asbestos"';
  const summary = {
    foundCount: 0,
    cleanedCount: 0,
    warnings: 0,
    errors: 0
  };
  const items = [];

  try {
    const threads = GmailApp.search(query, 0, INTAKE_CONFIG.maxThreadsPerRun);
    summary.foundCount = threads.length;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];
      const itemResult = {
        threadId: thread.getId(),
        status: 'started',
        warnings: [],
        errors: []
      };

      try {
        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [],
          remove: [INTAKE_CONFIG.asbestosIntakeLabel]
        });

        itemResult.labelResult = labelResult;

        if (labelResult.success) {
          itemResult.status = 'asbestos_source_label_removed';
          summary.cleanedCount++;
        } else {
          itemResult.status = 'asbestos_source_label_remove_warning';
          itemResult.warnings.push(labelResult.error);
          summary.warnings++;
        }
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);
        summary.errors++;
      }

      items.push(itemResult);
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: 'Cleaned ' + summary.cleanedCount + ' Asbestos source label(s) from ' + summary.foundCount + ' processed Asbestos thread(s).',
      result: {
        automation: INTAKE_CONFIG.automationName,
        phase: INTAKE_CONFIG.phase,
        workflow: 'Asbestos Label Cleanup',
        query: query,
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
        workflow: 'Asbestos Label Cleanup',
        query: query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function buildAsbestosAttachmentMessage_(summary) {
  return 'Phase ' + INTAKE_CONFIG.phase + ' Asbestos attachment intake found ' + summary.foundCount +
    ' Asbestos thread(s), parsed ' + summary.parsedCount +
    ', prepared ' + summary.folderReadyCount +
    ' claim folder(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
}

function processEmslAttachments() {
  return processAsbestosAttachments();
}

function buildEmslAttachmentMessage_(summary) {
  return buildAsbestosAttachmentMessage_(summary);
}

function cleanupProcessedEmslLabels() {
  return cleanupProcessedAsbestosLabels();
}

