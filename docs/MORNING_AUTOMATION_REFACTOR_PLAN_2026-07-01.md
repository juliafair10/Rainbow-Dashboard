# Morning Automation Refactor — Plan for Approval
*July 1, 2026*

Orchestration-only refactor of `runRainbowMorningAutomation()` in `claims-service/MorningAutomationService.js`. No engine, intake, or EOJ behavior changes — only reorganizing which function calls which, and when. This plan needs Julia's explicit approval before any code is written.

Decisions already confirmed by Julia:
- Scope is contained to `claims-service` (not cross-project).
- Keep the single 6 AM trigger. `runRainbowMorningAutomation()` stays as a wrapper that calls all three phases in sequence. No trigger changes in this pass.
- Three new independently-callable phase functions: `runMorningDataRefresh()`, `runMorningIntelligence()`, `runMorningBrief()`.

---

## 1. Audit (verified against live file)

`MorningAutomationService.js`, 10 steps, each wrapped by `runMorningAutomationStep_`:

| # | Step | Defined in |
|---|---|---|
| 1 | `processDailyOpenJobsEmailIntake` | `ReportEmailIntakeService.js` |
| 2 | `importLatestDailyOpenJobsReport` | `ReportImportService.js` |
| 3 | `reconcileDailyOpenJobsRemovedClaims` | `ReportImportService.js` |
| 4 | `processComplianceTasksEmailIntake` | `ReportEmailIntakeService.js` |
| 5 | `importNewHistoricalNotes` (via wrapper) | `HistoricalNotesImportService.js` |
| 6 | `rebuildTimelineDerivedFieldsForActiveClaims` (via wrapper) | `TimelineEngineService.js` |
| 7 | `synchronizeClaimsFoundation` (via wrapper) | `ClaimSynchronizationService.js` |
| 8 | `reconcileClaimConditions` (via wrapper) | `ConditionEngineService.js` |
| 9 | `applyClaimHealth` (via wrapper) | `HealthEngineService.js` |
| 10 | `refreshHomepageData` | HTTP call to `automation-dashboard` |

Confirmed: single trigger in the project (`createRainbowMorningAutomationTrigger` → `runRainbowMorningAutomation`), no `CalendarApp` usage anywhere, `importLatestComplianceTasksReport()` exists in `ReportImportService.js` but is only referenced in a commented-out line — never wired in.

---

## 2. Proposed phase assignment

**`runMorningDataRefresh()`** (Phase 1):
1. `processDailyOpenJobsEmailIntake`
2. `importLatestDailyOpenJobsReport`
3. `reconcileDailyOpenJobsRemovedClaims` — kept here per Julia's decision (§4): it's currently part of reconciling Claims against the DOJ report, so later intelligence steps operate on the already-reconciled dataset. Revisit once lifecycle/removed-claim handling is separated more cleanly.
4. `processComplianceTasksEmailIntake`
5. `importNewHistoricalNotes`
6. `synchronizeClaimsFoundation` — kept as a single call (not splitting its internal alert-reconciliation sub-step out). Modifying its internals is a bigger change than orchestration and isn't part of this pass.

**`runMorningIntelligence()`** (Phase 2):
1. `rebuildTimelineDerivedFieldsForActiveClaims`
2. `reconcileClaimConditions`
3. `applyClaimHealth` — must run after conditions (unchanged, documented dependency)

**`runMorningBrief()`** (Phase 3):
1. `refreshHomepageData` — only step here today; this phase is intentionally thin.

`runRainbowMorningAutomation()` becomes: call `runMorningDataRefresh()` → `runMorningIntelligence()` → `runMorningBrief()`, merge all step results into one summary, write one `Claim_Service_Log` entry (same log shape as today, so nothing downstream that parses that log breaks).

---

## 3. Dependency map

Hard dependencies (must preserve):
- `importLatestDailyOpenJobsReport` before `reconcileDailyOpenJobsRemovedClaims` (bootstrapped rows must exist first).
- `reconcileClaimConditions` before `applyClaimHealth` (health reads that day's just-reconciled conditions — documented in code, reinforced by Phase 7.5 changes earlier today).
- `refreshHomepageData` last (reflects finished intelligence).

No other ordering dependency is documented in code between the remaining steps.

---

## 4. Placement decision — resolved

`reconcileDailyOpenJobsRemovedClaims` marks claims missing from the DOJ report as **Operationally Complete** — a lifecycle decision, conceptually Phase 2, but it runs early today (position 3, before compliance intake / historical notes / synchronizeClaimsFoundation).

I checked whether anything actually depends on it running early: `synchronizeClaimsFoundation`'s internal alert reconciliation (step 6) and `bulkRebuildTimelineDerivedFieldsForActiveClaims` both filter to claims whose `Lifecycle_State` is still "active" (`isAlertPersistenceActiveClaim_` in `AlertService.js`), so moving this step later would introduce a one-day alert-timing quirk (self-correcting, non-blocking).

**Decision: keep it in Phase 1**, immediately after `importLatestDailyOpenJobsReport`, in its current position. Rationale (Julia): it's currently part of reconciling the Claims table against the DOJ report, so later intelligence steps should operate on the already-reconciled dataset. Revisit once lifecycle/removed-claim handling is separated more cleanly. Zero behavior/timing change from today.

---

## 5. What stays shared

- `runMorningAutomationStep_` — per-step timing/error wrapper, used by all three phase functions.
- `logRainbowMorningAutomation_` — one combined log write at the end of `runRainbowMorningAutomation()`, not per-phase, to keep the existing log shape.
- `nowIso()` — unchanged.

New, optional, low-risk additions:
- `testRunMorningDataRefresh()`, `testRunMorningIntelligence()`, `testRunMorningBrief()` — manual test entry points mirroring `testRunRainbowMorningAutomation()`, so each phase is independently testable without touching triggers.
- `testRainbowMorningAutomationSearchOnly()` — unchanged.

---

## 6. Risks

- No new partial-run risk in production: since `runRainbowMorningAutomation()` still calls all three phases in sequence from one trigger, behavior is unchanged. Partial-run risk only becomes relevant later, if/when the phases get separate triggers — explicitly deferred.
- §4's placement decision (Option A vs B) affects timing of one step; recommend Option B to avoid it entirely.
- `synchronizeClaimsFoundation`'s internal mixing (data repair + alert reconciliation) is not being split in this pass — flagged as a future observation only.
- Homepage refresh remains a cross-project HTTP call; Phase 3 is thin by design, not a bug.
- No clasp/Apps Script execution credentials in this environment — verification will be `node --check` syntax validation plus manual trace-through; Julia runs live tests herself.

---

## Next step

Confirm §4 (Option A or B), then I'll write the refactor: three new phase functions, thin `runRainbowMorningAutomation()` wrapper, no trigger changes, plus the three optional test entry points. I will not write code until you approve this plan.
