// IMPORTANT:
// Before sending an ESA for signature in Google Docs:
// 1. Open Tools -> eSignature
// 2. Verify the signer name/email is correct
// 3. Replace any previous signer before sending
// 4. Confirm signature, initials, and date fields are assigned correctly
const ESA_FOLDER_ID = '15ixPVVL7ex29YX1vY5A_zsWOgwWMO88_';

function onOpen() {
  DocumentApp.getUi()
    .createMenu('ESA Tools')
    .addItem('Create ESA from Form', 'showEsaSidebar')
    .addToUi();
}

function showEsaSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Create ESA');

  DocumentApp.getUi().showSidebar(html);
}

function fillCurrentEsaDocument(data) {
  return createEsaFromTemplate(data);
}

function createEsaFromTemplate(data) {
  const templateDoc = DocumentApp.getActiveDocument();
  const templateFile = DriveApp.getFileById(templateDoc.getId());
  const esaFolder = DriveApp.getFolderById(ESA_FOLDER_ID);

  const customerName = data.customerName || 'Customer';
  const cleanCustomerName = sanitizeFileName_(customerName);
  const newFileName = 'Rainbow Metro Atlanta ESA - ' + cleanCustomerName;

  const copiedFile = templateFile.makeCopy(newFileName, esaFolder);
  const copiedDoc = DocumentApp.openById(copiedFile.getId());
  const body = copiedDoc.getBody();

  replacePlaceholder_(body, '{{CUSTOMER_NAME}}', data.customerName);
  replacePlaceholder_(body, '{{INSURANCE_COMPANY}}', data.insuranceCompany);
  replacePlaceholder_(body, '{{CLAIM_NUMBER}}', data.claimNumber);
  replacePlaceholder_(body, '{{DATE}}', data.esaDate);
  replacePlaceholder_(body, '{{ESA_DATE}}', data.esaDate);
  replacePlaceholder_(body, '{{STREET_ADDRESS}}', data.streetAddress);
  replacePlaceholder_(body, '{{CITY}}', data.city);
  replacePlaceholder_(body, '{{STATE}}', data.state);
  replacePlaceholder_(body, '{{ZIP}}', data.zip);

  copiedDoc.saveAndClose();

  return {
    status: 'Success',
    message: 'ESA created and saved in the ESA folder.',
    documentUrl: copiedFile.getUrl(),
    documentName: newFileName
  };
}

function replacePlaceholder_(body, placeholder, value) {
  const match = body.findText(escapeForFindText_(placeholder));

  if (!match) return;

  const textElement = match.getElement().asText();
  const start = match.getStartOffset();
  const end = match.getEndOffsetInclusive();
  const replacement = value || '';

  textElement.deleteText(start, end);
  textElement.insertText(start, replacement);

  if (replacement) {
    textElement.setFontFamily(start, start + replacement.length - 1, 'Arial');
    textElement.setFontSize(start, start + replacement.length - 1, 10);
    textElement.setBold(start, start + replacement.length - 1, false);
  }
}

function sanitizeFileName_(value) {
  return String(value)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ');
}

function escapeForFindText_(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}