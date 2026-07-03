# EOJ-to-Rainbow Dashboard Diagnostic
**Generated:** 2026-06-30  
**Scope:** Read-only investigation. No implementation changes made.  
**Projects inspected:** eoj-app, eoj-processing-engine, automation-dashboard, claims-service, Claims Database sheet definitions  
**All projects pulled fresh via `clasp pull` before this diagnostic was written.**

---

## 1. EOJ Data Flow Map

```
TECHNICIAN (mobile browser)
        │
        ▼
eoj-app/Client.html  ──────────────────────────────────────────────────────────
        │  submitEOJ() → validateBasicEOJ() → appendEOJRecord()
        │
        ▼
EOJ Database (ID: 10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs)
        │  Sheet: EOJ_Log (46 columns)
        │  Processing_Status = "New"
        │
        ▼  (15-minute time trigger)
eoj-processing-engine/Code.js: processUnprocessedEOJs()
        │
        ├── EOJInterpreter.interpretBasicEOJ_()
        │       Builds: base context, equipmentOutput, followUpOutput,
        │               monitoringOutput, asbestosOutput, itelOutput,
        │               reviewOutput, conditionOutput, alertOutput,
        │               timelineEvent, operationalObjects
        │
        ├── ClaimsBridge.writeEojToClaimsDatabase()
        │       │
        │       ├──▶ Timeline_Events  (1 row: EOJ event with Summary/Detail)
        │       ├──▶ Claim_Conditions (ONLY monitoring_active + asbestos_testing_pending)
        │       ├──▶ Claim_Alerts     (Follow-Up Required, Asbestos Testing Pending,
        │       │                       Itel Sample Required, EOJ Review Required)
        │       └──▶ Claims row       (Last_EOJ_At, Last_Meaningful_Activity_At, Updated_At ONLY)
        │
        ├── TodoistService.createEojTodoistTask()   [only when followUpNeeded = true]
        │       Task ID NOT written back to EOJ_Log or Claims DB
        │
        ├── GoogleChatNotifier.postEojToGoogleChat()
        │       Posted status NOT written back anywhere
        │
        └── EOJ_Log row marked Processing_Status = "Processed"

Claims Database (ID: 1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c)
        │
        ▼
claims-service (GAS web app, called via CLAIMS_SERVICE_URL_FALLBACK)
        │  EojIntegrationService.js → processEojOutputs() routes:
        │      timeline events → appendTimelineEvent()
        │      conditions → addCondition()
        │      alerts → addAlert()
        │      ownership changes → setOwnership()
        │
        ├── HealthEngineService.evaluateHealthDriver_()
        │       Reads activeConditions (Claim_Conditions sheet)
        │       Health driven by: Monitoring Active, Asbestos conditions,
        │       Revision conditions, Coverage states, etc.
        │
        └── automation-dashboard (served to browser)
                ├── Homepage  ─── HomepageDataService.getHomepageClaimSummaryData()
                ├── Claims Workspace ─── ClaimsWorkspaceService.getClaimsWorkspace()
                ├── Claim Detail ─── ClaimDetailService.getClaimDetail()
                └── EOJ Admin ─── EojAdminService.getEojAdminData()
```

---

## 2. Dashboard / Homepage Connections

### Homepage
Data source: `HomepageDataService.getHomepageClaimSummaryData()` + `HealthEngineService.getHomepageClaimSummary()`

| Homepage Section | EOJ Connection |
|---|---|
| KPI: `monitoringActive` | Counts claims with active "Monitoring Active" condition (written by ClaimsBridge from EOJ) |
| KPI: `needsAttention / atRisk / escalated / critical` | Health level driven by conditions EOJ creates |
| KPI: `waitingOnInsurance` | Not EOJ-driven; insurance conditions only |
| `recentActivity` | Explicitly includes `'EOJ Submitted'` and `'EOJ Processed'` as meaningful event types — pulls from Timeline_Events |
| `todayPriorities` | Surfaces: "Monitoring needs next visit scheduled" (Monitoring Active, no follow-up date); "Monitoring follow-up overdue" (Monitoring Active, past follow-up date) |
| `becomingStale` | Claims at At Risk/Escalated/Critical — health driven by EOJ-created conditions |
| `operationalAlerts` | Shows EOJ-sourced alerts: Follow-Up Required, Asbestos Testing Pending, Itel Sample Required, EOJ Review Required |
| `conditionsVisibility` | Shows Monitoring Active and Asbestos Testing Pending open counts (both EOJ-sourced) |
| `ownershipVisibility` | Not directly EOJ-driven |
| `todaySchedule` | Calendar-based; EOJ does not feed calendar directly |

**Important:** `recentActivity` only surfaces EOJ events if the Timeline_Events row has `Event_Type = 'EOJ Submitted'` or `'EOJ Processed'`. ClaimsBridge should be verified to write these exact strings in the Event_Type column.

### Claims Workspace
Data source: `ClaimsWorkspaceService.getClaimsWorkspace()` via claims-service

| Feature | EOJ Connection |
|---|---|
| Lens: `missingEoj` | Dedicated lens for claims without recent EOJ — exists and is surfaced |
| Lens: `needsAttention` | Health driven by EOJ-created conditions |
| `operationalAlerts` per claim | Built from `activeAlerts` — includes EOJ-sourced alerts |
| `alertCount` | Counts all active alerts per claim, including EOJ-sourced |
| `activeConditions` per claim | Includes Monitoring Active and Asbestos Testing Pending from EOJ |
| `lastMeaningfulActivityAt` | Updated by every EOJ submission — shows staleness |
| `nextAction` | "Review active claim conditions" when EOJ-driven conditions are open |

### Claim Detail (Full Claim Workspace)
Data source: `ClaimDetailService.getClaimDetail()` via claims-service

| Feature | EOJ Connection |
|---|---|
| Timeline section | EOJ events grouped as **"Field / EOJ Activity"** (keyword match on eoj, field, monitor, inspection, technician, calendar) |
| `timelineSection.events` | EOJ submission event appears with Summary (work performed), Detail (full JSON), Actor (technician), Date |
| `claimHeader.lastMeaningfulActivityAt` | Updated by every EOJ |
| `claimHeader.activeConditions` | Includes Monitoring Active, Asbestos Testing Pending from EOJ |
| `claimHeader.activeAlerts` | Includes EOJ-sourced alerts |
| `claimHeader.healthLevel` | Driven by EOJ-created conditions via Health Engine |
| `operationalContext.activeConditions` | Same EOJ conditions |
| `fullClaimCurrentState` | Shows health, lifecycle, primary condition — all influenced by EOJ data |
| `workspaceContext` | Full operational context including EOJ-driven health, conditions, requirements |

### EOJ Admin View
Data source: `EojAdminService.getEojAdminData()` — reads EOJ Database directly (not Claims DB)

Surfaces per EOJ row:
- EOJ_ID, Submitted_At, Technician, Job_Name, Claim_ID, Claim_Number
- Visit_Date, Visit_Type, Job_Status
- Processing_Status, Processed_At, Processing_Error, Processing_Run_ID

Additional capabilities:
- `retryEojRow()`: reset Error → New for reprocessing
- `getEojRowDetail()`: full Raw_JSON payload view

---

## 3. Specific EOJ Output Evaluation

| EOJ Output | Captured in EOJ_Log | Interpreted by Engine | Written to Claims DB | Surfaced on Dashboard | Gap? |
|---|---|---|---|---|---|
| Last EOJ date | ✅ Submitted_At | ✅ | ✅ Claims.Last_EOJ_At | EOJ Admin; implicit via lastMeaningfulActivityAt | **Minor:** Last_EOJ_At exists in Claims but no dedicated UI label |
| Last EOJ technician | ✅ Technician | ✅ (Timeline actor) | ✅ Timeline_Events (Actor) | Claim Detail timeline | **Gap:** Not a Claims sheet column; not on workspace list view |
| Last EOJ visit type | ✅ Visit_Type | ✅ (Timeline) | ✅ Timeline_Events (context) | Claim Detail timeline; EOJ Admin | **Gap:** Not a Claims sheet column |
| Job status | ✅ Job_Status | ❌ Not interpreted | ❌ Not written to Claims | EOJ Admin only | **GAP** — not in Claims DB |
| Visit Summary / For Insurance | ✅ Work_Summary, For_Insurance_Summary | ✅ (Timeline Summary/Detail) | ✅ Timeline_Events | Claim Detail timeline | Working |
| MICA status (Mitigate) | ✅ MICA_Status | ❌ Not interpreted | ❌ Not written anywhere | Nowhere in dashboard | **MAJOR GAP** |
| MICA delayed until | ✅ MICA_Expected_Update_Date | ❌ Not interpreted | ❌ | Nowhere | **MAJOR GAP** |
| Mitigation plan | ✅ Mitigation_Plan_Updated, mitigationPlanSummary | ❌ Not interpreted | ❌ | Nowhere | **MAJOR GAP** |
| Equipment on site | ✅ 12 equipment columns | ✅ equipmentOutput | ✅ Timeline_Events detail | EOJ App lookup tab (reads EOJ_Log directly); Claim Detail timeline | **Gap:** No persistent Claims DB equipment table; not on workspace list |
| Equipment changes | ✅ (added/removed flags) | ✅ equipmentOutput | ✅ Timeline_Events detail | Claim Detail timeline | Works for audit; no delta display |
| Office follow-up requested | ✅ Follow_Up fields | ✅ followUpOutput | ✅ Claim_Alerts ("Follow-Up Required") + Todoist task | Homepage operationalAlerts, Workspace alertCount | **Minor gap:** Follow-up note/action text not persisted separately |
| Todoist task created | N/A | ✅ Created when followUpNeeded | ❌ Task ID not written back | Not visible on dashboard | **GAP** — no confirmation signal |
| Google Chat posted | N/A | ✅ Sends notification | ❌ Not written back | Not visible on dashboard | **Gap** (minor — it's a notification, not a state) |
| Temp job / pending claim link | ✅ Is_Temp_Job | ❌ Not interpreted | ❌ Not written anywhere | Nowhere | **GAP** |
| Asbestos status | ✅ asbestos fields | ✅ asbestosOutput | ✅ Claim_Conditions ("Asbestos Testing Pending") + Claim_Alerts | Homepage conditionsVisibility, Claim Detail, health engine | **Partial gap:** "Waiting on Lab Results", "Positive Asbestos Result", "Abatement Required" are NOT in CONDITION_TYPE_MAP_ — not written from EOJ |
| Monitoring status | ✅ monitoring fields | ✅ monitoringOutput | ✅ Claim_Conditions ("Monitoring Active") | Homepage KPI, todayPriorities, health engine | **Gap:** `next_monitoring_required` NOT in CONDITION_TYPE_MAP_ — follow-up date not written from EOJ |
| Job complete / ready to task out | ✅ field_work_complete | ✅ conditionOutput | ❌ NOT in CONDITION_TYPE_MAP_ | Nowhere | **GAP** |

---

## 4. Gaps Summary

### Major Gaps (critical missing signals)

**G1 — MICA / Mitigate not interpreted**  
`MICA_Status`, `MICA_Delay_Reason`, `MICA_Expected_Update_Date` are in the 46-column EOJ_Log but are explicitly not interpreted by `EOJInterpreter.interpretBasicEOJ_()`. Nothing flows to Claims DB. No dashboard visibility into Mitigate status whatsoever.

**G2 — Job_Status not written to Claims DB**  
`Job_Status` is captured in EOJ_Log and visible in the EOJ Admin view, but ClaimsBridge only updates `Last_EOJ_At`, `Last_Meaningful_Activity_At`, and `Updated_At` on the Claims row. The current job status from the last EOJ never persists as a Claims signal.

**G3 — field_work_complete not in CONDITION_TYPE_MAP_**  
`conditionOutput` builds `field_work_complete` but it is absent from `CONDITION_TYPE_MAP_` in ClaimsBridge. "Job complete / ready to task out" never creates a condition in the Claims Database.

**G4 — next_monitoring_required not in CONDITION_TYPE_MAP_**  
Monitoring's follow-up date comes from the EOJ but never reaches the Claim_Conditions `Follow_Up_Date` column via this path. The health engine relies on `Follow_Up_Date` to suppress "At Risk" for monitoring claims. If the follow-up date is only set manually, monitoring health will incorrectly show At Risk.

**G5 — Is_Temp_Job not interpreted**  
Temp job flag captured but never reaches Claims DB. No way to distinguish temp job claims on the dashboard.

**G6 — Todoist task ID not written back**  
When `createEojTodoistTask()` succeeds, the task ID is returned but not written to EOJ_Log or Claims DB. No dashboard confirmation that a task was created. No link from claim to Todoist item.

**G7 — Missing asbestos condition progression**  
Only `asbestos_testing_pending` maps to "Asbestos Testing Pending" in CONDITION_TYPE_MAP_. The downstream states that the Health Engine evaluates — "Waiting on Lab Results", "Positive Asbestos Result", "Abatement Required" — are architecture-book conditions but are NOT written from EOJ processing. They must be set manually.

### Minor Gaps

**G8 — Last EOJ Technician / Visit Type not on Claims row**  
These fields exist in Timeline_Events but are not columns on the Claims sheet. Claims Workspace list view cannot show "last technician" or "last visit type" without a sheet column to sort/filter by.

**G9 — No Claim_Summaries write from EOJ**  
ClaimsBridge never writes to `Claim_Summaries`. The summary of what a technician did on a visit (Work_Summary, For_Insurance_Summary) is only in Timeline_Events detail JSON, not a surfaced summary field.

**G10 — Google Chat / Todoist confirmation not written back**  
Google Chat post status and Todoist task creation are fire-and-forget with no writeback. Minor operationally but means no audit trail in Rainbow.

---

## 5. Recommended Dashboard Sections

### Homepage (no new sections needed — surface existing data better)
The homepage architecture is already correct per the architecture book. The EOJ signals that should appear here already flow through the conditions/alerts/health/recentActivity data model. The gaps to fix are upstream (G1–G7), not in the homepage rendering itself.

**One addition worth noting:** the `todaySchedule` slot on the homepage calls `getHomepageTodaySchedule_()` using calendar data. EOJ-indicated next monitoring visits do not feed this automatically — they would need to be on the Google Calendar.

### Claims Workspace — recommend no new lenses beyond what exists
The six lenses (all, needsAttention, waitingOnInsurance, missingEoj, paidMonitoring, closed) cover the architecture book's spec. Once G3 (field_work_complete) is fixed, "paidMonitoring" and "missingEoj" lenses will be more accurate.

### Claim Detail — recommend an EOJ Summary Rail section (future)
The claim detail currently shows EOJ data only in the timeline events list. A dedicated "Last EOJ Summary" section in the right rail would surface:
- Last visit date, technician, visit type
- Last job status
- Current MICA / Mitigate status
- Equipment currently on site
- Monitoring status + next monitoring date

This requires fixing G1, G2, G4, G8 first.

### EOJ Admin — no changes needed
The existing view is clean and functional: 50 most recent EOJs, retry button, Raw_JSON viewer.

---

## 6. Quick Wins (small code changes, high impact)

**QW1 — Add `Job_Status` to ClaimsBridge Claims row update**  
In `ClaimsBridge.js`, add `Job_Status` to the object passed to `updateClaim()`. It's already in the EOJ row. One line change. Immediately surfaces current job status in Claim Detail's `fullClaimCurrentState` and workspace.

**QW2 — Add `field_work_complete` and `next_monitoring_required` to CONDITION_TYPE_MAP_**  
`CONDITION_TYPE_MAP_` in ClaimsBridge currently has 2 entries. Adding:
```js
field_work_complete: 'Field Work Complete',
next_monitoring_required: 'Next Monitoring Required'
```
would allow "Job complete" to create a condition and monitoring's follow-up date to populate `Follow_Up_Date`, fixing the health engine's monitoring suppression.

**QW3 — Add `Last_EOJ_Technician` and `Last_EOJ_Visit_Type` to Claims row update in ClaimsBridge**  
One additional field per EOJ. Makes technician and visit type available on the Claims Workspace list view and filterable. No new columns required if these are already in the Claims sheet schema — worth checking.

**QW4 — Write Todoist task ID back to EOJ_Log**  
`TodoistService.createEojTodoistTask()` already receives the response. Write the returned task ID (or URL) into the `EOJ_Log` row's `Processing_Notes` or a dedicated `Todoist_Task_ID` column. No API change needed; just a write after the existing API call.

**QW5 — Verify Timeline_Events `Event_Type` values**  
Confirm ClaimsBridge is writing `Event_Type = 'EOJ Submitted'` or `'EOJ Processed'` (exact strings) so Homepage `recentActivity` correctly includes EOJ events. If it writes a different string (e.g., `'EOJ'` or `'Field Visit'`), the homepage Recent Activity feed silently excludes all EOJ events.

---

## 7. Larger Items for Technician Workspace (future)

Per architecture-book section 15, the canonical EOJ build sequence is:
1. EOJ App ✅
2. EOJ Processing Engine ✅
3. Claim integration / timeline / health ✅ (mostly — gaps above)
4. **Future EOJ Workspace** — not built yet

Items that belong in the Technician Workspace (not immediate):

**TW1 — Equipment on Site tracker**  
A persistent `Claim_Equipment` sheet that the Processing Engine updates on each EOJ (not just appends to Timeline). Would allow a real "equipment currently on site" view per claim without re-scanning EOJ_Log.

**TW2 — MICA / Mitigate workflow integration**  
Once MICA fields are interpreted (fixing G1), a Mitigate status condition could drive a dashboard card: "Mitigation plan update needed," "Mitigate delayed until [date]." Likely a condition type in Claim_Conditions with a Follow_Up_Date set to MICA_Expected_Update_Date.

**TW3 — Technician-facing visit summary view**  
Architecture book says technicians access EOJ App and Google Space only. A lightweight read-only view in the EOJ App showing a claim's last 3–5 timeline events would close the loop for techs without giving them full Rainbow access.

**TW4 — Mitigation plan update workflow**  
`mitigationPlanSummary` and `Mitigation_Plan_Updated` are captured but uninterpreted. Once flowing, a "Mitigation Plan Updated" timeline event type would give Julia visibility into mitigation progress without a tech phone call.

**TW5 — Asbestos condition progression from EOJ**  
Currently "Positive Asbestos Result" and "Abatement Required" are set manually. If lab results or abatement flags could be captured in a future EOJ field and interpreted, those conditions could flow automatically.

---

## 8. Key Architecture Facts (for implementation reference)

- **CONDITION_TYPE_MAP_** is in `eoj-processing-engine/ClaimsBridge.js` — currently only 2 entries
- **Claims DB** ID: `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`  
  Sheets: Claims, Timeline_Events, Claim_Conditions, Claim_Alerts, Claim_Service_Log, Claim_Summaries, External_Links
- **EOJ DB** ID: `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs`  
  Sheet: EOJ_Log (46 columns)
- **ClaimsBridge** does NOT call `claims-service` — it writes directly to the Claims DB spreadsheet via `SpreadsheetApp`
- **claims-service** `EojIntegrationService.js` (`processEojOutputs`) is designed to accept eoj-processing-engine outputs, but ClaimsBridge currently bypasses it and writes directly. Both exist as integration paths.
- **Health Engine** reads `Claim_Conditions.Follow_Up_Date` per condition to determine suppression. Without this date, any open condition pushes claims to At Risk.
- **MICA vs. Mitigate:** Internal code uses "MICA" (field IDs, column names, JS variables). User-facing strings say "Mitigate." Do not rename internal field names.
- **Technicians:** Blake, Tyler, Cooper, Patricia, Clarence, Joe. Todoist assignee resolved by name (Julia or Clarence).
- **eoj-app and eoj-processing-engine both need `clasp push` + eoj-app redeployment** before any code changes from prior sessions go live.

---

*Diagnostic complete. No code was modified during this investigation.*
