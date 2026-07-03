# Rainbow Platform — Architectural Diagnostic Brief
### Read-only architecture, performance, maintainability & scalability assessment
**Date:** 2026-07-03  **Reviewer role:** Lead Software Architect (sign-off review)  **Scope:** Full repository, 5 priority Apps Script projects read line-by-line, remainder scanned.

> This is a diagnostic. Nothing was rewritten, refactored, optimized, moved, or deleted. The only files created are this report and the working notes at `docs/diagnostics/_audit_scratch.md`. Every finding cites a real file path and line number that was opened and read. Items that could not be verified are listed explicitly in the *Could Not Verify* section.

---

## Executive summary

Rainbow is a **Google Apps Script platform** — roughly **19 script projects** (5 are the operational core), ~62,000 lines across the five priority projects, backed by a small number of Google Sheets that act as the database. The centre of gravity is a single spreadsheet, the **Claims Database** (`1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`), which **six separate projects open and read/write directly** by hardcoded ID.

The system works and shows real engineering maturity in places: a nightly batch that precomputes health/conditions, an explicit in-memory *composition* layer (`ClaimFoundationService`, `OperationalIntelligenceService`) built specifically to avoid re-reading sheets, deferred lazy-loading of EOJ reports, self-timing instrumentation on the slow path, and a genuine operational-resilience layer (queue-health, retry, pending-folder inspection) around the intake pipelines.

But the architecture has three structural problems that will define its next 18 months:

1. **No shared data-access layer.** "Read every claim sheet and normalize it with drift-tolerant field-picking" is reimplemented **at least five times** — in `claims-service/ClaimsQueryService.js`, `claims-service/SheetService.js`, `automation-dashboard/HomepageDataService.js`, `eoj-app/Code.js`, and `eoj-processing-engine`. Each copy opens the spreadsheet itself and scans the full sheet.
2. **Almost no caching, and heavy read amplification.** `CacheService` is used in exactly **three places in the entire codebase** — all in one file (`ClaimDetailService.js`). Opening the Claims Workspace reads the Claims + Conditions + Alerts sheets **in full at least twice** (~6 `getDataRange` scans); the "lightweight" claim drawer does a full all-claims scan to fetch **one** claim.
3. **Tight cross-project write coupling to a schema nobody owns.** `eoj-processing-engine/ClaimsBridge.js` and `insurance-intake-automation` write **directly into claims-service's sheets** (Timeline_Events, Claim_Conditions, Claim_Alerts, Claims, External_Links) using their own private copies of the DB ID and the column maps. These writes are "non-fatal" and swallow errors, so cross-system propagation can fail silently.

None of this is on fire today because the data is small (dozens–low-hundreds of claims, one office user, a handful of technicians). Every one of these problems is a **scale problem**, and the scale assumptions in the brief (10,000 claims, 500,000 timeline events, 100 users) break the read path first.

**Overall grade: C+ (functional, thoughtfully built in parts, not yet ready for 10× scale).** The good news: the two biggest wins (a cached read layer and consolidating the duplicate read stacks) are high-impact and comparatively low-risk because the batch-precompute and composition-layer scaffolding the authors need is *already there*.

---

## Part 1 — Project / Dependency Map

### 1.1 The runtime topology

Rainbow is not one app; it is a constellation of independently-deployed Apps Script web apps plus time-triggered batch scripts, all talking to shared Google Sheets. The office **Automation Dashboard** is the hub and calls the satellites over HTTP (`webAppUrl` entries hardcoded in `automation-dashboard/Code.js:12,21,30,39,48,…`).

```
                         ┌─────────────────────────────┐
   Technician (mobile)   │      Automation Dashboard    │   Office user (Julia)
        │                │  (UI host + its OWN homepage  │        │
        ▼                │   read stack; hub via UrlFetch)│◄──────┘  google.script.run
   ┌──────────┐          └──────┬───────────────┬────────┘
   │ eoj-app  │  writes          │ HTTP (UrlFetch)│ reads (direct sheet + claims-service)
   │ (PWA)    │────► EOJ_Log ◄───┼───┐            │
   └──────────┘   (10ja… sheet)  │   │            ▼
                                 │   │      ┌───────────────────────────┐
   every 15 min ▼                │   │      │      claims-service        │
   ┌────────────────────┐        │   │      │  (getClaimDetail /          │
   │ eoj-processing-     │ writes │   │      │   getClaimsWorkspace /      │
   │ engine / ClaimsBridge│───────┼───┼─────►│   Homepage summary, engines)│
   └────────────────────┘  DIRECT │   │      └───────────┬───────────────┘
                            into   │   │                  │ read/write
   ┌────────────────────┐  claims  │   │                  ▼
   │ insurance-intake-  │  sheets  │   │      ┌───────────────────────────┐
   │ automation         │──────────┘   └─────►│   CLAIMS DATABASE (1LWU…)   │
   │ (Gmail→Drive→Todoist)  writes External_Links │ Claims, Timeline_Events,  │
   └────────────────────┘                    │ Claim_Conditions, _Alerts,  │
   ┌────────────────────┐                    │ Ownership, Financial_Tracks,│
   │ claims-data-       │  writes (parallel  │ External_Links, Health_Hist,│
   │ foundation         │  copy, same DB) ──►│ Service_Log, Claim_Summaries│
   └────────────────────┘                    └───────────────────────────┘
   nightly 6 AM ▼
   claims-service/MorningAutomationService  → precomputes health/conditions into Claims
```

**Six projects hard-open the Claims Database by ID** (verified via grep for `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`): `automation-dashboard`, `claims-data-foundation`, `claims-service`, `eoj-app`, `eoj-processing-engine`, `insurance-intake-automation`. The ID is duplicated as a literal in each: `claims-service/Config.js:6-7`, `eoj-app/Config.js:3`, `eoj-processing-engine/ClaimsBridge.js:38`, plus the dashboard and intake configs.

### 1.2 Layered view (UI → Services → Logic → DB → External)

| Layer | Where it lives | Notes |
|---|---|---|
| **UI (client)** | `automation-dashboard/*.html` (Index 3585, ClaimsScripts 2870, HomepageScripts 1056…), `eoj-app/*.html` (Client 1186) | `google.script.run` RPC (28 call sites). Monolithic inlined SPA in `Index.html`. |
| **UI services (server)** | `automation-dashboard/HomepageApi.js`, `HomepageDataService.js`, `HomepageService.js`, `ClaimActionsService.js`, `EojAdminService.js` | **HomepageDataService is a full parallel data layer** — see Part 6. |
| **Domain services** | `claims-service/*` (43 files), `ClaimDetailService`, `ClaimsWorkspaceService`, engines | The real business logic. |
| **Composition layer** | `claims-service/ClaimFoundationService.js`, `OperationalIntelligenceService.js`, `ClaimWorkspaceContextService`* | In-memory only, no re-fetch (design strength). |
| **Data access** | `claims-service/SheetService.js`, plus ad-hoc `openById` everywhere | **No single DAL.** 84 `openById`, 78 `getDataRange` in the 5 projects. |
| **Database** | Google Sheets (Claims DB `1LWU…`, EOJ source `10ja…`, EOJ output `1Gms…`, folder-map sheet, log sheet) | 10 sheets in the Claims DB (`Config.js:53-64`). |
| **External systems** | Gmail, Google Drive, Google Calendar, Todoist (`api.todoist.com`), Google Chat webhooks, NextGear (report emails) | Reached from intake + processing engine. |

*`ClaimWorkspaceContextService` is referenced in the brief's priority list and called via `buildWorkspaceContext_` (`ClaimDetailService.js:147`) but a standalone file of that exact name was not found in `claims-service/` — see *Could Not Verify*.

### 1.3 Duplicate paths, circular risk, coupling

- **Duplicate read paths (the headline).** The claims read+normalize stack exists independently in: `ClaimsQueryService.getAllClaimSummaries` (`ClaimsQueryService.js:1`), `SheetService.getRows` (`SheetService.js:45`), `HomepageDataService.getHomepageClaimSummaryData` (`HomepageDataService.js:14`), `eoj-app` `getJobsForLookup` (`eoj-app/Code.js:65`), and the EOJ engine readers. Five normalizers (`pick_`, `getHomepageValue_`, `pickJobField_`, `getFullClaimFirstValue_`, `getEojRecordValue_`) do the same drift-tolerant candidate-key lookup.
- **Duplicate write paths.** `claims-service/SheetService.appendRow` vs `eoj-processing-engine/ClaimsBridge.appendByHeaderMap_` — two header-mapped writers into the same sheets.
- **Circular/temporal coupling (not import cycles, but call-order coupling).** `ClaimDetailService.getClaimDetail` builds `detail`, then calls `buildClaimFoundation_(claimId, detail)` which reads *back* from the half-built `detail` (`ClaimFoundationService.js:20-24`), then builds header/summary models *from* the foundation, some of which fall back to re-deriving from `detail` again. The comment at `ClaimDetailService.js:119-124` explicitly manages this ordering hazard. It works, but it is fragile: the object is mutated in place and passed to builders that read prior mutations.
- **Hidden dependencies.** Pervasive `typeof someFn === 'function' ? someFn(...) : inlineFallback` guards (`ClaimsWorkspaceService.js:160,384`; `ClaimDetailService.js:45,126,141,147`). These are load-order/deployment-coupling smells: a function may or may not exist depending on which files are pushed, and each has a second, drifting implementation inline.
- **Services doing too much:** `ClaimDetailService.js` (3199 lines) is both orchestrator and timeline/EOJ engine and model factory. See Part 6.

---

## Part 2 — Performance Audit

Apps Script cost is dominated by **Sheets API round-trips** (`openById`, `getDataRange`, `getValues`, `setValues`) and by re-serialization (`JSON.stringify`, 325 occurrences). CPU-side array work matters at scale but is second-order today. Costs below are tagged **High / Medium / Low**.

### 2.1 The read hot path (Claims Workspace open)

| # | Operation | Location | Cost | Why |
|---|---|---|---|---|
| 1 | `getClaimsWorkspace` reads all claims **twice** | `ClaimsWorkspaceService.js:28-33` (getClaimsList + getClaimsLensCounts) | **High** | Each call to `getAllClaimSummaries` opens+scans Claims, Conditions, Alerts. Two calls = ~6 full `getDataRange` scans + 3–6 `openById` per workspace open. |
| 2 | Base summary opens 3 sheets via 3 separate `openById` | `ClaimsQueryService.js:43,218,347` | **High** | `getClaimsDatabaseSheet_`, `getConditionsSheet_`, `getAlertsSheet_` each open the same spreadsheet independently. |
| 3 | Lens counts re-run all 6 filters over the array | `ClaimsLensService.js:59-66` | **Medium** | Counts could be derived from the single list read; instead a second full read + 6 array scans. |
| 4 | Per-claim enrichment recomputed every render | `ClaimsWorkspaceService.js:204-215` (`enrichClaimWorkspaceSummary_`) | **Medium** | openRequirements / nextAction / operationalAlerts rebuilt per claim, never cached. |
| 5 | Drift-tolerant `pick_` scans candidate arrays per field | `ClaimsQueryService.js:53-118,418` | **Medium** | ~30 `pick_` calls/row, each a linear scan of a name array. O(rows × fields × candidates). |

### 2.2 The claim drawer / claim detail path

| # | Operation | Location | Cost | Why |
|---|---|---|---|---|
| 6 | "Lightweight" drawer does a **full all-claims scan for one claim** | `ClaimDrawerService.js:139-146` (`getClaimSummaryById_`) | **High** | Fetches one claim by reading + normalizing every claim. |
| 7 | Drawer reads external links **twice** | `ClaimDrawerService.js:14` and `:157` | **Medium** | `getClaimExternalLinks` called in body and again in `buildRecommendedDrawerActions_`. |
| 8 | Claim detail **re-fetches** links + financials the drawer already fetched | `ClaimDetailService.js:29,33` vs `ClaimDrawerService.js:14-15` | **High** | Same two datasets read a 2nd time in the same request. |
| 9 | Six sequential model-build passes over the same in-memory data | `ClaimDetailService.js:126-150` | **Medium** | Foundation → header → opSummary → currentState → operationalIntelligence → workspaceContext. Each re-derives lifecycle/health/ownership with foundation-read-then-fallback-recompute. |
| 10 | Timeline fallback scans the **entire** Timeline_Events sheet in memory | `ClaimDetailService.js:1220,1246-1257` | **High (at scale)** | When the `getTimelineForClaim` path misses, it reads the whole timeline sheet and filters by claimId client-side. This is the single worst future bottleneck (see Part 9). |
| 11 | EOJ recovery reaches cross-project into 2 EOJ spreadsheets | `ClaimDetailService.js:1782-1800` | **High** | `openEojSourceSpreadsheet_` + `openEojProcessingOutputSpreadsheet_`, full `getDataRange` on miss (`:1836,1889`). Correctly **deferred** from initial payload (`:156`). |

### 2.3 Batch / write paths

| # | Operation | Location | Cost | Why |
|---|---|---|---|---|
| 12 | `ReportImportService` — 10 `openById` + 10 `getDataRange` | `claims-service/ReportImportService.js` (grep) | **Medium** | Runs in nightly batch, so tolerable, but the heaviest single file for Sheets calls. |
| 13 | ClaimsBridge reads open-conditions **per row** to dedupe | `eoj-processing-engine/ClaimsBridge.js:111` (`getOpenConditionTypes_`) | **Medium** | Inside the 15-min per-row loop → N sheet reads for N unprocessed EOJs. |
| 14 | `SheetService.getRows` opens twice per call | `SheetService.js:45` calls `getHeaders` (`:34`) which re-opens | **Medium** | 2 `openById` per logical read. |
| 15 | `ensureSheetColumns_` re-reads headers **inside a forEach** | `SheetService.js:211-218` | **Low** (migration only) | N header reads per migration column. |
| 16 | eoj-app lookup reads Claims + EOJ_Log in full, backward-walks | `eoj-app/Code.js:65-146,564,614,705` | **Low–Medium** | Low frequency (single technician), but full scans. |

### 2.4 Work done more than once (summary)

- **All-claims read:** at least 2× per workspace open (list + counts); again per drawer; again per detail (via drawer); and a **separate parallel** read for the homepage. On a single homepage+workspace session the Claims sheet may be fully scanned **5–8 times**.
- **External links / financial tracks:** 2× per claim-detail request.
- **Normalization/field-picking:** re-run on every read in every project; never memoized.
- **Health & conditions:** precomputed nightly into the Claims sheet by `MorningAutomationService`, yet the read path **still recomputes / re-reads** them live rather than trusting the snapshot columns.

---

## Part 3 — Payload Analysis

The two payloads that matter are the **Homepage summary** and the **Full Claim detail**. Both are computed server-side in one shot and shipped whole.

### 3.1 Full Claim detail (`ClaimDetailService.getClaimDetail`, returns `detail`)

The returned object (`ClaimDetailService.js:50-161`) contains, for a single claim:

| Field group | Contents | Rendered immediately? | Assessment |
|---|---|---|---|
| `claimHeader` | identity, lifecycle, health, ownership, conditions, alerts, next action | Yes | Core. Keep. |
| `timelineSection` | `events`, `recentEvents`, `timelineGroups`, `timelineItemModels`, **plus** `timelineEvents` (a duplicate of `events`) | Partially | **`events` is shipped 3× under different keys** (`events`, `timelineEvents`, and inside groups/items). Capped at 200 (`:1199`). Redundant. |
| `recentTimelineEvents` | top-5 (duplicate of `timelineSection.recentEvents`) | Yes | Duplicated at top level too. |
| `operationalContext` | nextAction, attentionReason, conditions, requirements, **`blockers:[]`**, **`currentCadence:null`** | Partially | Ships empty placeholders. |
| `fullClaimHeader`, `fullClaimOperationalSummary`, `fullClaimCurrentState`, `operationalSummary` (alias of one) | 4 derived view-models over the same header data | Header only | Heavy overlap; `operationalSummary` is a straight alias (`:135`). |
| `claimFoundation`, `operationalIntelligence`, `workspaceContext` | 3 more composed views of lifecycle/health/ownership/conditions | Some | Substantial overlap with `fullClaimHeader`. |
| `relatedWorkflows` | `{monitoring:null, asbestos:null, itel:null, revision:null, supplements:[]}` | No | **Entirely null placeholders — dead payload weight.** |
| `eojReports` | `[]` with `eojReportsDeferred:true` | No (lazy) | **Correct pattern.** |
| `performanceTimings` | server timing array | No | Debug data shipped to client. Fine in dev, strip in prod. |

**Verdict:** the claim-detail payload carries the same claim's lifecycle/health/ownership/conditions **five-plus times** (claimHeader, fullClaimHeader, fullClaimOperationalSummary, fullClaimCurrentState, claimFoundation, operationalIntelligence, workspaceContext), timeline events **three times**, and several permanently-empty structures (`relatedWorkflows.*`, `operationalContext.blockers`, `currentCadence`). A large fraction of the bytes are duplicate view-models the client could derive, or nulls.

**Recommendations:** (a) ship the timeline **once** and let the client group; (b) collapse the 4–7 header/summary view-models into one canonical `claimFoundation` and have the client render from it (the composition layer already produces it); (c) drop null `relatedWorkflows` until those workflows exist, or lazy-load them like EOJ reports; (d) strip `performanceTimings` behind a debug flag.

### 3.2 Homepage summary (`HomepageDataService.getHomepageClaimSummaryData`)

Returns (`HomepageDataService.js:63-92`): `kpis`, `claimSummaryMetrics`, `todayPriorities`, `todaySchedule`, `becomingStale`, `recentActivity`, `recentClaimSummaries`, `operationalAlerts`, `ownershipVisibility`, `conditionsVisibility`, `complianceVisibility`. All computed from full scans of 6 sheets, every load, server-side, with no pagination.

- **Rendered above the fold:** kpis, todayPriorities, todaySchedule — a small slice.
- **Below the fold / on scroll:** recentActivity, recentClaimSummaries, becomingStale — good lazy-load candidates.
- **Never paginated:** all lists return full arrays; at 10k claims `becomingStale`/`recentActivity` become large.

**Recommendation:** split into `getHomepageKpis()` (already exists, `:317`) served first, then lazy sections. Paginate/limit the lists.

---

## Part 4 — Database Access Inventory

### 4.1 The stores

| Store | ID | Owned by (should be) | Read by | Written by |
|---|---|---|---|---|
| **Claims Database** | `1LWU…` | claims-service | **all 6 projects** | claims-service, eoj-processing-engine (ClaimsBridge), insurance-intake (External_Links), claims-data-foundation |
| EOJ source / EOJ_Log | `10ja…` | eoj-app / processing-engine | eoj-app, processing-engine, claims-service (recovery) | eoj-app (append), processing-engine (status) |
| EOJ output | `1Gms…` | eoj-processing-engine | processing-engine, claims-service (recovery) | processing-engine |
| Claim-folder map | (intake config) | insurance-intake | insurance-intake | insurance-intake |
| Automation Run Log | by name | automation-dashboard | dashboard | dashboard |

**Sheets inside the Claims Database (10):** Claims, Timeline_Events, Claim_Conditions, Claim_Alerts, Alert_Rules, Claim_Ownership_History, Financial_Tracks, External_Links, Claim_Health_History, Claim_Service_Log (`Config.js:53-64`). Additional read-only-referenced sheets: `Claim_Summaries`, `Compliance_Actions`, `Import_Log` (`HomepageDataService.js:355-362`, `ClaimDrawerService.js:83`).

### 4.2 Reads-to-open, by screen (worst case observed)

Counting full-sheet `getDataRange().getValues()` scans triggered to render each surface:

| Surface | Full-sheet scans | Path |
|---|---|---|
| **Homepage** | **6** (Claims, Timeline, Conditions, Alerts, Compliance_Actions, Claim_Summaries) | `HomepageDataService.js:15-20` — one scan each, its own reader. |
| **Claims Workspace** | **~6** (Claims×2, Conditions×2, Alerts×2) | list read + counts read, `ClaimsWorkspaceService.js:28-33`. |
| **Claim Drawer** | **~5** (all-claims scan = Claims+Conditions+Alerts, + External_Links, + Claim_Summaries) | `ClaimDrawerService.js:14-16,140,157`. |
| **Full Claim** | **~9+** (drawer's 5, + links again, + financials again, + timeline, + EOJ ×2 when not deferred) | `ClaimDetailService.js:25-37`; EOJ deferred so ~7 on initial load. |
| **Intake (per run)** | 1 folder-map scan + Gmail/Drive API | `FolderMatching.js` + `Code.js:591`. |
| **EOJ lookup tab** | 2 (Claims + EOJ_Log) | `eoj-app/Code.js:65-146`. |

### 4.3 Duplicated reads / what should be cached or precomputed

- **Claims+Conditions+Alerts** are the most-read data in the system and are read redundantly on nearly every surface. **This trio is the #1 caching target.**
- **Timeline_Events** is scanned whole on the claim-detail fallback path — should be indexed/partitioned by claim (see Part 9), and is already cached per-claim for 300s (`:1163-1169`).
- **Health & Conditions are already precomputed nightly** into the Claims sheet (`MorningAutomationService` Phase 2). The read path should treat those snapshot columns as authoritative and stop recomputing.
- **Ownership of each dataset is ambiguous** because multiple projects write the same sheets. The Claims DB should have exactly **one writer per sheet** (claims-service), with EOJ/intake handing data to a claims-service API rather than writing sheets directly.

---

## Part 5 — Cache Strategy

### 5.1 What exists

`CacheService` appears **three times total**, all in `ClaimDetailService.js`:

1. `getWorkspaceTimelineForClaim_` — per-claim timeline, 300s (`:1163-1174`, `:1203`).
2. `getCachedEojSheetValues_` — whole EOJ sheet values, 300s (`:1819-1852`).
3. `getEojSheetRowsForClaim_` — per-claim EOJ rows, 300s (`:1866-1918`).

All three are targeted band-aids over the **most expensive** (cross-project / full-timeline) reads. They are correct in spirit but isolated: nothing else in the platform caches anything.

`PropertiesService` (22 uses) is used for config/tokens/status flags (e.g., `automation-dashboard/Code.js` ×10, `SetupProperties.js`), not as a data cache.

### 5.2 Where caching is missing (highest value first)

| Target | Where it should live | Mechanism | Why |
|---|---|---|---|
| **Claims + Conditions + Alerts summary set** | a new `ClaimsRepository` in claims-service | `CacheService` script cache, short TTL (60–120s) keyed by sheet-version | Kills the 5–8× redundant full scans across homepage/workspace/drawer/detail. Biggest single win. |
| **Lens counts** | derive from the cached summary set | in-memory, per request | Removes the second full read in `getClaimsLensCounts`. |
| **Per-claim summary by ID** | `ClaimsRepository.getById` over the cached set | in-memory map | Removes the "scan all to get one" in the drawer. |
| **Homepage payload** | `automation-dashboard` (or, better, delegate to claims-service) | `CacheService`, 60–120s | Homepage is read-mostly and recomputed from 6 full scans each load. |
| **Precomputed snapshot columns** | Claims sheet (already written nightly) | trust them on read | Stop recomputing health/conditions live. |

### 5.3 Where caching would be ineffective / wrong

- **Write paths** (append timeline, upsert condition, morning batch) should **invalidate**, not read, cache. Any cache needs a version/etag (e.g., a `Last_Written_At` cell or a `PropertiesService` counter bumped on every write) so the 300s TTLs don't serve stale claim data right after an EOJ posts.
- The existing 300s TTLs are **long** for interactive editing: submit an EOJ, open the claim within 5 minutes, and the timeline/EOJ cache may hide it. Shorten to ~60s or invalidate on write.

### 5.4 Snapshot / materialized-view opportunities

- **`Claim_Summaries` already is a materialized view** (read at `ClaimDrawerService.js:83`, `HomepageDataService.js:20`). Lean into it: have the nightly batch (and post-write hooks) fully populate a denormalized per-claim summary row (health, conditions CSV, alert count, last activity, missing links, financial rollup) so the workspace/homepage read **one** sheet instead of joining three. `ClaimsDatabaseSyncService.js` appears intended for exactly this — finish and adopt it.
- A **timeline partition** (per-claim or per-year sheet, or an indexed key column) is the materialization that saves the full-timeline scan at scale.

---

## Part 6 — Service Boundaries

### 6.1 God objects / oversized services

- **`ClaimDetailService.js` (3199 lines)** is at least four services: (a) the claim-detail orchestrator, (b) the workspace **timeline engine** (`getWorkspaceTimelineForClaim_`, EOJ collapse/group logic `:1279-1454`), (c) the **EOJ recovery reader** (`:1782-1924`), and (d) a **view-model factory** (`buildFullClaim*Model_`). These should be separate files.
- **`HealthEngineService.js` (2385)**, **`AlertService.js` (1742)**, **`ConditionEngineService.js` (1691)**, **`ReportImportService.js` (1811)**, **`ExternalLinkService.js` (1012)**, **`FolderMatching.js` (1364)** are all large; most are cohesive engines (acceptable) but `FolderMatching` mixes Drive I/O, fuzzy matching, and sheet I/O.

### 6.2 Business logic inside UI services

- **`automation-dashboard/HomepageDataService.js` (2716)** is the clearest violation: a *dashboard-side* file that does raw sheet reads, normalization, health-level derivation, staleness math, KPI computation — **all business logic that duplicates claims-service.** The homepage should call a claims-service homepage API (`getHomepageClaimSummary` exists at `claims-service/Code.js:89`), not reimplement it. This is the most important boundary fix after caching.

### 6.3 Data access mixed with presentation / logic

- No dedicated data-access layer. `openById` + `getDataRange` are inlined into query services, UI services, engines, and the EOJ bridge alike (84 / 78 occurrences). Everything that touches Sheets should go through one repository module per store.

### 6.4 Duplicate helpers / overlapping services (verified pairs)

| A | lines | B | lines | Overlap |
|---|---|---|---|---|
| `ConditionService.js` | 426 | `ConditionEngineService.js` | 1691 | condition concepts split across two |
| `OwnershipService.js` | 160 | `OwnershipEngineService.js` | 235 | ownership split across two |
| `FinancialTrackService.js` | 339 | `ClaimFinancialTrackService.js` | 85 | financial-track read vs manage |
| `ExternalLinkService.js` | 1012 | `ClaimExternalLinkService.js` | 304 | external-link engine vs claim-scoped reader |
| `claims-service/*ImportService` | — | `claims-data-foundation/*ImportService` | — | **whole project is a parallel copy** |

**Timeline family = 7 files, 3,570 lines:** `TimelineService` (758), `TimelineEngineService` (1150), `TimelineSynthesisService` (730), `TimelineRulesService` (319), `TimelineMaintenanceService` (226), `TimelineIntelligenceService` (144), `TimelineImportHelpers` (243). `synthesizeClaimActivities` (`TimelineSynthesisService.js:9`) is re-run per claim by both the condition and lifecycle engines. This family needs a boundary review — likely 3 services, not 7.

**Repeated normalization/field-picking:** `pick_` (`ClaimsQueryService.js:418`), `getFullClaimFirstValue_` (`ClaimDetailService.js`), `getHomepageValue_` (`HomepageDataService.js:384`), `pickJobField_`/`resolveHeader_` (`eoj-app/Code.js:49,58`), `getEojHeaderIndex_` (`ClaimDetailService.js:1938`), `findHeaderIndex_` (intake). **Six implementations** of one idea. Extract one shared header/field utility.

### 6.5 What has good boundaries (keep)

- `ClaimFoundationService` + `OperationalIntelligenceService`: explicit no-fetch composition layer (`ClaimFoundationService.js:5-7`, `OperationalIntelligenceService.js:5-32`).
- `MorningAutomationService`: cleanly phased batch orchestrator (`:header`), thin wrapper over independently-callable phases.
- insurance-intake resilience trio: `QueueHealth` / `RetryWorkflow` / `PendingClaimInspection`.
- `ResponseService` / `Utilities`: shared response + helper conventions inside claims-service.

---

## Part 7 — Algorithmic Complexity

The dominant complexity is not deep nested loops — it is **repeated linear passes over the same arrays**, amplified by the drift-tolerant field-pickers.

| Pattern | Location | Complexity | Recommendation |
|---|---|---|---|
| **Scan-all-to-find-one** | `ClaimDrawerService.js:139-146`; eoj-app backward-walks `Code.js:582,664,721` | O(N) per single-claim lookup | Build a `Map` by claim ID once (cached), then O(1) get. |
| **Full-timeline scan + filter by claim** | `ClaimDetailService.js:1238-1257` | O(T) over *all* timeline events per claim view | Index/partition timeline by claim ID; query only that claim's rows. Critical at 500k events. |
| **Field-pick = linear scan of candidate names, per field, per row** | `pick_` `:418`; `getFullClaimFirstValue_`; `getHomepageValue_:384` | O(rows × fields × candidates) | Resolve the header→index map **once per sheet**, then direct indexed access. Eliminates the per-field candidate loop. |
| **Lens counts re-filter the array 6×** | `ClaimsLensService.js:59-66` | 6 × O(N) after a 2nd O(N) read | Single pass: tally all six buckets in one loop over the already-read list. |
| **`enrichClaimWorkspaceSummary_` per claim builds alert strings** | `ClaimsWorkspaceService.js:265-293`; `getClaimsLensSignalText_` joins ~18 fields `ClaimsLensService.js:264-289` | O(N × fields) string allocation in filter loops | Precompute a lowercased signal blob once per claim; reuse across filters. |
| **EOJ event-type detection scans a 16-entry array per event** | `ClaimDetailService.js:1328-1348` | O(events × 16) | Use a `Set` for O(1) membership. |
| **Condition dedupe re-reads sheet per processed row** | `ClaimsBridge.js:111` | O(rows_processed × N_conditions) sheet reads | Read open conditions once per run into a map keyed by claim. |

None of these are algorithmically exotic; they are all **"read once, index once, reuse"** fixes. The payoff scales with data size.

---

## Part 8 — Technical Debt

### 8.1 Dead / backup files committed to the repo

- **6 × `ReportImportService.js.bak*`** in `claims-service/` (`.bak`, `.bak2`, `.bak3`, `.bak_compliance_fix2`, `.bak_skip_completed`, `.bak_unmatched_fix`) — ~117 KB of stale source. **Delete; use git history.**
- **`backups/apps-script-projects-initial-backup/`** — 23 stale initial-snapshot files (old copies of add-new-job-to-calendar, automation-dashboard, eoj-builder, new-jobs, rbw-utils, test-dashboard).
- **`eoj-processing-engine/LegacyCleanup.js`** (225 lines) — a cleanup utility by name; verify it isn't still wired to a trigger, then remove.
- **Empty files:** `automation-dashboard/HomepageClient.html` (0), `HomepageComponents.html` (0) — dead includes.
- **Duplicate directory:** `apps-script-projects/emergency service agreement/` (with a space) is **empty**, alongside the real `emergency-service-agreement/`.

### 8.2 Duplicate / superseded projects

- **`claims-data-foundation`** writes to the same Claims DB (`Config.js:3` = `1LWU…`) and duplicates claims-service's import services. Strong candidate for a **superseded parallel implementation** — confirm nothing still triggers it, then retire.
- **`historical-notes-sync/HistoricalNotesSync_v2.gs`** ("_v2") likely superseded by `claims-service/HistoricalNotesImportService.js`.
- **Three dashboards:** `automation-dashboard` (live), `apps-script-dashboard`, `test-dashboard`. The latter two look dead.
- **`revision-intake-automation`** ships an `eoj-intake-mockup.html` (a mockup inside a deployed project).

### 8.3 Compatibility layers / temporary code still in place

- **Backward-compatible action aliases** in intake: `processEmsl`→`processAsbestos`, `cleanupEmslLabels`→… labelled "Temporary" (`insurance-intake-automation/Code.js:55-62`).
- **Schema-drift dual-write** for health columns: legacy space-headers are canonical+read while `Operational_Health`/`Health_Updated_At`/`Updated_At` are written-but-unread (`Config.js:203-236`, `HealthEngineService.js:90-112`). This is a deliberate, well-documented migration-in-progress — but it is unfinished debt: two column sets, one read, one dark.
- **`typeof fn === 'function' ? fn() : inlineFallback`** guards with drifting duplicate logic (`ClaimsWorkspaceService.js:160,384`; `ClaimDetailService.js:45,126,141,147`). Each fallback is a second implementation that can rot.
- **Stale migration target:** `migrateClaimTimelinePhase5Columns` operates on a sheet named `Claim_Timeline` (`Code.js:14`) while the schema defines `Timeline_Events` (`Config.js:55`) — likely dead/misaimed migration.

### 8.4 Test / diagnostic code in production files

Production service files carry large amounts of test/debug code with **hardcoded claim IDs**: `testClaimsQueryRafiLastActivity` (`ClaimsQueryService.js:438`), `testMissingFromOpenJobsClaimDetails` (9 hardcoded IDs, `:499`), `testGetJobsForLookup`/`debugEquipmentColumns`/`diagnosticWriteEOJRow` (`eoj-app/Code.js:152,443,489`), plus DDL helpers (`setupEOJLogSheet`, `repairEOJLogColumns`). Move to a separate test project or clearly-namespaced dev files.

---

## Part 9 — Future Scalability

Assumptions: **10,000 claims, 500,000 timeline events, 100 users, several years of history.** Ordered by what fails soonest.

### 9.1 What breaks first — the full-sheet read model + Apps Script limits

Apps Script imposes hard ceilings: **6-minute execution limit** per custom-function/request, URL-fetch and script-runtime quotas, and Sheets that slow sharply past ~50k rows and have a **10M-cell** ceiling. Against those:

1. **Timeline full-scan dies first.** `getWorkspaceTimelineForClaim_`'s fallback reads the *entire* Timeline_Events sheet (`ClaimDetailService.js:1220`) and filters in memory. At 500k rows this single `getDataRange` will blow memory/time on nearly every claim open that misses cache. **First hard failure.**
2. **Claims-summary reads become multi-second, then time out.** Every surface reads Claims+Conditions+Alerts in full, 5–8×/session (Parts 2/4). At 10k claims × ~50 columns that is ~500k cells per scan, repeated. Homepage/workspace/detail all cross the 6-minute wall as the sheet grows and concurrency rises.
3. **Concurrency: 100 users vs. no shared cache.** With no cross-request cache and per-user recomputation, 100 users hammering the same sheets multiply Sheets API calls and hit per-user and per-project quotas. Apps Script also serializes some operations; contention spikes.
4. **`Claim_Summaries`/lists that ship full arrays** (homepage `recentActivity`, `becomingStale`; workspace groups) grow unbounded — payloads bloat and client render slows.

### 9.2 What slows first (before it breaks)

- Per-field candidate-scan normalization (O(rows×fields×candidates)) turns a 200ms normalize into seconds at 10k rows.
- The 6-model-build cascade per claim-detail (`:126-150`) multiplies CPU per request.
- Nightly batch (`MorningAutomationService`, `ReportImportService` 10 scans) lengthens; risk of exceeding the 6-min/trigger window → partial nightly runs.

### 9.3 What gets expensive first

- Sheets API quota consumption from redundant reads (the cheapest thing to fix, the first to bite under concurrency).
- Cross-project EOJ recovery reads (2 spreadsheets, full scans) per claim when not cached.

### 9.4 What architecture stops scaling

- **"Google Sheets as an unindexed relational DB read in full."** This is the core scale limit. Sheets has no indexes, no server-side WHERE, no joins. Every "query" is a full download + client filter. Beyond a few thousand active claims / hundreds of thousands of events, the data must move to a store with indexed lookups (a real database, or at minimum a partitioned + materialized sheet strategy with per-claim/per-year partitions and denormalized summary rows).
- **Six writers into one schema** stops scaling operationally: schema changes require coordinated edits across projects, and silent-fail bridges make divergence invisible.

### 9.5 Bottom line

The platform is comfortable at today's scale and will likely tolerate low-thousands of claims with the caching + repository fixes below. **It will not reach 10k claims / 500k events on the "read the whole sheet" model** — that requires a data-layer change (materialized summaries + timeline partitioning now; a real indexed datastore before true 10× growth).

---

## Part 10 — Roadmap (ordered by impact, not difficulty)

Each item: expected performance gain, maintainability gain, risk, dependencies, and suggested order. "Risk" is the chance of breaking production behavior.

### R1 — Introduce a single `ClaimsRepository` with a cached summary set  ⟶ do first
- **What:** One module in claims-service that owns opening the Claims DB and reading Claims+Conditions+Alerts, exposes `getAllSummaries()`, `getById(id)`, `getLensCounts()`, backed by `CacheService` (60–120s TTL, invalidated on write).
- **Performance:** **Very high.** Collapses 5–8 full-sheet scans per session to ~1. Directly fixes Part 2 items #1,#2,#6,#8 and the drawer scan-all.
- **Maintainability:** **High.** One place to read claims; kills 3+ duplicate readers.
- **Risk:** Medium — must get cache invalidation right (bump a version cell/property on every write). Behavior-preserving if it wraps existing normalizers.
- **Dependencies:** none. Everything else gets easier after this.

### R2 — Point Homepage and Claim Drawer/Detail at the repository; delete the parallel homepage read stack
- **What:** `HomepageDataService` calls claims-service's homepage summary (or the repository) instead of its own 6-sheet read; drawer/detail use `getById` + already-fetched data (stop the double-fetch of links/financials).
- **Performance:** **High** (removes the homepage's 6 scans and detail's redundant re-reads).
- **Maintainability:** **Very high** (removes ~2,700 lines of duplicated logic and a whole normalizer).
- **Risk:** Medium — homepage output must match; do behind a feature flag with output diffing.
- **Dependencies:** R1.

### R3 — Trust the nightly snapshot; single-pass lens counts
- **What:** Read health/conditions from the precomputed Claims columns; compute all six lens buckets in one loop over the cached list.
- **Performance:** Medium–High. **Maintainability:** Medium. **Risk:** Low (snapshot already written nightly).
- **Dependencies:** R1.

### R4 — Extract one shared header/field utility; resolve header index once
- **What:** Replace `pick_`, `getHomepageValue_`, `pickJobField_`, `getFullClaimFirstValue_`, `findHeaderIndex_`, `getEojHeaderIndex_` with one utility; build header→index map once per sheet.
- **Performance:** Medium (kills O(rows×fields×candidates)). **Maintainability:** High. **Risk:** Low–Medium (broad but mechanical).
- **Dependencies:** none, but cleanest after R1.

### R5 — Make the EOJ→Claims and Intake→Claims writes go through a claims-service API (stop direct sheet writes) + surface bridge failures
- **What:** `ClaimsBridge` and intake call a claims-service endpoint (`processEojOutputs` already exists at `Code.js:171`; add an external-links endpoint) instead of `openById` into claims sheets. Log/alert on bridge failure instead of swallowing (`eoj-processing-engine/Code.js:64-69`).
- **Performance:** Neutral. **Maintainability:** **Very high** (one writer per sheet; schema owned in one place). **Reliability:** High (no more silent propagation loss).
- **Risk:** Medium–High (touches the 15-min pipeline; roll out with the non-fatal behavior retained but now *observable*).
- **Dependencies:** none, but coordinate with R1's repository as the single data owner.

### R6 — Trim the claim-detail payload
- **What:** Ship timeline once; collapse the 4–7 header/summary view-models to the canonical `claimFoundation`; drop null `relatedWorkflows`/`blockers`/`currentCadence` or lazy-load them; gate `performanceTimings` behind a debug flag.
- **Performance:** Medium (smaller payloads, less server model-building). **Maintainability:** High. **Risk:** Medium (client must render from consolidated shape).
- **Dependencies:** ideally after R2 so the client is already talking to a consolidated model.

### R7 — Split `ClaimDetailService` (3199) into orchestrator + timeline engine + EOJ recovery + view-models; begin Timeline-family consolidation (7→~3)
- **Performance:** Neutral. **Maintainability:** **Very high.** **Risk:** Medium (large move; do as pure file-splits with tests).
- **Dependencies:** R4 helps.

### R8 — Delete dead code & retire duplicate projects
- **What:** Remove `*.bak*`, `backups/`, empty HTML/dirs, dead migrations, backward-compat aliases; confirm-and-retire `claims-data-foundation`, `test-dashboard`, `apps-script-dashboard`, `historical-notes-sync`, mockups.
- **Performance:** None. **Maintainability:** High. **Risk:** Low–Medium (must verify no live triggers first — see Could Not Verify).
- **Dependencies:** verification of triggers/deployments.

### R9 — Timeline partitioning + finish `Claim_Summaries` materialization (scale prep)
- **What:** Index/partition Timeline_Events by claim (or per-year sheets); have the batch fully populate a denormalized per-claim summary row so reads hit one sheet. `ClaimsDatabaseSyncService.js` is the seed.
- **Performance:** **Very high at scale** (fixes the first thing that breaks in Part 9). **Maintainability:** Medium. **Risk:** Medium–High (data migration).
- **Dependencies:** R1/R3.

### R10 — Plan the datastore exit (before true 10×)
- **What:** Evaluate moving the operational record off Sheets to an indexed store (e.g., a proper DB fronted by an Apps Script or external API) for claims + timeline. This is the only thing that makes 10k/500k durable.
- **Risk:** High (architectural). Not urgent, but should be on the strategy board now.

**Suggested execution order:** R1 → R2 → R3 → R4 → R5 → R6 → R7 → R8 → R9 → R10. R1–R4 are the high-impact/low-to-moderate-risk core and should be a single focused effort; R8 (cleanup) can run in parallel any time after trigger verification.

---

## Part 11 — Architecture Scorecard

Scores are 1 (poor) to 10 (excellent), judged against what a production system serving this business *should* look like, not against other Apps Script hobby projects.

| Dimension | Score | Rationale |
|---|---:|---|
| **Architecture (overall)** | 5 | Sensible service decomposition and a real composition layer, undermined by no shared data layer and 6 writers on one schema. |
| **Performance** | 4 | Correct instincts (defer EOJ, cache timeline) but 5–8× redundant full-sheet reads on the hot path and near-zero caching. |
| **Scalability** | 3 | "Read the whole unindexed sheet" model + Apps Script limits; breaks well before the 10k/500k target. |
| **Maintainability** | 4 | Massive duplication (5 read stacks, 6 field-pickers, duplicate service pairs, 7 timeline files) and dead code raise change-cost. |
| **Readability** | 6 | Individual functions are clear, well-named, heavily commented; comments are unusually honest about debt. Files are too long. |
| **Coupling** | 3 | Six projects hardcode one DB ID and write its sheets directly; silent-fail bridges; `typeof` fallback coupling. |
| **Caching** | 3 | Exists in exactly one file (3 uses); everywhere else absent; TTLs risk staleness after writes. |
| **Data layer** | 3 | No DAL; `openById`/`getDataRange` inlined in 80+ places; ownership of each sheet ambiguous. |
| **Service layer** | 6 | Genuinely good ideas (Foundation/OI composition, phased morning batch, resilience trio) but God-services and duplicate pairs. |
| **UI layer** | 5 | Works; monolithic inlined SPA (`Index.html` 3585), whole-payload/no-pagination, dashboard reimplements domain logic. |
| **Developer experience** | 5 | Excellent docs/handoffs and self-timing help; multi-project clasp sprawl, test code in prod files, and `.bak` clutter hurt. |
| **Future readiness** | 3 | Without a data-layer change it cannot meet the stated growth; the groundwork (batch, composition, sync service) exists to get there. |

### Overall grade: **C+**
Functional and, in specific places, thoughtfully engineered — but not yet safe to sign off for long-term production at the intended scale without the data-layer and caching work in Part 10.

### Biggest risks
1. **Silent cross-project write failures.** `ClaimsBridge` and intake write claims sheets with swallowed errors (`eoj-processing-engine/Code.js:64-69`) — EOJ/intake data can vanish from a claim with no alarm.
2. **The unindexed full-scan read model** — first thing to break at scale (timeline, then claims summary).
3. **Schema owned by nobody / everybody** — six writers, duplicated DB IDs, in-progress health-column drift that's half-migrated (`Config.js:203-236`).

### Biggest strengths
1. **The composition layer** (`ClaimFoundationService`, `OperationalIntelligenceService`) — the right pattern, already built, ready to be the canonical model.
2. **The nightly precompute batch** (`MorningAutomationService`) — health/conditions already materialized; the read path just needs to trust it.
3. **Operational maturity** — deferred EOJ loading, self-timing on the slow path, and the queue-health/retry/inspection resilience layer show production thinking. Documentation and handoffs are excellent and unusually candid about debt.

### Quick wins (days, low risk)
- Derive lens counts in one pass from the single list read (`ClaimsLensService.js:59-66`) — removes a full second read of 3 sheets per workspace open.
- Stop the drawer's double external-link fetch (`ClaimDrawerService.js:14` & `:157`).
- Stop claim-detail re-fetching links/financials the drawer already returned (`ClaimDetailService.js:29,33`).
- Use a `Set` for EOJ event-type membership (`:1328`).
- Delete `.bak*`, empty HTML files, and the empty `emergency service agreement/` dir (after a glance at triggers).

### Major refactors (weeks, higher value)
- **R1 `ClaimsRepository` + cache** and **R2 delete the parallel homepage stack** — the two highest-leverage changes.
- **R5** route EOJ/intake writes through claims-service and make failures observable.
- **R7/R9** split `ClaimDetailService`, consolidate the timeline family, and materialize summaries + partition the timeline.

### Things NOT to change (leave alone)
- The **deferred EOJ-reports** pattern (`ClaimDetailService.js:152-159`) — it's correct; extend the same idea to `relatedWorkflows`.
- The **composition layer's no-refetch discipline** (`ClaimFoundationService.js:5-7`) — build *toward* it, don't dismantle it.
- The **phased morning-automation structure** and its documented ordering constraints (`MorningAutomationService.js` header) — a recent, deliberate refactor.
- The **intake resilience trio** (`QueueHealth`/`RetryWorkflow`/`PendingClaimInspection`) — keep as-is.
- The **honest in-code debt comments** (e.g., `Config.js:203-236`) — they are an asset; preserve them through refactors.

---

## Could Not Verify (flagged, not inferred)

- **`ClaimWorkspaceContextService` / `ClaimOperationalIntelligenceService`** as standalone files: the brief lists these names, and `buildWorkspaceContext_` is *called* (`ClaimDetailService.js:147`), but no file of those exact names was found in `claims-service/`. The behavior likely lives inside `OperationalIntelligenceService.js` / `ClaimDetailService.js`; I did not confirm a separate file. `StateIntelligenceService.js` (105) and `ClaimsOperationalAwarenessService.js` (846) exist and may cover part of this.
- **Live trigger inventory.** I read `createProcessingTrigger` (eoj engine, every 15 min) and the documented 6 AM morning trigger, but Apps Script triggers live in project settings, not source. Before retiring `claims-data-foundation`, `historical-notes-sync`, `test-dashboard`, `apps-script-dashboard`, or `LegacyCleanup.js` (R8), confirm none has an active installable trigger or is a live deployment target.
- **Actual row counts / real timings.** All performance claims are derived from reading code (scan counts, call graphs), not from executing it. `ClaimDetailService`'s own `CLAIM_DETAIL_SLOW` logging (`:171`) would give real numbers; I could not run it in this read-only pass.
- **Whether `claims-data-foundation` is truly dormant.** It targets the same DB and duplicates import services; it *looks* superseded, but I did not confirm it's unwired.
- **Files not read in full.** The 5 priority projects were read closely (priority + hot-spot files line-by-line; large engines characterized by header/exports/entry points). Non-priority projects and the largest HTML bundles (`Index.html` 3585, `ClaimsScripts.html` 2870, style includes) were scanned, not exhaustively read. Findings about them are structural, not line-level.
- **`Financial_Tracks` / `Claim_Ownership_History` / `Alert_Rules` read frequency** on each surface was inferred from the services that own them; I did not trace every UI binding.

---

## Methodology

Read-only. Sequence: (1) full directory inventory + per-project line counts; (2) repo-wide grep of the hot-spot list (`openById` 84, `getDataRange` 78, `CacheService` 3, `google.script.run` 28, etc.) with file+line capture; (3) project-by-project reads — priority and hot-spot files opened and read, large engines characterized by header/exports/entry points, findings appended to `docs/diagnostics/_audit_scratch.md` after each project; (4) verification pass cross-checking cited paths/line numbers against source; (5) synthesis into this report. Every line number here was observed in the file it cites. No source file was created, moved, modified, or deleted; the only writes are this report and the scratch notes.

