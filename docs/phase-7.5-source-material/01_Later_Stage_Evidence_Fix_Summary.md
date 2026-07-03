# Later-Stage-Evidence Fix — Implementation Summary

Implemented in `~/Rainbow-Dashboard/apps-script-projects/claims-service/`. No conditions auto-closed, no claim marked `Healthy` automatically — as scoped.

## Summary of changes

**`TimelineSynthesisService.js`** — new Quoted/Echoed Note Guard
- `getQuotedEchoSignals_(event)`: detects (a) an explicit reply attribution ("By \<name\> On \<date\>"), (b) two or more embedded "On \<date\>" references in one note.
- `isQuotedEchoEvent_(event, siblingEvents)`: true if either signal above fires on the row itself, or if the row shares its exact stored timestamp with a sibling row that fires either signal (catches echoes that themselves carry no date, by association with the batch they were re-imported in).
- `getGenuineEffectiveDate_(event)`: for a flagged row, prefers its embedded date over the stored import timestamp.
- `synthesizeActivitiesFromRawTimeline_` now tags every activity with `isQuotedEcho` and `genuineEffectiveDate`. Rows are never deleted, hidden, or rewritten — the flag only changes how chronology-sensitive logic treats them.

**`TimelineEngineService.js`**
- `deriveLastRevisionActivityForClaim_` (single-claim path) now excludes quoted-echo rows before selecting the latest revision candidate.
- `bulkRebuildTimelineDerivedFieldsForActiveClaims` (the production batch path) restructured to a two-pass approach: pass one collects every row per active claim plus its revision candidates; pass two runs the same guard using each claim's own rows as siblings, before picking the latest genuine revision date. `Last_Revision_At` write behavior is otherwise unchanged (single batched read/write, only for claims whose value actually changed).

**`ConditionEngineService.js`** — strengthened `evaluateConditionResolutionRecommendation_`
- Now filters out `isQuotedEcho` activities before building chronology, and sorts/compares using `genuineEffectiveDate` instead of the raw stored date.
- Added three new fields to every return path: `latestGenuineRevisionEventAt`, `latestPaymentOrAccountingEventAt`, `newerRevisionRequestAfterPayment` (computed directly, independent of the recommendation outcome, so the diagnostic always shows the evidence even when no recommendation is reached).
- Still Revision-Active-only, still read-only — never calls `resolveCondition`.

**`HealthEngineService.js`**
- `diagnoseClaimHealth`'s `openConditions` mapping now surfaces the three new fields alongside the existing `recommendedConditionResolution` / `resolutionRecommendationReason` / `confidence`.
- `evaluateConditionHealth_`'s `Revision Active` branch: the day-count staleness fallback (the path that used to go straight to `At Risk` and climb to `Escalated` via `applyEscalationPersistence_`) now checks the strengthened resolution recommendation first. If genuine payment/accounting evidence exists with no newer genuine revision request since, it returns a **suppressed `Attention Soon`** driver instead — reason text: *"Revision condition appears stale because later payment/accounting activity occurred. Review and resolve the condition if appropriate."* The `Follow_Up_Date`-based branches (explicit follow-up passed / scheduled) are unchanged, since those are a separate, already-approved mechanism. The condition itself is never touched — it stays open in `Claim_Conditions`.

## Before/after diagnostic — CLM-26A-0043-WTR

| | Before this fix | After this fix |
|---|---|---|
| Health level | `Escalated` (At Risk, day-count stale, persisted past 7 days) | `Attention Soon` |
| Health reason | "Revision is active, but revision momentum appears stale. At Risk has persisted beyond the escalation window." | "Revision condition appears stale because later payment/accounting activity occurred. Review and resolve the condition if appropriate." |
| `Revision Active` condition | Open | Still open — not auto-closed |
| `recommendedConditionResolution` | `true` (Phase 5, but order-fragile on tied timestamps) | `true` (now guard-verified, order-independent) |
| `latestGenuineRevisionEventAt` | not tracked | `2026-06-18T16:46:29.000Z` |
| `latestPaymentOrAccountingEventAt` | not tracked | `2026-06-25T23:53:45.000Z` |
| `newerRevisionRequestAfterPayment` | not tracked | `false` |

All 10 duplicate/echoed rows in the 2026-06-25 19:53:53–54 cluster are now correctly flagged `isQuotedEcho: true` (verified individually against real data — see test output below) and excluded from chronology comparisons. The one genuine row in that same timestamp cluster — the actual payment/accounting note — is correctly flagged `isQuotedEcho: false`.

## Test output

| # | Scenario | Result |
|---|---|---|
| 1 | CLM-26A-0043-WTR, real data, guard + recommendation + health-driver change | `Attention Soon`, condition remains open, evidence fields populated as above ✓ |
| 2 | Synthetic: genuine newer revision request after payment | `At Risk` (no suppression) — normal escalation preserved ✓ |
| 3 | Synthetic: Revision Active with no payment/accounting activity at all | `At Risk` — normal stale/escalation rules preserved ✓ |
| 4 | Payment/accounting-only note | classified `Payment`, not `Revision` ✓ |
| 5 | Real 2026-06-25 19:53 timestamp cluster (11 rows) | 10 echoed rows flagged `isQuotedEcho: true` (1 via self-contained date signals covering 9 of them, 1 via the timestamp-cluster fallback for the undated "Reviewer Note REVISIONS REQUESTED" fragment); the 1 genuine payment row flagged `false` ✓ |
| 6 | `Claim_Health_History` idempotency on immediate rerun | first apply writes a new row (`Escalated` → `Attention Soon`), second immediate apply skips (no duplicate) ✓ |

**Verification method**: same limitation as all prior phases — no clasp/Apps Script execution credentials in this sandbox. Verified via `node --check` syntax validation on every edited file (all clean) plus a faithful Node.js re-implementation of the exact new/changed functions run against the real extracted timeline data for `CLM-26A-0043-WTR` (script: `verify_later_stage_evidence.js`). You'll still need to run this live to confirm in production.

## Claims whose health changed

Only `CLM-26A-0043-WTR` was tested against real data. It should move `Escalated` → `Attention Soon` once this runs live. I did not run a full batch across all claims in this sandbox — you flagged `CLM-26N-0103-WTR` earlier as having the same "Revision is active, but revision momentum appears stale" reason, so it's worth checking after this ships; whether it moves depends on whether it has genuine payment/accounting evidence after its own last genuine revision activity (it may not — this fix only downgrades health where that evidence genuinely exists).

## Resolution recommendations discovered

`CLM-26A-0043-WTR`'s open `Revision Active` condition: recommended for resolution review (medium confidence), now backed by guard-verified evidence rather than tied-timestamp luck.

## Risks and edge cases

- **Quoted-echo detection is itself a heuristic.** It's tuned against this claim's exact reply-thread format ("By \<name\> On \<date\>"). A differently-formatted reply thread (different wording, no "On", a forwarded-message format instead of a quoted-reply format) could slip past undetected. Recommend spot-checking a few more claims with historical-notes-import artifacts before broadly trusting this.
- **The timestamp-cluster fallback is a blunt instrument.** Any row that happens to share an exact-second timestamp with a row that looks like a quoted reply gets flagged too, even if it's unrelated. In this claim, that's correct (it's the same import batch), but on a claim where two unrelated genuine events are auto-timestamped to the same second by coincidence, one could get incorrectly flagged. Low probability, but worth knowing.
- **Health can now settle at `Attention Soon` indefinitely** for a claim like this until a person resolves the condition — there's no automatic re-escalation built for "it's been in Attention Soon too long with no human action," unlike the existing `At Risk` → `Escalated` → `Critical` persistence chain. That's consistent with your "review needed, not auto-closed" intent, but means this state relies on someone actually looking at the diagnostic.
- **`bulkRebuildTimelineDerivedFieldsForActiveClaims` now holds a full per-claim event array in memory** (for the guard's sibling lookups) rather than just running values. For your current data volume this is negligible, but it's a real increase in memory use per run, worth keeping in mind if the Timeline_Events sheet grows substantially.
- **This still doesn't create a `Waiting on Payment` condition** for claims like this one — the condition engine's phrase list doesn't yet recognize "payment has been issued / sent to accounting" as its own signal (flagged as a separate, not-yet-implemented follow-on in the earlier analysis).

## Test plan (for your live verification)

1. Run `diagnoseClaimHealth('CLM-26A-0043-WTR')` live; confirm `evaluatedHealthStatus` is `Attention Soon`, the reason text matches, and `openConditions[0]` shows `recommendedConditionResolution: true` with the three new evidence fields populated and `Revision Active` still listed as open.
2. Run `batchApplyClaimHealth()` (or wait for the morning automation) and confirm `Claim_Health_History` gets exactly one new row for this claim (`Escalated` → `Attention Soon`), with no duplicate on a second immediate run.
3. Confirm `Revision Active` is still present and open in `Claim_Conditions` afterward.
4. Spot-check `CLM-26N-0103-WTR` (and any other claims with the same stale-revision reason) to see whether they also move, and whether the guard behaves sensibly on their timeline data.
5. Construct/find a claim with a genuine newer revision request after a payment note and confirm it still escalates normally (no suppression).
