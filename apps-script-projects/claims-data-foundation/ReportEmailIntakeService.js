
/**
 * Phase 8.5A
 * Report Intake Layer
 */

function processDailyNotesEmails() {
  processReportEmail_('dailyNotes');
}

function processComplianceEmails() {
  processReportEmail_('compliance');
}

function processHistoricalNotesEmails() {
  processReportEmail_('historical');
}

function processReportEmail_(reportKey) {
  const report = CONFIG.reports[reportKey];
  const query = `from:${report.sender} newer_than:7d has:attachment`;

  const threads = GmailApp.search(query, 0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      const attachments = message.getAttachments();

      for (const attachment of attachments) {
        const attachmentName = attachment.getName();

        const matches = report.filename
          ? attachmentName === report.filename
          : attachmentName.includes(report.filenameContains);

        if (!matches) continue;

        const monthlyFolder = createMonthlyFolder_(CONFIG.folders[reportKey]);

        const dateStamp = Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'yyyy-MM-dd HH-mm'
        );

        const friendlyName = {
          dailyNotes: 'Daily Notes',
          compliance: 'Compliance Tasks',
          historical: 'Historical Notes'
        }[reportKey];

        const newFilename = `${friendlyName} - ${dateStamp}.xlsx`;

        saveReportAttachment_(attachment.copyBlob(), monthlyFolder.getId(), newFilename);

        Logger.log(`Saved ${newFilename}`);
        return;
      }
    }
  }

  Logger.log(`No matching attachment found for ${reportKey}`);
}

function saveReportAttachment_(blob, folderId, filename) {
  const folder = DriveApp.getFolderById(folderId);
  folder.createFile(blob).setName(filename);
}

function createMonthlyFolder_(parentFolderId) {
  const parent = DriveApp.getFolderById(parentFolderId);

  const monthName = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM'
  );

  const folders = parent.getFoldersByName(monthName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(monthName);
}
