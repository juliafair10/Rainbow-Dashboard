# Rainbow Diagnostic — Intake Claim Data Not Transferring to Claims Row
**Date:** 2026-06-30  
**Claim:** 26N-0147-WTR / LEWIS, ARNITA  
**Status:** Read-only diagnostic. No code changed.

---

## A. Intake Data Source Map

When `processInsuranceIntake()` runs in `insurance-intake-automation`, it writes to **three separate stores**. None of them is the Claims sheet.

| Store | Spreadsheet | Sheet | What gets written |
|---|---|---|---|
| Claim Folder Map | `1kTRyZbPW1dZgkflH31s4MewuVHEl1ExQ7o3c6ad-btQ` (intake-only) | `Claim Folder Map` | Customer Name, Our Job Number, Year, Drive Folder URL, Folder ID, Active, Last Updated, Location of Property, Notes |
| External_Links | `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c` (shared Claims Foundation) | `External_Links` | Job Number, Claim Number (real or fallback), XactAnalysis URL, Symbility URL, Drive Folder URL |
| Calendar / Todoist / Drive | — | — | Calendar draft, Todoist task, Drive folder — transient, not persisted in any sheet claims-service can read |

**Carrier name** is extracted by `parseInsuranceIntakeThread()` and used for the Todoist task and calendar draft subject lines, but it is **never written to any persistent sheet**. It exists only in memory during the intake run.

**`processIntakeClaim()` in `IntakeIntegrationService.js` is never called by insurance-intake-automation.** That function, which would create a full enriched Claims row, has no caller path from the intake project. Insurance Intake automation was designed to create infrastructure (folder, links, tasks) and then rely on the Daily Open Jobs report to bootstrap the Claims row. The enrichment handoff back to Claims was never built.

---

## B. Trace for 26N-0147-WTR / LEWIS, ARNITA

### Step 1 — Insurance Intake email arrives

`processInsuranceIntake()` parses the Gmail thread labeled `Intake-Insurance Assignment`.

- `rainbowJobNumber` = `26N-0147-WTR` (from the "Fusion Job Number" field in the email body)
- `claimNumber` = real carrier claim number if found in email body; otherwise falls back to `rainbowJobNumber` (`26N-0147-WTR`)
- `carrier` = extracted from email; used for task/calendar only
- `platformLinks` = Symbility URL and/or XactAnalysis URL if present in the email body

**Writes performed:**
1. Appends a row to **Claim Folder Map** (own spreadsheet): customer name, job number, Drive folder URL
2. Upserts a row in **External_Links** (shared spreadsheet): job number, claim number, Symbility URL, XactAnalysis URL, Drive folder URL
3. Creates Drive folder, Todoist task, calendar draft — not readable by claims-service

**Claims sheet: untouched. No Claims row created by this step.**

### Step 2 — Daily Open Jobs bootstrap creates the Claims row

When `importLatestDailyOpenJobsReport` runs (now step 2 of morning automation after Fix 1), `tryBootstrapClaimFromDailyOpenJobsRow_` calls `findOrCreateClaim()` with:

```
Job_Number:       '26N-0147-WTR'
Claim_Number:     <real claim number from DOJ report column, or job number as fallback>
Display_Name:     'LEWIS, ARNITA'
Lifecycle_State:  'Active Work'
Ownership_Area:   'Field Operations'
Source_System:    'daily-open-jobs-import'
```

This creates a **thin Claims row**. No carrier, no platform links, no intake enrichment.

### Step 3 — Historical Notes import (step 5 of morning automation)

Matches by job number → writes Timeline_Events entries for LEWIS if any historical notes exist. Does not touch the Claims row fields.

### Step 4 — synchronizeClaimsFoundation (step 7 of morning automation)

This is where partial reconciliation occurs.

**Step 3 (EL Claim_ID backfill pass 1):** Finds the External_Links row for `26N-0147-WTR` and writes the Claims row's `Claim_ID` into the `Claim_ID` column on that EL row. Direction: Claims → External_Links. The Claims row gains nothing.

**Step 4 (repair Claim_Number from External_Links):** Reads External_Links for `26N-0147-WTR`. If that EL row carries a real claim number (not equal to the job number), it writes that claim number into the Claims row's `Claim_Number` column, **but only if the current Claims value is blank or equals the job number (fallback)**. This is the only field from intake that ever gets written back to the Claims row.

**What step 4 does NOT copy from External_Links to Claims:**
- XactAnalysis URL
- Symbility URL
- Drive Folder URL
- Carrier name (not in External_Links at all)
- Loss address
- Date of loss
- Type of loss
- Contact info

**Step 5 (EL Claim_ID backfill pass 2):** Same as pass 1, picks up any EL rows now matchable after step 4 wrote real Claim_Numbers. Still direction Claims → External_Links.

**Step 6 (reconcile alerts):** Creates a "Missing XA/Symbility Link" alert if the EL row has no XA/Symbility URL. This alert appears in the dashboard but does not populate the Claims row.

### Step 5 — Claims Workspace query (ClaimsQueryService)

`getAllClaimSummaries()` reads **only the Claims sheet**. It does not join with External_Links, Claim Folder Map, Timeline_Events, or any other sheet. The LEWIS row is now visible (Fix 1 worked), but shows only what the thin Claims row contains:

| Field | Status |
|---|---|
| Claim_ID | ✅ Present (generated at bootstrap) |
| Job_Number | ✅ `26N-0147-WTR` |
| Display_Name | ✅ `LEWIS, ARNITA` |
| Claim_Number | ⚠️ Real number if DOJ report or EL had it; otherwise shows job number as fallback |
| Lifecycle_State | ✅ `Active Work` |
| Carrier / Insurer | ❌ Never written to Claims row |
| XactAnalysis URL | ❌ In External_Links but Claims Workspace doesn't read it |
| Symbility URL | ❌ In External_Links but Claims Workspace doesn't read it |
| Drive Folder URL | ❌ In External_Links but Claims Workspace doesn't read it |
| Fusion / intake links | ❌ Never populated |

---

## C. Root Cause

There are **two compounding gaps**, not one.

### Gap 1 — Insurance Intake never creates a Claims row (primary gap)

`processInsuranceIntake()` was designed to create infrastructure but not a Claims row. `processIntakeClaim()` exists in `IntakeIntegrationService.js` within claims-service and would write all intake fields to a Claims row, but nothing calls it from the intake project. The intake pipeline ends at Claim Folder Map + External_Links. A Claims row is only created later by the DOJ bootstrap.

### Gap 2 — synchronizeClaimsFoundation only promotes Claim_Number, not all intake fields

`runEnrichClaimNumbersFromExternalLinks_()` (step 4) correctly copies the real claim number from External_Links back to the Claims row. But no analogous step copies carrier, platform links, or other intake-enriched data. External_Links doesn't even store carrier — that data is lost at the end of the intake run.

### Why carrier is always missing

`parseInsuranceIntakeThread()` extracts `carrier` and passes it to `processInsuranceIntake()`. The carrier value is used to build the Todoist task title and the calendar draft subject. After that it is discarded. It is not written to Claim Folder Map, External_Links, or any other persistent sheet. **There is no code path to recover carrier from any downstream store.**

### Why Xact/Symbility links don't appear in Claims Workspace

The links exist in External_Links (written by `saveInsuranceIntakeExternalLinks_()`) and `synchronizeClaimsFoundation` step 3 correctly associates the `Claim_ID` onto those EL rows. But `ClaimsQueryService.getAllClaimSummaries()` reads only the Claims sheet — it does not JOIN or reference External_Links. The UI never sees the links unless they are also stored in the Claims row itself.

---

## D. Risk Assessment

| Risk | Severity | Notes |
|---|---|---|
| Overwriting a real claim number with a fallback | High | Already guarded in step 4 — only writes if current value is blank or = job number |
| Creating duplicate Claims rows | Medium | `findOrCreateClaim` checks for existing rows before creating — no duplication risk from bootstrap |
| Carrier data permanently lost | High | No recovery path currently exists; only source was the original intake email |
| External_Links row gets orphaned (no Claim_ID) | Low | Step 3 of sync backfills Claim_ID once Claims row exists — resolves within one morning run |
| Claim appears in Workspace without platform links | Medium | Functional miss; user must navigate to External_Links tab manually or via dashboard |

No existing data is at risk from any additive fix. The LEWIS Claims row is thin but correct. External_Links has intake data intact.

---

## E. Recommended Fix

Three changes are needed, in order of priority.

### Fix A — Enrich Claims row with platform links from External_Links (HIGH — additive, safe)

Add a new step to `synchronizeClaimsFoundation` after step 4 that reads XactAnalysis URL and Symbility URL from External_Links and writes them to corresponding columns on the Claims row, **only if those Claims fields are currently blank**. This mirrors the existing step 4 pattern exactly (External_Links → Claims, never overwrites non-blank).

Requires confirming that `XactAnalysis_URL` and `Symbility_URL` columns exist (or can be added) on the Claims sheet. If they do not exist, add them before implementing the step.

### Fix B — Capture carrier during intake and write it to External_Links (MEDIUM — additive)

Modify `saveInsuranceIntakeExternalLinks_()` / `upsertInsuranceIntakeWideExternalLinks_()` in `insurance-intake-automation/Code.js` to write `carrier` as an additional column on the External_Links row. Then Fix A's step can also copy carrier into the Claims row.

This is the only way to recover carrier going forward. Historical carrier data for already-processed claims cannot be recovered without re-running intake on the original emails.

### Fix C — Call processIntakeClaim from insurance-intake-automation (LONG TERM — not yet)

The cleanest long-term fix is to have `processInsuranceIntake()` call the claims-service web app endpoint at the end of its run, passing all extracted fields. This would make intake the authoritative source for the Claims row and eliminate the need for sync reconciliation. However, this involves cross-project communication and would need careful sequencing to avoid creating duplicates when DOJ bootstrap also runs.

**Not recommended for this sprint.** Fix A + B are additive, safe, and solve the immediate visibility problem without redesigning the pipeline.

---

## F. Safe Build Plan

This plan is additive only. It does not remove any existing step, does not call processIntakeClaim, and preserves the current DOJ bootstrap and intake automation behavior.

### Phase 1 — Confirm External_Links schema (read-only verification, no code)

Before writing any code, manually inspect the External_Links sheet in the Claims Foundation spreadsheet (`1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`) and confirm:
- Column headers present: `Job_Number`, `Claim_Number`, `XactAnalysis_URL` (or `XA_URL`), `Symbility_URL`, `Drive_Folder_URL`, `Claim_ID`
- Confirm a row exists for `26N-0147-WTR`
- Note whether XactAnalysis and Symbility URLs are populated for LEWIS

Also confirm whether `XactAnalysis_URL` and `Symbility_URL` columns exist on the Claims sheet.

### Phase 2 — Fix B: Capture carrier in External_Links (insurance-intake-automation)

File: `apps-script-projects/insurance-intake-automation/Code.js`  
Function: `upsertInsuranceIntakeWideExternalLinks_()` (already handles upsert logic with conflict detection)

Add `Carrier` as a new column. Write `claimData.carrier` when upserting. Never overwrite a non-blank existing value.

This change is backward-compatible — existing EL rows simply won't have the column until re-processed or back-filled.

### Phase 3 — Fix A: Enrich Claims row from External_Links (claims-service)

File: `apps-script-projects/claims-service/ExternalLinkService.js`  
New function: `runEnrichClaimFieldsFromExternalLinks_(dryRun)`

Logic (mirrors existing step 4 pattern):
1. Read External_Links sheet, build lookup by job number: `{ xaUrl, symbilityUrl, carrier, driveFolderUrl }`
2. Skip rows where the field in External_Links is blank
3. Read Claims sheet, for each row: if `Job_Number` matches and target field in Claims is blank → propose write
4. In live mode, batch-write all proposals

Safety guards (same as existing steps):
- Never overwrite non-blank Claims fields
- Skip Claims rows where `Job_Number` is blank
- Conflict detection (two EL rows for same job number with different values → skip)

File: `apps-script-projects/claims-service/ClaimSynchronizationService.js`  
Add after current step 4 as new step 4B, before the existing pass-2 Claim_ID backfill:

```javascript
// Step 4B: Enrich Claims rows with platform links and carrier from External_Links
var step4b = runSyncStep_('enrichClaimFieldsFromExternalLinks', quiet, function() {
  return runEnrichClaimFieldsFromExternalLinks_(dryRun);
});
report.steps.push(step4b);
```

### Phase 4 — Test sequence

1. Run `previewClaimsFoundationSync()` first (dry run) — confirm the new step reports eligible rows for LEWIS
2. Run `runClaimsFoundationSync()` (live) — confirm XA/Symbility links and carrier now appear in the Claims row for LEWIS
3. Check Claims Workspace — confirm LEWIS now shows enriched data
4. Run the full morning automation on next scheduled run and verify no regressions

### Phase 5 — Handle missing carrier for existing claims (manual, one-time)

For claims already processed by intake where carrier was not captured, there is no automated recovery path. The carrier data only existed in the original Gmail threads. Options:
- Manually look up each affected claim in the Claim Folder Map (which has Notes field recording the original thread ID) and enter the carrier via the dashboard
- OR: build a one-time backfill script that re-parses the original Gmail threads using the thread IDs stored in External_Links Notes — only if the volume makes this worthwhile

This is not blocking for Fix A + B and can be decided separately.

---

## Summary

The LEWIS, ARNITA claim is visible in Claims Workspace (Fix 1 resolved that). It is thin because Insurance Intake automation never creates a Claims row — it only writes to Claim Folder Map and External_Links. The DOJ bootstrap created the Claims row; the morning sync copies only the real Claim_Number back from External_Links. All other intake-enriched data (XA/Symbility links, carrier name) never reaches the Claims row.

The fix is two targeted additions: (1) write carrier into External_Links during intake, and (2) add a sync step that promotes platform links and carrier from External_Links into blank Claims fields. Both are purely additive and require no redesign of either pipeline.
