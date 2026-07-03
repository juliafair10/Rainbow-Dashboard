const CONFIG = {
  EOJ_SOURCE_SPREADSHEET_ID: '10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs',
  EOJ_OUTPUT_SPREADSHEET_ID: '1GmsWkh8x_ICVEWNFP_WgT-hN6hQDSI_WF16J9T_R-NE',

  EOJ_LOG_SHEET_NAME: 'EOJ_Log',
  PROCESSING_OUTPUT_SHEET_NAME: 'EOJ_Processing_Output',

  EOJ_LOG_REQUIRED_COLUMNS: [
    'Processing_Status',
    'Processed_At',
    'Processing_Run_ID',
    'Processing_Error',
    'Processing_Output_ID',
    // Phase D: Todoist writeback — added automatically by ensureEOJLogProcessingColumns_()
    'Todoist_Task_ID',
    'Todoist_Task_URL'
  ],

  OUTPUT_COLUMNS: [
    'Output_ID',
    'EOJ_ID',
    'Processing_Run_ID',
    'Processed_At',
    'Technician',
    'Job_Name',
    'Claim_Number',
    'Claim_ID',
    'Customer_Name',
    'Property_Address',
    'Visit_Date',
    'Visit_Type',
    'Timeline_Event_JSON',
    'Condition_Output_JSON',
    'Alert_Output_JSON',
    'Follow_Up_Output_JSON',
    'Equipment_Output_JSON',
    'Review_Output_JSON',
    'Operational_Object_JSON',
    'Raw_Parsed_JSON',
    'Processing_Status',
    'Processing_Notes'
  ],

  STATUS: {
    PROCESSED: 'Processed',
    ERROR: 'Error',
    NEW: 'New'
  },

  // ── Todoist follow-up task creation ────────────────────────────────────────
  // Script Properties referenced here must be set in the Apps Script editor
  // (Project Settings → Script Properties) for the eoj-processing-engine project.
  // TODOIST_API_TOKEN is shared with insurance-intake-automation — same token.
  todoist: {
    apiTokenProperty:            'TODOIST_API_TOKEN',   // preferred; falls back to TODOIST_TOKEN
    projectIdProperty:           'TODOIST_PROJECT_ID',
    assigneeIdJuliaProperty:     'TODOIST_ASSIGNEE_ID_JULIA',
    assigneeIdClarenceProperty:  'TODOIST_ASSIGNEE_ID_CLARENCE',
    sectionIdProperty:           'TODOIST_SECTION_ID',  // optional
    priority:                    3,
    enabled:                     true
  }
};