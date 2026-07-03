# Rainbow Phase 3.5 — EOJ Integration Hardening
*Completed 2026-06-30*

## What was done

Six phases of EOJ integration hardening implemented across the EOJ Processing Engine and claims-service. All changes preserve existing architecture, deployment flow, and backward compatibility with existing EOJs.

---

## Phase A — Health & Condition Completion

**Problem:** Monitoring claims stayed "At Risk" indefinitely because `buildConditionRow_()` never populated `Follow_Up_Date` on the `Monitoring Active` condition. The Health Engine reads this field to suppress At Risk status while monitoring is on schedule.

**Files changed:**
- `eoj-processing-engine/ClaimsBridge.js`

**Changes:**
1. `CONDITION_TYPE_MAP_` expanded from 2 to 4 entries:
   - `waiting_on_lab_results` → `'Waiting on Lab Results'` (triggers when `asbestos_samples_taken = true`)
   - `field_work_complete` → `'Field Work Complete'` (data signal for lifecycle use; no immediate health impact)

2. `buildConditionRow_()` now writes `Follow_Up_Date` = `monitoringOutput.next_monitoring_date` when the condition type is `Monitoring Active`.

3. New helper `updateConditionFollowUpDate_()`: when a `Monitoring Active` condition already exists and is deduplicated (skipped), this updates its `Follow_Up_Date` with the new monitoring date from the EOJ. Health Engine suppression is refreshed on every subsequent monitoring visit.

4. `buildConditionOutput_()` (in `EOJInterpreter.js`) now includes `waiting_on_lab_results: asbestosOutput.samples_taken`.

---

## Phase B — Claim Snapshot Enrichment

**Problem:** Claims sheet had no per-claim operational snapshot from EOJ data. Office staff couldn't see the last technician, visit type, job status, or work summary without drilling into EOJ detail.

**Schema change required — run migration before deploying.**

**Files changed:**
- `eoj-processing-engine/ClaimsBridge.js`
- `claims-service/Config.js`

**New columns added to Claims sheet** (added by `runPhase35ClaimsSnapshotMigration()`):

| Column | Content |
|---|---|
| `Last_EOJ_Technician` | Technician name from last EOJ |
| `Last_EOJ_Visit_Type` | Visit type (Inspection, Monitoring, etc.) |
| `Last_EOJ_Job_Status` | Job status field value from EOJ form |
| `Last_EOJ_Work_Summary` | Work performed narrative (truncated 500 chars) |
| `Last_EOJ_Insurance_Summary` | Insurance summary narrative (truncated 500 chars) |
| `Last_MICA_Status` | MICA/Mitigate status (see Phase C) |
| `Last_MICA_Expected_Update_Date` | MICA expected update date (see Phase C) |

**Changes:**
- `updateClaimTimestamps_()` replaced by `updateClaimSnapshot_()` — writes all 7 new fields plus existing timestamp fields in a single Claims row update.
- All snapshot writes use header-based column mapping; missing columns are silently skipped (safe before migration runs).
- `buildJobStatusOutput_()` added to `EOJInterpreter.js` — reads `jobStatus`, `workPerformed`, and `forInsuranceSummary` / `workSummaryForInsurance` from parsed JSON.

### Migration steps (run before deploying)

1. Open the EOJ Processing Engine project in Apps Script editor
2. Run `runPhase35ClaimsSnapshotMigration()` from the editor
3. Verify the 7 columns appear at the right end of the Claims sheet
4. Deploy the updated scripts

`runPhase35ClaimsSnapshotMigration()` is idempotent — safe to run multiple times.

---

## Phase C — MICA / Mitigate Integration

**Problem:** MICA fields (`MICA_Status`, `MICA_Delay_Reason`, `MICA_Expected_Update_Date`, `mitigationPlanSummary`) were captured in EOJ_Log but never read by the interpreter or written to the Claims Database.

**Files changed:**
- `eoj-processing-engine/EOJInterpreter.js`
- `eoj-processing-engine/ClaimsBridge.js`
- `claims-service/Config.js` (schema)

**Changes:**
1. New function `buildMicaOutput_(parsed)` in `EOJInterpreter.js` reads:
   - `micaStatus`, `micaDelayReason`, `micaExpectedUpdateDate`, `mitigationPlanUpdated`, `mitigationPlanSummary`
   - Returns `has_mica_activity: true` when any MICA field is populated

2. `micaOutput` passed through `interpretBasicEOJ_()` return and into `buildTimelineEvents_()`.

3. When `has_mica_activity = true`, a `'Mitigate Status Updated'` timeline event is written to `Timeline_Events`. Event Detail contains MICA fields. User-facing string says "Mitigate"; internal keys use "MICA".

4. `updateClaimSnapshot_()` writes `Last_MICA_Status` and `Last_MICA_Expected_Update_Date` to the Claims row on every EOJ.

**Architecture note:** MICA is an operational status, not a condition. It maps to timeline events and snapshot fields — no condition type was created.

---

## Phase D — Todoist Task ID Writeback

**Problem:** `createEojTodoistTask()` returned `{ taskId, taskUrl }` but the return value was discarded in Code.js. Task IDs were never persisted to EOJ_Log.

**Files changed:**
- `eoj-processing-engine/Config.js`
- `eoj-processing-engine/Code.js`
- `eoj-processing-engine/StatusUpdater.js`

**Changes:**
1. `CONFIG.EOJ_LOG_REQUIRED_COLUMNS` extended with `'Todoist_Task_ID'` and `'Todoist_Task_URL'`. These columns are auto-added to EOJ_Log by `ensureEOJLogProcessingColumns_()` on the next processing run.

2. `Code.js` captures the return value from `createEojTodoistTask()` into `todoistResult`.

3. New function `writeTodoistWriteback_(rowNumber, taskId, taskUrl)` in `StatusUpdater.js` writes the task ID and URL back to the EOJ_Log row using `batchWriteStatusColumns_()` — consistent with how `markEOJProcessed_()` writes. Called after `markEOJProcessed_()`, non-fatal.

**Note:** This does NOT modify the Insurance Intake Automation Todoist workflow. The EOJ Todoist integration is a separate code path.

---

## Phase E — Equipment Foundation (Recommendation Only)

**Not implemented in Phase 3.5.** Equipment data currently lives only in `Timeline_Events.Detail` as serialized JSON. This is the correct first-generation approach and works for the current Claims Workspace display.

**When to implement:** When the Claims Workspace needs to show a live equipment count, or when the office needs to track equipment across multiple visits without reading timeline events.

**Recommended future schema:** New sheet `Claim_Equipment` in the Claims Database:

| Column | Notes |
|---|---|
| `Equipment_Record_ID` | Primary key, `EQP-` prefix |
| `Claim_ID` | Foreign key to Claims |
| `Equipment_Type` | e.g. `air_mover`, `dehumidifier` |
| `Quantity_On_Site` | Current count on site |
| `Last_Updated_At` | Timestamp of last EOJ write |
| `Last_EOJ_Source_ID` | EOJ ID that set this record |
| `Created_At` | First time this equipment type appeared |
| `Notes` | Optional |

**Pattern:** ClaimsBridge would upsert Claim_Equipment rows (update if equipment type exists for claim, insert if new). This is an update-in-place pattern, different from the append-only pattern used for timeline events and conditions.

---

## Phase F — Timeline Event_Type Verification

**Problem:** `buildTimelineEvents_()` always set the primary event type to the visit-specific type (e.g. `'Inspection Completed'`). `HomepageDataService.buildHomepageRecentActivity_()` only matches `'EOJ Submitted'` and `'EOJ Processed'`. As a result, NO completed-visit EOJs appeared in Homepage Recent Activity.

**Files changed:**
- `eoj-processing-engine/EOJInterpreter.js`

**Fix:** `buildTimelineEvents_()` now always writes `'EOJ Submitted'` as the **first** timeline event for every EOJ. This event contains visit type, job status, and work performed in its Detail. The visit-specific event (`'Inspection Completed'`, `'Monitoring Visit Completed'`, etc.) is written as the second event and retains full field detail.

- Homepage Recent Activity now sees every processed EOJ ✓
- Claim Detail timeline shows both events, both route to the "Field / EOJ Activity" group ✓
- `primary_event_type` on the processed output is now always `'EOJ Submitted'` ✓
- Visit-specific event types are preserved as the second event — no data loss ✓

---

## Deployment checklist

**Order matters:**

1. **Run migration first** (before any code push):
   - Open EOJ Processing Engine in Apps Script editor
   - Run `runPhase35ClaimsSnapshotMigration()`
   - Confirm 7 new columns appear in Claims sheet
   - Confirm output: `{ ok: true, added: [...], skipped: [] }`

2. **Push EOJ Processing Engine** via clasp:
   ```
   cd apps-script-projects/eoj-processing-engine
   clasp push
   ```
   Files changed: `EOJInterpreter.js`, `ClaimsBridge.js`, `Code.js`, `Config.js`, `StatusUpdater.js`

3. **Push claims-service** via clasp:
   ```
   cd apps-script-projects/claims-service
   clasp push
   ```
   Files changed: `Config.js`

4. **Verify** using `testClaimsBridge()` in the Apps Script editor with a real `TEST_CLAIM_ID_`.

5. **Verify Follow_Up_Date** written to Claim_Conditions for next monitoring visit.

6. **Verify snapshot** in Claims sheet: `Last_EOJ_Technician` etc. populated after next EOJ processes.

7. **Verify Homepage** Recent Activity shows EOJ entries (check after next EOJ processes).

---

## Files changed summary

| File | Phase | Change type |
|---|---|---|
| `eoj-processing-engine/EOJInterpreter.js` | A, B, C, F | Modified |
| `eoj-processing-engine/ClaimsBridge.js` | A, B, C | Modified |
| `eoj-processing-engine/Code.js` | D | Modified |
| `eoj-processing-engine/Config.js` | D | Modified |
| `eoj-processing-engine/StatusUpdater.js` | D | Modified |
| `claims-service/Config.js` | B, C | Modified |

No new files created. No services added. No existing behavior removed.
