# Rainbow EOJ Sprint — Handoff Document

**Generated:** 2026-06-29  
**Sprint:** EOJ-1 through EOJ-6 (Completion Sprint)  
**Status:** In testing — T4 blocked, fixes queued, T5–T10 not yet run

---

## What This Sprint Does

Completes the EOJ (End of Job) technician reporting system. Technicians fill out `eoj-app` (a GAS web form) after each job visit. The data flows:

```
eoj-app → EOJ_Log sheet → eoj-processing-engine → Claims Database
```

**Root cause bug fixed in this sprint:** `Malformed Raw_JSON: Unexpected token 'N', "New" is not valid JSON`  
The old `SheetService.js` used positional `appendRow()`. Column order drifted after `repairEOJLogColumns()` added columns after `Raw_JSON`. The processing engine read `'New'` (from `Processing_Status`) instead of the JSON object. Fixed by rewriting `SheetService.js` to use header-based column mapping.

---

## Architecture

### Projects and Spreadsheets

| GAS Project | Purpose | Web App? |
|-------------|---------|---------|
| `eoj-app` | Technician-facing EOJ form | Yes — technicians submit here |
| `eoj-processing-engine` | Parses EOJ_Log, writes to Claims DB | No — time trigger every 15 min |
| `automation-dashboard` | Rainbow admin UI | Yes — staff |

| Spreadsheet | Purpose | ID |
|-------------|---------|-----|
| EOJ Database | EOJ_Log sheet | `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs` |
| Claims Database | Claims, Timeline_Events, etc. | `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c` |

### Canonical Architecture Rules (DO NOT VIOLATE)
- **Monitoring/Asbestos are operational CONDITIONS, not lifecycle states**
- **Inspection-only claims = Active Work** (NOT Not Sold)
- **Not Sold only applies before any operational work begins**
- **EOJ must feed the existing Rainbow architecture** — do not redesign lifecycle, Claims Workspace, Homepage, or Operational Health
- **Apps Script native, modular, header-based column mapping** (never hardcoded column indexes)

---

## Files Changed This Sprint

### `eoj-app` project

| File | Status | What changed |
|------|--------|-------------|
| `Config.js` | Deployed ✓ | Added `Mitigation` to VISIT_TYPES; expanded STATUS constants |
| `SheetService.js` | **Rewritten** — Deployed ✓ | `appendEOJRecord()` now uses `getEOJLogHeaderIndex_()` + `appendRowByHeaders_()`. Root cause fix. |
| `Code.js` | Deployed ✓ | `setupEOJLogSheet()` full 39-column spec; `repairEOJLogColumns()`; `getRecentEOJsForJob()`; `diagnosticWriteEOJRow()` |
| `Client.html` | Deployed ✓ | Mitigation visit section; X1 Sketch (Inspection); Monitoring section; jobStatus field; confirmation screen; error screen; Lookup tab |
| `Index.html` | Deployed ✓ | Job Status select; confirmation/error screens; functional Lookup tab |
| `Styles.html` | Deployed ✓ | Confirmation card, error card, history card styles |

### `eoj-processing-engine` project

| File | Status | What changed |
|------|--------|-------------|
| `Code.js` | Deployed ✓ | Calls `writeEojToClaimsDatabase_()` (non-fatal) after each successful interpretation |
| `ClaimsBridge.js` | **New** — Deployed ✓ | Full Claims DB bridge — Timeline_Events, Claim_Conditions (deduplicated), Claim_Alerts, Claims timestamps, Claim_Service_Log |

### `automation-dashboard` project

| File | Status | What changed |
|------|--------|-------------|
| `Code.js` | Deployed ✓ | `?view=eojAdmin` route + `renderEojAdminShell_()` |
| `EojAdminService.js` | **New** — Deployed ✓ | `getEojAdminData()`, `retryEojRow()`, `getEojRowDetail()` |
| `EojAdminShell.html` | **New** — Deployed ✓ | Stats bar, filterable table, status badges, retry, detail panel, claim deep-links |

---

## EOJ_Log Sheet (EOJ Database)

**40 columns total** after `repairEOJLogColumns()` ran. Verified correct by `diagnosticWriteEOJRow()`.

Key columns confirmed in correct positions:
- Col 24 (0-indexed): `Processing_Status`
- Col 25 (0-indexed): `Raw_JSON`
- Col AF: `Job_Status`
- Col AI: `X1_Sketch_Provided`

> ⚠️ The launch checklist erroneously listed these as AG and AJ — the **code is correct**, only the checklist documentation was wrong.

---

## Test Results So Far

| Test | Status | Notes |
|------|--------|-------|
| T1 — Column schema verification | ✅ Pass | `repairEOJLogColumns()` ran; 0 new columns needed (all present) |
| T2 — Submission write (header-based) | ✅ Pass | `diagnosticWriteEOJRow()` confirmed Raw_JSON has JSON object, Processing_Status has 'New' |
| T3 — End-to-end Inspection submit | ✅ Pass | Confirmation screen worked; Lookup tab populated; new columns (Job_Status, X1_Sketch) populated correctly |
| T4 — Monitoring visit | ❌ BLOCKED | Submission hangs at "Saving..." — see diagnosis below |
| T5 — Mitigation visit | Not run | |
| T6 — Asbestos flow | Not run | |
| T7 — Processing engine parse + interpret | Not run | |
| T8 — Claims Database bridge write | Not run | |
| T9 — Error retry via admin UI | Not run | |
| T10 — Error validation (client-side) | Not run | |

---

## Active Bug: T4 Monitoring Submission Hangs at "Saving..."

### Symptoms
- Julia selected Monitoring visit type
- Filled in Monitoring Status ("Needs another visit")
- Checked "Schedule next monitoring visit"
- Populated Next Monitoring Date
- Submitted — button disabled, shows "Saving..." indefinitely
- No confirmation screen, no error screen, no timeout

### What "Saving..." means
`submitForm()` in `Client.html` disables the submit button and sets it to "Saving..." AFTER client-side validation passes, and THEN fires `google.script.run.submitEOJ(payload)`. If it's stuck at "Saving...", client validation passed but neither `withSuccessHandler` nor `withFailureHandler` fired.

### Likely causes (in priority order)

**1. Missing `nextMonitoringWindow` field value (most likely)**  
Validation in `validateClientPayload()`:
```javascript
if (payload.nextMonitoringNeeded) {
  if (!payload.nextMonitoringDate) return 'Next monitoring date is required...';
  if (!payload.nextMonitoringWindow) return 'Preferred monitoring window is required...';
}
```
If `nextMonitoringWindow` is missing from the payload (the select element has no value), validation returns an error string. BUT if the `setStatus()` error display has a bug, the error might not visually appear, and then... actually this wouldn't cause "Saving..." because `submitForm()` returns early on validation failure. Scratch this as a cause of "Saving...".

**2. Server-side silent hang**  
`submitEOJ()` on the server calls `appendEOJRecord()` → `getEOJLogHeaderIndex_()` → `sheet.getRange().getValues()`. If the sheet is locked by another process, this blocks indefinitely. GAS time trigger runs every 15 min — if it's currently mid-run and has a write lock, the EOJ submit could hang.

**3. `withFailureHandler` not properly registered**  
Less likely given T3 worked, but if there's a JS error in the Monitoring-specific rendering that corrupts the script state...

**4. Stale cached page**  
Most common cause after a redeploy. The old `Client.html` runs against the new `Code.js`.

### Diagnosis steps for next session

**Step 1: Hard refresh**  
`Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) to force reload. Try Monitoring submit again.

**Step 2: Open browser DevTools console**  
Right-click → Inspect → Console. Submit a Monitoring visit and paste any errors here.

**Step 3: Check the server directly**  
In the `eoj-app` Apps Script editor, run this function:
```javascript
function debugMonitoringSubmit() {
  var testPayload = {
    technician: 'Test Tech',
    jobName: 'Test Job',
    claimId: '',
    visitDate: '2026-06-29',
    visitType: 'Monitoring',
    workPerformed: 'Monitoring check performed.',
    jobStatus: 'Active',
    monitoringStatus: 'Needs another visit',
    nextMonitoringNeeded: true,
    nextMonitoringDate: '2026-07-06',
    nextMonitoringWindow: 'Morning',
    monitoringReadings: '',
    waitingOn: '',
    followUpNeeded: false,
    followUpNote: '',
    x1SketchProvided: false,
    asbestosTestNeeded: '',
    asbestosSamplesTaken: '',
    asbestosSampleCount: 0,
    asbestosHandler: '',
    mitigationStarted: false,
    dryingSetupComplete: false,
    mitigationPlanSummary: ''
  };
  
  var result = submitEOJ(testPayload);
  Logger.log(JSON.stringify(result));
}
```
Run it and check the logs. If it hangs or errors, that's the server-side bug.

**Step 4: Check if `nextMonitoringWindow` select is visible/populated**  
In the rendered Monitoring section, there should be a "Preferred window" dropdown (Morning / Afternoon / Either). If it's missing from the DOM, the field won't be in the payload and validation will fail silently.

---

## Issues Tally — Fixes Queued (Deploy After Testing Completes)

| # | Issue | Severity | Fix status |
|---|-------|----------|-----------|
| 1 | Lookup tab: no job/customer name on history cards | Medium | **Fix written, not deployed** |
| 2 | Launch checklist: column letter references off by one | Low | Documentation only — no code change needed |
| 3 | Monitoring section: remove "Moisture Readings" textarea, replace with "Mitigation plan updated this visit" checkbox | Medium | **Not written yet** |
| 4 | Next monitoring date → Todoist task | Low | Post-sprint, out of scope |
| 5 | T4 Monitoring submission hangs at "Saving..." | High | **Undiagnosed — investigate first** |

---

## Queued Fix #1: Lookup Tab Cards Missing Job Name

### Files to change

**`eoj-app/Code.js`** — `getRecentEOJsForJob()` — add `jobName` and `customerName` to the return object:
```javascript
matchingRows.push({
  eojId:            String(row[idx['EOJ_ID']]          || ''),
  submittedAt:      String(row[idx['Submitted_At']]     || ''),
  technician:       String(row[idx['Technician']]       || ''),
  jobName:          String(row[idx['Job_Name']]         || ''),       // ADD THIS
  customerName:     String(row[idx['Customer_Name']]    || ''),       // ADD THIS
  visitDate:        String(row[idx['Visit_Date']]       || ''),
  visitType:        String(row[idx['Visit_Type']]       || ''),
  jobStatus:        String(row[idx['Job_Status']]       || ''),
  workPerformed:    String(row[idx['Work_Performed']]   || ''),
  processingStatus: status
});
```

**`eoj-app/Client.html`** — card rendering function — change the card title from `r.visitType` to `r.customerName || r.jobName`:
```javascript
const displayName = r.customerName || r.jobName || '—';
return '<div class="history-card">' +
  '<strong>' + escapeHtml(displayName) + '</strong>' +
  '<span class="meta">' + escapeHtml(r.visitType || '—') + ' · ' + escapeHtml(r.visitDate || '') + ' · ' + escapeHtml(r.technician || '') + '</span>' +
  (r.jobStatus ? '<span class="meta">' + escapeHtml(r.jobStatus) + '</span>' : '') +
  '<p class="helper">' + escapeHtml((r.workPerformed || '').slice(0, 140)) + '</p>' +
  '<span class="chip">' + escapeHtml(r.eojId || '') + '</span>' +
'</div>';
```

---

## Queued Fix #3: Replace Moisture Readings with "Mitigation Plan Updated" Checkbox

In **`eoj-app/Client.html`**, in the `renderVisitSpecificSection()` Monitoring case, remove:
```javascript
'<label class="field"><span>Moisture Readings</span><textarea id="monitoringReadings" placeholder="Room-by-room readings..."></textarea></label>' +
```

Replace with:
```javascript
'<label class="field inline-check"><input type="checkbox" id="mitigationPlanUpdated"> <span>Mitigation plan updated this visit</span></label>' +
```

Also update `submitForm()` in the payload:
```javascript
// Remove:
monitoringReadings: valueOf('monitoringReadings'),
// Add:
mitigationPlanUpdated: document.getElementById('mitigationPlanUpdated') ? document.getElementById('mitigationPlanUpdated').checked : false,
```

And add `Mitigation_Plan_Updated` to the EOJ_Log column spec in `Code.js` (`EOJ_LOG_COLUMNS_`) and run `repairEOJLogColumns()` again after deploying.

Also update `SheetService.js` `appendEOJRecord()`:
```javascript
// Remove:
'Monitoring_Readings': payload.monitoringReadings || '',
// Add:
'Mitigation_Plan_Updated': payload.mitigationPlanUpdated ? 'true' : '',
```

---

## Remaining Test Scripts

### T5 — Mitigation visit
1. Select Mitigation visit type
2. Check "Mitigation work started today"
3. Fill Work Performed
4. Submit
5. Expected: Confirmation screen; EOJ_Log row has Visit_Type = 'Mitigation'

### T6 — Asbestos flow
1. Inspection visit
2. Set asbestos test needed = Yes, handler = "We are handling it"
3. Samples taken = Yes, stepper to 2 samples
4. Expected: EOJ_Log has Asbestos_Test_Needed = 'Yes', Asbestos_Samples_Taken = 'Yes', Asbestos_Sample_Count = '2'

### T7 — Processing engine
1. Ensure at least one EOJ_Log row with Processing_Status = 'New' and valid Raw_JSON
2. In `eoj-processing-engine` editor, run `testProcessUnprocessedEOJs()`
3. Expected: `processedCount: 1+`, `errorCount: 0`. Row now has Processing_Status = 'Processed'

### T8 — Claims Database bridge
1. T7 must complete first
2. Check Claims Database:
   - `Timeline_Events` — new rows with correct Claim_ID
   - `Claim_Service_Log` — new audit row
   - `Claims` — `Last_EOJ_At` updated

### T9 — Error retry via admin UI
1. Find a row in EOJ_Log with Processing_Status = 'Error'
2. Open `{dashboard-url}?view=eojAdmin`
3. Find the error row, click Retry, confirm
4. Expected: Toast confirms reset; row shows 'New'

### T10 — Client-side validation
1. Select Monitoring visit type
2. Leave Monitoring Status blank
3. Try to submit
4. Expected: Blocked with message "Monitoring status is required for monitoring visits." No confirmation screen.

---

## Key Functions for Reference

### `eoj-app` server functions
- `setupEOJLogSheet()` — creates EOJ_Log with full 40-column spec (run on fresh setup)
- `repairEOJLogColumns()` — adds missing columns to live sheet (safe to run anytime)
- `diagnosticWriteEOJRow()` — writes a test row via the header-based path (verify column mapping)
- `getRecentEOJsForJob(claimIdOrJobName)` — returns last 10 EOJs for Lookup tab
- `submitEOJ(payload)` — main form submission endpoint

### `eoj-processing-engine` server functions
- `processUnprocessedEOJs()` — production processing trigger
- `testProcessUnprocessedEOJs()` — same but verbose logging
- `testClaimsBridge()` — test ClaimsBridge in isolation (set `TEST_CLAIM_ID_` first)

### `automation-dashboard` server functions
- `getEojAdminData()` — last 50 EOJ_Log rows
- `retryEojRow(rowNumber)` — reset Error → New
- `getEojRowDetail(rowNumber)` — Raw_JSON + parsed payload

---

## What the Next Session Should Do First

1. **Diagnose T4 hang** — run `debugMonitoringSubmit()` in the eoj-app editor (code above). If it succeeds server-side, the bug is client-side (likely missing field in rendered Monitoring section or stale cache).

2. **Deploy queued fixes** once T4 is resolved:
   - Fix #1: Lookup tab cards (Code.js + Client.html)
   - Fix #3: Replace moisture readings with mitigation plan checkbox (Client.html + SheetService.js + Code.js, then run `repairEOJLogColumns()`)

3. **Continue testing T5 → T10** in order.

4. **After T7+T8 pass**, confirm in the Claims Database that Timeline_Events, Claim_Service_Log, and Claims timestamps are all being written for a real claim.
