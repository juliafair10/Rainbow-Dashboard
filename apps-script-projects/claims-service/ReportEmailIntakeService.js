/**
 * ReportEmailIntakeService
 *
 * Shared Gmail-to-Drive intake for XLSX report attachments.
 * This service stores report files only; it does not parse XLSX data or update claims.
 */

function processReportEmailIntake(reportKey) {
  let config;
  let thread = null;

  try {
    config = getReportEmailImportConfig_(reportKey);
    const latest = findLatestReportEmailMessage_(config);

    if (!latest) {
      return errorResponse('No matching report email found.', {
        reportKey: reportKey,
        query: config.gmailQuery
      });
    }

    thread = latest.thread;
    const message = latest.message;
    const attachment = getReportXlsxAttachment_(message);

    if (!attachment) {
      throw new Error('No XLSX attachment found on latest matching email.');
    }

    const emailDate = message.getDate();
    const monthlyFolder = getOrCreateMonthlyImportFolder_(config.parentFolderId, emailDate);
    const targetFileName = buildReportImportFileName_(config.filenamePrefix, emailDate);
    const intakeMetadata = buildReportIntakeMetadata_(config, message, attachment);
    const duplicateFile = findExistingReportImportFile_(monthlyFolder, targetFileName, intakeMetadata);
    let savedFile;
    let duplicate = false;

    if (duplicateFile) {
      savedFile = duplicateFile;
      duplicate = true;
    } else {
      savedFile = monthlyFolder.createFile(attachment.copyBlob()).setName(targetFileName);
      savedFile.setDescription(intakeMetadata);
    }

    const processedLabel = getOrCreateGmailLabel_(config.processedLabel);
    thread.addLabel(processedLabel);

    logReportEmailIntake_('Success', 'Report email intake completed.', {
      reportKey: config.reportKey,
      messageId: message.getId(),
      fileId: savedFile.getId(),
      fileName: savedFile.getName(),
      duplicate: duplicate
    });

    return successResponse({
      reportKey: config.reportKey,
      reportName: config.displayName,
      duplicate: duplicate,
      gmailMessageId: message.getId(),
      gmailThreadId: thread.getId(),
      emailDate: emailDate.toISOString(),
      attachmentName: attachment.getName(),
      fileId: savedFile.getId(),
      fileName: savedFile.getName(),
      fileUrl: savedFile.getUrl(),
      folderId: monthlyFolder.getId(),
      folderName: monthlyFolder.getName(),
      folderPath: buildReportImportFolderPath_(config.parentFolderId, monthlyFolder),
      processedLabel: config.processedLabel
    }, duplicate ? 'Report attachment was already saved.' : 'Report attachment saved successfully.');
  } catch (error) {
    if (thread && config && config.errorLabel) {
      try {
        thread.addLabel(getOrCreateGmailLabel_(config.errorLabel));
      } catch (labelError) {
        logReportEmailIntake_('Error', 'Failed to add report intake error label.', {
          reportKey: config.reportKey,
          message: labelError && labelError.message ? labelError.message : String(labelError)
        });
      }
    }

    logReportEmailIntake_('Error', 'Report email intake failed.', {
      reportKey: reportKey,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ''
    });

    return errorResponse('Report email intake failed.', {
      reportKey: reportKey,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : ''
    });
  }
}

function processDailyOpenJobsEmailIntake() {
  return processReportEmailIntake('dailyOpenJobs');
}

function processComplianceTasksEmailIntake() {
  return processReportEmailIntake('complianceTasks');
}

function testReportEmailSearch(reportKey) {
  try {
    const config = getReportEmailImportConfig_(reportKey);
    const latest = findLatestReportEmailMessage_(config);

    if (!latest) {
      return successResponse({
        reportKey: config.reportKey,
        query: config.gmailQuery,
        found: false
      }, 'No matching report email found.');
    }

    const attachmentSummaries = latest.message.getAttachments().map(function(attachment) {
      return {
        name: attachment.getName(),
        contentType: attachment.getContentType(),
        sizeBytes: attachment.getBytes().length,
        isXlsx: isReportXlsxAttachment_(attachment)
      };
    });

    const response = successResponse({
      reportKey: config.reportKey,
      query: config.gmailQuery,
      found: true,
      threadId: latest.thread.getId(),
      messageId: latest.message.getId(),
      subject: latest.message.getSubject(),
      from: latest.message.getFrom(),
      date: latest.message.getDate().toISOString(),
      attachments: attachmentSummaries
    }, 'Latest matching report email found.');

    Logger.log('REPORT_EMAIL_SEARCH ' + JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    const response = errorResponse('Report email search failed.', {
      reportKey: reportKey,
      message: error && error.message ? error.message : String(error)
    });

    Logger.log('REPORT_EMAIL_SEARCH_ERROR ' + JSON.stringify(response, null, 2));
    return response;
  }
}

function testDailyOpenJobsEmailSearch() {
  return testReportEmailSearch('dailyOpenJobs');
}

function testComplianceTasksEmailSearch() {
  return testReportEmailSearch('complianceTasks');
}

function getOrCreateMonthlyImportFolder_(parentFolderId, date) {
  if (!parentFolderId) {
    throw new Error('parentFolderId is required.');
  }

  const parentFolder = DriveApp.getFolderById(parentFolderId);
  const monthName = Utilities.formatDate(new Date(date), CLAIM_SERVICE.timezone, 'yyyy-MM');
  const matchingFolders = parentFolder.getFoldersByName(monthName);

  if (matchingFolders.hasNext()) {
    return matchingFolders.next();
  }

  return parentFolder.createFolder(monthName);
}

function getLatestReportImportFile(reportKey) {
  try {
    const config = getReportEmailImportConfig_(reportKey);
    const parentFolder = DriveApp.getFolderById(config.parentFolderId);
    const latest = findLatestReportImportFile_(parentFolder, config.filenamePrefix);

    if (!latest) {
      return notFoundResponse('No saved report import file found.', {
        reportKey: config.reportKey,
        parentFolderId: config.parentFolderId
      });
    }

    return successResponse({
      reportKey: config.reportKey,
      reportName: config.displayName,
      fileId: latest.file.getId(),
      fileName: latest.file.getName(),
      fileUrl: latest.file.getUrl(),
      dateCreated: latest.file.getDateCreated().toISOString(),
      lastUpdated: latest.file.getLastUpdated().toISOString(),
      folderId: latest.folder.getId(),
      folderName: latest.folder.getName(),
      folderPath: buildReportImportFolderPath_(config.parentFolderId, latest.folder)
    }, 'Latest report import file found.');
  } catch (error) {
    return errorResponse('Failed to get latest report import file.', {
      reportKey: reportKey,
      message: error && error.message ? error.message : String(error)
    });
  }
}

function testGetLatestDailyOpenJobsImportFile() {
  const response = getLatestReportImportFile('dailyOpenJobs');
  Logger.log('LATEST_DAILY_OPEN_JOBS_IMPORT_FILE ' + JSON.stringify(response, null, 2));
  return response;
}

function testGetLatestComplianceTasksImportFile() {
  const response = getLatestReportImportFile('complianceTasks');
  Logger.log('LATEST_COMPLIANCE_TASKS_IMPORT_FILE ' + JSON.stringify(response, null, 2));
  return response;
}

function getReportEmailImportConfig_(reportKey) {
  const normalizedKey = String(reportKey || '').trim();
  const config = REPORT_EMAIL_IMPORT_CONFIG[normalizedKey];

  if (!config) {
    throw new Error('Unknown reportKey: ' + reportKey);
  }

  return config;
}

function findLatestReportEmailMessage_(config) {
  const threads = GmailApp.search(config.gmailQuery, 0, 10);
  let latest = null;

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      if (!getReportXlsxAttachment_(message)) {
        return;
      }

      if (!latest || message.getDate().getTime() > latest.message.getDate().getTime()) {
        latest = {
          thread: thread,
          message: message
        };
      }
    });
  });

  return latest;
}

function getReportXlsxAttachment_(message) {
  const attachments = message.getAttachments();

  for (let i = 0; i < attachments.length; i++) {
    if (isReportXlsxAttachment_(attachments[i])) {
      return attachments[i];
    }
  }

  return null;
}

function isReportXlsxAttachment_(attachment) {
  const name = String(attachment.getName() || '').toLowerCase();
  const contentType = String(attachment.getContentType() || '').toLowerCase();

  return name.slice(-5) === '.xlsx' ||
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

function buildReportImportFileName_(prefix, date) {
  return prefix + '_' +
    Utilities.formatDate(new Date(date), CLAIM_SERVICE.timezone, 'yyyy-MM-dd_HHmm') +
    '.xlsx';
}

function buildReportIntakeMetadata_(config, message, attachment) {
  return [
    'claims-service report email intake',
    'reportKey=' + config.reportKey,
    'gmailMessageId=' + message.getId(),
    'attachmentName=' + attachment.getName(),
    'emailDate=' + message.getDate().toISOString()
  ].join('\n');
}

function findExistingReportImportFile_(folder, targetFileName, intakeMetadata) {
  const files = folder.getFilesByName(targetFileName);

  while (files.hasNext()) {
    const file = files.next();
    const description = String(file.getDescription() || '');

    if (description === intakeMetadata || description.indexOf(intakeMetadata) !== -1) {
      return file;
    }

    // Older saved files may not have metadata. The generated filename is stable
    // for a report email minute, so treat an exact name match as already saved.
    if (!description) {
      return file;
    }
  }

  return null;
}

function getOrCreateGmailLabel_(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);

  if (!label) {
    label = GmailApp.createLabel(labelName);
  }

  return label;
}

function findLatestReportImportFile_(parentFolder, filenamePrefix) {
  const monthlyFolders = parentFolder.getFolders();
  let latest = null;

  while (monthlyFolders.hasNext()) {
    const folder = monthlyFolders.next();
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      if (fileName.indexOf(filenamePrefix + '_') !== 0 || fileName.toLowerCase().slice(-5) !== '.xlsx') {
        continue;
      }

      if (!latest || file.getLastUpdated().getTime() > latest.file.getLastUpdated().getTime()) {
        latest = {
          folder: folder,
          file: file
        };
      }
    }
  }

  return latest;
}

function buildReportImportFolderPath_(parentFolderId, monthlyFolder) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);
  return parentFolder.getName() + '/' + monthlyFolder.getName();
}

function logReportEmailIntake_(status, message, details) {
  if (typeof writeServiceLog === 'function') {
    writeServiceLog('ReportEmailIntakeService', status, message, details || {});
    return;
  }

  Logger.log('REPORT_EMAIL_INTAKE_' + status.toUpperCase() + ' ' + JSON.stringify({
    message: message,
    details: details || {}
  }));
}
