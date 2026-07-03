# Rainbow EOJ Completion Sprint — Launch Checklist

**Generated:** 2026-06-29  
**Sprint:** EOJ-1 through EOJ-6  
**Status:** Ready for deployment and testing

---

## Files Changed

### `eoj-app` project

| File | Change |
|------|--------|
| `Config.js` | Added `Mitigation` to VISIT_TYPES; expanded STATUS constants (Processed, Error, Skipped) |
| `SheetService.js` | **Rewritten** — `appendEOJRecord()` now uses `getEOJLogHeaderIndex_()` + `appendRowByHeaders_()` (header-based column mapping). Root cause of "New is not valid JSON" bug is fixed. |
| `Code.js` | `setupEOJLogSheet()` expanded to full 39-column spec including all processing columns. Added `repairEOJLogColumns()` (live sheet migration). Added `getRecentEOJsForJob()`. Updated `diagnosticWriteEOJRow()` to use the header-based path. |
| `Client.html` | Added Mitigation visit section, X1 Sketch field for Inspection, moisture readings field for Monitoring, `jobStatus` field in payload, proper confirmation screen, error screen with retry, working Lookup tab via `getRecentEOJsForJob()`. |
| `Index.html` | Added Job Status select in Visit Summary, confirmation screen, error screen, functional Lookup tab replacing placeholder. |
| `Styles.html` | Added confirmation card, error card, lookup history card styles. |

### `eoj-processing-engine` project

| File | Change |
|------|--------|
| `Code.js` | `processUnprocessedEOJs()` now calls `writeEojToClaimsDatabase_(interpreted)` (non-fatal) after each successful interpretation. |
| `ClaimsBridge.js` | **New file** — `writeEojToClaimsDatabase_()` writes EOJ outputs to Timeline_Events, Claim_Conditions (with dedup), Claim_Alerts, Claims timestamps, and Claim_Service_Log. Includes `testClaimsBridge()` diagnostic. |

### `automation-dashboard` project

| File | Change |
|------|--------|
| `Code.js` | Added `?view=eojAdmin` route and `renderEojAdminShell_()` function. |
| `EojAdminService.js` | **New file** — `getEojAdminData()`, `retryEojRow()`, `getEojRowDetail()` server functions for the admin view. |
| `EojAdminShell.html` | **New file** — Full admin UI: stats, filterable table, retry, detail panel, claim deep-links. |

---

## Sheets / Columns Added or Modified

### EOJ Database (`10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs`)

**EOJ_Log sheet** — new columns added by `repairEOJLogColumns()`:

| Column | Purpose |
|--------|---------|
| `Source` | 'eoj-app' for all new submissions |
| `Job_Status` | Technician's status assessment after the visit |
| `Waiting_On` | Who the job is waiting on |
| `Office_Follow_Up_Needed` | Boolean flag |
| `X1_Sketch_Provided` | Boolean — Inspection visits only |
| `Asbestos_Test_Needed` | Structured asbestos flag |
| `Asbestos_Samples_Taken` | Whether samples were collected |
| `Asbestos_Sample_Count` | Number of samples |
| `Monitoring_Status` | Status after monitoring visit |
| `Next_Monitoring_Date` | Scheduled next monitoring |
| `Processed_At` | Set by processing engine |
| `Processing_Run_ID` | UUID of the processing run |
| `Processing_Error` | Error message if status = Error |
| `Processing_Output_ID` | ID written to EOJ_Processing_Output |

### Claims Database (`1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`)

No schema changes — `ClaimsBridge.js` writes to existing sheets using their current headers:
- `Timeline_Events` — new rows appended per EOJ event
- `Claim_Conditions` — new rows for Monitoring Active, Asbestos Testing Pending (deduplicated)
- `Claim_Alerts` — new rows for Follow-Up Required, Asbestos, Itel, Review flags
- `Claim_Service_Log` — one audit row per processed EOJ
- `Claims` — `Last_EOJ_At`, `Last_Meaningful_Activity_At`, `Updated_At` updated in-place

---

## Functions Added

### `eoj-app/Code.js`
- `repairEOJLogColumns()` — adds missing columns to live EOJ_Log (run once after deploy)
- `getRecentEOJsForJob(claimIdOrJobName)` — returns last 10 EOJs for a job (used by Lookup tab)

### `eoj-app/SheetService.js`
- `getEOJLogHeaderIndex_(sheet)` — builds header→colIndex map
- `appendRowByHeaders_(sheet, idx, valueMap)` — header-based row append

### `eoj-processing-engine/ClaimsBridge.js`
- `writeEojToClaimsDatabase_(interpreted)` — main bridge entry point
- `testClaimsBridge()` — diagnostic (set TEST_CLAIM_ID_ first)
- `buildTimelineRow_()`, `buildConditionRow_()`, `buildAlertRow_()` — row builders
- `updateClaimTimestamps_()` — in-place Claims row update
- `getOpenConditionTypes_()` — condition deduplication helper

### `automation-dashboard/EojAdminService.js`
- `getEojAdminData()` — returns last 50 EOJ_Log rows for admin view
- `retryEojRow(rowNumber)` — resets Error row back to New
- `getEojRowDetail(rowNumber)` — returns full payload JSON for a row

### `automation-dashboard/Code.js`
- `renderEojAdminShell_()` — renders the EOJ Admin view

---

## Deployment Steps (in order)

### Step 1 — Deploy `eoj-app`

1. Open the `eoj-app` Apps Script project
2. Push all changed files (Config.js, SheetService.js, Code.js, Client.html, Index.html, Styles.html)
3. Deploy → Manage Deployments → Create new deployment (or update existing)
4. **Run `repairEOJLogColumns()`** from the editor — this adds missing columns to the live EOJ_Log without touching existing data
5. **Run `diagnosticWriteEOJRow()`** — verify column mapping. Check that Raw_JSON column has a JSON object (not 'New')

### Step 2 — Deploy `eoj-processing-engine`

1. Open the `eoj-processing-engine` Apps Script project
2. Push all changed files (Code.js) and new file (ClaimsBridge.js)
3. No new deployment needed — processing runs on the existing time-based trigger
4. Set `TEST_CLAIM_ID_` in ClaimsBridge.js to a real Claim_ID from your Claims sheet
5. **Run `testClaimsBridge()`** — verify it writes to Timeline_Events, Claim_Service_Log, and updates Claims timestamps without error
6. **Run `dryRunLegacyCleanup()`** (optional) — review any old schema rows before running `applyLegacyCleanup()` to mark them Skipped
7. **Run `testProcessUnprocessedEOJs()`** — confirm the full pipeline including the ClaimsBridge call

### Step 3 — Deploy `automation-dashboard`

1. Open the `automation-dashboard` Apps Script project
2. Push all changed files (Code.js) and new files (EojAdminService.js, EojAdminShell.html)
3. Deploy → Manage Deployments → update existing deployment
4. Navigate to `?view=eojAdmin` on the dashboard URL
5. Confirm the submissions table loads, stats appear, and Detail works on a real row

---

## Test Order (10 Tests)

### T1 — Column schema verification
**Setup:** Live EOJ_Log sheet  
**Run:** `repairEOJLogColumns()` in eoj-app editor  
**Expected:** Log shows 0 columns added (all present) or lists which ones were added. No errors.

### T2 — Submission write (header-based)
**Setup:** EOJ app open in browser  
**Run:** `diagnosticWriteEOJRow()` in eoj-app editor  
**Expected:** `columnMap` in response shows Raw_JSON at a column index > 0. The written row in EOJ_Log has a `{...}` JSON object in the Raw_JSON column, not 'New'. Processing_Status column shows 'New'.

### T3 — End-to-end submission via UI
**Setup:** EOJ app web app URL  
**Steps:** Select technician, pick a job from the list, choose Inspection, fill Work Performed, check X1 Sketch Provided, submit  
**Expected:** Confirmation screen shows EOJ_ID and visit details. The Lookup tab shows the new row. EOJ_Log has a new row with correct column values.

### T4 — Monitoring visit with readings
**Setup:** EOJ app  
**Steps:** Select Monitoring visit type, enter Monitoring Status, enter moisture readings, check "Schedule next monitoring visit", enter date  
**Expected:** Submission succeeds. EOJ_Log row has Monitoring_Status, Next_Monitoring_Date populated. Validation blocks submission if Next Monitoring Date missing.

### T5 — Mitigation visit type
**Setup:** EOJ app  
**Steps:** Select Mitigation, check "Mitigation work started today", fill Work Performed, submit  
**Expected:** Submission succeeds. EOJ_Log Visit_Type = 'Mitigation'.

### T6 — Asbestos flow (Inspection with test needed)
**Setup:** EOJ app  
**Steps:** Inspection visit, set asbestos test needed = Yes, handler = "We are handling it", samples taken = Yes, stepper to 2 samples  
**Expected:** Submission succeeds. EOJ_Log Asbestos_Test_Needed = 'Yes', Asbestos_Samples_Taken = 'Yes', Asbestos_Sample_Count = '2'.

### T7 — Processing engine: parse + interpret
**Setup:** EOJ_Log has at least one row with Processing_Status = New and valid Raw_JSON  
**Run:** `testProcessUnprocessedEOJs()` in eoj-processing-engine editor  
**Expected:** Response shows `processedCount: 1+`, `errorCount: 0`. Row in EOJ_Log now has Processing_Status = 'Processed'.

### T8 — Claims Database bridge write
**Setup:** T7 completed; use a claimId that exists in Claims sheet  
**Check:** Claims Database Timeline_Events sheet — new rows with the correct Claim_ID and event types  
**Check:** Claim_Service_Log — new audit row  
**Check:** Claims sheet — Last_EOJ_At updated  
**Expected:** All three sheets have new data with correct Claim_ID.

### T9 — Error retry via admin UI
**Setup:** A row in EOJ_Log with Processing_Status = Error  
**Steps:** Open `?view=eojAdmin`, find the error row, click Retry, confirm  
**Expected:** Toast confirms reset. Table refreshes. Row now shows Processing_Status = New. Processing engine will pick it up on next run.

### T10 — Error validation (client-side)
**Setup:** EOJ app  
**Steps:** Submit with Monitoring visit type but no Monitoring Status selected  
**Expected:** Submit is blocked with message "Monitoring status is required for monitoring visits." Confirmation screen is NOT shown.

---

## Expected Output After Successful T7+T8

For each processed EOJ:

| Sheet | New Rows |
|-------|----------|
| `Timeline_Events` | 1–5 rows (depends on visit type and flags) |
| `Claim_Conditions` | 0–2 rows (Monitoring Active, Asbestos Testing Pending — deduplicated) |
| `Claim_Alerts` | 0–4 rows (follow-up, asbestos, itel, review) |
| `Claim_Service_Log` | 1 row |
| `Claims` | 0 new rows; Last_EOJ_At + Last_Meaningful_Activity_At updated in-place |
| `EOJ_Log` | Processing_Status = Processed, Processed_At set, Processing_Run_ID set |
| `EOJ_Processing_Output` | 1 row (existing behavior, unchanged) |

---

## Known Limitations

1. **Condition closing** — `ClaimsBridge.js` opens conditions (Monitoring Active, Asbestos Testing Pending) but does not close them. Closing conditions when field work is complete requires a separate reconciliation function. Deduplication prevents duplicate opens.

2. **Health recalculation** — `Claim_Health_History` is not written by the EOJ pipeline. Health recalculation (`HealthEngineService.js`) is not called. This is a post-EOJ-launch step.

3. **Ownership transfers** — EOJInterpreter builds `operationalObjects` including potential ownership transfers, but `ClaimsBridge.js` does not write to `Claim_Ownership_History`. This is intentional: ownership changes should be deliberate, not automatic from an EOJ.

4. **Processing trigger** — The engine runs every 15 minutes via Apps Script time trigger. There is no on-demand trigger from the admin UI (would require a public-facing doGet on the processing engine project).

5. **Claim matching by claimId** — `ClaimsBridge.js` matches claims by Claim_ID. If a technician submits an EOJ for a job without a claimId (manual entry), the bridge skips all Claims Database writes (logs `skipped: true`). The EOJ_Log row is still marked Processed and the EOJ_Processing_Output row is still written.

6. **Lookup tab** — Shows the last 10 EOJs for the selected job. Only works when a job is selected from the list (not manual entry). Requires `claimId` or `jobName` to match.

7. **Mitigation visit type** — `normalizeVisitEventType_()` in EOJInterpreter returns 'Mitigation Completed' for the timeline event (via catch-all). This is correct but there is no Mitigation-specific condition logic yet in `buildConditionOutput_()`.

8. **X1 Sketch** — Captured in EOJ_Log and Raw_JSON. Not yet surfaced in Claim_Timeline or as a condition/alert. Add to EOJInterpreter's `buildTimelineEvents_()` as a future step.

---

## EOJ Admin URL

`{dashboard-web-app-url}?view=eojAdmin`

Replace `{dashboard-web-app-url}` with the automation-dashboard deployment URL.
