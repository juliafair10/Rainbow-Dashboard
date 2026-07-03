# Rainbow EOJ — Session Handoff
*June 30, 2026*

---

## Project Location

All code lives in:
```
/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/
```

Two active GAS projects:
- `eoj-app/` — technician-facing web app
- `eoj-processing-engine/` — 15-minute time-trigger processing engine

---

## Files Touched This Session

### `eoj-app/Code.js`
**Location:** `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-app/Code.js`

**Changes:**
1. Fixed `getEquipmentForJob()` — changed to only skip `Processing_Status = 'Skipped'` rows (previously also skipped `'Error'` rows, which caused equipment counts to disappear when downstream services like Todoist/Chat errored).
2. Fixed `getJobSummaryForLookup()` — added `Utilities.formatDate()` for `Visit_Date` values that are Date objects (was rendering as raw JS Date string).
3. Modified `getJobsForLookup()` — now cross-references EOJ_Log to build a `Claim_ID → latest Submitted_At` map and sorts jobs by most recent EOJ descending. Jobs with no EOJ history fall to bottom alphabetically. Also added `debugEquipmentColumns()` diagnostic function.

---

### `eoj-app/Client.html`
**Location:** `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-app/Client.html`

**Changes:**
1. `renderJobCards()` — changed `jobs.slice(0, 12)` to `(query ? jobs : jobs.slice(0, 10))`. Default view: top 10 most recent. Search active: all matching results, no cap.
2. `renderJobCards()` — added Claim ID to job search cards so technicians can distinguish duplicate customer names (e.g., same customer with WTR and CUS claims). Combined into `sub` line: `[claimId, addr].filter(Boolean).join(' · ')`.
3. `renderLookupJobList()` — added Claim ID to Job History tab cards: `[j.claimNumber, j.claimId, j.propertyAddress].filter(Boolean).join(' · ')`.
4. MICA → Mitigate rename in display strings: `row('MICA Status', ...)` → `row('Mitigate Status', ...)` and `'MICA: '` → `'Mitigate: '` in EOJ history card meta.

---

### `eoj-app/Index.html`
**Location:** `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-app/Index.html`

**Changes:**
1. Viewport meta changed from `width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, viewport-fit=cover` to `width=device-width, initial-scale=1, viewport-fit=cover`.
2. MICA → Mitigate rename in all user-visible labels: `<h2>Mitigate Status</h2>`, `Was Mitigate updated after today's visit?`, `Reason Mitigate Was Not Updated`, placeholder text. Internal element IDs (`micaUpdatedYes`, `micaUpdatedNo`, etc.) and `name="micaUpdated"` NOT changed.

---

### `eoj-app/Styles.html`
**Location:** `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-app/Styles.html`

**Changes:**
1. Changed `@media (min-width: 900px)` → `@media (min-width: 1200px)` for `.app-shell` max-width cap.
2. Changed `@media (min-width: 560px)` → `@media (min-width: 1200px)` for `.view.active` padding restore.
3. Added hard mobile override block at very end of file (`@media screen and (max-width: 1100px)`) that forces `width: 100vw !important` on all container elements. Excludes `input[type="radio"]`, `input[type="checkbox"]`, `input[type="hidden"]` from the width override to prevent visit type card layout from breaking.

**Why:** GAS iframe reports ~980px CSS viewport on iPhone. Standard 768px/900px breakpoints fire in "desktop" mode. Solution is to use 1200px+ for desktop-only rules and add an explicit 1100px override block.

---

### `eoj-processing-engine/GoogleChatNotifier.js`
**Location:** `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-processing-engine/GoogleChatNotifier.js`

**Status:** Updated in a prior session (no changes this session). Current `buildChatMessage_()` sends plain text with `*bold*` labels — no header, no emojis, no EOJ ID. **The notification in Google Chat showing the old format (with header "EOJ Report Submitted" and emojis) is NOT from this file.** It is likely from a Zapier Zap or an undeployed version. This needs investigation next session.

---

## Documentation Created This Session

### `docs/EOJ_System_Architecture_v1.md`
**Local:** `/Users/JuliaFair/Rainbow-Dashboard/docs/EOJ_System_Architecture_v1.md`
**Google Drive:** https://docs.google.com/document/d/1bhA7VPd328nf5Y_P_3A6UaiMO2mPINCxhc0gSwlyNdM/edit
**Drive Folder:** https://drive.google.com/drive/folders/1ckH9jSKvEzaHk6rcGVG32yMgvZlU3WsF

Full architectural reference for the EOJ system. 17 sections. Covers every file, data flow, visit types, equipment persistence, Todoist integration, Google Chat integration, ClaimsBridge, deployment process, script properties, and completed features checklist.

---

## Key Architecture Facts (for next session context)

**EOJ_Log column mapping:** Always header-based. Never positional. `getEOJLogHeaderIndex_()` builds the map; `appendRowByHeaders_()` writes. Adding a column = add to `EOJ_LOG_COLUMNS_` in Code.js + run `repairEOJLogColumns()`.

**Processing_Status values:** `New` (on submit), `Processed` (engine success), `Error` (engine failure — data still valid), `Skipped` (manual admin exclusion).

**Equipment lookup reads Error rows.** This is intentional. Only Skipped rows are excluded.

**GAS mobile breakpoint issue:** GAS iframe reports ~980px on iPhone. All desktop-only CSS rules must use `min-width: 1200px+`. The `max-width: 1100px` override block at the end of Styles.html is the mobile fix.

**MICA vs Mitigate:** Internal field names, element IDs, sheet column names, and JS variables all use `mica`/`MICA`. All user-visible strings say "Mitigate". Do not rename internal names.

**Technician list:** `['Blake', 'Tyler', 'Cooper', 'Patricia', 'Clarence', 'Joe']` — in `eoj-app/Config.js`.

**Spreadsheet IDs (in Config.js):**
- EOJ Database (EOJ_Log): `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs`
- Claims Database: `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`

---

## Pending / Next Session

1. **Google Chat notification format** — User wants to redesign the Chat message output. The current screenshot shows an old-style notification (with "EOJ Report Submitted" header, per-field emojis, EOJ ID at bottom). This is NOT coming from the current `GoogleChatNotifier.js`. Likely a Zapier Zap still running separately. Next session: determine if Zapier needs to be disabled and confirm what format the user wants.

2. **clasp push needed** — All changes this session are local. Both `eoj-app` and `eoj-processing-engine` need to be pushed and the eoj-app redeployed for changes to go live.

---

## Deployment Reminder

```bash
# EOJ App (requires redeploy in Apps Script editor after push)
cd /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-app
clasp push

# Processing Engine (push only — trigger picks up on next run)
cd /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/eoj-processing-engine
clasp push
```

---

## Critical Rules (carry forward always)

Do NOT redesign Rainbow. Do NOT redesign the EOJ architecture. Do NOT redesign the Claims architecture. Do NOT redesign the Processing Engine. Do NOT redesign the Claims Bridge. Do NOT redesign Todoist integration. Do NOT redesign Google Chat architecture. Do NOT redesign Claim Lifecycle. Do NOT redesign Operational Health. Do NOT redesign the Technician Workspace.

Todoist API: use `TODOIST_API_TOKEN` (preferred), fallback `TODOIST_TOKEN`. URL: `https://api.todoist.com/api/v1/tasks`. Do NOT modify Insurance Intake Automation Todoist workflow.
