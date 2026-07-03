/**
 * ClaimsBridge.js — EOJ Processing Engine
 *
 * Writes interpreted EOJ outputs directly to Rainbow's Claims Database.
 * Called from processUnprocessedEOJs() after a successful interpretation.
 *
 * Writes to:
 *   Timeline_Events      — one row per timeline event from the EOJ
 *   Claim_Conditions     — open conditions flagged by the EOJ; updates Follow_Up_Date
 *                          on existing 'Monitoring Active' conditions when a new
 *                          monitoring date is provided
 *   Claim_Alerts         — alerts flagged by the EOJ
 *   Claims               — snapshot: Last_EOJ_At, Last_Meaningful_Activity_At,
 *                          Last_EOJ_Technician, Last_EOJ_Visit_Type, Last_EOJ_Job_Status,
 *                          Last_EOJ_Work_Summary, Last_EOJ_Insurance_Summary,
 *                          Last_MICA_Status, Last_MICA_Expected_Update_Date
 *   Claim_Service_Log    — audit entry
 *
 * Rules:
 *   - All writes use header-based column mapping (never positional appendRow)
 *   - Append-only for Timeline_Events, Conditions, Alerts, Service_Log
 *   - Claims row is updated in-place (snapshot fields only)
 *   - Non-fatal: a bridge failure is logged but does not fail the processing run
 *   - Conditions are deduplicated: a new Open condition is NOT written if one of
 *     the same type is already Open for this claim; existing monitoring conditions
 *     have their Follow_Up_Date updated instead
 *
 * Phase 3.5 changes (EOJ Integration Hardening):
 *   Phase A — expanded CONDITION_TYPE_MAP_, Follow_Up_Date written on conditions
 *   Phase B — snapshot fields written to Claims row (requires schema migration)
 *   Phase C — MICA/Mitigate snapshot written (Last_MICA_Status etc.)
 *   Phase F — 'EOJ Submitted' is now the first timeline event (fix in EOJInterpreter)
 *
 * Schema migration: run runPhase35ClaimsSnapshotMigration() once from the Apps
 * Script editor to add the Phase B/C columns to the Claims sheet before deploying.
 */

var CLAIMS_DB_ID_    = '1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c';

var CLAIMS_SHEETS_   = {
  claims:     'Claims',
  timeline:   'Timeline_Events',
  conditions: 'Claim_Conditions',
  alerts:     'Claim_Alerts',
  serviceLog: 'Claim_Service_Log'
};

// Maps interpreter condition keys → Rainbow canonical condition types.
// Keys must match fields in conditionOutput returned by buildConditionOutput_().
// Types must match CLAIM_CONDITION_TYPES in claims-service/Config.js.
// Phase A additions: waiting_on_lab_results (asbestos samples taken → awaiting results),
//   field_work_complete (field signal, no health impact today but persisted for lifecycle use).
var CONDITION_TYPE_MAP_ = {
  monitoring_active:        'Monitoring Active',
  asbestos_testing_pending: 'Asbestos Testing Pending',
  waiting_on_lab_results:   'Waiting on Lab Results',
  field_work_complete:      'Field Work Complete'
};

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Write all EOJ outputs to the Claims Database.
 * Non-fatal: logs errors but does not throw.
 *
 * @param {Object} interpreted - return value of interpretBasicEOJ_()
 * @returns {Object} result summary
 */
function writeEojToClaimsDatabase_(interpreted) {
  const result = {
    claimId:        interpreted ? interpreted.claimId : null,
    timelineEvents: 0,
    conditions:     0,
    alerts:         0,
    claimUpdated:   false,
    skipped:        false,
    errors:         []
  };

  if (!interpreted || !interpreted.claimId) {
    Logger.log('ClaimsBridge: No claimId — skipping Claims Database writes.');
    result.skipped = true;
    result.skipReason = 'No claimId in interpreted output';
    return result;
  }

  const claimId = String(interpreted.claimId);
  const ss = SpreadsheetApp.openById(CLAIMS_DB_ID_);

  // ── 1. Timeline Events ──────────────────────────────────────────────────
  try {
    const tlSheet = ss.getSheetByName(CLAIMS_SHEETS_.timeline);
    if (tlSheet && interpreted.timelineEvent && interpreted.timelineEvent.events) {
      const idx = claimsHeaderIndex_(tlSheet);
      interpreted.timelineEvent.events.forEach(function (event) {
        appendByHeaderMap_(tlSheet, idx, buildTimelineRow_(claimId, event, interpreted));
        result.timelineEvents++;
      });
    }
  } catch (e) {
    result.errors.push('Timeline_Events: ' + (e.message || e));
    Logger.log('ClaimsBridge Timeline error: ' + (e.message || e));
  }

  // ── 2. Conditions (deduplicated) ────────────────────────────────────────
  try {
    const condSheet = ss.getSheetByName(CLAIMS_SHEETS_.conditions);
    if (condSheet && interpreted.conditionOutput) {
      const idx     = claimsHeaderIndex_(condSheet);
      const condOut = interpreted.conditionOutput;
      const openSet = getOpenConditionTypes_(condSheet, claimId);

      Object.keys(CONDITION_TYPE_MAP_).forEach(function (key) {
        if (!condOut[key]) return;                       // not flagged
        const condType = CONDITION_TYPE_MAP_[key];
        if (openSet.has(condType)) {
          // Phase A: when monitoring is already open, refresh Follow_Up_Date
          // so the Health Engine can re-evaluate suppression against the new date.
          if (condType === 'Monitoring Active' && interpreted.monitoringOutput &&
              interpreted.monitoringOutput.next_monitoring_date) {
            updateConditionFollowUpDate_(condSheet, claimId, condType,
              interpreted.monitoringOutput.next_monitoring_date);
          }
          Logger.log('ClaimsBridge: condition "' + condType + '" already open for ' + claimId + ' — skipping duplicate.');
          return;
        }
        appendByHeaderMap_(condSheet, idx, buildConditionRow_(claimId, condType, key, interpreted));
        openSet.add(condType);
        result.conditions++;
      });
    }
  } catch (e) {
    result.errors.push('Claim_Conditions: ' + (e.message || e));
    Logger.log('ClaimsBridge Conditions error: ' + (e.message || e));
  }

  // ── 3. Alerts ───────────────────────────────────────────────────────────
  try {
    const alertSheet = ss.getSheetByName(CLAIMS_SHEETS_.alerts);
    if (alertSheet && interpreted.alertOutput) {
      const idx      = claimsHeaderIndex_(alertSheet);
      const alertOut = interpreted.alertOutput;

      if (alertOut.follow_up_required) {
        const desc = interpreted.followUpOutput && interpreted.followUpOutput.description
          ? interpreted.followUpOutput.description : 'Follow-up requested via EOJ';
        appendByHeaderMap_(alertSheet, idx, buildAlertRow_(
          claimId, 'Follow-Up Required', 'attention', desc, interpreted
        ));
        result.alerts++;
      }

      if (alertOut.asbestos_attention_needed) {
        appendByHeaderMap_(alertSheet, idx, buildAlertRow_(
          claimId, 'Asbestos Testing Pending', 'attention',
          'Asbestos test flagged via EOJ ' + interpreted.eojId, interpreted
        ));
        result.alerts++;
      }

      if (alertOut.itel_attention_needed) {
        appendByHeaderMap_(alertSheet, idx, buildAlertRow_(
          claimId, 'Itel Sample Required', 'attention',
          'Itel sample needed — flooring removed on visit ' + interpreted.visitDate, interpreted
        ));
        result.alerts++;
      }

      if (alertOut.review_needed) {
        const reasons = Array.isArray(alertOut.review_reasons)
          ? alertOut.review_reasons.join('; ') : 'EOJ requires office review';
        appendByHeaderMap_(alertSheet, idx, buildAlertRow_(
          claimId, 'EOJ Review Required', 'review', reasons, interpreted
        ));
        result.alerts++;
      }
    }
  } catch (e) {
    result.errors.push('Claim_Alerts: ' + (e.message || e));
    Logger.log('ClaimsBridge Alerts error: ' + (e.message || e));
  }

  // ── 4. Update Claims row (Phase B: full snapshot, not just timestamps) ──
  try {
    const claimsSheet = ss.getSheetByName(CLAIMS_SHEETS_.claims);
    if (claimsSheet) {
      updateClaimSnapshot_(claimsSheet, claimId, interpreted);
      result.claimUpdated = true;
    }
  } catch (e) {
    result.errors.push('Claims (snapshot update): ' + (e.message || e));
    Logger.log('ClaimsBridge Claims update error: ' + (e.message || e));
  }

  // ── 5. Service log ──────────────────────────────────────────────────────
  try {
    const logSheet = ss.getSheetByName(CLAIMS_SHEETS_.serviceLog);
    if (logSheet) {
      const idx = claimsHeaderIndex_(logSheet);
      appendByHeaderMap_(logSheet, idx, {
        'Log_ID':          'LOG-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
        'Timestamp':       interpreted.processedAt,
        'Action':          'processEojOutputs',
        'Status':          result.errors.length > 0 ? 'Partial' : 'Success',
        'Claim_ID':        claimId,
        'Source_System':   'eoj-processing-engine',
        'Source_Record_ID': interpreted.eojId,
        'Message':         'EOJ processed. TL:' + result.timelineEvents +
                            ' Cond:' + result.conditions +
                            ' Alerts:' + result.alerts +
                            (result.errors.length > 0 ? ' Errors:' + result.errors.join(' | ') : ''),
        'Raw_JSON':        JSON.stringify({ eojId: interpreted.eojId, runId: interpreted.runId, result })
      });
    }
  } catch (e) {
    Logger.log('ClaimsBridge ServiceLog error (non-fatal): ' + (e.message || e));
  }

  Logger.log('ClaimsBridge: wrote to Claims DB — ' + JSON.stringify(result));
  return result;
}

// ─── Row builders ─────────────────────────────────────────────────────────────

function buildTimelineRow_(claimId, event, interpreted) {
  const summary = [event.event_type || 'EOJ Event'];
  if (interpreted.technician) summary.push('by ' + interpreted.technician);
  if (interpreted.visitDate)  summary.push('on ' + interpreted.visitDate);

  const tleId     = 'TLE-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  const jobNumber = interpreted.jobNumber || interpreted.claimNumber || '';
  const actor     = event.technician || interpreted.technician || '';
  const eventDate = event.visit_date || interpreted.visitDate || '';
  const eventType = event.event_type || 'EOJ Event';

  return {
    // Space-header variants — matching existing Timeline_Events sheet schema
    'Event ID':               tleId,
    'Claim ID':               claimId,
    'Job Number':             jobNumber,
    'Date':                   eventDate,
    'Event Type':             eventType,
    'Source':                 'EOJ',
    'Actor':                  actor,
    'Summary':                summary.join(' '),
    // Underscore variants — for any sheet using underscore headers
    'Timeline_Event_ID':      tleId,
    'Claim_ID':               claimId,
    'Event_Date':             eventDate,
    'Event_Type':             eventType,
    'Event_Source':           'EOJ',
    'Source_Record_ID':       interpreted.eojId,
    'Source_System':          'eoj-processing-engine',
    'Detail':                 JSON.stringify(event.details || {}),
    'Related_Workflow':       'EOJ',
    'Is_Meaningful_Activity': 'TRUE',
    'Created_At':             interpreted.processedAt
  };
}

function buildConditionRow_(claimId, conditionType, conditionKey, interpreted) {
  // Phase A: populate Follow_Up_Date for monitoring conditions so the Health Engine
  // can suppress 'At Risk' status while monitoring is on track.
  var followUpDate = '';
  if (conditionType === 'Monitoring Active' && interpreted.monitoringOutput &&
      interpreted.monitoringOutput.next_monitoring_date) {
    followUpDate = String(interpreted.monitoringOutput.next_monitoring_date);
  }

  return {
    'Condition_ID':    'CON-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    'Claim_ID':        claimId,
    'Condition_Type':  conditionType,
    'Condition_Status':'Open',
    'Opened_At':       interpreted.processedAt,
    'Source_System':   'eoj-processing-engine',
    'Source_Record_ID': interpreted.eojId,
    'Reason':          'Flagged via EOJ (' + conditionKey + ')',
    'Follow_Up_Date':  followUpDate,
    'Owner_Area':      'Field Operations',
    'Created_At':      interpreted.processedAt,
    'Updated_At':      interpreted.processedAt
  };
}

function buildAlertRow_(claimId, alertType, severity, reason, interpreted) {
  return {
    'Alert_ID':           'ALT-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    'Claim_ID':           claimId,
    'Alert_Type':         alertType,
    'Alert_Status':       'Active',
    'Severity':           severity,
    'Source_System':      'eoj-processing-engine',
    'Source_Record_ID':   interpreted.eojId,
    'Reason':             reason,
    'Recommended_Action': 'Review EOJ ' + interpreted.eojId,
    'Owner_Area':         'Field Operations',
    'Created_At':         interpreted.processedAt,
    'Status':             'Active'
  };
}

// ─── Claims row update ────────────────────────────────────────────────────────

/**
 * Phase B: Find the claim row by claimId and write the full EOJ operational
 * snapshot in-place. Writes timestamp fields plus technician, visit type,
 * job status, work summary, insurance summary, and MICA snapshot.
 *
 * New columns (Last_EOJ_Technician etc.) are written only if they exist in the
 * sheet header — appendByHeaderMap_-style silent skip for missing columns.
 * Run runPhase35ClaimsSnapshotMigration() to add the columns before deploying.
 */
function updateClaimSnapshot_(sheet, claimId, interpreted) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0];
  const idx     = {};
  headers.forEach(function (h, i) { if (h) idx[String(h).trim()] = i; });

  var claimIdCol = idx['Claim_ID'] !== undefined ? idx['Claim_ID'] : idx['Claim ID'];
  if (claimIdCol === undefined) return;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][claimIdCol]).trim() !== String(claimId).trim()) continue;

    const rowNum = i + 1;
    const now    = interpreted.processedAt || new Date();

    // Resolve Phase B snapshot values from interpreted object
    var jobStatus = '';
    var workSummary = '';
    var insuranceSummary = '';
    if (interpreted.jobStatusOutput) {
      jobStatus        = String(interpreted.jobStatusOutput.job_status            || '');
      workSummary      = String(interpreted.jobStatusOutput.work_performed         || '');
      insuranceSummary = String(interpreted.jobStatusOutput.for_insurance_summary  || '');
    }

    // Resolve Phase C MICA snapshot values
    var micaStatus = '';
    var micaExpectedDate = '';
    if (interpreted.micaOutput) {
      micaStatus       = String(interpreted.micaOutput.mica_status               || '');
      micaExpectedDate = String(interpreted.micaOutput.mica_expected_update_date  || '');
    }

    // Build field map — includes both underscore and space variants for timestamps.
    // Snapshot fields (Phase B/C) are underscore-only per Claims schema convention.
    var fieldMap = {
      // Timestamps (existing)
      'Last_EOJ_At':                  now,
      'Last EOJ At':                  now,
      'Last_Meaningful_Activity_At':  now,
      'Last Meaningful Activity At':  now,
      'Last_Meaningful_Activity_Date': now,
      'Updated_At':                   now,
      'Updated At':                   now,
      // Phase B: EOJ snapshot
      'Last_EOJ_Technician':          interpreted.technician  || '',
      'Last_EOJ_Visit_Type':          interpreted.visitType   || '',
      'Last_EOJ_Job_Status':          jobStatus,
      'Last_EOJ_Work_Summary':        workSummary.slice(0, 500),
      'Last_EOJ_Insurance_Summary':   insuranceSummary.slice(0, 500),
      // Phase C: MICA snapshot
      'Last_MICA_Status':             micaStatus,
      'Last_MICA_Expected_Update_Date': micaExpectedDate
    };

    Object.keys(fieldMap).forEach(function (col) {
      if (idx[col] !== undefined) {
        sheet.getRange(rowNum, idx[col] + 1).setValue(fieldMap[col]);
      }
    });

    Logger.log('ClaimsBridge: updated Claims snapshot for ' + claimId);
    break;
  }
}

/**
 * Phase A: Update Follow_Up_Date on an existing open condition row.
 * Called when the same condition type is already open (dedup skip) but a new
 * monitoring date was reported — refreshes the Health Engine suppression window.
 */
function updateConditionFollowUpDate_(sheet, claimId, conditionType, newFollowUpDate) {
  if (!newFollowUpDate) return;

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return;

  const headers = data[0];
  const idx     = {};
  headers.forEach(function (h, i) { if (h) idx[String(h).trim()] = i; });

  var claimIdCol    = idx['Claim_ID'];
  var condTypeCol   = idx['Condition_Type'];
  var condStatusCol = idx['Condition_Status'];
  var followUpCol   = idx['Follow_Up_Date'];
  var updatedAtCol  = idx['Updated_At'];

  if (claimIdCol === undefined || condTypeCol === undefined || followUpCol === undefined) return;

  // Scan from bottom up to find the most recent open condition of this type.
  for (var i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    if (String(row[claimIdCol]).trim() !== String(claimId).trim()) continue;
    if (String(row[condTypeCol]).trim() !== conditionType) continue;
    const status = condStatusCol !== undefined ? String(row[condStatusCol] || '') : '';
    if (status !== 'Open' && status !== '') continue;

    sheet.getRange(i + 1, followUpCol + 1).setValue(newFollowUpDate);
    if (updatedAtCol !== undefined) {
      sheet.getRange(i + 1, updatedAtCol + 1).setValue(new Date());
    }
    Logger.log('ClaimsBridge: refreshed Follow_Up_Date for ' + conditionType + ' on ' + claimId + ' → ' + newFollowUpDate);
    return;
  }
}

// ─── Schema migration ─────────────────────────────────────────────────────────

/**
 * Run ONCE from the Apps Script editor before deploying Phase 3.5.
 * Adds the Phase B and C snapshot columns to the Claims sheet if they are
 * not already present. Safe to re-run — skips existing columns.
 *
 * New columns added:
 *   Last_EOJ_Technician          — technician who submitted the last EOJ
 *   Last_EOJ_Visit_Type          — visit type of the last EOJ
 *   Last_EOJ_Job_Status          — job status field from the last EOJ
 *   Last_EOJ_Work_Summary        — work performed narrative (truncated to 500 chars)
 *   Last_EOJ_Insurance_Summary   — for-insurance summary (truncated to 500 chars)
 *   Last_MICA_Status             — MICA/Mitigate status from last EOJ
 *   Last_MICA_Expected_Update_Date — MICA expected update date from last EOJ
 *
 * After running, also add these same column names to CLAIM_FOUNDATION_SHEETS.Claims
 * in claims-service/Config.js so setupClaimFoundationSheets() stays in sync.
 */
function runPhase35ClaimsSnapshotMigration() {
  var ss    = SpreadsheetApp.openById(CLAIMS_DB_ID_);
  var sheet = ss.getSheetByName(CLAIMS_SHEETS_.claims);
  if (!sheet) {
    Logger.log('Migration ERROR: Claims sheet not found in database ' + CLAIMS_DB_ID_);
    return { ok: false, reason: 'Claims sheet not found' };
  }

  var newColumns = [
    'Last_EOJ_Technician',
    'Last_EOJ_Visit_Type',
    'Last_EOJ_Job_Status',
    'Last_EOJ_Work_Summary',
    'Last_EOJ_Insurance_Summary',
    'Last_MICA_Status',
    'Last_MICA_Expected_Update_Date'
  ];

  var existingHeaders = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map(function (h) { return String(h || '').trim(); });

  var added = [];
  newColumns.forEach(function (col) {
    if (existingHeaders.indexOf(col) === -1) {
      var nextCol = sheet.getLastColumn() + 1;
      var headerCell = sheet.getRange(1, nextCol);
      headerCell.setValue(col);
      headerCell.setFontWeight('bold');
      existingHeaders.push(col);   // keep local list in sync for the loop
      added.push(col);
    }
  });

  var skipped = newColumns.filter(function (c) { return added.indexOf(c) === -1; });
  Logger.log('Phase 3.5 migration complete. Added: [' + added.join(', ') + ']  Skipped (already present): [' + skipped.join(', ') + ']');
  return { ok: true, added: added, skipped: skipped };
}

// ─── Deduplication helper ─────────────────────────────────────────────────────

/**
 * Return a Set of condition types that are currently Open for the given claimId.
 * Used to prevent writing duplicate Open conditions.
 */
function getOpenConditionTypes_(sheet, claimId) {
  const result = new Set();
  const data   = sheet.getDataRange().getValues();
  if (data.length < 2) return result;

  const headers = data[0];
  const idx     = {};
  headers.forEach(function (h, i) { if (h) idx[String(h).trim()] = i; });

  var claimIdCol    = idx['Claim_ID'];
  var condTypeCol   = idx['Condition_Type'];
  var condStatusCol = idx['Condition_Status'];

  if (claimIdCol === undefined || condTypeCol === undefined) return result;

  for (var i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[claimIdCol]).trim() !== String(claimId).trim()) continue;
    const status = condStatusCol !== undefined ? String(row[condStatusCol] || '') : '';
    if (status === 'Open' || status === '') {
      result.add(String(row[condTypeCol] || '').trim());
    }
  }

  return result;
}

// ─── Shared sheet helpers ─────────────────────────────────────────────────────

// ─── Diagnostic / test ───────────────────────────────────────────────────────

/**
 * Run from Apps Script editor to test ClaimsBridge against a real claimId.
 * Builds a synthetic interpreted object and calls writeEojToClaimsDatabase_.
 * Check View → Logs after running.
 *
 * Set TEST_CLAIM_ID_ at the top of testClaimsBridge() below before running.
 */
function testClaimsBridge() {
  // ↓ Set this to a real Claim_ID from your Claims sheet before running.
  var TEST_CLAIM_ID_ = 'CLM-26N-0135-WTR';

  if (!TEST_CLAIM_ID_) {
    Logger.log('ERROR: Set TEST_CLAIM_ID_ at the top of testClaimsBridge() before running.');
    return;
  }

  const now = new Date();
  const fakeInterpreted = {
    outputId:        'DIAG-' + Utilities.getUuid().slice(0, 8),
    eojId:           'EOJ-DIAG-TEST',
    runId:           'RUN-DIAG',
    processedAt:     now,
    claimId:         TEST_CLAIM_ID_,
    claimNumber:     'DIAG-001',
    technician:      'Tyler',
    jobName:         'Bridge Test Job',
    customerName:    'Diagnostic Customer',
    propertyAddress: '123 Test Lane',
    visitDate:       '2026-06-29',
    visitType:       'Inspection',

    // Phase F: first event must be EOJ Submitted
    timelineEvent: {
      event_count: 2,
      primary_event_type: 'EOJ Submitted',
      events: [
        {
          event_type: 'EOJ Submitted',
          source: 'EOJ_Log',
          eoj_id: 'EOJ-DIAG-TEST',
          technician: 'Tyler',
          job_name: 'Bridge Test Job',
          claim_number: 'DIAG-001',
          claim_id: TEST_CLAIM_ID_,
          visit_date: '2026-06-29',
          visit_type: 'Inspection',
          created_at: now.toISOString(),
          details: { visit_type: 'Inspection', job_status: 'In Progress', work_performed: 'Dried out basement — diagnostic test' }
        },
        {
          event_type: 'Inspection Completed',
          source: 'EOJ_Log',
          eoj_id: 'EOJ-DIAG-TEST',
          technician: 'Tyler',
          job_name: 'Bridge Test Job',
          claim_number: 'DIAG-001',
          claim_id: TEST_CLAIM_ID_,
          visit_date: '2026-06-29',
          visit_type: 'Inspection',
          created_at: now.toISOString(),
          details: { work_performed: 'Dried out basement — diagnostic test', field_work_complete: false }
        }
      ]
    },

    // Phase A: monitoring active with a next monitoring date → Follow_Up_Date should be written
    conditionOutput: {
      monitoring_active:        true,
      next_monitoring_required: true,
      asbestos_testing_pending: false,
      waiting_on_lab_results:   false,
      field_work_complete:      false,
      equipment_still_needed:   false
    },

    // Phase A: monitoringOutput must be present for Follow_Up_Date to flow into condition row
    monitoringOutput: {
      monitoring_active:        true,
      next_monitoring_required: true,
      next_monitoring_date:     '2026-07-15',
      next_monitoring_window:   '7-10 days',
      monitoring_status:        'Active',
      monitoring_notes:         'Check moisture readings at next visit'
    },

    alertOutput: {
      review_needed:             false,
      follow_up_required:        false,
      asbestos_attention_needed: false,
      itel_attention_needed:     false,
      review_reasons:            []
    },

    followUpOutput: { follow_up_required: false },
    equipmentOutput: { has_equipment_activity: false },

    // Phase B: snapshot fields
    jobStatusOutput: {
      job_status:            'In Progress',
      work_performed:        'Dried out basement — diagnostic test write',
      for_insurance_summary: 'Category 2 water loss, equipment placed'
    },

    // Phase C: MICA activity
    micaOutput: {
      mica_status:               'On Track',
      mica_delay_reason:         '',
      mica_expected_update_date: '2026-07-20',
      mitigation_plan_updated:   false,
      mitigation_plan_summary:   '',
      has_mica_activity:         true
    },

    rawParsed: {}
  };

  Logger.log('testClaimsBridge: using claimId=' + TEST_CLAIM_ID_);
  const result = writeEojToClaimsDatabase_(fakeInterpreted);
  Logger.log('testClaimsBridge result: ' + JSON.stringify(result, null, 2));
  return result;
}

function claimsHeaderIndex_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = {};
  headers.forEach(function (h, i) {
    if (h && String(h).trim()) idx[String(h).trim()] = i;
  });
  return idx;
}

function appendByHeaderMap_(sheet, idx, valueMap) {
  const totalCols = Math.max(sheet.getLastColumn(), 1);
  const rowData   = new Array(totalCols).fill('');
  Object.keys(valueMap).forEach(function (col) {
    var colIndex = idx[col];
    if (colIndex !== undefined) rowData[colIndex] = valueMap[col];
  });
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, rowData.length).setValues([rowData]);
}
