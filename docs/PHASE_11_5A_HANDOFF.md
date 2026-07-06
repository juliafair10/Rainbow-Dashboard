# Rainbow Platform — Phase 11.5A Handoff (Functional Stabilization Round 1)

**Date:** 2026-07-06
**Purpose:** Seed a fresh chat for **Phase 11.5A**. Read this first, then the Phase 11.5A prompt. Where they differ, this doc reflects the **actual code on disk as of 2026-07-06**.
**Nature of phase:** Strictly a **stabilization pass**. No redesign, no new architecture, no Claims Service changes, no caching work.

---

## 0. How to use this document

- All paths are absolute on the user's machine. The repo is a set of Google Apps Script projects synced via `clasp`.
- **Anchor on function/file names**, which are stable; line numbers drift.
- Nothing here is "already done for 11.5A." This is the starting state.
- The **Homepage** and **Claims Workspace** UIs live in the **`automation-dashboard`** project. The **lens / health / condition / ownership logic** lives in **`claims-service`**. This split matters for the "do not touch Claims Service" constraint — see §6.

---

## 1. Files the new chat needs access to

Grant the fresh chat access to the repo root: `/Users/JuliaFair/Rainbow-Dashboard/`.

### Read-first context (docs/)
- `docs/PHASE_11_5A_HANDOFF.md` (this file)
- `Rainbow_Phase11A_Completion_Report.docx`, `Rainbow_Phase11B_Report.docx`, `docs/Rainbow_Phase11C_Report.docx`, `docs/Rainbow_Phase11D_Report.docx`
- `docs/PHASE_11C_HANDOFF.md`
- Build guide / architecture: `apps-script-projects/eoj-app/architecture-book.md`, `apps-script-projects/eoj-app/build-guide.md`, `HANDOFF.md`, `Rainbow_Handoff.md`, `docs/diagnostics/` (ARCHITECTURE_AUDIT, claims-database-write-map, trigger-deployment-inventory)

### Homepage (automation-dashboard) — **primary 11.5A surface**
- `apps-script-projects/automation-dashboard/HomepageDataService.js` — **the master homepage data builder** (`getHomepageClaimSummaryData()`); reads the Claims DB sheets directly.
- `apps-script-projects/automation-dashboard/HomepageService.js`, `HomepageApi.js` — service/API layer that the client calls.
- `apps-script-projects/automation-dashboard/HomepageView.html`, `HomepageScripts.html`, `HomepageComponents.html`, `HomepageClient.html`, `HomepageShell.html`, `HomepageStyles.html` — homepage UI (markup, client JS, styles).

### Claims Workspace (automation-dashboard UI + claims-service logic)
- UI (dashboard): `ClaimsView.html`, `ClaimsScripts.html`, `ClaimsShell.html`, `ClaimsStyles.html`, `ClaimActionsService.js`, and the `ClaimView*.html` / `Claim*.html` drawer/detail components.
- Logic (claims-service, **inspect only — see §6**): `ClaimsLensService.js` (`getClaimsForLens(lensId, options)`, `getClaimsLensCounts`, `filterClaimsByWorkspaceRoute_`), `ClaimsWorkspaceService.js`, `ClaimsQueryService.js`, `ClaimsOperationalAwarenessService.js`, `HealthEngineService.js`, `ConditionEngineService.js`, `OwnershipEngineService.js`, `AlertService.js`.

### Intake (automation-dashboard)
- `IntakeModule_QueueHealth.js` — queue-health computation.
- `IntakeView.html`, `IntakeScripts.html`, `IntakeStyles.html` — Intake Workspace UI.
- `Code.js` — `getIntakeWorkspaceSummary()` / `getIntakeWorkspaceSourceResponses_()` assemble what the workspace renders; `callIntakeModuleAction_()` runs module actions in-process.

### Do-not-touch / reference
- `claims-service/*` — **do not modify** (constraint). Inspect for understanding only.
- `apps-script-projects/insurance-intake-automation/` — standalone rollback project. Do not push changes.
- `IntakeModule_Phase11BSetup.js`, `IntakeModule_Phase11BDiag.js`, `Phase11C_TemporaryHelpers.js` — temporary helpers; leave for now.

---

## 2. Key IDs & deploy facts

| Thing | Value |
| :---- | :---- |
| Claims Database | `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c` |
| automation-dashboard script ID | `1FLiir_-mnSKqln336Vb8Fw74_ZDI_melrePqFcK70HMhzNvXCsyLqUlU` |
| claims-service script ID | `1eXZu58To5G0STkEXdONwUO1YIIqILvwEfwQkzoM4hiCc1z4VAcECMrkN` |
| EOJ DB | `10ja0fNFsY_KqDWIyW27D_9pEILjWoXOyIfXMsTufSPs` |

**Deploy gotcha (applies to every dashboard change):** `clasp push` uploads code but does **not** update the web app — it serves a *pinned* deployment version. After pushing, **Deploy → Manage deployments → Edit → New version → Deploy**, or use the **`/dev` URL** (always latest) to verify.

---

## 3. Where things stand (prior phases)

- **11A** — relocated insurance-intake code into `automation-dashboard` as `IntakeModule_*`.
- **11B** — Intake Workspace calls `IntakeModule_*` in-process (Queue Health, Diagnostics, Pending Inspection, Run Intake). Reads no longer hit the standalone web app.
- **11C** — External_Links writes route through Claims Service when `USE_CLAIMS_SERVICE_EXTERNAL_LINKS=true`; direct writers retained as fallback. **Flag currently `false` (shadow) until flipped/deployed.**
- **11D** — intake automation-grid execution cards run in-process via `runDashboardAutomation` dispatch; flag `USE_INTERNAL_INTAKE_MODULE` (default true). `runAutomation` untouched.
- **EOJ visibility detour** — Extension Poles, tomorrow's-calendar question, history expansion, full Google Chat report. Needs `repairEOJLogColumns()` run after deploy.

**Deployment status:** 11A–11D + the EOJ detour are **committed to git** (as of 2026-07-06). They are **not yet `clasp push`ed / redeployed** to the live Apps Script projects, so a commit ≠ live. See the issue tracker (`Rainbow_Systems_Check_Issue_Tracker.xlsx`) for the open list. **11.5A should still assume none of these are live in the deployed web apps unless verified via the `/dev` URL or a fresh deployment.**

---

## 4. Issue-by-issue file map + initial findings

> These are **starting pointers and hypotheses**, not confirmed diagnoses. The new chat should confirm each against the code.

### HOMEPAGE — `HomepageDataService.js` unless noted

1. **Search bar** — References to "search" appear only in `HomepageView.html` / `HomepageStyles.html` (markup/styles); no obvious search handler in the data/script layer. **Hypothesis: the search bar is UI-only and not wired to a backend lookup.** Fix likely spans `HomepageScripts.html` (client handler) + a lookup function; results should open the claim in Claims Workspace (see drilldown mechanism below).
2. **Operational Awareness** — `buildHomepageClaimsOperationalAwareness_()` builds the cards. Each card should drill into Claims Workspace with a filter. Drilldown filters are consumed by claims-service `filterClaimsByWorkspaceRoute_` via route params (`ownershipArea`/`ownership`, `conditionType`, `claimId`, `lensId`). Verify the homepage cards emit the correct route params and that `ClaimsScripts.html` honors them.
3. **Today's Priorities** — `getHomepageTodayPriorities_()`. "Stale tags" and "refresh using current data" → check how priorities/tags are computed and whether they read live sheet rows (`getHomepageSheetRows_`) vs a stale source. **"Verify Health Engine is being used":** homepage appears to compute staleness itself (`getHomepageBecomingStale_`, §4/Watchlist) rather than calling claims-service `HealthEngineService`. Confirm; if it rolls its own, decide whether to *call* the Health Engine (calling ≠ modifying Claims Service) or leave as-is.
4. **Watchlist** — `getHomepageBecomingStale_()`. Severe staleness escalation lives here. Also the "not serving stale/frozen data" check: confirm the homepage reads live sheets each load and whether any existing cache freezes data. **Note:** the phase says *do not work on caching* — if frozen data traces to a cache, flag it rather than adding/removing caching without approval.
5. **Open Alerts (Open EOJ / Add Link)** — the two actions should deep-link into the workflows: "Open EOJ" → EOJ app; "Add Link" → the Intake Workspace operational-link form (`saveIntakeOperationalLink` path). Find where alert actions render (`HomepageComponents.html` / `HomepageScripts.html`) and wire the links.
6. **Recent Activity** — `getHomepageRecentActivity_()`. Multiple EOJ events for one claim should collapse into a single activity; remove noisy duplicates. This is a grouping/dedup change in that function. (Note: the EOJ interpreter writes both an "EOJ Submitted" event and a visit-specific event per submission — likely source of duplicate activity rows.)
7. **Conditions Visibility** — `getHomepageConditionsVisibility_()`. Clicking a condition should open Claims Workspace filtered to that condition via the `conditionType` route param (claims-service `claimHasRouteCondition_`).
8. **Workflow Blockers ("+X more")** — find the blockers card in `HomepageComponents.html`/`HomepageScripts.html`; "+X more" should expand the full blocker list (client-side expand).
9. **Compliance Activity** — leave placeholder if unfinished; **do not invent functionality.**

### CLAIMS WORKSPACE

- **Repair Claims lenses** and ensure homepage drilldowns open correctly. Lenses: **Needs Attention, Waiting on Insurance, Conditions, Ownership, Operational Awareness, Search.**
- Lens logic is `claims-service/ClaimsLensService.js` → `getClaimsForLens(lensId, options)` (cases: `needsAttention`, `waitingOnInsurance`, `missingEoj`, `paidMonitoring`, `closed`, `all`) and `filterClaimsByWorkspaceRoute_` (route params: `ownershipArea`, `conditionType`, `claimId`).
- UI/routing is `ClaimsView.html` + `ClaimsScripts.html` (dashboard). **Prefer fixing the dashboard UI/routing layer** (how it calls claims-service and passes filters) over changing claims-service — see §6.

### INTAKE

1. **Reduce Queue Health noise** — `IntakeModule_QueueHealth.js` computes the workflows; `IntakeView.html`/`IntakeScripts.html` render them. Show only failures/problems; hide healthy workflows by default (likely a render/filter change in the workspace, or a flag in the summary assembled by `getIntakeWorkspaceSummary()` in `Code.js`).
2. **Issue cards deep-link into affected files** — e.g., "Asbestos Intake (5)" opens those 5 files. Trace how queue-health items reference the underlying Gmail threads / Drive files (`IntakeModule_QueueHealth.js` and the folder/attachment modules) and surface a link in the workspace card.

---

## 5. Drilldown mechanism (shared by Homepage → Claims Workspace)

Claims Workspace filtering is driven by route params consumed in `claims-service/ClaimsLensService.js`:
- `lensId`: `needsAttention` | `waitingOnInsurance` | `missingEoj` | `paidMonitoring` | `closed` | `all`
- `ownershipArea` (a.k.a. `ownership`), `conditionType`, `claimId`

Homepage cards must build links/state that carry these params, and `ClaimsScripts.html` must read and apply them on load. Most "drilldown doesn't open the right filter" bugs are one of: (a) homepage not emitting the param, (b) `ClaimsScripts.html` not reading it, or (c) a param-name mismatch. Fixing (a)/(b)/(c) is dashboard-only.

---

## 6. ⚠️ Constraint tension to resolve early

The prompt says **"Do NOT touch Claims Service"** but also **"Repair Claims lenses"** — and the lens logic lives in `claims-service/ClaimsLensService.js`. Resolution:
- **Confine repairs to the dashboard UI/routing layer** (`ClaimsView.html`, `ClaimsScripts.html`, `ClaimActionsService.js`, homepage card link-building). Most drilldown/lens-open bugs are param-passing/rendering issues fixable here.
- If a root cause is genuinely inside `ClaimsLensService.js` / other claims-service files, **stop and get explicit approval** before editing claims-service — that would violate the constraint.
- Similarly, "Verify Health Engine is being used" may tempt a claims-service call. *Calling* claims-service from the dashboard is fine; *modifying* claims-service is not.

Other constraints (from the prompt): no UI redesign, no new architecture, no caching, no EOJ changes. The **stale/frozen data** item (Homepage #4) intersects the no-caching rule — investigate read-only and flag before changing any cache.

---

## 7. Deliverables expected (per prompt)

- Files changed
- Root causes found
- Verification checklist
- Remaining issues

---

## 8. Verification realities

- After changes: `clasp push` the `automation-dashboard` project, then **redeploy the web app** (or use `/dev`) — otherwise nothing appears.
- The homepage reads the Claims DB sheets directly (`getHomepageSheetRows_`), so "current data" means live sheet reads; confirm no stale source.
- Keep `USE_CLAIMS_SERVICE_EXTERNAL_LINKS` and `USE_INTERNAL_INTAKE_MODULE` as-is unless the phase explicitly requires otherwise; 11.5A is stabilization, not a flip.
- 11A–11D + EOJ are already committed, so 11.5A changes land on a clean boundary. Remaining gate is deployment (`clasp push` + web-app redeploy), not commits.
