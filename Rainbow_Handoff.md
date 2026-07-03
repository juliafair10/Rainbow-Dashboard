# Rainbow Dashboard — Handoff Document

**Date:** 2026-06-29  
**Covers:** Phase 11 (Full Claim Workspace), Rainbow Interaction Standard (double-click), Historical Notes visibility fix

---

## Project Structure

All work lives in one folder on your Mac:

```
/Users/JuliaFair/Rainbow-Dashboard/
  apps-script-projects/
    automation-dashboard/     ← the UI layer (web app)
    claims-service/           ← the data layer (web app)
```

Each subfolder is a separate Google Apps Script project with its own deployment URL. They share one Google Spreadsheet (the Claims Database).

**Claims Database Spreadsheet ID:** `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`

---

## Files Changed This Session

### claims-service

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-service/ClaimDetailService.js`**

- **What changed:** `getWorkspaceTimelineForClaim_` previously capped the timeline at 25 events in both code paths. Raised to 200 in both places. `recentEvents` stays at 5.
- **Why:** Historical notes have older dates than recent automation system events. With 25+ system events from daily automation, the notes were sorted to positions 26+ and silently dropped before ever reaching the Full Claim page.
- **Also added:** `testFullClaimLatestNotes(claimId)` — run this from the Apps Script editor to trace the notes pipeline for any claim. Logs raw sheet rows, service payload, and a visibility verdict.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-service/HistoricalNotesImportService.js`**

- **What changed:** Added `testLatestHistoricalNotesImportVisibility()` at the bottom of the file. No existing logic was modified.
- **What it does:** Reads the 10 most recently dated historical note rows from `Timeline_Events`, checks whether Claim_ID is populated, and checks whether each note is visible through `getWorkspaceTimelineForClaim_`. Prints a root cause verdict to the Apps Script log.

---

### automation-dashboard

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/RainbowNavStandard.html`** *(new file)*

- Shared platform-wide double-click helper. Contains `rainbowOpenFullClaim_(claimId)` and `rainbowAttachDoubleClick_()`.
- Auto-detects which workspace it's running in (Homepage, Claims, Intake) and uses the appropriate navigation function.
- Every shell includes this file. Any future workspace should include it too.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/HomepageShell.html`**

- Added `<?!= HtmlService.createHtmlOutputFromFile('RainbowNavStandard').getContent(); ?>` before `HomepageScripts` include.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/ClaimsShell.html`**

- Added `<?!= include('RainbowNavStandard'); ?>` before `ClaimsScripts` include.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/IntakeView.html`**

- Added `<?!= include('RainbowNavStandard'); ?>` before `IntakeScripts` include.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/HomepageScripts.html`**

- Added `dblclick` event listeners in `attachHomepageListNavigation_` (priority/stale/recent lists) and `attachHomepageGroupedAlertNavigation_` (operational alerts). Both call `rainbowOpenFullClaim_(claimId)`.
- Awareness cards were intentionally skipped — they are lens views with no single claimId.
- Single-click behavior unchanged.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/ClaimsScripts.html`**

- Added `dblclick` listener on each `.claim-row` after the existing `click` handler, calling `rainbowOpenFullClaim_()` with the row's `data-claim-id` attribute.
- Single-click behavior unchanged.

**`/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard/IntakeScripts.html`**

- Added a delegated `dblclick` listener on `document` that finds the closest `[data-intake-claim-id]` element and calls `rainbowOpenFullClaim_()`.
- The existing delegated `click` handler was consolidated back to a single block after an accidental split during editing.

**Phase 11 files (Full Claim Workspace — all new, no changes this session):**

```
automation-dashboard/
  ClaimViewShell.html         ← shell served at ?view=fullClaim
  ClaimViewStyles.html        ← all CSS for the Full Claim page
  ClaimView.html              ← layout: sidebar + main tabs
  ClaimViewScripts.html       ← init, notes render, compliance section
  ClaimOperationalSummary.html ← operational summary tab
  ClaimTimeline.html          ← timeline tab with filter buttons
  ClaimConditions.html        ← conditions tab
  ClaimAlerts.html            ← alerts tab
  ClaimFinancialTracks.html   ← financial tracks tab
  ClaimDocuments.html         ← documents tab
  ClaimSidebar.html           ← right sidebar (header, meta, quick links)
```

---

## Files Read But Not Changed

These were inspected to understand data flow and confirm no regressions:

| File | Why it was read |
|---|---|
| `claims-service/TimelineService.js` | Confirmed `getTimelineForClaim` returns all rows (no cap), sorts newest-first |
| `claims-service/TimelineImportHelpers.js` | Confirmed `appendImportedTimelineEvent` write path (passes through `appendTimelineEvent`) |
| `claims-service/SheetService.js` | Confirmed `normalizeHeaderName_` converts `'Claim ID'` → `'Claim_ID'` so reads always match |
| `claims-service/ClaimFoundationService.js` | Confirmed it passes timeline through from `detail.timelineSection.events` without capping |
| `claims-service/ClaimDrawerService.js` | Confirmed it does NOT call `getWorkspaceTimelineForClaim_` — drawer is unaffected by the cap change |
| `claims-service/OperationalIntelligenceService.js` | Confirmed no additional timeline cap |
| `claims-service/Config.js` | Confirmed spreadsheet ID, sheet names, canonical headers |
| `automation-dashboard/Code.js` | Confirmed `getClaimDetailPageData` → `fetchClaimsServiceJson_('getClaimDetail')` → claims-service |
| `automation-dashboard/ClaimViewScripts.html` | Confirmed `fcvGetTimelineEvents` reads `detail.timelineSection.timelineEvents`, `renderFcvNotes` renders up to 20 note events |
| `automation-dashboard/ClaimTimeline.html` | Confirmed `fcvGetTimelineAllEvents` has no render-level cap beyond filtering |

---

## Key Data Flow

```
Timeline_Events sheet (Google Sheets)
  ↓ written by: HistoricalNotesImportService.writeHistoricalTimelineEvents_
    (reads actual sheet headers, maps space-key columns: 'Claim ID', 'Date', 'Event Type')
  ↓ read by: TimelineService.getTimelineForClaim
    (SheetService normalizes 'Claim ID' → 'Claim_ID'; all rows returned, sorted newest-first)
  ↓ received by: ClaimDetailService.getWorkspaceTimelineForClaim_
    (normalizes, re-sorts, NOW returns up to 200 — was 25)
  ↓ assembled by: getClaimDetail(claimId)
    (puts into detail.timelineSection.events and .timelineEvents)
  ↓ served by: claims-service Code.js doGet → 'getClaimDetail' action
  ↓ fetched by: automation-dashboard getClaimDetailPageData
  ↓ rendered by: ClaimViewScripts.fcvGetTimelineEvents + renderFcvNotes
                 ClaimTimeline.renderFcvTimeline
```

---

## Rainbow Interaction Standard

**Convention:** Double-clicking any claim anywhere in Rainbow opens the Full Claim Workspace (`?view=fullClaim&claimId=...`).

**Implementation:** One shared helper in `RainbowNavStandard.html`, included in every shell. Call `rainbowOpenFullClaim_(claimId)` from any future workspace to follow the standard. Single-click behavior is always left untouched.

**Current coverage:**
- Homepage priority list, stale list, recent activity list, operational alerts ✅
- Claims Workspace claim rows ✅
- Intake Workspace recently processed claims ✅

---

## How to Run Diagnostics

Open either GAS project in the Apps Script editor, select the function, and click Run.

**Test notes pipeline for a specific claim:**
```
Project: claims-service
Function: testFullClaimLatestNotes
Argument: pass claimId in the function body or edit the fallback to pick a specific claim
```

**Test visibility of recently imported notes:**
```
Project: claims-service
Function: testLatestHistoricalNotesImportVisibility
(no argument needed — samples most recently dated historical note rows automatically)
```

**Test notes for a specific job number (existing diagnostic):**
```
Project: claims-service
Function: diagnoseHistoricalNotesForJob
Argument: job number string, e.g. '26A-0034-WTR'
```

---

## Deploy Commands

After any change, push the affected project:

```bash
# From the project directory:
cd /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-service
clasp push

cd /Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/automation-dashboard
clasp push
```

Then in the Apps Script editor: **Deploy → Manage deployments → select active deployment → Deploy** to publish changes to the live URL.

Only `claims-service` was changed this session (notes fix + diagnostics). `automation-dashboard` changes are from the double-click standard work earlier in the session.
