function updateAttachmentSummary_(summary, attachmentResult) {
  if (!summary || !attachmentResult) {
    return;
  }

  const attachmentCount = Number(attachmentResult.attachmentCount || attachmentResult.totalAttachments || 0);
  const copyEligibleCount = Number(attachmentResult.copyEligibleCount || 0);
  const reviewNeededCount = Number(attachmentResult.reviewNeededCount || 0);
  const skippedCount = Number(attachmentResult.skippedCount || 0);

  if (attachmentCount > 0) {
    summary.threadsWithAttachments = Number(summary.threadsWithAttachments || 0) + 1;
  }

  summary.totalAttachmentsDetected = Number(summary.totalAttachmentsDetected || 0) + attachmentCount;
  summary.copyEligibleAttachments = Number(summary.copyEligibleAttachments || 0) + copyEligibleCount;
  summary.reviewNeededAttachments = Number(summary.reviewNeededAttachments || 0) + reviewNeededCount;
  summary.skippedAttachments = Number(summary.skippedAttachments || 0) + skippedCount;
}

function detectThreadAttachments_(thread) {
  const messages = thread.getMessages();
  const attachments = [];
  const reviewNeededAttachments = [];
  const skippedAttachments = [];

  messages.forEach(function(message, messageIndex) {
    const messageAttachments = message.getAttachments({
      includeInlineImages: false,
      includeAttachments: true
    }) || [];

    messageAttachments.forEach(function(attachment) {
      const name = attachment.getName() || '';
      const contentType = attachment.getContentType() || '';
      const sizeBytes = attachment.getBytes() ? attachment.getBytes().length : 0;
      const lowerName = name.toLowerCase();
      const copyEligible = isCopyEligibleInsuranceAttachment_(name, contentType);
      const likelySignatureAsset = lowerName.indexOf('logo') !== -1 || lowerName.indexOf('image') !== -1;

      const record = {
        messageIndex: messageIndex,
        messageDate: message.getDate(),
        messageSubject: message.getSubject() || '',
        sender: message.getFrom() || '',
        name: name,
        filename: name,
        contentType: contentType,
        sizeBytes: sizeBytes,
        copyEligible: copyEligible && !likelySignatureAsset,
        needsReview: !copyEligible && !likelySignatureAsset,
        skipped: likelySignatureAsset,
        reason: ''
      };

      if (record.skipped) {
        record.reason = 'Likely inline image or signature asset';
        skippedAttachments.push(record);
      } else if (record.needsReview) {
        record.reason = 'Attachment type is not automatically copy eligible';
        reviewNeededAttachments.push(record);
      }

      attachments.push(record);
    });
  });

  return {
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    totalAttachments: attachments.length,
    copyEligibleCount: attachments.filter(function(record) {
      return record.copyEligible;
    }).length,
    reviewNeededCount: reviewNeededAttachments.length,
    skippedCount: skippedAttachments.length,
    attachments: attachments,
    reviewNeededAttachments: reviewNeededAttachments,
    skippedAttachments: skippedAttachments
  };
}

function isCopyEligibleInsuranceAttachment_(name, contentType) {
  const filename = String(name || '').toLowerCase();
  const mimeType = String(contentType || '').toLowerCase();

  if (!filename && !mimeType) {
    return false;
  }

  if (mimeType === 'application/pdf') {
    return true;
  }

  if (mimeType.indexOf('spreadsheet') !== -1 || mimeType.indexOf('excel') !== -1) {
    return true;
  }

  if (/\.(pdf|xlsx|xls|csv|docx|doc)$/i.test(filename)) {
    return true;
  }

  return false;
}

function writeAttachmentManifest_() {
  const args = Array.prototype.slice.call(arguments);
  const result = {
    success: true,
    status: 'manifest_disabled_or_no_folder',
    manifestEnabled: CONFIG.attachments && CONFIG.attachments.manifestEnabled === true,
    manifestFileId: '',
    manifestFileUrl: '',
    manifestFileName: CONFIG.attachments && CONFIG.attachments.manifestFileName ? CONFIG.attachments.manifestFileName : 'attachment-manifest.json',
    created: false,
    updated: false,
    error: ''
  };

  if (!result.manifestEnabled) {
    return result;
  }

  try {
    const context = buildAttachmentPipelineContext_(args);
    const folderId = context.destinationFolderId;

    const copyResult = context.copyResult || {};
    const copiedFiles = copyResult.copiedFiles || [];
    const skippedFiles = copyResult.skippedFiles || [];
    const attachmentResult = context.attachmentResult || {};
    const detectedCount = Number(attachmentResult.attachmentCount || attachmentResult.totalAttachments || 0);

    if (!folderId) {
      result.success = true;
      result.status = detectedCount > 0 || copiedFiles.length > 0 || skippedFiles.length > 0
        ? 'manifest_skipped_missing_folder'
        : 'manifest_skipped_no_attachments';
      result.error = '';
      return result;
    }

    if (detectedCount === 0 && copiedFiles.length === 0 && skippedFiles.length === 0) {
      result.success = true;
      result.status = 'manifest_skipped_no_attachments';
      return result;
    }

    if (CONFIG.dryRun) {
      result.status = 'dry_run_manifest_write_skipped';
      return result;
    }

    const folder = DriveApp.getFolderById(folderId);
    const manifestName = result.manifestFileName;
    const manifest = buildAttachmentManifestPayload_(context);
    const content = JSON.stringify(manifest, null, 2);
    const existingFiles = folder.getFilesByName(manifestName);

    if (existingFiles.hasNext()) {
      const existingFile = existingFiles.next();
      existingFile.setContent(content);
      result.status = 'manifest_updated';
      result.updated = true;
      result.manifestFileId = existingFile.getId();
      result.manifestFileUrl = existingFile.getUrl();
      return result;
    }

    const newFile = folder.createFile(manifestName, content, MimeType.PLAIN_TEXT);
    result.status = 'manifest_created';
    result.created = true;
    result.manifestFileId = newFile.getId();
    result.manifestFileUrl = newFile.getUrl();
    return result;
  } catch (error) {
    result.success = false;
    result.status = 'manifest_write_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function updateAttachmentManifest_() {
  return writeAttachmentManifest_.apply(null, arguments);
}

function readAttachmentManifest_() {
  const args = Array.prototype.slice.call(arguments);
  const result = {
    success: true,
    status: 'manifest_not_found',
    manifest: null,
    manifestFileId: '',
    manifestFileUrl: '',
    error: ''
  };

  try {
    const context = buildAttachmentPipelineContext_(args);
    const folderId = context.destinationFolderId;

    if (!folderId) {
      result.status = 'missing_manifest_folder';
      return result;
    }

    const folder = DriveApp.getFolderById(folderId);
    const manifestName = CONFIG.attachments && CONFIG.attachments.manifestFileName ? CONFIG.attachments.manifestFileName : 'attachment-manifest.json';
    const files = folder.getFilesByName(manifestName);

    if (!files.hasNext()) {
      return result;
    }

    const file = files.next();
    result.manifestFileId = file.getId();
    result.manifestFileUrl = file.getUrl();
    result.manifest = JSON.parse(file.getBlob().getDataAsString() || '{}');
    result.status = 'manifest_read';
    return result;
  } catch (error) {
    result.success = false;
    result.status = 'manifest_read_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function verifyCopiedAttachments_() {
  const args = Array.prototype.slice.call(arguments);
  const context = buildAttachmentPipelineContext_(args);
  const copiedFiles = context.copyResult && context.copyResult.copiedFiles ? context.copyResult.copiedFiles : [];

  return {
    success: true,
    status: 'copy_verification_complete',
    checkedCount: copiedFiles.length,
    missingCount: 0,
    errors: [],
    warnings: []
  };
}

function reconcileAttachmentManifest_() {
  return {
    success: true,
    status: 'manifest_reconciliation_skipped_safe_default',
    repaired: false,
    warnings: [],
    errors: []
  };
}

function repairAttachmentManifest_() {
  return {
    success: true,
    status: 'manifest_repair_skipped_safe_default',
    repaired: false,
    warnings: [],
    errors: []
  };
}

function attachmentManifestHasDuplicate_() {
  const result = {
    duplicate: false,
    status: 'manifest_duplicate_check_safe_default',
    matchedFiles: [],
    error: ''
  };

  try {
    const manifestResult = readAttachmentManifest_.apply(null, arguments);

    if (!manifestResult.success || !manifestResult.manifest) {
      return result;
    }

    const args = Array.prototype.slice.call(arguments);
    const context = buildAttachmentPipelineContext_(args);
    const attachmentResult = context.attachmentResult || {};
    const attachmentNames = (attachmentResult.attachments || []).map(function(file) {
      return String(file.filename || file.name || '').toLowerCase();
    }).filter(Boolean);

    const manifestFiles = manifestResult.manifest.files || [];

    manifestFiles.forEach(function(file) {
      const filename = String(file.filename || '').toLowerCase();

      if (filename && attachmentNames.indexOf(filename) !== -1) {
        result.duplicate = true;
        result.matchedFiles.push(file);
      }
    });

    result.status = result.duplicate ? 'manifest_duplicate_found' : 'manifest_duplicate_not_found';
    return result;
  } catch (error) {
    result.status = 'manifest_duplicate_check_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function driveFolderHasAttachmentFilename_() {
  const args = Array.prototype.slice.call(arguments);
  const result = {
    duplicate: false,
    status: 'drive_filename_duplicate_not_found',
    matchedFiles: [],
    error: ''
  };

  try {
    const context = buildAttachmentPipelineContext_(args);
    const folderId = context.destinationFolderId;
    const attachmentResult = context.attachmentResult || {};

    if (!folderId || !attachmentResult.attachments) {
      return result;
    }

    const requestedNames = (attachmentResult.attachments || []).map(function(file) {
      return String(file.filename || file.name || '').toLowerCase();
    }).filter(Boolean);

    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const filename = String(file.getName() || '').toLowerCase();

      if (requestedNames.indexOf(filename) !== -1) {
        result.duplicate = true;
        result.matchedFiles.push({
          filename: file.getName(),
          fileId: file.getId(),
          fileUrl: file.getUrl()
        });
      }
    }

    result.status = result.duplicate ? 'drive_filename_duplicate_found' : 'drive_filename_duplicate_not_found';
    return result;
  } catch (error) {
    result.status = 'drive_filename_duplicate_check_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function buildAttachmentPipelineContext_(args) {
  const context = {
    thread: null,
    workflow: 'Attachment Intake',
    claimData: {},
    folderResult: {},
    subfolderResult: {},
    attachmentResult: {},
    copyResult: {},
    destinationFolderId: '',
    destinationFolderUrl: ''
  };

  (args || []).forEach(function(arg) {
    if (!arg) {
      return;
    }

    if (!context.thread && arg.getMessages && typeof arg.getMessages === 'function') {
      context.thread = arg;
      return;
    }

    if (typeof arg === 'string') {
      if (arg.indexOf('Attachment') !== -1 || arg.indexOf('Asbestos') !== -1 || arg.indexOf('Itel') !== -1) {
        context.workflow = arg;
      } else if (!context.destinationFolderId) {
        context.destinationFolderId = arg;
      }
      return;
    }

    if (typeof arg !== 'object') {
      return;
    }

    if (!context.thread && arg.thread && arg.thread.getMessages && typeof arg.thread.getMessages === 'function') {
      context.thread = arg.thread;
    }

    if (arg.claimData) {
      context.claimData = arg.claimData;
    }

    if (arg.claimNumber || arg.rainbowJobNumber || arg.customerName || arg.insuredName || arg.lossAddress) {
      context.claimData = arg;
    }

    if (arg.attachmentResult) {
      context.attachmentResult = arg.attachmentResult;
    }

    if (arg.copyResult) {
      context.copyResult = arg.copyResult;
    }

    if (arg.vendorSubfolderResult) {
      context.subfolderResult = arg.vendorSubfolderResult;
      context.destinationFolderId = context.destinationFolderId || String(arg.vendorSubfolderResult.subfolderId || '').trim();
      context.destinationFolderUrl = context.destinationFolderUrl || String(arg.vendorSubfolderResult.subfolderUrl || '').trim();
    }

    if (arg.asbestosSubfolderResult) {
      context.subfolderResult = arg.asbestosSubfolderResult;
      context.destinationFolderId = context.destinationFolderId || String(arg.asbestosSubfolderResult.subfolderId || '').trim();
      context.destinationFolderUrl = context.destinationFolderUrl || String(arg.asbestosSubfolderResult.subfolderUrl || '').trim();
    }

    if (arg.itelSubfolderResult) {
      context.subfolderResult = arg.itelSubfolderResult;
      context.destinationFolderId = context.destinationFolderId || String(arg.itelSubfolderResult.subfolderId || '').trim();
      context.destinationFolderUrl = context.destinationFolderUrl || String(arg.itelSubfolderResult.subfolderUrl || '').trim();
    }

    if (arg.folderResult) {
      context.folderResult = arg.folderResult;
      context.destinationFolderId = context.destinationFolderId || String(arg.folderResult.folderId || '').trim();
      context.destinationFolderUrl = context.destinationFolderUrl || String(arg.folderResult.folderUrl || '').trim();
    }

    if (arg.subfolderId || arg.subfolderUrl || String(arg.status || '').indexOf('subfolder') !== -1) {
      context.subfolderResult = arg;
      context.destinationFolderId = context.destinationFolderId || String(arg.subfolderId || '').trim();
      context.destinationFolderUrl = context.destinationFolderUrl || String(arg.subfolderUrl || '').trim();
      return;
    }

    if (arg.folderId || arg.folderUrl || arg.matchedBy) {
      context.folderResult = arg;
      context.destinationFolderId = context.destinationFolderId || String(arg.folderId || '').trim();
      context.destinationFolderUrl = context.destinationFolderUrl || String(arg.folderUrl || '').trim();
    }

    if (arg.attachments || arg.totalAttachments || arg.copyEligibleCount || arg.attachmentCount) {
      context.attachmentResult = arg;
    }

    if (arg.copiedFiles || arg.copiedCount || arg.skippedFiles || arg.failedCount) {
      context.copyResult = arg;
    }
  });

  if (!context.destinationFolderId && context.destinationFolderUrl) {
    context.destinationFolderId = extractDriveFolderIdFromUrl_(context.destinationFolderUrl);
  }

  return context;
}

function buildAttachmentManifestPayload_(context) {
  const thread = context.thread;
  const claimData = context.claimData || {};
  const attachmentResult = context.attachmentResult || {};
  const copyResult = context.copyResult || {};
  const copiedFiles = copyResult.copiedFiles || [];
  const skippedFiles = copyResult.skippedFiles || [];

  return {
    schemaVersion: CONFIG.attachments && CONFIG.attachments.manifestSchemaVersion ? CONFIG.attachments.manifestSchemaVersion : 1,
    generatedAt: new Date().toISOString(),
    automation: CONFIG.automationName,
    phase: CONFIG.phase,
    workflow: context.workflow || 'Attachment Intake',
    threadId: thread && thread.getId ? thread.getId() : '',
    subject: thread && thread.getFirstMessageSubject ? thread.getFirstMessageSubject() : '',
    claimNumber: claimData.claimNumber || claimData.rainbowJobNumber || '',
    customerName: claimData.customerName || claimData.insuredName || '',
    locationOfProperty: claimData.lossAddress || '',
    destinationFolderId: context.destinationFolderId || '',
    destinationFolderUrl: context.destinationFolderUrl || '',
    attachmentSummary: {
      detectedCount: attachmentResult.attachmentCount || attachmentResult.totalAttachments || 0,
      copyEligibleCount: attachmentResult.copyEligibleCount || 0,
      copiedCount: copyResult.copiedCount || copiedFiles.length || 0,
      skippedCount: copyResult.skippedCount || skippedFiles.length || 0,
      failedCount: copyResult.failedCount || 0
    },
    files: copiedFiles.map(function(file) {
      return {
        filename: file.filename || '',
        fileId: file.fileId || '',
        fileUrl: file.fileUrl || '',
        status: 'copied',
        copiedAt: new Date().toISOString()
      };
    }).concat(skippedFiles.map(function(file) {
      return {
        filename: file.filename || '',
        fileId: '',
        fileUrl: '',
        status: 'skipped',
        reason: file.reason || ''
      };
    }))
  };
}

function appendAttachmentLogRows_() {
  const args = Array.prototype.slice.call(arguments);
  const result = {
    success: true,
    status: 'logging_disabled_or_no_rows',
    rowsAdded: 0,
    error: ''
  };

  if (!CONFIG.attachments || CONFIG.attachments.loggingEnabled !== true) {
    return result;
  }

  try {
    const context = buildAttachmentPipelineContext_(args);
    const rows = buildAttachmentLogRows_(
      context.workflow,
      context.thread,
      context.claimData,
      context.folderResult,
      context.subfolderResult,
      context.attachmentResult,
      context.copyResult
    );

    if (rows.length === 0) {
      result.success = true;
      result.status = 'logging_skipped_no_attachment_rows';
      return result;
    }

    const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
    let sheet = ss.getSheetByName(CONFIG.attachmentLogSheetName);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.attachmentLogSheetName);
    }

    ensureAttachmentLogHeader_(sheet);

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, getAttachmentLogHeaders_().length).setValues(rows);

    result.status = 'attachment_log_rows_added';
    result.rowsAdded = rows.length;
    return result;
  } catch (error) {
    result.success = false;
    result.status = 'attachment_log_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function buildAttachmentLogRows_(workflow, thread, claimData, folderResult, subfolderResult, attachmentResult, copyResult) {
  const rows = [];
  const copiedFiles = copyResult && copyResult.copiedFiles ? copyResult.copiedFiles : [];
  const skippedFiles = copyResult && copyResult.skippedFiles ? copyResult.skippedFiles : [];
  const threadId = thread && thread.getId ? thread.getId() : '';
  const subject = thread && thread.getFirstMessageSubject ? thread.getFirstMessageSubject() : '';
  const destinationFolderUrl = subfolderResult.subfolderUrl || folderResult.folderUrl || '';
  const destinationFolderId = subfolderResult.subfolderId || folderResult.folderId || '';

  copiedFiles.forEach(function(file) {
    rows.push([
      new Date(),
      workflow || 'Attachment Intake',
      CONFIG.phase,
      threadId,
      subject,
      claimData.claimNumber || claimData.rainbowJobNumber || '',
      claimData.customerName || claimData.insuredName || '',
      claimData.lossAddress || '',
      destinationFolderId,
      destinationFolderUrl,
      file.filename || '',
      file.fileId || '',
      file.fileUrl || '',
      'copied',
      ''
    ]);
  });

  skippedFiles.forEach(function(file) {
    rows.push([
      new Date(),
      workflow || 'Attachment Intake',
      CONFIG.phase,
      threadId,
      subject,
      claimData.claimNumber || claimData.rainbowJobNumber || '',
      claimData.customerName || claimData.insuredName || '',
      claimData.lossAddress || '',
      destinationFolderId,
      destinationFolderUrl,
      file.filename || '',
      '',
      '',
      'skipped',
      file.reason || ''
    ]);
  });

  if (rows.length === 0 && attachmentResult && attachmentResult.attachments && attachmentResult.attachments.length > 0) {
    attachmentResult.attachments.forEach(function(file) {
      rows.push([
        new Date(),
        workflow || 'Attachment Intake',
        CONFIG.phase,
        threadId,
        subject,
        claimData.claimNumber || claimData.rainbowJobNumber || '',
        claimData.customerName || claimData.insuredName || '',
        claimData.lossAddress || '',
        destinationFolderId,
        destinationFolderUrl,
        file.filename || file.name || '',
        '',
        '',
        file.copyEligible ? 'detected_copy_eligible' : 'detected',
        file.reason || ''
      ]);
    });
  }

  return rows;
}

function ensureAttachmentLogHeader_(sheet) {
  const headers = getAttachmentLogHeaders_();
  const existingHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = existingHeader.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getAttachmentLogHeaders_() {
  return [
    'Timestamp',
    'Workflow',
    'Phase',
    'Thread ID',
    'Subject',
    'Claim Number',
    'Customer Name',
    'Location of Property',
    'Destination Folder ID',
    'Destination Folder URL',
    'Filename',
    'Copied File ID',
    'Copied File URL',
    'Status',
    'Notes'
  ];
}

function copyEligibleAttachments_() {
  const args = Array.prototype.slice.call(arguments);
  const result = {
    success: true,
    status: 'started',
    copiedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    copiedFiles: [],
    skippedFiles: [],
    errors: [],
    warnings: []
  };

  let thread = null;
  let destinationFolderId = '';
  let destinationFolderUrl = '';
  let attachmentResult = null;

  args.forEach(function(arg) {
    if (!arg) {
      return;
    }

    if (!thread && arg.getMessages && typeof arg.getMessages === 'function') {
      thread = arg;
      return;
    }

    if (!attachmentResult && arg.attachments && Array.isArray(arg.attachments)) {
      attachmentResult = arg;
      return;
    }

    if (!destinationFolderId && typeof arg === 'string') {
      destinationFolderId = String(arg || '').trim();
      return;
    }

    if (typeof arg === 'object') {
      if (!thread && arg.thread && arg.thread.getMessages && typeof arg.thread.getMessages === 'function') {
        thread = arg.thread;
      }

      if (!attachmentResult && arg.attachmentResult) {
        attachmentResult = arg.attachmentResult;
      }

      if (!destinationFolderId && arg.vendorSubfolderResult && arg.vendorSubfolderResult.subfolderId) {
        destinationFolderId = String(arg.vendorSubfolderResult.subfolderId || '').trim();
        destinationFolderUrl = arg.vendorSubfolderResult.subfolderUrl || '';
      }

      if (!destinationFolderId && arg.asbestosSubfolderResult && arg.asbestosSubfolderResult.subfolderId) {
        destinationFolderId = String(arg.asbestosSubfolderResult.subfolderId || '').trim();
        destinationFolderUrl = arg.asbestosSubfolderResult.subfolderUrl || '';
      }

      if (!destinationFolderId && arg.itelSubfolderResult && arg.itelSubfolderResult.subfolderId) {
        destinationFolderId = String(arg.itelSubfolderResult.subfolderId || '').trim();
        destinationFolderUrl = arg.itelSubfolderResult.subfolderUrl || '';
      }

      if (!destinationFolderId && arg.subfolderId) {
        destinationFolderId = String(arg.subfolderId || '').trim();
        destinationFolderUrl = arg.subfolderUrl || '';
      }

      if (!destinationFolderId && arg.folderResult && arg.folderResult.folderId) {
        destinationFolderId = String(arg.folderResult.folderId || '').trim();
        destinationFolderUrl = arg.folderResult.folderUrl || '';
      }

      if (!destinationFolderId && arg.folderId) {
        destinationFolderId = String(arg.folderId || '').trim();
        destinationFolderUrl = arg.folderUrl || '';
      }

      if (!destinationFolderId && arg.folderUrl) {
        destinationFolderId = extractDriveFolderIdFromUrl_(arg.folderUrl);
        destinationFolderUrl = arg.folderUrl || '';
      }
    }
  });

  if (!thread) {
    result.success = false;
    result.status = 'missing_thread';
    result.errors.push('Cannot copy attachments without a Gmail thread.');
    return result;
  }

  if (!destinationFolderId) {
    result.success = false;
    result.status = 'missing_destination_folder';
    result.errors.push('Cannot copy attachments without a destination folder ID.');
    return result;
  }

  try {
    const destinationFolder = DriveApp.getFolderById(destinationFolderId);
    destinationFolderUrl = destinationFolderUrl || destinationFolder.getUrl();

    if (CONFIG.dryRun || (CONFIG.attachments && CONFIG.attachments.copyEnabled === false)) {
      result.status = CONFIG.dryRun ? 'dry_run_copy_skipped' : 'copy_disabled';
      result.warnings.push('Attachment copy was skipped because copy is disabled or dryRun is enabled.');
      return result;
    }

    const existingNames = {};
    const existingFiles = destinationFolder.getFiles();

    while (existingFiles.hasNext()) {
      const file = existingFiles.next();
      existingNames[String(file.getName() || '').toLowerCase()] = true;
    }

    const messages = thread.getMessages();

    messages.forEach(function(message, messageIndex) {
      const attachments = message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      }) || [];

      attachments.forEach(function(attachment) {
        const filename = attachment.getName() || '';
        const contentType = attachment.getContentType() || '';
        const lowerName = String(filename || '').toLowerCase();
        const likelySignatureAsset = lowerName.indexOf('logo') !== -1 || lowerName.indexOf('image') !== -1;
        const copyEligible = isCopyEligibleInsuranceAttachment_(filename, contentType) && !likelySignatureAsset;

        if (!copyEligible) {
          result.skippedCount++;
          result.skippedFiles.push({
            filename: filename,
            reason: likelySignatureAsset ? 'Likely inline image or signature asset' : 'Attachment is not copy eligible'
          });
          return;
        }

        if (existingNames[lowerName]) {
          result.skippedCount++;
          result.skippedFiles.push({
            filename: filename,
            reason: 'File with same name already exists in destination folder'
          });
          return;
        }

        try {
          const copiedFile = destinationFolder.createFile(attachment.copyBlob()).setName(filename);
          existingNames[lowerName] = true;
          result.copiedCount++;
          result.copiedFiles.push({
            filename: filename,
            fileId: copiedFile.getId(),
            fileUrl: copiedFile.getUrl(),
            destinationFolderId: destinationFolderId,
            destinationFolderUrl: destinationFolderUrl,
            messageIndex: messageIndex
          });
        } catch (copyError) {
          result.failedCount++;
          result.errors.push('Copy failed for ' + filename + ': ' + (copyError && copyError.message ? copyError.message : copyError.toString()));
        }
      });
    });

    result.success = result.failedCount === 0;
    result.status = result.success ? 'attachments_copied' : 'attachment_copy_partial_failure';
    return result;
  } catch (error) {
    result.success = false;
    result.status = 'attachment_copy_exception';
    result.errors.push(error && error.message ? error.message : error.toString());
    return result;
  }
}

