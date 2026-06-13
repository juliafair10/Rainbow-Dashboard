function runReportIntake() {
  Logger.log('Starting Report Intake...');

  processDailyNotesEmails();
  processComplianceEmails();
  processHistoricalNotesEmails();

  Logger.log('Report Intake Complete.');
}

function testDailyNotesIntake() {
  processDailyNotesEmails();
}

function testComplianceIntake() {
  processComplianceEmails();
}

function testHistoricalIntake() {
  processHistoricalNotesEmails();
}

function testDriveApi() {
  const result = Drive.Files.list({
    maxResults: 1
  });

  Logger.log(JSON.stringify(result));
}

function testDailyNotesImport() {
  importLatestDailyNotes();
}

function importLatestDailyNotes() {
  Logger.log('=== Daily Notes Import Started ===');

  const file = findLatestDailyNotesFile_();

  if (!file) {
    throw new Error('No Daily Notes file found.');
  }

  Logger.log('Found file: ' + file.getName());
  Logger.log('Daily Notes import scaffolding verified.');
}

function findLatestDailyNotesFile_() {
  const parentFolder = DriveApp.getFolderById(CONFIG.folders.dailyNotes);
  const monthFolders = parentFolder.getFolders();

  let newestFile = null;
  let newestTimestamp = 0;

  while (monthFolders.hasNext()) {
    const monthFolder = monthFolders.next();
    const files = monthFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const updated = file.getLastUpdated().getTime();

      if (updated > newestTimestamp) {
        newestTimestamp = updated;
        newestFile = file;
      }
    }
  }

  return newestFile;
}

function inspectLatestDailyNotesFile() {
  const file = findLatestDailyNotesFile_();

  Logger.log('Name: ' + file.getName());
  Logger.log('Mime Type: ' + file.getMimeType());
  Logger.log('Id: ' + file.getId());
}
