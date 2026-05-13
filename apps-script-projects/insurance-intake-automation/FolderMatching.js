function claimFolderMapHasDuplicate_(claimData, thread) {
  const result = {
    duplicate: false,
    reason: '',
    rowNumber: 0,
    existingFolderId: '',
    existingFolderUrl: ''
  };

  if (!claimData) {
    return result;
  }

  const jobNumber = String(claimData.rainbowJobNumber || claimData.claimNumber || '').trim();

  if (!jobNumber) {
    return result;
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.claimFolderMapSheetName);

    if (!sheet) {
      return result;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 2 || lastColumn < 1) {
      return result;
    }

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values[0].map(function(header) {
      return String(header || '').trim().toLowerCase();
    });

    const jobNumberColumn = findHeaderIndex_(headers, [
      'our job number',
      'job number',
      'claim number',
      'claim #'
    ]);

    const folderUrlColumn = findHeaderIndex_(headers, [
      'drive folder url',
      'folder url'
    ]);

    const folderIdColumn = findHeaderIndex_(headers, [
      'folder id',
      'drive folder id'
    ]);

    if (jobNumberColumn === -1) {
      return result;
    }

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowNumber = i + 1;
      const rowJobNumber = String(row[jobNumberColumn] || '').trim();

      if (rowJobNumber && rowJobNumber === jobNumber) {
        const existingFolderUrl = folderUrlColumn !== -1 ? String(row[folderUrlColumn] || '').trim() : '';
        const existingFolderId = folderIdColumn !== -1 ? String(row[folderIdColumn] || '').trim() : '';

        if (existingFolderUrl || existingFolderId) {
          result.duplicate = true;
          result.reason = 'job_number_exists_with_folder';
          result.rowNumber = rowNumber;
          result.existingFolderId = existingFolderId;
          result.existingFolderUrl = existingFolderUrl;
          return result;
        }
      }
    }

    return result;
  } catch (error) {
    return result;
  }
}

function findHeaderIndex_(headers, possibleNames) {
  for (let i = 0; i < headers.length; i++) {
    const normalizedHeader = String(headers[i] || '').replace(/[^a-z0-9#]/g, '').toLowerCase();

    for (let j = 0; j < possibleNames.length; j++) {
      const normalizedName = String(possibleNames[j] || '').replace(/[^a-z0-9#]/g, '').toLowerCase();

      if (normalizedHeader === normalizedName) {
        return i;
      }
    }
  }

  return -1;
}

function checkOrCreateClaimFolder_(claimData) {
  const result = {
    success: false,
    status: 'started',
    folderId: '',
    folderUrl: '',
    folderName: '',
    created: false,
    existing: false,
    error: ''
  };

  try {
    const claimNumber = String(
      claimData && (claimData.claimNumber || claimData.rainbowJobNumber) || ''
    ).trim();

    const customerName = String(
      claimData && (claimData.customerName || claimData.insuredName) || ''
    ).trim();

    if (!claimNumber || !customerName) {
      result.status = 'missing_required_fields';
      result.error = 'Missing customer name or claim number.';
      return result;
    }

    const rootFolder = DriveApp.getFolderById(
      CONFIG.claimFolderParentFolderId
    );

    const currentYear = String(new Date().getFullYear());

    let yearFolder;
    const existingYearFolders = rootFolder.getFoldersByName(currentYear);

    if (existingYearFolders.hasNext()) {
      yearFolder = existingYearFolders.next();
    } else {
      yearFolder = rootFolder.createFolder(currentYear);
    }

    const safeCustomerName = customerName
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    const safeClaimNumber = claimNumber
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    const expectedFolderName =
      safeCustomerName + ' - ' + safeClaimNumber;

    const existingFolders =
      yearFolder.getFoldersByName(expectedFolderName);

    if (existingFolders.hasNext()) {
      const folder = existingFolders.next();

      result.success = true;
      result.status = 'existing_folder_found';
      result.folderId = folder.getId();
      result.folderUrl = folder.getUrl();
      result.folderName = folder.getName();
      result.existing = true;

      return result;
    }

    if (!CONFIG.createClaimFolders) {
      result.status = 'claim_folder_not_found';
      result.error =
        'No existing claim folder found and createClaimFolders is disabled.';
      return result;
    }

    if (CONFIG.dryRun) {
      result.success = true;
      result.status = 'dry_run_folder_create_skipped';
      result.folderName = expectedFolderName;
      return result;
    }

    const newFolder =
      yearFolder.createFolder(expectedFolderName);

    result.success = true;
    result.status = 'folder_created';
    result.folderId = newFolder.getId();
    result.folderUrl = newFolder.getUrl();
    result.folderName = newFolder.getName();
    result.created = true;

    return result;

  } catch (error) {
    result.status = 'folder_check_exception';
    result.error =
      error && error.message ? error.message : error.toString();

    return result;
  }
}

function appendClaimFolderMapRow_(claimData, folderResult, thread) {
  const result = {
    success: false,
    sheetUpdated: false,
    dryRun: false,
    rowNumber: 0,
    error: ''
  };

  try {
    const jobNumber = String(claimData && (claimData.rainbowJobNumber || claimData.claimNumber) || '').trim();

    if (!claimData || !jobNumber) {
      result.error = 'Cannot append claim folder map row without an Our Job Number / claim number.';
      return result;
    }

    if (!folderResult || !folderResult.success) {
      result.error = 'Cannot append claim folder map row without a successful folder result.';
      return result;
    }

    if (CONFIG.dryRun) {
      result.success = true;
      result.dryRun = true;
      return result;
    }

    const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
    let sheet = ss.getSheetByName(CONFIG.claimFolderMapSheetName);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.claimFolderMapSheetName);
    }

    ensureClaimFolderMapHeader_(sheet);

    const currentYear = new Date().getFullYear();
    const notes = [
      'Created by ' + CONFIG.automationName,
      'Claim Number: ' + (claimData.claimNumber || ''),
      'Thread ID: ' + (thread && thread.getId ? thread.getId() : ''),
      'Folder Status: ' + (folderResult.status || '')
    ].filter(function(note) {
      return String(note || '').trim() !== '';
    }).join(' | ');

    const row = [
      claimData.customerName || claimData.insuredName || '',
      jobNumber,
      currentYear,
      folderResult.folderUrl || '',
      folderResult.folderId || '',
      true,
      '',
      new Date(),
      notes,
      claimData.lossAddress || ''
    ];

    sheet.appendRow(row);
    result.success = true;
    result.sheetUpdated = true;
    result.rowNumber = sheet.getLastRow();
    return result;
  } catch (error) {
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function ensureClaimFolderMapHeader_(sheet) {
  const headers = getClaimFolderMapHeaders_();
  const lastColumn = Math.max(sheet.getLastColumn(), headers.length);
  const existingHeader = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const hasHeader = existingHeader.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  const normalizedExistingHeaders = existingHeader.map(function(value) {
    return String(value || '').trim().toLowerCase();
  });

  headers.forEach(function(header) {
    const normalizedHeader = String(header || '').trim().toLowerCase();

    if (normalizedExistingHeaders.indexOf(normalizedHeader) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      normalizedExistingHeaders.push(normalizedHeader);
    }
  });

  sheet.setFrozenRows(1);
}


function checkOrCreateVendorSubfolder_(folderResult, subfolderName) {
  const result = {
    success: false,
    status: 'started',
    parentFolderId: '',
    parentFolderUrl: '',
    subfolderId: '',
    subfolderUrl: '',
    subfolderName: subfolderName || '',
    created: false,
    existing: false,
    error: ''
  };

  try {
    let parentFolderId = '';

    if (typeof folderResult === 'string') {
      parentFolderId = String(folderResult || '').trim();
    } else if (folderResult && folderResult.folderId) {
      parentFolderId = String(folderResult.folderId || '').trim();
    } else if (folderResult && folderResult.folderUrl) {
      parentFolderId = extractDriveFolderIdFromUrl_(folderResult.folderUrl);
    } else if (folderResult && folderResult.parentFolderId) {
      parentFolderId = String(folderResult.parentFolderId || '').trim();
    }

    if (!parentFolderId) {
      result.status = 'missing_parent_folder_id';
      result.error = 'Cannot create vendor subfolder without a parent claim folder ID.';
      return result;
    }

    const safeSubfolderName = String(subfolderName || '').trim();

    if (!safeSubfolderName) {
      result.status = 'missing_subfolder_name';
      result.error = 'Cannot create vendor subfolder without a subfolder name.';
      return result;
    }

    const parentFolder = DriveApp.getFolderById(parentFolderId);
    result.parentFolderId = parentFolderId;
    result.parentFolderUrl = parentFolder.getUrl();

    const existingSubfolders = parentFolder.getFoldersByName(safeSubfolderName);

    if (existingSubfolders.hasNext()) {
      const subfolder = existingSubfolders.next();
      result.success = true;
      result.status = 'existing_vendor_subfolder_found';
      result.subfolderId = subfolder.getId();
      result.subfolderUrl = subfolder.getUrl();
      result.subfolderName = subfolder.getName();
      result.existing = true;
      return result;
    }

    if (CONFIG.dryRun) {
      result.success = true;
      result.status = 'dry_run_vendor_subfolder_create_skipped';
      result.subfolderName = safeSubfolderName;
      return result;
    }

    const subfolder = parentFolder.createFolder(safeSubfolderName);
    result.success = true;
    result.status = 'vendor_subfolder_created';
    result.subfolderId = subfolder.getId();
    result.subfolderUrl = subfolder.getUrl();
    result.subfolderName = subfolder.getName();
    result.created = true;
    return result;
  } catch (error) {
    result.status = 'vendor_subfolder_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function findExistingClaimFolderByLocationForVendor_(claimData, thread) {
  const result = {
    success: false,
    status: 'location_match_not_found',
    matchedBy: 'location_of_property',
    folderId: '',
    folderUrl: '',
    folderName: '',
    jobNumber: '',
    customerName: '',
    locationOfProperty: '',
    candidateAddress: '',
    matchCount: 0,
    error: ''
  };

  try {
    const candidateAddress = extractVendorLocationCandidate_(claimData, thread);
    result.candidateAddress = candidateAddress;

    if (!candidateAddress) {
      result.status = 'missing_location_candidate';
      result.error = 'No usable address/location candidate was found in vendor thread.';
      return result;
    }

    const normalizedCandidate = normalizeAddressForMatch_(candidateAddress);

    if (!normalizedCandidate) {
      result.status = 'invalid_location_candidate';
      result.error = 'Address/location candidate could not be normalized.';
      return result;
    }

    const ss = SpreadsheetApp.openById(CONFIG.claimFolderMapSpreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.claimFolderMapSheetName);

    if (!sheet) {
      result.status = 'claim_folder_map_missing';
      result.error = 'Claim Folder Map sheet was not found.';
      return result;
    }

    ensureClaimFolderMapHeader_(sheet);

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 2 || lastColumn < 1) {
      result.status = 'claim_folder_map_empty';
      result.error = 'Claim Folder Map has no data rows.';
      return result;
    }

    const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
    const headers = values[0].map(function(header) {
      return String(header || '').trim().toLowerCase();
    });

    const locationColumn = findHeaderIndex_(headers, [
      'location of property',
      'loss address',
      'property address'
    ]);

    const jobNumberColumn = findHeaderIndex_(headers, [
      'our job number',
      'job number',
      'claim number',
      'claim #'
    ]);

    const customerNameColumn = findHeaderIndex_(headers, [
      'customer name',
      'insured name'
    ]);

    const folderUrlColumn = findHeaderIndex_(headers, [
      'drive folder url',
      'folder url'
    ]);

    const folderIdColumn = findHeaderIndex_(headers, [
      'folder id',
      'drive folder id'
    ]);

    if (locationColumn === -1) {
      result.status = 'location_column_missing';
      result.error = 'Claim Folder Map is missing Location of Property column.';
      return result;
    }

    const matches = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const rowLocation = String(row[locationColumn] || '').trim();
      const normalizedRowLocation = normalizeAddressForMatch_(rowLocation);

      if (!normalizedRowLocation) {
        continue;
      }

      if (addressLooksLikeMatch_(normalizedCandidate, normalizedRowLocation)) {
        matches.push({
          rowNumber: i + 1,
          row: row,
          location: rowLocation
        });
      }
    }

    result.matchCount = matches.length;

    if (matches.length === 0) {
      const customerFallbackResult = findExistingClaimFolderByVendorCustomerName_(claimData, thread, values, headers);

      if (customerFallbackResult.success) {
        return customerFallbackResult;
      }

      const driveFolderFallbackResult = findExistingClaimFolderByVendorDriveFolderName_(claimData, thread);

      if (driveFolderFallbackResult.success) {
        return driveFolderFallbackResult;
      }

      result.status = 'location_match_not_found';
      result.error = 'No claim folder map row matched Location of Property: ' + candidateAddress +
        '. Customer fallback status: ' + customerFallbackResult.status + '. ' + (customerFallbackResult.error || '') +
        ' Drive folder fallback status: ' + driveFolderFallbackResult.status + '. ' + (driveFolderFallbackResult.error || '');
      return result;
    }

    if (matches.length > 1) {
      result.status = 'location_match_ambiguous';
      result.error = 'Multiple claim folder map rows matched Location of Property: ' + candidateAddress;
      return result;
    }

    const match = matches[0];
    const row = match.row;
    const folderId = folderIdColumn !== -1 ? String(row[folderIdColumn] || '').trim() : '';
    const folderUrl = folderUrlColumn !== -1 ? String(row[folderUrlColumn] || '').trim() : '';

    if (!folderId && !folderUrl) {
      result.status = 'location_match_missing_folder';
      result.error = 'Matched Location of Property but row has no folder ID or URL.';
      return result;
    }

    result.success = true;
    result.status = 'folder_found_by_location';
    result.folderId = folderId || extractDriveFolderIdFromUrl_(folderUrl);
    result.folderUrl = folderUrl || (result.folderId ? 'https://drive.google.com/drive/folders/' + result.folderId : '');
    result.folderName = '';
    result.jobNumber = jobNumberColumn !== -1 ? String(row[jobNumberColumn] || '').trim() : '';
    result.customerName = customerNameColumn !== -1 ? String(row[customerNameColumn] || '').trim() : '';
    result.locationOfProperty = match.location;

    return result;
  } catch (error) {
    result.status = 'location_match_exception';
    result.error = error && error.message ? error.message : error.toString();
    return result;
  }
}

function findExistingClaimFolderByVendorDriveFolderName_(claimData, thread) {

  const result = {

    success: false,

    status: 'drive_folder_customer_name_match_not_found',

    matchedBy: 'vendor_customer_name_drive_folder',

    folderId: '',

    folderUrl: '',

    folderName: '',

    jobNumber: '',

    customerName: '',

    locationOfProperty: '',

    candidateCustomerName: '',

    matchCount: 0,

    error: ''

  };

  try {

    const candidateCustomerName = extractVendorCustomerCandidate_(claimData, thread);

    result.candidateCustomerName = candidateCustomerName;

    if (!candidateCustomerName) {

      result.status = 'missing_customer_candidate';

      result.error = 'No usable customer name candidate was found in vendor thread.';

      return result;

    }

    const normalizedCandidate = normalizeCustomerNameForMatch_(candidateCustomerName);

    const rootFolder = DriveApp.getFolderById(CONFIG.claimFolderParentFolderId);

    const currentYear = String(new Date().getFullYear());

    const yearFolders = rootFolder.getFoldersByName(currentYear);

    if (!yearFolders.hasNext()) {

      result.status = 'current_year_folder_missing';

      result.error = 'Current year folder was not found: ' + currentYear;

      return result;

    }

    const yearFolder = yearFolders.next();

    const folders = yearFolder.getFolders();

    const matches = [];

    while (folders.hasNext()) {

      const folder = folders.next();

      const folderName = folder.getName() || '';

      const normalizedFolderName = normalizeCustomerNameForMatch_(folderName);

      if (customerNamesLookLikeMatch_(normalizedCandidate, normalizedFolderName)) {

        matches.push(folder);

      }

    }

    result.matchCount = matches.length;

    if (matches.length !== 1) {

      result.status = matches.length > 1

        ? 'drive_folder_customer_name_match_ambiguous'

        : 'drive_folder_customer_name_match_not_found';

      result.error = 'Drive folder customer-name fallback found ' + matches.length + ' match(es) for: ' + candidateCustomerName;

      return result;

    }

    const matchedFolder = matches[0];

    const folderName = matchedFolder.getName() || '';

    const claimNumberMatch = folderName.match(/([0-9]{7,10})/);

    result.success = true;

    result.status = 'folder_found_by_drive_folder_customer_name';

    result.folderId = matchedFolder.getId();

    result.folderUrl = matchedFolder.getUrl();

    result.folderName = folderName;

    result.jobNumber = claimNumberMatch && claimNumberMatch[1] ? claimNumberMatch[1] : '';

    result.customerName = candidateCustomerName;

    result.locationOfProperty = claimData && claimData.lossAddress ? claimData.lossAddress : '';

    return result;

  } catch (error) {

    result.status = 'drive_folder_customer_name_match_exception';

    result.error = error && error.message ? error.message : error.toString();

    return result;

  }

}

function findExistingClaimFolderByVendorCustomerName_(claimData, thread, values, headers) {
  const result = {
    success: false,
    status: 'customer_name_match_not_found',
    matchedBy: 'vendor_customer_name',
    folderId: '',
    folderUrl: '',
    folderName: '',
    jobNumber: '',
    customerName: '',
    locationOfProperty: '',
    candidateCustomerName: '',
    matchCount: 0,
    error: ''
  };

  const candidateCustomerName = extractVendorCustomerCandidate_(claimData, thread);
  result.candidateCustomerName = candidateCustomerName;

  if (!candidateCustomerName) {
    result.status = 'missing_customer_candidate';
    result.error = 'No usable customer name candidate was found in vendor thread.';
    return result;
  }

  const normalizedCandidate = normalizeCustomerNameForMatch_(candidateCustomerName);

  if (!normalizedCandidate) {
    result.status = 'invalid_customer_candidate';
    result.error = 'Customer name candidate could not be normalized.';
    return result;
  }

  const customerNameColumn = findHeaderIndex_(headers, [
    'customer name',
    'insured name'
  ]);

  const jobNumberColumn = findHeaderIndex_(headers, [
    'our job number',
    'job number',
    'claim number',
    'claim #'
  ]);

  const folderUrlColumn = findHeaderIndex_(headers, [
    'drive folder url',
    'folder url'
  ]);

  const folderIdColumn = findHeaderIndex_(headers, [
    'folder id',
    'drive folder id'
  ]);

  const locationColumn = findHeaderIndex_(headers, [
    'location of property',
    'loss address',
    'property address'
  ]);

  if (customerNameColumn === -1) {
    result.status = 'customer_name_column_missing';
    result.error = 'Claim Folder Map is missing Customer Name column.';
    return result;
  }

  const matches = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowCustomerName = String(row[customerNameColumn] || '').trim();
    const normalizedRowCustomerName = normalizeCustomerNameForMatch_(rowCustomerName);

    if (!normalizedRowCustomerName) {
      continue;
    }

    if (customerNamesLookLikeMatch_(normalizedCandidate, normalizedRowCustomerName)) {
      matches.push({
        rowNumber: i + 1,
        row: row,
        customerName: rowCustomerName
      });
    }
  }

  result.matchCount = matches.length;

  if (matches.length === 0) {
    result.status = 'customer_name_match_not_found';
    result.error = 'No claim folder map row matched customer name: ' + candidateCustomerName;
    return result;
  }

  if (matches.length > 1) {
    result.status = 'customer_name_match_ambiguous';
    result.error = 'Multiple claim folder map rows matched customer name: ' + candidateCustomerName;
    return result;
  }

  const match = matches[0];
  const row = match.row;
  const folderId = folderIdColumn !== -1 ? String(row[folderIdColumn] || '').trim() : '';
  const folderUrl = folderUrlColumn !== -1 ? String(row[folderUrlColumn] || '').trim() : '';

  if (!folderId && !folderUrl) {
    result.status = 'customer_name_match_missing_folder';
    result.error = 'Matched customer name but row has no folder ID or URL.';
    return result;
  }

  result.success = true;
  result.status = 'folder_found_by_customer_name';
  result.folderId = folderId || extractDriveFolderIdFromUrl_(folderUrl);
  result.folderUrl = folderUrl || (result.folderId ? 'https://drive.google.com/drive/folders/' + result.folderId : '');
  result.folderName = '';
  result.jobNumber = jobNumberColumn !== -1 ? String(row[jobNumberColumn] || '').trim() : '';
  result.customerName = match.customerName;
  result.locationOfProperty = locationColumn !== -1 ? String(row[locationColumn] || '').trim() : '';

  return result;
}

function extractVendorCustomerCandidate_(claimData, thread) {
  if (claimData && (claimData.customerName || claimData.insuredName)) {
    return String(claimData.customerName || claimData.insuredName || '').trim();
  }

  const messages = thread && thread.getMessages ? thread.getMessages() : [];
  const textParts = [];

  messages.forEach(function(message) {
    textParts.push(message.getSubject() || '');
    textParts.push(message.getPlainBody() || '');
  });

  const text = normalizeInsuranceIntakeText_(textParts.join('\n'));
  const subject = messages.length > 0 ? String(messages[0].getSubject() || '') : '';

  const slashNameMatch = text.match(/\bfor\s+\d{2,6}\s+[A-Za-z0-9 .'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Court|Ct|Drive|Dr|Lane|Ln|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Way|Terrace|Ter)\s*\/\s*([A-Za-z][A-Za-z .'-]+?)(?:\.|\n|$)/i);

  if (slashNameMatch && slashNameMatch[1]) {
    return String(slashNameMatch[1]).replace(/[).,\s]+$/g, '').trim();
  }

  const reportSubjectMatch = subject.match(/Inspection Report\s*-\s*[^-]+\s*-\s*([A-Za-z][A-Za-z .'-]+)$/i);

  if (reportSubjectMatch && reportSubjectMatch[1]) {
    return String(reportSubjectMatch[1]).replace(/[).,\s]+$/g, '').trim();
  }

  const trailingNameMatch = subject.match(/-\s*([A-Za-z][A-Za-z .'-]+)$/i);

  if (trailingNameMatch && trailingNameMatch[1]) {
    const candidate = String(trailingNameMatch[1]).replace(/[).,\s]+$/g, '').trim();

    if (!/court|street|avenue|road|drive|lane|place|circle|trail|parkway|invoice|report/i.test(candidate)) {
      return candidate;
    }
  }

  return '';
}

function normalizeCustomerNameForMatch_(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();
}

function customerNamesLookLikeMatch_(candidate, rowName) {
  if (!candidate || !rowName) {
    return false;
  }

  if (candidate === rowName) {
    return true;
  }

  if (candidate.length >= 6 && rowName.indexOf(candidate) !== -1) {
    return true;
  }

  if (rowName.length >= 6 && candidate.indexOf(rowName) !== -1) {
    return true;
  }

  return false;
}

function extractVendorLocationCandidate_(claimData, thread) {
  if (claimData && claimData.lossAddress) {
    return String(claimData.lossAddress || '').trim();
  }

  const messages = thread && thread.getMessages ? thread.getMessages() : [];
  const textParts = [];

  messages.forEach(function(message) {
    textParts.push(message.getSubject() || '');
    textParts.push(message.getPlainBody() || '');
  });

  const text = normalizeInsuranceIntakeText_(textParts.join('\n'));

  const bodyForAddressMatch = text.match(/\bfor\s+(\d{2,6}\s+[A-Za-z0-9 .'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Court|Ct|Drive|Dr|Lane|Ln|Place|Pl|Circle|Cir|Trail|Trl|Parkway|Pkwy|Way|Terrace|Ter))\s*(?:\/|\n|\.|,)/i);

  if (bodyForAddressMatch && bodyForAddressMatch[1]) {
    return String(bodyForAddressMatch[1]).trim();
  }

  const locationOfProperty = extractInsuranceLossAddress_(text);

  if (locationOfProperty) {
    return locationOfProperty;
  }

  const subject = messages.length > 0 ? String(messages[0].getSubject() || '') : '';

  const parentheticalAddressMatches = subject.match(/\(([^)]*\d+[^)]*)\)/g) || [];

  for (let i = 0; i < parentheticalAddressMatches.length; i++) {
    const cleanedParenthetical = parentheticalAddressMatches[i]
      .replace(/^\(/, '')
      .replace(/\)$/, '')
      .trim();

    const parentheticalDashMatch = cleanedParenthetical.match(/-\s*(\d+\s+.+)$/i);

    if (parentheticalDashMatch && parentheticalDashMatch[1]) {
      return String(parentheticalDashMatch[1]).trim();
    }

    if (/\d+\s+[A-Za-z]/.test(cleanedParenthetical) && !/^\d+[\s-]*\d*$/.test(cleanedParenthetical)) {
      return cleanedParenthetical;
    }
  }

  const reportSubjectAddressMatch = subject.match(/(?:report|invoice)\s*-\s*(\d+[^-()]+?)(?:\s*-|\s*\(|$)/i);

  if (reportSubjectAddressMatch && reportSubjectAddressMatch[1]) {
    return String(reportSubjectAddressMatch[1]).trim();
  }

  const genericTrailingAddressMatch = subject.match(/-\s*(\d+\s+[A-Za-z][^-()]+?)(?:\s*-|\s*\(|$)/i);

  if (genericTrailingAddressMatch && genericTrailingAddressMatch[1]) {
    return String(genericTrailingAddressMatch[1]).trim();
  }

  return '';
}

function normalizeAddressForMatch_(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/\b(street)\b/g, 'st')
    .replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(road)\b/g, 'rd')
    .replace(/\b(court)\b/g, 'ct')
    .replace(/\b(drive)\b/g, 'dr')
    .replace(/\b(lane)\b/g, 'ln')
    .replace(/\b(place)\b/g, 'pl')
    .replace(/\b(circle)\b/g, 'cir')
    .replace(/\b(trail)\b/g, 'trl')
    .replace(/\b(parkway)\b/g, 'pkwy')
    .replace(/\b(georgia)\b/g, 'ga')
    .replace(/\b(usa|united states)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function addressLooksLikeMatch_(candidate, rowAddress) {
  if (!candidate || !rowAddress) {
    return false;
  }

  if (candidate === rowAddress) {
    return true;
  }

  if (candidate.length >= 8 && rowAddress.indexOf(candidate) !== -1) {
    return true;
  }

  if (rowAddress.length >= 8 && candidate.indexOf(rowAddress) !== -1) {
    return true;
  }

  return false;
}

function extractDriveFolderIdFromUrl_(url) {
  const match = String(url || '').match(/folders\/([A-Za-z0-9_-]+)/);
  return match && match[1] ? match[1] : '';
}

function getClaimFolderMapHeaders_() {
  return [
    'Customer Name',
    'Our Job Number',
    'Year',
    'Drive Folder URL',
    'Folder ID',
    'Active',
    'Default Subfolder',
    'Last Updated',
    'Notes',
    'Location of Property'
  ];
}

