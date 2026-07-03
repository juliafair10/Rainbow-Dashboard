# Rainbow Platform — Architecture Audit Scratch Notes
Generated 2026-07-03. Working notes only; final report is ARCHITECTURE_AUDIT_2026-07-03.md.
Read-only audit. No source files created/moved/deleted.

---
## 0. INVENTORY

### Repo shape
- Root: `/Users/JuliaFair/Rainbow-Dashboard/`
- 104 .js, 46 .json, 37 .html, 22 .md, 2 .gs, 6 .bak* files.
- ~19 Apps Script projects under `apps-script-projects/` (brief named 5 as priority).
- `backups/apps-script-projects-initial-backup/` = 23 files (duplicate old copies).
- Brief's `docs/{architecture,build-guides,phases,diagnostics,operational-debt}` subfolders DO NOT EXIST. docs/ is flat files. Creating docs/diagnostics/ for the report per instructions.

### Priority project line counts (js+gs+html)
- automation-dashboard: 23,904 lines. Biggest: Code.js 4076, Index.html 3585, ClaimsScripts.html 2870, HomepageDataService.js 2716.
- claims-service: 25,615 lines. Biggest: ClaimDetailService.js 3199, HealthEngineService.js 2385, ReportImportService.js 1811, AlertService.js 1742, ConditionEngineService.js 1691.
- eoj-app: 3,396 lines. Client.html 1186, Styles.html 826, Code.js 752, Index.html 456.
- eoj-processing-engine: 2,531 lines. ClaimsBridge.js 659, EOJInterpreter.js 560, EOJReader.js 352.
- insurance-intake-automation: 6,534 lines. FolderMatching.js 1364, Code.js 1076, AttachmentPipeline.js 851.
- TOTAL priority: ~61,980 lines.

### EMPTY files (Could Not Verify contents — 0 lines)
- automation-dashboard/HomepageClient.html (0)
- automation-dashboard/HomepageComponents.html (0)

### Shared spreadsheet IDs (the coupling backbone)
- `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c` = CLAIMS DATABASE (also CLAIM_FOUNDATION). Referenced by claims-service (Config), eoj-app (CLAIMS_DATABASE_ID). 6 hits.
- `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs` = EOJ SOURCE / EOJ_DATABASE. claims-service, eoj-app, eoj-processing-engine. 4 hits.
- `1GmsWkh8x_ICVEWNFP_WgT-hN6hQDSI_WF16J9T_R-NE` = EOJ OUTPUT. claims-service, eoj-processing-engine. 2 hits.
- Config locations: claims-service/Config.js:6-19; eoj-app/Config.js:2-3; eoj-processing-engine/Config.js:2-3.
- NOTE: same spreadsheet IDs hardcoded in multiple projects' Config = duplicated source of truth, no single owner.

---
## 1. HOT-SPOT GREP MANIFEST (5 priority projects)

### Counts
| pattern | count |
|---|---|
| SpreadsheetApp.openById | 84 |
| getDataRange | 78 |
| getValues | 118 |
| getRange | 101 |
| getSheetByName | 104 |
| CacheService | 3 (!!) |
| PropertiesService | 22 |
| google.script.run | 28 |
| JSON.stringify | 325 |
| JSON.parse | 28 |
| .map( | 341 |
| .forEach( | 413 |
| .filter( | 268 |
| .sort( | 61 |
| .find( | 33 |
| getLastRow | 41 |

### openById by file (top)
- eoj-app/Code.js: 11
- claims-service/ReportImportService.js: 10
- claims-service/HistoricalNotesImportService.js: 6
- claims-service/TimelineService.js: 5
- insurance-intake-automation/FolderMatching.js: 4; eoj-processing-engine/EOJReader.js: 4
- claims-service/{TimelineEngineService,ExternalLinkService,ClaimsQueryService,ClaimDetailService}: 3 each
- automation-dashboard/{HomepageDataService,EojAdminService}: 3 each
- insurance-intake-automation/Code.js: 3

### getDataRange by file (top)
- claims-service/ReportImportService.js: 10
- eoj-app/Code.js: 8; claims-service/ExternalLinkService.js: 8
- claims-service/TimelineService.js: 5
- eoj-processing-engine/EOJReader.js: 4; claims-service/{HistoricalNotesImportService,ClaimsQueryService,ClaimDetailService}: 4 each

### CacheService — ALL THREE USES (entire codebase)
- claims-service/ClaimDetailService.js:1173
- claims-service/ClaimDetailService.js:1825
- claims-service/ClaimDetailService.js:1878
=> Caching exists in exactly ONE file. No cache anywhere else. This is the single biggest performance finding.

### PropertiesService by file
- automation-dashboard/Code.js: 10; insurance-intake-automation/Code.js: 2; eoj-processing-engine/SetupProperties.js: 2; automation-dashboard/IntakeAuditService.js: 2; others 1 each.

### Tech-debt artifacts
- 6 × ReportImportService.js.bak* in claims-service (17k–21k bytes each) = ~117KB dead backups checked into repo.
- backups/apps-script-projects-initial-backup/ = 23 stale files.
- eoj-processing-engine/LegacyCleanup.js (225 lines) — name implies dead-code removal utility.

---
## PER-PROJECT FINDINGS (appended as read)

### claims-service (READ IN PROGRESS)

**Config.js**
- Lines 6-7: CLAIM_FOUNDATION_SPREADSHEET_ID and CLAIMS_DATABASE_SPREADSHEET_ID are the SAME id (1LWU…). Two names, one sheet.
- Lines 16-19: EOJ source/output IDs duplicated from eoj-processing-engine/Config.js + eoj-app/Config.js. Comment admits "these mirror" — no single source of truth.
- Lines 53-64: CLAIM_SHEET_NAMES — 10 sheets in the claims DB (Claims, Timeline_Events, Claim_Conditions, Claim_Alerts, Alert_Rules, Claim_Ownership_History, Financial_Tracks, External_Links, Claim_Health_History, Claim_Service_Log).
- Lines 203-236: SCHEMA DRIFT documented in-code. Two overlapping health column sets ("Health Status"/"Health Reason"/"Last Updated" legacy space-headers that ARE read+written, vs "Operational_Health"/"Health_Updated_At"/"Updated_At" that are dual-written but "not read by anything yet"). Newer columns added to schema without updating write path. TECH DEBT / correctness risk.
- setupClaimFoundationSheets (298) is a migration/setup fn living in Config.js — config file doing DDL.

**Code.js** (router / entry points)
- Router switch is clean-ish (action dispatch). BUT contains migration fns (migrateClaimTimelinePhase5Columns:12) and test fns (testClaimsWorkspacePageRouting:233, testClaimDetailRoute:269, testListAllSheets:312) mixed into the entry-point file. "Entry points only" comment (line 5) is violated.
- Note: migrateClaimTimelinePhase5Columns targets sheet 'Claim_Timeline' (line 14) but Config declares 'Timeline_Events' — possible stale sheet name / dead migration. FLAG.

**SheetService.js** (low-level DB helpers) — PERF CORE
- getRows(45): openById + getDataRange full scan every call; also calls getHeaders() which does ITS OWN openById+read → 2 opens per getRows.
- findRows(76): calls getRows (full scan) then in-memory filter. O(n) lookup, no index. Every point-lookup = full sheet read.
- updateRowByKey(91): full getValues scan to find one row, linear search. O(n) write.
- ensureSheetColumns_(211): calls getHeaders() INSIDE forEach (line 212) → re-reads header row once per required column. N header-reads per migration.
- No caching anywhere in this file.

**ClaimsQueryService.js** — THE BASE READ (hot path root)
- getAllClaimSummaries(1): reads 3 FULL sheets every call — Claims (getDataRange:5), Conditions (getActiveConditionsByClaim_:149), Alerts (getActiveAlertsByClaim_:248). No cache. This is called by EVERY workspace/list/drawer path.
- getClaimsDatabaseSheet_ / getConditionsSheet_ / getAlertsSheet_ each do their OWN openById (43, 218, 347) → 3 separate spreadsheet opens for one summary build.
- pick_(418): linear scan over a candidate-key array PER FIELD; normalizeClaimRow_ calls pick_ ~30×/row (drift tolerance tax). O(fields × candidates × rows).
- getConditionsSheet_/getAlertsSheet_ try 3-5 candidate sheet names each (fallback probing) — schema-uncertainty smell.
- Heavy test/debug fns baked into prod file (testClaimsQueryRafiLastActivity:438 w/ hardcoded claim IDs; testMissingFromOpenJobsClaimDetails:499 w/ 9 hardcoded IDs).

**ClaimsWorkspaceService.js** — READ AMPLIFICATION
- getClaimsWorkspace(28): calls getClaimsList (1 full 3-sheet read via lens) THEN getClaimsLensCounts (ANOTHER full 3-sheet read). = 2× full base reads minimum per workspace open, i.e. 6 getDataRange scans.
- enrichClaimWorkspaceSummary_(204) runs per claim: builds openRequirements/nextAction/attentionReason/operationalAlerts each render — pure recompute, never cached.
- Duplicate helper logic: getHighestClaimAlertSeverity_(380) and getClaimsWorkspaceActivityAge_(142) both have inline fallback copies of logic that "delegates to canonical" ClaimFoundationService fns — 2 implementations each, guarded by typeof checks (hidden coupling + dead-ish fallback).

**ClaimsLensService.js**
- getClaimsForLens(3): getAllClaimSummaries (full read) + switch to ONE filter.
- getClaimsLensCounts(46): getAllClaimSummaries AGAIN (full read) then runs ALL 6 filters over the array (filterNeedsAttention_, filterWaitingOnInsurance_, filterMissingEoj_, filterPaidMonitoring_, filterClosedClaims_). So workspace open = base read (list) + base read (counts) with 6 array re-scans. Counts could be derived from the single list read but aren't.
- containsAnyInList_ / getClaimsLensSignalText_ (256-289): builds a joined string of ~18 candidate fields per item, per phrase check — repeated string alloc in hot filter loops.

**ClaimDrawerService.js** — "lightweight" but heavy
- getClaimDrawer(8): calls getClaimSummaryById_ which does getAllClaimSummaries({}) — FULL 3-sheet read to fetch ONE claim (line 140). Plus getClaimExternalLinks + getClaimFinancialTracks + getClaimWorkspaceSummary_ (own openById:82) + buildRecommendedDrawerActions_ which calls getClaimExternalLinks AGAIN (line 157, duplicate of line 14). So drawer = 1 full base read + 2× external-link reads + financial read + summary read for a single-claim preview. Header comment says "Lightweight claim preview payload" — contradicted.
- recentTimelineEvents:[], upcomingCalendarEvents:[], latestEojSignal:null, revisionSummary:null, monitoringSummary:null — payload ships permanently-empty placeholder fields (dead payload weight / unfinished).

**ClaimDetailService.js (3199 lines — THE monolith)**
- getClaimDetail(8): the full-claim orchestrator. Self-instrumented with markDetailTiming_ (17) and logs CLAIM_DETAIL_SLOW when totalMs>1000 (171). Authors KNOW it's slow.
- REDUNDANT READS: calls getClaimDrawer (25) [=full base read + links + financials + summary], THEN re-fetches getClaimExternalLinks (29) and getClaimFinancialTracks (33) that the drawer ALREADY fetched, THEN enrichClaimWorkspaceSummary_ AGAIN (45) on drawer.claimSummary (drawer already enriched? no—drawer returns raw claimSummary, but external links now read 2×/detail and financials 2×/detail).
- Model-build cascade over same data: buildClaimFoundation_ (126) → buildFullClaimHeaderModel_ (132) → buildFullClaimOperationalSummaryModel_ (133) → buildFullClaimCurrentStateModel_ (134) → buildOperationalIntelligence_ (141) → buildWorkspaceContext_ (147). Six sequential model passes, each re-deriving lifecycle/health/ownership/conditions with `claimFoundation.X ? ... : fallbackFn(detail)` pattern (see 222-266) — every field has a foundation-read AND an inline fallback recompute.
- GOOD PATTERN: eojReports deferred from initial payload (156, eojReportsDeferred:true), lazy-loaded via getClaimEojReports(178). Keep this.
- CACHING (the ONLY 3 caches in the codebase, all here):
  - getWorkspaceTimelineForClaim_(1171): script cache 300s per claim (1165). Two-tier: getTimelineForClaim() then direct openById+getDataRange FULL Timeline_Events scan + in-memory claimId filter (1208-1257). Fallback path re-scans whole timeline sheet.
  - getCachedEojSheetValues_(1819): caches whole EOJ sheet values 300s (1847). Cross-project read into EOJ source/output spreadsheets.
  - getEojSheetRowsForClaim_(1871): caches per-claim EOJ rows 300s (1918). Full getDataRange scan on miss (1889).
- getFullClaim* helpers use getFullClaimFirstValue_ candidate-array scanning EVERYWHERE (getFullClaimTimelineEventType_/Source_/Actor_ etc, 1123-1161) — same drift-tolerance pattern as pick_, dozens of per-event calls.
- EOJ event detection isWorkspaceTimelineEojEvent_(1307): builds combined string + checks a 16-entry eojEventTypes array (1328) per event — O(events) string work in display collapse.
- Cross-project openById appears here (1209 claims DB, plus openEojProcessingOutputSpreadsheet_/openEojSourceSpreadsheet_ at 1783/1793) — claims-service reaches directly into EOJ spreadsheets (tight cross-project data coupling, not via an API).

**Large engine files (characterized):**
- HealthEngineService.js (2385): batch health engine. evaluateClaimHealth(20)/applyClaimHealth(73). Dual-writes legacy "Health Status/Reason/Last Updated" (canonical, read) + "Operational_Health/Health_Updated_At/Updated_At" (compat, unread) — 90-112. Confirms Config drift note. Runs in morning batch (batchApplyClaimHealth).
- ConditionEngineService.js (1691): evaluateClaimConditions(25)/reconcileClaimConditions(52). Calls synthesizeClaimActivities per claim. Deterministic. Morning batch.
- AlertService.js (1742): addAlert/resolveAlert/dismiss + Alert_Rules governance. Manages Claim_Alerts + Alert_Rules sheets.
- TimelineEngineService.js (1150): classifies stored timeline events (Phase 5).
- ReportImportService.js (1811): daily-open-jobs + report import. 10 openById + 10 getDataRange (highest in repo). Has 6 .bak* siblings.
- ClaimFoundationService.js (527) + OperationalIntelligenceService.js (551): **DESIGN STRENGTH** — both explicitly in-memory composition layers, "does not re-fetch" (Foundation:7; OI:7-8,21-32 lists skipped engines to avoid per-request Sheets calls). Intent is right; the base-read layer feeding them is the problem.

**DUPLICATE / OVERLAPPING SERVICE PAIRS (boundary smell):**
- ConditionService.js (426) vs ConditionEngineService.js (1691)
- OwnershipService.js (160) vs OwnershipEngineService.js (235)
- FinancialTrackService.js (339) vs ClaimFinancialTrackService.js (85)
- ExternalLinkService.js (1012) vs ClaimExternalLinkService.js (304)
- ReportEmailIntakeService.js + ReportImportService.js + HistoricalNotesImportService.js (import overlap; also duplicated in claims-data-foundation project)
- TIMELINE FAMILY = 7 files, 3570 lines: TimelineService(758), TimelineEngineService(1150), TimelineSynthesisService(730), TimelineIntelligenceService(144), TimelineRulesService(319), TimelineMaintenanceService(226), TimelineImportHelpers(243). synthesizeClaimActivities (TimelineSynthesisService:9) is a per-claim activity rebuild called by Condition/Lifecycle engines — recomputed each eval.

**MorningAutomationService.js (407)** — batch orchestrator, single 6AM trigger.
- runRainbowMorningAutomation = thin wrapper → runMorningDataRefresh (Phase1: intake XLSX, import open jobs, reconcile removed, compliance, historical notes, synchronizeClaimsFoundation) → runMorningIntelligence (Phase2: rebuildTimelineDerivedFields, batchReconcileClaimConditions, batchApplyClaimHealth) → runMorningBrief (Phase3: refreshHomepageData).
- KEY INSIGHT: health/conditions ARE precomputed nightly into the Claims sheet by this batch. So the read path SHOULD read precomputed columns only — but ClaimDetail/Workspace recompute + re-read live anyway. The precompute exists; the read path doesn't trust/use it fully.
- .bak note: refactor was 2026-07-01, recent.

**Router (Code.js) exposed actions** (the claims-service API surface): healthCheck, homepageClaimSummary, getClaimsWorkspace, getClaimsList, getClaimDrawer, getClaimDetail, lookupClaim, createClaim, updateClaim, appendTimelineEvent, createClaimActivityEvent, upsertCondition, resolveCondition, createAlert, resolveAlert, dismissAlert, dismissAlertsByClaimAndType, createFinancialTrack, updateFinancialTrack, attachExternalLink, processEojOutputs, diagnoseClaimHealth.

**ClaimsOperationalAwarenessService.js (846)** + **ClaimsStreamService.js (185)** + **ClaimsDatabaseSyncService.js (261)**: stream = grouping for workspace; awareness = workspace-level intel; dbSync = pushes claims foundation → a denormalized sheet.

---
### eoj-app (READ)
- Technician-facing PWA (doGet serves Index + PWA manifest, lines 1-29). Single-user-ish, low frequency.
- WRITE path: submitEOJ(239) → validateBasicEOJ(258) → appendEOJRecord (SheetService) into EOJ_Log (canonical 50-col spec EOJ_LOG_COLUMNS_:289). Clean.
- READ path (Lookup tab), 4 fns each doing FULL getDataRange scans + in-memory backward-walk:
  - getJobsForLookup(65): opens Claims (CLAIMS_DATABASE_ID) full scan + opens EOJ_Log full scan to build lastEojMap, joins in memory, sorts. 2 full cross-spreadsheet reads per lookup-tab load.
  - getEquipmentForJob(564), getJobSummaryForLookup(614), getRecentEOJsForJob(705): each re-opens EOJ_Log (and Claims) full getDataRange, walks backward for latest match.
- THIRD reimplementation of drift-tolerant field picking: pickJobField_(49)/resolveHeader_(58) mirror claims-service pick_ and processing-engine header logic. No shared lib.
- Reaches directly into shared Claims DB (CONFIG.CLAIMS_DATABASE_ID = 1LWU…) — cross-project read coupling.
- Test/diagnostic bloat in prod file: testGetJobsForLookup(152), debugEquipmentColumns(443), diagnosticWriteEOJRow(489). Plus DDL: setupEOJLogSheet(371), repairEOJLogColumns(399).
- Config.js only 12 lines (EOJ_DATABASE_ID + CLAIMS_DATABASE_ID hardcoded).

### eoj-processing-engine (READ) — THE CROSS-PROJECT WRITER (highest-risk seam)
- Time trigger: processUnprocessedEOJs every 15 min (Code.js:6-19).
- processUnprocessedEOJs(41): reads unprocessed EOJ_Log rows → parse → interpret → writeProcessingOutput_ → writeEojToClaimsDatabase_ (ClaimsBridge) → Todoist → Google Chat → mark processed. Per-row loop.
- **ClaimsBridge.js writes DIRECTLY into claims-service's owned sheets** (Timeline_Events, Claim_Conditions, Claim_Alerts, Claims, Claim_Service_Log). Hardcodes CLAIMS_DB_ID_ = '1LWU…' (line 38) — a SEPARATE 4th copy of the claims DB id, with its OWN CLAIMS_SHEETS_ map (40-46) and OWN CONDITION_TYPE_MAP_ (53). Two projects, two codebases, one set of sheets.
- writeEojToClaimsDatabase_ is NON-FATAL (Code.js:64-69 swallows bridgeErr). EOJ→claim propagation can SILENTLY FAIL — a claim's timeline/conditions may never get the EOJ with no error surfaced to anyone. CORRECTNESS/OBSERVABILITY risk.
- getOpenConditionTypes_ reads conditions per claim to dedupe (line 111) — per-row sheet read inside the 15-min batch loop (N reads for N unprocessed rows).
- Bridge duplicates header-mapping helpers (claimsHeaderIndex_, appendByHeaderMap_) that claims-service already has in SheetService — 2nd/3rd copy of the same write primitive.
- Other files: EOJInterpreter(560), EOJReader(352, 4 openById/4 getDataRange), ProcessingWriter(55), StatusUpdater(78), TodoistService(228), GoogleChatNotifier(106), RawJsonParser(16), LegacyCleanup(225=DEAD-CODE UTILITY), SetupProperties(47), TestRunner(24).

### insurance-intake-automation (READ) — Gmail→Drive→Todoist→Calendar batch pipeline
- doGet(28): action-router with ~21 actions. INCLUDES backward-compat ALIASES: processEmsl→processAsbestos (56), cleanupEmslLabels (60) — "Temporary backward-compatible aliases" (55). Tech debt.
- processInsuranceIntake(186): GmailApp.search bounded by CONFIG.maxThreadsPerRun (207) → per-thread loop with try/catch, parse → detect attachments → dedupe (claimFolderMapHasDuplicate_) → checkOrCreateClaimFolder_ → labels. Well-structured for a batch. Perf profile = Gmail/Drive API calls, NOT sheet scans.
- checkOrCreateClaimFolder_(FolderMatching.js:103): uses Drive getFoldersByName (159) — targeted Drive lookup, not a scan. Good.
- CROSS-PROJECT WRITE: Code.js:851,923 write to 'External_Links' sheet in the CLAIMS DB (adds carrier platform links to claims-service's owned sheet). Another project writing claims sheets.
- Uses own claimFolderMapSpreadsheetId (separate sheet) for dedupe map. 5 openById in FolderMatching, all the folder map.
- FolderMatching.js is 1364 lines — largest single file in intake; folder resolution + fuzzy matching. Candidate for God-file review.
- Same drift-tolerant reimplementation: findHeaderIndex_ (own copy).
- Files: AttachmentPipeline(851), FolderMatching(1364), RetryWorkflow(643), Parsing(461), VendorAsbestos(446), VendorItel(422), Todoist(412), CalendarDrafts(291), QueueHealth(242), PendingClaimInspection(132), GmailLabels(80), Config(114).
- RetryWorkflow(643) + QueueHealth(242) + PendingClaimInspection(132) = operational resilience layer (good).

### automation-dashboard (READ) — UI host + PARALLEL claims read stack
- Code.js (4076): DASHBOARD_CONFIG (1) registers each automation with a hardcoded webAppUrl (12,21,30,...). Dashboard calls satellite web apps over HTTP (UrlFetch) — distributed multi-deployment topology. All satellites share ONE deployment URL (AKfycbwshK... reused 8×) except folder+calendar.
- **HomepageDataService.js (2716): COMPLETE PARALLEL REIMPLEMENTATION of the claims read layer.** getHomepageClaimSummaryData(14) reads 6 sheets directly (Claims/Timeline_Events/Claim_Conditions/Claim_Alerts/Compliance_Actions/Claim_Summaries, lines 15-20) via getHomepageSheetRows_(321) — its OWN openById on HOMEPAGE_CLAIM_FOUNDATION_SPREADSHEET_ID (322, = the SAME 1LWU claims DB, 5th reference) — with its OWN normalizers (normalizeHomepageClaim_ etc.) and OWN drift-tolerant getHomepageValue_(384) candidate picking + findHomepageHeaderRowIndex_(354).
- Homepage does NOT call claims-service.getHomepageClaimSummary. It bypasses the service entirely and re-reads/re-normalizes the same sheets. This is duplicate data-access + duplicate business logic across two deployments over the SAME database.
- HomepageApi.js: getHomepageSummary→V2 (thin). HomepageService.js has getHomepageServiceSummaryLegacy_ (LEGACY in name, line 1) still wired in (called at 64).
- Homepage builds a LARGE payload in one shot (getHomepageClaimSummaryData returns kpis, claimSummaryMetrics, todayPriorities, todaySchedule, becomingStale, recentActivity, recentClaimSummaries, operationalAlerts, ownershipVisibility, conditionsVisibility, complianceVisibility — lines 63-92). No pagination/lazy-load; whole homepage computed server-side per load from full sheet scans.
- Client bridge = google.script.run (28 hits across HTML script includes). Standard Apps Script UI RPC.
- EMPTY FILES CONFIRMED: HomepageClient.html (0), HomepageComponents.html (0) — dead/placeholder includes.
- Big HTML: Index.html(3585 — appears to be a full monolithic SPA), ClaimsScripts.html(2870), ClaimsStyles.html(1783), ClaimViewStyles.html(1482), HomepageScripts/Styles(~1050 each). Heavy client bundles inlined.
- Also hosts: ClaimActionsService(180), EojAdminService(181), IntakeAuditService(185) — dashboard-side service shims.

### NON-PRIORITY projects (scanned for debt/duplication)
- claims-data-foundation: DUPLICATES claims-service import services (ComplianceTasksImportService, DailyNotesImportService, HistoricalNotesImportService, ReportEmailIntakeService, TimelineIntelligenceService, ClaimSummaryService, ValidationService, Config). Looks like an EARLIER/parallel copy of the claims foundation. Likely superseded by claims-service. VERIFY overlap.
- historical-notes-sync: HistoricalNotesSync_v2.gs — "_v2" name; single-purpose sync, possibly superseded by claims-service/HistoricalNotesImportService.
- revision-intake-automation: Code.gs + eoj-intake-mockup.html (a MOCKUP in a deployed project).
- apps-script-dashboard + automation-dashboard(backup) + test-dashboard: THREE dashboard variants. test-dashboard likely dead.
- eoj-builder, add-new-job-to-calendar, new-jobs, rbw-utils, certificate of completion, emergency-service-agreement, emergency service agreement (dup dir w/ space): small utility projects. "emergency service agreement" (space) vs "emergency-service-agreement" (hyphen) = duplicate dir.
- backups/apps-script-projects-initial-backup/ = 23 files, stale initial snapshots.
- 6× ReportImportService.js.bak* in claims-service (~117KB dead).

