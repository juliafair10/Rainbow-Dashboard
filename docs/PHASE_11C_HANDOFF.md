# Rainbow Platform — Phase 11C Handoff

**Date:** 2026-07-06
**Prepared at the end of the Phase 11A/11B session, to seed a fresh chat for Phase 11C.**
**Phase 11C objective:** Make **Claims Service the sole writer of the `External_Links` table**; Insurance Intake becomes a thin client of Claims Service and performs **zero** direct Claims Database writes.

> Read this first, then the user's Phase 11C prompt. Where they conflict, this doc reflects the **actual code on disk as of 2026-07-06**; the prompt was written from memory and has two inaccuracies (see §5.0).

---

## 0. How to use this document

- All paths are absolute on the user's machine. The repo is a set of Google Apps Script projects synced via `clasp`.
- Line numbers are approximate and may drift — **anchor on function names**, which are stable.
- Nothing here should be taken as "already done for 11C." 11C has **not** been started. This is the starting state.

---

## 1. Repository map (folders & locations)

**Repo root:** `/Users/JuliaFair/Rainbow-Dashboard/`

| Location | Role in Phase 11C |
|---|---|
| `apps-script-projects/automation-dashboard/` | **The Rainbow Platform.** Hosts the Intake Workspace UI **and** the relocated Insurance Intake module (`IntakeModule_*.js`). This is where the intake External_Links write happens today and where most 11C edits land (client side). |
| `apps-script-projects/claims-service/` | **The data owner.** Target of the migration. `saveIntakeExternalLinks` lives here. Most 11C server work (validation, schema ownership) is confirmed here; small additions if gaps found. |
| `apps-script-projects/insurance-intake-automation/` | **Standalone project — the rollback path.** Still deployed. **DO NOT push changes here.** It is the pre-11A original. Only relevant as the reference/rollback. |
| `docs/diagnostics/` | Source-of-truth audits: `ARCHITECTURE_AUDIT_2026-07-03.md`, `claims-database-write-map.md`, `trigger-deployment-inventory.md`. Read the **write map** for the full External_Links writer inventory. |
| `docs/` | Session handoffs (this file lives here) and architecture docs. |

**Bash-mount note (for the sandbox shell only):** the repo appears at `/sessions/<id>/mnt/Rainbow-Dashboard/`. The Read/Write/Edit tools use the absolute `/Users/JuliaFair/...` path.

---

## 2. Key IDs, URLs, and script IDs

| Thing | Value |
|---|---|
| **Claims Database** (the DB 11C protects) | `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c` |
| Claim Folder Map (intake's OWN store — **not** the Claims DB) | `1kTRyZbPW1dZgkflH31s4MewuVHEl1ExQ7o3c6ad-btQ` |
| Claim folder Drive parent (intake-owned) | `1r0A84zZGvUKA_0QFs1dwozbuteZt-DbL` |
| EOJ source / EOJ output | `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs` / `1GmsWkh8x_ICVEWNFP_WgT-hN6hQDSI_WF16J9T_R-NE` |
| **automation-dashboard** script ID | `1FLiir_-mnSKqln336Vb8Fw74_ZDI_melrePqFcK70HMhzNvXCsyLqUlU` |
| **claims-service** script ID | `1eXZu58To5G0STkEXdONwUO1YIIqILvwEfwQkzoM4hiCc1z4VAcECMrkN` |
| insurance-intake-automation script ID (standalone) | `1ql7J3kUb1PltkSPgAXs-ez4ed3qyEsY2_KYYewAXpKSWvGcsmQPNCePG` |
| **claims-service web app URL** (already set as a Script Property on the dashboard) | `https://script.google.com/macros/s/AKfycbzrsk0ixP_q0jrkDtXyXeTo7NjspbQvgRVC4m7XUWTam3CIkfF0oazo5NYYRhuDw5Pr3Q/exec` |

---

## 3. Where things stand

### Phase 11A (DONE) — relocation
All 13 intake source files were copied into `automation-dashboard/` as `IntakeModule_*.js`, byte-for-byte except three renames confined to the moved files: `CONFIG`→`INTAKE_CONFIG`, `doGet`→`Intake_doGet` (dead/unwired), `jsonResponse`→`Intake_jsonResponse`. The standalone project was untouched.

### Phase 11B (DONE) — UI cutover + follow-ups
- The Intake Workspace's four data screens and **Run Intake** now call the module **in-process** (no HTTP to the standalone app). Adapter: `callIntakeModuleAction_` in `automation-dashboard/Code.js`; process runner: `runIntakeModuleProcess_`.
- Added **Run Asbestos Intake** / **Run Itel Intake** buttons (Actions panel) → `runAsbestosWorkspaceProcess` / `runItelWorkspaceProcess` → `runIntakeVendorWorkspaceProcess_` (in-process).
- Added dashboard-level **caching** of the expensive Gmail-heavy source responses: `getIntakeWorkspaceSourceResponses_` (120s TTL), plus removal of a redundant duplicate insurance queue-health call. `getIntakeWorkspaceSummary(options)` and the client `loadIntakeWorkspaceSummary_(forceRefresh)` gained a force-refresh path (refresh button + after runs bypass cache; initial load + audit/link-save use cache).
- Manifest (`automation-dashboard/appsscript.json`) gained explicit OAuth scopes (Gmail + Drive are the new ones).

### Phase 11C (NOT STARTED) — this handoff
Flip External_Links writes to go through Claims Service; make Claims Service the sole External_Links writer.

---

## 4. Current External_Links write behavior (critical to understand before 11C)

The intake pipeline `processInsuranceIntake()` (in `IntakeModule_Code.js`, ~line 189) ends by calling **`saveInsuranceIntakeExternalLinks_()`** (~line 485). That function is **already flag-gated** and already knows how to call Claims Service. Its branching:

- **Primary mode** (`USE_CLAIMS_SERVICE_EXTERNAL_LINKS=true`): call Claims Service (`callClaimsServiceSaveIntakeExternalLinks_`). On success, return — **no direct write**. On failure, fall back to the direct write. (Single write; fallback only.)
- **Shadow mode** (`CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE=true`, primary off): do the **direct** write, then *also* call Claims Service in shadow (`allowCreate:false`) purely to compare. This is the **current** state.
- **Neither**: direct write only.

**Current flag values (set on the dashboard project's Script Properties this session):**
- `USE_CLAIMS_SERVICE_EXTERNAL_LINKS` = **`false`**  → direct write is the primary path today
- `CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE` = **`true`** → Claims Service is being shadow-called for comparison

**So 11C's core action is small and low-risk:** validate shadow parity, then flip `USE_CLAIMS_SERVICE_EXTERNAL_LINKS` to `true`. The direct write becomes fallback-only. Deleting the direct write / spreadsheet knowledge is **deferred** (the prompt says keep rollback until explicitly instructed).

---

## 5. Exact code locations for 11C

### 5.0 ⚠️ Corrections to the Phase 11C prompt (important)
- **There is NO `IntakeModule_ClaimsBridge.js` file.** The prompt says to read it; it does not exist. The "bridge" functions (`callClaimsServiceSaveIntakeExternalLinks_`, `buildClaimsServiceExternalLinksPayload_`, the flag readers) live **inside `IntakeModule_Code.js`**.
- **`processIntakeClaim` is implemented but NOT routed** in `claims-service/Code.js` (verified: 0 `case 'processIntakeClaim'`). This is the claim-*creation* endpoint (`IntakeIntegrationService.js:11`), **not** the External_Links endpoint. 11C as scoped (External_Links only) does **not** require it, but it's the obvious next gap for a later phase. Don't confuse it with `saveIntakeExternalLinks`.

### 5.1 The intake direct-write path — in `automation-dashboard/IntakeModule_Code.js`
| Function (approx line) | Role |
|---|---|
| `processInsuranceIntake()` (~189) | Pipeline; calls `saveInsuranceIntakeExternalLinks_` at the end. |
| `saveInsuranceIntakeExternalLinks_()` (~485) | **The decision point.** Primary/shadow/direct branching. |
| `saveInsuranceIntakeExternalLinksDirect_()` (~539) | **Direct Claims DB write** — opens the sheet. Target for retirement (keep as fallback for now). |
| `upsertInsuranceIntakeWideExternalLinks_()` (~838) | The actual wide-format upsert into `External_Links` (appendRow / setValue). Direct write. |
| `buildClaimsServiceExternalLinksPayload_()` (~586) | Builds the payload sent to Claims Service. **Preserve exactly** — this is the contract. |
| `callClaimsServiceSaveIntakeExternalLinks_()` (~635) | POSTs to `claims-service ?action=saveIntakeExternalLinks`. |
| `getClaimsServiceWebAppUrl_()` (~689) | Reads `CLAIMS_SERVICE_WEB_APP_URL` property. |
| `isClaimsServiceExternalLinksPrimaryEnabled_()` (~715) / `...ShadowEnabled_()` (~701) | Read the two feature flags. |
| `getInsuranceIntakeClaimFoundationSpreadsheetId_()` (~828) | Returns the Claims DB ID with a **hardcoded `1LWU…` fallback** — this is the "Intake knows the spreadsheet ID" that 11C step 5 eventually removes. |
| `ensureExternalLinksClaimNumberColumn()` (~1168) | Header DDL on External_Links — becomes a Claims-Service responsibility. |
| `isRealIntakeClaimNumber_()` (~1137) | **Subtle guard** — prevents writing a job-number fallback into the Claim Number column. Confirm Claims Service's path has an equivalent before deleting the direct path. |

### 5.2 The Claims Service target — confirmed present
| Location | Status |
|---|---|
| `claims-service/ExternalLinkService.js:119` `saveIntakeExternalLinks(payload)` | **Exists.** Does wide-format upsert with validation, dedupe, claim matching, `allowCreate`/`preventCreate`/`shadowMode` support. |
| `claims-service/Code.js:171–172` `case 'saveIntakeExternalLinks': return jsonResponse_(saveIntakeExternalLinks(payload));` | **Routed.** |
| `claims-service/ExternalLinkService.js:8` `addExternalLink(claimId, payload)` | Row-format single link (used by `processIntakeClaim`). |
| Validation helpers in `ExternalLinkService.js`: `normalizeIntakeExternalLinksPayload_`, `buildIntakeExternalLinksWideColumnMap_`, `findMatchingIntakeExternalLinksWideRow_`, `updateIntakeExternalLinksWideRow_` | **Validation already lives in Claims Service** (11C step 4 is largely already satisfied). |

### 5.3 ⚠️ The SECOND direct External_Links writer — `automation-dashboard/Code.js`
The Intake Workspace's **"add operational link"** feature (the missing-links forms) writes External_Links **directly**, separate from the intake pipeline:
- `saveIntakeOperationalLink(payload)` (~1211) → `getIntakeExternalLinksContext_()` (~1977, opens the Claims DB) → `appendIntakeExternalLink_()` (~2285, appends/updates rows).

**For the success criterion "Claims Service is the SOLE owner of External_Links," this path must ALSO be converted** to call `saveIntakeExternalLinks` (or `attachExternalLink`). The 11C prompt is worded around "the Intake module" and may overlook this. **Flag it to the user**: either include it in 11C or explicitly defer it — but note that leaving it means Claims Service is not literally the *sole* writer.

### 5.4 Other External_Links writers (context, out of 11C intake scope)
Per `docs/diagnostics/claims-database-write-map.md`, External_Links has **four** writers total: `claims-service` (canonical), `insurance-intake-automation`/module (this migration), `automation-dashboard` (§5.3), and `claims-data-foundation` (legacy bulk import). The legacy `claims-data-foundation` writer is a separate cleanup, not 11C.

---

## 6. Script Properties & deployment mechanics

**Script Properties currently set on the dashboard project** (via the temp setup helper this session): `CLAIMS_SERVICE_WEB_APP_URL`, `TODOIST_API_TOKEN`, `TODOIST_PROJECT_ID` (`6gXFgfjffVRQRMqP`), `TODOIST_ASSIGNEE_ID_CLARENCE` (`58990561`), `USE_CLAIMS_SERVICE_EXTERNAL_LINKS`=`false`, `CLAIMS_SERVICE_EXTERNAL_LINKS_SHADOW_MODE`=`true`.

**Deployment gotcha that cost real time this session:** `clasp push` uploads code but **does NOT update a web app** — the web app serves a *pinned deployment version*. After pushing, you must **Deploy → Manage deployments → Edit → New version → Deploy**, or use the **`/dev` test URL** (always runs latest). Tell-tale that old code is live: the Intake Workspace loading line. New code says **"Loading intake workspace..."**; old code says "Refreshing intake queue health...".

**Rotate the Todoist token:** it was shared in plaintext during setup — the user should generate a new one and re-run `setTodoistApiTokenForPhase11B('new-token')`.

---

## 7. Known issues / outstanding (user said "several issues in intake")

- **Cold-load performance.** `getIntakeWorkspaceSummary` does ~40+ synchronous Gmail searches; ~13–30s cold. The 120s cache makes repeat loads fast but the **first** load after cache expiry is slow, and reloading mid-load prevents the cache from populating (this is what made the page look "stuck"). Confirmed working once the cache is warm.
- **Pending decision (unanswered — user pivoted to 11C):** whether to add a **scheduled cache-warm task** (recommended: every ~5 min, business hours, with a longer TTL) and/or a **non-blocking UI** (render shell + KPIs instantly, stream heavy sections). These would make cold loads a non-issue. Offer these early in 11C or as a parallel task.
- **Unspecified intake issues.** The user referenced "several issues in intake" without enumerating them. **Ask them to list specifics** at the start of 11C; some may be side effects of the cold-load/caching behavior above.
- **Deferred from 11B:** intake **retry** actions still route through the generic automation grid / shared `runAutomation()` over HTTP to the standalone app (intentionally not internalized, to avoid touching shared infra). Documented in the Phase 11B report's "Deferred Cross-Workspace Automation Actions."

---

## 8. Temporary files to clean up (created this session)

| File | Status | Action |
|---|---|---|
| `automation-dashboard/IntakeModule_Phase11BSetup.js` | Token already stripped; helpers `setPhase11BScriptProperties` / `setTodoistApiTokenForPhase11B` / `listPhase11BScriptProperties` (+ `runPhase11BScriptPropertySetup`). | Delete once properties are confirmed (they are). Sandbox couldn't delete it; needs manual `rm` + push, or leave harmlessly. |
| `automation-dashboard/IntakeModule_Phase11BDiag.js` | `diagnoseIntakeWorkspaceSummaryTiming` timing wrapper. | Delete after 11C perf work. |

Also: `git status` shows **3 pre-existing modified files** in the standalone `insurance-intake-automation/` (`Code.js`, `Config.js`, `Parsing.js`) that were dirty **before** this session — not from this work. The user should review/commit or discard those separately.

---

## 9. Do-not-touch / preserve list for 11C

- **Standalone `insurance-intake-automation/`** — the rollback path. Do not push changes.
- **The relocated `IntakeModule_*` business logic** — parsing, folder matching, duplicate detection, Todoist, calendar, labels, retries, queue health. Frozen. 11C only changes *where the External_Links write goes*, not the pipeline.
- **Shared `runAutomation()`** in `automation-dashboard/Code.js` — used by all automations. Not modified in 11B; keep it that way.
- **Dashboard `doGet`, `Intake_doGet`** (dead), and the Intake Workspace **UI** — no UI changes in 11C.
- **EOJ, Morning Automation, triggers** — untouched.
- **The payload contract** `buildClaimsServiceExternalLinksPayload_` and the `saveIntakeExternalLinks` request shape — preserve exactly.
- **Rollback capability** — keep the direct-write path (`saveInsuranceIntakeExternalLinksDirect_` / `upsertInsuranceIntakeWideExternalLinks_`) as an automatic fallback until explicitly told to delete it.

---

## 10. Suggested 11C sequence (low-risk, matches the prompt + constraints)

1. **Read & confirm** (per prompt): `IntakeModule_Code.js` bridge functions, `IntakeModule_Config.js` flags, `claims-service/ExternalLinkService.js` `saveIntakeExternalLinks`, its routing and validation. Confirm §5.0 corrections.
2. **Validate shadow parity.** With shadow mode on (current), compare what the direct write produces vs. what `saveIntakeExternalLinks` would write, for real intake runs. The code already returns a shadow summary for diffing. Confirm the `isRealIntakeClaimNumber_` guard behavior exists on the Claims Service side.
3. **Flip to primary.** Set `USE_CLAIMS_SERVICE_EXTERNAL_LINKS=true`. Now Claims Service performs the write; the direct path only fires on Claims-Service failure (automatic fallback). No duplicate write.
4. **Convert the second writer (§5.3)** — `saveIntakeOperationalLink` → call Claims Service. (Or explicitly defer, with the user's OK, noting the "sole owner" caveat.)
5. **Verify** (deliverable): grep the intake module for `SpreadsheetApp.openById`, `External_Links`, `appendRow`, `setValues`, `upsertInsuranceIntakeWideExternalLinks_`, `saveInsuranceIntakeExternalLinksDirect_` — confirm they only exist on the retained-fallback path and are not reached in primary mode; confirm Claims Service receives every request; confirm flags still work; confirm rollback preserved.
6. **Do NOT delete** the direct writers or the spreadsheet-ID knowledge yet (rollback retained per constraints). That removal is a later explicit cleanup.

---

## 11. Rollback

- **Instant flag rollback:** set `USE_CLAIMS_SERVICE_EXTERNAL_LINKS=false` → intake reverts to direct writes immediately (the direct path is retained and is also the automatic fallback on any Claims-Service error).
- **Full 11C rollback:** git-revert the 11C commit(s); flags return to current state.
- **Standalone project** remains deployed and authoritative as the ultimate fallback.

---

## Appendix — deliverables already produced this session (the user has these)
- `Rainbow_Phase11_Insurance_Intake_Migration_Plan.docx` (full 10-part migration plan)
- `Rainbow_Phase11A_Completion_Report.docx`
- `Rainbow_Phase11B_Report.docx` (incl. the deferred-actions section)

These are in the user's session outputs, not the repo. The facts they contain are summarized above.
