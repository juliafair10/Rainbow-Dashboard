// CERTIFICATE OF COMPLETION WORKFLOW
//
// Master Template Rules:
// 1. Never fill the master template directly
// 2. The script creates a copy first
// 3. The copy is renamed and filled automatically
// 4. Send the COPY for eSignature, never the template
//
// Before sending for signature:
// - Open Tools -> eSignature
// - Verify signer name/email
// - Replace any previous signer
// - Verify signature + initials + signed date fields

const CERTIFICATE_FOLDER_ID = '12VNS7KYDNLRA6hqkBf5obu4HX6GSZ1OZ';

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Certificate Tools')
    .addItem('Create Certificate from Form', 'showCertificateSidebar')
    .addToUi();
}

function showCertificateSidebar() {
  const html = HtmlService
    .createHtmlOutputFromFile('Sidebar')
    .setTitle('Create Certificate');

  DocumentApp.getUi().showSidebar(html);
}

function createCertificate(data) {
  const templateDoc = DocumentApp.getActiveDocument();
  const templateFile = DriveApp.getFileById(templateDoc.getId());
  const certificateFolder = getCertificateFolder_();

  const customerName = data.customerName || 'Customer';
  const cleanCustomerName = sanitizeFileName_(customerName);

  const newFileName =
    'Rainbow Metro Atlanta Certificate of Completion - ' + cleanCustomerName;

  const copiedFile = templateFile.makeCopy(newFileName, certificateFolder);
  const copiedDoc = DocumentApp.openById(copiedFile.getId());
  const body = copiedDoc.getBody();

  replacePlaceholder_(body, '{{CUSTOMER_NAME}}', data.customerName);
  replacePlaceholder_(body, '{{INSURANCE_COMPANY}}', data.insuranceCompany);
  replacePlaceholder_(body, '{{CLAIM_NUMBER}}', data.claimNumber);
  replacePlaceholder_(body, '{{DATE}}', data.date);
  replacePlaceholder_(body, '{{STREET_ADDRESS}}', data.streetAddress);
  replacePlaceholder_(body, '{{CITY}}', data.city);
  replacePlaceholder_(body, '{{STATE}}', data.state);
  replacePlaceholder_(body, '{{ZIP}}', data.zip);
  replacePlaceholder_(body, '{{DAMAGE_TYPE}}', data.damageType);
  replacePlaceholder_(body, '{{LOSS_DATE}}', data.lossDate);

  copiedDoc.saveAndClose();

  return {
    status: 'Success',
    message: 'Certificate created successfully.',
    documentUrl: copiedFile.getUrl(),
    documentName: newFileName
  };
}

function getCertificateFolder_() {
  if (!CERTIFICATE_FOLDER_ID || CERTIFICATE_FOLDER_ID === 'PASTE_CERTIFICATE_FOLDER_ID_HERE') {
    throw new Error('Certificate folder ID is missing. Paste the Google Drive folder ID into CERTIFICATE_FOLDER_ID in Code.js.');
  }

  try {
    return DriveApp.getFolderById(CERTIFICATE_FOLDER_ID);
  } catch (error) {
    throw new Error(
      'Could not open the Certificate folder. Confirm CERTIFICATE_FOLDER_ID is a Google Drive folder ID, not a Google Doc ID, and that this Google account has access. Current ID: ' + CERTIFICATE_FOLDER_ID
    );
  }
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
