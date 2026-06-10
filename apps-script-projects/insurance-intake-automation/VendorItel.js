function getItelWorkflowStateLabelsToRemove_() {
  return dedupeLabelNames_([
    CONFIG.itelIntakeLabel,
    CONFIG.itelNeedsReviewLabel,
    CONFIG.itelPendingClaimFolderLabel,
    CONFIG.itelErrorLabel,
    CONFIG.retryReadyLabel,
    CONFIG.retryInProgressLabel,
    CONFIG.retryBlockedLabel
  ]);
}

function processItelAttachments() {
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
    const threads = GmailApp.search(CONFIG.itelQuery, 0, CONFIG.maxThreadsPerRun);
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

        if (!claimData.claimNumber) {
          itemResult.extractionDebug.itelFallbackVersion = '2026-05-20-v2';

          const itelClaimSearchParts = [
            itemResult.subject || '',
            claimData.subject || '',
            thread.getFirstMessageSubject ? thread.getFirstMessageSubject() : ''
          ];

          const itelMessages = thread.getMessages();

          itelMessages.forEach(function(message) {
            itelClaimSearchParts.push(message.getSubject() || '');
            itelClaimSearchParts.push(message.getPlainBody() || '');
          });

          const itelClaimSearchText = itelClaimSearchParts.join('\n');
          const itelClaimMatch = String(itelClaimSearchText || '').match(/clm\s*#?\s*(\d{8,12})|claim\s*#?\s*(\d{8,12})/i);
          const extractedItelClaimNumber = itelClaimMatch ? String(itelClaimMatch[1] || itelClaimMatch[2] || '').trim() : '';

          itemResult.extractionDebug.itelFallbackChecked = true;
          itemResult.extractionDebug.itelFallbackPreview = String(itelClaimSearchText || '').slice(0, 250);

          if (extractedItelClaimNumber) {
            claimData.claimNumber = extractedItelClaimNumber;
            itemResult.claimNumber = claimData.claimNumber;
            itemResult.extractionDebug.claimNumber = claimData.claimNumber;
            itemResult.extractionDebug.source = 'VendorItel direct message fallback v2';
          }
        }

        if (!claimData.claimNumber) {
          itemResult.status = 'needs_review_missing_claim_number';
          itemResult.warnings.push('No claim number could be extracted from Itel thread.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelNeedsReviewLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        const folderResult = findExistingClaimFolderForVendor_(claimData, thread);
        itemResult.folderResult = folderResult;

        if (!folderResult.success) {
          itemResult.status = folderResult.status || 'folder_check_failed';
          itemResult.errors.push(folderResult.error);
          
          const folderFailureLabel = folderResult.status === 'pending_claim_folder' || folderResult.status === 'vendor_claim_folder_not_found'
            ? CONFIG.itelPendingClaimFolderLabel
            : CONFIG.itelErrorLabel;

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [folderFailureLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        const itelSubfolderResult = checkOrCreateVendorSubfolder_(folderResult.folderId, CONFIG.itelSubfolderName);
        itemResult.itelSubfolderResult = itelSubfolderResult;

        if (!itelSubfolderResult.success) {
          itemResult.status = 'itel_subfolder_check_failed';
          itemResult.errors.push(itelSubfolderResult.error);

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelErrorLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel error label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.errors++;
          items.push(itemResult);
          continue;
        }

        summary.folderReadyCount++;

        const itelCopyResult = copyEligibleAttachments_({
          workflow: 'Itel Attachment Intake',
          vendor: 'Itel',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: itelSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentCopyResult = itelCopyResult;

        if (!itelCopyResult.success) {
          itemResult.warnings.push('Itel attachment copy update failed: ' + itelCopyResult.error);
          summary.warnings++;
        }

        const itelLogResult = appendAttachmentLogRows_({
          workflow: 'Itel Attachment Intake',
          vendor: 'Itel',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: itelSubfolderResult,
          attachmentResult: attachmentResult
        });
        itemResult.attachmentLogResult = itelLogResult;

        if (!itelLogResult.success) {
          itemResult.warnings.push('Itel attachment log update failed: ' + itelLogResult.error);
          summary.warnings++;
        }

        const itelManifestResult = writeAttachmentManifest_({
          workflow: 'Itel Attachment Intake',
          vendor: 'Itel',
          thread: thread,
          claimData: claimData,
          folderResult: folderResult,
          vendorSubfolderResult: itelSubfolderResult,
          attachmentResult: attachmentResult,
          copyResult: itelCopyResult,
          logResult: itelLogResult
        });
        itemResult.attachmentManifestResult = itelManifestResult;

        if (!itelManifestResult.success) {
          itemResult.warnings.push('Itel attachment manifest update failed: ' + itelManifestResult.error);
          summary.warnings++;
        }

        if (attachmentResult.attachmentCount <= 0) {
          itemResult.status = 'needs_review_no_attachments';
          itemResult.warnings.push('No Itel attachments were detected.');

          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelNeedsReviewLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel needs-review label update failed: ' + labelResult.error);
            summary.warnings++;
          }

          summary.warnings++;
          items.push(itemResult);
          continue;
        }

        itemResult.status = 'itel_attachments_detected_folder_ready';

        const labelResult = applyInsuranceIntakeLabels_(thread, {
          add: [CONFIG.itelProcessedLabel],
          remove: getItelWorkflowStateLabelsToRemove_()
        });

        thread.markRead();
        itemResult.mailReadState = 'marked_read';
        itemResult.labelResult = labelResult;

        if (!labelResult.success) {
          itemResult.status = 'itel_detected_with_label_warning';
          itemResult.warnings.push('Itel processed label update failed: ' + labelResult.error);
          summary.warnings++;
        }

        summary.processedCount++;
        items.push(itemResult);
      } catch (itemError) {
        itemResult.status = 'item_error';
        itemResult.errors.push(itemError.message);

        try {
          const labelResult = applyInsuranceIntakeLabels_(thread, {
            add: [CONFIG.itelErrorLabel],
            remove: [CONFIG.itelIntakeLabel]
          });

          thread.markUnread();
          itemResult.mailReadState = 'marked_unread';
          itemResult.labelResult = labelResult;

          if (!labelResult.success) {
            itemResult.warnings.push('Itel error label update failed: ' + labelResult.error);
            summary.warnings++;
          }
        } catch (labelError) {
          itemResult.warnings.push('Itel error label update threw an exception: ' + labelError.message);
          summary.warnings++;
        }

        summary.errors++;
        items.push(itemResult);
      }
    }

    return {
      status: summary.errors > 0 ? 'Partial Success' : 'Success',
      message: buildItelAttachmentMessage_(summary),
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Attachment Intake',
        dryRun: CONFIG.dryRun,
        query: CONFIG.itelQuery,
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
        workflow: 'Itel Attachment Intake',
        dryRun: CONFIG.dryRun,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function cleanupProcessedItelLabels() {
  const startedAt = new Date();
  const query = 'label:Itel label:"Itel/Processed/Itel"';
  const summary = {
    foundCount: 0,
    cleanedCount: 0,
    warnings: 0,
    errors: 0
  };
  const items = [];

  try {
    const threads = GmailApp.search(query, 0, CONFIG.maxThreadsPerRun);
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
          remove: [CONFIG.itelIntakeLabel]
        });

        itemResult.labelResult = labelResult;

        if (labelResult.success) {
          itemResult.status = 'itel_source_label_removed';
          summary.cleanedCount++;
        } else {
          itemResult.status = 'itel_source_label_remove_warning';
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
      message: 'Cleaned ' + summary.cleanedCount + ' Itel source label(s) from ' + summary.foundCount + ' processed Itel thread(s).',
      result: {
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Label Cleanup',
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
        automation: CONFIG.automationName,
        phase: CONFIG.phase,
        workflow: 'Itel Label Cleanup',
        query: query,
        startedAt: startedAt,
        finishedAt: new Date(),
        summary: summary,
        stack: error.stack
      }
    };
  }
}

function buildItelAttachmentMessage_(summary) {
  return 'Phase ' + CONFIG.phase + ' Itel attachment intake found ' + summary.foundCount +
    ' Itel thread(s), parsed ' + summary.parsedCount +
    ', prepared ' + summary.folderReadyCount +
    ' claim folder(s), detected ' + summary.totalAttachmentsDetected +
    ' attachment(s) across ' + summary.threadsWithAttachments +
    ' thread(s), with ' + summary.reviewNeededAttachments +
    ' attachment(s) needing review, ' + summary.warnings +
    ' warning(s) and ' + summary.errors + ' error(s).';
}

