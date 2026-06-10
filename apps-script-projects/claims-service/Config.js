/**
 * claims-service configuration
 * Rainbow Phase 4 — Claim Foundation
 */

const CLAIM_FOUNDATION_SPREADSHEET_ID = '1oIakFjdJSigre_abJ-iiM74Trr1nfoC4_rjFi0lWrts';

const CLAIM_SERVICE = {
  name: 'claims-service',
  phase: 'Phase 4 - Claim Foundation',
  timezone: 'America/New_York',
  spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID
};

const CLAIM_SHEET_NAMES = {
  claims: 'Claims',
  timeline: 'Claim_Timeline',
  conditions: 'Claim_Conditions',
  alerts: 'Claim_Alerts',
  ownershipHistory: 'Claim_Ownership_History',
  financialTracks: 'Financial_Tracks',
  externalLinks: 'External_Links',
  healthHistory: 'Claim_Health_History',
  serviceLog: 'Claim_Service_Log'
};

const CLAIM_FOUNDATION_SHEETS = {
  Claims: [
    'Claim_ID', 'Claim_Number', 'Customer_Name', 'Property_Address', 'Carrier',
    'Adjuster_Name', 'Adjuster_Email', 'Policy_Number', 'Loss_Date', 'Date_Received',
    'Source_System', 'Source_Email_Thread_ID', 'Claim_Folder_ID', 'Claim_Folder_URL',
    'Lifecycle_State', 'Ownership_Area', 'Primary_Owner', 'Operational_Health',
    'Health_Reason', 'Health_Updated_At', 'Health_Override', 'Health_Override_Reason',
    'Health_Override_Expires_At', 'Health_Override_Set_By',
    'Is_Active', 'Is_Not_Sold', 'Is_Operationally_Complete', 'Created_At',
    'Updated_At', 'Owner_Updated_At', 'Last_Meaningful_Activity_At', 'Last_EOJ_At',
    'Last_Payment_At', 'Last_Revision_At', 'Last_Carrier_Activity_At',
    'Last_Follow_Up_At', 'Last_Condition_Update_At', 'Last_Alert_Update_At', 'Notes'
  ],

  Claim_Timeline: [
    'Timeline_Event_ID', 'Claim_ID', 'Event_Date', 'Event_Type', 'Event_Source',
    'Source_Record_ID', 'Source_System', 'Summary', 'Detail', 'Actor',
    'Related_Workflow', 'Related_Financial_Track_ID', 'Is_Meaningful_Activity',
    'Created_At'
  ],

  Claim_Conditions: [
    'Condition_ID', 'Claim_ID', 'Condition_Type', 'Condition_Status', 'Opened_At',
    'Closed_At', 'Source_System', 'Source_Record_ID', 'Reason', 'Follow_Up_Date',
    'Owner_Area', 'Notes', 'Created_At', 'Updated_At'
  ],

  Claim_Alerts: [
    'Alert_ID', 'Claim_ID', 'Alert_Type', 'Alert_Status', 'Severity',
    'Source_System', 'Source_Record_ID', 'Reason', 'Recommended_Action',
    'Owner_Area', 'Created_At', 'Resolved_At', 'Notes'
  ],

  Claim_Ownership_History: [
    'Ownership_Record_ID', 'Claim_ID', 'Ownership_Area', 'Primary_Owner',
    'Started_At', 'Ended_At', 'Trigger_Event', 'Source_System',
    'Source_Record_ID', 'Notes'
  ],

  Financial_Tracks: [
    'Financial_Track_ID', 'Claim_ID', 'Track_Type', 'Track_Name',
    'Fusion_File_URL', 'Xactimate_URL', 'Symbility_URL', 'ClaimX_URL',
    'Status', 'Approval_State', 'Payment_State', 'Amount_Estimated',
    'Amount_Approved', 'Amount_Paid', 'Carrier', 'Created_At',
    'Updated_At', 'Closed_At', 'Notes'
  ],

  External_Links: [
    'External_Link_ID', 'Claim_ID', 'Financial_Track_ID', 'Link_Type',
    'URL', 'Label', 'Created_At', 'Updated_At', 'Notes'
  ],

  Claim_Health_History: [
    'Health_Record_ID', 'Claim_ID', 'Health_Level', 'Health_Reason',
    'Previous_Health_Level', 'Evaluated_At', 'Triggered_By', 'Is_Override',
    'Override_Expires_At', 'Active_Conditions_Snapshot',
    'Lifecycle_State_At_Evaluation', 'Ownership_Area_At_Evaluation',
    'Last_Meaningful_Activity_At_Evaluation', 'Notes'
  ],

  Claim_Service_Log: [
    'Log_ID', 'Timestamp', 'Action', 'Status', 'Claim_ID', 'Source_System',
    'Source_Record_ID', 'Message', 'Error_Detail', 'Raw_JSON'
  ]
};

const CLAIM_LIFECYCLE_STATES = [
  'Intake',
  'Active Work',
  'Insurance Resolution',
  'Administrative Closeout',
  'Operationally Complete',
  'Not Sold'
];


const CLAIM_OWNERSHIP_AREAS = [
  'Intake',
  'Field Operations',
  'Revision Management',
  'Accounting & Office Operations'
];

const RAINBOW_PEOPLE = {
  fieldTechnicians: [
    'Blake',
    'Tyler',
    'Cooper',
    'Patricia',
    'Clarence',
    'Joe'
  ],

  primaryFieldTechnicians: [
    'Blake',
    'Tyler',
    'Cooper',
    'Patricia'
  ],

  occasionalFieldTechnicians: [
    'Clarence',
    'Joe'
  ],

  officeOversight: [
    'Julia'
  ],

  revisionManagement: [
    'Clarence'
  ],

  accountingOfficeOperations: [
    'Julia'
  ]
};

const CLAIM_HEALTH_LEVELS = [
  'Healthy',
  'Attention Soon',
  'At Risk',
  'Escalated',
  'Critical'
];

const HEALTH_CONFIG = {
  staleAttentionDays: 7,
  staleAtRiskDays: 14,
  staleEscalatedDays: 21,
  staleCriticalDays: 30,

  monitoringCadenceDays: 3,
  revisionStaleDays: 5,
  coverageFollowupDays: 7,
  paymentAgingDays: 30,

  escalationPersistenceDays: 7,
  criticalPersistenceDays: 30,

  overrideDefaultExpiryDays: 7,

  conditionSeverityRanking: [
    'Positive Asbestos Result',
    'Abatement Required',
    'Revision Active',
    'Carrier Revision Requested',
    'Supplement Under Review',
    'Waiting on Payment',
    'Asbestos Testing Pending',
    'Waiting on Lab Results',
    'Coverage Pending',
    'Estimate Under Review',
    'Monitoring Active',
    'Source of Loss Unresolved',
    'Waiting on Customer Decision'
  ]
};

const CLAIM_CONDITION_TYPES = [
  'Waiting on Customer Decision',
  'Source of Loss Unresolved',
  'Monitoring Active',
  'Asbestos Testing Pending',
  'Waiting on Lab Results',
  'Positive Asbestos Result',
  'Abatement Required',
  'Coverage Pending',
  'Estimate Under Review',
  'Carrier Revision Requested',
  'Revision Active',
  'Supplement Under Review',
  'Waiting on Payment'
];

const CLAIM_ID_PREFIXES = {
  claim: 'CLM',
  timelineEvent: 'TLE',
  condition: 'CON',
  alert: 'ALT',
  ownership: 'OWN',
  financialTrack: 'FIN',
  externalLink: 'LNK',
  log: 'LOG'
};

function setupClaimFoundationSheets() {
  const ss = SpreadsheetApp.openById(CLAIM_FOUNDATION_SPREADSHEET_ID);
  const sheetNames = Object.keys(CLAIM_FOUNDATION_SHEETS);

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && !ss.getSheetByName(CLAIM_SHEET_NAMES.claims)) {
    defaultSheet.setName(CLAIM_SHEET_NAMES.claims);
  }

  sheetNames.forEach(function(sheetName) {
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = CLAIM_FOUNDATION_SHEETS[sheetName];
    const range = sheet.getRange(1, 1, 1, headers.length);
    const existingHeaders = range.getValues()[0];
    const hasHeaders = existingHeaders.some(function(value) {
      return value !== '';
    });

    if (!hasHeaders) {
      range.setValues([headers]);
    }

    sheet.setFrozenRows(1);
    range.setFontWeight('bold');
    sheet.autoResizeColumns(1, headers.length);
  });

  return successResponse({
    spreadsheetId: CLAIM_FOUNDATION_SPREADSHEET_ID,
    sheets: sheetNames
  }, 'Rainbow Claim Foundation sheets are set up.');
}