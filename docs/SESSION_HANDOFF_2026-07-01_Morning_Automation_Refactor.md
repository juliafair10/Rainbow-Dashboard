# Rainbow Claims Service — Handoff for Morning Automation Refactor
*July 1, 2026*

This handoff is for an **orchestration-only refactor**: splitting the single `runRainbowMorningAutomation()` function into three independent phase pipelines (Data Refresh → Intelligence → Brief/Actions). No business logic, engine behavior, or intake/EOJ behavior should change. The new chat needs to produce an audit, dependency map, and phase-classification plan for Julia's approval **before** touching any code. This handoff front-loads the audit work so that plan can be built quickly and accurately.

---

## Project Location

```
/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-service/
```

Claims Database Spreadsheet ID: `1LWUazEVzAbA5H0TDfvRJT0XZRJVN2ueZLfNJ_H-zj7c`. The entire current morning automation lives in **one file**: `MorningAutomationService.js`, inside the `claims-service` GAS project. No other project needs to change for the scope described in the new prompt (see Scope Clarification below).

**No clasp/Apps Script execution credentials exist in this sandbox.** Any refactor will need `node --check` syntax validation plus careful manual trace-through, and Julia running live tests herself — same constraint as every prior session on this codebase.

---

## Critical scope clarification (resolve with Julia before planning phases)

The new prompt's "typical responsibilities" lists (Insurance Intake processing, EOJ imports, Calendar synchronization, Compliance Engine, etc.) describe the *whole Rainbow platform* conceptually. In reality:

- **Insurance Intake processing** runs in a *separate* GAS project (`insurance-intake-automation`) on its own Gmail trigger. It is not part of `runRainbowMorningAutomation()` and — per `HANDOFF.md` — that project cannot directly call functions in `claims-service` (separate runtimes).
- **EOJ imports** run in `eoj-processing-engine`, a separate project on its own 15-minute time trigger (per `HANDOFF.md`). Also not part of this function.
- **Calendar synchronization** — no `CalendarApp` usage was found anywhere in the morning automation path. It may not exist yet as an automated step, or may live somewhere else not yet located.
- **Compliance Engine** — does not exist as an intelligence/evaluation step. Only `processComplianceTasksEmailIntake()` (raw XLSX intake) is wired in today. There's a commented-out, never-enabled placeholder for `importLatestComplianceTasksReport()` in `MorningAutomationService.js` (see audit below) — no compliance *evaluation* logic exists to classify into Phase 2.
- **Homepage refresh** is cross-project: the current step (`runMorningHomepageRefresh_`) calls the `automation-dashboard` project over HTTP (`UrlFetchApp.fetch`), not a direct function call, because it's a separate GAS runtime.

**Recommendation for the new chat:** confirm with Julia whether the refactor scope is (a) reorganizing the 10 steps that actually exist today inside `claims-service`'s `runRainbowMorningAutomation()` into three new entry-point functions in the same project (the achievable, contained interpretation), or (b) something broader spanning multiple GAS projects (which would require new cross-project orchestration, not just reorganization, and conflicts with "do not redesign" and "orchestration only"). Everything below assumes interpretation (a), since that's what actually exists and matches "do not change intake/EOJ behavior."

---

## Audit: current `runRainbowMorningAutomation()` (as of this handoff)

**File:** `/Users/JuliaFair/Rainbow-Dashboard/apps-script-projects/claims-service/MorningAutomationService.js`

Single trigger: `createRainbowMorningAutomationTrigger()` creates a daily time-based trigger at the 6 AM hour calling `runRainbowMorningAutomation`. That's the *only* trigger in `claims-service` (confirmed — no other `ScriptApp.newTrigger` calls exist in this project). `deleteRainbowMorningAutomationTriggers()` is the matching teardown. Both will need updating if the entry point(s) change.

Current step order (each wrapped by `runMorningAutomationStep_(stepName, stepFunction)`, which times the step, catches errors, and returns a uniform `{stepName, success, status, message, result}` record — this wrapper is almost certainly something all three new phases should keep sharing):

| # | Step name | Function called | Defined in | Notes |
|---|---|---|---|---|
| 1 | `processDailyOpenJobsEmailIntake` | `processDailyOpenJobsEmailIntake()` | `ReportEmailIntakeService.js` | Saves DOJ XLSX attachment from Gmail to Drive. Raw intake. |
| 2 | `importLatestDailyOpenJobsReport` | `importLatestDailyOpenJobsReport()` | `ReportImportService.js` | Bootstraps new Claims rows, updates Last Activity Date. Must run before step 3 (comment in code explains why). |
| 3 | `reconcileDailyOpenJobsRemovedClaims` | `reconcileDailyOpenJobsRemovedClaims()` | `ReportImportService.js` | Marks claims missing from the DOJ report as Operationally Complete — this is a lifecycle *decision*, arguably intelligence, not pure data refresh (see Ambiguous Classifications below). |
| 4 | `processComplianceTasksEmailIntake` | `processComplianceTasksEmailIntake()` | `ReportEmailIntakeService.js` | Saves compliance XLSX. Raw intake. |
| 5 | `importNewHistoricalNotes` | `runMorningHistoricalNotesImport_()` → `importNewHistoricalNotes()` | wrapper in `MorningAutomationService.js`; real function in `HistoricalNotesImportService.js` | Incremental — only imports notes newer than last import. Raw data enrichment onto `Timeline_Events`. |
| 6 | `rebuildTimelineDerivedFieldsForActiveClaims` | `runMorningTimelineRebuild_()` → `bulkRebuildTimelineDerivedFieldsForActiveClaims()` | wrapper in `MorningAutomationService.js`; real function in `TimelineEngineService.js` | Derives `Last_Meaningful_Activity_At` / `Last_Revision_At` from timeline rows. This is a **derived/intelligence calculation** — classify into Phase 2, not Phase 1, despite currently running early. |
| 7 | `synchronizeClaimsFoundation` | `runMorningSynchronizeClaimsFoundation_()` → `synchronizeClaimsFoundation({dryRun:false, quiet:true})` | wrapper in `MorningAutomationService.js`; real function in `ClaimSynchronizationService.js` | Mixed: mostly raw field repair/enrichment (Phase 1-ish), but its internal Step 6 ("reconcile structured operational alerts") evaluates claims against data and writes/resolves alerts — that's intelligence-like. See Ambiguous Classifications. |
| 8 | `reconcileClaimConditions` | `runMorningConditionReconciliation_()` → `batchReconcileClaimConditions()` | wrapper in `HealthEngineService.js`(added there)/declared near top; real function in `ConditionEngineService.js` | Condition Engine — clearly Phase 2. |
| 9 | `applyClaimHealth` | `runMorningHealthEvaluation_()` → `batchApplyClaimHealth()` | wrapper; real function in `HealthEngineService.js` | Health Engine — clearly Phase 2. **Must run after** step 8 in the same relative order (health reads that day's just-reconciled conditions) — see in-file comment explaining this dependency explicitly. |
| 10 | `refreshHomepageData` | `runMorningHomepageRefresh_()` | defined directly in `MorningAutomationService.js` | Cross-project HTTP call to `automation-dashboard`'s deployed web app (`UrlFetchApp.fetch(...&action=getHomepageData...)`). Clearly Phase 3 (uses completed intelligence, doesn't compute anything itself). Must run **last**. |

**Commented-out, not-yet-enabled placeholders** (still in the file, do not silently drop or enable these — flag them in the plan):
```js
// importLatestComplianceTasksReport();
// refreshHomepageData();
```

**Shared helpers used across all steps** (candidates for staying shared/utility rather than living in any one phase):
- `runMorningAutomationStep_(stepName, stepFunction)` — per-step timing/error wrapper.
- `logRainbowMorningAutomation_(status, message, details)` — writes to `Claim_Service_Log` via `writeServiceLog`.
- `nowIso()` — timestamp helper (defined elsewhere, used throughout).

**Existing test/trigger management functions that will need corresponding updates (not necessarily logic changes):**
- `createRainbowMorningAutomationTrigger()` / `deleteRainbowMorningAutomationTriggers()` — currently hardcoded to the single `runRainbowMorningAutomation` handler name.
- `testRainbowMorningAutomationSearchOnly()` — a lighter-weight test path (email search only, no writes).
- `testRunRainbowMorningAutomation()` / `testMorningHomepageRefresh()` — manual test entry points.

---

## Draft phase classification (starting point for the new chat's own audit — not a final decision)

**Phase 1 — Data Refresh (no intelligence):**
1. `processDailyOpenJobsEmailIntake`
2. `importLatestDailyOpenJobsReport`
4. `processComplianceTasksEmailIntake`
5. `importNewHistoricalNotes`
7. `synchronizeClaimsFoundation` — *if* its alert-reconciliation sub-step is judged data-repair-adjacent rather than intelligence; otherwise this step may need to be split (see below).

**Phase 2 — Intelligence Engine (derived, deterministic from refreshed data):**
3. `reconcileDailyOpenJobsRemovedClaims` — a lifecycle-state decision derived from refreshed data; likely belongs here despite running early today.
6. `rebuildTimelineDerivedFieldsForActiveClaims`
8. `reconcileClaimConditions`
9. `applyClaimHealth`
- `synchronizeClaimsFoundation`'s internal alert-reconciliation sub-step, if split out.

**Phase 3 — Morning Brief / Actions (uses completed intelligence only):**
10. `refreshHomepageData`
- Currently nothing else exists here — the prompt's other Phase 3 examples (Today's Priorities, management summaries, Todoist task generation, notifications, follow-up reminders) are not yet implemented as automated steps in this codebase. Don't invent them; just note the phase is currently thin.

## Ambiguous classifications to resolve explicitly in the plan (don't guess silently)

1. **`reconcileDailyOpenJobsRemovedClaims`** (step 3) currently runs *before* historical notes/timeline/condition/health steps, but conceptually it's a lifecycle decision (Phase 2-ish) sandwiched between two Phase-1 steps. Moving it will change *when* it runs relative to the DOJ report import it depends on (must still run after step 2) — need to confirm no other step implicitly depends on it running early.
2. **`synchronizeClaimsFoundation`** mixes raw repair (Steps 1-5 internally: names, claim numbers, external link association, carrier enrichment) with what reads as intelligence (internal Step 6: alert reconciliation). Splitting the *internal* steps of an existing function crosses from "reorganize orchestration" into "modify a function's internals" — flag this explicitly to Julia rather than deciding unilaterally. Safest default: keep `synchronizeClaimsFoundation` as one call in whichever phase makes the dependency chain work, and note the internal mixing as an observation rather than something this refactor fixes.
3. **Trigger design**: today there's one 6 AM trigger. Three independent entry points could mean (a) one trigger still calling all three in sequence, preserving current behavior exactly, or (b) three separate triggers at staggered times enabling true independent execution. The prompt explicitly asks for "each pipeline can be run independently" — this likely means (b), or at minimum manually callable independently, but changes production trigger behavior and should be called out as a decision point, not assumed.

---

## Design constraints carried over from Phase 7.5 (very recently completed — same day)

`TimelineEngineService.js`, `ConditionEngineService.js`, and `HealthEngineService.js` were all modified earlier today (Phase 7.5 — Later-Stage-Evidence fix and a timeline field-mapping fix; see `/Users/JuliaFair/Rainbow-Dashboard/docs/SESSION_HANDOFF_2026-07-01_Phase7.5.md` if useful background, though it's a separate, already-completed piece of work and not part of this refactor). Nothing about that work conflicts with this refactor, but the new chat should know:
- `batchReconcileClaimConditions()` and `batchApplyClaimHealth()` (steps 8 and 9) now depend on `evaluateConditionResolutionRecommendation_()` in `ConditionEngineService.js` reading real timeline data — preserve their current relative order (conditions before health) exactly, since that dependency is still true and explicitly documented in the existing code comments.
- Don't mistake the recent modification timestamps on these files for anything relevant to the refactor itself.

---

## Deliverables the new chat owes Julia before writing any code

Per her prompt, in order:
1. Audit of the current morning automation (the table above is a strong starting draft — verify it directly against the live file rather than trusting this handoff blindly, since it may drift if code changes again before that chat starts).
2. A dependency map (which steps must run before others, and why — most of this is already explained in code comments in `MorningAutomationService.js` and `ClaimSynchronizationService.js`).
3. Which functions move into which phase (use the draft classification above as a starting point, resolve the three ambiguous items explicitly).
4. What stays shared (`runMorningAutomationStep_`, `logRainbowMorningAutomation_`, and possibly a shared "run all three in sequence" convenience function for backward compatibility).
5. Risks introduced by the refactor (trigger timing changes, partial-run states if Phase 1 runs but Phase 2 doesn't get triggered, the `synchronizeClaimsFoundation` internal-mixing issue, cross-project homepage refresh still being an HTTP call not a true "phase").

**Do not write implementation code until Julia explicitly approves the plan** — this mirrors her established working pattern in this project (plan first, explicit "proceed" second) from every prior phase of work on this codebase.

---

## Existing documentation conventions (for whatever write-up accompanies this refactor)

- `/Users/JuliaFair/Rainbow-Dashboard/docs/SESSION_HANDOFF_2026-06-30.md` — good structural template (Project Location → Files Touched → Documentation Created → Key Facts → Pending → Critical Rules).
- `/Users/JuliaFair/Rainbow-Dashboard/HANDOFF.md` and `Rainbow_Handoff.md` — general claims-service and dashboard handoffs.
- No existing doc specifically covers the morning automation's own architecture in depth — the header comment block at the top of `MorningAutomationService.js` (Step order, Phase Fix-2 — 2026-07-01) is currently the closest thing to a living spec, and should probably be replaced/superseded by whatever this refactor produces.

---

## Critical rules (carry forward always)

Do NOT redesign Rainbow. Do NOT redesign any engine (Timeline, Lifecycle, Condition, Ownership, Health). Do NOT change intake, EOJ, timeline, health, condition, or ownership *behavior* — only reorganize which function calls which, and when. Preserve execution order wherever a real dependency exists (documented above and in the source files). Produce the audit/dependency-map/plan and get explicit approval before writing any refactor code.
